export const garmin = {
  clientId: process.env.GARMIN_CLIENT_ID || "",
  clientSecret: process.env.GARMIN_CLIENT_SECRET || "",
  redirectUrl: process.env.GARMIN_REDIRECT_URL || "",
};

export const isGarminConfigured = () => !!(garmin.clientId && garmin.clientSecret && garmin.redirectUrl);