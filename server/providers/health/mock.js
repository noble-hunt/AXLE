import { storeEncryptedTokens } from '../../dal/tokens';
export class MockHealthProvider {
    constructor() {
        this.id = "Mock";
    }
    hasConfig() {
        return true; // Mock always works
    }
    async authCallback(params, userId) {
        // For Mock provider, we simulate storing a fake token
        await storeEncryptedTokens(userId, this.id, {
            accessToken: `mock_access_token_${Date.now()}`,
            refreshToken: `mock_refresh_token_${Date.now()}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            scope: 'read_health_data',
        });
    }
    async fetchLatest(userId) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        // Generate plausible baseline health metrics
        const baseHrv = 30 + Math.random() * 40; // 30-70ms range
        const baseRestingHR = 55 + Math.random() * 20; // 55-75 bpm
        const baseSleepScore = 70 + Math.random() * 25; // 70-95 range
        const baseSteps = 5000 + Math.random() * 8000; // 5k-13k steps
        const baseCalories = 1800 + Math.random() * 800; // 1800-2600 calories
        // TODO: In a real implementation, we would:
        // 1. Fetch user's recent workouts to assess training load
        // 2. Adjust metrics based on workout intensity and frequency
        // 3. Consider recovery patterns from previous days
        // 4. Apply realistic day-to-day variation
        // For now, generate with some realistic variation
        const variation = 0.1; // 10% daily variation
        const hrv = Math.round(baseHrv * (1 + (Math.random() - 0.5) * variation * 2));
        const restingHR = Math.round(baseRestingHR * (1 + (Math.random() - 0.5) * variation));
        const sleepScore = Math.round(baseSleepScore * (1 + (Math.random() - 0.5) * variation));
        const steps = Math.round(baseSteps * (1 + (Math.random() - 0.5) * variation));
        const calories = Math.round(baseCalories * (1 + (Math.random() - 0.5) * variation));
        // Allow stress to be influenced by query parameters for testing
        // In a real scenario, this would be determined by various factors
        let stress = Math.round(3 + Math.random() * 4); // 3-7 range normally
        // Check if we should simulate high stress (for testing purposes)
        // This would typically come from request context or testing flags
        const simulateHighStress = process.env.NODE_ENV === 'development' && Math.random() < 0.2;
        if (simulateHighStress) {
            stress = Math.round(7 + Math.random() * 3); // 7-10 for high stress
        }
        return {
            date: today,
            hrv,
            restingHR,
            sleepScore,
            stress,
            steps,
            calories,
        };
    }
}
