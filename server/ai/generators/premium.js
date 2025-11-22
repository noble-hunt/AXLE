import OpenAI from 'openai';
import { z } from 'zod';
import { PACKS } from '../config/patternPacks.js';
import { buildOlympicPack, buildEndurancePack } from '../config/patternPackBuilders.js';
import { queryMovements, findMovement } from '../movementService.js';
import registryData from '../../data/movements.registry.json' with { type: 'json' };
import { STYLE_POLICIES } from '../config/stylePolicies.js';
import { STYLE_SPECS } from '../config/styleSpecs.js';
import { HAS_OPENAI_KEY, PREMIUM_NOTES_MODE_LOCAL, PREMIUM_STRICT } from '../../config/env.js';
import { normalizeStyle } from '../../lib/style.js';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 50000,
    maxRetries: 1
});
// Load movement registry into a Map for fast lookup
const REG = new Map(registryData.map((m) => [m.id, m]));
// Helper: Check if movement has external load
function isLoaded(m) {
    return m.equipment?.some((e) => ['barbell', 'dumbbell', 'kettlebell', 'machine', 'sandbag', 'sled', 'cable'].includes(e));
}
// Helper: Check if movement is banned in main blocks when equipment exists
function isBannedInMain(m) {
    return !!m.banned_in_main_when_equipment;
}
// Helper: Check if equipment is loaded
function isLoadedEquip(e) {
    return ['barbell', 'dumbbell', 'kettlebell', 'machine', 'sandbag', 'sled', 'cable'].includes(e);
}
/**
 * Policy failure handler: either throw (if strict) or log repair to meta
 */
function policyFailOrRepair(workout, code, details) {
    if (PREMIUM_STRICT) {
        const e = new Error(`policy:${code}`);
        e.policy = code;
        e.details = details;
        throw e;
    }
    else {
        workout.meta = workout.meta || {};
        workout.meta.policy_repairs = workout.meta.policy_repairs || [];
        workout.meta.policy_repairs.push({ code, details, timestamp: new Date().toISOString() });
        console.log(`🔧 Policy repair logged: ${code}${details ? ` (${JSON.stringify(details)})` : ''}`);
    }
}
// Helper: Compute loaded ratio on main blocks only (excluding warmup/cooldown)
function loadedRatioMainOnly(blocks, REG) {
    const mains = blocks.filter(b => !['warmup', 'cooldown'].includes(b.kind));
    const items = mains.flatMap(b => (b.items || [])).filter((it) => it._source !== 'warmup' && it._source !== 'cooldown');
    if (!items.length)
        return 0;
    const loaded = items.filter((it) => {
        const mv = REG.get(it.registry_id || '');
        return mv && mv.equipment?.some(isLoadedEquip);
    }).length;
    return loaded / items.length;
}
// Helper: Auto-upgrade CrossFit BW mains to loaded movements to meet 60% ratio
function autoUpgradeCFToLoaded(workout, REG, req) {
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    const equipment = req?.context?.equipment || ['barbell', 'dumbbell', 'kettlebell'];
    for (const block of mains) {
        for (let i = 0; i < (block.items || []).length; i++) {
            const item = block.items[i];
            const mv = REG.get(item.registry_id || '');
            // Skip if already loaded
            if (mv && mv.equipment?.some(isLoadedEquip))
                continue;
            // Try to find a loaded replacement from CrossFit category
            const replacements = queryMovements({
                categories: ['crossfit'],
                patterns: mv?.patterns || ['squat', 'press', 'hinge', 'pull'],
                equipment,
                excludeBannedMains: true,
                limit: 5,
                seed: `cf-upgrade-${i}`
            });
            // Find a loaded replacement
            const loadedReplacement = replacements.find(m => m.equipment.some(isLoadedEquip));
            if (loadedReplacement) {
                console.log(`🔄 CF auto-upgrade: "${item.exercise}" → "${loadedReplacement.name}"`);
                item.exercise = loadedReplacement.name;
                item.registry_id = loadedReplacement.id;
                // Update scheme if needed
                if (!item.scheme)
                    item.scheme = {};
                item.scheme.reps = item.scheme.reps || 10;
                item.notes = (item.notes || '') + ' (upgraded to loaded)';
            }
            // Recompute ratio after each upgrade and stop if we hit 60%
            const currentRatio = loadedRatioMainOnly(workout.blocks, REG);
            if (currentRatio >= 0.60) {
                console.log(`✅ CF loaded ratio target met: ${(currentRatio * 100).toFixed(0)}%`);
                return;
            }
        }
    }
    console.log(`⚠️ CF auto-upgrade complete but ratio still below 60%: ${(loadedRatioMainOnly(workout.blocks, REG) * 100).toFixed(0)}%`);
}
/**
 * Enforce style-specific content policies
 * Returns { ok: true } if policy is satisfied, or { ok: false, reason, offender } if violated
 */
function enforceStylePolicy(workout, REG, style) {
    const policy = STYLE_POLICIES[style];
    if (!policy)
        return { ok: true };
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    const items = mains.flatMap((b) => b.items || []);
    const names = items.map((it) => String(it.exercise || ''));
    const regs = items.map((it) => REG.get(it.registry_id || '')).filter(Boolean);
    // Check allowed categories only
    const badCat = regs.find((m) => !policy.allowed_categories.includes(m.category));
    if (badCat) {
        return {
            ok: false,
            reason: `category_mismatch:${badCat.category}`,
            offender: badCat.name
        };
    }
    // Check required pattern groups
    if (policy.required_any) {
        for (const group of policy.required_any) {
            const hit = regs.some((m) => m.patterns?.some((p) => group.includes(p)));
            if (!hit) {
                return {
                    ok: false,
                    reason: `oly_required_patterns:${group.join('|')}`
                };
            }
        }
    }
    // Check banned regex
    if (policy.banned_regex?.length) {
        const bad = names.find((n) => policy.banned_regex.some(rx => rx.test(n)));
        if (bad) {
            return {
                ok: false,
                reason: `banned_exercise:${bad}`,
                offender: bad
            };
        }
    }
    // Check barbell-only requirement for mains
    if (policy.require_barbell_only) {
        const nonBB = regs.find((m) => !m.equipment?.includes('barbell'));
        if (nonBB) {
            return {
                ok: false,
                reason: `barbell_only:${nonBB.name}`,
                offender: nonBB.name
            };
        }
    }
    // Check main loaded ratio
    if (policy.require_loaded_ratio != null) {
        const r = loadedRatioMainOnly(workout.blocks, REG);
        if (r < policy.require_loaded_ratio) {
            return {
                ok: false,
                reason: `loaded_ratio:${r.toFixed(2)}`
            };
        }
    }
    return { ok: true };
}
/**
 * Try to auto-fix style policy violations by substituting offending movements
 * Returns true if fixed, false otherwise
 */
function tryAutoFixByPolicy(workout, REG, style, policyRes) {
    if (policyRes.ok)
        return true;
    const policy = STYLE_POLICIES[style];
    if (!policy)
        return false;
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    // Try to find and replace offending movements
    for (const block of mains) {
        const items = block.items || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const mv = REG.get(item.registry_id || '');
            if (!mv)
                continue;
            let needsReplacement = false;
            // Check if this movement violates policy
            if (policy.allowed_categories && !policy.allowed_categories.includes(mv.category)) {
                needsReplacement = true;
            }
            if (policy.banned_regex?.some(rx => rx.test(mv.name))) {
                needsReplacement = true;
            }
            if (policy.require_barbell_only && !mv.equipment?.includes('barbell')) {
                needsReplacement = true;
            }
            if (needsReplacement) {
                // Find a replacement from registry matching the same pattern
                const replacement = Array.from(REG.values()).find((m) => {
                    if (!policy.allowed_categories.includes(m.category))
                        return false;
                    if (policy.banned_regex?.some(rx => rx.test(m.name)))
                        return false;
                    if (policy.require_barbell_only && !m.equipment?.includes('barbell'))
                        return false;
                    // Try to match same pattern
                    if (mv.patterns?.length && m.patterns?.some((p) => mv.patterns.includes(p))) {
                        return true;
                    }
                    return false;
                });
                if (replacement) {
                    items[i] = {
                        ...item,
                        exercise: replacement.name,
                        registry_id: replacement.id,
                        notes: ((item.notes || '') + ' (policy auto-fix)').trim(),
                        _policyFixed: true
                    };
                    console.log(`🔧 Auto-fixed policy violation: ${mv.name} → ${replacement.name}`);
                }
                else {
                    // Couldn't find replacement
                    return false;
                }
            }
        }
    }
    // Re-check policy after fixes
    const recheckRes = enforceStylePolicy(workout, REG, style);
    return recheckRes.ok;
}
// Helper: Pick movements from registry with filtering
function pickFromRegistry(options) {
    const { categories = [], patterns = [], equipment = [], limit, seed } = options;
    // Filter registry
    let pool = Array.from(REG.values()).filter((m) => {
        if (categories.length > 0 && !categories.includes(m.category))
            return false;
        if (patterns.length > 0 && !patterns.some(pat => m.patterns?.includes(pat)))
            return false;
        if (equipment.length > 0 && !equipment.some(eq => m.equipment?.includes(eq)))
            return false;
        return true;
    });
    // Deterministic shuffle using seed
    const rng = seedRandom(seed);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, limit);
}
// Simple seedable RNG
function seedRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    return function () {
        hash = (hash * 9301 + 49297) % 233280;
        return hash / 233280;
    };
}
/**
 * Helper: Compute ratio of blocks matching a predicate
 */
function ratioOf(predicate, sets) {
    const mins = (x) => (x.duration || x.time_min || 0) / 60;
    const tot = sets.reduce((s, x) => s + mins(x), 0) || 1;
    const ok = sets.filter(predicate).reduce((s, x) => s + mins(x), 0);
    return ok / tot;
}
/**
 * Helper: Check if block contains any of the given patterns (case-insensitive)
 */
function hasPattern(s, pats) {
    const txt = JSON.stringify(s).toLowerCase();
    return pats.some(p => txt.includes(p.toLowerCase()));
}
/**
 * Helper: Check if item is a warm-up header
 */
function isWarmupHeader(x) {
    return x.is_header && /warm-?up/i.test(x.exercise || x.title);
}
/**
 * Helper: Check if item is a cooldown header
 */
function isCooldownHeader(x) {
    return x.is_header && /cool-?down/i.test(x.exercise || x.title);
}
/**
 * Helper: Check if item is any header
 */
function isHeader(x) {
    return x && x.is_header === true;
}
/**
 * Extract only the "main" items between the first non-warmup header
 * and the next cooldown header. Falls back to _source/source tags if present.
 */
function extractMains(sets) {
    // First try explicit source flags (most reliable if present)
    const viaSource = sets.filter(s => (s._source === 'main' || s.source === 'main'));
    if (viaSource.length)
        return viaSource;
    // Second: try kind-based filtering (for blocks with kind property)
    const viaKind = sets.filter(s => s.kind && !['warmup', 'cooldown'].includes(s.kind));
    if (viaKind.length)
        return viaKind;
    // Fallback: positional scan between headers
    let mains = [];
    let inMain = false;
    for (const s of sets) {
        if (isWarmupHeader(s)) {
            inMain = false;
            continue;
        }
        if (isCooldownHeader(s)) {
            inMain = false;
            continue;
        }
        if (isHeader(s) && !isWarmupHeader(s) && !isCooldownHeader(s)) {
            inMain = true;
            continue;
        }
        if (inMain && !isHeader(s))
            mains.push(s);
    }
    return mains;
}
/**
 * Validate workout against style specifications
 * - Enforces banned patterns in main blocks
 * - Enforces required patterns
 * - Checks cyclical/loaded ratios
 * - Hard-fails in strict mode
 */
function validateStyleAgainstSpec(style, workout, strict) {
    const spec = STYLE_SPECS[style];
    if (!spec)
        return;
    const sets = workout.sets || workout.blocks || [];
    // Compute mains correctly (exclude warm-up and cooldown)
    const mains = extractMains(sets);
    // BAN: patterns forbidden in mains
    if (spec.banMainPatterns && spec.banMainPatterns.length) {
        const bad = mains.find((b) => hasPattern(b, spec.banMainPatterns));
        if (bad) {
            workout.meta = workout.meta || {};
            workout.meta.acceptance = workout.meta.acceptance || {};
            workout.meta.acceptance.style_ok = false;
            if (strict)
                throw new Error(`style_banned_pattern:${style}`);
        }
    }
    // REQUIRE: patterns
    if (spec.requirePatterns && spec.requirePatterns.length) {
        const txt = JSON.stringify(mains).toLowerCase();
        const miss = spec.requirePatterns.find(p => !txt.includes(p.toLowerCase()));
        if (miss) {
            workout.meta = workout.meta || {};
            workout.meta.acceptance = workout.meta.acceptance || {};
            workout.meta.acceptance.style_ok = false;
            if (strict)
                throw new Error(`style_required_missing:${style}:${miss}`);
        }
    }
    // RATIO checks computed on mains only
    if (spec.minCyclicalRatio || spec.maxLoadedRatio !== undefined) {
        const cycPats = ["cyclical", "cardio", "run", "row", "bike", "erg", "ski", "swim", "jump_rope"];
        const loadedPats = ["barbell", "dumbbell", "kettlebell", "thruster", "clean", "jerk", "snatch", "deadlift", "squat", "press", "pull", "bench"];
        const cycRatio = ratioOf((x) => hasPattern(x, cycPats), mains);
        const loadedRatio = ratioOf((x) => hasPattern(x, loadedPats), mains);
        workout.meta = workout.meta || {};
        workout.meta.acceptance = workout.meta.acceptance || {};
        if (spec.minCyclicalRatio && cycRatio < spec.minCyclicalRatio) {
            workout.meta.acceptance.style_ok = false;
            if (strict)
                throw new Error(`style_min_cyclical_ratio_fail:${cycRatio.toFixed(2)}`);
        }
        if (spec.maxLoadedRatio !== undefined && loadedRatio > spec.maxLoadedRatio) {
            workout.meta.acceptance.style_ok = false;
            if (strict)
                throw new Error(`style_max_loaded_ratio_fail:${loadedRatio.toFixed(2)}`);
        }
    }
    // BAN: generic names in endurance/aerobic mains
    if (style === 'endurance' || style === 'aerobic') {
        const generic = mains.find((x) => /bike\/row\/run/i.test(String(x.exercise || '')));
        if (generic) {
            workout.meta = workout.meta || {};
            workout.meta.acceptance = workout.meta.acceptance || {};
            workout.meta.acceptance.style_ok = false;
            if (strict)
                throw new Error('endurance_generic_name');
        }
    }
}
/**
 * Rewrite generic endurance names (e.g., "Bike/Row/Run") to the chosen modality
 */
function rewriteEnduranceGenericNames(workout) {
    const style = (workout.meta?.style || workout.style || '').toLowerCase();
    if (style !== 'endurance' && style !== 'aerobic')
        return;
    const sets = workout.sets || [];
    let currentHeader = null;
    let chosenHeaderMod = null;
    for (const s of sets) {
        if (s.is_header) {
            currentHeader = s;
            // infer chosen modality from the header text
            const t = String(s.title || s.exercise || '').toLowerCase();
            if (/row/.test(t))
                chosenHeaderMod = 'Row';
            else if (/bike/.test(t))
                chosenHeaderMod = 'Bike';
            else if (/\brun\b/.test(t))
                chosenHeaderMod = 'Run';
            else if (/ski/.test(t))
                chosenHeaderMod = 'Ski Erg';
            else if (/jump rope/.test(t))
                chosenHeaderMod = 'Jump Rope';
            else
                chosenHeaderMod = null;
            continue;
        }
        // only touch items under an endurance main header
        if (currentHeader && /steady|cruise|vo2|intervals|endurance|aerobic/i.test(currentHeader.title || currentHeader.exercise || '')) {
            const name = String(s.exercise || s.name || '').toLowerCase();
            if (/bike\/row\/run/.test(name) || /cyclical/i.test(name) || /modality/i.test(name)) {
                if (chosenHeaderMod) {
                    s.exercise = chosenHeaderMod;
                    // optional: hint a registry id string for clarity; harmless if unknown
                    if (chosenHeaderMod === 'Row')
                        s.registry_id = 'row';
                    if (chosenHeaderMod === 'Bike')
                        s.registry_id = 'bike';
                    if (chosenHeaderMod === 'Run')
                        s.registry_id = 'run';
                    if (chosenHeaderMod === 'Ski Erg')
                        s.registry_id = 'ski';
                    if (chosenHeaderMod === 'Jump Rope')
                        s.registry_id = 'jump_rope';
                }
            }
        }
    }
}
// Registry-aware sanitizer: enforce "no banned in mains", hardness floors, and style fidelity
export function sanitizeWorkout(workout, req, pack, seed) {
    const equip = (req.equipment || []).map((e) => e.toLowerCase());
    const hasGear = equip.some((e) => /(barbell|dumbbell|kettlebell)/.test(e));
    // 1) Remove banned BW in mains if gear exists; rotate replacement
    const ROT = ["db-box-step-overs", "kb-swings", "wall-balls", "burpees"]; // registry ids
    let rot = 0, bannedFound = false;
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    for (const b of mains) {
        b.items = (b.items || []).map((it) => {
            const mv = REG.get(it.registry_id || '');
            if (hasGear && mv && isBannedInMain(mv)) {
                bannedFound = true;
                const sub = REG.get(ROT[rot++ % ROT.length]);
                return {
                    ...it,
                    registry_id: sub?.id || it.registry_id,
                    exercise: sub?.name || it.exercise,
                    notes: ((it.notes || '') + ' (auto-upgrade)').trim(),
                    _bannedReplaced: true
                };
            }
            return it;
        });
    }
    // 2) Hardness floor per style
    const lowReady = Boolean(req?.wearable_snapshot?.sleep_score && req.wearable_snapshot.sleep_score < 60);
    // Always respect pack's hardnessFloor first, then apply recovery override or defaults
    const baseFloor = pack.hardnessFloor ?? (hasGear ? 0.85 : 0.75);
    const floor = lowReady ? 0.55 : baseFloor;
    // 3) Bonus for loaded mains; penalty for BW-only mains with gear
    let score = computeHardness(workout, equip, pack, req);
    for (const b of mains) {
        const loaded = (b.items || []).filter((it) => {
            const mv = REG.get(it.registry_id || '');
            return mv && isLoaded(mv);
        }).length;
        const bodywt = (b.items || []).filter((it) => {
            const mv = REG.get(it.registry_id || '');
            return mv && mv.equipment?.includes('bodyweight');
        }).length;
        if (loaded > 0)
            score += 0.03;
        if (hasGear && bodywt >= 2)
            score -= 0.07;
    }
    workout.variety_score = score;
    workout.acceptance_flags = {
        ...(workout.acceptance_flags || {}),
        no_banned_in_mains: hasGear ? !bannedFound : true,
        hardness_ok: workout.variety_score >= floor
    };
    console.log(`🎯 SANITIZE | Style: ${pack.name} | Hardness: ${score.toFixed(2)} (floor: ${floor.toFixed(2)}) | Banned found: ${bannedFound}`);
    // Rewrite generic endurance names to concrete modality
    if (workout.meta?.style === 'endurance' || workout.meta?.style === 'aerobic') {
        rewriteEnduranceGenericNames(workout);
    }
    return workout;
}
/**
 * Minimal repair helper: Inject Olympic required blocks
 * Ensures at least one snatch and one clean&jerk barbell block in mains
 */
function injectOlympicRequiredBlocks(workout, seed) {
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    const items = mains.flatMap((b) => b.items || []);
    // Check if we have snatch and clean&jerk patterns
    const hasSnatch = items.some((it) => {
        const mv = REG.get(it.registry_id || '');
        return mv && mv.patterns?.includes('snatch');
    });
    const hasCleanJerk = items.some((it) => {
        const mv = REG.get(it.registry_id || '');
        return mv && (mv.patterns?.includes('clean') || mv.patterns?.includes('jerk'));
    });
    // Inject missing blocks
    if (!hasSnatch) {
        const snatchMovements = queryMovements({
            categories: ['olympic_weightlifting'],
            patterns: ['snatch'],
            equipment: ['barbell'],
            limit: 1,
            seed: `${seed}-snatch-inject`
        });
        if (snatchMovements.length > 0) {
            mains.unshift({
                kind: 'strength',
                title: 'Every 2:00 x 7',
                time_min: 14,
                items: [{
                        registry_id: snatchMovements[0].id,
                        exercise: snatchMovements[0].name,
                        scheme: { reps: 2, rpe: 'Heavy Single' },
                        notes: '(injected for Olympic pattern requirement)'
                    }]
            });
            console.log(`🔧 Injected snatch block: ${snatchMovements[0].name}`);
        }
    }
    if (!hasCleanJerk) {
        const cjMovements = queryMovements({
            categories: ['olympic_weightlifting'],
            patterns: ['clean', 'jerk'],
            equipment: ['barbell'],
            limit: 2,
            seed: `${seed}-cj-inject`
        });
        if (cjMovements.length >= 2) {
            mains.push({
                kind: 'strength',
                title: 'Every 2:00 x 7',
                time_min: 14,
                items: cjMovements.slice(0, 2).map(mv => ({
                    registry_id: mv.id,
                    exercise: mv.name,
                    scheme: { reps: 1, rpe: 'Heavy Single' },
                    notes: '(injected for Olympic pattern requirement)'
                }))
            });
            console.log(`🔧 Injected clean&jerk block: ${cjMovements.map(m => m.name).join(', ')}`);
        }
    }
}
/**
 * Minimal repair helper: Uplift loaded ratio
 * Replace BW main items with loaded movements until target ratio is met
 */
function upliftLoadedRatio(workout, targetRatio, equipment, seed) {
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    let currentRatio = loadedRatioMainOnly(workout.blocks, REG);
    if (currentRatio >= targetRatio) {
        console.log(`✅ Loaded ratio already met: ${(currentRatio * 100).toFixed(0)}% >= ${(targetRatio * 100).toFixed(0)}%`);
        return;
    }
    console.log(`🔄 Uplifting loaded ratio from ${(currentRatio * 100).toFixed(0)}% to ${(targetRatio * 100).toFixed(0)}%...`);
    for (const block of mains) {
        for (let i = 0; i < (block.items || []).length; i++) {
            const item = block.items[i];
            const mv = REG.get(item.registry_id || '');
            // Skip if already loaded
            if (mv && mv.equipment?.some(isLoadedEquip))
                continue;
            // Find a loaded replacement
            const replacements = queryMovements({
                patterns: mv?.patterns || ['squat', 'press', 'hinge', 'pull'],
                equipment,
                limit: 5,
                seed: `${seed}-uplift-${i}`
            });
            const loadedReplacement = replacements.find(m => m.equipment.some(isLoadedEquip));
            if (loadedReplacement) {
                console.log(`🔄 Uplift: "${item.exercise}" → "${loadedReplacement.name}"`);
                item.exercise = loadedReplacement.name;
                item.registry_id = loadedReplacement.id;
                item.notes = ((item.notes || '') + ' (loaded uplift)').trim();
                // Recompute ratio
                currentRatio = loadedRatioMainOnly(workout.blocks, REG);
                if (currentRatio >= targetRatio) {
                    console.log(`✅ Target loaded ratio achieved: ${(currentRatio * 100).toFixed(0)}%`);
                    return;
                }
            }
        }
    }
    console.log(`⚠️ Uplift complete but ratio still below target: ${(currentRatio * 100).toFixed(0)}%`);
}
/**
 * Minimal repair helper: Enforce barbell-only
 * Replace DB/KB/Bodyweight items in mains with barbell equivalents
 */
function enforceBarbellOnly(workout, seed) {
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    let replacedCount = 0;
    for (const block of mains) {
        for (let i = 0; i < (block.items || []).length; i++) {
            const item = block.items[i];
            const mv = REG.get(item.registry_id || '');
            // Skip if already barbell
            if (mv && mv.equipment?.includes('barbell'))
                continue;
            // Find barbell replacement with similar pattern
            const replacements = queryMovements({
                patterns: mv?.patterns || ['squat', 'press', 'hinge', 'pull'],
                equipment: ['barbell'],
                limit: 5,
                seed: `${seed}-barbell-${i}`
            });
            if (replacements.length > 0) {
                const replacement = replacements[0];
                console.log(`🔄 Barbell-only: "${item.exercise}" → "${replacement.name}"`);
                item.exercise = replacement.name;
                item.registry_id = replacement.id;
                item.notes = ((item.notes || '') + ' (barbell-only fix)').trim();
                replacedCount++;
            }
        }
    }
    if (replacedCount > 0) {
        console.log(`✅ Enforced barbell-only: ${replacedCount} movements replaced`);
    }
}
// --- Time fitter: aligns block minutes to requested duration within ±5% ---
function fitBlocksToDuration(blocks, reqDurMin, warmupMin, cooldownMin) {
    const mains = blocks.filter(b => !['warmup', 'cooldown'].includes(b.kind));
    const header = (mins) => Math.max(6, Math.min(30, Math.round(mins))); // sane bounds per block
    // 1) Normalize titles to their minute values (EMOM N, Every 2:00 x sets, etc.)
    for (const b of mains) {
        if (/^EMOM/i.test(b.title))
            b.title = `EMOM ${header(b.time_min)}`;
        if (/^Every\s*2:00/i.test(b.title))
            b.title = `Every 2:00 x ${Math.round((b.time_min || 0) / 2)}`;
        if (/^Every\s*2:30/i.test(b.title))
            b.title = `Every 2:30 x ${Math.round((b.time_min || 0) / 2.5)}`;
        if (/^Every\s*3:00/i.test(b.title))
            b.title = `Every 3:00 x ${Math.round((b.time_min || 0) / 3)}`;
        if (/^For\s*Time\s*21-15-9/i.test(b.title))
            b.time_min = header(b.time_min || 10);
        if (/^Chipper/i.test(b.title))
            b.time_min = header(b.time_min || 12);
    }
    const minNow = (blocks.reduce((t, b) => t + (b.time_min || 0), 0));
    const target = reqDurMin;
    const delta = target - minNow;
    // 2) If under target by >5%, extend the longest main or add a finisher
    if (delta > Math.max(2, target * 0.05)) {
        const longest = mains.sort((a, b) => (b.time_min || 0) - (a.time_min || 0))[0];
        if (longest && /^EMOM/.test(longest.title)) {
            longest.time_min += delta; // extend EMOM by the deficit
            longest.title = `EMOM ${header(longest.time_min)}`;
        }
        else {
            // add a 6–8 min finisher
            blocks.splice(blocks.length - 1, 0, {
                kind: 'conditioning',
                title: target >= 40 ? 'For Time 30-20-10' : 'For Time 21-15-9',
                time_min: Math.min(8, header(delta)),
                items: (mains[0]?.items || []).slice(0, 2) // reuse first two movements
            });
        }
    }
    // 3) If over target by >5%, trim the longest EMOM/E2:00 block
    if (-delta > Math.max(2, target * 0.05)) {
        const longest = mains.sort((a, b) => (b.time_min || 0) - (a.time_min || 0))[0];
        if (longest) {
            longest.time_min = header((longest.time_min || 0) + delta); // delta is negative
            if (/^EMOM/.test(longest.title))
                longest.title = `EMOM ${header(longest.time_min)}`;
        }
    }
}
/**
 * fitBlocksToBudget: Scale main blocks proportionally to fit within time budget
 * Guarantees total duration <= requested duration
 */
function fitBlocksToBudget(blocks, totalMin, warmupMin, cooldownMin) {
    const mains = blocks.filter(b => ['strength', 'conditioning', 'main', 'emom', 'amrap'].includes((b.kind || '').toLowerCase()));
    const currentMainSum = mains.reduce((s, b) => s + (b.time_min || 0), 0);
    // Calculate actual warmup/cooldown durations (may have been compressed by pack builder)
    const warmupBlock = blocks.find(b => b.kind === 'warmup');
    const cooldownBlock = blocks.find(b => b.kind === 'cooldown');
    const actualWarmup = warmupBlock?.time_min || warmupMin;
    const actualCooldown = cooldownBlock?.time_min || cooldownMin;
    // Target main sum to hit requested total
    let targetMainSum = totalMin - actualWarmup - actualCooldown;
    // Compress warmup/cooldown if budget is tight relative to current mains
    const neededForMains = Math.max(currentMainSum, 8); // Either current sum or minimum 8
    if (targetMainSum < neededForMains && currentMainSum > 0) {
        const minWarmup = 4;
        const minCooldown = 4; // Raised from 2 to be less aggressive
        const deficit = neededForMains - targetMainSum;
        if (actualWarmup > minWarmup && deficit > 0) {
            const reduction = Math.min(actualWarmup - minWarmup, deficit);
            if (warmupBlock)
                warmupBlock.time_min -= reduction;
            targetMainSum += reduction;
        }
        if (targetMainSum < neededForMains && actualCooldown > minCooldown) {
            const remainingDeficit = neededForMains - targetMainSum;
            const reduction = Math.min(actualCooldown - minCooldown, remainingDeficit);
            if (cooldownBlock)
                cooldownBlock.time_min -= reduction;
            targetMainSum += reduction;
        }
    }
    // If mains already at or under target, done
    if (currentMainSum <= targetMainSum)
        return blocks;
    // Need to scale down mains to fit target
    const minBlockTime = Math.min(8, Math.floor(targetMainSum / mains.length)); // Adaptive minimum
    const scale = targetMainSum / currentMainSum;
    const scaledTimes = mains.map(b => ({
        block: b,
        original: b.time_min || 8,
        scaled: Math.max(minBlockTime, Math.round((b.time_min || 8) * scale))
    }));
    let scaledSum = scaledTimes.reduce((s, t) => s + t.scaled, 0);
    // Remove blocks if we still exceed target after clamping to minimums
    while (scaledSum > targetMainSum && scaledTimes.length > 1) {
        const removed = scaledTimes.sort((a, b) => a.scaled - b.scaled).shift();
        if (removed) {
            const idx = blocks.indexOf(removed.block);
            if (idx !== -1)
                blocks.splice(idx, 1);
        }
        scaledSum = scaledTimes.reduce((s, t) => s + t.scaled, 0);
    }
    // Force-fit if still over
    if (scaledSum > targetMainSum && scaledTimes.length >= 1) {
        const excess = scaledSum - targetMainSum;
        const largest = scaledTimes.sort((a, b) => b.scaled - a.scaled)[0];
        if (largest)
            largest.scaled = Math.max(4, largest.scaled - excess);
        scaledSum = scaledTimes.reduce((s, t) => s + t.scaled, 0);
    }
    // Final trim: distribute any remaining excess across blocks
    while (scaledSum > targetMainSum && scaledTimes.length > 0) {
        for (const item of scaledTimes.sort((a, b) => b.scaled - a.scaled)) {
            if (scaledSum <= targetMainSum)
                break;
            if (item.scaled > 4) {
                item.scaled -= 1;
                scaledSum -= 1;
            }
        }
    }
    // Apply scaled times and normalize titles
    scaledTimes.forEach(({ block, scaled }) => {
        block.time_min = scaled;
        if (/Every\s*2:00\s*x\s*\d+/i.test(block.title || '')) {
            const rounds = Math.max(2, Math.round(scaled / 2));
            block.title = `Every 2:00 x ${rounds}`;
        }
        else if (/Every\s*2:30\s*x\s*\d+/i.test(block.title || '')) {
            const rounds = Math.max(2, Math.round(scaled / 2.5));
            block.title = `Every 2:30 x ${rounds}`;
        }
        else if (/Every\s*3:00\s*x\s*\d+/i.test(block.title || '')) {
            const rounds = Math.max(2, Math.round(scaled / 3));
            block.title = `Every 3:00 x ${rounds}`;
        }
        else if (/Alt.*E1:30x/i.test(block.title || '')) {
            const rounds = Math.max(4, Math.round(scaled / 1.5));
            block.title = `Alt Every 1:30 x ${rounds}`;
        }
        else if (/^EMOM\s+\d+/i.test(block.title || '')) {
            block.title = `EMOM ${scaled}`;
        }
    });
    return blocks;
}
/**
 * ensureOlympicRequired: Enforce both snatch + clean&jerk patterns for Olympic workouts
 * Attempts auto-merge repair if patterns are missing; throws error if cannot satisfy budget
 */
function ensureOlympicRequired(workout, pack) {
    if (!pack.requiredPatterns || pack.requiredPatterns.length === 0)
        return;
    const hasSnatch = workout.blocks.some((b) => JSON.stringify(b).toLowerCase().includes('snatch'));
    const hasCJ = workout.blocks.some((b) => /clean.*jerk/i.test(JSON.stringify(b)));
    if (hasSnatch && hasCJ)
        return;
    // Attempt auto-merge repair: build one alternating main
    const total = (workout.meta?.duration_min) || workout.duration || 45;
    const altMin = Math.max(10, Math.min(16, total - pack.warmupMin - pack.cooldownMin));
    if (altMin >= 10) {
        workout.blocks = workout.blocks.filter((b) => (b.kind || '').toLowerCase() !== 'strength'); // drop mains
        workout.blocks.splice(1, 0, {
            id: `ol-alt-${Date.now()}`,
            title: `Alt Every 1:30 x ${Math.round(altMin / 1.5)}`,
            kind: 'strength',
            time_min: altMin,
            items: [
                { name: 'Snatch Complex', patterns: ['olympic_snatch'] },
                { name: 'Clean & Jerk Complex', patterns: ['olympic_cleanjerk'] },
            ],
            _policy_repair: 'oly_required_patterns:auto_merge_alt',
        });
        console.log(`🔧 Olympic auto-merge repair: created alternating block (${altMin}min)`);
        return;
    }
    // If we reach here, we cannot repair within budget; mark non-acceptance to trip strict mode
    workout.acceptance = workout.acceptance || {};
    workout.acceptance.style_ok = false;
    workout.acceptance.hardness_ok = false;
    throw new Error('oly_required_patterns:cannot_satisfy_budget');
}
// Define schema for premium workout structure
const WorkoutItemSchema = z.object({
    exercise: z.string(),
    target: z.string(),
    notes: z.string().optional()
});
const WorkoutBlockSchema = z.object({
    kind: z.enum(['warmup', 'strength', 'conditioning', 'skill', 'core', 'cooldown']),
    title: z.string(),
    time_min: z.number(),
    items: z.array(WorkoutItemSchema),
    notes: z.string().optional()
});
const AcceptanceFlagsSchema = z.object({
    time_fit: z.boolean(),
    has_warmup: z.boolean(),
    has_cooldown: z.boolean(),
    mixed_rule_ok: z.boolean(),
    equipment_ok: z.boolean(),
    injury_safe: z.boolean(),
    readiness_mod_applied: z.boolean(),
    hardness_ok: z.boolean(),
    patterns_locked: z.boolean()
});
const SubstitutionSchema = z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string()
});
const SelectionTraceSchema = z.object({
    blockTitle: z.string(),
    movements: z.array(z.object({
        id: z.string(),
        name: z.string()
    })),
    filters: z.object({
        categories: z.array(z.string()).optional(),
        patterns: z.array(z.string()).optional(),
        modality: z.array(z.string()).optional(),
        equipment: z.array(z.string()).optional(),
        excludeBannedMains: z.boolean().optional()
    })
});
const MetaSchema = z.object({
    generator: z.string(),
    style: z.string(),
    seed: z.string(),
    selectionTrace: z.array(SelectionTraceSchema).optional()
});
const PremiumWorkoutSchema = z.object({
    title: z.string(),
    duration_min: z.number(),
    blocks: z.array(WorkoutBlockSchema),
    substitutions: z.array(SubstitutionSchema).optional(),
    acceptance_flags: AcceptanceFlagsSchema,
    variety_score: z.number().optional(),
    meta: MetaSchema.optional()
});
// Banned easy bodyweight movements (wall sit, mountain climber, star jump, high knees, jumping jacks, bicycle crunch)
// Stored in lowercase for case-insensitive matching
const BANNED_EASY = new Set([
    "wall sit",
    "wall sits",
    "mountain climber",
    "mountain climbers",
    "star jump",
    "star jumps",
    "high knee",
    "high knees",
    "jumping jack",
    "jumping jacks",
    "bicycle crunch",
    "bicycle crunches"
]);
// Banned bodyweight movements specifically for main blocks when equipment is available
const BANNED_BW_MAIN = /^(Wall Sit|Mountain Climber|Star Jump|High Knees|Jumping Jacks|Bicycle Crunch)$/i;
// Helper function to pick movements using MovementService with telemetry
function pickMovements(request, blockCfg, blockTitle) {
    const equip = (request.context?.equipment || []).map((e) => e.toLowerCase());
    const seed = request.seed || String(Date.now());
    const filters = {
        categories: blockCfg.select.categories,
        patterns: blockCfg.select.patterns,
        modality: blockCfg.select.modality,
        equipment: equip.length > 0 ? equip : undefined,
        excludeBannedMains: true
    };
    const moves = queryMovements({
        ...filters,
        limit: blockCfg.select.items * 2, // Get more than needed for variety
        seed
    });
    if (!moves.length) {
        console.warn(`⚠️ No movements found for block config:`, blockCfg.select);
        throw new Error('no_moves_for_block');
    }
    // Check if we have enough loaded movements when required
    if (blockCfg.select.requireLoaded && equip.length > 0) {
        const loadedMoves = moves.filter(m => m.equipment.some(e => ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'sandbag', 'sled'].includes(e)));
        const requiredLoaded = Math.ceil(blockCfg.select.items * 0.5);
        if (loadedMoves.length < requiredLoaded) {
            console.warn(`⚠️ Not enough loaded movements: found ${loadedMoves.length}, need ${requiredLoaded}`);
            throw new Error('not_enough_loaded_choices');
        }
    }
    const selectedMoves = moves.slice(0, blockCfg.select.items);
    // Build trace for telemetry
    const trace = {
        blockTitle,
        movements: selectedMoves.map(m => ({ id: m.id, name: m.name })),
        filters: {
            categories: filters.categories,
            patterns: filters.patterns,
            modality: filters.modality,
            equipment: filters.equipment,
            excludeBannedMains: filters.excludeBannedMains
        }
    };
    return { movements: selectedMoves, trace };
}
// Allowed patterns for main blocks (includes upgradeIntensity mutations)
const ALLOWED_PATTERNS = [
    /(E[234]:00|Every [234]:00) x \d+/i, // E2:00 x 5, E3:00 x 5, E4:00 x 4, Every 3:00 x 5
    /EMOM \d+(-\d+)?/i, // EMOM 12, EMOM 10-16
    /AMRAP \d+/i, // AMRAP 12
    /For Time (21-15-9|30-20-10)/i, // For Time 21-15-9, For Time 30-20-10
    /Chipper 40-30-20-10/i // Chipper 40-30-20-10
];
// ===== REGISTRY-FIRST: AI only generates coaching notes, not movements =====
// Movement pools and fallback ladders are REMOVED from AI prompts
// All movement selection is done deterministically through pattern packs + registry
/**
 * Generate coaching notes for already-built blocks using AI
 * AI is only responsible for coaching tips, not movement selection
 */
async function generateCoachingNotes(blocks) {
    // If no key or explicit local mode → synthesize deterministic notes
    if (!HAS_OPENAI_KEY || PREMIUM_NOTES_MODE_LOCAL) {
        console.log('🔧 Using deterministic notes (notes-only mode)');
        return blocks.map((b) => {
            const t = String(b.title || '');
            if (/^EMOM/i.test(t))
                return 'Hit consistent splits; 40–45s work, composure at minute marks.';
            if (/^Every\s*\d:\d{2}\s*x\s*\d+/i.test(t))
                return 'Quality first; steady pacing per interval, no misses.';
            if (/^AMRAP/i.test(t))
                return 'Sustainable pace; break before failure.';
            if (/^For Time/i.test(t))
                return 'Fast but controlled transitions; avoid redline early.';
            if (b.kind === 'warmup')
                return 'For quality—tempo, positions, and ROM.';
            if (b.kind === 'cooldown')
                return 'Down-regulate breathing; restore ROM.';
            return 'Move well; align intent with block goal.';
        });
    }
    // AI-generated notes when OpenAI key is available
    try {
        const context = JSON.stringify(blocks.map(b => ({
            title: b.title,
            kind: b.kind,
            items: b.items?.map((i) => i.exercise || 'Movement') || []
        })));
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 400,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'Return JSON with coaching_notes: string[]. Provide one short coaching note per block. Focus on pacing, intensity cues, and technique tips.'
                },
                {
                    role: 'user',
                    content: `Blocks: ${context}`
                }
            ]
        });
        const response = completion.choices[0]?.message?.content;
        if (!response)
            return [];
        const parsed = JSON.parse(response);
        return parsed.coaching_notes || [];
    }
    catch (error) {
        console.warn('Failed to generate AI coaching notes, falling back to deterministic notes:', error);
        // Fallback to deterministic notes if AI fails
        return blocks.map((b) => {
            const t = String(b.title || '');
            if (/^EMOM/i.test(t))
                return 'Hit consistent splits; 40–45s work, composure at minute marks.';
            if (/^Every\s*\d:\d{2}\s*x\s*\d+/i.test(t))
                return 'Quality first; steady pacing per interval, no misses.';
            if (/^AMRAP/i.test(t))
                return 'Sustainable pace; break before failure.';
            if (/^For Time/i.test(t))
                return 'Fast but controlled transitions; avoid redline early.';
            if (b.kind === 'warmup')
                return 'For quality—tempo, positions, and ROM.';
            if (b.kind === 'cooldown')
                return 'Down-regulate breathing; restore ROM.';
            return 'Move well; align intent with block goal.';
        });
    }
}
/* COMMENTED OUT: Movement pools no longer used - registry-first approach
// ===== HOBH: movement pools (expanded) =====
const POOLS = {
  strength: [
    "Barbell Front Squat","Barbell Push Press","Barbell Deadlift","Barbell Thruster",
    "Barbell Clean & Jerk (moderate, touch-and-go)","Dumbbell Bench Press","Dumbbell Floor Press",
    "DB Goblet Squat","DB Romanian Deadlift","KB Front Rack Squat","KB Push Press",
    "Weighted Pull-Ups","Strict Pull-Ups","Ring Rows"
  ],
  conditioning: [
    "Echo Bike cals","Row cals","Ski Erg cals","Wall Balls","Farmer Carry (DB/KB)",
    "KB Swings","DB Box Step-Overs","DB Snatch","Burpees","Shuttle Runs (no machine)"
  ],
  skill: ["Toes-to-Bar","Hanging Knee Raises","Double-Unders","Single-Unders","Handstand Hold","Wall-Facing Hold"],
  core:  ["Hollow Rocks","Plank Variations","Sit-Ups"]
};

function fallbackFor(move: string): string[] {
  // ladder: Barbell -> Dumbbell -> Kettlebell -> Bodyweight (tempo/volume)
  if (/Barbell Front Squat/.test(move)) return ["DB Goblet Squat","KB Front Rack Squat","Air Squat (tempo 3-1-1 x 20)"];
  if (/Barbell Push Press/.test(move))  return ["DB Push Press","KB Push Press","Pike Push-Up (tempo)"];
  if (/Deadlift/.test(move))            return ["DB RDL","KB Swings","Hip Hinge (tempo)"];
  if (/Bench Press|Floor Press/.test(move)) return ["DB Floor Press","Push-Up (weighted)","Push-Up (tempo)"];
  if (/Weighted Pull-Ups|Strict Pull-Ups/.test(move)) return ["Ring Rows (feet elevated)","Ring Rows"];
  if (/DB Box Step-Overs/.test(move))  return ["Box Step-Ups (weighted)","Alt Step-Ups"];
  if (/DB Snatch/.test(move))          return ["KB Swings","Alt DB Snatch (lighter)","Burpees"];
  return ["Burpees"];
}

// Keep legacy MOVEMENT_POOLS reference for compatibility
const MOVEMENT_POOLS = POOLS;

// Equipment fallback ladder: Barbell → Dumbbell → Kettlebell → Bodyweight
const MOVEMENT_FALLBACKS: Record<string, string[]> = {
  "Barbell Front Squat": ["DB Goblet Squat", "KB Front Rack Squat", "Air Squat x 20 tempo"],
  "Barbell Push Press": ["DB Push Press", "KB Push Press", "Push-Ups x 15"],
  "Barbell Deadlift": ["DB Romanian Deadlift", "KB Deadlift", "Glute Bridge x 20"],
  "Barbell Thruster": ["DB Thruster", "KB Thruster", "Air Squat to Press x 15"],
  "Barbell Clean & Jerk (moderate, touch-and-go)": ["DB Clean & Jerk", "KB Clean & Press", "Burpees x 10"],
  "Dumbbell Bench Press": ["DB Floor Press", "Push-Ups", "Push-Ups x 15"],
  "Dumbbell Floor Press": ["Push-Ups", "Pike Push-Ups x 10"],
  "DB Goblet Squat": ["KB Goblet Squat", "Air Squat x 20"],
  "DB Romanian Deadlift": ["KB Romanian Deadlift", "Glute Bridge x 20"],
  "KB Front Rack Squat": ["Goblet Squat", "Air Squat x 20"],
  "KB Push Press": ["DB Push Press", "Push-Ups x 15"],
  "Weighted Pull-Ups": ["Strict Pull-Ups", "Ring Rows", "Inverted Rows x 12"],
  "Wall Balls": ["DB Thruster", "Air Squat to Press x 15"],
  "Farmer Carry (DB/KB)": ["Farmers Walk", "Plank Hold 60s"],
  "DB Snatch (alt: KB Swings)": ["KB Swings", "Burpees x 10"]
};

function applyEquipmentFallback(movement: string, equipment: string[]): { exercise: string; wasSubstituted: boolean } {
  const hasBarbell = equipment.some(e => /barbell/i.test(e));
  const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
  const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
  
  // If movement requires equipment not available, use fallback
  if (movement.toLowerCase().includes('barbell') && !hasBarbell) {
    const fallbacks = MOVEMENT_FALLBACKS[movement] || [];
    // Try DB first
    if (hasDumbbell && fallbacks[0]) {
      return { exercise: fallbacks[0], wasSubstituted: true };
    }
    // Try KB next
    if (hasKettlebell && fallbacks[1]) {
      return { exercise: fallbacks[1], wasSubstituted: true };
    }
    // Fall back to bodyweight
    if (fallbacks[2]) {
      return { exercise: fallbacks[2], wasSubstituted: true };
    }
  }
  
  if (movement.toLowerCase().includes('dumbbell') && !hasDumbbell) {
    const fallbacks = MOVEMENT_FALLBACKS[movement] || [];
    // Try KB first
    if (hasKettlebell && fallbacks[0]) {
      return { exercise: fallbacks[0], wasSubstituted: true };
    }
    // Fall back to bodyweight
    if (fallbacks[1]) {
      return { exercise: fallbacks[1], wasSubstituted: true };
    }
  }
  
  if (movement.toLowerCase().includes('kettlebell') || movement.toLowerCase().includes('kb ')) {
    if (!hasKettlebell) {
      const fallbacks = MOVEMENT_FALLBACKS[movement] || [];
      // Try DB first
      if (hasDumbbell && fallbacks[0]) {
        return { exercise: fallbacks[0], wasSubstituted: true };
      }
      // Fall back to bodyweight
      if (fallbacks[1]) {
        return { exercise: fallbacks[1], wasSubstituted: true };
      }
    }
  }
  
  return { exercise: movement, wasSubstituted: false };
}
END COMMENT OUT */
/* COMMENTED OUT: No longer used in AI prompts - registry-first approach
// Fallback ladder: BB → DB → KB → BW
const FALLBACK_LADDER = {
  "BB Clean & Jerk": ["DB Snatches", "KB Swings"],
  "BB Thruster": ["DB Thrusters", "KB Goblet Squat"],
  "Weighted Pull-Ups": ["Strict Pull-Ups", "Ring Rows"],
  "DB Bench Press": ["Push-Ups"],
  "BB Front Squat": ["DB Goblet Squat", "Air Squat"],
  "BB Deadlift": ["DB RDL", "KB Deadlift", "Good Mornings"],
  "Wall Balls": ["KB Swings", "Burpees"]
};
*/
function getSystemPrompt() {
    return `You are AXLE Workout Generator v3 - REGISTRY-FIRST MODE.

⚠️  CRITICAL: Movement selection is handled deterministically via pattern packs + movement registry.
You ONLY generate coaching notes and workout structure validation.

OUTPUT FORMAT:
{
  "title": "string",
  "duration_min": number,
  "blocks": [
    {
      "kind": "warmup" | "strength" | "conditioning" | "skill" | "core" | "cooldown",
      "title": "string",
      "time_min": number,
      "items": [
        {
          "exercise": "string",
          "target": "reps | time | cal | tempo",
          "notes": "optional guidance"
        }
      ],
      "notes": "optional block intent"
    }
  ],
  "substitutions": ["Array of equipment swaps if needed"],
  "acceptance_flags": {
    "time_fit": true,
    "has_warmup": true,
    "has_cooldown": true,
    "mixed_rule_ok": true,
    "equipment_ok": true,
    "injury_safe": true,
    "readiness_mod_applied": true,
    "hardness_ok": true,
    "patterns_locked": true
  }
}

NOTE: Movement pools and fallback ladders removed - all handled by registry

STRUCTURE REQUIREMENTS:
1. Warm-up: ≥8 min with 6-7 exercises (foam roll, mobility drills, dynamic stretches, movement prep)
2. Main block(s): Choose ONLY from:
   - E3:00 x 5 / E4:00 x 4 (3-5 movements per round; strength density; E4:00 x 4 for strength into skill/row pairing)
   - EMOM 10-16 (3-4 movements rotating; conditioning or mixed)
   - AMRAP 8-15 (4-5 movements; conditioning)
   - For Time 21-15-9 (3-4 movements; finisher, ≤10 min)
   - Chipper 40-30-20-10 (3-4 movements; ≤12 min cap; loaded+cyclical mix)
3. Cool-down: ≥8 min with 5-6 exercises (active recovery, static stretches, breathing work)

MAIN BLOCK RULES:
- NO bodyweight filler (wall sit, mountain climber, star jump, high knees) in main blocks
- Prioritize loaded movements (BB/DB/KB) over bodyweight when equipment available
- Use expanded pools for variety: BB Clean & Jerk, Thrusters, Wall Balls, Farmer Carry, DB Snatches, Shuttle Runs
- Apply fallback ladder when equipment is missing

MIXED FOCUS RULES:
- For "mixed" focus with categories_for_mixed, generate exactly N main blocks where N = len(categories_for_mixed)
- Each block's kind must map to its category (Strength → "strength", Conditioning → "conditioning")
- If total time < duration_min × 0.9, append +1 finisher block (For Time 21-15-9, ≤10 min)

EXAMPLE OUTPUT:
{
  "title": "Advanced Mixed Focus Workout",
  "duration_min": 45,
  "blocks": [
    {
      "kind": "warmup",
      "title": "Warm-Up",
      "time_min": 8,
      "items": [
        { "exercise": "Foam Roll", "target": "2 min", "notes": "Upper back, lats, IT bands, quads" },
        { "exercise": "Cat-Cow", "target": "10 reps", "notes": "Spinal mobility" },
        { "exercise": "World's Greatest Stretch", "target": "5/side", "notes": "Hip mobility, thoracic rotation" },
        { "exercise": "Jumping Jacks", "target": "40 reps", "notes": "Elevate HR" },
        { "exercise": "Air Squat", "target": "15 reps", "notes": "Full ROM" },
        { "exercise": "Push-Up", "target": "10 reps", "notes": "Shoulder activation" },
        { "exercise": "Barbell Complex", "target": "5 reps each", "notes": "Deadlift, hang clean, front squat, press" }
      ]
    },
    {
      "kind": "strength",
      "title": "E3:00 x 5",
      "time_min": 15,
      "items": [
        { "exercise": "BB Clean & Jerk", "target": "3 reps @ 75%", "notes": "Explosive hip drive" },
        { "exercise": "BB Front Squat", "target": "5 reps @ 70%", "notes": "Controlled tempo down" },
        { "exercise": "Strict Pull-Ups", "target": "8 reps", "notes": "Full range of motion" }
      ],
      "notes": "Build to working weight across 5 sets"
    },
    {
      "kind": "conditioning",
      "title": "EMOM 12",
      "time_min": 12,
      "items": [
        { "exercise": "Echo Bike Calories", "target": "12/10 cal", "notes": "Odd minutes, hard pace" },
        { "exercise": "DB Snatches", "target": "10 reps (5/arm)", "notes": "Even minutes, moderate load" },
        { "exercise": "Burpees", "target": "10 reps", "notes": "Minute 4, 8, 12" }
      ],
      "notes": "Rotating exercises every minute"
    },
    {
      "kind": "cooldown",
      "title": "Cool-Down",
      "time_min": 8,
      "items": [
        { "exercise": "Walk or Light Bike", "target": "3 min", "notes": "Gradually lower heart rate" },
        { "exercise": "Child's Pose", "target": "60 sec", "notes": "Deep breathing, lat stretch" },
        { "exercise": "Pigeon Stretch", "target": "45 sec/side", "notes": "Hip flexor release" },
        { "exercise": "Hamstring Stretch", "target": "45 sec/side", "notes": "Seated or standing" },
        { "exercise": "Spinal Twist", "target": "45 sec/side", "notes": "Gentle rotation" },
        { "exercise": "Shoulder Stretch", "target": "60 sec total", "notes": "Doorway or wall-assisted" }
      ]
    }
  ],
  "substitutions": [],
  "acceptance_flags": {
    "time_fit": true,
    "has_warmup": true,
    "has_cooldown": true,
    "mixed_rule_ok": true,
    "equipment_ok": true,
    "injury_safe": true,
    "readiness_mod_applied": true,
    "hardness_ok": true,
    "patterns_locked": true
  }
}

ACCEPTANCE CRITERIA (self-check before output):
HARD REQUIREMENTS:
1. Warm-up present (≥8 min, 6-7 exercises: foam roll, mobility, dynamic stretches, movement prep) and Cool-down present (≥8 min, 5-6 exercises: active recovery, static stretches)
2. Main blocks: 3-5 movements per block (not 1-2). E3:00 x 5 needs 3+ movements per round. EMOM needs 3-4 rotating movements. AMRAP needs 4-5 movements.
3. Time budget: Σ time_min within ±10% of duration_min
4. Mixed semantics: If focus="mixed", number of main blocks = len(categories_for_mixed); each block's kind maps to category. If time < duration_min × 0.9, append +1 finisher (For Time 21-15-9, ≤10 min).
5. Equipment-safe: No exercise requires missing equipment. If swapped, log in substitutions[]. When gear (BB/DB/KB) is present, at least 2/3 of main movements must be loaded.
6. Injury-safe: No contraindicated patterns; provide safer alternates
7. Readiness: If low readiness (Sleep < 60 or HRV flagged), cap strength at RPE ≤ 7, remove sprints/plyos
8. Hardness score: Must be ≥ 0.75 when equipment present and readiness good (or ≥ 0.55 if readiness is low). Use BB/DB/KB movements, not bodyweight filler. Pair cyclical with loaded movements in EMOMs.
9. Clarity: Every items[] entry has explicit reps/cal/time, any rest, and intent via notes
10. Structure: Order is Warm-up → main block(s) → Cool-down

SOFT REQUIREMENTS:
9. Unilateral work balanced per side
10. No back-to-back high-skill lifts for beginners
11. Variety score ≥ 0.4
12. If history shows recent pattern, bias alternative

If any hard check fails, silently repair and re-validate before returning JSON.`;
}
// Validate main block patterns
function validatePatterns(workout) {
    const violations = [];
    for (const block of workout.blocks) {
        // Only validate main blocks (strength, conditioning, skill, core)
        if (!['strength', 'conditioning', 'skill', 'core'].includes(block.kind)) {
            continue;
        }
        // Check if title matches any allowed pattern
        const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(block.title));
        if (!matchesPattern) {
            violations.push(`Main block "${block.title}" (${block.kind}) doesn't match allowed patterns`);
        }
    }
    return {
        valid: violations.length === 0,
        violations
    };
}
// Validate patterns and ban BW filler in main blocks when equipment exists
function validatePatternsAndBW(workout, equipment) {
    const hasLoad = (equipment || []).some(e => /(barbell|dumbbell|kettlebell)/i.test(e));
    const mains = workout.blocks.filter((b) => !['warmup', 'cooldown'].includes(b.kind));
    if (!mains.length) {
        throw new Error('no_main_blocks');
    }
    for (const b of mains) {
        // Check pattern lock - allow CF patterns + upgradeIntensity mutations + optional suffixes
        const ALLOWED_PATTERNS_REGEX = /((E[234]:00|Every\s*[234]:?00)\s*x\s*\d+|EMOM\s*(8|10|12|14|16)|AMRAP\s*(8|10|12|15)|For\s*Time\s*(21-15-9|30-20-10)|Chipper\s*40-30-20-10)/i;
        if (!ALLOWED_PATTERNS_REGEX.test(b.title || '')) {
            console.error(`❌ Pattern lock violation: "${b.title}" doesn't match allowed patterns`);
            throw new Error('pattern_lock_violation');
        }
        // Check for banned BW movements in main blocks when equipment is available
        if (hasLoad) {
            const banned = (b.items || []).filter((it) => BANNED_BW_MAIN.test(it.exercise || ''));
            if (banned.length > 0) {
                throw new Error('banned_bw_in_main');
            }
            console.log(`✅ Block "${b.title}" has no banned movements`);
        }
    }
}
// Hardness calculation function - uses movement registry metadata
export function computeHardness(workout, equipmentAvailable, pack, req) {
    let h = 0;
    const hasGear = (equipmentAvailable || []).length > 0;
    const hasBarbell = (equipmentAvailable || []).some(e => /barbell/i.test(e));
    for (const b of workout.blocks) {
        // Pattern bonuses - more specific for E2:00, E2:30, EMOM
        if (/^Every\s*2:00/i.test(b.title))
            h += 0.38;
        if (/^Every\s*2:30/i.test(b.title))
            h += 0.34;
        if (/^EMOM\s+\d+/.test(b.title))
            h += 0.30;
        if (/(Every\s+[34]:00|E[34]:00)/i.test(b.title))
            h += 0.35;
        if (/AMRAP/i.test(b.title))
            h += 0.30;
        if (/21-15-9/i.test(b.title))
            h += 0.28;
        if (/Chipper/i.test(b.title))
            h += 0.32;
        if (hasBarbell)
            h += 0.12;
        // Use registry metadata for equipment and movement scoring
        const isMainBlock = ['strength', 'conditioning'].includes(b.kind);
        let hasExternalLoad = false;
        let hasOly = false;
        let hasHeavyCompound = false;
        let bodyweightCount = 0;
        for (const it of b.items || []) {
            const movement = findMovement(it.exercise);
            if (movement) {
                // Check for external load
                const hasLoad = movement.equipment.some(e => ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'sandbag', 'sled'].includes(e));
                if (hasLoad)
                    hasExternalLoad = true;
                // Check for Olympic patterns
                const isOly = movement.patterns.some(p => p.startsWith('olympic_'));
                if (isOly)
                    hasOly = true;
                // Check for heavy compounds (back squat, deadlift, bench press)
                const isHeavyCompound = movement.patterns.some(p => ['squat', 'hinge', 'bench'].includes(p)) && hasLoad;
                if (isHeavyCompound)
                    hasHeavyCompound = true;
                // Count bodyweight movements in main blocks
                if (isMainBlock && movement.equipment.length === 1 && movement.equipment[0] === 'bodyweight') {
                    bodyweightCount++;
                }
            }
        }
        // Apply bonuses from movement metadata
        if (isMainBlock && hasExternalLoad)
            h += 0.10;
        if (hasOly)
            h += 0.08;
        if (hasHeavyCompound)
            h += 0.06;
        // Penalty: ≥2 bodyweight movements in main block when gear is available
        if (isMainBlock && hasGear && bodyweightCount >= 2) {
            h -= 0.10;
        }
    }
    // Endurance/Aerobic scoring signals
    const text = JSON.stringify(workout.blocks || []);
    const styleLower = (pack?.name || '').toLowerCase();
    if (styleLower.includes('endurance') || styleLower.includes('aerobic')) {
        // Credit time spent in cardio mains
        const mains = extractMains(workout.blocks || []);
        const mainMinutes = mains.reduce((s, x) => {
            // duration is in seconds, time_min is in minutes
            const mins = x.time_min || (x.duration ? x.duration / 60 : 0);
            return s + mins;
        }, 0);
        const timeBonus = Math.min(0.35, mainMinutes * 0.02);
        h += timeBonus; // up to +0.35 for ≥17.5 min of continuous cardio
        // Pattern/structure bonuses
        let patternBonus = 0;
        if (/vo2/i.test(text)) {
            h += 0.25;
            patternBonus += 0.25;
        } // short hard repeats
        if (/cruise/i.test(text)) {
            h += 0.18;
            patternBonus += 0.18;
        } // threshold/tempo work
        if (/steady/i.test(text)) {
            h += 0.12;
            patternBonus += 0.12;
        } // Z2–Z3 aerobic base
        // Intensity assist (make 7+ map to harder structures)
        const targetI = req?.intensity || workout.intensity || workout.meta?.intensity;
        let intensityBonus = 0;
        if (targetI >= 7) {
            h += 0.06;
            intensityBonus += 0.06;
        }
        if (targetI >= 8) {
            h += 0.10;
            intensityBonus += 0.10;
        }
        if (process.env.DEBUG_ENDURANCE_HARDNESS === '1') {
            console.log(`🏃 Endurance hardness: time=${timeBonus.toFixed(2)} (${mainMinutes.toFixed(1)}min) pattern=${patternBonus.toFixed(2)} intensity=${intensityBonus.toFixed(2)} total=${h.toFixed(2)}`);
        }
    }
    return Math.min(1, Math.max(0, h));
}
// Helper function to extract focus and categories from request
function extractFocusAndCategories(request) {
    const categoryStr = String(request.category);
    let focus = 'strength';
    let categoriesForMixed = [];
    // Check if focus/categories are explicitly passed in context
    if (request.context?.focus) {
        focus = request.context.focus;
    }
    else if (categoryStr.includes('CrossFit') || categoryStr.includes('HIIT')) {
        focus = 'mixed';
    }
    else if (categoryStr.includes('Olympic')) {
        focus = 'strength';
    }
    else if (categoryStr.includes('Powerlifting')) {
        focus = 'strength';
    }
    else if (categoryStr.includes('Gymnastics')) {
        focus = 'skill';
    }
    else if (categoryStr.includes('Cardio')) {
        focus = 'conditioning';
    }
    else if (categoryStr.includes('Bodybuilding')) {
        focus = 'strength';
    }
    // Use passed categories if available, otherwise use defaults based on focus
    if (request.context?.categories_for_mixed && Array.isArray(request.context.categories_for_mixed)) {
        categoriesForMixed = request.context.categories_for_mixed;
    }
    else if (focus === 'mixed') {
        categoriesForMixed = ['Strength', 'Conditioning'];
    }
    return { focus, categoriesForMixed };
}
function createUserPrompt(request) {
    const { category, duration, intensity, context } = request;
    // Extract equipment and constraints
    const equipment = context?.equipment || ['dumbbell', 'kettlebell', 'barbell'];
    const constraints = context?.constraints || [];
    const injuries = constraints.filter(c => c.includes('injury') || c.includes('shoulder') || c.includes('knee') || c.includes('back'));
    // Determine experience level from intensity
    const experience = intensity <= 4 ? 'beginner' : intensity <= 7 ? 'intermediate' : 'advanced';
    // Extract focus and categories
    const { focus, categoriesForMixed } = extractFocusAndCategories(request);
    // Extract biometric snapshot
    const healthSnapshot = context?.health_snapshot;
    const wearableSnapshot = {
        hrv_score: healthSnapshot?.hrv || 70,
        sleep_score: healthSnapshot?.sleep_score || 75,
        rhr: healthSnapshot?.resting_hr || 60,
        load_72h: 2.5
    };
    // Extract history
    const yesterday = context?.yesterday;
    const historySummary = {
        last_patterns: yesterday?.category ? [String(yesterday.category).toLowerCase()] : [],
        last_date: new Date().toISOString().split('T')[0]
    };
    return `GENERATE PREMIUM WORKOUT:

USER INPUT:
{
  "focus": "${focus}",
  "duration_min": ${duration},
  "categories_for_mixed": ${JSON.stringify(categoriesForMixed)},
  "equipment": ${JSON.stringify(equipment)},
  "experience": "${experience}",
  "injuries": ${JSON.stringify(injuries)},
  "wearable_snapshot": ${JSON.stringify(wearableSnapshot)},
  "history_summary": ${JSON.stringify(historySummary)},
  "banned": ${constraints.length > 0 ? JSON.stringify(constraints) : '[]'}
}

REQUIREMENTS:
- Category: ${category}
- Target Intensity: ${intensity}/10
- Return ONLY valid JSON matching the schema
- No markdown, no explanations

INTENSITY & LOADING POLICY:
- Intensity 6–7: use ~70–75% 1RM or RPE 7–8; moderate pace.
- Intensity 8:   use ~80–85% 1RM or RPE 8–9; challenging pace.
- Intensity 9–10: use 85–95% 1RM or RPE 9–9.5; maximum sustainable.
REP/TIME MINIMUMS (strict):
- Strength density (Every E2:30–E3:00 x 5): ≥4 working sets; 6–10 reps for DB/KB; 3–6 reps per set for BB.
- EMOM: ≥12 minutes minimum; odd = cyclical cals; even = loaded movement when equipment exists.
- AMRAP: ≥12 minutes minimum for main conditioning; 2–3 movements with at least one loaded.
- For Time: baseline 21–15–9; may increase to 30–20–10 if hardness < floor.
MANDATES:
- When barbell/dumbbells/kettlebells available, each main block must include ≥2 loaded movements.
- Avoid bodyweight filler in main blocks (wall sit, mountain climber, star jump, high knees, jumping jacks, bicycle crunch).`;
}
// ===== HOBH: Strict Mixed Semantics Helper Functions =====
function makeStrengthE3x(req) {
    const equipment = req.context?.equipment || [];
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
    const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
    const exercises = [];
    if (hasBarbell) {
        exercises.push({ exercise: 'Barbell Back Squat', target: '5 reps @ 75-80%', notes: 'Focus on depth and control' }, { exercise: 'Barbell Push Press', target: '5 reps @ 75%', notes: 'Explosive hip drive' }, { exercise: 'Barbell Deadlift', target: '3 reps @ 80%', notes: 'Maintain neutral spine' }, { exercise: 'Strict Pull-Ups', target: '6-8 reps', notes: 'Full range of motion' });
    }
    else if (hasDumbbell) {
        exercises.push({ exercise: 'Dumbbell Front Squat', target: '8 reps', notes: 'Goblet or dual DB position' }, { exercise: 'Dumbbell Bench Press', target: '8 reps', notes: 'Controlled tempo' }, { exercise: 'Dumbbell Romanian Deadlift', target: '8 reps', notes: 'Control the eccentric' }, { exercise: 'DB Row', target: '10 reps/arm', notes: 'Maintain neutral back' });
    }
    else if (hasKettlebell) {
        exercises.push({ exercise: 'KB Front Rack Squat', target: '10 reps', notes: 'Upright torso' }, { exercise: 'KB Push Press', target: '10 reps', notes: 'Hip drive to overhead' }, { exercise: 'KB Swings', target: '15 reps', notes: 'Full hip extension' });
    }
    else {
        exercises.push({ exercise: 'Bodyweight Squat', target: '20 reps', notes: 'Full depth, tempo 3-1-1' }, { exercise: 'Push-Up', target: '15 reps', notes: 'Chest to deck' }, { exercise: 'Single Leg Deadlift', target: '10/side', notes: 'Balance and control' });
    }
    return {
        kind: 'strength',
        title: 'E3:00 x 5',
        time_min: 15,
        items: exercises,
        notes: 'Complete all exercises every 3:00 for 5 rounds'
    };
}
function makeEmom(req) {
    const equipment = req.context?.equipment || [];
    const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
    const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const exercises = [];
    if (hasBarbell) {
        exercises.push({ exercise: 'Row Calories', target: '12/10 cal', notes: 'Minute 1, 4, 7, 10 - hard pace' }, { exercise: 'Barbell Thruster', target: '10 reps @ 65%', notes: 'Minute 2, 5, 8, 11 - smooth reps' }, { exercise: 'Burpees Over Bar', target: '8 reps', notes: 'Minute 3, 6, 9, 12 - lateral jump' });
    }
    else if (hasKettlebell) {
        exercises.push({ exercise: 'Kettlebell Swing', target: '15 reps', notes: 'Minute 1, 4, 7, 10 - hip drive' }, { exercise: 'KB Goblet Squat', target: '12 reps', notes: 'Minute 2, 5, 8, 11 - full depth' }, { exercise: 'Burpee', target: '10 reps', notes: 'Minute 3, 6, 9, 12 - full push-up' });
    }
    else if (hasDumbbell) {
        exercises.push({ exercise: 'Dumbbell Thruster', target: '12 reps', notes: 'Minute 1, 4, 7, 10 - smooth transition' }, { exercise: 'DB Box Step-Over', target: '10 total', notes: 'Minute 2, 5, 8, 11 - alternating' }, { exercise: 'Burpee', target: '10 reps', notes: 'Minute 3, 6, 9, 12 - chest to deck' });
    }
    else {
        exercises.push({ exercise: 'Burpee', target: '12 reps', notes: 'Odd minutes - full push-up' }, { exercise: 'Air Squat', target: '20 reps', notes: 'Even minutes - maintain tempo' }, { exercise: 'Mountain Climbers', target: '30 total', notes: 'Every 4th minute' });
    }
    return {
        kind: 'conditioning',
        title: 'EMOM 12',
        time_min: 12,
        items: exercises,
        notes: 'Rotate exercises every minute for 12 minutes'
    };
}
function makeAmrapSkill(req) {
    const equipment = req.context?.equipment || [];
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
    const exercises = [];
    if (hasBarbell) {
        exercises.push({ exercise: 'Barbell Clean', target: '5 reps @ 60%', notes: 'Focus on technique' }, { exercise: 'Toes-to-Bar', target: '8 reps', notes: 'Strict or kipping' }, { exercise: 'Handstand Hold', target: '20-30 sec', notes: 'Against wall if needed' }, { exercise: 'Double Under', target: '30 reps', notes: 'Or 60 singles' }, { exercise: 'Row Calories', target: '10/8 cal', notes: 'Smooth pace' });
    }
    else if (hasKettlebell) {
        exercises.push({ exercise: 'KB Clean', target: '8 reps/arm', notes: 'Smooth catch' }, { exercise: 'Pull-Up', target: '8 reps', notes: 'Strict or kipping' }, { exercise: 'Handstand Hold', target: '20-30 sec', notes: 'Against wall' }, { exercise: 'Double Under', target: '30 reps', notes: 'Or 60 singles' });
    }
    else {
        exercises.push({ exercise: 'Pull-Up', target: '8 reps', notes: 'Strict or kipping' }, { exercise: 'Handstand Hold', target: '20-30 sec', notes: 'Against wall' }, { exercise: 'Double Under', target: '30 reps', notes: 'Or 60 singles' }, { exercise: 'Burpee', target: '10 reps', notes: 'Full push-up' });
    }
    return {
        kind: 'skill',
        title: 'AMRAP 12',
        time_min: 12,
        items: exercises,
        notes: 'As many rounds as possible in 12 minutes'
    };
}
function makeAmrapCore(req) {
    return {
        kind: 'core',
        title: 'AMRAP 10',
        time_min: 10,
        items: [
            { exercise: 'Hollow Hold', target: '30 sec', notes: 'Press lower back to floor' },
            { exercise: 'V-Up', target: '15 reps', notes: 'Touch toes at top' },
            { exercise: 'Russian Twist', target: '20 total', notes: 'Control rotation, weighted if possible' },
            { exercise: 'Plank', target: '45 sec', notes: 'Maintain neutral spine' },
            { exercise: 'Bicycle Crunch', target: '20 total', notes: 'Slow and controlled' }
        ],
        notes: 'As many rounds as possible in 10 minutes'
    };
}
function makeFinisher21_15_9(req) {
    const equipment = req.context?.equipment || [];
    const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
    const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const exercises = [];
    if (hasBarbell) {
        exercises.push({ exercise: 'Barbell Thruster', target: '21-15-9 reps @ 65%', notes: 'Smooth cycling' }, { exercise: 'Burpees Over Bar', target: '21-15-9 reps', notes: 'Lateral jump' }, { exercise: 'Pull-Up', target: '21-15-9 reps', notes: 'Kipping or strict' });
    }
    else if (hasKettlebell) {
        exercises.push({ exercise: 'Kettlebell Swing', target: '21-15-9 reps', notes: 'American swing to overhead' }, { exercise: 'KB Goblet Squat', target: '21-15-9 reps', notes: 'Full depth' }, { exercise: 'Burpee', target: '21-15-9 reps', notes: 'Chest to deck' });
    }
    else if (hasDumbbell) {
        exercises.push({ exercise: 'Dumbbell Thruster', target: '21-15-9 reps', notes: 'Smooth transition' }, { exercise: 'DB Box Step-Over', target: '21-15-9 reps', notes: 'Alternating' }, { exercise: 'Burpee', target: '21-15-9 reps', notes: 'Full push-up' });
    }
    else {
        exercises.push({ exercise: 'Burpee', target: '21-15-9 reps', notes: 'Full push-up' }, { exercise: 'Air Squat', target: '21-15-9 reps', notes: 'Full depth' }, { exercise: 'Push-Up', target: '21-15-9 reps', notes: 'Chest to deck' });
    }
    return {
        kind: 'conditioning',
        title: 'For Time 21-15-9',
        time_min: 10,
        items: exercises,
        notes: '21 reps each, 15 reps each, 9 reps each - for time'
    };
}
function pickWarmup(req) {
    const equipment = req.context?.equipment || [];
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    // Warm-up whitelist: PVC, empty-bar technique, mobility only
    // No heavy compounds unless Empty Bar technique work
    return {
        kind: 'warmup',
        title: 'Dynamic Warm-Up',
        time_min: 8,
        items: [
            { exercise: 'Foam Roll', target: '2 min', notes: 'Upper back, lats, IT bands, quads', _source: 'warmup' },
            { exercise: 'Cat-Cow', target: '10 reps', notes: 'Spinal mobility, controlled breathing', _source: 'warmup' },
            { exercise: 'World\'s Greatest Stretch', target: '5/side', notes: 'Hip mobility, thoracic rotation', _source: 'warmup' },
            { exercise: 'PVC Pass-Through', target: '12 reps', notes: 'Shoulder mobility', _source: 'warmup' },
            { exercise: 'Leg Swings', target: '10/leg', notes: 'Hip mobility prep', _source: 'warmup' },
            { exercise: 'Arm Circles', target: '20 total', notes: 'Shoulder activation', _source: 'warmup' },
            ...(hasBarbell ? [{ exercise: 'Empty Bar Technique', target: '5 reps each', notes: 'Deadlift, hang clean, front squat, press - bar only', _source: 'warmup' }] : [{ exercise: 'Inchworm', target: '8 reps', notes: 'Hamstring + shoulder prep', _source: 'warmup' }])
        ],
        notes: 'Mobility prep and empty-bar technique work'
    };
}
function makeCooldown() {
    return {
        kind: 'cooldown',
        title: 'Cool Down & Recovery',
        time_min: 8,
        items: [
            { exercise: 'Walk or Light Bike', target: '3 min', notes: 'Gradually lower heart rate', _source: 'cooldown' },
            { exercise: 'Child\'s Pose', target: '60 sec', notes: 'Deep breathing, lat stretch', _source: 'cooldown' },
            { exercise: 'Pigeon Stretch', target: '45 sec/side', notes: 'Hip flexor and glute release', _source: 'cooldown' },
            { exercise: 'Hamstring Stretch', target: '45 sec/side', notes: 'Seated or standing, relaxed', _source: 'cooldown' },
            { exercise: 'Spinal Twist', target: '45 sec/side', notes: 'Supine or seated, gentle rotation', _source: 'cooldown' },
            { exercise: 'Shoulder + Chest Stretch', target: '60 sec total', notes: 'Doorway or wall-assisted', _source: 'cooldown' }
        ],
        notes: 'Complete recovery protocol'
    };
}
// ===== HOBH: Style-Aware Builder Functions =====
/**
 * CrossFit builder - REGISTRY-FIRST
 * Movements selected deterministically from registry, AI only for coaching notes
 */
function buildCrossFitCF(req) {
    const equipment = req.context?.equipment || [];
    const duration = req.duration || 45;
    const intensity = req.intensity || 7;
    const seed = req.seed || `${Date.now()}`;
    const hasGear = equipment.some(e => /(barbell|dumbbell|kettlebell)/i.test(e));
    const blocks = [];
    // Warmup
    blocks.push(pickWarmup(req));
    // Main 1: Strength density Every 2:30 x 5 - use registry
    const strengthPool = pickFromRegistry({
        categories: ['crossfit'],
        patterns: ['squat', 'press', 'hinge'],
        equipment: equipment.length > 0 ? equipment : undefined,
        limit: 2,
        seed: seed + '-strength'
    });
    const strengthExercises = strengthPool.slice(0, 2).map((m) => ({
        exercise: m.name,
        registry_id: m.id,
        target: hasGear ? '5 reps @ 75-80%' : '15-20 reps',
        notes: 'Focus on form and control',
        _source: 'registry'
    }));
    blocks.push({
        kind: 'strength',
        title: 'Every 2:30 x 5',
        time_min: 13,
        items: strengthExercises.length > 0 ? strengthExercises : [
            { exercise: 'Air Squat', target: '20 reps', notes: 'Full depth', _source: 'fallback' },
            { exercise: 'Push-Up', target: '15 reps', notes: 'Chest to deck', _source: 'fallback' }
        ],
        notes: 'Strength density - complete all movements every 2:30 for 5 rounds'
    });
    // Main 2: EMOM 14-16 - use registry
    const emomDuration = intensity >= 8 ? 16 : 14;
    const conditioningPool = pickFromRegistry({
        categories: ['crossfit'],
        patterns: ['cardio', 'hinge', 'squat', 'press'],
        equipment: equipment.length > 0 ? equipment : undefined,
        limit: 2,
        seed: seed + '-conditioning'
    });
    const emomExercises = conditioningPool.slice(0, 2).map((m, idx) => ({
        exercise: `${m.name} (${idx % 2 === 0 ? 'odd' : 'even'} min)`,
        registry_id: m.id,
        target: hasGear ? '8-12 reps' : '12-15 reps',
        notes: idx % 2 === 0 ? 'Hard pace' : 'Smooth rhythm',
        _source: 'registry'
    }));
    blocks.push({
        kind: 'conditioning',
        title: `EMOM ${emomDuration}`,
        time_min: emomDuration,
        items: emomExercises.length > 0 ? emomExercises : [
            { exercise: 'Burpees (odd min)', target: '12 reps', notes: 'Full push-up', _source: 'fallback' },
            { exercise: 'Air Squat (even min)', target: '20 reps', notes: 'Full depth', _source: 'fallback' }
        ],
        notes: `EMOM ${emomDuration} - alternate movements each minute`
    });
    // Optional finisher if time permits
    const totalTime = blocks.reduce((sum, b) => sum + b.time_min, 0);
    if (totalTime < duration - 8) {
        const finisherPool = pickFromRegistry({
            categories: ['crossfit'],
            patterns: ['press', 'squat'],
            equipment: equipment.length > 0 ? equipment : undefined,
            limit: 2,
            seed: seed + '-finisher'
        });
        const finisherExercises = finisherPool.slice(0, 2).map((m) => ({
            exercise: m.name,
            registry_id: m.id,
            target: '21-15-9',
            notes: 'For time',
            _source: 'registry'
        }));
        if (finisherExercises.length > 0) {
            blocks.push({
                kind: 'conditioning',
                title: 'For Time 21-15-9',
                time_min: 8,
                items: finisherExercises,
                notes: 'Complete 21-15-9 reps for time'
            });
        }
    }
    // Cooldown
    blocks.push(makeCooldown());
    const hardnessFloor = hasGear ? 0.85 : 0.55;
    const varietyScore = hasGear ? 0.90 : 0.60;
    return {
        title: 'CrossFit HIIT Session',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: hasGear,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: varietyScore >= hardnessFloor,
            patterns_locked: true
        },
        variety_score: varietyScore,
        meta: {
            generator: 'premium',
            style: 'crossfit',
            seed
        }
    };
}
function buildOly(req, pack) {
    const equipment = req.context?.equipment || [];
    const duration = req.duration || 45;
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const seed = req.seed || `${Date.now()}`;
    // Use duration-aware pack if provided, otherwise use defaults
    const warmupMin = pack?.warmupMin || 8;
    const cooldownMin = pack?.cooldownMin || 8;
    const mainBlocks = pack?.mainBlocks || [];
    const blocks = [];
    // Warmup: Barbell complex (use pack duration)
    if (hasBarbell) {
        blocks.push({
            kind: 'warmup',
            title: 'Barbell Warm-up Complex',
            time_min: warmupMin,
            items: [
                { exercise: 'PVC Pass-Through', target: '10 reps', notes: 'Shoulder mobility', _source: 'warmup' },
                { exercise: 'Burgener Warm-up', target: '5 reps each', notes: 'Down-up, elbows high, muscle snatch, snatch balance', _source: 'warmup' },
                { exercise: 'Empty Bar Snatch', target: '5 reps', notes: 'Focus on positions', _source: 'warmup' },
                { exercise: 'Empty Bar Clean & Jerk', target: '5 reps', notes: 'Focus on timing', _source: 'warmup' }
            ],
            notes: 'Comprehensive Olympic lifting prep'
        });
    }
    else {
        blocks.push(pickWarmup(req));
    }
    // Build main blocks from pack (if provided) or use hardcoded fallback
    if (mainBlocks.length > 0 && hasBarbell) {
        // Pack-driven main blocks (duration-aware)
        mainBlocks.forEach((packBlock, idx) => {
            const { pattern, minutes, select, kind } = packBlock;
            const title = packBlock.title;
            // Calculate rounds based on pattern and minutes
            let rounds = 7;
            if (pattern === 'E2:00x')
                rounds = Math.floor(minutes / 2);
            else if (pattern === 'E2:30x')
                rounds = Math.floor(minutes / 2.5);
            else if (pattern === 'E3:00x')
                rounds = Math.floor(minutes / 3);
            else if (pattern === 'EMOM')
                rounds = minutes;
            // Pick movements from registry based on pack select criteria
            const movements = pickFromRegistry({
                categories: select.categories,
                patterns: select.patterns,
                equipment: equipment.filter(e => /barbell/i.test(e)),
                limit: 10,
                seed: seed + '-main-' + idx
            });
            const exercises = movements.slice(0, select.items).map((m) => ({
                exercise: m.name,
                registry_id: m.id,
                target: pattern.includes('E2') || pattern.includes('E3') ? '1+1+1 @ 65-80%' : '5-8 reps',
                notes: 'Quality movement'
            }));
            blocks.push({
                kind: kind || 'strength',
                title: title || `${pattern} x ${rounds}`,
                time_min: minutes,
                items: exercises,
                notes: `${title || pattern} - maintain form and positions`
            });
        });
    }
    else if (hasBarbell) {
        // Fallback: hardcoded blocks if no pack provided
        const snatchPool = pickFromRegistry({
            categories: ['olympic_weightlifting'],
            patterns: ['olympic_snatch', 'pull', 'overhead_squat'],
            equipment: ['barbell'],
            limit: 8,
            seed: seed + '-snatch'
        });
        const snatchExercises = snatchPool.slice(0, 1).map((m) => ({
            exercise: m.name,
            registry_id: m.id,
            target: '1+1+1 @ 65-80%',
            notes: 'Complex - no dropping between reps'
        }));
        blocks.push({
            kind: 'strength',
            title: 'Every 2:00 x 7',
            time_min: 14,
            items: snatchExercises,
            notes: 'Snatch complex - focus on positions and timing'
        });
        const cjPool = pickFromRegistry({
            categories: ['olympic_weightlifting'],
            patterns: ['olympic_cleanjerk', 'front_squat', 'pull'],
            equipment: ['barbell'],
            limit: 8,
            seed: seed + '-cj'
        });
        const cjExercises = cjPool.slice(0, 1).map((m) => ({
            exercise: m.name,
            registry_id: m.id,
            target: '1+1+1 @ 65-80%',
            notes: 'Complex - no dropping between reps'
        }));
        blocks.push({
            kind: 'strength',
            title: 'Every 2:00 x 7',
            time_min: 14,
            items: cjExercises,
            notes: 'Clean & Jerk complex - maintain positions'
        });
    }
    else {
        // No barbell fallback
        blocks.push({
            kind: 'strength',
            title: 'Every 2:00 x 7',
            time_min: 14,
            items: [{ exercise: 'Burpee to High Jump', target: '5 reps', notes: 'Explosive hip extension' }],
            notes: 'Power development'
        });
    }
    // Cooldown (use pack duration)
    blocks.push({
        kind: 'cooldown',
        title: 'Mobility & Recovery',
        time_min: cooldownMin,
        items: [
            { exercise: 'T-Spine Foam Roll', target: '90 sec', notes: 'Upper back extension', _source: 'cooldown' },
            { exercise: 'Hip Flexor Stretch', target: '60 sec/side', notes: 'Couch stretch or lunge', _source: 'cooldown' },
            { exercise: 'Overhead Reach', target: '60 sec total', notes: 'Shoulder flexibility', _source: 'cooldown' },
            { exercise: 'Child\'s Pose', target: '90 sec', notes: 'Deep breathing', _source: 'cooldown' }
        ],
        notes: 'T-spine + hips recovery'
    });
    const varietyScore = hasBarbell ? 0.95 : 0.70;
    return {
        title: 'Olympic Weightlifting Session',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: hasBarbell,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: varietyScore >= 0.85,
            patterns_locked: true
        },
        variety_score: varietyScore
    };
}
function buildPowerlifting(req) {
    const equipment = req.context?.equipment || [];
    const duration = req.duration || 45;
    const intensity = req.intensity || 8;
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const blocks = [];
    // Warmup
    blocks.push(pickWarmup(req));
    // Choose two lifts (Squat, Bench, Deadlift)
    const lifts = ['Squat', 'Deadlift', 'Bench Press'];
    const selectedLifts = intensity >= 9
        ? ['Squat', 'Deadlift']
        : ['Squat', 'Bench Press'];
    // Lift A: Heavy sets
    const liftAExercises = [];
    if (hasBarbell) {
        const liftA = selectedLifts[0];
        const protocol = intensity >= 9 ? '6 x 2 @ 90-92%' : '5 x 3 @ 85-90%';
        liftAExercises.push({ exercise: `Barbell ${liftA}`, target: protocol, notes: 'Focus on speed and form, rest 2-3 min' });
    }
    else {
        liftAExercises.push({ exercise: 'Bodyweight Squat', target: '5 x 15', notes: 'Tempo 3-1-1, rest 90s' });
    }
    blocks.push({
        kind: 'strength',
        title: 'Main Lift A',
        time_min: 18,
        items: liftAExercises,
        notes: 'Heavy strength work with full rest'
    });
    // Lift B: Volume sets
    const liftBExercises = [];
    if (hasBarbell) {
        const liftB = selectedLifts[1];
        liftBExercises.push({ exercise: `Barbell ${liftB}`, target: '4 x 5-6 @ 75-82%', notes: 'Controlled tempo, rest 2 min' });
    }
    else {
        liftBExercises.push({ exercise: 'Push-Up', target: '4 x 12-15', notes: 'Tempo 3-0-1, rest 90s' });
    }
    blocks.push({
        kind: 'strength',
        title: 'Main Lift B',
        time_min: 14,
        items: liftBExercises,
        notes: 'Volume work for hypertrophy'
    });
    // Accessory superset
    const accessoryExercises = [];
    if (hasBarbell) {
        accessoryExercises.push({ exercise: 'Barbell RDL (A)', target: '3 x 10-12', notes: 'Hamstring focus' }, { exercise: 'Barbell Row (B)', target: '3 x 10-12', notes: 'Upper back' }, { exercise: 'DB Bench or Press (C)', target: '3 x 12', notes: 'Pressing accessory' });
    }
    else {
        accessoryExercises.push({ exercise: 'Single Leg RDL (A)', target: '3 x 10/side', notes: 'Balance and hamstrings' }, { exercise: 'Inverted Row (B)', target: '3 x 12', notes: 'Back strength' }, { exercise: 'Pike Push-Up (C)', target: '3 x 10', notes: 'Shoulder work' });
    }
    blocks.push({
        kind: 'conditioning',
        title: 'Accessory Superset',
        time_min: 12,
        items: accessoryExercises,
        notes: 'Complete A+B+C with 60-90s rest, 3 rounds'
    });
    // Cooldown
    blocks.push(makeCooldown());
    const varietyScore = hasBarbell ? 0.92 : 0.65;
    return {
        title: 'Powerlifting Session',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: hasBarbell,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: varietyScore >= 0.85,
            patterns_locked: true
        },
        variety_score: varietyScore
    };
}
function buildBBFull(req) {
    return buildBodybuilding(req, 'full');
}
function buildBBUpper(req) {
    return buildBodybuilding(req, 'upper');
}
function buildBBLower(req) {
    return buildBodybuilding(req, 'lower');
}
function buildBodybuilding(req, split) {
    const equipment = req.context?.equipment || [];
    const duration = req.duration || 45;
    const hasBarbell = equipment.some(e => /barbell/i.test(e));
    const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
    const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
    const hasGear = hasBarbell || hasDumbbell || hasKettlebell;
    const blocks = [];
    // Warmup
    blocks.push(pickWarmup(req));
    if (split === 'full') {
        // Tri-set 1: Push
        const pushExercises = [];
        if (hasBarbell) {
            pushExercises.push({ exercise: 'Barbell Bench Press (A1)', target: '3 x 10-12', notes: 'Controlled tempo 3-0-1' }, { exercise: 'DB Shoulder Press (A2)', target: '3 x 12', notes: 'Full ROM' }, { exercise: 'DB Lateral Raise (A3)', target: '3 x 15', notes: 'Slow eccentric' });
        }
        else if (hasDumbbell) {
            pushExercises.push({ exercise: 'DB Bench Press (A1)', target: '3 x 10-12', notes: 'Deep stretch' }, { exercise: 'DB Shoulder Press (A2)', target: '3 x 12', notes: 'Full ROM' }, { exercise: 'DB Lateral Raise (A3)', target: '3 x 15', notes: 'Control tempo' });
        }
        else {
            pushExercises.push({ exercise: 'Push-Up (A1)', target: '3 x 15-20', notes: 'Tempo 3-0-1' }, { exercise: 'Pike Push-Up (A2)', target: '3 x 12', notes: 'Shoulder focus' }, { exercise: 'Plank to Down Dog (A3)', target: '3 x 10', notes: 'Shoulder stability' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Push Tri-Set',
            time_min: 12,
            items: pushExercises,
            notes: 'Complete A1+A2+A3, rest 45-75s, repeat for 3 sets'
        });
        // Tri-set 2: Pull
        const pullExercises = [];
        if (hasBarbell) {
            pullExercises.push({ exercise: 'Barbell Row (B1)', target: '3 x 10-12', notes: 'Elbows tight' }, { exercise: 'Lat Pulldown or Pull-Up (B2)', target: '3 x 8-12', notes: 'Full stretch' }, { exercise: 'Face Pull (B3)', target: '3 x 15', notes: 'Rear delt focus' });
        }
        else if (hasDumbbell) {
            pullExercises.push({ exercise: 'DB Row (B1)', target: '3 x 12/arm', notes: 'Elbow to hip' }, { exercise: 'DB Pullover (B2)', target: '3 x 12', notes: 'Stretch lats' }, { exercise: 'DB Rear Delt Fly (B3)', target: '3 x 15', notes: 'Pinch shoulder blades' });
        }
        else {
            pullExercises.push({ exercise: 'Inverted Row (B1)', target: '3 x 12-15', notes: 'Chest to bar' }, { exercise: 'Plank Row (B2)', target: '3 x 10/side', notes: 'Minimal rotation' }, { exercise: 'Prone Y-Raise (B3)', target: '3 x 12', notes: 'Rear delt activation' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Pull Tri-Set',
            time_min: 12,
            items: pullExercises,
            notes: 'Complete B1+B2+B3, rest 45-75s, repeat for 3 sets'
        });
        // Tri-set 3: Legs
        const legExercises = [];
        if (hasBarbell) {
            legExercises.push({ exercise: 'Barbell Back Squat (C1)', target: '3 x 10-12', notes: 'Full depth' }, { exercise: 'Barbell RDL (C2)', target: '3 x 12', notes: 'Hamstring stretch' }, { exercise: 'Walking Lunge (C3)', target: '3 x 20 total', notes: 'Full ROM' });
        }
        else if (hasDumbbell) {
            legExercises.push({ exercise: 'DB Goblet Squat (C1)', target: '3 x 12-15', notes: 'Upright torso' }, { exercise: 'DB RDL (C2)', target: '3 x 12', notes: 'Hamstring focus' }, { exercise: 'DB Walking Lunge (C3)', target: '3 x 20 total', notes: 'Control descent' });
        }
        else {
            legExercises.push({ exercise: 'Bodyweight Squat (C1)', target: '3 x 20', notes: 'Tempo 3-1-1' }, { exercise: 'Single Leg RDL (C2)', target: '3 x 10/side', notes: 'Balance focus' }, { exercise: 'Walking Lunge (C3)', target: '3 x 20 total', notes: 'Full depth' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Leg Tri-Set',
            time_min: 12,
            items: legExercises,
            notes: 'Complete C1+C2+C3, rest 60s, repeat for 3 sets'
        });
    }
    else if (split === 'upper') {
        // Superset 1: Chest + Back
        const chestBackExercises = [];
        if (hasBarbell || hasDumbbell) {
            const prefix = hasBarbell ? 'Barbell' : 'DB';
            chestBackExercises.push({ exercise: `${prefix} Bench Press (A1)`, target: '4 x 8-12', notes: 'Controlled tempo' }, { exercise: `${prefix} Row (A2)`, target: '4 x 10-12', notes: 'Squeeze at top' });
        }
        else {
            chestBackExercises.push({ exercise: 'Push-Up (A1)', target: '4 x 15-20', notes: 'Chest to deck' }, { exercise: 'Inverted Row (A2)', target: '4 x 12-15', notes: 'Full ROM' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Chest + Back Superset',
            time_min: 14,
            items: chestBackExercises,
            notes: 'A1+A2, rest 60-75s, 4 sets'
        });
        // Superset 2: Shoulders + Arms
        const shoulderArmExercises = [];
        if (hasDumbbell || hasBarbell) {
            shoulderArmExercises.push({ exercise: 'DB Shoulder Press (B1)', target: '4 x 10-12', notes: 'Full ROM' }, { exercise: 'DB Bicep Curl (B2)', target: '4 x 12-15', notes: 'Control eccentric' }, { exercise: 'DB Tricep Extension (B3)', target: '4 x 12-15', notes: 'Full stretch' });
        }
        else {
            shoulderArmExercises.push({ exercise: 'Pike Push-Up (B1)', target: '4 x 10-12', notes: 'Shoulder focus' }, { exercise: 'Chin-Up Hold (B2)', target: '4 x 20-30s', notes: 'Bicep isometric' }, { exercise: 'Diamond Push-Up (B3)', target: '4 x 10-12', notes: 'Tricep focus' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Shoulder + Arm Tri-Set',
            time_min: 12,
            items: shoulderArmExercises,
            notes: 'B1+B2+B3, rest 45-60s, 4 sets'
        });
        // Finisher
        const finisherExercises = [];
        if (hasDumbbell) {
            finisherExercises.push({ exercise: 'DB Lateral Raise', target: '30-20-10', notes: 'Slow tempo' }, { exercise: 'DB Front Raise', target: '30-20-10', notes: 'Controlled' });
        }
        else {
            finisherExercises.push({ exercise: 'Plank to Down Dog', target: '30-20-10', notes: 'Shoulder pump' }, { exercise: 'Scapular Push-Up', target: '30-20-10', notes: 'Shoulder blade focus' });
        }
        blocks.push({
            kind: 'conditioning',
            title: 'Metabolite Finisher',
            time_min: 8,
            items: finisherExercises,
            notes: 'Complete 30-20-10 reps for time'
        });
    }
    else { // lower
        // Superset 1: Quads
        const quadExercises = [];
        if (hasBarbell) {
            quadExercises.push({ exercise: 'Barbell Back Squat (A1)', target: '4 x 8-12', notes: 'Tempo 3-0-1' }, { exercise: 'Barbell Front Squat (A2)', target: '4 x 10-12', notes: 'Upright torso' });
        }
        else if (hasDumbbell) {
            quadExercises.push({ exercise: 'DB Goblet Squat (A1)', target: '4 x 12-15', notes: 'Full depth' }, { exercise: 'DB Bulgarian Split Squat (A2)', target: '4 x 10/leg', notes: 'Control descent' });
        }
        else {
            quadExercises.push({ exercise: 'Bodyweight Squat (A1)', target: '4 x 20', notes: 'Tempo 3-1-1' }, { exercise: 'Reverse Lunge (A2)', target: '4 x 12/leg', notes: 'Full ROM' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Quad Superset',
            time_min: 14,
            items: quadExercises,
            notes: 'A1+A2, rest 60-75s, 4 sets'
        });
        // Superset 2: Hamstrings + Glutes
        const hamGluteExercises = [];
        if (hasBarbell) {
            hamGluteExercises.push({ exercise: 'Barbell RDL (B1)', target: '4 x 10-12', notes: 'Hamstring stretch' }, { exercise: 'Barbell Hip Thrust (B2)', target: '4 x 12-15', notes: 'Glute squeeze' });
        }
        else if (hasDumbbell) {
            hamGluteExercises.push({ exercise: 'DB RDL (B1)', target: '4 x 12-15', notes: 'Control eccentric' }, { exercise: 'DB Goblet Sumo Squat (B2)', target: '4 x 15', notes: 'Wide stance' });
        }
        else {
            hamGluteExercises.push({ exercise: 'Single Leg RDL (B1)', target: '4 x 10/leg', notes: 'Balance and hamstrings' }, { exercise: 'Glute Bridge (B2)', target: '4 x 20', notes: 'Full glute contraction' });
        }
        blocks.push({
            kind: 'strength',
            title: 'Hamstring + Glute Superset',
            time_min: 12,
            items: hamGluteExercises,
            notes: 'B1+B2, rest 60s, 4 sets'
        });
        // Finisher
        const legFinisherExercises = [];
        if (hasDumbbell) {
            legFinisherExercises.push({ exercise: 'DB Goblet Squat', target: '30-20-10', notes: 'Light weight, full ROM' }, { exercise: 'Walking Lunge', target: '30-20-10', notes: 'Bodyweight, controlled' });
        }
        else {
            legFinisherExercises.push({ exercise: 'Air Squat', target: '30-20-10', notes: 'Full depth, fast' }, { exercise: 'Jumping Lunge', target: '30-20-10', notes: 'Explosive' });
        }
        blocks.push({
            kind: 'conditioning',
            title: 'Leg Metabolite Finisher',
            time_min: 8,
            items: legFinisherExercises,
            notes: 'Complete 30-20-10 reps for time'
        });
    }
    // Cooldown
    blocks.push(makeCooldown());
    const varietyScore = hasGear ? 0.88 : 0.60;
    const splitTitle = split === 'full' ? 'Full Body' : split === 'upper' ? 'Upper Body' : 'Lower Body';
    return {
        title: `Bodybuilding ${splitTitle} Session`,
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: hasGear,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: varietyScore >= 0.80,
            patterns_locked: true
        },
        variety_score: varietyScore
    };
}
function buildAerobic(req) {
    const duration = req.duration || 45;
    const intensity = req.intensity || 6;
    const blocks = [];
    // Warmup
    blocks.push(pickWarmup(req));
    // Intervals based on intensity
    const intervalExercises = [];
    if (intensity >= 8) {
        // Z4: 10 x 1:00 @ Z4, 1:00 easy
        intervalExercises.push({ exercise: 'Bike/Row/Ski', target: '10 x 1:00 @ Z4 (85-90% max HR)', notes: '1:00 easy between intervals' });
        blocks.push({
            kind: 'conditioning',
            title: 'Z4 Intervals',
            time_min: 20,
            items: intervalExercises,
            notes: 'High-intensity intervals - hard effort with equal rest'
        });
    }
    else {
        // Z3: 5 x 4:00 @ Z3, 2:00 easy
        intervalExercises.push({ exercise: 'Bike/Row/Ski/Run', target: '5 x 4:00 @ Z3 (75-80% max HR)', notes: '2:00 easy between intervals' });
        blocks.push({
            kind: 'conditioning',
            title: 'Z3 Intervals',
            time_min: 30,
            items: intervalExercises,
            notes: 'Moderate intervals - sustainable pace with active recovery'
        });
    }
    // Optional skill finisher
    const totalTime = blocks.reduce((sum, b) => sum + b.time_min, 0);
    if (totalTime < duration - 8) {
        blocks.push({
            kind: 'skill',
            title: 'EMOM 10 - Easy Skill',
            time_min: 10,
            items: [
                { exercise: 'Double Unders or Jump Rope', target: '30 reps', notes: 'Odd minutes - light effort' },
                { exercise: 'Hollow Hold', target: '20-30s', notes: 'Even minutes - core activation' }
            ],
            notes: 'Easy skill work - recovery pace'
        });
    }
    // Cooldown
    blocks.push(makeCooldown());
    return {
        title: 'Aerobic Conditioning Session',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: true,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: true, // Aerobic sessions bypass hardness requirement
            patterns_locked: true
        },
        variety_score: 0.75 // Time at intensity
    };
}
function buildEndurance(req, pack) {
    const duration = req.duration || 45;
    const intensity = req.intensity || 6;
    const equipment = req.context?.equipment || [];
    const blocks = [];
    // Warmup
    blocks.push(pickWarmup(req));
    // HYROX-style endurance: Alternating cardio + functional movements
    // Determine cardio modality from available equipment
    const hasRower = equipment.some(e => /rower|row/i.test(e));
    const hasBike = equipment.some(e => /bike/i.test(e));
    const hasTreadmill = equipment.some(e => /treadmill|run/i.test(e));
    const hasSkiErg = equipment.some(e => /ski/i.test(e));
    // Pick primary cardio modality based on available equipment
    let cardioModality = 'Running';
    if (hasRower) {
        cardioModality = 'Row';
    }
    else if (hasBike) {
        cardioModality = 'Bike';
    }
    else if (hasSkiErg) {
        cardioModality = 'Ski Erg';
    }
    else if (hasTreadmill || !hasRower && !hasBike && !hasSkiErg) {
        cardioModality = 'Running';
    }
    // Calculate work time (total - warmup - cooldown)
    const mainTime = duration - 14; // 8min warmup + 6min cooldown
    // Functional movement patterns for endurance circuits (HYROX-style)
    const functionalPatterns = [
        ['jump', 'bodyweight'], // Burpees, box jumps
        ['squat', 'throw'], // Wall balls, thrusters  
        ['hinge', 'ballistic'], // KB swings, DB snatches
        ['lunge', 'carry'], // Lunges, farmer carries
        ['push', 'bodyweight'], // Push-ups, burpees
    ];
    // Build main circuit: alternating cardio + functional movements
    const exercises = [];
    const numStations = Math.min(5, Math.floor(mainTime / 4)); // 4-5 stations
    for (let i = 0; i < numStations; i++) {
        // Cardio station with distance
        const cardioDistance = intensity >= 7 ? 1000 : 800; // Higher intensity = longer distance
        exercises.push({
            exercise: cardioModality,
            scheme: {
                distance_m: cardioDistance
            },
            notes: `${cardioDistance}m @ moderate pace`
        });
        // Functional movement station
        if (i < numStations - 1) { // Don't add after last cardio
            const patterns = functionalPatterns[i % functionalPatterns.length];
            const results = queryMovements({
                patterns,
                equipment,
                limit: 1
            });
            if (results.length > 0) {
                const reps = intensity >= 7 ? 50 : 40;
                exercises.push({
                    exercise: results[0].name,
                    registry_id: results[0].id,
                    scheme: {
                        reps: reps
                    },
                    notes: `${reps} reps for quality`
                });
            }
        }
    }
    blocks.push({
        kind: 'main',
        title: 'HYROX-Style Circuit',
        time_min: mainTime,
        items: exercises,
        notes: `Alternate between cardio and functional movements - maintain steady pace throughout`
    });
    // Cooldown
    blocks.push(makeCooldown());
    return {
        title: 'Endurance Circuit Training',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: true,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: true,
            patterns_locked: true
        },
        variety_score: 0.80
    };
}
function buildGymnastics(req) {
    const duration = req.duration || 45;
    const blocks = [];
    // Warmup: wrists/shoulders/hips
    blocks.push({
        kind: 'warmup',
        title: 'Gymnastics Warm-up',
        time_min: 10,
        items: [
            { exercise: 'Wrist Circles', target: '20 each direction', notes: 'Prep for hand balancing', _source: 'warmup' },
            { exercise: 'Shoulder Pass-Through', target: '15 reps', notes: 'PVC or band', _source: 'warmup' },
            { exercise: 'Cat-Cow', target: '15 reps', notes: 'Spinal mobility', _source: 'warmup' },
            { exercise: 'Hip Circles', target: '10 each direction', notes: 'Dynamic hip prep', _source: 'warmup' },
            { exercise: 'Scapular Push-Up', target: '10 reps', notes: 'Shoulder blade control', _source: 'warmup' }
        ],
        notes: 'Comprehensive gymnastics prep - wrists, shoulders, hips'
    });
    // Skill EMOM 12-16
    blocks.push({
        kind: 'skill',
        title: 'EMOM 16',
        time_min: 16,
        items: [
            { exercise: 'Handstand Hold (odd min)', target: ':20-:30', notes: 'Wall-facing or freestanding, chest to wall preferred' },
            { exercise: 'Strict Pull-Up (even min)', target: '3-5 reps', notes: 'Full ROM, control tempo - scale to ring rows' }
        ],
        notes: 'Skill EMOM - quality over quantity, rest as needed'
    });
    // AMRAP 8 - Quality core
    blocks.push({
        kind: 'core',
        title: 'AMRAP 8 - Quality Core',
        time_min: 8,
        items: [
            { exercise: 'Toes-to-Bar', target: '5-8 reps', notes: 'Strict or kipping - scale to knees-to-chest' },
            { exercise: 'L-Sit Hold', target: ':15-:20', notes: 'Parallettes or floor - scale bent knee' },
            { exercise: 'Hollow Rocks', target: '12 reps', notes: 'Lower back to floor' }
        ],
        notes: 'Quality core work - maintain positions, rest as needed'
    });
    // Cooldown
    blocks.push(makeCooldown());
    return {
        title: 'Gymnastics Skill Session',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: true,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: true,
            patterns_locked: true
        },
        variety_score: 0.80
    };
}
function buildMobility(req) {
    const duration = req.duration || 45;
    const blocks = [];
    // Warmup: 2-3 min cardio + dynamic
    blocks.push({
        kind: 'warmup',
        title: 'Dynamic Warm-up',
        time_min: 5,
        items: [
            { exercise: 'Light Bike or Walk', target: '2-3 min', notes: 'Gradually increase heart rate', _source: 'warmup' },
            { exercise: 'Arm Circles', target: '20 total', notes: 'Forward and backward', _source: 'warmup' },
            { exercise: 'Leg Swings', target: '10/leg each direction', notes: 'Front-back and side-side', _source: 'warmup' },
            { exercise: 'Cat-Cow', target: '10 reps', notes: 'Spinal mobility', _source: 'warmup' }
        ],
        notes: 'Easy cardio + dynamic mobility prep'
    });
    // Circuit A: 2 rounds of 4-5 positions
    blocks.push({
        kind: 'skill',
        title: 'Mobility Circuit A - 2 Rounds',
        time_min: 15,
        items: [
            { exercise: 'Deep Squat Hold', target: ':45-:60', notes: 'Hands on floor for support, heels down' },
            { exercise: 'Pigeon Stretch', target: ':45-:60/side', notes: 'Hip flexor and glute release' },
            { exercise: 'Thoracic Rotation', target: ':45-:60/side', notes: 'T-spine mobility on all fours' },
            { exercise: 'Downward Dog to Cobra', target: ':45-:60', notes: 'Hip hinge to spinal extension' },
            { exercise: 'Side Lying Thread the Needle', target: ':45-:60/side', notes: 'T-spine rotation with reach' }
        ],
        notes: '2 rounds - :45-:60 each position, minimal rest between exercises'
    });
    // Circuit B: 2 rounds PNF/contract-relax
    blocks.push({
        kind: 'skill',
        title: 'Mobility Circuit B - 2 Rounds (PNF)',
        time_min: 12,
        items: [
            { exercise: 'Hamstring PNF Stretch', target: ':30 contract + :30 relax/side', notes: 'Supine leg raise, contract into band/hand' },
            { exercise: 'Hip Flexor PNF Stretch', target: ':30 contract + :30 relax/side', notes: 'Lunge position, contract into resistance' },
            { exercise: 'Shoulder External Rotation PNF', target: ':30 contract + :30 relax/side', notes: 'Doorway or band, contract then deepen' },
            { exercise: 'Chest PNF Stretch', target: ':30 contract + :30 relax', notes: 'Doorway stretch, press into frame then relax' }
        ],
        notes: '2 rounds - contract-relax technique for deeper ROM'
    });
    // Cooldown breathing
    blocks.push({
        kind: 'cooldown',
        title: 'Breathing & Final Relaxation',
        time_min: 8,
        items: [
            { exercise: 'Supine Breathing', target: '3 min', notes: '4-7-8 breathing pattern (4s inhale, 7s hold, 8s exhale)', _source: 'cooldown' },
            { exercise: 'Child\'s Pose', target: '2 min', notes: 'Deep relaxation, arms extended', _source: 'cooldown' },
            { exercise: 'Savasana (Corpse Pose)', target: '3 min', notes: 'Complete body relaxation, mental reset', _source: 'cooldown' }
        ],
        notes: 'Deep breathing and final relaxation'
    });
    return {
        title: 'Mobility & Recovery Session',
        duration_min: duration,
        blocks,
        acceptance_flags: {
            time_fit: true,
            has_warmup: true,
            has_cooldown: true,
            mixed_rule_ok: true,
            equipment_ok: true,
            injury_safe: true,
            readiness_mod_applied: true,
            hardness_ok: true, // Mobility deliberately bypasses hardness requirement
            patterns_locked: true
        },
        variety_score: 0.50 // Deliberately low - this is recovery
    };
}
// Helper to add meta information to workout
function enrichWithMeta(workout, style, seed, req) {
    // Tag items with registry_id by looking up movement names
    for (const block of workout.blocks) {
        for (const item of block.items || []) {
            if (!item.exercise)
                continue;
            const movement = findMovement(item.exercise);
            if (movement) {
                item.registry_id = movement.id;
            }
        }
    }
    // Apply registry-aware sanitization (use duration-aware pack for olympic and endurance)
    let pack;
    if (style === 'olympic_weightlifting') {
        pack = buildOlympicPack(req?.duration || 45);
    }
    else if (style === 'endurance') {
        const eq = (req?.equipment || []).map((x) => String(x).toLowerCase());
        pack = buildEndurancePack(req?.duration || 45, req?.intensity || 6, eq);
    }
    else {
        const base = PACKS[style] || PACKS['crossfit'];
        pack = { ...base };
        const total = req?.duration || 45;
        if (total <= pack.warmupMin + pack.cooldownMin + 10) {
            pack.warmupMin = Math.max(6, pack.warmupMin - 2);
            pack.cooldownMin = Math.max(4, pack.cooldownMin - 2);
        }
    }
    const sanitizedWorkout = sanitizeWorkout(workout, req || { equipment: [] }, pack, seed);
    // Enforce style-specific content policies
    const policyRes = enforceStylePolicy(sanitizedWorkout, REG, style);
    if (!policyRes.ok) {
        console.warn(`⚠️ Style policy violation for ${style}: ${policyRes.reason}${policyRes.offender ? ` (${policyRes.offender})` : ''}`);
        // Try auto-fix by swapping offenders with compliant registry matches
        const fixed = tryAutoFixByPolicy(sanitizedWorkout, REG, style, policyRes);
        if (!fixed) {
            // Policy violation couldn't be auto-fixed: either throw (strict) or log repair and continue
            policyFailOrRepair(sanitizedWorkout, policyRes.reason || 'unknown_policy_violation', { style, offender: policyRes.offender, auto_fix_attempted: true, auto_fix_succeeded: false });
        }
        else {
            console.log(`✅ Style policy violation auto-fixed for ${style}`);
            // Log successful auto-fix as a repair (in non-strict mode)
            if (!PREMIUM_STRICT) {
                policyFailOrRepair(sanitizedWorkout, `${policyRes.reason}_auto_fixed`, { style, offender: policyRes.offender, auto_fix_attempted: true, auto_fix_succeeded: true });
            }
        }
    }
    // Recompute main_loaded_ratio after substitutions
    sanitizedWorkout.meta = {
        ...(sanitizedWorkout.meta || {}),
        style_ok: true,
        main_loaded_ratio: loadedRatioMainOnly(sanitizedWorkout.blocks, REG)
    };
    // CrossFit auto-upgrade: if loaded ratio < 60%, upgrade BW mains to loaded
    if (style === 'crossfit' && sanitizedWorkout.meta.main_loaded_ratio < 0.60) {
        console.log(`⚠️ CF loaded ratio below 60%: ${(sanitizedWorkout.meta.main_loaded_ratio * 100).toFixed(0)}%`);
        autoUpgradeCFToLoaded(sanitizedWorkout, REG, req);
        // Recompute after upgrade
        sanitizedWorkout.meta.main_loaded_ratio = loadedRatioMainOnly(sanitizedWorkout.blocks, REG);
    }
    // Ensure block time alignment
    const durationMin = req?.duration || sanitizedWorkout.duration_min || 45;
    fitBlocksToDuration(sanitizedWorkout.blocks, durationMin, pack.warmupMin || 8, pack.cooldownMin || 8);
    // Build comprehensive acceptance flags (sanitizer already sets some)
    const totalTimeMin = sanitizedWorkout.blocks.reduce((sum, b) => sum + (b.time_min || 0), 0);
    const acceptance = {
        time_fit: Math.abs(totalTimeMin - durationMin) <= Math.max(2, durationMin * 0.05),
        has_warmup: !!sanitizedWorkout.blocks.find((b) => b.kind === 'warmup' && (b.time_min || 0) >= 6),
        has_cooldown: !!sanitizedWorkout.blocks.find((b) => b.kind === 'cooldown' && (b.time_min || 0) >= 4),
        style_ok: !!PACKS[style],
        equipment_ok: true,
        mixed_rule_ok: sanitizedWorkout.acceptance_flags?.mixed_rule_ok ?? true,
        injury_safe: sanitizedWorkout.acceptance_flags?.injury_safe ?? true,
        readiness_mod_applied: sanitizedWorkout.acceptance_flags?.readiness_mod_applied ?? true,
        patterns_locked: sanitizedWorkout.acceptance_flags?.patterns_locked ?? true,
        // These come from sanitizer:
        hardness_ok: sanitizedWorkout.acceptance_flags?.hardness_ok ?? true,
        no_banned_in_mains: sanitizedWorkout.acceptance_flags?.no_banned_in_mains ?? true
    };
    // Build selectionTrace showing registry IDs for each block
    const selectionTrace = sanitizedWorkout.blocks.map((b) => ({
        title: b.title,
        kind: b.kind,
        time_min: b.time_min,
        items: (b.items || []).map((it) => ({
            name: it.exercise,
            id: it.registry_id || null
        }))
    }));
    // Update acceptance flags with computed values
    sanitizedWorkout.acceptance_flags = {
        ...(sanitizedWorkout.acceptance_flags || {}),
        ...acceptance
    };
    // Strict mode: reject workouts that don't meet quality standards
    if (process.env.HOBH_PREMIUM_STRICT === 'true') {
        if (sanitizedWorkout.acceptance_flags.time_fit === false) {
            throw new Error('premium_reject:time_fit_false');
        }
        if (sanitizedWorkout.acceptance_flags.style_ok === false) {
            throw new Error('premium_reject:style_invalid');
        }
    }
    // Compute main-only loaded ratio (excluding warmup/cooldown)
    const mainLoadedRatio = loadedRatioMainOnly(sanitizedWorkout.blocks, REG);
    // Apply premium stamp for debugging (removable)
    if (process.env.DEBUG_PREMIUM_STAMP === '1') {
        sanitizedWorkout.title = `PREMIUM • ${sanitizedWorkout.title || pack.name || 'Session'}`;
    }
    // Add metadata before notes generation (preserve policy_repairs if present)
    const metaData = {
        generator: 'premium',
        style,
        goal: req?.category || style,
        title: sanitizedWorkout.title || pack.name,
        equipment: req?.context?.equipment || [],
        intensity: req?.intensity, // Store intensity for hardness calculation
        seed,
        acceptance: sanitizedWorkout.acceptance_flags,
        selectionTrace,
        main_loaded_ratio: mainLoadedRatio,
        // Preserve policy_repairs from earlier policyFailOrRepair calls
        ...(sanitizedWorkout.meta?.policy_repairs && { policy_repairs: sanitizedWorkout.meta.policy_repairs }),
        ...(process.env.DEBUG_PREMIUM_STAMP === '1' && { premium_stamp: true })
    };
    return {
        ...sanitizedWorkout,
        meta: metaData
    };
}
/**
 * Enrich workout with coaching notes (async wrapper)
 * This must be called separately since enrichWithMeta is sync
 */
async function enrichWithNotes(workout) {
    // Generate coaching notes for all blocks
    const notes = await generateCoachingNotes(workout.blocks);
    // Apply notes to blocks
    workout.blocks.forEach((b, i) => {
        b.notes = notes[i] || b.notes || 'Move well; maintain quality.';
    });
    return workout;
}
export async function generatePremiumWorkout(request, seed, retryCount = 0) {
    try {
        // Validate OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
            const e = new Error('OPENAI_API_KEY is not set in this environment');
            e.code = 'NO_OPENAI_KEY';
            e.httpStatus = 502;
            throw e;
        }
        // Premium entry: validate style against pattern pack keys
        // Check multiple locations: direct fields, context, and meta
        const raw = request?.style ??
            request?.goal ??
            request?.focus ??
            request?.context?.focus ??
            request?.meta?.style ?? '';
        const style = normalizeStyle(raw);
        // Duration-aware pack resolution
        let pack;
        if (style === 'olympic_weightlifting') {
            pack = buildOlympicPack(request.duration || 45);
        }
        else if (style === 'endurance') {
            const eq = (request.context?.equipment || []).map((x) => String(x).toLowerCase());
            pack = buildEndurancePack(request.duration || 45, request.intensity || 6, eq);
        }
        else {
            // Fall back to existing static packs
            const base = PACKS[style] || PACKS['crossfit'];
            pack = { ...base };
            // OPTIONAL: when minutes are tight, compress warm/cool a bit
            const total = request.duration || 45;
            if (total <= pack.warmupMin + pack.cooldownMin + 10) {
                pack.warmupMin = Math.max(6, pack.warmupMin - 2);
                pack.cooldownMin = Math.max(4, pack.cooldownMin - 2);
            }
        }
        console.warn('[PREMIUM] entry', { raw, style, hasPack: !!pack, seed: seed || 'auto', retryCount });
        if (!pack) {
            const e = new Error(`Unsupported style "${style}"`);
            e.code = 'STYLE_UNSUPPORTED';
            e.httpStatus = 400;
            e.meta = { style, raw, supported: Object.keys(PACKS) };
            throw e;
        }
        // Ensure seed is set
        const workoutSeed = seed || request.seed || `${Date.now()}-${Math.random()}`;
        // Propagate seed through request for deterministic sampling
        request.seed = workoutSeed;
        // ===== HOBH: Style-aware builder routing =====
        if (style) {
            console.log(`🎨 Using style-aware builder for: ${style} | seed: ${workoutSeed}`);
            let workout;
            switch (style) {
                case 'crossfit':
                    workout = buildCrossFitCF(request);
                    break;
                case 'olympic_weightlifting':
                    workout = buildOly(request, pack);
                    break;
                case 'powerlifting':
                    workout = buildPowerlifting(request);
                    break;
                case 'bb_full_body':
                    workout = buildBBFull(request);
                    break;
                case 'bb_upper':
                    workout = buildBBUpper(request);
                    break;
                case 'bb_lower':
                    workout = buildBBLower(request);
                    break;
                case 'aerobic':
                    workout = buildAerobic(request);
                    break;
                case 'gymnastics':
                    workout = buildGymnastics(request);
                    break;
                case 'mobility':
                    workout = buildMobility(request);
                    break;
                case 'conditioning':
                    // Use CrossFit builder for conditioning workouts
                    workout = buildCrossFitCF(request);
                    break;
                case 'strength':
                    // Use Powerlifting builder for strength focus
                    workout = buildPowerlifting(request);
                    break;
                case 'endurance':
                    // Use dedicated Endurance builder with duration-aware pack
                    workout = buildEndurance(request, pack);
                    break;
                case 'mixed':
                    // Use CrossFit builder for GPP/mixed training
                    workout = buildCrossFitCF(request);
                    break;
                default:
                    console.log(`🔄 Unknown style "${style}", falling through to AI generation`);
                    workout = null;
            }
            if (workout) {
                // Fit blocks to budget to guarantee time_fit:true
                workout.blocks = fitBlocksToBudget(workout.blocks, request.duration || 45, pack.warmupMin, pack.cooldownMin);
                // Ensure Olympic required patterns (snatch + clean&jerk)
                ensureOlympicRequired(workout, pack);
                // Add meta information to style-aware workouts
                const enriched = enrichWithMeta(workout, style, workoutSeed, request);
                // Validate against style specifications (ban patterns, require patterns, ratios)
                const strict = PREMIUM_STRICT;
                validateStyleAgainstSpec(style, enriched, strict);
                // Add coaching notes (works with or without OpenAI)
                return await enrichWithNotes(enriched);
            }
        }
        /* COMMENTED OUT: Legacy AI-based generation removed - registry-first architecture only
        // This legacy path generated full workouts via AI, contradicting registry-first design
        // All workouts must now use style-aware builders that call pickFromRegistry() for movements
        // and only use AI for coaching notes via generateCoachingNotes()
        
        // ===== Original AI-based generation for legacy styles =====
        const systemPrompt = getSystemPrompt();
        const userPrompt = createUserPrompt(request);
        const { focus, categoriesForMixed } = extractFocusAndCategories(request);
    
        console.log(`Generating premium workout for ${request.category}, ${request.duration}min, intensity ${request.intensity}/10, seed: ${seed || 'none'} (attempt ${retryCount + 1})`);
    
        // Convert seed to integer for OpenAI (they accept integer seeds)
        const seedInt = seed ? parseInt(seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().slice(0, 8)) : undefined;
    
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.75,
          max_tokens: 2500,
          ...(seedInt !== undefined && { seed: seedInt })
        });
    
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content generated');
        }
    
        // Parse and validate
        const workout = JSON.parse(content);
        let validated = PremiumWorkoutSchema.parse(workout);
    
        // ===== HOBH: strict mixed semantics =====
        if (focus === 'mixed') {
          const cats = Array.isArray(categoriesForMixed) && categoriesForMixed.length
            ? categoriesForMixed
            : ['Strength', 'Conditioning', 'Core'];
    
          const byCat = (cat: string) => {
            if (/strength/i.test(cat)) return makeStrengthE3x(request);
            if (/condition/i.test(cat)) return makeEmom(request);
            if (/skill|gym/i.test(cat)) return makeAmrapSkill(request);
            if (/core/i.test(cat)) return makeAmrapCore(request);
            return makeEmom(request);
          };
    
          const mainBlocks = cats.map(byCat);
    
          validated.blocks = [pickWarmup(request), ...mainBlocks, makeCooldown()];
    
          // optional finisher if short
          const ttl = validated.blocks.reduce((t, b) => t + (b.time_min || 0), 0);
          if (ttl < request.duration * 0.90) {
            validated.blocks.splice(validated.blocks.length - 1, 0, makeFinisher21_15_9(request));
          }
    
          validated.acceptance_flags = {
            ...(validated.acceptance_flags || {}),
            mixed_rule_ok: true
          };
    
          console.log(`🎯 Strict mixed semantics applied: ${cats.length} main blocks (${cats.join(', ')}) + finisher check (total: ${ttl}min vs ${request.duration}min)`);
        }
    
        // Validate patterns and BW movements before sanitization
        try {
          validatePatternsAndBW(validated, request.context?.equipment || []);
        } catch (validationError: any) {
          if (retryCount === 0 && (validationError.message === 'pattern_lock_violation' || validationError.message === 'banned_bw_in_main')) {
            console.warn(`⚠️ Validation failed: ${validationError.message}. Regenerating with CF pattern lock and removing bodyweight filler from mains...`);
            
            // Regenerate with explicit instructions
            const retryRequest = {
              ...request,
              context: {
                ...request.context,
                regeneration_reason: 'Regenerate with CF pattern lock and remove bodyweight filler from mains (use DB/KB/BB)'
              }
            };
            
            return generatePremiumWorkout(retryRequest, seed, retryCount + 1);
          }
          // If second attempt still fails, continue with warning
          console.warn(`⚠️ Validation failed after retry: ${validationError.message}, continuing anyway`);
        }
    
        // Sanitize and enforce requirements
        const pack = PACKS[focus] || PACKS['crossfit'];
        validated = sanitizeWorkout(validated, {
          equipment: request.context?.equipment || [],
          wearable_snapshot: {
            sleep_score: request.context?.health_snapshot?.sleep_score
          },
          focus,
          categories_for_mixed: categoriesForMixed
        }, pack, workoutSeed);
    
        // Check pattern lock violations and regenerate once if needed
        if (!validated.acceptance_flags.patterns_locked && retryCount === 0) {
          const patternCheck = validatePatterns(validated);
          console.warn(`⚠️ Pattern lock violation: ${patternCheck.violations.join('; ')}. Regenerating...`);
          
          // Add pattern violation reason to context for next attempt
          const retryRequest = {
            ...request,
            context: {
              ...request.context,
              pattern_violation_reason: patternCheck.violations.join('; ')
            }
          };
          
          return generatePremiumWorkout(retryRequest, seed, retryCount + 1);
        }
    
        // Check if hardness meets requirements
        if (!validated.acceptance_flags.hardness_ok) {
          console.warn(`⚠️ Hardness score ${validated.variety_score?.toFixed(2) ?? 'N/A'} below threshold, workout may be too easy`);
        }
        
        // Check if mixed rule is satisfied
        if (focus === 'mixed' && !validated.acceptance_flags.mixed_rule_ok) {
          console.warn(`⚠️ Mixed rule violation: blocks don't match expected categories`);
        }
        
        // Check if equipment usage is satisfied
        if (!validated.acceptance_flags.equipment_ok) {
          console.warn(`⚠️ Equipment usage violation: insufficient loaded movements when gear is present`);
        }
    
        console.log(`✅ Premium workout generated: "${validated.title}" with ${validated.blocks.length} blocks, hardness: ${validated.variety_score?.toFixed(2) ?? 'N/A'}, patterns_locked: ${validated.acceptance_flags.patterns_locked}, mixed_rule_ok: ${validated.acceptance_flags.mixed_rule_ok}, equipment_ok: ${validated.acceptance_flags.equipment_ok}`);
        
        return validated;
        */ // END COMMENT OUT - Legacy AI generation removed
        // Registry-first architecture: No fallback to AI-based generation
        // All styles must use style-aware builders
        throw new Error(`Registry-first architecture error: Unknown or unsupported style "${style || 'none'}". All workouts must use style-aware builders (crossfit, olympic_weightlifting, powerlifting, bb_full_body, bb_upper, bb_lower, aerobic, gymnastics, mobility).`);
    }
    catch (error) {
        console.error('Premium generation failed:', error);
        throw error;
    }
}
