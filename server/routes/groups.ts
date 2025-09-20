import { Express } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  createGroup,
  getUserGroups,
  getGroupProfile,
  joinGroup,
  leaveGroup,
  createGroupInvite,
  acceptInvite,
  createPost,
  getGroupFeed,
  toggleReaction,
  getReactionSummary
} from "../dal/groups";
import { insertGroupSchema, insertPostSchema } from "@shared/schema";
import { z } from "zod";

export function registerGroupRoutes(app: Express) {
  
  // POST /api/groups → create group + add creator as owner
  app.post("/api/groups", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Validate input
      const createGroupData = insertGroupSchema.parse(req.body);

      const group = await createGroup(userId, {
        name: createGroupData.name,
        description: createGroupData.description || undefined,
        isPublic: createGroupData.isPublic ?? false,
        photoUrl: createGroupData.photoUrl || undefined,
      });

      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating group:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to create group",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/groups/mine → groups I belong to (with role)
  app.get("/api/groups/mine", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      const groups = await getUserGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ 
        message: "Failed to fetch groups",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/groups/:id → group profile + membership role + basic counts
  app.get("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { id: groupId } = req.params;

      const groupProfile = await getGroupProfile(userId, groupId);
      
      if (!groupProfile) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json(groupProfile);
    } catch (error) {
      console.error("Error fetching group profile:", error);
      res.status(500).json({ 
        message: "Failed to fetch group profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/groups/:id/members → join (requires valid invite for private groups)
  app.post("/api/groups/:id/members", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { id: groupId } = req.params;
      const { inviteCode } = req.body;

      const membership = await joinGroup(userId, groupId, inviteCode);
      res.status(201).json(membership);
    } catch (error) {
      console.error("Error joining group:", error);
      res.status(500).json({ 
        message: "Failed to join group",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // DELETE /api/groups/:id/members → leave (owner transfer required if last owner)
  app.delete("/api/groups/:id/members", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { id: groupId } = req.params;

      const result = await leaveGroup(userId, groupId);
      res.json(result);
    } catch (error) {
      console.error("Error leaving group:", error);
      res.status(500).json({ 
        message: "Failed to leave group",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/invites/:groupId → admin/owner only → create invite
  app.post("/api/invites/:groupId", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { groupId } = req.params;
      const { invitedEmail } = req.body;

      const invite = await createGroupInvite(userId, groupId, invitedEmail);
      res.status(201).json(invite);
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ 
        message: "Failed to create invite",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/invites/accept → adds membership row, creates referrals row
  app.post("/api/invites/accept", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Invite code is required" });
      }

      const result = await acceptInvite(userId, code);
      res.json(result);
    } catch (error) {
      console.error("Error accepting invite:", error);
      res.status(500).json({ 
        message: "Failed to accept invite",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/posts → create canonical post + cross-post to groups
  app.post("/api/posts", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
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
      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to create post",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/groups/:id/feed → ascending feed with keyset pagination
  app.get("/api/groups/:id/feed", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { id: groupId } = req.params;
      const { after, limit } = req.query;

      const options = {
        after: after ? String(after) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      };

      const feed = await getGroupFeed(userId, groupId, options);
      res.json(feed);
    } catch (error) {
      console.error("Error fetching group feed:", error);
      res.status(500).json({ 
        message: "Failed to fetch group feed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/reactions → upsert (toggle on/off)
  app.post("/api/reactions", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      const schema = z.object({
        groupId: z.string().uuid(),
        postId: z.string().uuid(),
        emoji: z.string().min(1)
      });

      const params = schema.parse(req.body);
      const result = await toggleReaction(userId, params);
      res.json(result);
    } catch (error) {
      console.error("Error toggling reaction:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to toggle reaction",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // DELETE /api/reactions → remove reaction
  app.delete("/api/reactions", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      const schema = z.object({
        groupId: z.string().uuid(),
        postId: z.string().uuid(),
        emoji: z.string().min(1)
      });

      const params = schema.parse(req.body);
      const result = await toggleReaction(userId, params);
      res.json(result);
    } catch (error) {
      console.error("Error removing reaction:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Failed to remove reaction",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/groups/:id/reactions → list reaction summary
  app.get("/api/groups/:id/reactions", requireAuth, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;
      const { id: groupId } = req.params;
      const { post_id: postId } = req.query;

      if (!postId) {
        return res.status(400).json({ message: "post_id query parameter is required" });
      }

      const reactions = await getReactionSummary(userId, groupId, String(postId));
      res.json(reactions);
    } catch (error) {
      console.error("Error fetching reaction summary:", error);
      res.status(500).json({ 
        message: "Failed to fetch reaction summary",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}