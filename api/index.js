// server.ts
import express from "express";
import http from "http";
import path2 from "path";
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
    studyBlocks: []
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
function extractCodingLinks(rawBio) {
  let cleanBio = rawBio || "";
  let leetcodeUrl = "";
  let hackerrankUrl = "";
  const lcMatch = cleanBio.match(/\[leetcode:([^\]]+)\]/i);
  if (lcMatch) {
    leetcodeUrl = lcMatch[1].trim();
    cleanBio = cleanBio.replace(lcMatch[0], "").trim();
  }
  const hrMatch = cleanBio.match(/\[hackerrank:([^\]]+)\]/i);
  if (hrMatch) {
    hackerrankUrl = hrMatch[1].trim();
    cleanBio = cleanBio.replace(hrMatch[0], "").trim();
  }
  return { cleanBio, leetcodeUrl, hackerrankUrl };
}
function packBioWithCodingLinks(bio, leetcodeUrl, hackerrankUrl) {
  const { cleanBio, leetcodeUrl: existingLc, hackerrankUrl: existingHr } = extractCodingLinks(bio || "");
  const finalLc = (leetcodeUrl !== void 0 ? leetcodeUrl : existingLc).trim();
  const finalHr = (hackerrankUrl !== void 0 ? hackerrankUrl : existingHr).trim();
  let packed = cleanBio;
  if (finalLc) packed += ` [leetcode:${finalLc}]`;
  if (finalHr) packed += ` [hackerrank:${finalHr}]`;
  return packed.trim();
}
function mapUserFromDb(row) {
  const extracted = extractCodingLinks(row.bio || "");
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url || "",
    bio: extracted.cleanBio,
    studyGoal: row.study_goal || "",
    leetcodeUrl: row.leetcode_url || row.leetcodeUrl || extracted.leetcodeUrl || "",
    hackerrankUrl: row.hackerrank_url || row.hackerrankUrl || extracted.hackerrankUrl || "",
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
var cacheStore = /* @__PURE__ */ new Map();
function getFromCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}
function setToCache(key, data, ttlMs = 4e3) {
  cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}
function invalidateCache(prefix) {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
}
async function getUsers() {
  const cached = getFromCache("all_users");
  if (cached) return cached;
  if (supabase) {
    const { data, error } = await supabase.from("users").select("id, name, email, avatar_url, bio, study_goal, created_at");
    if (!error && data) {
      const mapped2 = data.map((r) => {
        const u = mapUserFromDb(r);
        const { passwordHash, ...clean } = u;
        return clean;
      });
      return setToCache("all_users", mapped2, 5e3);
    }
  }
  const db = await initDb();
  const mapped = db.users.map(({ passwordHash, ...user }) => user);
  return setToCache("all_users", mapped, 5e3);
}
async function getUserById(id) {
  const cacheKey = `user_id_${id}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  if (supabase) {
    const { data, error } = await supabase.from("users").select("id, name, email, password_hash, avatar_url, bio, study_goal, created_at").eq("id", id).single();
    if (!error && data) {
      const mapped = mapUserFromDb(data);
      return setToCache(cacheKey, mapped, 5e3);
    }
  }
  const db = await initDb();
  const local = db.users.find((u) => u.id === id);
  if (local) setToCache(cacheKey, local, 5e3);
  return local;
}
async function getUserByEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  const cacheKey = `user_email_${cleanEmail}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  if (supabase) {
    const { data, error } = await supabase.from("users").select("id, name, email, password_hash, avatar_url, bio, study_goal, created_at").ilike("email", cleanEmail).single();
    if (!error && data) {
      const mapped = mapUserFromDb(data);
      return setToCache(cacheKey, mapped, 5e3);
    }
  }
  const db = await initDb();
  const local = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (local) setToCache(cacheKey, local, 5e3);
  return local;
}
async function createUser(userData) {
  invalidateCache("user");
  invalidateCache("all_users");
  const packedBio = packBioWithCodingLinks(userData.bio, userData.leetcodeUrl, userData.hackerrankUrl);
  if (supabase) {
    const fullPayload = {
      id: userData.id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password_hash: userData.passwordHash,
      avatar_url: userData.avatarUrl || "",
      bio: packedBio,
      study_goal: userData.studyGoal || "",
      leetcode_url: userData.leetcodeUrl || "",
      hackerrank_url: userData.hackerrankUrl || "",
      created_at: userData.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    const { error } = await supabase.from("users").insert(fullPayload);
    if (error) {
      delete fullPayload.leetcode_url;
      delete fullPayload.hackerrank_url;
      const { error: fbErr } = await supabase.from("users").insert(fullPayload);
      if (fbErr) console.error("Supabase createUser error fallback:", fbErr);
    }
  }
  const db = await initDb();
  db.users.push({
    ...userData,
    bio: userData.bio || "",
    leetcodeUrl: userData.leetcodeUrl || "",
    hackerrankUrl: userData.hackerrankUrl || ""
  });
  saveDb();
  const { passwordHash, ...user } = userData;
  return user;
}
async function updateUserPasswordByEmail(email, newPasswordHash) {
  invalidateCache("user");
  invalidateCache("all_users");
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
  invalidateCache("user");
  invalidateCache("all_users");
  invalidateCache("camps");
  invalidateCache("leaderboard");
  if (supabase) {
    const { data: existingRow } = await supabase.from("users").select("*").eq("id", id).single();
    const existingExtracted = existingRow ? extractCodingLinks(existingRow.bio || "") : { cleanBio: "", leetcodeUrl: "", hackerrankUrl: "" };
    const targetBio = updates.bio !== void 0 ? updates.bio : existingExtracted.cleanBio;
    const targetLc = updates.leetcodeUrl !== void 0 ? updates.leetcodeUrl : existingRow?.leetcode_url || existingExtracted.leetcodeUrl;
    const targetHr = updates.hackerrankUrl !== void 0 ? updates.hackerrankUrl : existingRow?.hackerrank_url || existingExtracted.hackerrankUrl;
    const packedBio = packBioWithCodingLinks(targetBio, targetLc, targetHr);
    const payload = { bio: packedBio };
    if (updates.name !== void 0) payload.name = updates.name;
    if (updates.avatarUrl !== void 0) payload.avatar_url = updates.avatarUrl;
    if (updates.studyGoal !== void 0) payload.study_goal = updates.studyGoal;
    if (updates.leetcodeUrl !== void 0) payload.leetcode_url = updates.leetcodeUrl;
    if (updates.hackerrankUrl !== void 0) payload.hackerrank_url = updates.hackerrankUrl;
    let res = await supabase.from("users").update(payload).eq("id", id).select().single();
    if (res.error) {
      delete payload.leetcode_url;
      delete payload.hackerrank_url;
      res = await supabase.from("users").update(payload).eq("id", id).select().single();
    }
    if (!res.error && res.data) {
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
      const full = mapUserFromDb(res.data);
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
  const cacheKey = `camps_${userId || "all"}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  if (supabase) {
    const { data: camps, error } = await supabase.from("campaigns").select("id, name, description, category, admin_id, admin_name, start_date, end_date, daily_start_time, daily_end_time, target_daily_hours, schedule, max_members, is_public, banner_color, tags, created_at").order("created_at", { ascending: false });
    if (!error && camps) {
      const { data: members } = await supabase.from("memberships").select("campaign_id, user_id, role, status");
      const allMembers = (members || []).map(mapMembershipFromDb);
      const result2 = camps.map(mapCampaignFromDb).map((c) => {
        const approved = allMembers.filter((m) => m.campaignId === c.id && m.status === "approved");
        const userMem = userId ? allMembers.find((m) => m.campaignId === c.id && m.userId === userId) : void 0;
        const isCreator = Boolean(userId && c.adminId === userId);
        return {
          ...c,
          memberCount: approved.length,
          userStatus: isCreator ? "approved" : userMem ? userMem.status : void 0,
          userRole: isCreator ? "admin" : userMem ? userMem.role : void 0
        };
      });
      return setToCache(cacheKey, result2, 4e3);
    }
  }
  const db = await initDb();
  const result = db.campaigns.map((c) => {
    const approvedMembers = db.memberships.filter((m) => m.campaignId === c.id && m.status === "approved");
    let userMembership = userId ? db.memberships.find((m) => m.campaignId === c.id && m.userId === userId) : void 0;
    const isCreator = Boolean(userId && c.adminId === userId);
    return {
      ...c,
      memberCount: approvedMembers.length,
      userStatus: isCreator ? "approved" : userMembership ? userMembership.status : void 0,
      userRole: isCreator ? "admin" : userMembership ? userMembership.role : void 0
    };
  });
  return setToCache(cacheKey, result, 4e3);
}
async function getCampaignById(id, userId) {
  const cacheKey = `camp_${id}_${userId || "all"}`;
  const cached = getFromCache(cacheKey);
  if (cached !== null) return cached;
  if (supabase) {
    const { data: camp, error } = await supabase.from("campaigns").select("id, name, description, category, admin_id, admin_name, start_date, end_date, daily_start_time, daily_end_time, target_daily_hours, schedule, max_members, is_public, banner_color, tags, created_at").eq("id", id).single();
    if (!error && camp) {
      const { data: members } = await supabase.from("memberships").select("campaign_id, user_id, user_name, user_avatar_url, role, status").eq("campaign_id", id);
      const allMembers = (members || []).map(mapMembershipFromDb);
      const approved = allMembers.filter((m) => m.status === "approved");
      const userMem = userId ? allMembers.find((m) => m.userId === userId) : void 0;
      const c = mapCampaignFromDb(camp);
      const isCreator2 = Boolean(userId && c.adminId === userId);
      const result2 = {
        ...c,
        memberCount: approved.length,
        userStatus: isCreator2 ? "approved" : userMem ? userMem.status : void 0,
        userRole: isCreator2 ? "admin" : userMem ? userMem.role : void 0
      };
      return setToCache(cacheKey, result2, 4e3);
    }
  }
  const db = await initDb();
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) return null;
  const approvedMembers = db.memberships.filter((m) => m.campaignId === campaign.id && m.status === "approved");
  let userMembership = userId ? db.memberships.find((m) => m.campaignId === campaign.id && m.userId === userId) : void 0;
  const isCreator = Boolean(userId && campaign.adminId === userId);
  const result = {
    ...campaign,
    memberCount: approvedMembers.length,
    userStatus: isCreator ? "approved" : userMembership ? userMembership.status : void 0,
    userRole: isCreator ? "admin" : userMembership ? userMembership.role : void 0
  };
  return setToCache(cacheKey, result, 4e3);
}
async function createCampaign(campaign, creator) {
  invalidateCache("camp");
  invalidateCache("camps");
  invalidateCache("leaderboard");
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
      max_members: Number(campaign.maxMembers) || 25,
      is_public: campaign.isPublic !== void 0 ? Boolean(campaign.isPublic) : true,
      tags: Array.isArray(campaign.tags) ? campaign.tags : [],
      banner_color: campaign.bannerColor || "#3b82f6",
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
  invalidateCache("camp");
  invalidateCache("camps");
  invalidateCache("leaderboard");
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
  invalidateCache("camp");
  invalidateCache("camps");
  invalidateCache("leaderboard");
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
  const cacheKey = `members_${campaignId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  if (supabase) {
    const { data, error } = await supabase.from("memberships").select("id, campaign_id, user_id, user_name, user_email, user_avatar_url, role, status, joined_at").eq("campaign_id", campaignId);
    if (!error && data) {
      const mapped2 = data.map(mapMembershipFromDb);
      return setToCache(cacheKey, mapped2, 4e3);
    }
  }
  const db = await initDb();
  const mapped = db.memberships.filter((m) => m.campaignId === campaignId);
  return setToCache(cacheKey, mapped, 4e3);
}
async function getMembership(userId, campaignId) {
  const cacheKey = `mem_${userId}_${campaignId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  if (supabase) {
    const { data, error } = await supabase.from("memberships").select("id, campaign_id, user_id, user_name, user_email, user_avatar_url, role, status, joined_at").eq("user_id", userId).eq("campaign_id", campaignId).single();
    if (!error && data) {
      const mapped = mapMembershipFromDb(data);
      return setToCache(cacheKey, mapped, 4e3);
    }
  }
  const db = await initDb();
  const local = db.memberships.find((m) => m.userId === userId && m.campaignId === campaignId);
  if (local) setToCache(cacheKey, local, 4e3);
  return local;
}
async function createMembership(membership) {
  invalidateCache("camp");
  invalidateCache("camps");
  invalidateCache("members");
  invalidateCache("mem_");
  invalidateCache("leaderboard");
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
  invalidateCache("camp");
  invalidateCache("camps");
  invalidateCache("members");
  invalidateCache("mem_");
  invalidateCache("leaderboard");
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
  invalidateCache("study_blocks");
  invalidateCache("leaderboard");
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
      snapshot_url: block.snapshotUrl && !block.snapshotUrl.startsWith("data:") ? block.snapshotUrl : null
    });
  }
  const db = await initDb();
  db.studyBlocks.push(block);
  saveDb();
  return block;
}
async function getStudyBlocksForUser(userId, campaignId) {
  const cacheKey = `study_blocks_${userId}_${campaignId || "all"}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  if (supabase) {
    let query = supabase.from("study_blocks").select("id, user_id, user_name, user_avatar_url, campaign_id, campaign_name, timestamp, duration_minutes, status, subject_note").eq("user_id", userId).order("timestamp", { ascending: false }).limit(100);
    if (campaignId) query = query.eq("campaign_id", campaignId);
    const { data, error } = await query;
    if (!error && data) {
      const mapped2 = data.map(mapStudyBlockFromDb);
      return setToCache(cacheKey, mapped2, 5e3);
    }
  }
  const db = await initDb();
  const mapped = db.studyBlocks.filter((b) => b.userId === userId && (!campaignId || b.campaignId === campaignId));
  return setToCache(cacheKey, mapped, 5e3);
}
async function getCampaignLeaderboard(campaignId) {
  const cacheKey = `leaderboard_${campaignId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  let approvedMembers = [];
  let campaignBlocks = [];
  let targetHours = 4;
  let allUsers = [];
  if (supabase) {
    const [campRes, memsRes, blksRes, usersRes] = await Promise.all([
      supabase.from("campaigns").select("target_daily_hours").eq("id", campaignId).single(),
      supabase.from("memberships").select("id, campaign_id, user_id, user_name, user_avatar_url, role, status").eq("campaign_id", campaignId).eq("status", "approved"),
      supabase.from("study_blocks").select("id, campaign_id, user_id, user_name, user_avatar_url, duration_minutes, timestamp, status").eq("campaign_id", campaignId).eq("status", "active").limit(500),
      supabase.from("users").select("id, bio").limit(200)
    ]);
    if (campRes.data) targetHours = Number(campRes.data.target_daily_hours) || 4;
    if (memsRes.data) approvedMembers = memsRes.data.map(mapMembershipFromDb);
    if (blksRes.data) campaignBlocks = blksRes.data.map(mapStudyBlockFromDb);
    if (usersRes.data) {
      allUsers = usersRes.data.map((u) => {
        const extracted = extractCodingLinks(u.bio || "");
        return {
          id: u.id,
          leetcodeUrl: extracted.leetcodeUrl,
          hackerrankUrl: extracted.hackerrankUrl
        };
      });
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
  const adjustedNow = new Date(now.getTime() - 2 * 36e5);
  const todayStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate(), 2, 0, 0, 0).getTime();
  const weekStart = todayStart - 6 * 864e5;
  const monthStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), 1, 2, 0, 0, 0).getTime();
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
      const bDate = new Date(bTime - 2 * 36e5);
      const bDateStr = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, "0")}-${String(bDate.getDate()).padStart(2, "0")}`;
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
      const checkDate = new Date(adjustedNow.getTime() - d * 864e5);
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
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
  const sorted = entries.sort((a, b) => b.todayMinutes - a.todayMinutes);
  return setToCache(cacheKey, sorted, 4e3);
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
function generateResetToken(email, code) {
  return jwt.sign(
    {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      type: "password_reset"
    },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
}
function verifyResetToken(token, email, code) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.type === "password_reset" && decoded.email === email.trim().toLowerCase() && decoded.code === code.trim();
  } catch {
    return false;
  }
}
function checkPasswordStrength(password) {
  const pwd = password || "";
  const hasMinLength = pwd.length >= 8;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const isValid = hasMinLength && hasLower && hasUpper && hasNumber && hasSymbol;
  let error;
  if (!hasMinLength) {
    error = "Password must be at least 8 characters long.";
  } else if (!hasLower) {
    error = "Password must include at least one lowercase letter (a-z).";
  } else if (!hasUpper) {
    error = "Password must include at least one uppercase letter (A-Z).";
  } else if (!hasNumber) {
    error = "Password must include at least one number (0-9).";
  } else if (!hasSymbol) {
    error = "Password must include at least one special symbol (!@#$%^&* etc.).";
  }
  return {
    isValid,
    hasMinLength,
    hasLower,
    hasUpper,
    hasNumber,
    hasSymbol,
    error
  };
}

// src/server/email.ts
import nodemailer from "nodemailer";
async function sendPasswordResetEmail(email, code, userName) {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = userName || "Student";
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StudySync Verification Code</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #ffffff; margin: 0; padding: 24px; }
      .container { max-width: 520px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
      .header { text-align: center; margin-bottom: 28px; }
      .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 6px; }
      .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 9999px; }
      .code-box { background: #000000; border: 1px solid #3f3f46; border-radius: 18px; padding: 24px; text-align: center; margin: 26px 0; }
      .code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #ffffff; }
      .expire { font-size: 12px; color: #a1a1aa; margin-top: 10px; font-weight: 500; }
      .text { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin: 12px 0; }
      .footer { margin-top: 36px; border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #71717a; text-align: center; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">StudySync</div>
        <div class="badge">Password Reset Request</div>
      </div>
      <p class="text">Hello <strong>${displayName}</strong>,</p>
      <p class="text">We received a request to reset the password for your StudySync account. Use the 6-digit verification code below to proceed:</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="expire">\u23F1\uFE0F Valid for 15 minutes</div>
      </div>

      <p class="text" style="font-size: 12px; color: #a1a1aa;">
        If you did not request this verification code, you can safely disregard this email. Your password will remain unchanged.
      </p>

      <div class="footer">
        &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} StudySync. Real-Time Peer Accountability & AI Focus.
      </div>
    </div>
  </body>
  </html>
  `;
  const emailjsServiceId = process.env.EMAILJS_SERVICE_ID || "service_i6r1yid";
  const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID || "template_1akl3na";
  const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID || "tLbdllvmFDU2XM2B1";
  const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY || "24OR0gLbbuC4ErQekfstW";
  if (emailjsServiceId && emailjsTemplateId && (emailjsPublicKey || emailjsPrivateKey)) {
    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId,
          user_id: emailjsPublicKey,
          ...emailjsPrivateKey && { accessToken: emailjsPrivateKey },
          template_params: {
            to_email: cleanEmail,
            email: cleanEmail,
            user_email: cleanEmail,
            recipient_email: cleanEmail,
            to_name: displayName,
            name: displayName,
            user_name: displayName,
            otp_code: code,
            code,
            otp: code,
            passcode: code,
            verification_code: code,
            message: `Your StudySync 6-digit verification code is: ${code}. It expires in 15 minutes.`
          }
        })
      });
      if (res.ok) {
        console.log(`[Email] EmailJS successfully dispatched OTP to ${cleanEmail}`);
        return { success: true };
      } else {
        const errText = await res.text().catch(() => "");
        console.warn("[Email] EmailJS API response status:", res.status, errText);
      }
    } catch (ejsErr) {
      console.warn("[Email] EmailJS API exception:", ejsErr);
    }
  }
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "StudySync Security <onboarding@resend.dev>",
          to: [cleanEmail],
          subject: `Your StudySync Verification Code: ${code}`,
          html: htmlContent
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.id) {
        console.log(`[Email] Resend dispatched OTP to ${cleanEmail} (ID: ${data.id})`);
        return { success: true, messageId: data.id };
      } else {
        console.warn("[Email] Resend API error response:", data);
      }
    } catch (rErr) {
      console.warn("[Email] Resend API exception:", rErr);
    }
  }
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendgridApiKey}`
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cleanEmail }] }],
          from: { email: process.env.EMAIL_FROM || "security@studysync.app", name: "StudySync Security" },
          subject: `Your StudySync Verification Code: ${code}`,
          content: [{ type: "text/html", value: htmlContent }]
        })
      });
      if (res.ok) {
        console.log(`[Email] SendGrid dispatched OTP to ${cleanEmail}`);
        return { success: true };
      }
    } catch (sgErr) {
      console.warn("[Email] SendGrid API exception:", sgErr);
    }
  }
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  if (smtpHost && smtpUser && smtpPass || smtpUser && smtpPass && smtpUser.includes("@gmail.com")) {
    try {
      const transporter = smtpUser.includes("@gmail.com") && !smtpHost ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass }
      }) : nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const fromAddress = process.env.EMAIL_FROM || smtpUser;
      const info = await transporter.sendMail({
        from: fromAddress.includes("<") ? fromAddress : `"StudySync Security" <${fromAddress}>`,
        to: cleanEmail,
        subject: `Your StudySync Verification Code: ${code}`,
        text: `Hello ${displayName},

Your 6-digit StudySync password reset code is: ${code}

This code expires in 15 minutes.`,
        html: htmlContent
      });
      console.log(`[Email] SMTP dispatched OTP to ${cleanEmail} (ID: ${info?.messageId})`);
      return { success: true, messageId: info?.messageId };
    } catch (smtpErr) {
      console.error(`[Email] SMTP delivery failed to ${cleanEmail}:`, smtpErr?.message || smtpErr);
    }
  }
  if (supabase) {
    try {
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${process.env.APP_URL || "https://123studysync.vercel.app"}/reset-password`
      });
      console.log(`[Email] Supabase auth reset triggered for ${cleanEmail}`);
    } catch (supaErr) {
      console.warn("[Email] Supabase auth reset exception:", supaErr);
    }
  }
  console.warn(`[Email Notice] No active mail provider configured (RESEND_API_KEY or SMTP_USER/SMTP_PASS).`);
  return {
    success: false,
    error: "Email service credentials not configured. Please add RESEND_API_KEY or Gmail SMTP in your environment."
  };
}

// src/server/socket.ts
import { Server } from "socket.io";
var connectedUsers = /* @__PURE__ */ new Map();
var activeStudySessions = /* @__PURE__ */ new Map();
var restHeartbeats = /* @__PURE__ */ new Map();
var restStudySessions = /* @__PURE__ */ new Map();
var ioInstance = null;
function getOnlineUserIds() {
  const cutoff = Date.now() - 45e3;
  for (const [id, data] of restHeartbeats.entries()) {
    if (data.lastSeen < cutoff) restHeartbeats.delete(id);
  }
  const socketUserIds = Array.from(connectedUsers.values()).map((u) => u.userId);
  const restUserIds = Array.from(restHeartbeats.keys());
  return Array.from(/* @__PURE__ */ new Set([...socketUserIds, ...restUserIds]));
}
function getActiveStudySessions() {
  const cutoff = Date.now() - 45e3;
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
      broadcastOnlineUsers();
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
    socket.on("study:start_session", ({ campaignId, campaignName, subjectNote }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      const liveSession = {
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        campaignId,
        campaignName,
        subjectNote,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        activeMinutes: 0
      };
      activeStudySessions.set(user.userId, liveSession);
      restStudySessions.delete(user.userId);
      broadcastStudySessions();
    });
    socket.on("study:stop_session", () => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      activeStudySessions.delete(user.userId);
      restStudySessions.delete(user.userId);
      broadcastStudySessions();
    });
    socket.on("study:heartbeat", ({ activeMinutes }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;
      const session = activeStudySessions.get(user.userId);
      if (session) {
        session.activeMinutes = activeMinutes;
      }
    });
    socket.on("disconnect", async () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        const existingSession = activeStudySessions.get(user.userId);
        if (existingSession) {
          activeStudySessions.delete(user.userId);
          restStudySessions.set(user.userId, { session: existingSession, lastSeen: Date.now() });
        }
        connectedUsers.delete(socket.id);
        broadcastOnlineUsers();
      }
    });
  });
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
    const prompt = `You are a strict, uncompromising, and highly vigilant AI Screen Proctor for StudySync, an elite online accountability study platform.
Campaign: "${campaignName}"
Claimed Subject / Task: "${subjectNote}"

Examine the student's screen screenshot with extreme scrutiny. You must detect ANY non-study distractions, media players, or entertainment apps visible anywhere on screen.

============================================================
STRICT ZERO-TOLERANCE DISTRACTION RULES (isProductiveWork = false):
============================================================
If ANY of the following are visible ANYWHERE on the screen (whether in full screen, split screen, side panel, corner window, picture-in-picture, background window, or floating overlay), you MUST mark isProductiveWork = false:

1. MUSIC & AUDIO STREAMING APPS:
   - Spotify, Apple Music, YouTube Music, Amazon Music, SoundCloud, Wynk, Gaana, JioSaavn, or desktop music players.
   - If Spotify or any music browsing window, playlist, song title (e.g. songs, artists, albums, music lyrics, music player controls) is visible on screen, it is OFF-TASK / DISTRACTED.

2. NON-EDUCATIONAL VIDEOS & ENTERTAINMENT:
   - Music videos, commercial advertisements (e.g. NESCAFE, brand ads), movie trailers, movies, Netflix, Prime Video, Disney+, anime, sitcoms, comedy sketches, vlogs, travel vlogs, celebrity gossip, reaction videos, sports matches, gaming streams (Twitch/Kick/YouTube Gaming).
   - RULE FOR VIDEOS: If a video is playing/visible, it MUST be an explicit educational lecture, programming tutorial, or academic lesson. Any music video, advertisement, or entertainment video immediately disqualifies the session.

3. SOCIAL MEDIA & CHATS:
   - Instagram (Reels/Feed), TikTok, YouTube Shorts, Twitter/X, Reddit memes/feeds, Facebook, Snapchat, Discord (non-study gaming/casual chats), Telegram/WhatsApp personal chats.

4. ONLINE SHOPPING & E-COMMERCE:
   - Amazon, Flipkart, Myntra, electronics/gear shopping, fashion, product listings, price comparison, checkout pages.

5. GAMING & CASUAL BROWSING:
   - PC/browser games, Steam, Discord gaming, celebrity news, gossip, non-academic blogs.

6. SPLIT SCREEN CONTAMINATION:
   - Split-screen / multi-window is ONLY permitted if EVERY SINGLE visible window is legitimate academic/technical study material (e.g., VS Code + Official Documentation, Textbook PDF + Notion Notes).
   - If one side has code/study but the other side or background has Spotify, music, YouTube entertainment, shopping, or social media, the entire screen is CONTAMINATED and MUST be flagged as isProductiveWork = false.

7. BLANK / IDLE SCREEN:
   - Desktop wallpaper with no study apps, blank/black screen, lock screen, screensaver.

============================================================
GENUINE STUDY & PRODUCTIVE WORK CRITERIA (isProductiveWork = true):
============================================================
ONLY mark isProductiveWork = true if 100% of the active/visible screen content is dedicated to focused study/work without any entertainment/music app visible:
1. CODING & TECHNICAL: Writing, editing, debugging code in IDEs (VS Code, Cursor, PyCharm, IntelliJ, Xcode, Eclipse, Sublime, Vim, Terminal, Shell, PowerShell, Jupyter, Colab, GitHub, LeetCode, HackerRank, Codeforces, NeetCode).
2. ACADEMIC MATERIALS: Reading textbooks, research papers (arXiv, PubMed, IEEE), lecture slides, technical PDFs, formula sheets, documentation (MDN, Stack Overflow, DevDocs).
3. NOTE-TAKING & ESSAYS: Notion, Obsidian, Google Docs, Word, OneNote, Markdown notes dedicated to study.
4. ACADEMIC PRACTICE: Flashcards (Anki, Quizlet), problem sets, CAD, data analysis.
5. EDUCATIONAL LECTURES: Video tutorials/lectures strictly showing code, math derivations, slides, textbook diagrams, or academic instructions.

============================================================
OUTPUT FORMAT (Valid JSON ONLY):
============================================================
Respond ONLY with valid JSON in this exact structure:
{
  "isProductiveWork": false or true,
  "confidence": 90-100,
  "activitySummary": "Brief 3 to 6 words summary (e.g. 'Spotify Music App Visible on Screen', 'Coding in VS Code', 'Entertainment Video / Ad Visible', 'Reading Physics Textbook', 'Split Screen with Music Player')",
  "category": "entertainment" | "social_media" | "gaming" | "coding" | "studying" | "reading" | "research" | "writing" | "idle" | "other",
  "reason": "One concise, clear sentence explaining specifically what is visible on screen and why it is categorized as off-task/distracted or genuine focused study."
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
    const pwdCheck = checkPasswordStrength(password);
    if (!pwdCheck.isValid) {
      res.status(400).json({ error: pwdCheck.error });
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
    const resetToken = generateResetToken(cleanEmail, code);
    const emailResult = await sendPasswordResetEmail(cleanEmail, code, user.name);
    console.log(`[Password Reset] Generated OTP for ${cleanEmail}: ${code} (Delivered: ${emailResult.success})`);
    res.json({
      success: true,
      message: emailResult.success ? `A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox and spam folder.` : `Email service is not configured on the server. Your verification code is: ${code}`,
      email: cleanEmail,
      resetToken,
      emailDelivered: emailResult.success,
      ...!emailResult.success && { previewCode: code }
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword, resetToken } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Email, verification code, and new password are required" });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    let isVerified = false;
    if (resetToken) {
      isVerified = verifyResetToken(resetToken, cleanEmail, cleanCode);
    }
    if (!isVerified) {
      const resetEntry = passwordResetCodes.get(cleanEmail);
      if (resetEntry && resetEntry.code === cleanCode && Date.now() <= resetEntry.expiresAt) {
        isVerified = true;
      }
    }
    if (!isVerified) {
      res.status(400).json({ error: "Invalid or expired verification code. Please request a new code." });
      return;
    }
    const pwdCheck = checkPasswordStrength(newPassword);
    if (!pwdCheck.isValid) {
      res.status(400).json({ error: pwdCheck.error });
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
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Cohort name is required" });
      return;
    }
    const effectiveStartDate = startDate && String(startDate).trim() || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const effectiveEndDate = endDate && String(endDate).trim() || new Date(Date.now() + 365 * 864e5).toISOString().split("T")[0];
    const newCampaign = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim(),
      description: description || "",
      category: category || "General Studies",
      adminId: req.user.id,
      adminName: req.user.name,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
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
    if (io) {
      io.emit("campaign:created", created);
    }
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
    if (io && updated) {
      io.emit("campaign:updated", updated);
      io.to(`campaign:${req.params.id}`).emit("campaign:updated", updated);
    }
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
    if (io) {
      io.emit("campaign:deleted", { id: req.params.id });
    }
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
    if (io) {
      io.emit("campaign:member_joined", { campaignId: req.params.id, membership: saved });
      io.to(`campaign:${req.params.id}`).emit("campaign:member_joined", { campaignId: req.params.id, membership: saved });
    }
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
    if (io) {
      io.emit("campaign:membership_updated", { campaignId: req.params.id, membership: updated });
      io.to(`campaign:${req.params.id}`).emit("campaign:membership_updated", { campaignId: req.params.id, membership: updated });
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
    if (io) {
      io.emit("campaign:member_left", { campaignId: req.params.id, memberId: targetMember.id, userId: targetMember.userId });
      io.to(`campaign:${req.params.id}`).emit("campaign:member_left", { campaignId: req.params.id, memberId: targetMember.id, userId: targetMember.userId });
    }
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
    let analysis = {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: "Proctor Evaluation",
      category: "idle",
      reason: "AI evaluation in progress or check flagged."
    };
    try {
      analysis = await analyzeScreenSnapshot(
        snapshotUrl,
        campaignName,
        subjectNote || "Focus Study"
      );
    } catch (aErr) {
      console.warn("AI analysis error, flagging block as idle:", aErr?.message || aErr);
      analysis = {
        isProductiveWork: false,
        confidence: 80,
        activitySummary: "Inspection Flagged",
        category: "idle",
        reason: aErr?.message || "Proctor inspection timeout or non-study content detected."
      };
    }
    const isProductive = Boolean(analysis.isProductiveWork);
    const block = {
      id: `blk_${req.user.id}_${Date.now()}`,
      userId: req.user.id,
      userName: req.user.name,
      userAvatarUrl: req.user.avatarUrl,
      campaignId,
      campaignName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      durationMinutes: 5,
      status: isProductive ? "active" : "idle",
      subjectNote: subjectNote || analysis.activitySummary || (isProductive ? "Focus Study" : "Non-Study Activity Detected"),
      snapshotUrl
    };
    let savedBlock = block;
    try {
      savedBlock = await logStudyBlock(block);
    } catch (dbErr) {
      console.error("Failed to persist study block in DB:", dbErr);
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
    res.json({
      registered: isProductive,
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
    const adjustedNow = new Date(now.getTime() - 2 * 36e5);
    const todayStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate(), 2, 0, 0, 0).getTime();
    const weekStart = todayStart - 6 * 864e5;
    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;
    const dailyMinutesMap = {};
    activeBlocks.forEach((b) => {
      const bTime = new Date(b.timestamp).getTime();
      const adjustedBTime = new Date(bTime - 2 * 36e5);
      const dateStr = `${adjustedBTime.getFullYear()}-${String(adjustedBTime.getMonth() + 1).padStart(2, "0")}-${String(adjustedBTime.getDate()).padStart(2, "0")}`;
      dailyMinutesMap[dateStr] = (dailyMinutesMap[dateStr] || 0) + b.durationMinutes;
      totalMinutes += b.durationMinutes;
      if (bTime >= todayStart) todayMinutes += b.durationMinutes;
      if (bTime >= weekStart) thisWeekMinutes += b.durationMinutes;
    });
    const recentDays = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(adjustedNow.getTime() - d * 864e5);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
    const adjustedNow = new Date(now.getTime() - 2 * 36e5);
    const todayStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate(), 2, 0, 0, 0).getTime();
    const weekStart = todayStart - 6 * 864e5;
    const monthStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), 1, 2, 0, 0, 0).getTime();
    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let thisMonthMinutes = 0;
    let totalMinutes = 0;
    sortedBlocks.forEach((b) => {
      if (b.status === "active") {
        const bTime = new Date(b.timestamp).getTime();
        totalMinutes += b.durationMinutes;
        if (bTime >= todayStart) todayMinutes += b.durationMinutes;
        if (bTime >= weekStart) thisWeekMinutes += b.durationMinutes;
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
