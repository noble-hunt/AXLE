import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, userClient, bearer, validateEnvForUser } from '../_supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    // Validate environment variables
    validateEnvForUser()
    
    const adminClient = admin()
    const token = bearer(req)
    const { data: userData, error: authErr } = await adminClient.auth.getUser(token)
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' })
    const userId = userData.user.id

    // Parse request body
    const { regenerate = false } = (req.body ?? {}) as { regenerate?: boolean }

    console.log(`🎯 ${regenerate ? 'Regenerating suggestion' : 'Generating workout from suggestion'} for user: ${userId}`)

    // Use user client for RLS
    const supa = userClient(token)

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    
    if (regenerate) {
      // Regenerate suggestion logic (simplified version for serverless)
      console.log(`🔄 Regenerating suggestion for ${today}`)
      
      // Fetch recent workouts for suggestion logic
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: recentWorkouts, error: workoutsError } = await supa
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (workoutsError) {
        console.error('Failed to fetch workouts:', workoutsError)
        return res.status(500).json({ message: 'Failed to fetch workout history' })
      }

      // Simplified suggestion generation
      const lastWorkout = recentWorkouts?.[0]
      let category = 'Cardio'
      let intensity = 6
      let duration = 35
      
      const rationale: string[] = []
      
      if (lastWorkout && lastWorkout.request) {
        const lastCategory = lastWorkout.request.category
        // Simple alternating logic
        if (lastCategory === 'Cardio') {
          category = 'Strength'
          rationale.push('→ Strength training to complement yesterday\'s cardio')
        } else if (lastCategory === 'Strength' || lastCategory === 'Powerlifting') {
          category = 'Cardio'
          rationale.push('→ Recovery cardio after strength training')
        } else {
          category = 'Cardio'
          rationale.push('→ Recovery cardio after high-intensity session')
        }
        rationale.push(`Last workout: ${lastWorkout.title} (${lastCategory})`)
      } else {
        rationale.push('No recent workout history')
      }

      const suggestionRequest = {
        category,
        intensity,
        duration
      }

      const suggestionRationale = {
        rulesApplied: rationale,
        scores: {
          recency: lastWorkout ? 1 : 0,
          weeklyBalance: 0.5,
          monthlyBalance: 0.5,
          fatigue: 0.3,
          novelty: 0.7
        }
      }

      // Check if suggestion exists, then update or insert
      const { data: existingSuggestion, error: fetchError } = await supa
        .from('suggested_workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .limit(1)
        .single()

      let updatedSuggestion
      if (existingSuggestion && !fetchError) {
        // Update existing suggestion
        const { data: updated, error: updateError } = await supa
          .from('suggested_workouts')
          .update({
            request: suggestionRequest,
            rationale: suggestionRationale,
            workout_id: null // Reset workout link
          })
          .eq('id', existingSuggestion.id)
          .select()
          .single()

        if (updateError || !updated) {
          console.error('Failed to update suggestion:', updateError)
          return res.status(500).json({ message: 'Failed to regenerate suggestion' })
        }
        updatedSuggestion = updated
      } else {
        // Create new suggestion
        const { data: inserted, error: insertError } = await supa
          .from('suggested_workouts')
          .insert({
            user_id: userId,
            date: today,
            request: suggestionRequest,
            rationale: suggestionRationale,
            workout_id: null
          })
          .select()
          .single()

        if (insertError || !inserted) {
          console.error('Failed to insert suggestion:', insertError)
          return res.status(500).json({ message: 'Failed to regenerate suggestion' })
        }
        updatedSuggestion = inserted
      }

      console.log(`✅ Regenerated suggestion with ID: ${updatedSuggestion.id}`)
      
      // Transform to camelCase and return just the suggestion
      const transformedSuggestion = {
        id: updatedSuggestion.id,
        userId: updatedSuggestion.user_id,
        date: updatedSuggestion.date,
        request: updatedSuggestion.request,
        rationale: updatedSuggestion.rationale,
        workoutId: updatedSuggestion.workout_id,
        createdAt: updatedSuggestion.created_at
      }
      
      return res.status(200).json({
        suggestion: transformedSuggestion
      })
    }

    // Get existing suggestion for workout generation
    const { data: suggestion, error: suggestionError } = await supa
      .from('suggested_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1)
      .single()

    if (suggestionError || !suggestion) {
      console.error('No suggestion found for today:', suggestionError)
      return res.status(404).json({ 
        message: 'No suggestion found for today. Please get today\'s suggestion first.' 
      })
    }

    // Generate and persist actual workout
    const workoutData = {
      title: `${suggestion.request.category} Workout`,
      request: suggestion.request,
      sets: {
        warmup: [
          { exercise: "Light Cardio", duration: "5 min" },
          { exercise: "Dynamic Stretching", duration: "5 min" }
        ],
        main: [
          { 
            exercise: suggestion.request.category === 'Cardio' ? 'Running' : 'Compound Movement',
            sets: Math.ceil(suggestion.request.intensity / 2),
            reps: suggestion.request.category === 'Cardio' ? 'n/a' : '8-12',
            duration: suggestion.request.category === 'Cardio' ? `${suggestion.request.duration} min` : undefined
          }
        ],
        cooldown: [
          { exercise: "Cool Down", duration: "5 min" }
        ]
      },
      notes: `Generated from suggestion: ${suggestion.rationale?.rulesApplied?.[0] || 'AI-generated workout'}`,
      completed: false
    }

    // Insert workout into database
    const { data: insertedWorkout, error: workoutError } = await supa
      .from('workouts')
      .insert({
        user_id: userId,
        title: workoutData.title,
        request: workoutData.request,
        sets: workoutData.sets,
        notes: workoutData.notes,
        completed: workoutData.completed
      })
      .select()
      .single()

    if (workoutError || !insertedWorkout) {
      console.error('Failed to insert workout:', workoutError)
      return res.status(500).json({ message: 'Failed to generate workout' })
    }

    // Update suggestion to link to the workout
    const { data: updatedSuggestion, error: updateError } = await supa
      .from('suggested_workouts')
      .update({ workout_id: insertedWorkout.id })
      .eq('id', suggestion.id)
      .select()
      .single()

    if (updateError || !updatedSuggestion) {
      console.error('Failed to update suggestion:', updateError)
      return res.status(500).json({ message: 'Failed to link workout to suggestion' })
    }

    console.log(`✅ Generated workout with ID: ${insertedWorkout.id} and linked to suggestion ${suggestion.id}`)
    
    // Transform to camelCase to match Express API response
    const transformedSuggestion = {
      id: updatedSuggestion.id,
      userId: updatedSuggestion.user_id,
      date: updatedSuggestion.date,
      request: updatedSuggestion.request,
      rationale: updatedSuggestion.rationale,
      workoutId: updatedSuggestion.workout_id,
      createdAt: updatedSuggestion.created_at
    }

    const transformedWorkout = {
      id: insertedWorkout.id,
      title: insertedWorkout.title,
      request: insertedWorkout.request,
      sets: insertedWorkout.sets,
      notes: insertedWorkout.notes,
      completed: insertedWorkout.completed,
      userId: insertedWorkout.user_id,
      createdAt: insertedWorkout.created_at
    }
    
    return res.status(200).json({
      suggestion: transformedSuggestion,
      workout: transformedWorkout
    })

  } catch (error: any) {
    console.error('Error in /api/suggestions/generate:', error)
    
    // Handle environment validation errors
    if (error instanceof Error && error.message.includes('Missing required environment variables')) {
      return res.status(500).json({ message: 'Server configuration error' })
    }
    
    return res.status(500).json({ 
      message: 'Failed to generate workout',
      error: 'An internal error occurred while generating workout.'
    })
  }
}