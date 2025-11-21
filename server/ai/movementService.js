import seedrandom from 'seedrandom';
import registryData from '../data/movements.registry.min.json' with { type: 'json' };
const MOVES = registryData;
function hasAny(arr, set) {
    if (!arr || !set)
        return true;
    return arr.some(x => set.includes(x));
}
export function queryMovements(q) {
    const equip = (q.equipment || []).map(s => s.toLowerCase());
    const rng = seedrandom(q.seed || String(Date.now()));
    let pool = MOVES.filter(m => {
        if (q.categories && !q.categories.includes(m.category))
            return false;
        if (q.patterns && !hasAny(m.patterns, q.patterns))
            return false;
        if (q.modality && !q.modality.includes(m.modality))
            return false;
        if (q.excludeBannedMains && m.banned_in_main_when_equipment && equip.length)
            return false;
        if (equip.length) {
            // If any equipment tag matches available OR movement is bodyweight/mobility
            if (!m.equipment.some(e => equip.includes(e) || e === 'bodyweight' || e === 'mobility'))
                return false;
        }
        return true;
    });
    // Weighted: prefer external load when equipment exists
    const weighted = pool.flatMap(m => {
        const hasLoad = m.equipment.some(e => ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'sandbag', 'sled'].includes(e));
        const w = hasLoad ? 3 : 1; // adjust later if needed
        return Array(w).fill(m);
    });
    // Deterministic shuffle by seed
    for (let i = weighted.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = weighted[i];
        weighted[i] = weighted[j];
        weighted[j] = t;
    }
    const uniqueById = new Map();
    for (const m of weighted) {
        if (!uniqueById.has(m.id))
            uniqueById.set(m.id, m);
        if (q.limit && uniqueById.size >= q.limit)
            break;
    }
    return Array.from(uniqueById.values());
}
// Lookup movement by name (case-insensitive, fuzzy match)
export function findMovement(exerciseName) {
    const normalized = exerciseName.toLowerCase().trim();
    // Direct match by name
    let match = MOVES.find(m => m.name.toLowerCase() === normalized);
    if (match)
        return match;
    // Check aliases
    match = MOVES.find(m => m.aliases?.some(alias => alias.toLowerCase() === normalized));
    if (match)
        return match;
    // Partial match (starts with)
    match = MOVES.find(m => m.name.toLowerCase().includes(normalized) ||
        normalized.includes(m.name.toLowerCase()));
    return match;
}
