/**
 * Workout Critic & Repair System
 *
 * Acts as a QA coach to score and improve workout drafts based on:
 * - Safety & constraints (40%)
 * - Recovery fit (20%)
 * - Goal & category alignment (20%)
 * - Time & intensity precision (10%)
 * - Variety & movement balance (10%)
 */
import OpenAI from 'openai';
import { WorkoutSchema } from '../../client/src/ai/schemas';
// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY,
    dangerouslyAllowBrowser: process.env.NODE_ENV === 'test'
});
/**
 * Critique and repair a workout draft using AI QA coach
 */
export async function critiqueAndRepair(workout, context) {
    try {
        // Build critic prompt
        const criticPrompt = buildCriticPrompt(workout, context);
        // Get critique from AI
        const criticResponse = await callCriticModel(criticPrompt);
        // Apply patch if needed
        let finalWorkout = workout;
        let wasPatched = false;
        if (criticResponse.patch) {
            finalWorkout = deepMergeWorkout(workout, criticResponse.patch);
            // Re-validate patched workout
            const validation = WorkoutSchema.safeParse(finalWorkout);
            if (!validation.success) {
                console.warn('Critic patch created invalid workout, using original');
                finalWorkout = workout;
            }
            else {
                wasPatched = true;
            }
        }
        return {
            workout: finalWorkout,
            score: criticResponse.score,
            issues: criticResponse.issues,
            wasPatched
        };
    }
    catch (error) {
        console.warn('Critic failed, using original workout:', error);
        return {
            workout,
            score: 75, // Default passing score
            issues: ['Critic system unavailable'],
            wasPatched: false
        };
    }
}
/**
 * Build comprehensive critic prompt
 */
function buildCriticPrompt(workout, context) {
    const { request } = context;
    return `You are AXLE QA coach. Score this workout draft 0–100 on these weighted criteria:

SCORING CRITERIA (weighted):
1) Safety & constraints (injuries/equipment) – 40%
   - Are movements safe for user's injury history?
   - Does equipment match what's available?
   - Are load prescriptions reasonable?
   - Any contraindicated combinations?

2) Recovery fit (yesterday/week + health snapshot) – 20%
   - Does intensity match health indicators?
   - Appropriate for recent training load?
   - Respects yesterday's session type?
   - Accounts for cumulative fatigue?

3) Goal & category alignment – 20%
   - Movements match declared category?
   - Programming supports stated goals?
   - Appropriate volume/intensity for objectives?
   - Logical block progression?

4) Time & intensity precision – 10%
   - Block durations sum within ±10% of target?
   - Intensity mapping accurate for category?
   - Realistic time estimates?
   - Proper rest intervals?

5) Variety & movement balance – 10%
   - Appropriate movement diversity?
   - Balanced muscle groups?
   - Avoids excessive repetition?
   - Interesting but practical?

WORKOUT TO REVIEW:
${JSON.stringify(workout, null, 2)}

CONTEXT:
- Target: ${request.category}, ${request.duration}min, ${request.intensity}/10 intensity
- Equipment: ${request.context?.equipment?.join(', ') || 'none'}
- Constraints: ${request.context?.constraints?.join(', ') || 'none'}
- Goals: ${request.context?.goals?.join(', ') || 'general fitness'}
${request.context?.health_snapshot ? `- Health: HRV ${request.context.health_snapshot.hrv}, RHR ${request.context.health_snapshot.resting_hr}, Sleep ${request.context.health_snapshot.sleep_score}${request.context.health_snapshot.stress_flag ? ', STRESSED' : ''}` : ''}
${request.context?.yesterday ? `- Yesterday: ${request.context.yesterday.category} (${request.context.yesterday.intensity}/10, ${request.context.yesterday.type})` : ''}

RESPONSE FORMAT (JSON only):
{
  "score": number (0-100),
  "issues": string[] (specific problems found),
  "patch": Partial<Workout> | null (minimal fixes, or null if score ≥80)
}

PATCH RULES:
- Only if score <80
- Minimal changes that address highest-impact issues
- Keep duration within ±10% of ${request.duration}min
- Preserve original category (${request.category}) and core intent
- Focus on safety and recovery fit first`;
}
/**
 * Call OpenAI for workout critique
 */
async function callCriticModel(prompt) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: 'You are a precise workout critic. Respond only with valid JSON in the exact format specified.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.3, // Lower temperature for more consistent critiques
        max_tokens: 2000
    });
    const response = completion.choices[0]?.message?.content;
    if (!response) {
        throw new Error('No response from critic model');
    }
    // Parse and validate critic response
    try {
        // Extract JSON from potential markdown fenced blocks
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.slice(7);
        }
        if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.slice(3);
        }
        if (cleanResponse.endsWith('```')) {
            cleanResponse = cleanResponse.slice(0, -3);
        }
        const parsed = JSON.parse(cleanResponse.trim());
        // Validate response structure
        if (typeof parsed.score !== 'number' ||
            !Array.isArray(parsed.issues) ||
            (parsed.patch !== null && typeof parsed.patch !== 'object')) {
            throw new Error('Invalid critic response format');
        }
        return parsed;
    }
    catch (error) {
        throw new Error(`Failed to parse critic response: ${error}`);
    }
}
/**
 * Deep merge patch into workout object
 */
function deepMergeWorkout(original, patch) {
    const result = { ...original };
    for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) {
            continue;
        }
        if (key === 'blocks' && Array.isArray(value)) {
            // Handle block-level patches - replace entire blocks array
            result.blocks = value;
        }
        else if (key === 'intensity_1_to_10' && typeof value === 'number') {
            result.intensity_1_to_10 = value;
        }
        else if (key === 'name' && typeof value === 'string') {
            result.name = value;
        }
        else if (key === 'description' && typeof value === 'string') {
            result.description = value;
        }
        else if (key === 'category') {
            result.category = value;
            // duration_min is calculated from blocks, not directly set
        }
        // Add other specific properties as needed
    }
    return result;
}
