import fs from 'fs';
import path from 'path';
import { User, Campaign, CampaignMembership, StudyBlock, LeaderboardEntry } from '../types/index.ts';
import { supabase } from './supabase.ts';

interface DBData {
  users: (User & { passwordHash: string })[];
  campaigns: Campaign[];
  memberships: CampaignMembership[];
  studyBlocks: StudyBlock[];
}

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = process.env.DATA_DIR || (isVercel ? '/tmp/data' : path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'app_db.json');

let memoryDb: DBData | null = null;

export async function initDb(): Promise<DBData> {
  if (memoryDb) return memoryDb;

  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryDb = JSON.parse(raw);
      if (memoryDb) {
        if (!Array.isArray(memoryDb.users)) memoryDb.users = [];
        if (!Array.isArray(memoryDb.campaigns)) memoryDb.campaigns = [];
        if (!Array.isArray(memoryDb.memberships)) memoryDb.memberships = [];
        if (!Array.isArray(memoryDb.studyBlocks)) memoryDb.studyBlocks = [];
        return memoryDb;
      }
    } catch (e) {
      console.warn('Could not read existing local db, starting fresh:', e);
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

export function saveDb() {
  if (!memoryDb) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local db to disk:', err);
  }
}

// Helper transformers
export function extractCodingLinks(rawBio?: string): { 
  cleanBio: string; 
  leetcodeUrl: string; 
  hackerrankUrl: string;
  dailyRoutine?: { dateKey: string; routine: 'college' | 'no_college' };
} {
  let cleanBio = rawBio || '';
  let leetcodeUrl = '';
  let hackerrankUrl = '';
  let dailyRoutine: { dateKey: string; routine: 'college' | 'no_college' } | undefined = undefined;

  const routineMatch = cleanBio.match(/\[routine:([^:]+):([^\]]+)\]/i);
  if (routineMatch) {
    dailyRoutine = {
      dateKey: routineMatch[1].trim(),
      routine: (routineMatch[2].trim().toLowerCase() === 'no_college' ? 'no_college' : 'college') as 'college' | 'no_college'
    };
    cleanBio = cleanBio.replace(routineMatch[0], '').trim();
  }

  const lcMatch = cleanBio.match(/\[leetcode:([^\]]+)\]/i);
  if (lcMatch) {
    leetcodeUrl = lcMatch[1].trim();
    cleanBio = cleanBio.replace(lcMatch[0], '').trim();
  }

  const hrMatch = cleanBio.match(/\[hackerrank:([^\]]+)\]/i);
  if (hrMatch) {
    hackerrankUrl = hrMatch[1].trim();
    cleanBio = cleanBio.replace(hrMatch[0], '').trim();
  }

  return { cleanBio, leetcodeUrl, hackerrankUrl, dailyRoutine };
}

export function packBioWithCodingLinks(
  bio?: string, 
  leetcodeUrl?: string, 
  hackerrankUrl?: string,
  dailyRoutine?: { dateKey: string; routine: 'college' | 'no_college' }
): string {
  const { cleanBio, leetcodeUrl: existingLc, hackerrankUrl: existingHr, dailyRoutine: existingRoutine } = extractCodingLinks(bio || '');
  const finalLc = (leetcodeUrl !== undefined ? leetcodeUrl : existingLc).trim();
  const finalHr = (hackerrankUrl !== undefined ? hackerrankUrl : existingHr).trim();
  const finalRoutine = dailyRoutine !== undefined ? dailyRoutine : existingRoutine;

  let packed = cleanBio;
  if (finalRoutine) packed += ` [routine:${finalRoutine.dateKey}:${finalRoutine.routine}]`;
  if (finalLc) packed += ` [leetcode:${finalLc}]`;
  if (finalHr) packed += ` [hackerrank:${finalHr}]`;
  return packed.trim();
}

export async function setUserDailyRoutine(userId: string, dateKey: string, routine: 'college' | 'no_college'): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;

  let rawBio = user.bio || '';
  if (supabase) {
    const { data } = await supabase.from('users').select('bio').eq('id', userId).single();
    if (data && data.bio) rawBio = data.bio;
  }

  const updatedBio = packBioWithCodingLinks(rawBio, user.leetcodeUrl, user.hackerrankUrl, { dateKey, routine });

  if (supabase) {
    await supabase.from('users').update({ bio: updatedBio }).eq('id', userId);
  }

  const db = await initDb();
  const u = db.users.find(x => x.id === userId);
  if (u) {
    u.bio = updatedBio;
  }
  saveDb();

  // Invalidate cache
  dbCache.clear();
}

function mapUserFromDb(row: any): User & { passwordHash: string } {
  const extracted = extractCodingLinks(row.bio || '');
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url || '',
    bio: extracted.cleanBio,
    studyGoal: row.study_goal || '',
    leetcodeUrl: row.leetcode_url || row.leetcodeUrl || extracted.leetcodeUrl || '',
    hackerrankUrl: row.hackerrank_url || row.hackerrankUrl || extracted.hackerrankUrl || '',
    createdAt: row.created_at
  };
}

function mapCampaignFromDb(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category || 'General Study',
    adminId: row.admin_id,
    adminName: row.admin_name,
    startDate: row.start_date,
    endDate: row.end_date,
    dailyStartTime: row.daily_start_time || '19:00',
    dailyEndTime: row.daily_end_time || '23:00',
    targetDailyHours: Number(row.target_daily_hours) || 4,
    schedule: Array.isArray(row.schedule) ? row.schedule : [],
    maxMembers: Number(row.max_members) || 20,
    isPublic: row.is_public ?? true,
    tags: Array.isArray(row.tags) ? row.tags : [],
    bannerColor: row.banner_color || '#3b82f6',
    createdAt: row.created_at
  };
}

function mapMembershipFromDb(row: any): CampaignMembership {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userAvatarUrl: row.user_avatar_url || '',
    role: row.role || 'member',
    status: row.status || 'pending',
    joinedAt: row.joined_at
  };
}

function mapStudyBlockFromDb(row: any): StudyBlock {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userAvatarUrl: row.user_avatar_url || '',
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    timestamp: row.timestamp,
    durationMinutes: Number(row.duration_minutes) || 5,
    status: row.status || 'active',
    subjectNote: row.subject_note || 'Focus Study',
    snapshotUrl: row.snapshot_url || undefined
  };
}

function mapMessageFromDb(row: any): Message {
  const ts = row.created_at || row.timestamp || new Date().toISOString();
  return {
    id: row.id,
    campaignId: row.campaign_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatarUrl: row.sender_avatar_url || '',
    content: row.content,
    timestamp: ts,
    createdAt: ts,
    type: row.type || 'general',
    recipientId: row.recipient_id || undefined,
    attachmentUrl: row.attachment_url || undefined,
    attachmentName: row.attachment_name || undefined,
    attachmentType: row.attachment_type || undefined,
    reactions: Array.isArray(row.reactions) ? row.reactions : []
  };
}

// ==========================================
// High-Efficiency In-Memory Caches (Zero-Egress)
// ==========================================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cacheStore = new Map<string, CacheEntry<any>>();

function getFromCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}

function setToCache<T>(key: string, data: T, ttlMs: number = 4000): T {
  cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
}

// ==========================================
// User Methods
// ==========================================
export async function getUsers(): Promise<User[]> {
  const cached = getFromCache<User[]>('all_users');
  if (cached) return cached;

  if (supabase) {
    const { data, error } = await supabase.from('users').select('id, name, email, avatar_url, bio, study_goal, created_at');
    if (!error && data) {
      const mapped = data.map(r => {
        const u = mapUserFromDb(r);
        const { passwordHash, ...clean } = u;
        return clean;
      });
      return setToCache('all_users', mapped, 5000);
    }
  }
  const db = await initDb();
  const mapped = db.users.map(({ passwordHash, ...user }) => user);
  return setToCache('all_users', mapped, 5000);
}

export async function getUserById(id: string): Promise<(User & { passwordHash: string }) | undefined> {
  const cacheKey = `user_id_${id}`;
  const cached = getFromCache<User & { passwordHash: string }>(cacheKey);
  if (cached) return cached;

  if (supabase) {
    const { data, error } = await supabase.from('users').select('id, name, email, password_hash, avatar_url, bio, study_goal, created_at').eq('id', id).single();
    if (!error && data) {
      const mapped = mapUserFromDb(data);
      return setToCache(cacheKey, mapped, 5000);
    }
  }
  const db = await initDb();
  const local = db.users.find(u => u.id === id);
  if (local) setToCache(cacheKey, local, 5000);
  return local;
}

export async function getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | undefined> {
  const cleanEmail = email.trim().toLowerCase();
  const cacheKey = `user_email_${cleanEmail}`;
  const cached = getFromCache<User & { passwordHash: string }>(cacheKey);
  if (cached) return cached;

  if (supabase) {
    const { data, error } = await supabase.from('users').select('id, name, email, password_hash, avatar_url, bio, study_goal, created_at').ilike('email', cleanEmail).single();
    if (!error && data) {
      const mapped = mapUserFromDb(data);
      return setToCache(cacheKey, mapped, 5000);
    }
  }
  const db = await initDb();
  const local = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (local) setToCache(cacheKey, local, 5000);
  return local;
}

export async function createUser(userData: User & { passwordHash: string }): Promise<User> {
  invalidateCache('user');
  invalidateCache('all_users');
  const packedBio = packBioWithCodingLinks(userData.bio, userData.leetcodeUrl, userData.hackerrankUrl);
  if (supabase) {
    const fullPayload: any = {
      id: userData.id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password_hash: userData.passwordHash,
      avatar_url: userData.avatarUrl || '',
      bio: packedBio,
      study_goal: userData.studyGoal || '',
      leetcode_url: userData.leetcodeUrl || '',
      hackerrank_url: userData.hackerrankUrl || '',
      created_at: userData.createdAt || new Date().toISOString()
    };
    const { error } = await supabase.from('users').insert(fullPayload);
    if (error) {
      // Fallback without leetcode_url / hackerrank_url if columns don't exist yet on remote table
      delete fullPayload.leetcode_url;
      delete fullPayload.hackerrank_url;
      const { error: fbErr } = await supabase.from('users').insert(fullPayload);
      if (fbErr) console.error('Supabase createUser error fallback:', fbErr);
    }
  }
  const db = await initDb();
  db.users.push({
    ...userData,
    bio: userData.bio || '',
    leetcodeUrl: userData.leetcodeUrl || '',
    hackerrankUrl: userData.hackerrankUrl || ''
  });
  saveDb();
  const { passwordHash, ...user } = userData;
  return user;
}

export async function updateUserPasswordByEmail(email: string, newPasswordHash: string): Promise<boolean> {
  invalidateCache('user');
  invalidateCache('all_users');
  if (supabase) {
    const { error } = await supabase.from('users').update({ password_hash: newPasswordHash }).ilike('email', email.trim());
    if (!error) return true;
  }
  const db = await initDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  saveDb();
  return true;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  invalidateCache('user');
  invalidateCache('all_users');
  invalidateCache('camps');
  invalidateCache('leaderboard');
  if (supabase) {
    // Fetch existing user to preserve / pack bio properly
    const { data: existingRow } = await supabase.from('users').select('*').eq('id', id).single();
    const existingExtracted = existingRow ? extractCodingLinks(existingRow.bio || '') : { cleanBio: '', leetcodeUrl: '', hackerrankUrl: '' };

    const targetBio = updates.bio !== undefined ? updates.bio : existingExtracted.cleanBio;
    const targetLc = updates.leetcodeUrl !== undefined ? updates.leetcodeUrl : (existingRow?.leetcode_url || existingExtracted.leetcodeUrl);
    const targetHr = updates.hackerrankUrl !== undefined ? updates.hackerrankUrl : (existingRow?.hackerrank_url || existingExtracted.hackerrankUrl);
    const packedBio = packBioWithCodingLinks(targetBio, targetLc, targetHr);

    const payload: any = { bio: packedBio };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.studyGoal !== undefined) payload.study_goal = updates.studyGoal;
    if (updates.leetcodeUrl !== undefined) payload.leetcode_url = updates.leetcodeUrl;
    if (updates.hackerrankUrl !== undefined) payload.hackerrank_url = updates.hackerrankUrl;

    let res = await supabase.from('users').update(payload).eq('id', id).select().single();
    if (res.error) {
      // Retry without dedicated columns in case they don't exist on remote table
      delete payload.leetcode_url;
      delete payload.hackerrank_url;
      res = await supabase.from('users').update(payload).eq('id', id).select().single();
    }

    if (!res.error && res.data) {
      if (updates.name !== undefined || updates.avatarUrl !== undefined) {
        const memPayload: any = {};
        if (updates.name !== undefined) memPayload.user_name = updates.name;
        if (updates.avatarUrl !== undefined) memPayload.user_avatar_url = updates.avatarUrl;
        await supabase.from('memberships').update(memPayload).eq('user_id', id);
        await supabase.from('study_blocks').update(memPayload).eq('user_id', id);
        if (updates.name !== undefined) {
          await supabase.from('campaigns').update({ admin_name: updates.name }).eq('admin_id', id);
        }
      }
      const full = mapUserFromDb(res.data);
      const { passwordHash, ...clean } = full;
      return clean;
    }
  }

  const db = await initDb();
  const user = db.users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, updates);

  if (updates.name !== undefined || updates.avatarUrl !== undefined) {
    db.memberships.forEach(m => {
      if (m.userId === id) {
        if (updates.name !== undefined) m.userName = updates.name;
        if (updates.avatarUrl !== undefined) m.userAvatarUrl = updates.avatarUrl;
      }
    });

    db.campaigns.forEach(c => {
      if (c.adminId === id && updates.name !== undefined) {
        c.adminName = updates.name;
      }
    });

    db.studyBlocks.forEach(b => {
      if (b.userId === id) {
        if (updates.name !== undefined) b.userName = updates.name;
        if (updates.avatarUrl !== undefined) b.userAvatarUrl = updates.avatarUrl;
      }
    });
  }

  saveDb();
  const { passwordHash, ...cleanUser } = user;
  return cleanUser;
}

// ==========================================
// Campaign Methods
// ==========================================
export async function getCampaigns(userId?: string): Promise<Campaign[]> {
  const cacheKey = `camps_${userId || 'all'}`;
  const cached = getFromCache<Campaign[]>(cacheKey);
  if (cached) return cached;

  if (supabase) {
    const { data: camps, error } = await supabase
      .from('campaigns')
      .select('id, name, description, category, admin_id, admin_name, start_date, end_date, daily_start_time, daily_end_time, target_daily_hours, schedule, max_members, is_public, banner_color, tags, created_at')
      .order('created_at', { ascending: false });

    if (!error && camps) {
      const { data: members } = await supabase
        .from('memberships')
        .select('campaign_id, user_id, role, status');

      const allMembers = (members || []).map(mapMembershipFromDb);

      const result = camps.map(mapCampaignFromDb).map(c => {
        const approved = allMembers.filter(m => m.campaignId === c.id && m.status === 'approved');
        const userMem = userId ? allMembers.find(m => m.campaignId === c.id && m.userId === userId) : undefined;
        const isCreator = Boolean(userId && c.adminId === userId);
        return {
          ...c,
          memberCount: approved.length,
          userStatus: isCreator ? 'approved' : (userMem ? userMem.status : undefined),
          userRole: isCreator ? 'admin' : (userMem ? userMem.role : undefined)
        };
      });

      return setToCache(cacheKey, result, 4000);
    }
  }

  const db = await initDb();
  const result = db.campaigns.map(c => {
    const approvedMembers = db.memberships.filter(m => m.campaignId === c.id && m.status === 'approved');
    let userMembership = userId ? db.memberships.find(m => m.campaignId === c.id && m.userId === userId) : undefined;
    const isCreator = Boolean(userId && c.adminId === userId);
    return {
      ...c,
      memberCount: approvedMembers.length,
      userStatus: isCreator ? 'approved' : (userMembership ? userMembership.status : undefined),
      userRole: isCreator ? 'admin' : (userMembership ? userMembership.role : undefined)
    };
  });
  return setToCache(cacheKey, result, 4000);
}

export async function getCampaignById(id: string, userId?: string): Promise<Campaign | null> {
  const cacheKey = `camp_${id}_${userId || 'all'}`;
  const cached = getFromCache<Campaign | null>(cacheKey);
  if (cached !== null) return cached;

  if (supabase) {
    const { data: camp, error } = await supabase
      .from('campaigns')
      .select('id, name, description, category, admin_id, admin_name, start_date, end_date, daily_start_time, daily_end_time, target_daily_hours, schedule, max_members, is_public, banner_color, tags, created_at')
      .eq('id', id)
      .single();

    if (!error && camp) {
      const { data: members } = await supabase
        .from('memberships')
        .select('campaign_id, user_id, user_name, user_avatar_url, role, status')
        .eq('campaign_id', id);

      const allMembers = (members || []).map(mapMembershipFromDb);
      const approved = allMembers.filter(m => m.status === 'approved');
      const userMem = userId ? allMembers.find(m => m.userId === userId) : undefined;
      const c = mapCampaignFromDb(camp);
      const isCreator = Boolean(userId && c.adminId === userId);
      const result: Campaign = {
        ...c,
        memberCount: approved.length,
        userStatus: isCreator ? 'approved' : (userMem ? userMem.status : undefined),
        userRole: isCreator ? 'admin' : (userMem ? userMem.role : undefined)
      };
      return setToCache(cacheKey, result, 4000);
    }
  }

  const db = await initDb();
  const campaign = db.campaigns.find(c => c.id === id);
  if (!campaign) return null;
  const approvedMembers = db.memberships.filter(m => m.campaignId === campaign.id && m.status === 'approved');
  let userMembership = userId ? db.memberships.find(m => m.campaignId === campaign.id && m.userId === userId) : undefined;
  const isCreator = Boolean(userId && campaign.adminId === userId);
  const result: Campaign = {
    ...campaign,
    memberCount: approvedMembers.length,
    userStatus: isCreator ? 'approved' : (userMembership ? userMembership.status : undefined),
    userRole: isCreator ? 'admin' : (userMembership ? userMembership.role : undefined)
  };
  return setToCache(cacheKey, result, 4000);
}

export async function createCampaign(campaign: Campaign, creator: User): Promise<Campaign> {
  invalidateCache('camp');
  invalidateCache('camps');
  invalidateCache('leaderboard');
  const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const membership: CampaignMembership = {
    id: membershipId,
    userId: creator.id,
    userName: creator.name,
    userEmail: creator.email,
    userAvatarUrl: creator.avatarUrl,
    campaignId: campaign.id,
    role: 'admin',
    status: 'approved',
    joinedAt: new Date().toISOString()
  };

  if (supabase) {
    await supabase.from('campaigns').insert({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      category: campaign.category || 'General Study',
      admin_id: creator.id,
      admin_name: creator.name,
      start_date: campaign.startDate,
      end_date: campaign.endDate,
      daily_start_time: campaign.dailyStartTime || '19:00',
      daily_end_time: campaign.dailyEndTime || '23:00',
      target_daily_hours: campaign.targetDailyHours || 4,
      schedule: campaign.schedule || [],
      max_members: Number(campaign.maxMembers) || 25,
      is_public: campaign.isPublic !== undefined ? Boolean(campaign.isPublic) : true,
      tags: Array.isArray(campaign.tags) ? campaign.tags : [],
      banner_color: campaign.bannerColor || '#3b82f6',
      created_at: campaign.createdAt || new Date().toISOString()
    });

    await supabase.from('memberships').insert({
      id: membership.id,
      campaign_id: campaign.id,
      user_id: creator.id,
      user_name: creator.name,
      user_email: creator.email,
      user_avatar_url: creator.avatarUrl || '',
      role: 'admin',
      status: 'approved',
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
    userStatus: 'approved',
    userRole: 'admin'
  };
}

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
  invalidateCache('camp');
  invalidateCache('camps');
  invalidateCache('leaderboard');
  if (supabase) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.startDate !== undefined) payload.start_date = updates.startDate;
    if (updates.endDate !== undefined) payload.end_date = updates.endDate;
    if (updates.dailyStartTime !== undefined) payload.daily_start_time = updates.dailyStartTime;
    if (updates.dailyEndTime !== undefined) payload.daily_end_time = updates.dailyEndTime;
    if (updates.targetDailyHours !== undefined) payload.target_daily_hours = updates.targetDailyHours;
    if (updates.schedule !== undefined) payload.schedule = updates.schedule;
    if (updates.maxMembers !== undefined) payload.max_members = updates.maxMembers;
    if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.bannerColor !== undefined) payload.banner_color = updates.bannerColor;

    const { data, error } = await supabase.from('campaigns').update(payload).eq('id', id).select().single();
    if (error) {
      console.error('[updateCampaign] Supabase error:', error);
      throw new Error(error.message);
    }
    if (data) return mapCampaignFromDb(data);
  }

  const db = await initDb();
  const c = db.campaigns.find(camp => camp.id === id);
  if (!c) return null;
  Object.assign(c, updates);
  saveDb();
  return c;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  invalidateCache('camp');
  invalidateCache('camps');
  invalidateCache('leaderboard');
  if (supabase) {
    await supabase.from('campaigns').delete().eq('id', id);
    await supabase.from('memberships').delete().eq('campaign_id', id);
    await supabase.from('study_blocks').delete().eq('campaign_id', id);
    await supabase.from('messages').delete().eq('campaign_id', id);
    return true;
  }

  const db = await initDb();
  const index = db.campaigns.findIndex(c => c.id === id);
  if (index === -1) return false;
  db.campaigns.splice(index, 1);
  db.memberships = db.memberships.filter(m => m.campaignId !== id);
  db.studyBlocks = db.studyBlocks.filter(b => b.campaignId !== id);
  db.messages = db.messages.filter(m => m.campaignId !== id);
  saveDb();
  return true;
}

// ==========================================
// Membership Methods
// ==========================================
export async function getCampaignMembers(campaignId: string): Promise<CampaignMembership[]> {
  const cacheKey = `members_${campaignId}`;
  const cached = getFromCache<CampaignMembership[]>(cacheKey);
  if (cached) return cached;

  if (supabase) {
    const { data, error } = await supabase.from('memberships').select('id, campaign_id, user_id, user_name, user_email, user_avatar_url, role, status, joined_at').eq('campaign_id', campaignId);
    if (!error && data) {
      const mapped = data.map(mapMembershipFromDb);
      return setToCache(cacheKey, mapped, 4000);
    }
  }
  const db = await initDb();
  const mapped = db.memberships.filter(m => m.campaignId === campaignId);
  return setToCache(cacheKey, mapped, 4000);
}

export async function getMembership(userId: string, campaignId: string): Promise<CampaignMembership | undefined> {
  const cacheKey = `mem_${userId}_${campaignId}`;
  const cached = getFromCache<CampaignMembership>(cacheKey);
  if (cached) return cached;

  if (supabase) {
    const { data, error } = await supabase.from('memberships').select('id, campaign_id, user_id, user_name, user_email, user_avatar_url, role, status, joined_at').eq('user_id', userId).eq('campaign_id', campaignId).single();
    if (!error && data) {
      const mapped = mapMembershipFromDb(data);
      return setToCache(cacheKey, mapped, 4000);
    }
  }
  const db = await initDb();
  const local = db.memberships.find(m => m.userId === userId && m.campaignId === campaignId);
  if (local) setToCache(cacheKey, local, 4000);
  return local;
}

export async function createMembership(membership: CampaignMembership): Promise<CampaignMembership> {
  invalidateCache('camp');
  invalidateCache('camps');
  invalidateCache('members');
  invalidateCache('mem_');
  invalidateCache('leaderboard');
  if (supabase) {
    await supabase.from('memberships').upsert({
      id: membership.id,
      campaign_id: membership.campaignId,
      user_id: membership.userId,
      user_name: membership.userName,
      user_email: membership.userEmail,
      user_avatar_url: membership.userAvatarUrl || '',
      role: membership.role || 'member',
      status: membership.status || 'pending',
      joined_at: membership.joinedAt || new Date().toISOString()
    });
  }
  const db = await initDb();
  const existingIndex = db.memberships.findIndex(m => m.userId === membership.userId && m.campaignId === membership.campaignId);
  if (existingIndex >= 0) {
    db.memberships[existingIndex] = membership;
  } else {
    db.memberships.push(membership);
  }
  saveDb();
  return membership;
}

export async function updateMembership(id: string, updates: Partial<CampaignMembership>): Promise<CampaignMembership | null> {
  invalidateCache('camp');
  invalidateCache('camps');
  invalidateCache('members');
  invalidateCache('mem_');
  invalidateCache('leaderboard');
  if (supabase) {
    const payload: any = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.role !== undefined) payload.role = updates.role;
    const { data, error } = await supabase.from('memberships').update(payload).eq('id', id).select().single();
    if (!error && data) return mapMembershipFromDb(data);
  }
  const db = await initDb();
  const mem = db.memberships.find(m => m.id === id);
  if (!mem) return null;
  Object.assign(mem, updates);
  saveDb();
  return mem;
}

export async function deleteMembership(id: string): Promise<boolean> {
  if (supabase) {
    await supabase.from('memberships').delete().eq('id', id);
    return true;
  }
  const db = await initDb();
  const idx = db.memberships.findIndex(m => m.id === id);
  if (idx === -1) return false;
  db.memberships.splice(idx, 1);
  saveDb();
  return true;
}

// ==========================================
// Study Block Methods
// ==========================================
export async function logStudyBlock(block: StudyBlock): Promise<StudyBlock> {
  invalidateCache('study_blocks');
  invalidateCache('leaderboard');
  if (supabase) {
    await supabase.from('study_blocks').insert({
      id: block.id,
      user_id: block.userId,
      user_name: block.userName,
      user_avatar_url: block.userAvatarUrl || '',
      campaign_id: block.campaignId,
      campaign_name: block.campaignName,
      timestamp: block.timestamp || new Date().toISOString(),
      duration_minutes: block.durationMinutes || 5,
      status: block.status || 'active',
      subject_note: block.subjectNote || 'Focus Study',
      snapshot_url: block.snapshotUrl && !block.snapshotUrl.startsWith('data:') ? block.snapshotUrl : null
    });
  }
  const db = await initDb();
  db.studyBlocks.push(block);
  saveDb();
  return block;
}

export async function getStudyBlocksForUser(userId: string, campaignId?: string): Promise<StudyBlock[]> {
  const cacheKey = `study_blocks_${userId}_${campaignId || 'all'}`;
  const cached = getFromCache<StudyBlock[]>(cacheKey);
  if (cached) return cached;

  if (supabase) {
    let query = supabase
      .from('study_blocks')
      .select('id, user_id, user_name, user_avatar_url, campaign_id, campaign_name, timestamp, duration_minutes, status, subject_note')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (campaignId) query = query.eq('campaign_id', campaignId);
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map(mapStudyBlockFromDb);
      return setToCache(cacheKey, mapped, 5000);
    }
  }
  const db = await initDb();
  const mapped = db.studyBlocks.filter(b => b.userId === userId && (!campaignId || b.campaignId === campaignId));
  return setToCache(cacheKey, mapped, 5000);
}

// ==========================================
// 2:00 AM Study Day Boundary Helper
// ==========================================
export function get2AMAlignedDateKey(timestamp: Date | string | number = new Date(), tzOffsetMinutes?: number): string {
  const d = new Date(timestamp);
  // Default to -330 (IST, UTC+5:30) if not provided or valid
  const offset = typeof tzOffsetMinutes === 'number' && !isNaN(tzOffsetMinutes) ? tzOffsetMinutes : -330;
  // Convert UTC time to User's Local Time
  const localTimeMs = d.getTime() - offset * 60 * 1000;
  // Shift back by 2 hours so [00:00 to 01:59:59] belongs to previous date
  const adjustedLocalMs = localTimeMs - 2 * 3600 * 1000;
  const adjustedDate = new Date(adjustedLocalMs);
  
  const year = adjustedDate.getUTCFullYear();
  const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getCampaignLeaderboard(campaignId: string, tzOffset?: number): Promise<LeaderboardEntry[]> {
  const tz = typeof tzOffset === 'number' && !isNaN(tzOffset) ? tzOffset : -330;
  const now = new Date();
  const todayKey = get2AMAlignedDateKey(now, tz);
  const cacheKey = `leaderboard_${campaignId}_${todayKey}_${tz}`;
  const cached = getFromCache<LeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  let approvedMembers: CampaignMembership[] = [];
  let campaignBlocks: StudyBlock[] = [];
  let targetHours = 4;
  let allUsers: Array<{ id: string; leetcodeUrl?: string; hackerrankUrl?: string }> = [];

  if (supabase) {
    const [campRes, memsRes, blksRes, usersRes] = await Promise.all([
      supabase.from('campaigns').select('target_daily_hours').eq('id', campaignId).single(),
      supabase.from('memberships').select('id, campaign_id, user_id, user_name, user_avatar_url, role, status').eq('campaign_id', campaignId).eq('status', 'approved'),
      supabase.from('study_blocks').select('id, campaign_id, user_id, user_name, user_avatar_url, duration_minutes, timestamp, status').eq('campaign_id', campaignId).eq('status', 'active').limit(500),
      supabase.from('users').select('id, bio').limit(200)
    ]);
    if (campRes.data) targetHours = Number(campRes.data.target_daily_hours) || 4;
    if (memsRes.data) approvedMembers = memsRes.data.map(mapMembershipFromDb);
    if (blksRes.data) campaignBlocks = blksRes.data.map(mapStudyBlockFromDb);
    if (usersRes.data) {
      allUsers = usersRes.data.map(u => {
        const extracted = extractCodingLinks(u.bio || '');
        return {
          id: u.id,
          leetcodeUrl: extracted.leetcodeUrl,
          hackerrankUrl: extracted.hackerrankUrl,
          dailyRoutine: extracted.dailyRoutine
        };
      });
    }
  } else {
    const db = await initDb();
    const campaign = db.campaigns.find(c => c.id === campaignId);
    targetHours = campaign?.targetDailyHours || 4;
    approvedMembers = db.memberships.filter(m => m.campaignId === campaignId && m.status === 'approved');
    campaignBlocks = db.studyBlocks.filter(b => b.campaignId === campaignId && b.status === 'active');
    allUsers = db.users.map(u => {
      const extracted = extractCodingLinks(u.bio || '');
      return {
        id: u.id,
        leetcodeUrl: extracted.leetcodeUrl,
        hackerrankUrl: extracted.hackerrankUrl,
        dailyRoutine: extracted.dailyRoutine
      };
    });
  }

  // 7-day keys set (past 7 study days)
  const weekKeysSet = new Set<string>();
  const nowLocalMs = now.getTime() - tz * 60 * 1000 - 2 * 3600 * 1000;
  for (let d = 0; d < 7; d++) {
    const dDate = new Date(nowLocalMs - d * 86400000);
    const k = `${dDate.getUTCFullYear()}-${String(dDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dDate.getUTCDate()).padStart(2, '0')}`;
    weekKeysSet.add(k);
  }

  // Month prefix: YYYY-MM based on todayKey
  const currentMonthPrefix = todayKey.substring(0, 7);

  const entries: LeaderboardEntry[] = approvedMembers.map(member => {
    const userBlocks = campaignBlocks.filter(b => b.userId === member.userId);
    const userProfile = allUsers.find(u => u.id === member.userId);

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let thisMonthMinutes = 0;
    let totalMinutes = 0;
    let lastActive: string | undefined = undefined;

    const activeDaysSet = new Set<string>();

    userBlocks.forEach(b => {
      const bDateStr = get2AMAlignedDateKey(b.timestamp, tz);
      activeDaysSet.add(bDateStr);

      totalMinutes += b.durationMinutes;

      if (bDateStr === todayKey) {
        todayMinutes += b.durationMinutes;
      }
      if (weekKeysSet.has(bDateStr)) {
        thisWeekMinutes += b.durationMinutes;
      }
      if (bDateStr.startsWith(currentMonthPrefix)) {
        thisMonthMinutes += b.durationMinutes;
      }

      if (!lastActive || new Date(b.timestamp) > new Date(lastActive)) {
        lastActive = b.timestamp;
      }
    });

    let currentStreak = 0;
    for (let d = 0; d < 365; d++) {
      const checkDate = new Date(nowLocalMs - d * 86400000);
      const dateStr = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkDate.getUTCDate()).padStart(2, '0')}`;
      if (activeDaysSet.has(dateStr)) {
        currentStreak++;
      } else if (d === 0 && !activeDaysSet.has(dateStr)) {
        // If haven't studied yet today, check if yesterday was active to preserve streak
        continue;
      } else {
        break;
      }
    }

    let userTargetHours = targetHours;
    if (userProfile?.dailyRoutine && userProfile.dailyRoutine.dateKey === todayKey) {
      userTargetHours = userProfile.dailyRoutine.routine === 'college' ? 4 : 7;
    }

    const todayHours = Number((todayMinutes / 60).toFixed(1));
    const targetCompleted = todayHours >= userTargetHours;
    const progressPercentage = Math.min(100, Math.round((todayHours / (userTargetHours || 1)) * 100));

    return {
      userId: member.userId,
      userName: member.userName,
      userAvatarUrl: member.userAvatarUrl,
      leetcodeUrl: userProfile?.leetcodeUrl || '',
      hackerrankUrl: userProfile?.hackerrankUrl || '',
      role: member.role || 'member',
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
      targetDailyHours: userTargetHours,
      todayTargetMet: targetCompleted,
      targetCompleted,
      progressPercentage,
      lastActive
    };
  });

  const sorted = entries.sort((a, b) => b.todayMinutes - a.todayMinutes);
  return setToCache(cacheKey, sorted, 4000);
}
