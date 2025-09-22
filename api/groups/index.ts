import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, userClient, bearer, validateEnvForUser } from '../_supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  
  try {
    // Validate environment variables
    validateEnvForUser()
    
    const adminClient = admin()
    const token = bearer(req)
    const { data: userData, error: authErr } = await adminClient.auth.getUser(token)
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' })
    const userId = userData.user.id

    // Use user client for RLS
    const supa = userClient(token)

    if (req.method === 'GET') {
      console.log(`🔍 Fetching groups for user: ${userId}`)
      
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

        // Transform to match expected response format
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
        // Create group using Supabase
        const { data: newGroup, error: createError } = await supa
          .from('groups')
          .insert({
            name,
            description,
            is_public: isPublic ?? false,
            photo_url: photoUrl,
            owner_id: userId
          })
          .select()
          .single()
          
        if (createError || !newGroup) {
          console.error('Failed to create group:', createError)
          return res.status(500).json({ message: 'Failed to create group' })
        }

        // Add creator as owner member
        const { error: memberError } = await supa
          .from('group_members')
          .insert({
            group_id: newGroup.id,
            user_id: userId,
            role: 'owner'
          })

        if (memberError) {
          console.error('Failed to add group owner:', memberError)
          // Clean up group if member creation fails
          await supa.from('groups').delete().eq('id', newGroup.id)
          return res.status(500).json({ message: 'Failed to create group membership' })
        }
        
        // Transform response to match expected format
        const transformedGroup = {
          id: newGroup.id,
          name: newGroup.name,
          description: newGroup.description,
          photoUrl: newGroup.photo_url,
          isPublic: newGroup.is_public,
          ownerId: newGroup.owner_id,
          createdAt: newGroup.created_at,
          role: 'owner',
          joinedAt: newGroup.created_at
        }
        
        console.log(`✅ Created group: ${newGroup.id}`)
        return res.status(201).json(transformedGroup)
      } catch (error) {
        console.error('Failed to create group:', error)
        return res.status(500).json({ message: 'Failed to create group' })
      }
    }

    return res.status(405).json({ message: 'Method Not Allowed' })
    
  } catch (error) {
    console.error('Error in /api/groups:', error)
    
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