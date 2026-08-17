import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';

import {
  initDb,
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  updateUserPasswordByEmail,
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignMembers,
  getMembership,
  createMembership,
  updateMembership,
  deleteMembership,
  logStudyBlock,
  getStudyBlocksForUser,
  getCampaignLeaderboard,
  getCampaignMessages,
  getDirectMessages,
  createMessage,
  deleteMessage,
  getCallSession,
  saveCallSession,
  addCallParticipant,
  removeCallParticipant
} from './src/server/db.ts';
import { generateToken, authMiddleware, optionalAuthMiddleware, AuthRequest } from './src/server/auth.ts';
import { sendPasswordResetEmail } from './src/server/email.ts';
import { 
  setupSocketServer, 
  touchUserPresence, 
  removeUserPresence, 
  getOnlineUserIds, 
  touchStudySession, 
  removeStudySession, 
  getActiveStudySessions 
} from './src/server/socket.ts';
import { analyzeScreenSnapshot } from './src/server/ai.ts';
import { AccessToken } from 'livekit-server-sdk';
import { supabase } from './src/server/supabase.ts';

const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);
let currentPort = DEFAULT_PORT;
const app = express();
const server = http.createServer(app);

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Enable JSON body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup file uploads directory (for temporary disk caching if needed)
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
}
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Setup Socket.io
const io = setupSocketServer(server);

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, avatarUrl, bio, studyGoal, leetcodeUrl, hackerrankUrl } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser: User & { passwordHash: string } = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      email,
      passwordHash,
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      bio: bio || '',
      studyGoal: studyGoal || '',
      leetcodeUrl: leetcodeUrl || '',
      hackerrankUrl: hackerrankUrl || '',
      createdAt: new Date().toISOString()
    };

    const user = await createUser(newUser);
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { passwordHash, ...cleanUser } = user;
    const token = generateToken(cleanUser);
    res.json({ user: cleanUser, token });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// In-memory verification code store for password reset
const passwordResetCodes = new Map<string, { code: string; expiresAt: number }>();

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      res.status(404).json({ error: 'No user account found with this email address' });
      return;
    }

    // Generate 6-digit secure security code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    passwordResetCodes.set(cleanEmail, { code, expiresAt });

    // Send real OTP email to user's inbox
    await sendPasswordResetEmail(cleanEmail, code, user.name);

    res.json({ 
      success: true, 
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your inbox and spam folder.`,
      email: cleanEmail
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, verification code, and new password are required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const resetEntry = passwordResetCodes.get(cleanEmail);

    if (!resetEntry) {
      res.status(400).json({ error: 'No active reset request found. Please request a new code.' });
      return;
    }

    if (Date.now() > resetEntry.expiresAt) {
      passwordResetCodes.delete(cleanEmail);
      res.status(400).json({ error: 'The verification code has expired. Please request a new code.' });
      return;
    }

    if (resetEntry.code !== code.trim()) {
      res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await updateUserPasswordByEmail(cleanEmail, passwordHash);
    if (!updated) {
      res.status(404).json({ error: 'User account could not be found' });
      return;
    }

    passwordResetCodes.delete(cleanEmail);

    const updatedUser = await getUserByEmail(cleanEmail);
    if (updatedUser) {
      const { passwordHash: _, ...cleanUser } = updatedUser;
      const token = generateToken(cleanUser);
      res.json({ 
        success: true, 
        message: 'Password has been reset successfully',
        user: cleanUser,
        token 
      });
    } else {
      res.json({ success: true, message: 'Password has been reset successfully' });
    }
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

app.get('/api/auth/users', async (_req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/auth/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, avatarUrl, bio, studyGoal, leetcodeUrl, hackerrankUrl } = req.body;
    const updated = await updateUser(req.user!.id, {
      ...(name !== undefined && { name }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || '' }),
      ...(bio !== undefined && { bio }),
      ...(studyGoal !== undefined && { studyGoal }),
      ...(leetcodeUrl !== undefined && { leetcodeUrl }),
      ...(hackerrankUrl !== undefined && { hackerrankUrl })
    });
    res.json({ user: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});


// 2. Campaign Routes
app.get('/api/campaigns', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaigns = await getCampaigns(req.user?.id);
    res.json(campaigns);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

app.get('/api/campaigns/:id', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await getCampaignById(req.params.id, req.user?.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

app.post('/api/campaigns', authMiddleware, async (req: AuthRequest, res) => {
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
      res.status(400).json({ error: 'Name, start date, and end date are required' });
      return;
    }

    const newCampaign: Campaign = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      description: description || '',
      category: category || 'General Studies',
      adminId: req.user!.id,
      adminName: req.user!.name,
      startDate,
      endDate,
      dailyStartTime: dailyStartTime || '06:00',
      dailyEndTime: dailyEndTime || '22:00',
      targetDailyHours: Number(targetDailyHours) || 4,
      schedule: Array.isArray(schedule) ? schedule : undefined,
      maxMembers: Number(maxMembers) || 25,
      isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
      bannerColor: bannerColor || 'from-emerald-600 to-teal-800',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map((t: string) => t.trim()) : ['Accountability']),
      createdAt: new Date().toISOString()
    };

    const created = await createCampaign(newCampaign, req.user!);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

app.put('/api/campaigns/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await getCampaignById(req.params.id, req.user!.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Check if user is admin or co-admin
    const membership = await getMembership(req.user!.id, req.params.id);
    if (campaign.adminId !== req.user!.id && membership?.role !== 'admin' && membership?.role !== 'co-admin') {
      res.status(403).json({ error: 'Unauthorized to edit campaign settings' });
      return;
    }

    const updated = await updateCampaign(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('[PUT /api/campaigns/:id]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to update campaign' });
  }
});

app.delete('/api/campaigns/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await getCampaignById(req.params.id, req.user!.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    if (campaign.adminId !== req.user!.id) {
      res.status(403).json({ error: 'Only the campaign creator can delete this campaign' });
      return;
    }
    await deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// Campaign Membership & Join Requests
app.get('/api/campaigns/:id/members', optionalAuthMiddleware, async (req, res) => {
  try {
    const members = await getCampaignMembers(req.params.id);
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.post('/api/campaigns/:id/join', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const existing = await getMembership(req.user!.id, req.params.id);
    if (existing) {
      if (existing.status === 'approved') {
        res.status(400).json({ error: 'Already an approved member of this campaign' });
        return;
      } else if (existing.status === 'pending') {
        res.status(400).json({ error: 'Join request already submitted and pending review' });
        return;
      }
    }

    // Check member limit
    const members = await getCampaignMembers(req.params.id);
    const approvedCount = members.filter(m => m.status === 'approved').length;
    if (approvedCount >= campaign.maxMembers) {
      res.status(400).json({ error: 'This campaign is at maximum member capacity' });
      return;
    }

    const newMembership: CampaignMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: req.user!.id,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userAvatarUrl: req.user!.avatarUrl,
      campaignId: req.params.id,
      role: 'member',
      status: 'pending', // Pending admin review
      joinedAt: new Date().toISOString()
    };

    const saved = await createMembership(newMembership);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit join request' });
  }
});

app.put('/api/campaigns/:id/members/:memberId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Verify caller is admin or co-admin
    const callerMembership = await getMembership(req.user!.id, req.params.id);
    const isCallerAdmin = campaign.adminId === req.user!.id || callerMembership?.role === 'admin' || callerMembership?.role === 'co-admin';

    if (!isCallerAdmin) {
      res.status(403).json({ error: 'Only admins can approve/modify memberships' });
      return;
    }

    const { status, role } = req.body;
    const updated = await updateMembership(req.params.memberId, {
      ...(status && { status }),
      ...(role && { role })
    });

    if (!updated) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update membership' });
  }
});

app.delete('/api/campaigns/:id/members/:memberId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const members = await getCampaignMembers(req.params.id);
    const targetMember = members.find(m => m.id === req.params.memberId || m.userId === req.params.memberId);
    if (!targetMember) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Allow user to leave voluntarily OR admin to kick
    const isSelf = targetMember.userId === req.user!.id;
    const callerMembership = await getMembership(req.user!.id, req.params.id);
    const isCallerAdmin = campaign.adminId === req.user!.id || callerMembership?.role === 'admin' || callerMembership?.role === 'co-admin';

    if (!isSelf && !isCallerAdmin) {
      res.status(403).json({ error: 'Unauthorized to remove this member' });
      return;
    }

    await deleteMembership(targetMember.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Campaign Leaderboard
app.get('/api/campaigns/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getCampaignLeaderboard(req.params.id);
    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute leaderboard' });
  }
});

// 3. Study Tracking (5-Minute Blocks & Stats)
app.post('/api/study/block', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId, status = 'active', subjectNote, snapshotUrl } = req.body;
    if (!campaignId) {
      res.status(400).json({ error: 'campaignId is required' });
      return;
    }

    const campaign = await getCampaignById(campaignId);

    const block: StudyBlock = {
      id: `blk_${req.user!.id}_${Date.now()}`,
      userId: req.user!.id,
      userName: req.user!.name,
      userAvatarUrl: req.user!.avatarUrl,
      campaignId,
      campaignName: campaign?.name || 'Study Campaign',
      timestamp: new Date().toISOString(),
      durationMinutes: 5,
      status: status === 'idle' ? 'idle' : 'active',
      subjectNote: subjectNote || 'Focus Study',
      snapshotUrl: snapshotUrl || undefined
    };

    const saved = await logStudyBlock(block);

    // Broadcast study block event to update active leaderboard counters in realtime
    io.to(`campaign:${campaignId}`).emit('study:block_logged', {
      block: saved,
      userId: req.user!.id
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Log block error:', err);
    res.status(500).json({ error: 'Failed to log study block' });
  }
});

// Live Active Study Sessions (Heartbeat & Query for Serverless)
app.post('/api/study/session/heartbeat', authMiddleware, (req: AuthRequest, res) => {
  const { campaignId, campaignName, subjectNote, startedAt } = req.body;
  if (!campaignId) {
    res.status(400).json({ error: 'campaignId required' });
    return;
  }

  touchStudySession({
    userId: req.user!.id,
    userName: req.user!.name,
    userAvatarUrl: req.user!.avatarUrl,
    campaignId,
    campaignName: campaignName || 'Study Campaign',
    subjectNote: subjectNote || 'Focus Study',
    startedAt: startedAt || new Date().toISOString(),
    activeMinutes: 0
  });

  res.json({ success: true, activeStudySessions: getActiveStudySessions() });
});

app.post('/api/study/session/stop', authMiddleware, (req: AuthRequest, res) => {
  removeStudySession(req.user!.id);
  res.json({ success: true, activeStudySessions: getActiveStudySessions() });
});

app.get('/api/study/sessions', (_req, res) => {
  res.json(getActiveStudySessions());
});

// Automatic AI Screen Focus Verification (Every 5 mins)
app.post('/api/study/verify-screen', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId, subjectNote, snapshotUrl } = req.body;
    if (!campaignId || !snapshotUrl) {
      res.status(400).json({ error: 'campaignId and snapshotUrl are required' });
      return;
    }

    let campaignName = 'Study Campaign';
    try {
      const campaign = await getCampaignById(campaignId);
      if (campaign?.name) campaignName = campaign.name;
    } catch (cErr) {
      console.warn('Could not fetch campaign name for proctor:', cErr);
    }

    let analysis: any = {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: 'Proctor Evaluation',
      category: 'idle',
      reason: 'AI evaluation in progress or check flagged.'
    };

    try {
      analysis = await analyzeScreenSnapshot(
        snapshotUrl, 
        campaignName, 
        subjectNote || 'Focus Study'
      );
    } catch (aErr: any) {
      console.warn('AI analysis error, flagging block as idle:', aErr?.message || aErr);
      analysis = {
        isProductiveWork: false,
        confidence: 80,
        activitySummary: 'Inspection Flagged',
        category: 'idle',
        reason: aErr?.message || 'Proctor inspection timeout or non-study content detected.'
      };
    }

    const isProductive = Boolean(analysis.isProductiveWork);
    const block: StudyBlock = {
      id: `blk_${req.user!.id}_${Date.now()}`,
      userId: req.user!.id,
      userName: req.user!.name,
      userAvatarUrl: req.user!.avatarUrl,
      campaignId,
      campaignName,
      timestamp: new Date().toISOString(),
      durationMinutes: 5,
      status: isProductive ? 'active' : 'idle',
      subjectNote: subjectNote || analysis.activitySummary || (isProductive ? 'Focus Study' : 'Non-Study Activity Detected'),
      snapshotUrl
    };

    let savedBlock: StudyBlock = block;
    try {
      savedBlock = await logStudyBlock(block);
    } catch (dbErr) {
      console.error('Failed to persist study block in DB:', dbErr);
    }

    // Always broadcast every inspection (pass or fail)
    try {
      io.to(`campaign:${campaignId}`).emit('study:block_logged', {
        block: savedBlock,
        userId: req.user!.id,
        campaignId
      });
      io.emit('study:block_logged', {
        block: savedBlock,
        userId: req.user!.id,
        campaignId
      });
    } catch {}

    res.json({
      registered: isProductive,
      analysis,
      block: savedBlock
    });
  } catch (err: any) {
    console.error('Verify screen error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to verify screen snapshot' });
  }
});

app.get('/api/study/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userBlocks = await getStudyBlocksForUser(req.user!.id);
    const activeBlocks = userBlocks.filter(b => b.status === 'active');

    const now = new Date();
    // 2:00 AM Study Day Boundary
    const adjustedNow = new Date(now.getTime() - 2 * 3600000);
    const todayStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate(), 2, 0, 0, 0).getTime();
    const weekStart = todayStart - 6 * 86400000;

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;
    const dailyMinutesMap: Record<string, number> = {};

    activeBlocks.forEach(b => {
      const bTime = new Date(b.timestamp).getTime();
      const adjustedBTime = new Date(bTime - 2 * 3600000);
      const dateStr = `${adjustedBTime.getFullYear()}-${String(adjustedBTime.getMonth() + 1).padStart(2, '0')}-${String(adjustedBTime.getDate()).padStart(2, '0')}`;
      dailyMinutesMap[dateStr] = (dailyMinutesMap[dateStr] || 0) + b.durationMinutes;

      totalMinutes += b.durationMinutes;
      if (bTime >= todayStart) todayMinutes += b.durationMinutes;
      if (bTime >= weekStart) thisWeekMinutes += b.durationMinutes;
    });

    // Recent 7 days breakdown (2 AM boundary aligned)
    const recentDays = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(adjustedNow.getTime() - d * 86400000);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      recentDays.push({
        date: dateStr,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
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
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user study stats' });
  }
});

app.get('/api/study/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const userBlocks = await getStudyBlocksForUser(req.user!.id, campaignId);
    
    // Sort latest first
    const sortedBlocks = userBlocks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const now = new Date();
    const adjustedNow = new Date(now.getTime() - 2 * 3600000);
    const todayStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate(), 2, 0, 0, 0).getTime();
    const weekStart = todayStart - 6 * 86400000;
    const monthStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), 1, 2, 0, 0, 0).getTime();

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let thisMonthMinutes = 0;
    let totalMinutes = 0;

    sortedBlocks.forEach(b => {
      if (b.status === 'active') {
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
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch study history' });
  }
});

// 4. Messaging
app.get('/api/messages/campaign/:campaignId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const messages = await getCampaignMessages(req.params.campaignId);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/messages/direct/:otherUserId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const messages = await getDirectMessages(req.user!.id, req.params.otherUserId);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch direct messages' });
  }
});

app.post('/api/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId, recipientId, content, attachmentUrl, attachmentName, attachmentType } = req.body;
    if (!content && !attachmentUrl) {
      res.status(400).json({ error: 'Message must have content or an attachment' });
      return;
    }

    const now = new Date().toISOString();
    const newMsg: Message = {
      id: req.body.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderAvatarUrl: req.user!.avatarUrl,
      campaignId: campaignId || null,
      recipientId: recipientId || null,
      content: content || '',
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
        io.to(`campaign:${saved.campaignId}`).emit('message:new', saved);
      } else if (saved.recipientId) {
        io.to(`user:${saved.senderId}`).to(`user:${saved.recipientId}`).emit('message:new', saved);
      }
    }

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Failed to send message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.delete('/api/messages/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const campaignId = req.query.campaignId as string | undefined;
    await deleteMessage(id);

    if (io) {
      if (campaignId) {
        io.to(`campaign:${campaignId}`).emit('message:deleted', { id, messageId: id, campaignId });
      }
      io.emit('message:deleted', { id, messageId: id, campaignId });
    }

    res.json({ success: true, id });
  } catch (err: any) {
    console.error('Failed to delete message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// 5. File & Image Upload
app.post('/api/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const isImage = req.file.mimetype.startsWith('image/');
  const ext = path.extname(req.file.originalname) || (isImage ? '.jpg' : '.bin');
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  let fileUrl = `/uploads/${req.file.filename || uniqueName}`;

  try {
    let fileBuffer: Buffer | null = null;
    if (req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (req.file.path && fs.existsSync(req.file.path)) {
      fileBuffer = fs.readFileSync(req.file.path);
    }

    // If Supabase is available, try uploading to Supabase Storage
    if (supabase && fileBuffer) {
      try {
        const bucketName = 'study-uploads';
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(uniqueName, fileBuffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(uniqueName);
          if (publicUrlData?.publicUrl) {
            fileUrl = publicUrlData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('[Storage] Supabase storage upload warning:', storageErr);
      }
    }

    // Always ensure images and documents work reliably on Vercel serverless without 404s
    if (fileBuffer && (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://'))) {
      if (fileBuffer.length <= 8 * 1024 * 1024) { // Under 8MB
        const b64 = fileBuffer.toString('base64');
        fileUrl = `data:${req.file.mimetype || (isImage ? 'image/jpeg' : 'application/octet-stream')};base64,${b64}`;
      }
    }
  } catch (err) {
    console.error('Upload processing error:', err);
  }

  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    originalName: req.file.originalname,
    name: req.file.originalname,
    type: isImage ? 'image' : 'file',
    size: req.file.size
  });
});

// 6. Message Reactions REST endpoint
app.post('/api/messages/:messageId/react', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { emoji } = req.body;
    const updated = await toggleMessageReaction(req.params.messageId, emoji, req.user!.id, req.user!.name);
    res.json(updated || { success: false });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// 7. Presence Heartbeat REST endpoint (for Serverless/Vercel)
app.post('/api/presence/heartbeat', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  touchUserPresence(userId, req.user!.name, req.user!.avatarUrl);

  const { isStudying, campaignId, campaignName, subjectNote, startedAt } = req.body || {};
  if (isStudying === true && campaignId) {
    touchStudySession({
      userId,
      userName: req.user!.name,
      userAvatarUrl: req.user!.avatarUrl,
      campaignId,
      campaignName: campaignName || 'Study Campaign',
      subjectNote: subjectNote || 'Focus Study',
      startedAt: startedAt || new Date().toISOString(),
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

app.post('/api/presence/leave', optionalAuthMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id || req.body?.userId;
  if (userId) {
    removeUserPresence(userId);
  }
  res.json({ success: true });
});

app.get('/api/presence', (_req, res) => {
  res.json({ 
    onlineUserIds: getOnlineUserIds(),
    activeStudySessions: getActiveStudySessions()
  });
});

// 7b. LiveKit Token Generation
app.post('/api/livekit/token', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

    // Use env vars with fallback to configured defaults
    const apiKey = process.env.LIVEKIT_API_KEY || 'API7ZiCFQEGGpYa';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'mpqMnhk8LejhzDD9OqExRVaWip7GrdqZP6dtEjmbV7S';
    const livekitUrl = process.env.LIVEKIT_URL || 'wss://santam-kfcwvgq2.livekit.cloud';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.user!.id,
      name: req.user!.name,
      ttl: '4h'
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
  } catch (err: any) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ error: 'Failed to generate token', detail: String(err) });
  }
});

// 8. Voice Call Status & Signaling
app.get('/api/calls/:campaignId', async (req, res) => {
  try {
    const session = await getCallSession(req.params.campaignId);
    if (!session) return res.json({ participants: [] });

    // Auto-prune participants who haven't sent a heartbeat in > 20 seconds
    const now = Date.now();
    const alive = session.participants.filter(p => {
      if (!p.lastSeen) return true; // legacy participants without lastSeen stay
      return (now - new Date(p.lastSeen).getTime()) < 20000;
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
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch call session' });
  }
});

app.post('/api/calls/:campaignId/join', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { isMuted, isDeafened, isScreenSharing } = req.body;
    const session = await addCallParticipant(req.params.campaignId, {
      userId: req.user!.id,
      userName: req.user!.name,
      userAvatarUrl: req.user!.avatarUrl,
      isMuted: isMuted ?? false,
      isDeafened: isDeafened ?? false,
      isScreenSharing: isScreenSharing ?? false,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    });
    if (io) {
      io.to(`campaign:${req.params.campaignId}`).emit('call:session_updated', session);
      io.emit('call:participant_joined', { userId: req.user!.id, campaignId: req.params.campaignId, session });
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to join call' });
  }
});

// Heartbeat - keeps participant alive in the channel (call every 8-10s from client)
app.post('/api/calls/:campaignId/heartbeat', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { isMuted, isScreenSharing } = req.body || {};
    const session = await addCallParticipant(req.params.campaignId, {
      userId: req.user!.id,
      userName: req.user!.name,
      userAvatarUrl: req.user!.avatarUrl,
      isMuted: isMuted ?? false,
      isScreenSharing: isScreenSharing ?? false,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    });
    res.json({ ok: true, participantCount: session.participants.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

app.post('/api/calls/:campaignId/leave', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const session = await removeCallParticipant(req.params.campaignId, req.user!.id);
    if (io) {
      io.to(`campaign:${req.params.campaignId}`).emit('call:session_updated', session || { participants: [] });
      io.emit('call:participant_left', { userId: req.user!.id, campaignId: req.params.campaignId });
    }
    res.json(session || { participants: [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to leave call' });
  }
});

// ==========================================
// Vite Middleware & Static Server
// ==========================================
async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { port: 24679 }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  function tryListen(port: number) {
    server.listen(port, '0.0.0.0', () => {
      console.log(`\n========================================`);
      console.log(` StudySync is running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
      console.log(` URL: http://localhost:${port}`);
      console.log(`========================================\n`);
    });
  }

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' && !isProduction) {
      console.warn(`[Port in use] Port ${currentPort} is busy. Trying port ${currentPort + 1}...`);
      currentPort += 1;
      setTimeout(() => {
        tryListen(currentPort);
      }, 500);
    } else {
      console.error('Server error:', err);
    }
  });

  tryListen(currentPort);
}

export { app, server };
export default app;

if (!isVercel) {
  startServer();
}
