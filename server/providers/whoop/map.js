// server/providers/whoop/map.ts
import { format } from "date-fns";
/**
 * Safely extracts a number from a potentially nested object path
 */
function safeNumber(value) {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    return null;
}
/**
 * Safely rounds a number to nearest integer
 */
function safeRound(value) {
    return value !== null ? Math.round(value) : null;
}
/**
 * Maps WHOOP data to standardized HealthSnapshot format
 * Null-checks every nested field and never throws on missing keys
 */
export function toSnapshot(data, targetDate) {
    const date = targetDate ? format(targetDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    // Safely extract HRV (Heart Rate Variability) in milliseconds
    const hrv_ms = safeNumber(data.recovery?.score?.hrv_rmssd_milli) ||
        safeNumber(data.recovery?.hrv_rmssd_milli) ||
        null;
    // Safely extract resting heart rate
    const resting_hr_bpm = safeNumber(data.recovery?.score?.resting_heart_rate) ||
        safeNumber(data.recovery?.resting_heart_rate) ||
        null;
    // Safely extract sleep score (as percentage)
    const sleep_score = safeNumber(data.sleep?.score?.sleep_performance_percentage);
    // WHOOP doesn't track steps directly, so this remains null
    const steps = null;
    // Safely extract calories from cycle kilojoules (1 kJ ≈ 0.239 calories)
    const kilojoules = safeNumber(data.cycle?.score?.kilojoule);
    const calories = kilojoules ? safeRound(kilojoules * 0.239) : null;
    // WHOOP uses strain instead of traditional stress, so map to null
    // Could potentially map strain to stress scale, but keeping null for accuracy
    const stress_0_10 = null;
    return {
        provider: "Whoop",
        date,
        hrv_ms,
        resting_hr_bpm,
        sleep_score,
        steps,
        calories,
        stress_0_10,
        raw: {
            cycle: data.cycle || null,
            recovery: data.recovery || null,
            sleep: data.sleep || null,
            workouts: data.workouts || [],
        },
    };
}
/**
 * Creates a null snapshot for when no data is available
 */
export function createNullSnapshot(targetDate) {
    const date = targetDate ? format(targetDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    return {
        provider: "Whoop",
        date,
        hrv_ms: null,
        resting_hr_bpm: null,
        sleep_score: null,
        steps: null,
        calories: null,
        stress_0_10: null,
        raw: {
            cycle: null,
            recovery: null,
            sleep: null,
            workouts: [],
        },
    };
}
