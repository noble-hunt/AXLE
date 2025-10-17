#!/usr/bin/env node
const fetch = (...a) => import('node-fetch').then(({default: f}) => f(...a));

const styles = [
  'crossfit','olympic_weightlifting','powerlifting','bb_full_body','bb_upper',
  'bb_lower','aerobic','conditioning','strength','endurance','gymnastics','mobility','mixed'
];

(async () => {
  for (const s of styles) {
    const r = await fetch('http://localhost:5000/api/workouts/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ goal: s, durationMin: 30, intensity: 7, equipment: ['barbell','dumbbell','kettlebell'], seed: `STYLE-${s}` })
    });
    const gen = r.headers.get('x-axle-generator');
    const styleHdr = r.headers.get('x-axle-style');
    const body = await r.json().catch(() => ({}));
    const ok = body.ok === true;
    console.log(`STYLE=${s.padEnd(22)} ok=${ok} gen=${gen || 'n/a'} hdrStyle=${styleHdr || 'n/a'} metaStyle=${body.workout?.meta?.style || 'n/a'}`);
  }
})();
