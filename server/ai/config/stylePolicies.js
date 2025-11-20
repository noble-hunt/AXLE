/**
 * Style-specific content policies
 * Enforces strict rules for each workout style to ensure quality and authenticity
 */
export const STYLE_POLICIES = {
    olympic_weightlifting: {
        allowed_categories: ['olympic_weightlifting'],
        required_any: [['olympic_snatch'], ['olympic_cleanjerk']], // Must have BOTH: a snatch AND a clean & jerk pattern
        banned_regex: [/db snatch/i, /thruster/i, /bear crawl/i, /star jump/i, /burpee/i, /mountain climber/i],
        require_loaded_ratio: 0.90,
        require_barbell_only: true
    },
    powerlifting: {
        allowed_categories: ['powerlifting'],
        required_any: [['squat'], ['bench'], ['hinge']],
        banned_regex: [/thruster/i, /burpee/i, /double under/i],
        require_loaded_ratio: 0.85
    },
    crossfit: {
        allowed_categories: ['crossfit'],
        banned_regex: [/wall sit/i, /star jump/i, /high knees/i, /jumping jacks/i],
        require_loaded_ratio: 0.60
    },
    bb_full_body: {
        allowed_categories: ['bodybuilding'],
        require_loaded_ratio: 0.70
    },
    bb_upper: {
        allowed_categories: ['bodybuilding'],
        require_loaded_ratio: 0.70
    },
    bb_lower: {
        allowed_categories: ['bodybuilding'],
        require_loaded_ratio: 0.70
    },
    aerobic: {
        allowed_categories: ['aerobic']
    },
    gymnastics: {
        allowed_categories: ['gymnastics']
    },
    mobility: {
        allowed_categories: ['mobility']
    }
};
