#!/usr/bin/env tsx
import { db } from "../db.js";
import { groups, groupMembers, posts, groupPosts, groupReactions, profiles } from '../../shared/schema.js';
import { sql } from "drizzle-orm";
// Mock users for seeding
const SEED_USERS = [
    {
        id: "00000000-0000-0000-0000-000000000001",
        firstName: "Alex",
        lastName: "Fitness",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: "00000000-0000-0000-0000-000000000002",
        firstName: "Sam",
        lastName: "Strong",
        avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b3d0?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: "00000000-0000-0000-0000-000000000003",
        firstName: "Jordan",
        lastName: "Athlete",
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: "00000000-0000-0000-0000-000000000004",
        firstName: "Taylor",
        lastName: "Trainer",
        avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: "00000000-0000-0000-0000-000000000005",
        firstName: "Casey",
        lastName: "Climber",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face"
    }
];
const SAMPLE_POSTS = [
    { kind: "text", content: { text: "Just finished an amazing workout! 💪 Feeling stronger every day." } },
    { kind: "text", content: { text: "Who's up for a morning run tomorrow? Let's meet at the park at 7am!" } },
    { kind: "workout", content: { workoutId: "workout-1", name: "Push Day", duration: 45, intensity: 8 } },
    { kind: "pr", content: { prId: "pr-1", movement: "Bench Press", weight: 225, unit: "lbs", reps: 5 } },
    { kind: "text", content: { text: "Recovery day today. Sometimes rest is the hardest part of training 🧘‍♀️" } },
    { kind: "text", content: { text: "New gym playlist is fire 🔥 Music makes such a difference in workouts!" } },
    { kind: "pr", content: { prId: "pr-2", movement: "Deadlift", weight: 315, unit: "lbs", reps: 3 } },
    { kind: "text", content: { text: "Meal prep Sunday! Prepped chicken, rice, and veggies for the week 🥗" } },
    { kind: "workout", content: { workoutId: "workout-2", name: "Leg Day", duration: 60, intensity: 9 } },
    { kind: "text", content: { text: "Accountability check: Did everyone get their steps in today? 👟" } }
];
const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '💪', '🙌'];
async function createEventPost(authorId) {
    // Create event for tonight at 7pm
    const tonight = new Date();
    tonight.setHours(19, 0, 0, 0); // 7:00 PM
    // If it's already past 7pm today, set for tomorrow  
    if (new Date().getHours() >= 19) {
        tonight.setDate(tonight.getDate() + 1);
    }
    return {
        kind: "event",
        content: {
            title: "Group Training Session",
            description: "Let's crush some weights together! All fitness levels welcome 💪",
            startAt: tonight.toISOString(),
            durationMinutes: 90,
            location: "Main Gym - Weight Room"
        }
    };
}
async function seedUsers() {
    console.log("🧑‍💻 Seeding users...");
    for (const user of SEED_USERS) {
        await db.insert(profiles).values({
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            providers: ['email'],
            username: `${user.firstName.toLowerCase()}${user.lastName.toLowerCase()}`
        }).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${SEED_USERS.length} users`);
}
async function seedGroups() {
    console.log("🏃‍♂️ Seeding groups...");
    const groupsData = [
        {
            name: "💪 Strength Squad",
            description: "Powerlifters and strength training enthusiasts unite! Share PRs, tips, and motivation.",
            isPublic: true,
            ownerId: SEED_USERS[0].id,
            photoUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=300&fit=crop"
        },
        {
            name: "🏃‍♀️ Cardio Crew",
            description: "Running, cycling, swimming - all cardio welcome! Let's get our heart rates up together.",
            isPublic: true,
            ownerId: SEED_USERS[1].id,
            photoUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop"
        },
        {
            name: "🥷 Elite Athletes",
            description: "Private group for serious competitors and advanced athletes only.",
            isPublic: false,
            ownerId: SEED_USERS[2].id,
            photoUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&h=300&fit=crop"
        }
    ];
    const createdGroups = [];
    for (const groupData of groupsData) {
        const groupResult = await db.insert(groups).values(groupData).returning();
        const createdGroup = { ...groupData, id: groupResult[0].id };
        createdGroups.push(createdGroup);
        // Add owner as member
        await db.insert(groupMembers).values({
            groupId: createdGroup.id,
            userId: createdGroup.ownerId,
            role: "owner"
        }).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${createdGroups.length} groups`);
    return createdGroups;
}
async function seedMembers(groupsData) {
    console.log("👥 Seeding group members...");
    let memberCount = 0;
    for (const group of groupsData) {
        // Add random members to each group (skip owner)
        const members = SEED_USERS.filter(u => u.id !== group.ownerId).slice(0, 3);
        for (const member of members) {
            await db.insert(groupMembers).values({
                groupId: group.id,
                userId: member.id,
                role: "member"
            }).onConflictDoNothing();
            memberCount++;
        }
    }
    console.log(`✅ Seeded ${memberCount} group memberships`);
}
async function seedPosts(groupsData) {
    console.log("📝 Seeding posts...");
    let postCount = 0;
    for (const group of groupsData) {
        // Get group members
        const members = await db
            .select({ userId: groupMembers.userId })
            .from(groupMembers)
            .where(sql `${groupMembers.groupId} = ${group.id}`);
        // Create 5-10 posts per group
        const numPosts = 7 + Math.floor(Math.random() * 4); // 7-10 posts
        for (let i = 0; i < numPosts; i++) {
            const randomMember = members[Math.floor(Math.random() * members.length)];
            const randomPost = SAMPLE_POSTS[Math.floor(Math.random() * SAMPLE_POSTS.length)];
            // Create one event post for the first group only (and only on first iteration)
            const postData = i === 0 && group.name === "💪 Strength Squad"
                ? await createEventPost(randomMember.userId)
                : randomPost;
            // Create canonical post
            const postResult = await db.insert(posts).values({
                userId: randomMember.userId,
                kind: postData.kind,
                content: postData.content,
                createdAt: new Date(Date.now() - (numPosts - i) * 3600000) // Spread posts over time
            }).returning();
            if (postResult[0]) {
                // Cross-post to group
                await db.insert(groupPosts).values({
                    groupId: group.id,
                    postId: postResult[0].id,
                    createdAt: postResult[0].createdAt
                });
                postCount++;
            }
        }
    }
    console.log(`✅ Seeded ${postCount} posts`);
}
async function seedReactions(groupsData) {
    console.log("👍 Seeding reactions...");
    let reactionCount = 0;
    for (const group of groupsData) {
        // Get group posts
        const groupPostsData = await db
            .select({
            postId: groupPosts.postId,
            authorId: posts.userId
        })
            .from(groupPosts)
            .innerJoin(posts, sql `${groupPosts.postId} = ${posts.id}`)
            .where(sql `${groupPosts.groupId} = ${group.id}`);
        // Get group members  
        const members = await db
            .select({ userId: groupMembers.userId })
            .from(groupMembers)
            .where(sql `${groupMembers.groupId} = ${group.id}`);
        // Add reactions to posts
        for (const post of groupPostsData) {
            // Random number of reactions per post (0-4)
            const numReactions = Math.floor(Math.random() * 5);
            for (let i = 0; i < numReactions; i++) {
                const randomMember = members[Math.floor(Math.random() * members.length)];
                // Don't let users react to their own posts
                if (randomMember.userId === post.authorId)
                    continue;
                const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
                await db.insert(groupReactions).values({
                    groupId: group.id,
                    postId: post.postId,
                    userId: randomMember.userId,
                    emoji: randomEmoji
                }).onConflictDoNothing();
                reactionCount++;
            }
        }
    }
    console.log(`✅ Seeded ${reactionCount} reactions`);
}
async function main() {
    console.log("🌱 Starting group seeding...");
    try {
        await seedUsers();
        const groupsData = await seedGroups();
        await seedMembers(groupsData);
        await seedPosts(groupsData);
        await seedReactions(groupsData);
        console.log("\n🎉 Group seeding completed successfully!");
        console.log("📊 Summary:");
        console.log(`   • ${SEED_USERS.length} users`);
        console.log(`   • ${groupsData.length} groups (2 public, 1 private)`);
        console.log(`   • ~20-30 posts with mixed content types`);
        console.log(`   • Random reactions on posts`);
        console.log(`   • 1 event scheduled for tonight in Strength Squad`);
        console.log("\n🚀 You can now test the groups functionality!");
    }
    catch (error) {
        console.error("❌ Error during seeding:", error);
        process.exit(1);
    }
    process.exit(0);
}
// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
