// server.ts
import express from "express";
import http from "http";
import path2 from "path";
import fs2 from "fs";
import multer from "multer";
import bcrypt from "bcryptjs";

// src/server/db.ts
import fs from "fs";
import path from "path";

// src/server/supabase.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
var supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log("[Database] Connected to Supabase PostgreSQL at:", supabaseUrl);
  } catch (err) {
    console.warn("[Database] Failed to initialize Supabase client:", err);
  }
} else {
  console.log("[Database] Supabase credentials not found in env, using local resilient JSON DB.");
}

// src/server/db.ts
var isVercel = Boolean(process.env.VERCEL);
var DATA_DIR = process.env.DATA_DIR || (isVercel ? "/tmp/data" : path.join(process.cwd(), "data"));
var DB_FILE = path.join(DATA_DIR, "app_db.json");
var memoryDb = null;
async function initDb() {
  if (memoryDb) return memoryDb;
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
    }
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      memoryDb = JSON.parse(raw);
      if (memoryDb) {
        if (!Array.isArray(memoryDb.users)) memoryDb.users = [];
        if (!Array.isArray(memoryDb.campaigns)) memoryDb.campaigns = [];
        if (!Array.isArray(memoryDb.memberships)) memoryDb.memberships = [];
        if (!Array.isArray(memoryDb.studyBlocks)) memoryDb.studyBlocks = [];
        if (!Array.isArray(memoryDb.messages)) memoryDb.messages = [];
        if (!memoryDb.activeCalls || typeof memoryDb.activeCalls !== "object") memoryDb.activeCalls = {};
        return memoryDb;
      }
    } catch (e) {
      console.warn("Could not read existing local db, starting fresh:", e);
    }
  }
  memoryDb = {
    users: [],
    campaigns: [],
    memberships: [],
    studyBlocks: [],
    messages: [],
    activeCalls: {}
  };
  saveDb();
  return memoryDb;
}
function saveDb() {
  if (!memoryDb) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving local db to disk:", err);
  }
}
function mapUserFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url || "",
    bio: row.bio || "",
    studyGoal: row.study_goal || "",
    leetcodeUrl: row.leetcode_url || row.leetcodeUrl || "",
    hackerrankUrl: row.hackerrank_url || row.hackerrankUrl || "",
    createdAt: row.created_at
  };
}
function mapCampaignFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category || "General Study",
    adminId: row.admin_id,
    adminName: row.admin_name,
    startDate: row.start_date,
    endDate: row.end_date,
    dailyStartTime: row.daily_start_time || "19:00",
    dailyEndTime: row.daily_end_time || "23:00",
    targetDailyHours: Number(row.target_daily_hours) || 4,
    schedule: Array.isArray(row.schedule) ? row.schedule : [],
    maxMembers: Number(row.max_members) || 20,
    isPublic: row.is_public ?? true,
    tags: Array.isArray(row.tags) ? row.tags : [],
    bannerColor: row.banner_color || "#3b82f6",
    createdAt: row.created_at
  };
}
function mapMembershipFromDb(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userAvatarUrl: row.user_avatar_url || "",
    role: row.role || "member",
    status: row.status || "pending",
    joinedAt: row.joined_at
  };
}
function mapStudyBlockFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userAvatarUrl: row.user_avatar_url || "",
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    timestamp: row.timestamp,
    durationMinutes: Number(row.duration_minutes) || 5,
    status: row.status || "active",
    subjectNote: row.subject_note || "Focus Study",
    snapshotUrl: row.snapshot_url || void 0
  };
}
function mapMessageFromDb(row) {
  const ts = row.created_at || row.timestamp || (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: row.id,
    campaignId: row.campaign_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatarUrl: row.sender_avatar_url || "",
    content: row.content,
    timestamp: ts,
    createdAt: ts,
    type: row.type || "general",
    recipientId: row.recipient_id || void 0,
    attachmentUrl: row.attachment_url || void 0,
    attachmentName: row.attachment_name || void 0,
    attachmentType: row.attachment_type || void 0,
    reactions: Array.isArray(row.reactions) ? row.reactions : []
  };
}
async function getUsers() {
  if (supabase) {
    const { data, error } = await supabase.from("users").select("*");
    if (!error && data) {
      return data.map((r) => {
        const u = mapUserFromDb(r);
        const { passwordHash, ...clean } = u;
        return clean;
      });
    }
  }
  const db = await initDb();
  return db.users.map(({ passwordHash, ...user }) => user);
}
async function getUserById(id) {
  if (supabase) {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (!error && data) return mapUserFromDb(data);
  }
  const db = await initDb();
  return db.users.find((u) => u.id === id);
}
async function getUserByEmail(email) {
  if (supabase) {
    const { data, error } = await supabase.from("users").select("*").ilike("email", email.trim()).single();
    if (!error && data) return mapUserFromDb(data);
  }
  const db = await initDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}
async function createUser(userData) {
  if (supabase) {
    const { error } = await supabase.from("users").insert({
      id: userData.id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password_hash: userData.passwordHash,
      avatar_url: userData.avatarUrl || "",
      bio: userData.bio || "",
      study_goal: userData.studyGoal || "",
      leetcode_url: userData.leetcodeUrl || "",
      hackerrank_url: userData.hackerrankUrl || "",
      created_at: userData.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) console.error("Supabase createUser error:", error);
  }
  const db = await initDb();
  db.users.push(userData);
  saveDb();
  const { passwordHash, ...user } = userData;
  return user;
}
async function updateUserPasswordByEmail(email, newPasswordHash) {
  if (supabase) {
    const { error } = await supabase.from("users").update({ password_hash: newPasswordHash }).ilike("email", email.trim());
    if (!error) return true;
  }
  const db = await initDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  saveDb();
  return true;
}
async function updateUser(id, updates) {
  if (supabase) {
    const payload = {};
    if (updates.name !== void 0) payload.name = updates.name;
    if (updates.avatarUrl !== void 0) payload.avatar_url = updates.avatarUrl;
    if (updates.bio !== void 0) payload.bio = updates.bio;
    if (updates.studyGoal !== void 0) payload.study_goal = updates.studyGoal;
    if (updates.leetcodeUrl !== void 0) payload.leetcode_url = updates.leetcodeUrl;
    if (updates.hackerrankUrl !== void 0) payload.hackerrank_url = updates.hackerrankUrl;
    const { data, error } = await supabase.from("users").update(payload).eq("id", id).select().single();
    if (!error && data) {
      if (updates.name !== void 0 || updates.avatarUrl !== void 0) {
        const memPayload = {};
        if (updates.name !== void 0) memPayload.user_name = updates.name;
        if (updates.avatarUrl !== void 0) memPayload.user_avatar_url = updates.avatarUrl;
        await supabase.from("memberships").update(memPayload).eq("user_id", id);
        await supabase.from("study_blocks").update(memPayload).eq("user_id", id);
        if (updates.name !== void 0) {
          await supabase.from("campaigns").update({ admin_name: updates.name }).eq("admin_id", id);
        }
      }
      const full = mapUserFromDb(data);
      const { passwordHash: passwordHash2, ...clean } = full;
      return clean;
    }
  }
  const db = await initDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  Object.assign(user, updates);
  if (updates.name !== void 0 || updates.avatarUrl !== void 0) {
    db.memberships.forEach((m) => {
      if (m.userId === id) {
        if (updates.name !== void 0) m.userName = updates.name;
        if (updates.avatarUrl !== void 0) m.userAvatarUrl = updates.avatarUrl;
      }
    });
    db.campaigns.forEach((c) => {
      if (c.adminId === id && updates.name !== void 0) {
        c.adminName = updates.name;
      }
    });
    db.studyBlocks.forEach((b) => {
      if (b.userId === id) {
        if (updates.name !== void 0) b.userName = updates.name;
        if (updates.avatarUrl !== void 0) b.userAvatarUrl = updates.avatarUrl;
      }
    });
  }
  saveDb();
  const { passwordHash, ...cleanUser } = user;
  return cleanUser;
}
async function getCampaigns(userId) {
  if (supabase) {
    const { data: camps, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (!error && camps) {
      const { data: members } = await supabase.from("memberships").select("*");
      const allMembers = (members || []).map(mapMembershipFromDb);
      return camps.map(mapCampaignFromDb).map((c) => {
        const approved = allMembers.filter((m) => m.campaignId === c.id && m.status === "approved");
        const userMem = userId ? allMembers.find((m) => m.campaignId === c.id && m.userId === userId) : void 0;
        return {
          ...c,
          memberCount: approved.length,
          userStatus: userMem ? userMem.status : void 0,
          userRole: userMem ? userMem.role : void 0
        };
      });
    }
  }
  const db = await initDb();
  return db.campaigns.map((c) => {
    const approvedMembers = db.memberships.filter((m) => m.campaignId === c.id && m.status === "approved");
    let userMembership = userId ? db.memberships.find((m) => m.campaignId === c.id && m.userId === userId) : void 0;
    return {
      ...c,
      memberCount: approvedMembers.length,
      userStatus: userMembership ? userMembership.status : void 0,
      userRole: userMembership ? userMembership.role : void 0
    };
  });
}
async function getCampaignById(id, userId) {
  if (supabase) {
    const { data: camp, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
    if (!error && camp) {
      const { data: members } = await supabase.from("memberships").select("*").eq("campaign_id", id);
      const allMembers = (members || []).map(mapMembershipFromDb);
      const approved = allMembers.filter((m) => m.status === "approved");
      const userMem = userId ? allMembers.find((m) => m.userId === userId) : void 0;
      const c = mapCampaignFromDb(camp);
      return {
        ...c,
        memberCount: approved.length,
        userStatus: userMem ? userMem.status : void 0,
        userRole: userMem ? userMem.role : void 0
      };
    }
  }
  const db = await initDb();
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) return null;
  const approvedMembers = db.memberships.filter((m) => m.campaignId === campaign.id && m.status === "approved");
  let userMembership = userId ? db.memberships.find((m) => m.campaignId === campaign.id && m.userId === userId) : void 0;
  return {
    ...campaign,
    memberCount: approvedMembers.length,
    userStatus: userMembership ? userMembership.status : void 0,
    userRole: userMembership ? userMembership.role : void 0
  };
}
async function createCampaign(campaign, creator) {
  const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const membership = {
    id: membershipId,
    userId: creator.id,
    userName: creator.name,
    userEmail: creator.email,
    userAvatarUrl: creator.avatarUrl,
    campaignId: campaign.id,
    role: "admin",
    status: "approved",
    joinedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (supabase) {
    await supabase.from("campaigns").insert({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || "",
      category: campaign.category || "General Study",
      admin_id: creator.id,
      admin_name: creator.name,
      start_date: campaign.startDate,
      end_date: campaign.endDate,
      daily_start_time: campaign.dailyStartTime || "19:00",
      daily_end_time: campaign.dailyEndTime || "23:00",
      target_daily_hours: campaign.targetDailyHours || 4,
      schedule: campaign.schedule || [],
      created_at: campaign.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    });
    await supabase.from("memberships").insert({
      id: membership.id,
      campaign_id: campaign.id,
      user_id: creator.id,
      user_name: creator.name,
      user_email: creator.email,
      user_avatar_url: creator.avatarUrl || "",
      role: "admin",
      status: "approved",
      joined_at: membership.joinedAt
    });
  }
  const db = await initDb();
  db.campaigns.unshift(campaign);
  db.memberships.push(membership);
  saveDb();
  return {
    ...campaign,
    memberCount: 1,
    userStatus: "approved",
    userRole: "admin"
  };
}
async function updateCampaign(id, updates) {
  if (supabase) {
    const payload = {};
    if (updates.name !== void 0) payload.name = updates.name;
    if (updates.description !== void 0) payload.description = updates.description;
    if (updates.category !== void 0) payload.category = updates.category;
    if (updates.startDate !== void 0) payload.start_date = updates.startDate;
    if (updates.endDate !== void 0) payload.end_date = updates.endDate;
    if (updates.dailyStartTime !== void 0) payload.daily_start_time = updates.dailyStartTime;
    if (updates.dailyEndTime !== void 0) payload.daily_end_time = updates.dailyEndTime;
    if (updates.targetDailyHours !== void 0) payload.target_daily_hours = updates.targetDailyHours;
    if (updates.schedule !== void 0) payload.schedule = updates.schedule;
    if (updates.maxMembers !== void 0) payload.max_members = updates.maxMembers;
    if (updates.isPublic !== void 0) payload.is_public = updates.isPublic;
    if (updates.tags !== void 0) payload.tags = updates.tags;
    if (updates.bannerColor !== void 0) payload.banner_color = updates.bannerColor;
    const { data, error } = await supabase.from("campaigns").update(payload).eq("id", id).select().single();
    if (error) {
      console.error("[updateCampaign] Supabase error:", error);
      throw new Error(error.message);
    }
    if (data) return mapCampaignFromDb(data);
  }
  const db = await initDb();
  const c = db.campaigns.find((camp) => camp.id === id);
  if (!c) return null;
  Object.assign(c, updates);
  saveDb();
  return c;
}
async function deleteCampaign(id) {
  if (supabase) {
    await supabase.from("campaigns").delete().eq("id", id);
    await supabase.from("memberships").delete().eq("campaign_id", id);
    await supabase.from("study_blocks").delete().eq("campaign_id", id);
    await supabase.from("messages").delete().eq("campaign_id", id);
    return true;
  }
  const db = await initDb();
  const index = db.campaigns.findIndex((c) => c.id === id);
  if (index === -1) return false;
  db.campaigns.splice(index, 1);
  db.memberships = db.memberships.filter((m) => m.campaignId !== id);
  db.studyBlocks = db.studyBlocks.filter((b) => b.campaignId !== id);
  db.messages = db.messages.filter((m) => m.campaignId !== id);
  saveDb();
  return true;
}
async function getCampaignMembers(campaignId) {
  if (supabase) {
    const { data, error } = await supabase.from("memberships").select("*").eq("campaign_id", campaignId);
    if (!error && data) return data.map(mapMembershipFromDb);
  }
  const db = await initDb();
  return db.memberships.filter((m) => m.campaignId === campaignId);
}
async function getMembership(userId, campaignId) {
  if (supabase) {
    const { data, error } = await supabase.from("memberships").select("*").eq("user_id", userId).eq("campaign_id", campaignId).single();
    if (!error && data) return mapMembershipFromDb(data);
  }
  const db = await initDb();
  return db.memberships.find((m) => m.userId === userId && m.campaignId === campaignId);
}
async function createMembership(membership) {
  if (supabase) {
    await supabase.from("memberships").upsert({
      id: membership.id,
      campaign_id: membership.campaignId,
      user_id: membership.userId,
      user_name: membership.userName,
      user_email: membership.userEmail,
      user_avatar_url: membership.userAvatarUrl || "",
      role: membership.role || "member",
      status: membership.status || "pending",
      joined_at: membership.joinedAt || (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const db = await initDb();
  const existingIndex = db.memberships.findIndex((m) => m.userId === membership.userId && m.campaignId === membership.campaignId);
  if (existingIndex >= 0) {
    db.memberships[existingIndex] = membership;
  } else {
    db.memberships.push(membership);
  }
  saveDb();
  return membership;
}
async function updateMembership(id, updates) {
  if (supabase) {
    const payload = {};
    if (updates.status !== void 0) payload.status = updates.status;
    if (updates.role !== void 0) payload.role = updates.role;
    const { data, error } = await supabase.from("memberships").update(payload).eq("id", id).select().single();
    if (!error && data) return mapMembershipFromDb(data);
  }
  const db = await initDb();
  const mem = db.memberships.find((m) => m.id === id);
  if (!mem) return null;
  Object.assign(mem, updates);
  saveDb();
  return mem;
}
async function deleteMembership(id) {
  if (supabase) {
    await supabase.from("memberships").delete().eq("id", id);
    return true;
  }
  const db = await initDb();
  const idx = db.memberships.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  db.memberships.splice(idx, 1);
  saveDb();
  return true;
}
async function logStudyBlock(block) {
  if (supabase) {
    await supabase.from("study_blocks").insert({
      id: block.id,
      user_id: block.userId,
      user_name: block.userName,
      user_avatar_url: block.userAvatarUrl || "",
      campaign_id: block.campaignId,
      campaign_name: block.campaignName,
      timestamp: block.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      duration_minutes: block.durationMinutes || 5,
      status: block.status || "active",
      subject_note: block.subjectNote || "Focus Study",
      snapshot_url: block.snapshotUrl || null
    });
  }
  const db = await initDb();
  db.studyBlocks.push(block);
  saveDb();
  return block;
}
async function getStudyBlocksForUser(userId, campaignId) {
  if (supabase) {
    let query = supabase.from("study_blocks").select("*").eq("user_id", userId);
    if (campaignId) query = query.eq("campaign_id", campaignId);
    const { data, error } = await query;
    if (!error && data) return data.map(mapStudyBlockFromDb);
  }
  const db = await initDb();
  return db.studyBlocks.filter((b) => b.userId === userId && (!campaignId || b.campaignId === campaignId));
}
async function getCampaignLeaderboard(campaignId) {
  let approvedMembers = [];
  let campaignBlocks = [];
  let targetHours = 4;
  let allUsers = [];
  if (supabase) {
    const [campRes, memsRes, blksRes, usersRes] = await Promise.all([
      supabase.from("campaigns").select("target_daily_hours").eq("id", campaignId).single(),
      supabase.from("memberships").select("*").eq("campaign_id", campaignId).eq("status", "approved"),
      supabase.from("study_blocks").select("*").eq("campaign_id", campaignId).eq("status", "active"),
      supabase.from("users").select("id, leetcode_url, hackerrank_url")
    ]);
    if (campRes.data) targetHours = Number(campRes.data.target_daily_hours) || 4;
    if (memsRes.data) approvedMembers = memsRes.data.map(mapMembershipFromDb);
    if (blksRes.data) campaignBlocks = blksRes.data.map(mapStudyBlockFromDb);
    if (usersRes.data) {
      allUsers = usersRes.data.map((u) => ({
        id: u.id,
        leetcodeUrl: u.leetcode_url || "",
        hackerrankUrl: u.hackerrank_url || ""
      }));
    }
  } else {
    const db = await initDb();
    const campaign = db.campaigns.find((c) => c.id === campaignId);
    targetHours = campaign?.targetDailyHours || 4;
    approvedMembers = db.memberships.filter((m) => m.campaignId === campaignId && m.status === "approved");
    campaignBlocks = db.studyBlocks.filter((b) => b.campaignId === campaignId && b.status === "active");
    allUsers = db.users.map((u) => ({
      id: u.id,
      leetcodeUrl: u.leetcodeUrl || "",
      hackerrankUrl: u.hackerrankUrl || ""
    }));
  }
  const now = /* @__PURE__ */ new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 864e5;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const entries = approvedMembers.map((member) => {
    const userBlocks = campaignBlocks.filter((b) => b.userId === member.userId);
    const userProfile = allUsers.find((u) => u.id === member.userId);
    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let thisMonthMinutes = 0;
    let totalMinutes = 0;
    let lastActive = void 0;
    const activeDaysSet = /* @__PURE__ */ new Set();
    userBlocks.forEach((b) => {
      const bTime = new Date(b.timestamp).getTime();
      const bDateStr = b.timestamp.split("T")[0];
      activeDaysSet.add(bDateStr);
      totalMinutes += b.durationMinutes;
      if (bTime >= todayStart) {
        todayMinutes += b.durationMinutes;
      }
      if (bTime >= weekStart) {
        thisWeekMinutes += b.durationMinutes;
      }
      if (bTime >= monthStart) {
        thisMonthMinutes += b.durationMinutes;
      }
      if (!lastActive || new Date(b.timestamp) > new Date(lastActive)) {
        lastActive = b.timestamp;
      }
    });
    let currentStreak = 0;
    for (let d = 0; d < 365; d++) {
      const checkDate = new Date(todayStart - d * 864e5);
      const dateStr = checkDate.toISOString().split("T")[0];
      if (activeDaysSet.has(dateStr)) {
        currentStreak++;
      } else if (d === 0 && !activeDaysSet.has(dateStr)) {
        continue;
      } else {
        break;
      }
    }
    const todayHours = Number((todayMinutes / 60).toFixed(1));
    const targetCompleted = todayHours >= targetHours;
    const progressPercentage = Math.min(100, Math.round(todayHours / (targetHours || 1) * 100));
    return {
      userId: member.userId,
      userName: member.userName,
      userAvatarUrl: member.userAvatarUrl,
      leetcodeUrl: userProfile?.leetcodeUrl || "",
      hackerrankUrl: userProfile?.hackerrankUrl || "",
      role: member.role || "member",
      todayMinutes,
      todayHours,
      thisWeekMinutes,
      thisWeekHours: Number((thisWeekMinutes / 60).toFixed(1)),
      thisMonthMinutes,
      thisMonthHours: Number((thisMonthMinutes / 60).toFixed(1)),
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      activeStreakDays: currentStreak,
      streakDays: currentStreak,
      targetDailyHours: targetHours,
      todayTargetMet: targetCompleted,
      targetCompleted,
      progressPercentage,
      lastActive
    };
  });
  return entries.sort((a, b) => b.todayMinutes - a.todayMinutes);
}
async function getCampaignMessages(campaignId) {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("messages").select("*").eq("campaign_id", campaignId).order("timestamp", { ascending: true });
      if (!error && data) {
        return data.map(mapMessageFromDb);
      }
      if (error) {
        console.warn("[Database] Supabase getCampaignMessages error:", error.message);
      }
    } catch (e) {
      console.warn("[Database] getCampaignMessages exception:", e);
    }
  }
  const db = await initDb();
  return db.messages.filter((m) => m.campaignId === campaignId);
}
async function getDirectMessages(userId1, userId2) {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("messages").select("*").or(`and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`).order("timestamp", { ascending: true });
      if (!error && data) return data.map(mapMessageFromDb);
    } catch {
    }
  }
  const db = await initDb();
  return db.messages.filter(
    (m) => m.senderId === userId1 && m.recipientId === userId2 || m.senderId === userId2 && m.recipientId === userId1
  );
}
async function createMessage(message) {
  const isDm = Boolean(message.recipientId);
  const msgType = message.type || (isDm ? "dm" : "campaign");
  const ts = message.timestamp || message.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  if (supabase) {
    try {
      const payload = {
        id: message.id,
        campaign_id: message.campaignId || (isDm ? null : "general"),
        sender_id: message.senderId,
        sender_name: message.senderName,
        sender_avatar_url: message.senderAvatarUrl || "",
        content: message.content,
        timestamp: ts,
        type: msgType,
        recipient_id: message.recipientId || null,
        attachment_url: message.attachmentUrl || null,
        attachment_name: message.attachmentName || null,
        attachment_type: message.attachmentType || null
      };
      const { error } = await supabase.from("messages").insert(payload);
      if (error) {
        console.error("[Database] Supabase createMessage insert error:", error.message);
        await supabase.from("messages").insert({
          id: message.id,
          campaign_id: message.campaignId || "general",
          sender_id: message.senderId,
          sender_name: message.senderName,
          content: message.content,
          timestamp: ts
        });
      }
    } catch (e) {
      console.error("[Database] Supabase createMessage exception:", e);
    }
  }
  const db = await initDb();
  const fullMsg = { ...message, timestamp: ts, createdAt: ts, type: msgType };
  db.messages.push(fullMsg);
  saveDb();
  return fullMsg;
}
async function toggleMessageReaction2(messageId, emoji, userId, userName) {
  const db = await initDb();
  const msg = db.messages.find((m) => m.id === messageId);
  if (!msg) return null;
  if (!msg.reactions) msg.reactions = [];
  const existingIdx = msg.reactions.findIndex((r) => r.emoji === emoji && r.userId === userId);
  if (existingIdx >= 0) {
    msg.reactions.splice(existingIdx, 1);
  } else {
    msg.reactions.push({ emoji, userId, userName });
  }
  saveDb();
  return msg;
}
async function getCallSession(campaignId) {
  if (supabase) {
    const { data, error } = await supabase.from("active_calls").select("*").eq("campaign_id", campaignId).single();
    if (!error && data && data.session_data) {
      return data.session_data;
    }
  }
  const db = await initDb();
  return db.activeCalls[campaignId] || null;
}
async function saveCallSession(campaignId, session) {
  if (supabase) {
    if (session) {
      await supabase.from("active_calls").upsert({
        campaign_id: campaignId,
        session_data: session,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      await supabase.from("active_calls").delete().eq("campaign_id", campaignId);
    }
  }
  const db = await initDb();
  if (session) {
    db.activeCalls[campaignId] = session;
  } else {
    delete db.activeCalls[campaignId];
  }
  saveDb();
}
async function addCallParticipant(campaignId, participant) {
  let session = await getCallSession(campaignId);
  if (!session) {
    session = {
      campaignId,
      campaignName: "Study Lounge",
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      participants: []
    };
  }
  const existingIdx = session.participants.findIndex((p) => p.userId === participant.userId);
  if (existingIdx >= 0) {
    session.participants[existingIdx] = { ...session.participants[existingIdx], ...participant };
  } else {
    session.participants.push(participant);
  }
  await saveCallSession(campaignId, session);
  return session;
}
async function removeCallParticipant(campaignId, userIdOrSocketId) {
  const session = await getCallSession(campaignId);
  if (!session) return null;
  session.participants = session.participants.filter(
    (p) => p.socketId !== userIdOrSocketId && p.userId !== userIdOrSocketId
  );
  if (session.participants.length === 0) {
    await saveCallSession(campaignId, null);
    return null;
  }
  await saveCallSession(campaignId, session);
  return session;
}
async function updateParticipantState(campaignId, userIdOrSocketId, updates) {
  const session = await getCallSession(campaignId);
  if (!session) return null;
  const p = session.participants.find(
    (part) => part.socketId === userIdOrSocketId || part.userId === userIdOrSocketId
  );
  if (p) {
    Object.assign(p, updates);
    await saveCallSession(campaignId, session);
  }
  return session;
}

// src/server/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "studycampaign-secure-jwt-key-2026";
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization token" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const { passwordHash, ...cleanUser } = user;
    req.user = cleanUser;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await getUserById(decoded.id);
      if (user) {
        const { passwordHash, ...cleanUser } = user;
        req.user = cleanUser;
      }
    } catch {
    }
  }
  next();
}

// src/server/socket.ts
import { Server } from "socket.io";
var connectedUsers = /* @__PURE__ */ new Map();
var activeStudySessions = /* @__PURE__ */ new Map();
var restHeartbeats = /* @__PURE__ */ new Map();
var restStudySessions = /* @__PURE__ */ new Map();
var ioInstance = null;
function getOnlineUserIds() {
  const cutoff = Date.now() - 12e3;
  for (const [id, data] of restHeartbeats.entries()) {
    if (data.lastSeen < cutoff) restHeartbeats.delete(id);
  }
  const socketUserIds = Array.from(connectedUsers.values()).map((u) => u.userId);
  const restUserIds = Array.from(restHeartbeats.keys());
  return Array.from(/* @__PURE__ */ new Set([...socketUserIds, ...restUserIds]));
}
function getActiveStudySessions() {
  const cutoff = Date.now() - 12e3;
  for (const [id, data] of restStudySessions.entries()) {
    if (data.lastSeen < cutoff) restStudySessions.delete(id);
  }
  const sessionMap = /* @__PURE__ */ new Map();
  for (const session of activeStudySessions.values()) {
    sessionMap.set(session.userId, session);
  }
  for (const data of restStudySessions.values()) {
    sessionMap.set(data.session.userId, data.session);
  }
  return Array.from(sessionMap.values());
}
function broadcastOnlineUsers() {
  if (ioInstance) {
    ioInstance.emit("presence:online_users", getOnlineUserIds());
  }
}
function broadcastStudySessions() {
  if (ioInstance) {
    ioInstance.emit("study:active_sessions", getActiveStudySessions());
  }
}
function touchUserPresence(userId, userName, userAvatarUrl) {
  restHeartbeats.set(userId, { userId, userName, userAvatarUrl, lastSeen: Date.now() });
  broadcastOnlineUsers();
}
function removeUserPresence(userId) {
  restHeartbeats.delete(userId);
  broadcastOnlineUsers();
}
function touchStudySession(session) {
  restStudySessions.set(session.userId, { session, lastSeen: Date.now() });
  broadcastStudySessions();
}
function removeStudySession(userId) {
  restStudySessions.delete(userId);
  activeStudySessions.delete(userId);
  broadcastStudySessions();
}
function setupSocketServer(httpServer) {
  const io2 = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  ioInstance = io2;
  io2.on("connection", (socket) => {
    socket.on("user:online", (userData) => {
      connectedUsers.set(socket.id, {
        socketId: socket.id,
        userId: userData.userId,
        userName: userData.userName,
        userAvatarUrl: userData.userAvatarUrl
      });
      socket.join(`user:${userData.userId}`);
      broadcastOnlineUsers2();
      socket.emit("study:active_sessions", getActiveStudySessions());
    });
    socket.on("campaign:join_room", (campaignId) => {
      socket.join(`campaign:${campaignId}`);
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.activeCampaignId = campaignId;
      }
    });
    socket.on("campaign:leave_room", (campaignId) => {
      socket.leave(`campaign:${campaignId}`);
      const user = connectedUsers.get(socket.id);
      if (user && user.activeCampaignId === campaignId) {
        user.activeCampaignId = void 0;
      }
    });
    socket.on("message:send", async (messageData, callback) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      const newMsg = {
        id: messageData.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        senderId: user.userId,
        senderName: user.userName,
        senderAvatarUrl: user.userAvatarUrl,
        campaignId: messageData.campaignId || null,
        recipientId: messageData.recipientId || null,
        content: messageData.content || "",
        attachmentUrl: messageData.attachmentUrl || null,
        attachmentName: messageData.attachmentName || null,
        attachmentType: messageData.attachmentType || null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        reactions: []
      };
      const saved = await createMessage(newMsg);
      if (saved.campaignId) {
        io2.to(`campaign:${saved.campaignId}`).emit("message:new", saved);
      } else if (saved.recipientId) {
        io2.to(`user:${saved.senderId}`).to(`user:${saved.recipientId}`).emit("message:new", saved);
      }
      if (callback) callback({ success: true, message: saved });
    });
    socket.on("message:react", async ({ messageId, emoji, campaignId, recipientId }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      const updated = await toggleMessageReaction2(messageId, emoji, user.userId);
      if (updated) {
        if (campaignId) {
          io2.to(`campaign:${campaignId}`).emit("message:updated", updated);
        } else if (recipientId) {
          io2.to(`user:${user.userId}`).to(`user:${recipientId}`).emit("message:updated", updated);
        }
      }
    });
    socket.on("typing:start", ({ campaignId, recipientId }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      if (campaignId) {
        socket.to(`campaign:${campaignId}`).emit("typing:status", {
          campaignId,
          userId: user.userId,
          userName: user.userName,
          isTyping: true
        });
      } else if (recipientId) {
        io2.to(`user:${recipientId}`).emit("typing:status", {
          recipientId,
          userId: user.userId,
          userName: user.userName,
          isTyping: true
        });
      }
    });
    socket.on("typing:stop", ({ campaignId, recipientId }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      if (campaignId) {
        socket.to(`campaign:${campaignId}`).emit("typing:status", {
          campaignId,
          userId: user.userId,
          userName: user.userName,
          isTyping: false
        });
      } else if (recipientId) {
        io2.to(`user:${recipientId}`).emit("typing:status", {
          recipientId,
          userId: user.userId,
          userName: user.userName,
          isTyping: false
        });
      }
    });
    socket.on("study:start_session", (sessionData) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      const session = {
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        campaignId: sessionData.campaignId,
        campaignName: sessionData.campaignName,
        subjectNote: sessionData.subjectNote,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        activeMinutes: 0,
        isScreenSharedLocally: false
      };
      activeStudySessions.set(user.userId, session);
      io2.emit("study:session_started", session);
      broadcastStudySessions();
    });
    socket.on("study:stop_session", () => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      if (activeStudySessions.has(user.userId)) {
        activeStudySessions.delete(user.userId);
        io2.emit("study:session_ended", { userId: user.userId });
        broadcastStudySessions();
      }
    });
    socket.on("call:join", async ({ campaignId, isMuted = false, isVideoOn = false, isScreenSharing = false }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      user.inCallCampaignId = campaignId;
      socket.join(`call:${campaignId}`);
      const participant = {
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        socketId: socket.id,
        isMuted,
        isVideoOn,
        isScreenSharing,
        joinedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const session = await addCallParticipant(campaignId, participant);
      const existingParticipants = session.participants.filter((p) => p.socketId !== socket.id);
      io2.to(`campaign:${campaignId}`).emit("call:session_updated", session);
      socket.emit("call:existing_peers", {
        existingParticipants
      });
      socket.to(`call:${campaignId}`).emit("call:peer_joined", {
        participant,
        existingParticipants
      });
    });
    socket.on("call:signal", ({ toSocketId, signal, type }) => {
      io2.to(toSocketId).emit("call:signal", {
        fromSocketId: socket.id,
        signal,
        type
      });
    });
    socket.on("call:video_frame", ({ campaignId, frameData }) => {
      socket.to(`call:${campaignId}`).to(`campaign:${campaignId}`).emit("call:video_frame", {
        fromSocketId: socket.id,
        frameData
      });
    });
    socket.on("call:audio_chunk", ({ campaignId, audioData }) => {
      socket.to(`call:${campaignId}`).to(`campaign:${campaignId}`).emit("call:audio_chunk", {
        fromSocketId: socket.id,
        audioData
      });
    });
    socket.on("call:speaking", ({ campaignId, isSpeaking }) => {
      socket.to(`call:${campaignId}`).emit("call:participant_speaking", {
        socketId: socket.id,
        isSpeaking
      });
    });
    socket.on("call:state_change", async ({ campaignId, isMuted, isScreenSharing }) => {
      const session = await updateParticipantState(campaignId, socket.id, {
        ...isMuted !== void 0 && { isMuted },
        ...isScreenSharing !== void 0 && { isScreenSharing }
      });
      if (session) {
        io2.to(`campaign:${campaignId}`).to(`call:${campaignId}`).emit("call:session_updated", session);
      }
    });
    socket.on("call:leave", async (campaignId) => {
      handleCallLeave(socket, campaignId);
    });
    socket.on("disconnect", async () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        if (user.inCallCampaignId) {
          handleCallLeave(socket, user.inCallCampaignId);
        }
        const existingSession = activeStudySessions.get(user.userId);
        if (existingSession) {
          activeStudySessions.delete(user.userId);
          restStudySessions.set(user.userId, { session: existingSession, lastSeen: Date.now() });
        }
        connectedUsers.delete(socket.id);
        broadcastOnlineUsers2();
      }
    });
  });
  async function handleCallLeave(socket, campaignId) {
    socket.leave(`call:${campaignId}`);
    const user = connectedUsers.get(socket.id);
    if (user) {
      user.inCallCampaignId = void 0;
    }
    const session = await removeCallParticipant(campaignId, socket.id);
    socket.to(`call:${campaignId}`).emit("call:peer_left", { socketId: socket.id });
    io2.to(`campaign:${campaignId}`).emit("call:session_updated", session);
  }
  function broadcastOnlineUsers2() {
    if (ioInstance) {
      ioInstance.emit("presence:online_users", getOnlineUserIds());
    }
  }
  return io2;
}

// src/server/ai.ts
import { GoogleGenAI } from "@google/genai";
import dotenv2 from "dotenv";
dotenv2.config();
var DEFAULT_GEMINI_KEY = "AIzaSyBdLZiSdNRByGBWwkfUIv5BRbDpD9sIUr8";
async function analyzeScreenSnapshot(base64Image, campaignName = "General Study", subjectNote = "Focused Work") {
  const apiKey = process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
  if (!apiKey) {
    return {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: "Proctor Unconfigured",
      category: "other",
      reason: "AI Proctor API key is not configured."
    };
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    let mimeType = "image/jpeg";
    let data = base64Image ? base64Image.trim() : "";
    if (data.includes(";base64,")) {
      const parts = data.split(";base64,");
      const mimeMatch = parts[0].match(/data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
      data = parts[1];
    } else if (data.startsWith("data:")) {
      const commaIdx = data.indexOf(",");
      if (commaIdx !== -1) {
        data = data.slice(commaIdx + 1);
      }
    }
    data = data.replace(/\s+/g, "");
    if (!data || data.length < 50) {
      return {
        isProductiveWork: false,
        confidence: 85,
        activitySummary: "No Screen Frame",
        category: "idle",
        reason: "No screen capture frame was received."
      };
    }
    const prompt = `You are a strict, objective, and fair AI Screen Proctor for StudySync, an online accountability study platform.
Campaign: "${campaignName}"
Claimed Subject / Task: "${subjectNote}"

Examine the student's screen screenshot carefully. Your goal is to distinguish between genuine STUDYING / ACADEMIC / TECHNICAL / PRODUCTIVE WORK and TIMEPASS / LEISURE / ENTERTAINMENT / DISTRACTION / SHOPPING.

============================================================
CRITERIA FOR STUDY & PRODUCTIVE WORK (isProductiveWork = true):
============================================================
1. CODING & TECH: Writing, editing, running, or debugging code in IDEs (VS Code, Cursor, PyCharm, IntelliJ, Xcode, Eclipse, Sublime, Vim, Neovim, Nano, Terminal, Shell, PowerShell, Jupyter Notebooks, Google Colab, GitHub, GitLab, LeetCode, HackerRank, Codeforces, NeetCode).
2. ACADEMIC STUDY (ANY SUBJECT): Reading, studying, or reviewing materials in Computer Science, Engineering, Mathematics, Physics, Chemistry, Biology, Medicine/Healthcare, Law, Business/Finance, Humanities, Languages, or Competitive Exam Prep (UPSC, SAT, GRE, MCAT, JEE, NEET, etc.).
3. READING & RESEARCH: Textbooks, lecture slides, academic research papers (arXiv, PubMed, IEEE, etc.), technical PDFs, documentation (MDN, Stack Overflow, DevDocs, official docs), formula sheets, Wikipedia/Google educational articles.
4. NOTE-TAKING & WRITING: Writing notes, assignments, reports, essays, summaries in Notion, Obsidian, Google Docs, MS Word, OneNote, Apple Notes, Markdown editors.
5. PRACTICE & RECALL: Flashcards (Anki, Quizlet), practice exams, problem sets, calculator, CAD, spreadsheet data analysis.
6. EDUCATIONAL VIDEOS & LECTURES: Video lectures, tutorials, educational courses (YouTube, Coursera, edX, Udemy, Khan Academy) showing educational content, coding demonstrations, slides, mathematical derivations, or academic explanations.
7. SPLIT SCREENS & MULTI-WINDOW: If the user has split windows (e.g. Code editor on one side and a tutorial video/documentation/StudySync on the other), it is FULLY PRODUCTIVE STUDY WORK.
8. STUDY PLATFORM: StudySync interface or study timer alongside or while setting up study session.

============================================================
CRITERIA FOR TIMEPASS & DISTRACTION (isProductiveWork = false):
============================================================
1. ONLINE SHOPPING & E-COMMERCE: Browsing product listings, e-commerce stores (Amazon, Flipkart, audio gear, electronics, clothes, gadgets, music players, shoes, cars, shopping carts, checkout pages).
2. ENTERTAINMENT VIDEOS: Movies, TV series, anime, sitcoms, comedy sketches, vlogs, travel vlogs, celebrity gossip, reaction videos, music videos, sports matches/highlights, gaming livestreams (Twitch/YouTube Gaming).
3. SOCIAL MEDIA & DOOMSCROLLING: Instagram (Reels/Feed), TikTok, YouTube Shorts, Twitter/X feeds, Reddit memes/jokes, Facebook, Snapchat, Discord non-study chats.
4. GAMING: Playing PC/Console games, Steam games, mobile games, browser games, Minecraft, FPS games, etc.
5. CASUAL BROWSING: Celebrity gossip, pop culture news, random non-academic blogs.
6. BLANK / IDLE: Completely blank/black screen, lock screen, screensaver, or desktop with no open apps/study material.

============================================================
OUTPUT FORMAT:
============================================================
Respond ONLY with valid JSON in this exact structure:
{
  "isProductiveWork": true or false,
  "confidence": 85-100,
  "activitySummary": "Brief 3 to 6 words summary of visible screen (e.g. 'Online Shopping on E-Commerce Store', 'Coding in VS Code', 'Watching YouTube Entertainment Vlog', 'Reading Chemistry Textbook', 'Practicing LeetCode Problems')",
  "category": "coding" | "studying" | "reading" | "research" | "writing" | "entertainment" | "social_media" | "gaming" | "idle" | "other",
  "reason": "One concise, clear sentence explaining what is visible on screen and why it is recognized as productive study work or off-task timepass/shopping."
}`;
    const candidateModels = [
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.6-flash"
    ];
    let lastError = null;
    for (const modelName of candidateModels) {
      try {
        const res = await ai.interactions.create({
          model: modelName,
          input: [
            { type: "text", text: prompt },
            { type: "image", data, mime_type: mimeType }
          ]
        });
        const text = res.output_text || "";
        const cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            isProductiveWork: Boolean(parsed.isProductiveWork),
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 90,
            activitySummary: parsed.activitySummary || (parsed.isProductiveWork ? "Active Study Session" : "Entertainment/Distraction Detected"),
            category: parsed.category || (parsed.isProductiveWork ? "studying" : "entertainment"),
            reason: parsed.reason || (parsed.isProductiveWork ? "Study content verified on screen." : "Off-task/entertainment detected on screen.")
          };
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`[AI Proctor] Model ${modelName} unavailable/throttled, trying next fallback:`, modelErr?.message || modelErr);
        continue;
      }
    }
    if (lastError) {
      throw lastError;
    }
    return {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: "Unverified Screen Content",
      category: "idle",
      reason: "No clear study or productive content detected on screen."
    };
  } catch (err) {
    console.error("AI Screen Analysis error:", err?.message || err);
    return {
      isProductiveWork: false,
      confidence: 75,
      activitySummary: "Inspection Error",
      category: "other",
      reason: "Could not complete screen verification."
    };
  }
}

// server.ts
import { AccessToken } from "livekit-server-sdk";
var isVercel2 = Boolean(process.env.VERCEL);
var isProduction = process.env.NODE_ENV === "production";
var DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10);
var currentPort = DEFAULT_PORT;
var app = express();
var server = http.createServer(app);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
var uploadsDir = isVercel2 ? "/tmp/uploads" : path2.join(process.cwd(), "uploads");
if (!fs2.existsSync(uploadsDir)) {
  try {
    fs2.mkdirSync(uploadsDir, { recursive: true });
  } catch {
  }
}
app.use("/uploads", express.static(uploadsDir));
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
  // 15MB
});
var io = setupSocketServer(server);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, avatarUrl, bio, studyGoal, leetcodeUrl, hackerrankUrl } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }
    const existing = await getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      email,
      passwordHash,
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      bio: bio || "",
      studyGoal: studyGoal || "",
      leetcodeUrl: leetcodeUrl || "",
      hackerrankUrl: hackerrankUrl || "",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const user = await createUser(newUser);
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const { passwordHash, ...cleanUser } = user;
    const token = generateToken(cleanUser);
    res.json({ user: cleanUser, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var passwordResetCodes = /* @__PURE__ */ new Map();
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      res.status(400).json({ error: "Email address is required" });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      res.status(404).json({ error: "No user account found with this email address" });
      return;
    }
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiresAt = Date.now() + 15 * 60 * 1e3;
    passwordResetCodes.set(cleanEmail, { code, expiresAt });
    res.json({
      success: true,
      message: `Reset code generated for ${cleanEmail}`,
      code,
      email: cleanEmail
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Email, verification code, and new password are required" });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const resetEntry = passwordResetCodes.get(cleanEmail);
    if (!resetEntry) {
      res.status(400).json({ error: "No active reset request found. Please request a new code." });
      return;
    }
    if (Date.now() > resetEntry.expiresAt) {
      passwordResetCodes.delete(cleanEmail);
      res.status(400).json({ error: "The verification code has expired. Please request a new code." });
      return;
    }
    if (resetEntry.code !== code.trim()) {
      res.status(400).json({ error: "Invalid verification code. Please check and try again." });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await updateUserPasswordByEmail(cleanEmail, passwordHash);
    if (!updated) {
      res.status(404).json({ error: "User account could not be found" });
      return;
    }
    passwordResetCodes.delete(cleanEmail);
    const updatedUser = await getUserByEmail(cleanEmail);
    if (updatedUser) {
      const { passwordHash: _, ...cleanUser } = updatedUser;
      const token = generateToken(cleanUser);
      res.json({
        success: true,
        message: "Password has been reset successfully",
        user: cleanUser,
        token
      });
    } else {
      res.json({ success: true, message: "Password has been reset successfully" });
    }
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});
app.get("/api/auth/users", async (_req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const { name, avatarUrl, bio, studyGoal, leetcodeUrl, hackerrankUrl } = req.body;
    const updated = await updateUser(req.user.id, {
      ...name !== void 0 && { name },
      ...avatarUrl !== void 0 && { avatarUrl: avatarUrl || "" },
      ...bio !== void 0 && { bio },
      ...studyGoal !== void 0 && { studyGoal },
      ...leetcodeUrl !== void 0 && { leetcodeUrl },
      ...hackerrankUrl !== void 0 && { hackerrankUrl }
    });
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});
app.get("/api/campaigns", optionalAuthMiddleware, async (req, res) => {
  try {
    const campaigns = await getCampaigns(req.user?.id);
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});
app.get("/api/campaigns/:id", optionalAuthMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id, req.user?.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});
app.post("/api/campaigns", authMiddleware, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      startDate,
      endDate,
      dailyStartTime,
      dailyEndTime,
      targetDailyHours,
      schedule,
      maxMembers,
      isPublic,
      bannerColor,
      tags
    } = req.body;
    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: "Name, start date, and end date are required" });
      return;
    }
    const newCampaign = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      description: description || "",
      category: category || "General Studies",
      adminId: req.user.id,
      adminName: req.user.name,
      startDate,
      endDate,
      dailyStartTime: dailyStartTime || "06:00",
      dailyEndTime: dailyEndTime || "22:00",
      targetDailyHours: Number(targetDailyHours) || 4,
      schedule: Array.isArray(schedule) ? schedule : void 0,
      maxMembers: Number(maxMembers) || 25,
      isPublic: isPublic !== void 0 ? Boolean(isPublic) : true,
      bannerColor: bannerColor || "from-emerald-600 to-teal-800",
      tags: Array.isArray(tags) ? tags : tags ? tags.split(",").map((t) => t.trim()) : ["Accountability"],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const created = await createCampaign(newCampaign, req.user);
    res.status(201).json(created);
  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});
app.put("/api/campaigns/:id", authMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id, req.user.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const membership = await getMembership(req.user.id, req.params.id);
    if (campaign.adminId !== req.user.id && membership?.role !== "admin" && membership?.role !== "co-admin") {
      res.status(403).json({ error: "Unauthorized to edit campaign settings" });
      return;
    }
    const updated = await updateCampaign(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error("[PUT /api/campaigns/:id]", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to update campaign" });
  }
});
app.delete("/api/campaigns/:id", authMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id, req.user.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (campaign.adminId !== req.user.id) {
      res.status(403).json({ error: "Only the campaign creator can delete this campaign" });
      return;
    }
    await deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});
app.get("/api/campaigns/:id/members", optionalAuthMiddleware, async (req, res) => {
  try {
    const members = await getCampaignMembers(req.params.id);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});
app.post("/api/campaigns/:id/join", authMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const existing = await getMembership(req.user.id, req.params.id);
    if (existing) {
      if (existing.status === "approved") {
        res.status(400).json({ error: "Already an approved member of this campaign" });
        return;
      } else if (existing.status === "pending") {
        res.status(400).json({ error: "Join request already submitted and pending review" });
        return;
      }
    }
    const members = await getCampaignMembers(req.params.id);
    const approvedCount = members.filter((m) => m.status === "approved").length;
    if (approvedCount >= campaign.maxMembers) {
      res.status(400).json({ error: "This campaign is at maximum member capacity" });
      return;
    }
    const newMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      userAvatarUrl: req.user.avatarUrl,
      campaignId: req.params.id,
      role: "member",
      status: "pending",
      // Pending admin review
      joinedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await createMembership(newMembership);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit join request" });
  }
});
app.put("/api/campaigns/:id/members/:memberId", authMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const callerMembership = await getMembership(req.user.id, req.params.id);
    const isCallerAdmin = campaign.adminId === req.user.id || callerMembership?.role === "admin" || callerMembership?.role === "co-admin";
    if (!isCallerAdmin) {
      res.status(403).json({ error: "Only admins can approve/modify memberships" });
      return;
    }
    const { status, role } = req.body;
    const updated = await updateMembership(req.params.memberId, {
      ...status && { status },
      ...role && { role }
    });
    if (!updated) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update membership" });
  }
});
app.delete("/api/campaigns/:id/members/:memberId", authMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const members = await getCampaignMembers(req.params.id);
    const targetMember = members.find((m) => m.id === req.params.memberId || m.userId === req.params.memberId);
    if (!targetMember) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const isSelf = targetMember.userId === req.user.id;
    const callerMembership = await getMembership(req.user.id, req.params.id);
    const isCallerAdmin = campaign.adminId === req.user.id || callerMembership?.role === "admin" || callerMembership?.role === "co-admin";
    if (!isSelf && !isCallerAdmin) {
      res.status(403).json({ error: "Unauthorized to remove this member" });
      return;
    }
    await deleteMembership(targetMember.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});
app.get("/api/campaigns/:id/leaderboard", async (req, res) => {
  try {
    const leaderboard = await getCampaignLeaderboard(req.params.id);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute leaderboard" });
  }
});
app.post("/api/study/block", authMiddleware, async (req, res) => {
  try {
    const { campaignId, status = "active", subjectNote, snapshotUrl } = req.body;
    if (!campaignId) {
      res.status(400).json({ error: "campaignId is required" });
      return;
    }
    const campaign = await getCampaignById(campaignId);
    const block = {
      id: `blk_${req.user.id}_${Date.now()}`,
      userId: req.user.id,
      userName: req.user.name,
      userAvatarUrl: req.user.avatarUrl,
      campaignId,
      campaignName: campaign?.name || "Study Campaign",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      durationMinutes: 5,
      status: status === "idle" ? "idle" : "active",
      subjectNote: subjectNote || "Focus Study",
      snapshotUrl: snapshotUrl || void 0
    };
    const saved = await logStudyBlock(block);
    io.to(`campaign:${campaignId}`).emit("study:block_logged", {
      block: saved,
      userId: req.user.id
    });
    res.status(201).json(saved);
  } catch (err) {
    console.error("Log block error:", err);
    res.status(500).json({ error: "Failed to log study block" });
  }
});
app.post("/api/study/session/heartbeat", authMiddleware, (req, res) => {
  const { campaignId, campaignName, subjectNote, startedAt } = req.body;
  if (!campaignId) {
    res.status(400).json({ error: "campaignId required" });
    return;
  }
  touchStudySession({
    userId: req.user.id,
    userName: req.user.name,
    userAvatarUrl: req.user.avatarUrl,
    campaignId,
    campaignName: campaignName || "Study Campaign",
    subjectNote: subjectNote || "Focus Study",
    startedAt: startedAt || (/* @__PURE__ */ new Date()).toISOString(),
    activeMinutes: 0
  });
  res.json({ success: true, activeStudySessions: getActiveStudySessions() });
});
app.post("/api/study/session/stop", authMiddleware, (req, res) => {
  removeStudySession(req.user.id);
  res.json({ success: true, activeStudySessions: getActiveStudySessions() });
});
app.get("/api/study/sessions", (_req, res) => {
  res.json(getActiveStudySessions());
});
app.post("/api/study/verify-screen", authMiddleware, async (req, res) => {
  try {
    const { campaignId, subjectNote, snapshotUrl } = req.body;
    if (!campaignId || !snapshotUrl) {
      res.status(400).json({ error: "campaignId and snapshotUrl are required" });
      return;
    }
    let campaignName = "Study Campaign";
    try {
      const campaign = await getCampaignById(campaignId);
      if (campaign?.name) campaignName = campaign.name;
    } catch (cErr) {
      console.warn("Could not fetch campaign name for proctor:", cErr);
    }
    const analysis = await analyzeScreenSnapshot(
      snapshotUrl,
      campaignName,
      subjectNote || "Focus Study"
    );
    let savedBlock = null;
    if (analysis.isProductiveWork) {
      const block = {
        id: `blk_${req.user.id}_${Date.now()}`,
        userId: req.user.id,
        userName: req.user.name,
        userAvatarUrl: req.user.avatarUrl,
        campaignId,
        campaignName,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        durationMinutes: 5,
        status: "active",
        subjectNote: subjectNote || analysis.activitySummary || "Focus Study",
        snapshotUrl
      };
      try {
        savedBlock = await logStudyBlock(block);
      } catch (dbErr) {
        console.error("Failed to persist study block in DB:", dbErr);
        savedBlock = block;
      }
      try {
        io.to(`campaign:${campaignId}`).emit("study:block_logged", {
          block: savedBlock,
          userId: req.user.id,
          campaignId
        });
        io.emit("study:block_logged", {
          block: savedBlock,
          userId: req.user.id,
          campaignId
        });
      } catch {
      }
    }
    res.json({
      registered: analysis.isProductiveWork,
      analysis,
      block: savedBlock
    });
  } catch (err) {
    console.error("Verify screen error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to verify screen snapshot" });
  }
});
app.get("/api/study/stats", authMiddleware, async (req, res) => {
  try {
    const userBlocks = await getStudyBlocksForUser(req.user.id);
    const activeBlocks = userBlocks.filter((b) => b.status === "active");
    const now = /* @__PURE__ */ new Date();
    const todayDateStr = now.toISOString().split("T")[0];
    const todayLocalDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 864e5;
    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;
    const dailyMinutesMap = {};
    activeBlocks.forEach((b) => {
      const bTime = new Date(b.timestamp).getTime();
      const dateStr = b.timestamp.split("T")[0];
      dailyMinutesMap[dateStr] = (dailyMinutesMap[dateStr] || 0) + b.durationMinutes;
      totalMinutes += b.durationMinutes;
      const isToday = b.timestamp.startsWith(todayDateStr) || b.timestamp.startsWith(todayLocalDateStr) || bTime >= todayStart;
      if (isToday) todayMinutes += b.durationMinutes;
      if (bTime >= weekStart || isToday) thisWeekMinutes += b.durationMinutes;
    });
    const recentDays = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 864e5);
      const dateStr = date.toISOString().split("T")[0];
      recentDays.push({
        date: dateStr,
        dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()],
        minutes: dailyMinutesMap[dateStr] || 0,
        hours: Number(((dailyMinutesMap[dateStr] || 0) / 60).toFixed(1))
      });
    }
    res.json({
      todayMinutes,
      todayHours: Number((todayMinutes / 60).toFixed(1)),
      thisWeekMinutes,
      thisWeekHours: Number((thisWeekMinutes / 60).toFixed(1)),
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      recentDays,
      totalBlocksCount: userBlocks.length,
      activeBlocksCount: activeBlocks.length
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user study stats" });
  }
});
app.get("/api/study/history", authMiddleware, async (req, res) => {
  try {
    const campaignId = req.query.campaignId;
    const userBlocks = await getStudyBlocksForUser(req.user.id, campaignId);
    const sortedBlocks = userBlocks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const now = /* @__PURE__ */ new Date();
    const todayDateStr = now.toISOString().split("T")[0];
    const todayLocalDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 864e5;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let thisMonthMinutes = 0;
    let totalMinutes = 0;
    sortedBlocks.forEach((b) => {
      if (b.status === "active") {
        const bTime = new Date(b.timestamp).getTime();
        totalMinutes += b.durationMinutes;
        const isToday = b.timestamp.startsWith(todayDateStr) || b.timestamp.startsWith(todayLocalDateStr) || bTime >= todayStart;
        if (isToday) todayMinutes += b.durationMinutes;
        if (bTime >= weekStart || isToday) thisWeekMinutes += b.durationMinutes;
        if (bTime >= monthStart) thisMonthMinutes += b.durationMinutes;
      }
    });
    res.json({
      blocks: sortedBlocks,
      todayMinutes,
      thisWeekMinutes,
      thisMonthMinutes,
      totalMinutes
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch study history" });
  }
});
app.get("/api/messages/campaign/:campaignId", authMiddleware, async (req, res) => {
  try {
    const messages = await getCampaignMessages(req.params.campaignId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});
app.get("/api/messages/direct/:otherUserId", authMiddleware, async (req, res) => {
  try {
    const messages = await getDirectMessages(req.user.id, req.params.otherUserId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch direct messages" });
  }
});
app.post("/api/messages", authMiddleware, async (req, res) => {
  try {
    const { campaignId, recipientId, content, attachmentUrl, attachmentName, attachmentType } = req.body;
    if (!content && !attachmentUrl) {
      res.status(400).json({ error: "Message must have content or an attachment" });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newMsg = {
      id: req.body.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: req.user.id,
      senderName: req.user.name,
      senderAvatarUrl: req.user.avatarUrl,
      campaignId: campaignId || null,
      recipientId: recipientId || null,
      content: content || "",
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
      attachmentType: attachmentType || null,
      createdAt: now,
      timestamp: now,
      reactions: []
    };
    const saved = await createMessage(newMsg);
    if (io) {
      if (saved.campaignId) {
        io.to(`campaign:${saved.campaignId}`).emit("message:new", saved);
      } else if (saved.recipientId) {
        io.to(`user:${saved.senderId}`).to(`user:${saved.recipientId}`).emit("message:new", saved);
      }
    }
    res.status(201).json(saved);
  } catch (err) {
    console.error("Failed to send message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});
app.post("/api/upload", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const isImage = req.file.mimetype.startsWith("image/");
  const ext = path2.extname(req.file.originalname) || (isImage ? ".jpg" : ".bin");
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  let fileUrl = `/uploads/${req.file.filename || uniqueName}`;
  try {
    let fileBuffer = null;
    if (req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (req.file.path && fs2.existsSync(req.file.path)) {
      fileBuffer = fs2.readFileSync(req.file.path);
    }
    if (supabase && fileBuffer) {
      try {
        const bucketName = "study-uploads";
        const { error: uploadError } = await supabase.storage.from(bucketName).upload(uniqueName, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true
        });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uniqueName);
          if (publicUrlData?.publicUrl) {
            fileUrl = publicUrlData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn("[Storage] Supabase storage upload warning:", storageErr);
      }
    }
    if (fileBuffer && (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://"))) {
      if (fileBuffer.length <= 8 * 1024 * 1024) {
        const b64 = fileBuffer.toString("base64");
        fileUrl = `data:${req.file.mimetype || (isImage ? "image/jpeg" : "application/octet-stream")};base64,${b64}`;
      }
    }
  } catch (err) {
    console.error("Upload processing error:", err);
  }
  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    originalName: req.file.originalname,
    name: req.file.originalname,
    type: isImage ? "image" : "file",
    size: req.file.size
  });
});
app.post("/api/messages/:messageId/react", authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    const updated = await toggleMessageReaction(req.params.messageId, emoji, req.user.id, req.user.name);
    res.json(updated || { success: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});
app.post("/api/presence/heartbeat", authMiddleware, (req, res) => {
  const userId = req.user.id;
  touchUserPresence(userId, req.user.name, req.user.avatarUrl);
  const { isStudying, campaignId, campaignName, subjectNote, startedAt } = req.body || {};
  if (isStudying === true && campaignId) {
    touchStudySession({
      userId,
      userName: req.user.name,
      userAvatarUrl: req.user.avatarUrl,
      campaignId,
      campaignName: campaignName || "Study Campaign",
      subjectNote: subjectNote || "Focus Study",
      startedAt: startedAt || (/* @__PURE__ */ new Date()).toISOString(),
      activeMinutes: 0
    });
  } else if (isStudying === false) {
    removeStudySession(userId);
  }
  res.json({
    onlineUserIds: getOnlineUserIds(),
    activeStudySessions: getActiveStudySessions()
  });
});
app.post("/api/presence/leave", optionalAuthMiddleware, (req, res) => {
  const userId = req.user?.id || req.body?.userId;
  if (userId) {
    removeUserPresence(userId);
  }
  res.json({ success: true });
});
app.get("/api/presence", (_req, res) => {
  res.json({
    onlineUserIds: getOnlineUserIds(),
    activeStudySessions: getActiveStudySessions()
  });
});
app.post("/api/livekit/token", authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    const apiKey = process.env.LIVEKIT_API_KEY || "API7ZiCFQEGGpYa";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "mpqMnhk8LejhzDD9OqExRVaWip7GrdqZP6dtEjmbV7S";
    const livekitUrl = process.env.LIVEKIT_URL || "wss://santam-kfcwvgq2.livekit.cloud";
    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.user.id,
      name: req.user.name,
      ttl: "4h"
    });
    at.addGrant({
      roomJoin: true,
      room: `study-${campaignId}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });
    const token = await at.toJwt();
    res.json({ token, url: livekitUrl });
  } catch (err) {
    console.error("LiveKit token error:", err);
    res.status(500).json({ error: "Failed to generate token", detail: String(err) });
  }
});
app.get("/api/calls/:campaignId", async (req, res) => {
  try {
    const session = await getCallSession(req.params.campaignId);
    if (!session) return res.json({ participants: [] });
    const now = Date.now();
    const alive = session.participants.filter((p) => {
      if (!p.lastSeen) return true;
      return now - new Date(p.lastSeen).getTime() < 2e4;
    });
    if (alive.length !== session.participants.length) {
      session.participants = alive;
      if (alive.length === 0) {
        await saveCallSession(req.params.campaignId, null);
      } else {
        await saveCallSession(req.params.campaignId, session);
      }
    }
    res.json({ ...session, participants: alive });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch call session" });
  }
});
app.post("/api/calls/:campaignId/join", authMiddleware, async (req, res) => {
  try {
    const { isMuted, isDeafened, isScreenSharing } = req.body;
    const session = await addCallParticipant(req.params.campaignId, {
      userId: req.user.id,
      userName: req.user.name,
      userAvatarUrl: req.user.avatarUrl,
      isMuted: isMuted ?? false,
      isDeafened: isDeafened ?? false,
      isScreenSharing: isScreenSharing ?? false,
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastSeen: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to join call" });
  }
});
app.post("/api/calls/:campaignId/heartbeat", authMiddleware, async (req, res) => {
  try {
    const { isMuted, isScreenSharing } = req.body || {};
    const session = await addCallParticipant(req.params.campaignId, {
      userId: req.user.id,
      userName: req.user.name,
      userAvatarUrl: req.user.avatarUrl,
      isMuted: isMuted ?? false,
      isScreenSharing: isScreenSharing ?? false,
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastSeen: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ ok: true, participantCount: session.participants.length });
  } catch (err) {
    res.status(500).json({ error: "Heartbeat failed" });
  }
});
app.post("/api/calls/:campaignId/leave", authMiddleware, async (req, res) => {
  try {
    const session = await removeCallParticipant(req.params.campaignId, req.user.id);
    res.json(session || { participants: [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to leave call" });
  }
});
async function startServer() {
  await initDb();
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: 24679 }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  function tryListen(port) {
    server.listen(port, "0.0.0.0", () => {
      console.log(`
========================================`);
      console.log(` StudySync is running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);
      console.log(` URL: http://localhost:${port}`);
      console.log(`========================================
`);
    });
  }
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && !isProduction) {
      console.warn(`[Port in use] Port ${currentPort} is busy. Trying port ${currentPort + 1}...`);
      currentPort += 1;
      setTimeout(() => {
        tryListen(currentPort);
      }, 500);
    } else {
      console.error("Server error:", err);
    }
  });
  tryListen(currentPort);
}
var server_default = app;
if (!isVercel2) {
  startServer();
}
export {
  app,
  server_default as default,
  server
};
//# sourceMappingURL=index.js.map
