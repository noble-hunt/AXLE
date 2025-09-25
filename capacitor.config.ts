import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.axle.app',
  appName: 'AXLE',
  webDir: 'dist',
  server: { 
    url: undefined, // For production builds
    androidScheme: 'https' // harmless on iOS
  }
};

export default config;