import { HealthProvider, HealthSnapshot } from './types';

export class FitbitHealthProvider implements HealthProvider {
  id = "Fitbit" as const;

  hasConfig(): boolean {
    return !!(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
  }

  async authStart(userId: string): Promise<{ redirectUrl: string }> {
    // TODO: Implement Fitbit OAuth flow
    throw new Error("Fitbit provider not yet implemented");
  }

  async authCallback(params: Record<string, string>, userId: string): Promise<void> {
    // TODO: Handle Fitbit OAuth callback
    throw new Error("Fitbit provider not yet implemented");
  }

  async fetchLatest(userId: string): Promise<HealthSnapshot> {
    // TODO: Fetch data from Fitbit API
    throw new Error("Fitbit provider not yet implemented");
  }
}