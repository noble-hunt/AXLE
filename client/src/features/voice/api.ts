import { authFetch } from '@/lib/authFetch';
import { toast } from '@/hooks/use-toast';
import { API_ORIGIN, API_PREFIX } from '@/lib/env';

export async function transcribeAudio(blob: Blob) {
  try {
    // Prefer JSON base64 (works in prod serverless reliably)
    const audioBase64 = await blobToBase64(blob);
    const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/stt/whisper`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: blob.type }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Transcription failed');
    }
    
    const data = await response.json();
    return data.transcript as string;
  } catch (error: any) {
    toast({
      title: "Voice Transcription Failed",
      description: error.message || "Unable to transcribe audio. Please try again.",
      variant: "destructive"
    });
    throw error;
  }

  function blobToBase64(b: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.readAsDataURL(b);
    });
  }
}