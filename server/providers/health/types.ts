export type HealthSnapshot = {
  date: string;                 // YYYY-MM-DD
  hrv?: number | null;          // ms
  restingHR?: number | null;    // bpm
  sleepScore?: number | null;   // 0-100
  stress?: number | null;       // 0-10
  steps?: number | null;
  calories?: number | null;
  raw?: Record<string, unknown>; // Full raw data from provider
};

export interface HealthProvider {
  id: "Mock" | "Fitbit" | "Whoop" | "Oura" | "Garmin" | "AppleHealth";
  hasConfig(): boolean;
  authStart?(userId: string): Promise<{ redirectUrl: string }>;
  authCallback?(params: Record<string, string>, userId: string): Promise<void>;
  fetchLatest?(userId: string): Promise<HealthSnapshot>;
}