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

    console.log(`🔍 Fetching groups for user: ${userId}`)

    // Use user client for RLS
    const supa = userClient(token)
    
    try {
      // Fetch user groups using Supabase with RLS
      const { data: userGroups, error: groupsError } = await supa
        .from('groups')
        .select(`
          id,
          name,
          description,
          photo_url,
          is_public,
          owner_id,
          created_at,
          group_members!inner (
            role,
            joined_at
          )
        `)
        .eq('group_members.user_id', userId)
        .order('created_at', { ascending: false })
      
      if (groupsError) {
        console.error('Failed to fetch user groups:', groupsError)
        return res.status(500).json({ message: 'Unable to fetch your groups' })
      }

      // Transform to match expected response format (camelCase)
      const transformedGroups = userGroups?.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        photoUrl: group.photo_url,
        isPublic: group.is_public,
        ownerId: group.owner_id,
        createdAt: group.created_at,
        role: group.group_members?.[0]?.role || 'member',
        joinedAt: group.group_members?.[0]?.joined_at || group.created_at
      })) || []

      return res.status(200).json(transformedGroups)
    } catch (error) {
      console.error('Failed to fetch user groups:', error)
      return res.status(500).json({ message: 'Unable to fetch your groups' })
    }
    
  } catch (error) {
    console.error('Error in /api/groups/mine:', error)
    
    // Handle environment validation errors
    if (error instanceof Error && error.message.includes('Missing required environment variables')) {
      return res.status(500).json({ message: 'Server configuration error' })
    }
    
    return res.status(500).json({ 
      message: 'Internal server error',
      error: 'An unexpected error occurred.'
    })
  }
}