import fs from 'fs';
import path from 'path';
import { User, Campaign, CampaignMembership, StudyBlock, Message, LeaderboardEntry, CallSession, CallParticipant } from '../types/index.ts';
import { supabase } from './supabase.ts';

interface DBData {
  users: (User & { passwordHash: string })[];
  campaigns: Campaign[];
  memberships: CampaignMembership[];
  studyBlocks: StudyBlock[];
  messages: Message[];
  activeCalls: Record<string, CallSession>;
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
        if (!Array.isArray(memoryDb.messages)) memoryDb.messages = [];
        if (!memoryDb.activeCalls || typeof memoryDb.activeCalls !== 'object') memoryDb.activeCalls = {};
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
    studyBlocks: [],
    messages: [],
    activeCalls: {}
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
function mapUserFromDb(row: any): User & { passwordHash: string } {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url || '',
    bio: row.bio || '',
    studyGoal: row.study_goal || '',
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
// User Methods
// ==========================================
export async function getUsers(): Promise<User[]> {
  if (supabase) {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && data) {
      return data.map(r => {
        const u = mapUserFromDb(r);
        const { passwordHash, ...clean } = u;
        return clean;
      });
    }
  }
  const db = await initDb();
  return db.users.map(({ passwordHash, ...user }) => user);
}

export async function getUserById(id: string): Promise<(User & { passwordHash: string }) | undefined> {
  if (supabase) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (!error && data) return mapUserFromDb(data);
  }
  const db = await initDb();
  return db.users.find(u => u.id === id);
}

export async function getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | undefined> {
  if (supabase) {
    const { data, error } = await supabase.from('users').select('*').ilike('email', email.trim()).single();
    if (!error && data) return mapUserFromDb(data);
  }
  const db = await initDb();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(userData: User & { passwordHash: string }): Promise<User> {
  if (supabase) {
    const { error } = await supabase.from('users').insert({
      id: userData.id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password_hash: userData.passwordHash,
      avatar_url: userData.avatarUrl || '',
      bio: userData.bio || '',
      study_goal: userData.studyGoal || '',
      created_at: userData.createdAt || new Date().toISOString()
    });
    if (error) console.error('Supabase createUser error:', error);
  }
  const db = await initDb();
  db.users.push(userData);
  saveDb();
  const { passwordHash, ...user } = userData;
  return user;
}

export async function updateUserPasswordByEmail(email: string, newPasswordHash: string): Promise<boolean> {
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
  if (supabase) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.studyGoal !== undefined) payload.study_goal = updates.studyGoal;

    const { data, error } = await supabase.from('users').update(payload).eq('id', id).select().single();
    if (!error && data) {
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
      const full = mapUserFromDb(data);
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
  if (supabase) {
    const { data: camps, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (!error && camps) {
      const { data: members } = await supabase.from('memberships').select('*');
      const allMembers = (members || []).map(mapMembershipFromDb);

      return camps.map(mapCampaignFromDb).map(c => {
        const approved = allMembers.filter(m => m.campaignId === c.id && m.status === 'approved');
        const userMem = userId ? allMembers.find(m => m.campaignId === c.id && m.userId === userId) : undefined;
        return {
          ...c,
          memberCount: approved.length,
          userStatus: userMem ? userMem.status : undefined,
          userRole: userMem ? userMem.role : undefined
        };
      });
    }
  }

  const db = await initDb();
  return db.campaigns.map(c => {
    const approvedMembers = db.memberships.filter(m => m.campaignId === c.id && m.status === 'approved');
    let userMembership = userId ? db.memberships.find(m => m.campaignId === c.id && m.userId === userId) : undefined;
    return {
      ...c,
      memberCount: approvedMembers.length,
      userStatus: userMembership ? userMembership.status : undefined,
      userRole: userMembership ? userMembership.role : undefined
    };
  });
}

export async function getCampaignById(id: string, userId?: string): Promise<Campaign | null> {
  if (supabase) {
    const { data: camp, error } = await supabase.from('campaigns').select('*').eq('id', id).single();
    if (!error && camp) {
      const { data: members } = await supabase.from('memberships').select('*').eq('campaign_id', id);
      const allMembers = (members || []).map(mapMembershipFromDb);
      const approved = allMembers.filter(m => m.status === 'approved');
      const userMem = userId ? allMembers.find(m => m.userId === userId) : undefined;
      const c = mapCampaignFromDb(camp);
      return {
        ...c,
        memberCount: approved.length,
        userStatus: userMem ? userMem.status : undefined,
        userRole: userMem ? userMem.role : undefined
      };
    }
  }

  const db = await initDb();
  const campaign = db.campaigns.find(c => c.id === id);
  if (!campaign) return null;
  const approvedMembers = db.memberships.filter(m => m.campaignId === campaign.id && m.status === 'approved');
  let userMembership = userId ? db.memberships.find(m => m.campaignId === campaign.id && m.userId === userId) : undefined;
  return {
    ...campaign,
    memberCount: approvedMembers.length,
    userStatus: userMembership ? userMembership.status : undefined,
    userRole: userMembership ? userMembership.role : undefined
  };
}

export async function createCampaign(campaign: Campaign, creator: User): Promise<Campaign> {
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
    if (!error && data) return mapCampaignFromDb(data);
  }

  const db = await initDb();
  const c = db.campaigns.find(camp => camp.id === id);
  if (!c) return null;
  Object.assign(c, updates);
  saveDb();
  return c;
}

export async function deleteCampaign(id: string): Promise<boolean> {
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
  if (supabase) {
    const { data, error } = await supabase.from('memberships').select('*').eq('campaign_id', campaignId);
    if (!error && data) return data.map(mapMembershipFromDb);
  }
  const db = await initDb();
  return db.memberships.filter(m => m.campaignId === campaignId);
}

export async function getMembership(userId: string, campaignId: string): Promise<CampaignMembership | undefined> {
  if (supabase) {
    const { data, error } = await supabase.from('memberships').select('*').eq('user_id', userId).eq('campaign_id', campaignId).single();
    if (!error && data) return mapMembershipFromDb(data);
  }
  const db = await initDb();
  return db.memberships.find(m => m.userId === userId && m.campaignId === campaignId);
}

export async function createMembership(membership: CampaignMembership): Promise<CampaignMembership> {
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
      snapshot_url: block.snapshotUrl || null
    });
  }
  const db = await initDb();
  db.studyBlocks.push(block);
  saveDb();
  return block;
}

export async function getStudyBlocksForUser(userId: string, campaignId?: string): Promise<StudyBlock[]> {
  if (supabase) {
    let query = supabase.from('study_blocks').select('*').eq('user_id', userId);
    if (campaignId) query = query.eq('campaign_id', campaignId);
    const { data, error } = await query;
    if (!error && data) return data.map(mapStudyBlockFromDb);
  }
  const db = await initDb();
  return db.studyBlocks.filter(b => b.userId === userId && (!campaignId || b.campaignId === campaignId));
}

export async function getCampaignLeaderboard(campaignId: string): Promise<LeaderboardEntry[]> {
  let approvedMembers: CampaignMembership[] = [];
  let campaignBlocks: StudyBlock[] = [];
  let targetHours = 4;

  if (supabase) {
    const { data: camp } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
    if (camp) targetHours = Number(camp.target_daily_hours) || 4;
    const { data: mems } = await supabase.from('memberships').select('*').eq('campaign_id', campaignId).eq('status', 'approved');
    if (mems) approvedMembers = mems.map(mapMembershipFromDb);
    const { data: blks } = await supabase.from('study_blocks').select('*').eq('campaign_id', campaignId).eq('status', 'active');
    if (blks) campaignBlocks = blks.map(mapStudyBlockFromDb);
  } else {
    const db = await initDb();
    const campaign = db.campaigns.find(c => c.id === campaignId);
    targetHours = campaign?.targetDailyHours || 4;
    approvedMembers = db.memberships.filter(m => m.campaignId === campaignId && m.status === 'approved');
    campaignBlocks = db.studyBlocks.filter(b => b.campaignId === campaignId && b.status === 'active');
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 86400000;

  const entries: LeaderboardEntry[] = approvedMembers.map(member => {
    const userBlocks = campaignBlocks.filter(b => b.userId === member.userId);

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;
    let lastActive: string | undefined = undefined;

    const activeDaysSet = new Set<string>();

    userBlocks.forEach(b => {
      const bTime = new Date(b.timestamp).getTime();
      const bDateStr = b.timestamp.split('T')[0];
      activeDaysSet.add(bDateStr);

      totalMinutes += b.durationMinutes;

      if (bTime >= todayStart) {
        todayMinutes += b.durationMinutes;
      }
      if (bTime >= weekStart) {
        thisWeekMinutes += b.durationMinutes;
      }

      if (!lastActive || new Date(b.timestamp) > new Date(lastActive)) {
        lastActive = b.timestamp;
      }
    });

    let currentStreak = 0;
    for (let d = 0; d < 365; d++) {
      const checkDate = new Date(todayStart - d * 86400000);
      const dateStr = checkDate.toISOString().split('T')[0];
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
    const progressPercentage = Math.min(100, Math.round((todayHours / (targetHours || 1)) * 100));

    return {
      userId: member.userId,
      userName: member.userName,
      userAvatarUrl: member.userAvatarUrl,
      todayMinutes,
      todayHours,
      thisWeekMinutes,
      thisWeekHours: Number((thisWeekMinutes / 60).toFixed(1)),
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      streakDays: currentStreak,
      targetCompleted,
      progressPercentage,
      lastActive
    };
  });

  return entries.sort((a, b) => b.todayMinutes - a.todayMinutes);
}

// ==========================================
// Messages Methods
// ==========================================
export async function getCampaignMessages(campaignId: string): Promise<Message[]> {
  if (supabase) {
    const { data, error } = await supabase.from('messages').select('*').eq('campaign_id', campaignId).order('timestamp', { ascending: true });
    if (!error && data) return data.map(mapMessageFromDb);
  }
  const db = await initDb();
  return db.messages.filter(m => m.campaignId === campaignId);
}

export async function getDirectMessages(userId1: string, userId2: string): Promise<Message[]> {
  if (supabase) {
    const { data, error } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`)
      .order('timestamp', { ascending: true });
    if (!error && data) return data.map(mapMessageFromDb);
  }
  const db = await initDb();
  return db.messages.filter(
    m => (m.senderId === userId1 && m.recipientId === userId2) ||
         (m.senderId === userId2 && m.recipientId === userId1)
  );
}

export async function createMessage(message: Message): Promise<Message> {
  const isDm = Boolean(message.recipientId);
  const msgType = message.type || (isDm ? 'dm' : 'campaign');
  const ts = message.timestamp || message.createdAt || new Date().toISOString();

  if (supabase) {
    await supabase.from('messages').insert({
      id: message.id,
      campaign_id: message.campaignId || (isDm ? null : 'general'),
      sender_id: message.senderId,
      sender_name: message.senderName,
      sender_avatar_url: message.senderAvatarUrl || '',
      content: message.content,
      timestamp: ts,
      created_at: ts,
      type: msgType,
      recipient_id: message.recipientId || null,
      attachment_url: message.attachmentUrl || null,
      attachment_name: message.attachmentName || null,
      attachment_type: message.attachmentType || null
    });
  }
  const db = await initDb();
  const fullMsg = { ...message, timestamp: ts, createdAt: ts, type: msgType as any };
  db.messages.push(fullMsg);
  saveDb();
  return fullMsg;
}

export async function toggleMessageReaction(messageId: string, emoji: string, userId: string, userName: string): Promise<Message | null> {
  const db = await initDb();
  const msg = db.messages.find(m => m.id === messageId);
  if (!msg) return null;

  if (!msg.reactions) msg.reactions = [];
  const existingIdx = msg.reactions.findIndex(r => r.emoji === emoji && r.userId === userId);
  if (existingIdx >= 0) {
    msg.reactions.splice(existingIdx, 1);
  } else {
    msg.reactions.push({ emoji, userId, userName });
  }

  saveDb();
  return msg;
}

// ==========================================
// Call Sessions & Participant Methods
// ==========================================
export async function getCallSession(campaignId: string): Promise<CallSession | null> {
  if (supabase) {
    const { data, error } = await supabase.from('active_calls').select('*').eq('campaign_id', campaignId).single();
    if (!error && data && data.session_data) {
      return data.session_data as CallSession;
    }
  }
  const db = await initDb();
  return db.activeCalls[campaignId] || null;
}

export async function saveCallSession(campaignId: string, session: CallSession | null): Promise<void> {
  if (supabase) {
    if (session) {
      await supabase.from('active_calls').upsert({
        campaign_id: campaignId,
        session_data: session,
        updated_at: new Date().toISOString()
      });
    } else {
      await supabase.from('active_calls').delete().eq('campaign_id', campaignId);
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

export async function addCallParticipant(campaignId: string, participant: CallParticipant): Promise<CallSession> {
  let session = await getCallSession(campaignId);
  if (!session) {
    session = {
      campaignId,
      campaignName: 'Study Lounge',
      startedAt: new Date().toISOString(),
      participants: []
    };
  }

  const existingIdx = session.participants.findIndex(p => p.userId === participant.userId);
  if (existingIdx >= 0) {
    session.participants[existingIdx] = { ...session.participants[existingIdx], ...participant };
  } else {
    session.participants.push(participant);
  }

  await saveCallSession(campaignId, session);
  return session;
}

export async function removeCallParticipant(campaignId: string, userIdOrSocketId: string): Promise<CallSession | null> {
  const session = await getCallSession(campaignId);
  if (!session) return null;

  // Match by socketId first (called from socket server), then fallback to userId (REST leave)
  session.participants = session.participants.filter(
    p => p.socketId !== userIdOrSocketId && p.userId !== userIdOrSocketId
  );
  if (session.participants.length === 0) {
    await saveCallSession(campaignId, null);
    return null;
  }

  await saveCallSession(campaignId, session);
  return session;
}

export async function updateParticipantState(campaignId: string, userIdOrSocketId: string, updates: Partial<CallParticipant>): Promise<CallSession | null> {
  const session = await getCallSession(campaignId);
  if (!session) return null;

  // Match by socketId first, then fallback to userId
  const p = session.participants.find(
    part => part.socketId === userIdOrSocketId || part.userId === userIdOrSocketId
  );
  if (p) {
    Object.assign(p, updates);
    await saveCallSession(campaignId, session);
  }
  return session;
}
