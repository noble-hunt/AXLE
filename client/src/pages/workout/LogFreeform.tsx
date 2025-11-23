import { useState, useRef } from "react"
import { useLocation } from "wouter"
import { Button } from "@/components/swift/button"
import { Card } from "@/components/swift/card"
import { Chip } from "@/components/swift/chip"
import { SectionTitle } from "@/components/ui/section-title"
import { useToast } from "@/hooks/use-toast"
import { queryClient } from "@/lib/queryClient"
import { useAppStore } from "@/store/useAppStore"
import { transcribeAudio } from '@/features/voice/api'
import { parseFreeform, logFreeform } from '@/features/workouts/freeformApi'
import { 
  Category, 
  FreeformParsed, 
  WorkoutFormat, 
  WorkoutSet 
} from "@/types"
import { 
  Mic, 
  MicOff, 
  Send, 
  Edit, 
  Check, 
  X, 
  Plus, 
  Minus,
  AlertTriangle,
  ArrowLeft
} from "lucide-react"

interface VoiceRecognition {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => VoiceRecognition;
    SpeechRecognition: new () => VoiceRecognition;
  }
}

const EXAMPLE_TEXT = `CrossFit. 20 min AMRAP: 10 pull-ups, 15 push-ups, 20 air squats. Finished 8 rounds. Felt 7/10 intensity.`

const CATEGORY_OPTIONS = Object.values(Category)
const FORMAT_OPTIONS: WorkoutFormat[] = ["EMOM", "AMRAP", "For Time", "Strength", "Skill", "Intervals", "Circuit", "Other"]

// Confidence level helpers
const getConfidenceLevel = (confidence: number): "high" | "medium" | "low" => {
  if (confidence >= 0.8) return "high"
  if (confidence >= 0.6) return "medium"
  return "low"
}

const getConfidenceVariant = (level: "high" | "medium" | "low") => {
  switch (level) {
    case "high": return "success"
    case "medium": return "warning"
    case "low": return "destructive"
  }
}

export default function LogFreeform() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const { addWorkout } = useAppStore()
  
  // Form state
  const [transcript, setTranscript] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [parsed, setParsed] = useState<FreeformParsed | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isBusy, setBusy] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [diagnostics, setDiag] = useState<any>(null)
  const [isServerRecording, setIsServerRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  // Voice recognition
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const isVoiceSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  // Run comprehensive voice diagnostics
  const runVoiceDiagnostics = async () => {
    const diag: any = {
      timestamp: new Date().toISOString(),
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
      isInIframe: typeof window !== 'undefined' ? window.top !== window : false,
      speechAPIPresent: isVoiceSupported,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'N/A',
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
      errors: []
    }

    // Test getUserMedia access
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        diag.microphoneAccess = 'granted'
        
        // Count audio input devices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          diag.audioInputDevices = devices.filter(d => d.kind === 'audioinput').length
        } catch (err) {
          diag.audioInputDevices = 'unknown'
        }
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop())
      } else {
        diag.microphoneAccess = 'getUserMedia not available'
      }
    } catch (err: any) {
      diag.microphoneAccess = 'denied'
      diag.microphoneError = err.name + ': ' + err.message
    }

    // Test permissions API
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        diag.permissionState = permission.state
      } else {
        diag.permissionState = 'API not available'
      }
    } catch (err: any) {
      diag.permissionState = 'error: ' + err.message
    }

    // Test speech recognition instantiation
    try {
      if (isVoiceSupported) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
        const testRecognition = new SpeechRecognition()
        diag.speechRecognitionInstantiation = 'success'
        
        // Test basic config
        testRecognition.continuous = true
        testRecognition.interimResults = true
        testRecognition.lang = 'en-US'
        diag.speechRecognitionConfig = 'success'
      } else {
        diag.speechRecognitionInstantiation = 'API not supported'
      }
    } catch (err: any) {
      diag.speechRecognitionInstantiation = 'error: ' + err.message
    }

    setDiag(diag)
    console.log('🔍 Voice Diagnostics:', diag)
    return diag
  }

  // Server-side audio recording using MediaRecorder + Whisper
  const startServerRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioChunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 64000
      })
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        
        // Stop all tracks to free up microphone
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsServerRecording(true)
      setError(null)
      
    } catch (err: any) {
      console.error('Server recording failed:', err)
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.')
      } else {
        setError('Failed to start audio recording. Please try manual text entry.')
      }
    }
  }

  const stopServerRecording = () => {
    if (mediaRecorderRef.current && isServerRecording) {
      mediaRecorderRef.current.stop()
      setIsServerRecording(false)
    }
  }

  async function onTranscribe(blob: Blob) {
    let transcribedText = '';
    try {
      setDiag(null);
      setBusy(true);
      
      // Step 1: Transcribe audio
      transcribedText = await transcribeAudio(blob);
      setTranscript(transcribedText || '');
      
      // Step 2: Auto-parse after successful transcription
      if (transcribedText && transcribedText.trim()) {
        try {
          const parsed = await parseFreeform(transcribedText);
          setParsed(parsed);
        } catch (parseError: any) {
          // Parsing failed but transcription succeeded - keep the text
          toast({ 
            variant: "destructive",
            title: "Parsing failed", 
            description: parseError?.message || 'Failed to parse workout. You can edit the text and try again.'
          });
        }
      }
    } catch (e:any) {
      // Transcription failed - only clear if we got no text
      if (!transcribedText) {
        setTranscript('');
      }
      toast({ 
        variant: "destructive",
        title: "Transcription failed", 
        description: e?.message || 'Failed to transcribe audio'
      });
    } finally {
      setBusy(false);
    }
  }

  // Initialize voice recognition with better error handling
  const initVoiceRecognition = () => {
    if (!isVoiceSupported) return null
    
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    
    recognition.onresult = (event) => {
      let finalTranscript = ""
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " "
        }
      }
      
      if (finalTranscript) {
        setTranscript(prevText => prevText + finalTranscript)
      }
    }
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsRecording(false)
      
      // Handle different error types with specific messages
      switch (event.error) {
        case 'network':
          setError('Network error. Check your internet connection and try again.')
          break
        case 'not-allowed':
        case 'permission-denied':
          setError('Microphone access denied. Please allow microphone permissions and try again.')
          break
        case 'no-speech':
          setError('No speech detected. Please speak clearly and try again.')
          break
        case 'audio-capture':
          setError('Microphone not found. Please check your microphone and try again.')
          break
        case 'service-not-allowed':
          setError('Speech service not available. Please use manual text entry.')
          break
        default:
          setError('Voice recognition failed. Please try again or use manual text entry.')
      }
    }
    
    recognition.onend = () => {
      setIsRecording(false)
    }
    
    return recognition
  }

  // Check microphone permissions
  const checkMicrophonePermission = async () => {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        return permission.state === 'granted'
      }
      return true // Assume granted if permissions API not available
    } catch (err) {
      console.warn('Could not check microphone permission:', err)
      return true // Assume granted if check fails
    }
  }

  const toggleRecording = async () => {
    if (!isVoiceSupported) {
      setError('Voice recognition is not supported in this browser. Please use manual text entry.')
      return
    }
    
    // Check environment constraints
    if (typeof window !== 'undefined') {
      if (!window.isSecureContext) {
        setError('Voice recognition requires HTTPS. Please open this page in a secure context.')
        return
      }
      
      if (window.top !== window) {
        setError('Voice recognition may be blocked in embedded frames. Try opening in a new tab.')
        return
      }
    }
    
    if (isRecording) {
      recognitionRef.current?.abort()
      setIsRecording(false)
      return
    }

    // Clear any previous errors
    setError(null)
    
    // Preflight check: verify microphone access
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Immediately stop the stream - we just needed to verify access
        stream.getTracks().forEach(track => track.stop())
      } else {
        setError('Microphone access not available in this browser. Please use manual text entry.')
        return
      }
    } catch (err: any) {
      console.error('Microphone preflight failed:', err)
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions and try again.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please check your audio devices and try again.')
      } else {
        setError('Failed to access microphone. Please check your settings and try again.')
      }
      return
    }
    
    // Reinitialize recognition for each use to avoid stale state
    recognitionRef.current = initVoiceRecognition()
    
    if (!recognitionRef.current) {
      setError('Failed to initialize voice recognition. Please use manual text entry.')
      return
    }
    
    try {
      recognitionRef.current.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setIsRecording(false)
      
      if (err instanceof Error) {
        if (err.name === 'InvalidStateError') {
          setError('Voice recognition is already running. Please wait and try again.')
        } else if (err.name === 'NotAllowedError') {
          setError('Voice recognition service not allowed. Please check browser settings.')
        } else {
          setError('Failed to start voice recording. Please try again or use manual text entry.')
        }
      } else {
        setError('Failed to start voice recording. Please try again or use manual text entry.')
      }
    }
  }

  async function onParse() {
    try {
      setBusy(true);
      const parsed = await parseFreeform(transcript);
      setParsed(parsed);
    } catch (e:any) {
      toast({ 
        variant: "destructive",
        title: "Parse failed", 
        description: e?.message || 'Failed to parse workout'
      });
    } finally { setBusy(false); }
  }

  async function onSave() {
    try {
      setBusy(true);
      const id = await logFreeform(parsed, parsed?.title);
      toast({ 
        title: "Workout saved", 
        description: "Your workout has been logged successfully"
      });
      navigate('/history');
    } catch (e:any) {
      toast({ 
        variant: "destructive",
        title: "Save failed", 
        description: e?.message || 'Failed to save workout'
      });
    } finally { setBusy(false); }
  }

  const updateParsedField = (field: keyof FreeformParsed, value: any) => {
    if (!parsed) return
    setParsed({ ...parsed, [field]: value })
  }

  const updateRequestField = (field: keyof FreeformParsed['request'], value: any) => {
    if (!parsed) return
    setParsed({
      ...parsed,
      request: { ...parsed.request, [field]: value }
    })
  }

  const addSet = () => {
    if (!parsed) return
    const newSet: WorkoutSet = {
      id: `set-${Date.now()}`,
      exercise: '',
      repScheme: ''
    }
    setParsed({
      ...parsed,
      sets: [...parsed.sets, newSet]
    })
  }

  const updateSet = (index: number, updates: Partial<WorkoutSet>) => {
    if (!parsed) return
    const newSets = [...parsed.sets]
    newSets[index] = { ...newSets[index], ...updates }
    setParsed({ ...parsed, sets: newSets })
  }

  const removeSet = (index: number) => {
    if (!parsed) return
    setParsed({
      ...parsed,
      sets: parsed.sets.filter((_, i) => i !== index)
    })
  }

  const confidenceLevel = parsed ? getConfidenceLevel(parsed.confidence) : "high"
  const showLowConfidenceWarning = parsed && parsed.confidence < 0.6

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/workout')}
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <SectionTitle title="Log your own workout" />
      </div>

      {/* Instructions */}
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Describe your workout in plain English. Include category or style (e.g., CrossFit/HIIT, Powerlifting, Aerobic), 
          format (EMOM/AMRAP/For time/Strength), sets & reps, weights or time caps, and total time.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          <strong>Example:</strong> "{EXAMPLE_TEXT}"
        </p>
      </Card>

      {/* Text Input Area */}
      <div className="space-y-3">
        <div className="relative">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={EXAMPLE_TEXT}
            className="w-full min-h-32 p-4 border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            maxLength={3000}
            data-testid="workout-textarea"
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {transcript.length}/3000
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Record Audio Button */}
          <Button
            variant={isServerRecording ? "destructive" : "secondary"}
            onClick={isServerRecording ? stopServerRecording : startServerRecording}
            disabled={isBusy}
            data-testid="server-voice-button"
          >
            {isServerRecording ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
            {isServerRecording ? 'Stop Recording' : 'Record Audio'}
          </Button>

          {/* Transcribe Button - Auto-parses after transcription */}
          {audioBlob && (
            <Button
              variant="primary"
              onClick={() => onTranscribe(audioBlob!)}
              disabled={isBusy || isServerRecording}
              data-testid="transcribe-button"
            >
              <Send className="w-4 h-4 mr-2" />
              {isBusy ? 'Transcribing...' : 'Transcribe Audio'}
            </Button>
          )}
          
          {/* Parse Button - For manual text entry (not shown when audio is being used) */}
          {!audioBlob && transcript.trim() && (
            <Button
              onClick={onParse}
              disabled={isBusy || isServerRecording}
              data-testid="parse-button"
            >
              <Send className="w-4 h-4 mr-2" />
              {isBusy ? 'Parsing...' : 'Parse Workout'}
            </Button>
          )}
        </div>
      </div>

      {/* Environmental Issues Warning */}
      {typeof window !== 'undefined' && (!window.isSecureContext || window.top !== window) && (
        <Card className="p-4 border-warning bg-warning/10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <p className="text-sm font-medium text-warning">Voice recognition requires secure context</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {!window.isSecureContext && "HTTPS is required for voice recognition. "}
              {window.top !== window && "Voice features may be blocked in embedded frames. "}
              Try opening this page in a new tab for full functionality.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(window.location.href, '_blank')}
              data-testid="open-new-tab"
            >
              Open in New Tab (HTTPS)
            </Button>
          </div>
        </Card>
      )}

      {/* Voice Diagnostics Panel */}
      {showDiagnostics && diagnostics && (
        <Card className="p-4 bg-muted/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Voice Recognition Diagnostics</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiagnostics(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div>🔒 Secure Context: {diagnostics.isSecureContext ? '✅' : '❌'}</div>
              <div>🖼️ In Frame: {diagnostics.isInIframe ? '⚠️ Yes' : '✅ No'}</div>
              <div>🎤 Microphone: {diagnostics.microphoneAccess}</div>
              <div>🔊 Audio Devices: {diagnostics.audioInputDevices}</div>
              <div>📋 Permission: {diagnostics.permissionState}</div>
              <div>🎙️ Speech API: {diagnostics.speechRecognitionInstantiation}</div>
              <div>🌐 Protocol: {diagnostics.protocol}</div>
              <div>🖥️ Browser: {diagnostics.userAgent.includes('Chrome') ? 'Chrome' : diagnostics.userAgent.includes('Safari') ? 'Safari' : 'Other'}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            {!showDiagnostics && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDiagnostics(true)
                  runVoiceDiagnostics()
                }}
                className="ml-auto"
                data-testid="show-diagnostics"
              >
                Debug
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Audio Recording Status */}
      {audioBlob && (
        <Card className="p-4 bg-secondary/20 border-secondary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-secondary-foreground" />
              <p className="text-sm font-medium text-secondary-foreground">Audio recorded successfully</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAudioBlob(null)}
                data-testid="clear-audio"
              >
                <X className="w-3 h-3" />
                Clear
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Click "Transcribe Audio" to convert your recording to text, or record again to replace.
          </p>
        </Card>
      )}

      {/* Parsed Preview */}
      {parsed && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Workout Preview</h3>
            <div className="flex items-center gap-2">
              <Chip 
                variant={getConfidenceVariant(confidenceLevel)} 
                size="sm"
                data-testid="confidence-chip"
              >
                {confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)} Confidence
              </Chip>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                data-testid="edit-toggle"
              >
                {isEditing ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                {isEditing ? 'Done' : 'Edit'}
              </Button>
            </div>
          </div>

          {/* Low confidence warning */}
          {showLowConfidenceWarning && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <p className="text-sm text-warning font-medium">Please review before saving.</p>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <h4 className="text-subheading font-semibold text-foreground">{parsed.title}</h4>
          </div>

          {/* Top Row: Category, Duration, Intensity, Format */}
          <div className="flex flex-wrap gap-2">
            <Chip variant="default" size="sm" data-testid="chip-category">
              {parsed.request.category}
            </Chip>
            <Chip variant="default" size="sm" data-testid="chip-duration">
              {parsed.request.duration}min
            </Chip>
            <Chip variant="default" size="sm" data-testid="chip-intensity">
              {parsed.request.intensity}/10
            </Chip>
            <Chip variant="default" size="sm" data-testid="chip-format">
              {parsed.format}
            </Chip>
          </div>

          {/* Movements List */}
          <div className="space-y-2">
            <h5 className="font-medium text-foreground">Movements</h5>
            {parsed.sets.map((set, index) => (
              <div key={set.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                {isEditing ? (
                  // Editing Mode - Show Input Fields
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={set.exercise || (set as any).movement || ''}
                        onChange={(e) => updateSet(index, { exercise: e.target.value })}
                        placeholder="Exercise name"
                        className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid={`input-exercise-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSet(index)}
                        data-testid={`remove-set-${index}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={set.repScheme || ''}
                        onChange={(e) => updateSet(index, { repScheme: e.target.value })}
                        placeholder="Rep scheme (e.g., 5x5, 3 rounds)"
                        className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid={`input-rep-scheme-${index}`}
                      />
                      <input
                        type="number"
                        value={set.weight || ''}
                        onChange={(e) => updateSet(index, { weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="Weight (kg)"
                        className="w-24 px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        step="0.5"
                        data-testid={`input-weight-${index}`}
                      />
                    </div>
                    
                    <input
                      type="text"
                      value={set.notes || ''}
                      onChange={(e) => updateSet(index, { notes: e.target.value })}
                      placeholder="Notes (optional)"
                      className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      data-testid={`input-notes-${index}`}
                    />
                  </div>
                ) : (
                  // View Mode - Show Read-Only Text
                  <span className="text-sm text-foreground">
                    {set.repScheme ? `${set.repScheme} ` : ''}
                    {set.exercise || (set as any).movement}
                    {set.weight ? ` @ ${set.weight} kg` : ''}
                    {set.notes ? ` (${set.notes})` : ''}
                  </span>
                )}
              </div>
            ))}
            
            {isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addSet}
                className="w-full"
                data-testid="add-set"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Movement
              </Button>
            )}
          </div>

          {/* Notes */}
          {parsed.notes && (
            <div>
              <h5 className="font-medium text-foreground mb-1">Notes</h5>
              <p className="text-sm text-muted-foreground">{parsed.notes}</p>
            </div>
          )}

          {/* Confirm & Log Button */}
          <Button
            onClick={onSave}
            disabled={isBusy}
            className="w-full"
            data-testid="confirm-log-button"
          >
            <Check className="w-4 h-4 mr-2" />
            {isBusy ? 'Logging...' : 'Confirm & Log Workout'}
          </Button>
        </Card>
      )}

      {/* Manual Form (fallback) */}
      {showManualForm && !parsed && (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Manual Entry</h3>
          <p className="text-sm text-muted-foreground">
            Enter your workout details manually if parsing failed.
          </p>
          {/* Manual form would go here - simplified for now */}
          <Button
            variant="secondary"
            onClick={() => setShowManualForm(false)}
            data-testid="close-manual-form"
          >
            Close Manual Entry
          </Button>
        </Card>
      )}
    </div>
  )
}