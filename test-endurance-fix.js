/**
 * Test script to verify endurance workouts generate with distance-based cardio
 * after fixing the double normalization bug
 */

const testPayloads = [
  {
    name: "Endurance with style field",
    payload: {
      style: "endurance",
      minutes: 30,
      intensity: 7,
      equipment: ["rower", "dumbbells"],
      seed: { userHash: "test", day: "20251020", nonce: 1 }
    }
  },
  {
    name: "Aerobic with goal field",
    payload: {
      goal: "aerobic",
      minutes: 25,
      intensity: 5,
      equipment: ["bike", "kettlebells"],
      seed: { userHash: "test", day: "20251020", nonce: 2 }
    }
  },
  {
    name: "CrossFit for comparison",
    payload: {
      style: "crossfit",
      minutes: 20,
      intensity: 8,
      equipment: ["barbell", "rower"],
      seed: { userHash: "test", day: "20251020", nonce: 3 }
    }
  }
];

console.log("Testing workout generation after double normalization fix...\n");

async function testWorkout(test) {
  try {
    const response = await fetch("http://localhost:5000/api/workouts/simulate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": "connect.sid=test"
      },
      body: JSON.stringify(test.payload)
    });

    if (response.status === 401) {
      console.log(`❌ ${test.name}: Auth required (expected in this test)`);
      return;
    }

    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ ${test.name}: ${response.status} - ${data.message || JSON.stringify(data)}`);
      return;
    }

    const workout = data.workout;
    const meta = data.meta;
    
    // Check for distance-based cardio
    const hasDistanceCardio = workout.sets?.some(set => 
      set.scheme && set.scheme.distance_m > 0
    );
    
    const cardioExercises = workout.sets?.filter(set => 
      set.scheme && set.scheme.distance_m > 0
    ).map(set => `${set.exercise} - ${set.scheme.distance_m}m`);

    console.log(`\n✅ ${test.name}:`);
    console.log(`   Style: ${meta.style || 'unknown'}`);
    console.log(`   Generator: ${meta.generator || 'unknown'}`);
    console.log(`   Workout Name: ${workout.name}`);
    console.log(`   Has distance-based cardio: ${hasDistanceCardio ? 'YES' : 'NO'}`);
    if (hasDistanceCardio) {
      console.log(`   Cardio stations:`);
      cardioExercises.forEach(ex => console.log(`     - ${ex}`));
    }
  } catch (error) {
    console.log(`❌ ${test.name}: ${error.message}`);
  }
}

// Run tests
(async () => {
  for (const test of testPayloads) {
    await testWorkout(test);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between requests
  }
  console.log("\n✅ Test complete!");
})();
