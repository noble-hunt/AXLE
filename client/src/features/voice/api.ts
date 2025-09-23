export async function transcribeAudio(blob: Blob) {
  // Prefer JSON base64 (works in prod serverless reliably)
  const audioBase64 = await blobToBase64(blob);
  const res = await fetch('/api/stt/whisper', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType: blob.type }),
  });
  const text = await res.text();
  let data:any = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data.transcript as string;

  function blobToBase64(b: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.readAsDataURL(b);
    });
  }
}