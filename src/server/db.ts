import fs from 'fs';
import path from 'path';
import { User, Campaign, CampaignMembership, StudyBlock, Message, LeaderboardEntry, CallSession, CallParticipant } from '../types/index.ts';

interface DBData {
  users: (User & { passwordHash: string })[];
  campaigns: Campaign[];
  memberships: CampaignMembership[];
  studyBlocks: StudyBlock[];
  messages: Message[];
  activeCalls: Record<string, CallSession>; // campaignId -> CallSession
}

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = process.env.DATA_DIR || (isVercel ? '/tmp/data' : path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'app_db.json');

let memoryDb: DBData | null = null;

export async function initDb(): Promise<DBData> {
  if (memoryDb) return memoryDb;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
      console.warn('Could not read existing db, starting fresh:', e);
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
    console.error('Error saving db to disk:', err);
  }
}

// User methods
export async function getUsers(): Promise<User[]> {
  const db = await initDb();
  return db.users.map(({ passwordHash, ...user }) => user);
}

export async function getUserById(id: string): Promise<(User & { passwordHash: string }) | undefined> {
  const db = await initDb();
  return db.users.find(u => u.id === id);
}

export async function getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | undefined> {
  const db = await initDb();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(userData: User & { passwordHash: string }): Promise<User> {
  const db = await initDb();
  db.users.push(userData);
  saveDb();
  const { passwordHash, ...user } = userData;
  return user;
}

export async function updateUserPasswordByEmail(email: string, newPasswordHash: string): Promise<boolean> {
  const db = await initDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  saveDb();
  return true;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const db = await initDb();
  const user = db.users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, updates);

  // Cascade name and avatarUrl updates across memberships, campaigns, etc.
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


// Campaign methods
export async function getCampaigns(userId?: string): Promise<Campaign[]> {
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
  const db = await initDb();
  db.campaigns.unshift(campaign);
  
  // Add creator as approved admin
  const membership: CampaignMembership = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId: creator.id,
    userName: creator.name,
    userEmail: creator.email,
    userAvatarUrl: creator.avatarUrl,
    campaignId: campaign.id,
    role: 'admin',
    status: 'approved',
    joinedAt: new Date().toISOString()
  };
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
  const db = await initDb();
  const c = db.campaigns.find(camp => camp.id === id);
  if (!c) return null;
  Object.assign(c, updates);
  saveDb();
  return c;
}

export async function deleteCampaign(id: string): Promise<boolean> {
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

// Membership methods
export async function getCampaignMembers(campaignId: string): Promise<CampaignMembership[]> {
  const db = await initDb();
  return db.memberships.filter(m => m.campaignId === campaignId);
}

export async function getMembership(userId: string, campaignId: string): Promise<CampaignMembership | undefined> {
  const db = await initDb();
  return db.memberships.find(m => m.userId === userId && m.campaignId === campaignId);
}

export async function createMembership(membership: CampaignMembership): Promise<CampaignMembership> {
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
  const db = await initDb();
  const mem = db.memberships.find(m => m.id === id);
  if (!mem) return null;
  Object.assign(mem, updates);
  saveDb();
  return mem;
}

export async function deleteMembership(id: string): Promise<boolean> {
  const db = await initDb();
  const idx = db.memberships.findIndex(m => m.id === id);
  if (idx === -1) return false;
  db.memberships.splice(idx, 1);
  saveDb();
  return true;
}

// Study Block methods
export async function logStudyBlock(block: StudyBlock): Promise<StudyBlock> {
  const db = await initDb();
  db.studyBlocks.push(block);
  saveDb();
  return block;
}

export async function getStudyBlocksForUser(userId: string, campaignId?: string): Promise<StudyBlock[]> {
  const db = await initDb();
  return db.studyBlocks.filter(b => b.userId === userId && (!campaignId || b.campaignId === campaignId));
}

export async function getCampaignLeaderboard(campaignId: string): Promise<LeaderboardEntry[]> {
  const db = await initDb();
  const campaign = db.campaigns.find(c => c.id === campaignId);
  const targetHours = campaign?.targetDailyHours || 4;

  const approvedMembers = db.memberships.filter(m => m.campaignId === campaignId && m.status === 'approved');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 86400000;

  const campaignBlocks = db.studyBlocks.filter(b => b.campaignId === campaignId && b.status === 'active');

  const entries: LeaderboardEntry[] = approvedMembers.map(member => {
    const userBlocks = campaignBlocks.filter(b => b.userId === member.userId);

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;
    let lastActive: string | undefined = undefined;

    // Daily active date map for streak calculation
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

    // Calculate streak days (consecutive days before/including today)
    let activeStreakDays = 0;
    for (let d = 0; d < 30; d++) {
      const checkDate = new Date(now.getTime() - d * 86400000).toISOString().split('T')[0];
      if (activeDaysSet.has(checkDate)) {
        activeStreakDays++;
      } else if (d > 0) {
        // Break if missing previous day
        break;
      }
    }

    const todayHours = todayMinutes / 60;

    return {
      userId: member.userId,
      userName: member.userName,
      userAvatarUrl: member.userAvatarUrl,
      role: member.role,
      todayMinutes,
      thisWeekMinutes,
      totalMinutes,
      activeStreakDays: Math.max(1, activeStreakDays),
      lastActive,
      targetDailyHours: targetHours,
      todayTargetMet: todayHours >= targetHours
    };
  });

  // Sort descending by totalMinutes default
  entries.sort((a, b) => b.totalMinutes - a.totalMinutes);
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  return entries;
}

// Message methods
export async function getCampaignMessages(campaignId: string, limit = 100): Promise<Message[]> {
  const db = await initDb();
  return db.messages
    .filter(m => m.campaignId === campaignId)
    .slice(-limit);
}

export async function getDirectMessages(user1Id: string, user2Id: string, limit = 100): Promise<Message[]> {
  const db = await initDb();
  return db.messages
    .filter(m => 
      (m.senderId === user1Id && m.recipientId === user2Id) ||
      (m.senderId === user2Id && m.recipientId === user1Id)
    )
    .slice(-limit);
}

export async function createMessage(message: Message): Promise<Message> {
  const db = await initDb();
  db.messages.push(message);
  saveDb();
  return message;
}

export async function toggleMessageReaction(messageId: string, emoji: string, userId: string): Promise<Message | null> {
  const db = await initDb();
  const msg = db.messages.find(m => m.id === messageId);
  if (!msg) return null;

  if (!msg.reactions) msg.reactions = [];
  const reaction = msg.reactions.find(r => r.emoji === emoji);

  if (reaction) {
    if (reaction.userIds.includes(userId)) {
      reaction.userIds = reaction.userIds.filter(id => id !== userId);
      if (reaction.userIds.length === 0) {
        msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
      }
    } else {
      reaction.userIds.push(userId);
    }
  } else {
    msg.reactions.push({ emoji, userIds: [userId] });
  }

  saveDb();
  return msg;
}

// Call Session methods
export async function getCallSession(campaignId: string): Promise<CallSession | null> {
  const db = await initDb();
  return db.activeCalls[campaignId] || null;
}

export async function addCallParticipant(campaignId: string, participant: CallParticipant): Promise<CallSession> {
  const db = await initDb();
  if (!db.activeCalls[campaignId]) {
    const campaign = db.campaigns.find(c => c.id === campaignId);
    db.activeCalls[campaignId] = {
      id: `call_${campaignId}_${Date.now()}`,
      campaignId,
      campaignName: campaign?.name || 'Study Room',
      startedAt: new Date().toISOString(),
      participants: []
    };
  }

  const session = db.activeCalls[campaignId];
  const existingIdx = session.participants.findIndex(p => p.socketId === participant.socketId || p.userId === participant.userId);
  if (existingIdx >= 0) {
    session.participants[existingIdx] = participant;
  } else {
    session.participants.push(participant);
  }

  return session;
}

export async function removeCallParticipant(campaignId: string, socketId: string): Promise<CallSession | null> {
  const db = await initDb();
  const session = db.activeCalls[campaignId];
  if (!session) return null;

  session.participants = session.participants.filter(p => p.socketId !== socketId);
  if (session.participants.length === 0) {
    session.endedAt = new Date().toISOString();
    delete db.activeCalls[campaignId];
    return null;
  }
  return session;
}

export async function updateParticipantState(campaignId: string, socketId: string, updates: Partial<CallParticipant>): Promise<CallSession | null> {
  const db = await initDb();
  const session = db.activeCalls[campaignId];
  if (!session) return null;
  const p = session.participants.find(part => part.socketId === socketId);
  if (p) {
    Object.assign(p, updates);
  }
  return session;
}
