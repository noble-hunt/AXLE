import { HealthProvider, HealthSnapshot } from './types';

export class GarminHealthProvider implements HealthProvider {
  id = "Garmin" as const;

  hasConfig(): boolean {
    return !!(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET);
  }

  async authStart(userId: string): Promise<{ redirectUrl: string }> {
    // TODO: Implement Garmin OAuth flow
    throw new Error("Garmin provider not yet implemented");
  }

  async authCallback(params: Record<string, string>, userId: string): Promise<void> {
    // TODO: Handle Garmin OAuth callback
    throw new Error("Garmin provider not yet implemented");
  }

  async fetchLatest(userId: string): Promise<HealthSnapshot> {
    // TODO: Fetch data from Garmin API
    throw new Error("Garmin provider not yet implemented");
  }
}