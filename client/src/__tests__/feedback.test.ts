/**
 * Unit test for workout feedback data shape validation
 * Tests the feedback data structure and validation rules
 */

import { workoutFeedbackSchema } from "../../../shared/schema"
import type { WorkoutFeedback } from "../types"

// Simple test runner utility
function runTest(testName: string, testFn: () => void) {
  try {
    testFn()
    console.log(`✅ ${testName}`)
  } catch (error) {
    console.log(`❌ ${testName}`)
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Helper to assert equality
function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// Helper to assert validation passes
function assertValidationPasses(data: any, message?: string) {
  const result = workoutFeedbackSchema.safeParse(data)
  if (!result.success) {
    throw new Error(message || `Validation failed: ${result.error.message}`)
  }
  return result.data
}

// Helper to assert validation fails
function assertValidationFails(data: any, message?: string) {
  const result = workoutFeedbackSchema.safeParse(data)
  if (result.success) {
    throw new Error(message || `Validation should have failed but passed`)
  }
}

// Test valid feedback data shape
runTest("Valid feedback data passes validation", () => {
  const validFeedback = {
    difficulty: 7,
    satisfaction: 8,
    completedAt: new Date("2024-01-15T10:30:00Z")
  }
  
  const result = assertValidationPasses(validFeedback)
  assertEquals(result.difficulty, 7)
  assertEquals(result.satisfaction, 8)
  assertEquals(result.completedAt, validFeedback.completedAt)
})

// Test boundary values
runTest("Boundary values (1 and 10) are valid", () => {
  const minValues = {
    difficulty: 1,
    satisfaction: 1,
    completedAt: new Date()
  }
  assertValidationPasses(minValues, "Min values should be valid")
  
  const maxValues = {
    difficulty: 10,
    satisfaction: 10,
    completedAt: new Date()
  }
  assertValidationPasses(maxValues, "Max values should be valid")
})

// Test invalid difficulty values
runTest("Invalid difficulty values fail validation", () => {
  const invalidLow = {
    difficulty: 0,
    satisfaction: 5,
    completedAt: new Date()
  }
  assertValidationFails(invalidLow, "Difficulty 0 should fail")
  
  const invalidHigh = {
    difficulty: 11,
    satisfaction: 5,
    completedAt: new Date()
  }
  assertValidationFails(invalidHigh, "Difficulty 11 should fail")
})

// Test invalid satisfaction values
runTest("Invalid satisfaction values fail validation", () => {
  const invalidLow = {
    difficulty: 5,
    satisfaction: 0,
    completedAt: new Date()
  }
  assertValidationFails(invalidLow, "Satisfaction 0 should fail")
  
  const invalidHigh = {
    difficulty: 5,
    satisfaction: 11,
    completedAt: new Date()
  }
  assertValidationFails(invalidHigh, "Satisfaction 11 should fail")
})

// Test missing required fields
runTest("Missing required fields fail validation", () => {
  const missingDifficulty = {
    satisfaction: 5,
    completedAt: new Date()
  }
  assertValidationFails(missingDifficulty, "Missing difficulty should fail")
  
  const missingSatisfaction = {
    difficulty: 5,
    completedAt: new Date()
  }
  assertValidationFails(missingSatisfaction, "Missing satisfaction should fail")
  
  const missingCompletedAt = {
    difficulty: 5,
    satisfaction: 5
  }
  assertValidationFails(missingCompletedAt, "Missing completedAt should fail")
})

// Test type compatibility with WorkoutFeedback interface
runTest("Validated data matches TypeScript WorkoutFeedback interface", () => {
  const validData = {
    difficulty: 8,
    satisfaction: 9,
    completedAt: new Date("2024-01-15T10:30:00Z")
  }
  
  const validated = assertValidationPasses(validData)
  
  // This should compile without errors if types are aligned
  const feedback: WorkoutFeedback = validated
  
  assertEquals(feedback.difficulty, 8)
  assertEquals(feedback.satisfaction, 9)
  assertEquals(feedback.completedAt, validData.completedAt)
})

// Test realistic feedback scenarios
runTest("Realistic workout feedback scenarios", () => {
  // Easy workout, high satisfaction
  const easyGoodWorkout = {
    difficulty: 3,
    satisfaction: 9,
    completedAt: new Date()
  }
  assertValidationPasses(easyGoodWorkout, "Easy good workout should be valid")
  
  // Hard workout, low satisfaction  
  const hardPoorWorkout = {
    difficulty: 9,
    satisfaction: 2,
    completedAt: new Date()
  }
  assertValidationPasses(hardPoorWorkout, "Hard poor workout should be valid")
  
  // Moderate workout, moderate satisfaction
  const moderateWorkout = {
    difficulty: 5,
    satisfaction: 6,
    completedAt: new Date()
  }
  assertValidationPasses(moderateWorkout, "Moderate workout should be valid")
})

console.log("\n🧪 Workout Feedback Data Shape Tests Complete")

// Export for potential integration with other test runners
export {
  assertValidationPasses,
  assertValidationFails,
  assertEquals
}