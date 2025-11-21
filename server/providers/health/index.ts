import type { HealthProvider } from './types.js';
import { MockHealthProvider } from './mock.js';
import { OuraHealthProvider } from './oura.js';
import { FitbitHealthProvider } from './fitbit.js';
import { WhoopHealthProvider } from './whoop.js';
import { GarminHealthProvider } from './garmin.js';

export function getProviderRegistry(): Record<string, HealthProvider> {
  const hasOura = !!(process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET);
  const hasFitbit = !!(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
  const hasWhoop = !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
  const hasGarmin = !!(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET);

  const reg: Record<string, HealthProvider> = {
    Mock: new MockHealthProvider(),
  };

  if (hasOura) reg['Oura'] = new OuraHealthProvider();
  if (hasFitbit) reg['Fitbit'] = new FitbitHealthProvider();
  if (hasWhoop) reg['Whoop'] = new WhoopHealthProvider();
  if (hasGarmin) reg['Garmin'] = new GarminHealthProvider();

  return reg;
}

export function listAvailableProviders() {
  const reg = getProviderRegistry();
  const allProviders = ['Mock', 'Fitbit', 'Whoop', 'Oura', 'Garmin'];
  
  return allProviders.map(id => {
    const provider = reg[id];
    return {
      id,
      available: !!provider,
      hasConfig: provider?.hasConfig() || false,
    };
  });
}