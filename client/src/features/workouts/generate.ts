export async function generateWorkout(input:{category:string;durationMin:number;intensity:number;equipment?:string[];goal?:string;}) {
  const res = await fetch('/api/workouts/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  const raw = await res.text();
  let data:any = {}; try { data = JSON.parse(raw); } catch {}
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data.workout;
}