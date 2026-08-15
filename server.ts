import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';

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
  getCallSession
} from './src/server/db.ts';
import { generateToken, authMiddleware, optionalAuthMiddleware, AuthRequest } from './src/server/auth.ts';
import { setupSocketServer } from './src/server/socket.ts';
import { analyzeScreenSnapshot } from './src/server/ai.ts';
import { User, Campaign, CampaignMembership, StudyBlock, Message } from './src/types/index.ts';

const isVercel = Boolean(process.env.VERCEL);
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);
let currentPort = DEFAULT_PORT;
const app = express();
const server = http.createServer(app);

// Enable JSON body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup file uploads directory
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
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
    const { name, email, password, avatarUrl, bio, studyGoal } = req.body;
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

    // Generate 6-digit security code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    passwordResetCodes.set(cleanEmail, { code, expiresAt });

    res.json({ 
      success: true, 
      message: `Reset code generated for ${cleanEmail}`,
      code,
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
    const { name, avatarUrl, bio, studyGoal } = req.body;
    const updated = await updateUser(req.user!.id, {
      ...(name !== undefined && { name }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || '' }),
      ...(bio !== undefined && { bio }),
      ...(studyGoal !== undefined && { studyGoal })
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
    res.status(500).json({ error: 'Failed to update campaign' });
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

// Automatic AI Screen Focus Verification (Every 5 mins)
app.post('/api/study/verify-screen', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId, subjectNote, snapshotUrl } = req.body;
    if (!campaignId || !snapshotUrl) {
      res.status(400).json({ error: 'campaignId and snapshotUrl are required' });
      return;
    }

    const campaign = await getCampaignById(campaignId);
    const analysis = await analyzeScreenSnapshot(
      snapshotUrl, 
      campaign?.name || 'Study Campaign', 
      subjectNote || 'Focus Study'
    );

    let savedBlock: StudyBlock | null = null;

    if (analysis.isProductiveWork) {
      // Automatically register +5 minutes of verified study time
      const block: StudyBlock = {
        id: `blk_${req.user!.id}_${Date.now()}`,
        userId: req.user!.id,
        userName: req.user!.name,
        userAvatarUrl: req.user!.avatarUrl,
        campaignId,
        campaignName: campaign?.name || 'Study Campaign',
        timestamp: new Date().toISOString(),
        durationMinutes: 5,
        status: 'active',
        subjectNote: subjectNote || analysis.activitySummary || 'Focus Study',
        snapshotUrl
      };

      savedBlock = await logStudyBlock(block);

      // Broadcast to cohort leaderboard in real-time
      io.to(`campaign:${campaignId}`).emit('study:block_logged', {
        block: savedBlock,
        userId: req.user!.id
      });
    }

    res.json({
      registered: analysis.isProductiveWork,
      analysis,
      block: savedBlock
    });
  } catch (err: any) {
    console.error('Verify screen error:', err);
    res.status(500).json({ error: 'Failed to verify screen snapshot' });
  }
});

app.get('/api/study/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userBlocks = await getStudyBlocksForUser(req.user!.id);
    const activeBlocks = userBlocks.filter(b => b.status === 'active');

    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const todayLocalDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 86400000;

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let totalMinutes = 0;
    const dailyMinutesMap: Record<string, number> = {};

    activeBlocks.forEach(b => {
      const bTime = new Date(b.timestamp).getTime();
      const dateStr = b.timestamp.split('T')[0];
      dailyMinutesMap[dateStr] = (dailyMinutesMap[dateStr] || 0) + b.durationMinutes;

      totalMinutes += b.durationMinutes;
      const isToday = b.timestamp.startsWith(todayDateStr) || b.timestamp.startsWith(todayLocalDateStr) || bTime >= todayStart;
      if (isToday) todayMinutes += b.durationMinutes;
      if (bTime >= weekStart || isToday) thisWeekMinutes += b.durationMinutes;
    });

    // Recent 7 days breakdown
    const recentDays = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 86400000);
      const dateStr = date.toISOString().split('T')[0];
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
    const { campaignId, recipientId, content, attachmentUrl, attachmentType } = req.body;
    if (!content && !attachmentUrl) {
      res.status(400).json({ error: 'Message must have content or an attachment' });
      return;
    }

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderAvatarUrl: req.user!.avatarUrl,
      campaignId: campaignId || null,
      recipientId: recipientId || null,
      content: content || '',
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      createdAt: new Date().toISOString(),
      reactions: []
    };

    const saved = await createMessage(newMsg);

    if (saved.campaignId) {
      io.to(`campaign:${saved.campaignId}`).emit('message:new', saved);
    } else if (saved.recipientId) {
      io.to(`user:${saved.senderId}`).to(`user:${saved.recipientId}`).emit('message:new', saved);
    }

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 5. File & Image Upload
app.post('/api/upload', authMiddleware, upload.single('file'), (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const isImage = req.file.mimetype.startsWith('image/');
  const fileUrl = `/uploads/${req.file.filename}`;

  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    type: isImage ? 'image' : 'file',
    size: req.file.size
  });
});

// 6. Voice Call Status & Signaling
app.get('/api/calls/:campaignId', async (req, res) => {
  try {
    const session = await getCallSession(req.params.campaignId);
    res.json(session || { participants: [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch call session' });
  }
});

// ==========================================
// Vite Middleware & Static Server
// ==========================================
async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== 'production') {
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

if (!isVercel) {
  startServer();
}
