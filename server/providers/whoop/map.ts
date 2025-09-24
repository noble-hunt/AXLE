// server/providers/whoop/map.ts
import { format } from "date-fns";

interface WhoopCycle {
  start?: string;
  end?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
  };
}

interface WhoopRecovery {
  cycle_id?: string;
  sleep_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  score?: {
    user_calibrating?: boolean;
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
  };
  hrv_rmssd_milli?: number;
  resting_heart_rate?: number;
}

interface WhoopSleep {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  start?: string;
  end?: string;
  timezone_offset?: string;
  nap?: boolean;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_no_data_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      sleep_cycle_count?: number;
      disturbance_count?: number;
    };
    sleep_needed?: {
      baseline_milli?: number;
      need_from_sleep_debt_milli?: number;
      need_from_recent_strain_milli?: number;
      need_from_recent_nap_milli?: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_efficiency_percentage?: number;
  };
}

interface WhoopWorkout {
  id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  start?: string;
  end?: string;
  timezone_offset?: string;
  sport_id?: number;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
    percent_recorded?: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
    altitude_change_meter?: number;
    zone_duration?: {
      zone_zero_milli?: number;
      zone_one_milli?: number;
      zone_two_milli?: number;
      zone_three_milli?: number;
      zone_four_milli?: number;
      zone_five_milli?: number;
    };
  };
}

interface WhoopData {
  cycle?: WhoopCycle | null;
  recovery?: WhoopRecovery | null;
  sleep?: WhoopSleep | null;
  workouts?: WhoopWorkout[] | null;
}

export interface HealthSnapshot {
  provider: string;
  date: string;
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  sleep_score: number | null;
  steps: number | null;
  calories: number | null;
  stress_0_10: number | null;
  raw: any;
}

/**
 * Safely extracts a number from a potentially nested object path
 */
function safeNumber(value: any): number | null {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  return null;
}

/**
 * Safely rounds a number to nearest integer
 */
function safeRound(value: number | null): number | null {
  return value !== null ? Math.round(value) : null;
}

/**
 * Maps WHOOP data to standardized HealthSnapshot format
 * Null-checks every nested field and never throws on missing keys
 */
export function toSnapshot(data: WhoopData, targetDate?: Date): HealthSnapshot {
  const date = targetDate ? format(targetDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  
  // Safely extract HRV (Heart Rate Variability) in milliseconds
  const hrv_ms = 
    safeNumber(data.recovery?.score?.hrv_rmssd_milli) ||
    safeNumber(data.recovery?.hrv_rmssd_milli) ||
    null;

  // Safely extract resting heart rate
  const resting_hr_bpm = 
    safeNumber(data.recovery?.score?.resting_heart_rate) ||
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
export function createNullSnapshot(targetDate?: Date): HealthSnapshot {
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