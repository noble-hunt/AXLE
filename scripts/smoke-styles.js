#!/usr/bin/env node
const fetch = (...a) => import('node-fetch').then(({default: f}) => f(...a));

const styles = [
  'crossfit','olympic_weightlifting','powerlifting','bb_full_body','bb_upper',
  'bb_lower','aerobic','conditioning','strength','endurance','gymnastics','mobility','mixed'
];

const assert = (cond, msg) => { if (!cond) { console.error('❌', msg); process.exitCode = 1; } };

async function smokeAllStyles() {
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
}

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

async function checkEndurance() {
  const body = { goal: 'endurance', durationMin: 30, intensity: 6, equipment: ['treadmill','rower','bike','jump_rope'], seed: 'SMOKE_ENDUR_30' };
  const r = await fetch('http://localhost:5000/api/workouts/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const j = await r.json();
  const txt = JSON.stringify(j.workout?.sets || []).toLowerCase();
  const meta = j.workout?.meta || {};
  console.log('STYLE=endurance gen=%s time_fit=%s style_ok=%s hardness_ok=%s', 
    meta.generator, 
    meta.acceptance?.time_fit,
    meta.acceptance?.style_ok,
    meta.acceptance?.hardness_ok
  );
  
  assert(meta.generator === 'premium', 'Expected premium generator');
  assert(meta.acceptance?.time_fit === true, 'time_fit must be true');
  
  // Assert the two critical fixes: style validation and hardness scoring
  if (meta.acceptance?.style_ok !== true) process.exit(1);
  if (meta.acceptance?.hardness_ok !== true) process.exit(1);
  
  // must be cardio/cyclical dominant
  const hasCyc = /(run|row|bike|erg|ski|swim|jump)/.test(txt);
  const hasSnatchOrThruster = /(snatch|thruster|clean|jerk|deadlift)/.test(txt);
  assert(hasCyc, 'Endurance must contain cyclical movements (run/row/bike/erg/ski/swim/jump)');
  assert(!hasSnatchOrThruster, 'Endurance must NOT contain snatch/thruster/clean/jerk/deadlift');
}

(async () => {
  await smokeAllStyles();
  await checkOlympic();
  await checkEndurance();
  process.exit(process.exitCode || 0);
})();
