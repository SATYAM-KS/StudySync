import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { LiveStudySession } from '../types/index.ts';

interface ConnectedUser {
  socketId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  activeCampaignId?: string;
}

const connectedUsers = new Map<string, ConnectedUser>(); // socketId -> ConnectedUser
const activeStudySessions = new Map<string, LiveStudySession>(); // userId -> LiveStudySession
const restHeartbeats = new Map<string, { userId: string; userName: string; userAvatarUrl?: string; lastSeen: number }>();
const restStudySessions = new Map<string, { session: LiveStudySession; lastSeen: number }>();

let ioInstance: Server | null = null;

export function getOnlineUserIds(): string[] {
  const cutoff = Date.now() - 45000;
  for (const [id, data] of restHeartbeats.entries()) {
    if (data.lastSeen < cutoff) restHeartbeats.delete(id);
  }
  const socketUserIds = Array.from(connectedUsers.values()).map(u => u.userId);
  const restUserIds = Array.from(restHeartbeats.keys());
  return Array.from(new Set([...socketUserIds, ...restUserIds]));
}

export function getActiveStudySessions(): LiveStudySession[] {
  const cutoff = Date.now() - 45000;
  for (const [id, data] of restStudySessions.entries()) {
    if (data.lastSeen < cutoff) restStudySessions.delete(id);
  }
  const sessionMap = new Map<string, LiveStudySession>();
  for (const session of activeStudySessions.values()) {
    sessionMap.set(session.userId, session);
  }
  for (const data of restStudySessions.values()) {
    sessionMap.set(data.session.userId, data.session);
  }
  return Array.from(sessionMap.values());
}

export function broadcastOnlineUsers() {
  if (ioInstance) {
    ioInstance.emit('presence:online_users', getOnlineUserIds());
  }
}

export function broadcastStudySessions() {
  if (ioInstance) {
    ioInstance.emit('study:active_sessions', getActiveStudySessions());
  }
}

export function touchUserPresence(userId: string, userName: string, userAvatarUrl?: string) {
  restHeartbeats.set(userId, { userId, userName, userAvatarUrl, lastSeen: Date.now() });
  broadcastOnlineUsers();
}

export function removeUserPresence(userId: string) {
  restHeartbeats.delete(userId);
  broadcastOnlineUsers();
}

export function touchStudySession(session: LiveStudySession) {
  restStudySessions.set(session.userId, { session, lastSeen: Date.now() });
  broadcastStudySessions();
}

export function removeStudySession(userId: string) {
  restStudySessions.delete(userId);
  activeStudySessions.delete(userId);
  broadcastStudySessions();
}

export function setupSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    // 1. Presence & User Registration
    socket.on('user:online', (userData: { userId: string; userName: string; userAvatarUrl?: string }) => {
      connectedUsers.set(socket.id, {
        socketId: socket.id,
        userId: userData.userId,
        userName: userData.userName,
        userAvatarUrl: userData.userAvatarUrl,
      });

      socket.join(`user:${userData.userId}`);

      // Broadcast online list to everyone
      broadcastOnlineUsers();
      // Send active study sessions
      socket.emit('study:active_sessions', getActiveStudySessions());
    });

    // 2. Campaign Room Join / Leave
    socket.on('campaign:join_room', (campaignId: string) => {
      socket.join(`campaign:${campaignId}`);
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.activeCampaignId = campaignId;
      }
    });

    socket.on('campaign:leave_room', (campaignId: string) => {
      socket.leave(`campaign:${campaignId}`);
      const user = connectedUsers.get(socket.id);
      if (user && user.activeCampaignId === campaignId) {
        user.activeCampaignId = undefined;
      }
    });

    // 3. Real-time Live Study Session Status
    socket.on('study:start_session', ({ campaignId, campaignName, subjectNote }: { campaignId: string; campaignName: string; subjectNote?: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const liveSession: LiveStudySession = {
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        campaignId,
        campaignName,
        subjectNote,
        startedAt: new Date().toISOString(),
        activeMinutes: 0
      };

      activeStudySessions.set(user.userId, liveSession);
      restStudySessions.delete(user.userId);
      broadcastStudySessions();
    });

    socket.on('study:stop_session', () => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      activeStudySessions.delete(user.userId);
      restStudySessions.delete(user.userId);
      broadcastStudySessions();
    });

    socket.on('study:heartbeat', ({ activeMinutes }: { activeMinutes: number }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const session = activeStudySessions.get(user.userId);
      if (session) {
        session.activeMinutes = activeMinutes;
      }
    });

    // 4. Disconnect handling
    socket.on('disconnect', async () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        // Preserve study session with grace period for smooth page refresh
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

  return io;
}
