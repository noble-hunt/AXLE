/**
 * Renders a workout object into a human-readable string format
 * Used for displaying AI-generated workouts in a structured way
 */
export function render(workout) {
    const sections = [];
    // Header with workout info
    sections.push(`# ${workout.name}`);
    sections.push(`**Category:** ${workout.category}`);
    sections.push(`**Format:** ${workout.format}`);
    sections.push(`**Duration:** ${workout.duration_min} minutes`);
    sections.push(`**Intensity:** ${workout.intensity_1_to_10}/10`);
    if (workout.description) {
        sections.push(`**Description:** ${workout.description}`);
    }
    if (workout.equipment_needed && workout.equipment_needed.length > 0) {
        sections.push(`**Equipment:** ${workout.equipment_needed.join(', ')}`);
    }
    sections.push(''); // Empty line
    // Render each block
    workout.blocks.forEach((block, index) => {
        sections.push(renderBlock(block, index + 1));
        sections.push(''); // Empty line between blocks
    });
    // Coaching notes
    if (workout.coaching_notes) {
        sections.push('## Coaching Notes');
        sections.push(workout.coaching_notes);
    }
    return sections.join('\n');
}
/**
 * Renders a single workout block
 */
function renderBlock(block, blockNumber) {
    const sections = [];
    sections.push(`## Block ${blockNumber}: ${block.name}`);
    sections.push(`**Type:** ${block.type} | **Duration:** ~${block.estimated_duration_min} min`);
    if (block.format) {
        sections.push(`**Format:** ${block.format}`);
    }
    // Render warmup steps
    if (block.warmup_steps && block.warmup_steps.length > 0) {
        sections.push('**Warmup:**');
        block.warmup_steps.forEach((step, index) => {
            const duration = Math.round(step.duration_seconds / 60 * 10) / 10; // Round to 1 decimal
            sections.push(`  ${index + 1}. ${step.movement} - ${duration}min @ ${step.intensity_percent}% intensity`);
            if (step.notes) {
                sections.push(`     *${step.notes}*`);
            }
        });
    }
    // Render sets
    if (block.sets && block.sets.length > 0) {
        if (block.sets.length === 1) {
            sections.push('**Set:**');
        }
        else {
            sections.push('**Sets:**');
        }
        block.sets.forEach((set, setIndex) => {
            if (block.sets.length > 1) {
                sections.push(`  **Set ${setIndex + 1}** (${set.rounds} rounds):`);
            }
            else {
                sections.push(`  **${set.rounds} rounds:**`);
            }
            set.movements.forEach((movement, movIndex) => {
                sections.push(`    ${movIndex + 1}. ${renderMovement(movement)}`);
            });
            if (set.rest_between_rounds_seconds) {
                const restMin = Math.round(set.rest_between_rounds_seconds / 60 * 10) / 10;
                sections.push(`    *Rest ${restMin}min between rounds*`);
            }
            if (set.time_cap_seconds) {
                const capMin = Math.round(set.time_cap_seconds / 60 * 10) / 10;
                sections.push(`    *Time cap: ${capMin}min*`);
            }
        });
    }
    // Render cooldown steps
    if (block.cooldown_steps && block.cooldown_steps.length > 0) {
        sections.push('**Cooldown:**');
        block.cooldown_steps.forEach((step, index) => {
            const duration = Math.round(step.duration_seconds / 60 * 10) / 10;
            sections.push(`  ${index + 1}. ${step.movement} - ${duration}min`);
            if (step.notes) {
                sections.push(`     *${step.notes}*`);
            }
        });
    }
    return sections.join('\n');
}
/**
 * Renders a single movement specification
 */
function renderMovement(movement) {
    const parts = [];
    // Format movement name (replace underscores with spaces and capitalize)
    const formattedName = movement.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    parts.push(formattedName);
    // Add specifications
    const specs = [];
    if (movement.reps) {
        specs.push(`${movement.reps} reps`);
    }
    if (movement.sets && movement.sets > 1) {
        specs.push(`${movement.sets} sets`);
    }
    if (movement.weight_kg) {
        specs.push(`${movement.weight_kg}kg`);
    }
    if (movement.weight_percent_1rm) {
        specs.push(`${movement.weight_percent_1rm}% 1RM`);
    }
    if (movement.duration_seconds) {
        const duration = movement.duration_seconds < 60
            ? `${movement.duration_seconds}sec`
            : `${Math.round(movement.duration_seconds / 60 * 10) / 10}min`;
        specs.push(duration);
    }
    if (movement.distance_meters) {
        const distance = movement.distance_meters >= 1000
            ? `${movement.distance_meters / 1000}km`
            : `${movement.distance_meters}m`;
        specs.push(distance);
    }
    if (movement.rest_seconds) {
        const rest = movement.rest_seconds < 60
            ? `${movement.rest_seconds}sec rest`
            : `${Math.round(movement.rest_seconds / 60 * 10) / 10}min rest`;
        specs.push(rest);
    }
    if (specs.length > 0) {
        parts.push(`(${specs.join(', ')})`);
    }
    if (movement.notes) {
        parts.push(`- *${movement.notes}*`);
    }
    return parts.join(' ');
}
