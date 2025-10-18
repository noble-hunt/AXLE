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

const assert = (cond, msg) => { if (!cond) { console.error('❌', msg); process.exitCode = 1; } };

async function checkOlympic() {
  const res = await fetch('http://localhost:5000/api/workouts/generate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ goal: 'olympic_weightlifting', durationMin: 30, intensity: 6, equipment: ['barbell'], seed: 'SMOKE_OLY_30' })
  });
  const json = await res.json();
  const sets = json.workout?.sets || [];
  const meta = json.workout?.meta || json.meta || {};
  const text = JSON.stringify(sets).toLowerCase();

  console.log('STYLE=olympic_weightlifting gen=%s time_fit=%s', meta.generator, meta.acceptance?.time_fit);

  assert(meta.generator === 'premium', 'Expected premium generator');
  assert(meta.acceptance?.time_fit === true, 'time_fit must be true');
  assert(text.includes('snatch'), 'snatch required');
  assert(text.includes('clean') && text.includes('jerk'), 'clean & jerk required');
}
checkOlympic().then(()=>process.exit());
