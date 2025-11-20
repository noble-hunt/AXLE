/**
 * Shared API endpoint constants to prevent client/server drift
 * Import these constants in both client and server code to ensure consistency
 */
export const API_ENDPOINTS = {
    // Workout suggestion endpoints
    WORKOUTS_SUGGEST_TODAY: '/api/workouts/suggest/today',
    WORKOUTS_SUGGEST_TODAY_START: '/api/workouts/suggest/today/start',
    // Legacy endpoints (for reference and testing)
    SUGGESTIONS_TODAY: '/api/suggestions/today',
    // Health check endpoint
    HEALTH: '/api/healthz',
};
