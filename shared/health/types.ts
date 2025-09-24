export type AxleScores = {
  axle_health_score?: number;        // 0-100
  vitality_score?: number;           // 0-100
  performance_potential?: number;    // 0-100
  circadian_alignment?: number;      // 0-100
  energy_systems_balance?: number;   // 0-100
};

export type ProviderMetrics = {
  hrv?: number | null;               // ms
  resting_hr?: number | null;        // bpm
  sleep_score?: number | null;       // 0-100
  fatigue_score?: number | null;     // 0-100 (our existing calc)
};

export type WeatherSnapshot = {
  lat?: number; lon?: number; tz?: string;
  sunrise?: string; sunset?: string;
  uv_index?: number | null;          // 0-11+
  aqi?: number | null;               // 0-500
  temp_c?: number | null;
};

export type MetricsEnvelope = {
  provider: ProviderMetrics;
  axle: AxleScores;
  weather?: WeatherSnapshot;
  // keep any existing fields (steps, calories, etc.) untouched
};

export type HealthReport = {
  id: string;
  user_id: string;
  date: string;            // YYYY-MM-DD
  metrics: MetricsEnvelope;
};