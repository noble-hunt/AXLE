import { 
  Workout, 
  WorkoutBlock,
  CFAmrapBlock,
  CFForTimeBlock, 
  CFIntervalBlock,
  StrengthBlock,
  AccessoryBlock,
  MovementSpec,
  LoadSpec,
  ComplexSpec,
  formatLoad,
  formatRXPair,
  formatComplex,
  RX_STANDARDS
} from './schemas';

/**
 * Render CrossFit workouts in brand format
 */
export function renderCrossFit(workout: Workout): string {
  const lines: string[] = [];
  
  // Title and metadata
  lines.push(`**${workout.title.toUpperCase()}**`);
  lines.push(`Intensity: ${workout.intensity_1_to_10}/10 | Duration: ${workout.duration_min} min`);
  
  if (workout.rationale) {
    lines.push(`\n*${workout.rationale}*`);
  }
  
  lines.push('');
  
  // Process blocks
  workout.blocks.forEach((block, index) => {
    switch (block.kind) {
      case 'cf_amrap':
        lines.push(...renderCFAmrap(block));
        break;
      case 'cf_for_time':
        lines.push(...renderCFForTime(block));
        break;
      case 'cf_interval':
        lines.push(...renderCFInterval(block));
        break;
      case 'strength':
        lines.push(...renderStrengthBlock(block));
        break;
      case 'accessory':
        lines.push(...renderAccessoryBlock(block));
        break;
    }
    
    // Add spacing between blocks
    if (index < workout.blocks.length - 1) {
      lines.push('');
      lines.push('*Rest 2:00*');
      lines.push('');
    }
  });
  
  // Cool down
  if (workout.cool_down && workout.cool_down.length > 0) {
    lines.push('');
    lines.push('**COOL DOWN**');
    workout.cool_down.forEach(item => {
      if (item.seconds) {
        lines.push(`${item.name} - ${item.seconds}s`);
      } else if (item.reps) {
        lines.push(`${item.reps}x ${item.name}`);
      } else {
        lines.push(item.name);
      }
    });
  }
  
  return lines.join('\n');
}

function renderCFAmrap(block: CFAmrapBlock): string[] {
  const lines: string[] = [];
  
  lines.push(`**${block.minutes}:00 AMRAP**`);
  
  block.items.forEach(item => {
    lines.push(formatMovementForCF(item));
  });
  
  if (block.note) {
    lines.push(`\n*${block.note}*`);
  }
  
  return lines;
}

function renderCFForTime(block: CFForTimeBlock): string[] {
  const lines: string[] = [];
  
  lines.push('**FOR TIME**');
  
  // Parse reps scheme (e.g., "27-21-15-9")
  const repsRounds = block.reps_scheme.split('-').map(x => parseInt(x));
  
  repsRounds.forEach((reps, roundIndex) => {
    if (roundIndex === 0) {
      lines.push(`${reps} - ${repsRounds.slice(1).join(' - ')}`);
    }
  });
  
  block.items.forEach(item => {
    lines.push(formatMovementForCF(item, { skipReps: true })); // Reps in scheme
  });
  
  lines.push(`\n**${block.time_cap_min}:00 time cap!**`);
  
  return lines;
}

function renderCFInterval(block: CFIntervalBlock): string[] {
  const lines: string[] = [];
  
  const totalTime = block.rounds * (block.work_min + block.rest_sec / 60);
  lines.push(`**On a ${totalTime.toFixed(1)}:00 running clock...**`);
  lines.push(`${block.rounds} rounds:`);
  lines.push(`${block.work_min}:00 work`);
  lines.push(`${block.rest_sec}s rest`);
  lines.push('');
  
  block.items.forEach(item => {
    lines.push(formatMovementForCF(item));
  });
  
  return lines;
}

function renderStrengthBlock(block: StrengthBlock): string[] {
  const lines: string[] = [];
  
  let movementLine = `**${block.movement.toUpperCase()}**`;
  
  if (block.complex) {
    const complexFormat = formatComplex(block.complex);
    movementLine += ` (${complexFormat})`;
  }
  
  lines.push(movementLine);
  
  // Sets and reps
  let setsRepsLine = `${block.sets} sets`;
  if (block.reps) {
    setsRepsLine += ` x ${block.reps} reps`;
  }
  lines.push(setsRepsLine);
  
  // Load information
  if (block.percent_1rm) {
    lines.push(`@ ${block.percent_1rm}% of 1RM`);
  } else if (block.load) {
    lines.push(`@ ${formatLoad(block.load)}`);
  }
  
  // Rest period
  if (block.rest_sec) {
    const restMin = Math.floor(block.rest_sec / 60);
    const restSec = block.rest_sec % 60;
    if (restMin > 0) {
      lines.push(`Rest ${restMin}:${restSec.toString().padStart(2, '0')}`);
    } else {
      lines.push(`Rest ${restSec}s`);
    }
  }
  
  if (block.note) {
    lines.push(`\n*${block.note}*`);
  }
  
  return lines;
}

function renderAccessoryBlock(block: AccessoryBlock): string[] {
  const lines: string[] = [];
  
  lines.push('**ACCESSORY**');
  
  block.items.forEach(item => {
    lines.push(formatMovementForCF(item));
  });
  
  return lines;
}

function formatMovementForCF(movement: MovementSpec, options: { skipReps?: boolean } = {}): string {
  let line = '';
  
  // Reps
  if (!options.skipReps && movement.reps) {
    line += `${movement.reps} `;
  }
  
  // Movement name with RX pairs
  line += formatMovementName(movement.name);
  
  // Load with RX formatting
  if (movement.load) {
    line += ` @ ${formatLoad(movement.load)}`;
  } else if (hasRXStandard(movement.name)) {
    line += ` ${formatRXForMovement(movement.name)}`;
  }
  
  // Height for boxes
  if (movement.height_in) {
    line += ` ${movement.height_in}"`;
  }
  
  // Notes
  if (movement.notes) {
    line += ` (${movement.notes})`;
  }
  
  return line;
}

/**
 * Render Olympic lifting workouts in structured format
 */
export function renderOly(workout: Workout): string {
  const lines: string[] = [];
  
  // Title and metadata
  lines.push(`**${workout.title.toUpperCase()}**`);
  lines.push(`Intensity: ${workout.intensity_1_to_10}/10 | Duration: ${workout.duration_min} min`);
  
  if (workout.rationale) {
    lines.push(`\n*${workout.rationale}*`);
  }
  
  lines.push('');
  
  // Olympic workouts use lettered sections
  const sectionLabels = ['A', 'B', 'C', 'D', 'E'];
  
  workout.blocks.forEach((block, index) => {
    if (index < sectionLabels.length) {
      lines.push(`**${sectionLabels[index]}.**`);
    }
    
    switch (block.kind) {
      case 'strength':
        lines.push(...renderOlympicStrength(block));
        break;
      case 'accessory':
        lines.push(...renderOlympicAccessory(block));
        break;
      default:
        // Fallback to CF rendering for other types
        lines.push(...renderStrengthBlock(block));
        break;
    }
    
    if (index < workout.blocks.length - 1) {
      lines.push('');
    }
  });
  
  // Cool down
  if (workout.cool_down && workout.cool_down.length > 0) {
    lines.push('');
    lines.push('**COOL DOWN**');
    workout.cool_down.forEach(item => {
      if (item.seconds) {
        lines.push(`${item.name} - ${item.seconds}s`);
      } else if (item.reps) {
        lines.push(`${item.reps}x ${item.name}`);
      } else {
        lines.push(item.name);
      }
    });
  }
  
  return lines.join('\n');
}

function renderOlympicStrength(block: StrengthBlock): string[] {
  const lines: string[] = [];
  
  // Movement with complex notation
  let movementLine = block.movement;
  if (block.complex) {
    const complexFormat = formatComplex(block.complex);
    movementLine += ` (${complexFormat})`;
  }
  
  // Sets x reps @ percentage
  let workLine = `${block.sets}`;
  if (block.reps) {
    workLine += ` x ${block.reps}`;
  }
  
  if (block.percent_1rm) {
    workLine += ` @ ${block.percent_1rm}% of 1RM`;
    if (block.load?.ref_1rm_of) {
      workLine += ` ${block.load.ref_1rm_of}`;
    }
  } else if (block.load) {
    workLine += ` @ ${formatLoad(block.load)}`;
  }
  
  lines.push(`${movementLine}: ${workLine}`);
  
  if (block.note) {
    lines.push(`*${block.note}*`);
  }
  
  return lines;
}

function renderOlympicAccessory(block: AccessoryBlock): string[] {
  const lines: string[] = [];
  
  block.items.forEach((item, index) => {
    let line = '';
    
    if (item.reps) {
      line += `${item.reps} `;
    }
    
    line += item.name;
    
    if (item.load) {
      line += ` @ ${formatLoad(item.load)}`;
    }
    
    if (item.notes) {
      line += ` (${item.notes})`;
    }
    
    lines.push(line);
  });
  
  return lines;
}

/**
 * Main render dispatcher
 */
export function render(workout: Workout): string {
  switch (workout.category) {
    case 'CrossFit':
      return renderCrossFit(workout);
    case 'Olympic':
      return renderOly(workout);
    case 'Powerlifting':
      return renderOly(workout); // Use Olympic format for structured lifting
    default:
      return renderCrossFit(workout); // Default to CrossFit format
  }
}

// Helper functions
function formatMovementName(name: string): string {
  // Convert snake_case to Title Case
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function hasRXStandard(movementName: string): boolean {
  const key = movementName.toLowerCase().replace(/\s+/g, '_') as keyof typeof RX_STANDARDS;
  return key in RX_STANDARDS;
}

function formatRXForMovement(movementName: string): string {
  const key = movementName.toLowerCase().replace(/\s+/g, '_') as keyof typeof RX_STANDARDS;
  const standard = RX_STANDARDS[key];
  
  if (!standard) return '';
  
  if (typeof standard === 'object' && 'male' in standard && 'female' in standard) {
    return formatRXPair(standard.male, standard.female);
  }
  
  return '';
}