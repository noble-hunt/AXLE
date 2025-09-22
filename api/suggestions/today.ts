import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, bearer } from '../_supabase'
import { createClient } from '@supabase/supabase-js'

// Import shared database connection and suggestion logic
// Note: We'll need to set up database connection for serverless
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { suggestedWorkouts } from '../../shared/schema'
import { eq, and } from 'drizzle-orm'

// Import suggestion logic
import { computeSuggestion } from '../../server/logic/suggestions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    const supa = admin()
    const token = bearer(req)
    const { data: userData, error: authErr } = await supa.auth.getUser(token)
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' })
    const userId = userData.user.id

    console.log(`🎯 Getting daily suggestion for user: ${userId}`)

    // Set up database connection for serverless
    const sql = neon(process.env.DATABASE_URL!)
    const db = drizzle(sql)

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Check if we already have a suggestion for today
    const existingSuggestion = await db
      .select()
      .from(suggestedWorkouts)
      .where(and(
        eq(suggestedWorkouts.userId, userId),
        eq(suggestedWorkouts.date, today)
      ))
      .limit(1)
      
    const suggestion = existingSuggestion[0] || null

    if (suggestion) {
      console.log(`✅ Returning existing suggestion for ${today}`)
      return res.status(200).json({
        ...suggestion,
        isExisting: true
      })
    }

    // Generate new suggestion using existing algorithm
    console.log(`🧠 Computing new suggestion for ${today}`)
    
    const suggestionResult = await computeSuggestion(userId, new Date())
    
    // Store the suggestion in the database
    const insertedSuggestion = await db
      .insert(suggestedWorkouts)
      .values({
        userId: userId,
        date: today,
        request: suggestionResult.request,
        rationale: suggestionResult.rationale,
        workoutId: null // Will be set when user generates the actual workout
      })
      .returning()
      
    if (!insertedSuggestion[0]) {
      console.error("Error inserting suggestion")
      return res.status(500).json({ message: "Failed to save suggestion" })
    }

    console.log(`✅ Generated and stored new suggestion with ID: ${insertedSuggestion[0].id}`)
    
    return res.status(200).json({
      ...insertedSuggestion[0],
      isExisting: false
    })

  } catch (error: any) {
    console.error('Error in /api/suggestions/today:', error)
    
    // Handle UUID validation errors
    if (error instanceof Error && error.message.includes('Invalid userId format')) {
      return res.status(400).json({ message: error.message })
    }
    
    return res.status(500).json({ 
      message: 'Failed to get daily suggestion',
      error: 'An internal error occurred while fetching suggestion data.'
    })
  }
}