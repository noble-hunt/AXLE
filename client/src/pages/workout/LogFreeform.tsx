import { useState, useRef } from "react"
import { useLocation } from "wouter"
import { Button } from "@/components/swift/button"
import { Card } from "@/components/swift/card"
import { Chip } from "@/components/swift/chip"
import { SectionTitle } from "@/components/ui/section-title"
import { authFetch } from "@/lib/authFetch"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useAppStore } from "@/store/useAppStore"
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
  const [, setLocation] = useLocation()
  const { addWorkout } = useAppStore()
  
  // Form state
  const [text, setText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [parsed, setParsed] = useState<FreeformParsed | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Voice recognition
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const isVoiceSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

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
        setText(prevText => prevText + finalTranscript)
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
    
    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    // Check microphone permission first
    const hasPermission = await checkMicrophonePermission()
    if (!hasPermission) {
      setError('Microphone access is required. Please allow microphone permissions and try again.')
      return
    }
    
    // Clear any previous errors
    setError(null)
    
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
          setError('Microphone access denied. Please allow microphone permissions and try again.')
        } else {
          setError('Failed to start voice recording. Please try again or use manual text entry.')
        }
      } else {
        setError('Failed to start voice recording. Please try again or use manual text entry.')
      }
    }
  }

  const parseWorkout = async () => {
    if (!text.trim()) {
      setError('Please describe your workout first')
      return
    }
    
    setIsParsing(true)
    setError(null)
    
    try {
      const response = await authFetch('/api/workouts/parse-freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      })
      
      if (!response.ok) {
        throw new Error(`Parse failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      setParsed(data.parsed)
    } catch (err) {
      console.error('Parse error:', err)
      setError('Failed to parse workout. Please try manual entry.')
      setShowManualForm(true)
    } finally {
      setIsParsing(false)
    }
  }

  const logWorkout = async () => {
    if (!parsed) return
    
    setIsLogging(true)
    setError(null)
    
    try {
      const response = await authFetch('/api/workouts/log-freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed })
      })
      
      if (!response.ok) {
        throw new Error(`Log failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Invalidate cache and navigate
      await queryClient.invalidateQueries({ queryKey: ['/api/workouts'] })
      setLocation(`/workout/${data.id}`)
      
    } catch (err) {
      console.error('Log error:', err)
      setError('Failed to save workout. Please try again.')
    } finally {
      setIsLogging(false)
    }
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
          onClick={() => setLocation('/workout')}
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE_TEXT}
            className="w-full min-h-32 p-4 border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            maxLength={3000}
            data-testid="workout-textarea"
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {text.length}/3000
          </div>
        </div>
        
        <div className="flex gap-2">
          {/* Voice Recording Button */}
          {isVoiceSupported && (
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              onClick={toggleRecording}
              disabled={isParsing}
              data-testid="voice-button"
            >
              {isRecording ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>
          )}
          
          {/* Parse Button */}
          <Button
            onClick={parseWorkout}
            disabled={!text.trim() || isParsing}
            data-testid="parse-button"
          >
            <Send className="w-4 h-4 mr-2" />
            {isParsing ? 'Parsing...' : 'Parse Workout'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
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
              <div key={set.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                <span className="text-sm text-foreground">
                  {set.repScheme ? `${set.repScheme} ` : ''}
                  {set.exercise}
                  {set.weight ? ` @ ${set.weight} kg` : ''}
                  {set.notes ? ` (${set.notes})` : ''}
                </span>
                
                {isEditing && (
                  <div className="flex gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSet(index)}
                      data-testid={`remove-set-${index}`}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
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
            onClick={logWorkout}
            disabled={isLogging}
            className="w-full"
            data-testid="confirm-log-button"
          >
            <Check className="w-4 h-4 mr-2" />
            {isLogging ? 'Logging...' : 'Confirm & Log Workout'}
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