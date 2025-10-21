import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, userClient, bearer, validateEnvForUser } from '../../lib/api-helpers/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    // Validate environment variables
    validateEnvForUser()
    
    const adminClient = admin()
    const token = bearer(req)
    const { data: userData, error: authErr } = await adminClient.auth.getUser(token)
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' })
    const userId = userData.user.id

    console.log(`🎯 Getting daily suggestion for user: ${userId}`)

    // Use user client for RLS
    const supa = userClient(token)

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Check if we already have a suggestion for today using Supabase with RLS
    const { data: existingSuggestion, error: fetchError } = await supa
      .from('suggested_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1)
      .single()

    if (existingSuggestion && !fetchError) {
      console.log(`✅ Returning existing suggestion for ${today}`)
      // Transform to camelCase to match Express API response
      const transformedSuggestion = {
        id: existingSuggestion.id,
        userId: existingSuggestion.user_id,
        date: existingSuggestion.date,
        request: existingSuggestion.request,
        rationale: existingSuggestion.rationale,
        workoutId: existingSuggestion.workout_id,
        createdAt: existingSuggestion.created_at,
        isExisting: true
      }
      return res.status(200).json(transformedSuggestion)
    }

    // Generate new suggestion - simplified version for serverless
    console.log(`🧠 Computing new suggestion for ${today}`)
    
    // Fetch recent workouts using Supabase
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

    // Fetch latest health report
    const { data: healthReport, error: healthError } = await supa
      .from('health_reports')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    // Simple suggestion logic for serverless
    const lastWorkout = recentWorkouts?.[0]
    const categories = ['Cardio', 'Strength', 'CrossFit', 'HIIT', 'Powerlifting']
    let category = 'Cardio' // Default fallback
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
      
      rationale.push(`Yesterday: ${lastWorkout.title} (${lastCategory})`)
    } else {
      rationale.push('No recent workout history')
    }

    // Health-based adjustments
    if (healthReport && healthReport.metrics) {
      const metrics = healthReport.metrics as any
      if (metrics.sleep_score && metrics.sleep_score < 60) {
        intensity = Math.max(3, intensity - 2)
        duration = Math.max(20, duration * 0.8)
        rationale.push(`Poor sleep (${metrics.sleep_score}%) → reduce intensity and duration`)
      } else if (metrics.sleep_score && metrics.sleep_score > 85) {
        intensity = Math.min(8, intensity + 1)
        rationale.push(`Excellent sleep (${metrics.sleep_score}%) → increase intensity`)
      }
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
    
    // Store the suggestion in the database using Supabase with RLS
    const { data: insertedSuggestion, error: insertError } = await supa
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
      
    if (insertError || !insertedSuggestion) {
      console.error("Error inserting suggestion:", insertError)
      return res.status(500).json({ message: "Failed to save suggestion" })
    }

    console.log(`✅ Generated and stored new suggestion with ID: ${insertedSuggestion.id}`)
    
    // Transform to camelCase to match Express API response
    const transformedSuggestion = {
      id: insertedSuggestion.id,
      userId: insertedSuggestion.user_id,
      date: insertedSuggestion.date,
      request: insertedSuggestion.request,
      rationale: insertedSuggestion.rationale,
      workoutId: insertedSuggestion.workout_id,
      createdAt: insertedSuggestion.created_at,
      isExisting: false
    }
    
    return res.status(200).json(transformedSuggestion)

  } catch (error: any) {
    console.error('Error in /api/suggestions/today:', error)
    
    // Handle environment validation errors
    if (error instanceof Error && error.message.includes('Missing required environment variables')) {
      return res.status(500).json({ message: 'Server configuration error' })
    }
    
    return res.status(500).json({ 
      message: 'Failed to get daily suggestion',
      error: 'An internal error occurred while fetching suggestion data.'
    })
  }
}