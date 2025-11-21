import { requireAuth } from "../middleware/requireAuth.js";
import { reactionRateLimit } from "../middleware/reactionRateLimit.js";
import { createGroup, getUserGroups, getGroupProfile, joinGroup, leaveGroup, createGroupInvite, acceptInvite, createPost, getGroupFeed, toggleReaction, getReactionSummary, upsertRsvp, removeRsvp, getPostRsvps, deleteGroupPost, removeMemberFromGroup, deleteGroup, updateGroup, getGroupMembers, addMemberToGroup } from "../dal/groups.js";
import { supabaseFromReq } from '../lib/supabaseFromReq.js';
import { recomputeAndUpdateGroupAchievements, getGroupAchievements } from "../dal/groupAchievements.js";
import { insertGroupSchema } from '../../shared/schema.js';
import { z } from "zod";
// Helper to handle database unavailability errors
function handleGroupError(res, error, defaultMessage) {
    console.error(`[Groups API] ${defaultMessage}:`, error);
    // Check if error is due to missing DATABASE_URL
    if (error instanceof Error && error.message.includes('Groups feature unavailable')) {
        return res.status(503).json({
            message: "Groups feature unavailable",
            error: "This feature requires DATABASE_URL to be configured. Please contact your administrator.",
            feature: "groups"
        });
    }
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
        return res.status(400).json({
            message: "Invalid input",
            errors: error.errors
        });
    }
    // Generic error
    return res.status(500).json({
        message: defaultMessage,
        error: error instanceof Error ? error.message : "Unknown error"
    });
}
export function registerGroupRoutes(app) {
    // GET /api/groups → groups I belong to (with role) - matches frontend expectation
    app.get("/api/groups", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const groups = await getUserGroups(userId);
            res.json(groups);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch groups");
        }
    });
    // POST /api/groups → create group + add creator as owner
    app.post("/api/groups", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            // Validate input
            const createGroupData = insertGroupSchema.parse(req.body);
            const group = await createGroup(userId, {
                name: createGroupData.name,
                description: createGroupData.description || undefined,
                isPublic: (createGroupData.isPublic ?? false),
                photoUrl: createGroupData.photoUrl || undefined,
            });
            res.status(201).json(group);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to create group");
        }
    });
    // GET /api/groups/mine → groups I belong to (with role)
    app.get("/api/groups/mine", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const groups = await getUserGroups(userId);
            res.json(groups);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch groups");
        }
    });
    // GET /api/groups/:id → group profile + membership role + basic counts
    app.get("/api/groups/:id", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const groupProfile = await getGroupProfile(userId, groupId);
            if (!groupProfile) {
                return res.status(404).json({ message: "Group not found" });
            }
            res.json(groupProfile);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch group profile");
        }
    });
    // POST /api/groups/:id/members → join (requires valid invite for private groups)
    app.post("/api/groups/:id/members", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const { inviteCode } = req.body;
            const membership = await joinGroup(userId, groupId, inviteCode);
            res.status(201).json(membership);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to join group");
        }
    });
    // DELETE /api/groups/:id/members → leave (owner transfer required if last owner)
    app.delete("/api/groups/:id/members", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const result = await leaveGroup(userId, groupId);
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to leave group");
        }
    });
    // PATCH /api/groups/:id → update group details (owner only)
    const updateGroupSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        photoUrl: z.string().url().optional(),
    });
    app.patch("/api/groups/:id", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const validatedData = updateGroupSchema.parse(req.body);
            const updatedGroup = await updateGroup(userId, groupId, validatedData);
            res.json(updatedGroup);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to update group");
        }
    });
    // GET /api/groups/:id/members → list all group members (members only)
    app.get("/api/groups/:id/members", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const members = await getGroupMembers(userId, groupId);
            res.json(members);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch group members");
        }
    });
    // POST /api/groups/:id/members/admin-add → add member by userId (owner/admin only)
    const addMemberSchema = z.object({
        userId: z.string().uuid(),
        role: z.enum(["member", "admin"]).optional(),
    });
    app.post("/api/groups/:id/members/admin-add", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const validatedData = addMemberSchema.parse(req.body);
            const newMember = await addMemberToGroup(userId, groupId, validatedData.userId, validatedData.role);
            res.status(201).json(newMember);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to add member");
        }
    });
    // POST /api/invites/:groupId → admin/owner only → create invite
    app.post("/api/invites/:groupId", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { groupId } = req.params;
            const { invitedEmail } = req.body;
            const invite = await createGroupInvite(userId, groupId, invitedEmail);
            res.status(201).json(invite);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to create invite");
        }
    });
    // POST /api/invites/accept → adds membership row, creates referrals row
    app.post("/api/invites/accept", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ message: "Invite code is required" });
            }
            const result = await acceptInvite(userId, code);
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to accept invite");
        }
    });
    // POST /api/posts → create canonical post + cross-post to groups
    app.post("/api/posts", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            // Validate input
            const schema = z.object({
                kind: z.enum(["text", "workout", "pr", "event"]),
                content: z.record(z.any()),
                groupIds: z.array(z.string().uuid())
            });
            const { kind, content, groupIds } = schema.parse(req.body);
            if (groupIds.length === 0) {
                return res.status(400).json({ message: "At least one group must be selected" });
            }
            const post = await createPost(userId, { kind, content, groupIds });
            // Recompute achievements for affected groups (async, don't block response)
            groupIds.forEach(async (groupId) => {
                try {
                    const result = await recomputeAndUpdateGroupAchievements(groupId);
                    if (result.newlyUnlocked.length > 0) {
                        console.log(`New achievements unlocked for group ${groupId}:`, result.newlyUnlocked);
                    }
                }
                catch (error) {
                    console.error(`Failed to update group achievements for group ${groupId}:`, error);
                }
            });
            res.status(201).json(post);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to create post");
        }
    });
    // GET /api/groups/:id/feed → ascending feed with keyset pagination
    app.get("/api/groups/:id/feed", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const { after, limit } = req.query;
            const options = {
                after: after ? String(after) : undefined,
                limit: limit ? parseInt(String(limit), 10) : undefined,
            };
            const feed = await getGroupFeed(userId, groupId, options);
            res.json(feed);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch group feed");
        }
    });
    // POST /api/reactions → upsert (toggle on/off)
    app.post("/api/reactions", requireAuth, reactionRateLimit, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const schema = z.object({
                groupId: z.string().uuid(),
                postId: z.string().uuid(),
                emoji: z.string().min(1)
            });
            const params = schema.parse(req.body);
            const result = await toggleReaction(userId, params);
            // Recompute achievements for the group (async, don't block response)
            try {
                const result = await recomputeAndUpdateGroupAchievements(params.groupId);
                if (result.newlyUnlocked.length > 0) {
                    console.log(`New achievements unlocked for group ${params.groupId}:`, result.newlyUnlocked);
                }
            }
            catch (error) {
                console.error(`Failed to update group achievements for group ${params.groupId}:`, error);
            }
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to toggle reaction");
        }
    });
    // DELETE /api/reactions → remove reaction
    app.delete("/api/reactions", requireAuth, reactionRateLimit, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const schema = z.object({
                groupId: z.string().uuid(),
                postId: z.string().uuid(),
                emoji: z.string().min(1)
            });
            const params = schema.parse(req.body);
            const result = await toggleReaction(userId, params);
            // Recompute achievements for the group (async, don't block response)
            try {
                const result = await recomputeAndUpdateGroupAchievements(params.groupId);
                if (result.newlyUnlocked.length > 0) {
                    console.log(`New achievements unlocked for group ${params.groupId}:`, result.newlyUnlocked);
                }
            }
            catch (error) {
                console.error(`Failed to update group achievements for group ${params.groupId}:`, error);
            }
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to remove reaction");
        }
    });
    // GET /api/groups/:id/reactions → list reaction summary
    app.get("/api/groups/:id/reactions", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const { post_id: postId } = req.query;
            if (!postId) {
                return res.status(400).json({ message: "post_id query parameter is required" });
            }
            // Skip temporary post IDs (not yet saved to database)
            if (String(postId).startsWith('temp-')) {
                return res.json([]);
            }
            const reactions = await getReactionSummary(userId, groupId, String(postId));
            res.json(reactions);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch reaction summary");
        }
    });
    // POST /api/groups/:groupId/posts/:postId/rsvp → create/update RSVP
    app.post("/api/groups/:groupId/posts/:postId/rsvp", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { groupId, postId } = req.params;
            const { status } = req.body;
            // Validate RSVP status
            const validStatuses = ["going", "maybe", "no"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    message: "Invalid RSVP status. Must be 'going', 'maybe', or 'no'"
                });
            }
            const result = await upsertRsvp(userId, { groupId, postId, status });
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to update RSVP");
        }
    });
    // DELETE /api/groups/:groupId/posts/:postId/rsvp → remove RSVP
    app.delete("/api/groups/:groupId/posts/:postId/rsvp", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { groupId, postId } = req.params;
            const result = await removeRsvp(userId, groupId, postId);
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to remove RSVP");
        }
    });
    // GET /api/groups/:groupId/posts/:postId/rsvps → get all RSVPs for post
    app.get("/api/groups/:groupId/posts/:postId/rsvps", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { groupId, postId } = req.params;
            const rsvps = await getPostRsvps(userId, groupId, postId);
            res.json(rsvps);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch RSVPs");
        }
    });
    // GET /api/groups/:id/achievements → get group achievements
    app.get("/api/groups/:id/achievements", requireAuth, async (req, res) => {
        try {
            const { id: groupId } = req.params;
            const achievements = await getGroupAchievements(groupId);
            res.json(achievements);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to fetch group achievements");
        }
    });
    // DELETE /api/groups/:groupId/posts/:postId → delete post from group (moderation)
    app.delete("/api/groups/:groupId/posts/:postId", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { groupId, postId } = req.params;
            const result = await deleteGroupPost(userId, groupId, postId);
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to delete post");
        }
    });
    // DELETE /api/groups/:groupId/members/:userId → remove member (moderation)
    app.delete("/api/groups/:groupId/members/:userId", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const currentUserId = authReq.user.id;
            const { groupId, userId: targetUserId } = req.params;
            const result = await removeMemberFromGroup(currentUserId, groupId, targetUserId);
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to remove member");
        }
    });
    // DELETE /api/groups/:id → delete entire group (owners only)
    app.delete("/api/groups/:id", requireAuth, async (req, res) => {
        try {
            const authReq = req;
            const userId = authReq.user.id;
            const { id: groupId } = req.params;
            const result = await deleteGroup(userId, groupId);
            res.json(result);
        }
        catch (error) {
            handleGroupError(res, error, "Failed to delete group");
        }
    });
    // GET /api/groups/:id/posts → get group posts (using supabaseFromReq for token-aware access)
    app.get("/api/groups/:id/posts", async (req, res) => {
        const groupId = req.params.id;
        const supabase = supabaseFromReq(req);
        const since = req.query.since;
        let q = supabase
            .from('group_posts')
            .select('id, group_id, author_id, body, meta, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (since)
            q = q.gte('created_at', since);
        const { data, error } = await q;
        if (error)
            return res.status(400).json({ error: error.message });
        res.json({ posts: data ?? [] });
    });
    // POST /api/groups/:id/posts → create group post (using supabaseFromReq for token-aware access)
    app.post("/api/groups/:id/posts", async (req, res) => {
        const groupId = req.params.id;
        const { body, meta } = req.body ?? {};
        if (!body || !String(body).trim())
            return res.status(400).json({ error: 'Body required' });
        const supabase = supabaseFromReq(req);
        const { data, error } = await supabase
            .from('group_posts')
            .insert({ group_id: groupId, body: String(body).trim(), meta: meta ?? null })
            .select('*').single();
        if (error)
            return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    });
}
