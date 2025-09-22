import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, bearer } from '../_supabase'

// Import database connection and groups logic
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { groups, groupMembers } from '../../shared/schema'
import { eq, and, sql } from 'drizzle-orm'

// Import groups DAL functions
import { createGroup, getUserGroups } from '../../server/dal/groups'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  
  try {
    const supa = admin()
    const token = bearer(req)
    const { data: userData, error: authErr } = await supa.auth.getUser(token)
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' })
    const userId = userData.user.id

    // Set up database connection for serverless
    const sql_conn = neon(process.env.DATABASE_URL!)
    const db = drizzle(sql_conn)

    if (req.method === 'GET') {
      console.log(`🔍 Fetching groups for user: ${userId}`)
      
      try {
        // Use the existing DAL function
        const userGroups = await getUserGroups(userId)
        return res.status(200).json(userGroups || [])
      } catch (error) {
        console.error('Failed to fetch user groups:', error)
        return res.status(500).json({ message: 'Unable to fetch your groups' })
      }
    }

    if (req.method === 'POST') {
      console.log(`🎯 Creating group for user: ${userId}`)
      
      const { name, description, isPublic, photoUrl } = (req.body ?? {}) as { 
        name?: string
        description?: string
        isPublic?: boolean
        photoUrl?: string 
      }
      
      if (!name) return res.status(400).json({ message: 'name is required' })
      
      try {
        // Use the existing DAL function
        const newGroup = await createGroup(userId, {
          name,
          description,
          isPublic: isPublic ?? false,
          photoUrl
        })
        
        console.log(`✅ Created group: ${newGroup.id}`)
        return res.status(201).json(newGroup)
      } catch (error) {
        console.error('Failed to create group:', error)
        return res.status(500).json({ message: 'Failed to create group' })
      }
    }

    return res.status(405).json({ message: 'Method Not Allowed' })
    
  } catch (error) {
    console.error('Error in /api/groups:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: 'An unexpected error occurred.'
    })
  }
}