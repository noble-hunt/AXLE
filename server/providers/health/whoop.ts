import { HealthProvider, HealthSnapshot } from './types';

export class WhoopHealthProvider implements HealthProvider {
  id = "Whoop" as const;

  hasConfig(): boolean {
    return !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
  }

  async authStart(userId: string): Promise<{ redirectUrl: string }> {
    // TODO: Implement Whoop OAuth flow
    throw new Error("Whoop provider not yet implemented");
  }

  async authCallback(params: Record<string, string>, userId: string): Promise<void> {
    // TODO: Handle Whoop OAuth callback
    throw new Error("Whoop provider not yet implemented");
  }

  async fetchLatest(userId: string): Promise<HealthSnapshot> {
    // TODO: Fetch data from Whoop API
    throw new Error("Whoop provider not yet implemented");
  }
}