import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type Movement = {
  id: string;
  name: string;
  category: 'olympic_weightlifting'|'powerlifting'|'bb_full_body'|'bb_upper'|'bb_lower'|'gymnastics'|'crossfit'|'aerobic'|'mobility';
  patterns: string[];
  equipment: string[];
  modality: 'strength'|'conditioning'|'skill'|'aerobic'|'mobility';
  level: 'beginner'|'intermediate'|'advanced';
  banned_in_main_when_equipment?: boolean;
  aliases?: string[];
};

type MovementRegistry = Movement[];

const CATEGORY_MAP: Record<string, Movement['category']> = {
  'olympic weightlifting': 'olympic_weightlifting',
  'powerlifting': 'powerlifting',
  'bodybuilding full body': 'bb_full_body',
  'bodybuilding upper body': 'bb_upper',
  'bodybuilding lower body': 'bb_lower',
  'gymnastics work': 'gymnastics',
  'crossfit': 'crossfit',
  'aerobic': 'aerobic',
  'mobility/stretching session': 'mobility',
  'aerobic/cardio': 'aerobic'
};

const BANNED_MOVEMENTS = new Set([
  'wall sit', 'mountain climber', 'star jump', 'jumping jacks', 'jumping jack',
  'bicycle crunch', 'bicycle crunches'
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferPatterns(name: string, category: Movement['category']): string[] {
  const nameLower = name.toLowerCase();
  const patterns: string[] = [];

  // Olympic movements
  if (nameLower.includes('snatch')) patterns.push('olympic_snatch');
  if (nameLower.includes('clean') && (nameLower.includes('jerk') || nameLower.includes('pull'))) {
    patterns.push('olympic_cleanjerk');
  }

  // Movement patterns
  if (nameLower.match(/squat|box|lunge|step/)) patterns.push('squat');
  if (nameLower.match(/deadlift|rdl|good morning|hinge|hip thrust|bridge/)) patterns.push('hinge');
  if (nameLower.match(/press|push|dip|bench/)) patterns.push('press');
  if (nameLower.match(/pull|row|chin|lat|face pull/)) patterns.push('pull');
  if (nameLower.match(/lunge|split squat/)) patterns.push('lunge');
  if (nameLower.match(/carry|walk|farmer/)) patterns.push('carry');
  if (nameLower.match(/jump|hop|leap|bound/)) patterns.push('jump');

  // Gymnastics specific
  if (category === 'gymnastics') {
    if (nameLower.match(/push-?up|dip|handstand/)) patterns.push('gym_push');
    if (nameLower.match(/pull-?up|muscle-?up|rope climb/)) patterns.push('gym_pull');
  }

  // Core
  if (nameLower.match(/plank|crunch|sit-?up|leg raise|hollow|toes.*bar|knee.*elbow|ab wheel/)) {
    patterns.push('core');
  }

  // Cardio
  if (nameLower.match(/run|row|bike|ski|swim|jump rope|burpee/)) {
    patterns.push('cardio');
  }

  // Mobility
  if (category === 'mobility') {
    if (nameLower.match(/dynamic|swing|circle|rock|flow|crawl/)) {
      patterns.push('mobility_dynamic');
    } else {
      patterns.push('mobility_static');
    }
  }

  return patterns.length > 0 ? patterns : ['general'];
}

function inferEquipment(name: string, category: Movement['category']): string[] {
  const nameLower = name.toLowerCase();
  const equipment: string[] = [];

  if (nameLower.match(/barbell|bb\s/)) equipment.push('barbell');
  if (nameLower.match(/dumbbell|db\s/)) equipment.push('dumbbell');
  if (nameLower.match(/kettlebell|kb\s/)) equipment.push('kettlebell');
  if (nameLower.match(/machine|leg press|hack squat|pec deck|smith/)) equipment.push('machine');
  if (nameLower.match(/cable/)) equipment.push('cable');
  if (nameLower.match(/band|elastic/)) equipment.push('band');
  if (nameLower.match(/ring/)) equipment.push('ring');
  if (nameLower.match(/rope climb/)) equipment.push('rope'); // More specific to avoid false positives
  if (nameLower.match(/sled/)) equipment.push('sled');
  if (nameLower.match(/sandbag/)) equipment.push('sandbag');
  if (nameLower.match(/medicine ball|slam ball|wall ball/)) equipment.push('ball'); // More specific
  if (nameLower.match(/assault bike|air bike|echo bike|stationary bike/)) equipment.push('bike'); // More specific
  if (nameLower.match(/rower|row erg|rowing machine/)) equipment.push('rower');
  if (nameLower.match(/ski erg/)) equipment.push('ski');
  if (nameLower.match(/treadmill/)) equipment.push('treadmill');
  if (nameLower.match(/c2 erg|concept2/)) equipment.push('erg');
  if (nameLower.match(/pool|swim/)) equipment.push('pool');

  // Olympic weightlifting and powerlifting movements are primarily barbell
  if (category === 'olympic_weightlifting' || category === 'powerlifting') {
    if (nameLower.match(/snatch|clean|jerk|squat|deadlift|press|pull|bench/) && equipment.length === 0) {
      equipment.push('barbell');
    }
  }

  // Bodyweight if no equipment detected or specific bodyweight indicators
  if (equipment.length === 0 || nameLower.match(/bodyweight|bw\s|push-?up|pull-?up|dip|air squat|pistol/)) {
    equipment.push('bodyweight');
  }

  return equipment;
}

function inferModality(category: Movement['category'], patterns: string[]): Movement['modality'] {
  if (category === 'aerobic') return 'aerobic';
  if (category === 'mobility') return 'mobility';
  if (category === 'gymnastics') return 'skill';
  
  if (patterns.some(p => p.includes('olympic'))) return 'skill';
  if (patterns.includes('cardio')) return 'conditioning';
  
  return 'strength';
}

function inferLevel(name: string, category: Movement['category']): Movement['level'] {
  const nameLower = name.toLowerCase();
  
  // Advanced indicators
  if (nameLower.match(/competition|deficit|weighted|single.?leg|single.?arm|advanced|muscle.?up|handstand|pistol|one.?arm|one.?leg/)) {
    return 'advanced';
  }
  
  // Complex movements
  if (nameLower.match(/snatch|clean.*jerk|complex/)) {
    return 'advanced';
  }
  
  // Beginner indicators
  if (nameLower.match(/wall|box|assisted|band|knee|incline|machine|beginner/)) {
    return 'beginner';
  }
  
  return 'intermediate';
}

function extractMovements(content: string): MovementRegistry {
  const lines = content.split('\n');
  const movements: Movement[] = [];
  const seen = new Set<string>();
  
  let currentCategory: Movement['category'] | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for category headers (## 1. Category Name or ## Category Name)
    if (line.startsWith('## ')) {
      const categoryName = line
        .replace(/^##\s+\d+\.\s*/, '')  // Remove ## 1.
        .replace(/\s*\(\d+\+?\s*[Mm]ovements?\)/g, '')  // Remove (180+ Movements)
        .replace(/\s*\(\d+\+?\s*[Ee]xercises?\)/g, '')  // Remove (140+ Exercises)
        .toLowerCase()
        .trim();
      currentCategory = CATEGORY_MAP[categoryName] || null;
      if (currentCategory) {
        console.log(`Found category: ${categoryName} -> ${currentCategory}`);
      }
      continue;
    }
    
    // Skip if no category set
    if (!currentCategory) continue;
    
    // Process bullet points or inline lists after category labels
    let movementText = '';
    
    if (line.startsWith('-')) {
      movementText = line.replace(/^-\s+/, '').replace(/\*\*/g, '').trim();
    } else if (line.includes(':') && !line.startsWith('###')) {
      // Handle lines like "**By Catching Position:** Power Snatch, Squat Snatch, ..."
      const parts = line.split(':');
      if (parts.length >= 2) {
        movementText = parts.slice(1).join(':').replace(/\*\*/g, '').trim();
      }
    } else {
      continue;
    }
    
    // Skip empty or header-like lines
    if (!movementText || movementText.length === 0) {
      continue;
    }
    
    // Split by comma for multiple movements in one line
    const parts = movementText.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    for (const part of parts) {
      // Clean up the name
      let cleanName = part
        .replace(/\(.*?\)/g, '')  // Remove parenthetical content
        .replace(/\d+-?\d*\s*(seconds?|reps?|rounds?|minutes?|°|degrees?)/gi, '') // Remove numbers
        .trim();
      
      if (!cleanName || cleanName.length < 3) continue;
      
      const slug = slugify(cleanName);
      if (seen.has(slug)) continue;
      seen.add(slug);
      
      const patterns = inferPatterns(cleanName, currentCategory);
      const equipment = inferEquipment(cleanName, currentCategory);
      const modality = inferModality(currentCategory, patterns);
      const level = inferLevel(cleanName, currentCategory);
      
      const movement: Movement = {
        id: slug,
        name: cleanName,
        category: currentCategory,
        patterns,
        equipment,
        modality,
        level
      };
      
      // Check if banned in main when equipment
      if (BANNED_MOVEMENTS.has(cleanName.toLowerCase())) {
        movement.banned_in_main_when_equipment = true;
      }
      
      movements.push(movement);
    }
  }
  
  return movements;
}

function main() {
  console.log('📖 Reading Movementlist.md...');
  const markdownPath = join(process.cwd(), 'server', 'data', 'Movementlist.md');
  const content = readFileSync(markdownPath, 'utf-8');
  
  console.log('🔍 Parsing movements...');
  const registry = extractMovements(content);
  
  console.log(`✅ Extracted ${registry.length} unique movements`);
  
  // Category breakdown
  const categoryStats = registry.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📊 Category breakdown:');
  Object.entries(categoryStats).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  // Write full JSON
  const outputPath = join(process.cwd(), 'server', 'data', 'movements.registry.json');
  writeFileSync(outputPath, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`\n💾 Wrote ${outputPath}`);
  
  // Write minified JSON
  const minPath = join(process.cwd(), 'server', 'data', 'movements.registry.min.json');
  writeFileSync(minPath, JSON.stringify(registry), 'utf-8');
  console.log(`💾 Wrote ${minPath}`);
  
  // Spot checks
  console.log('\n🔍 Spot checks:');
  const snatch = registry.find(m => m.name.toLowerCase() === 'snatch');
  if (snatch) {
    console.log('  ✓ Snatch:', JSON.stringify(snatch, null, 2));
  }
  
  const cleanJerk = registry.find(m => m.name.toLowerCase().includes('clean') && m.name.toLowerCase().includes('jerk'));
  if (cleanJerk) {
    console.log('  ✓ Clean & Jerk:', JSON.stringify(cleanJerk, null, 2));
  }
  
  const ringMuscleUp = registry.find(m => m.name.toLowerCase().includes('ring') && m.name.toLowerCase().includes('muscle'));
  if (ringMuscleUp) {
    console.log('  ✓ Ring Muscle-up:', JSON.stringify(ringMuscleUp, null, 2));
  }
  
  console.log('\n✨ Done!');
}

main();
