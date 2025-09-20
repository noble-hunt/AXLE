import { HealthProvider, HealthSnapshot } from './types';

export class OuraHealthProvider implements HealthProvider {
  id = "Oura" as const;

  hasConfig(): boolean {
    return !!(process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET);
  }

  async authStart(userId: string): Promise<{ redirectUrl: string }> {
    // TODO: Implement Oura OAuth flow
    throw new Error("Oura provider not yet implemented");
  }

  async authCallback(params: Record<string, string>, userId: string): Promise<void> {
    // TODO: Handle Oura OAuth callback
    throw new Error("Oura provider not yet implemented");
  }

  async fetchLatest(userId: string): Promise<HealthSnapshot> {
    // TODO: Fetch data from Oura API
    throw new Error("Oura provider not yet implemented");
  }
}