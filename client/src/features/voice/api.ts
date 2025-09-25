import { httpJSON } from '@/lib/http';
import { toast } from '@/hooks/use-toast';

export async function transcribeAudio(blob: Blob) {
  try {
    // Prefer JSON base64 (works in prod serverless reliably)
    const audioBase64 = await blobToBase64(blob);
    const data = await httpJSON('/api/stt/whisper', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: blob.type }),
    });
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