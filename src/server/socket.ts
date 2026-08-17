import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createMessage, toggleMessageReaction, deleteMessage, getMessageById, getCampaignById, addCallParticipant, removeCallParticipant, updateParticipantState, getCallSession } from './db.ts';
import { Message, CallParticipant, LiveStudySession } from '../types/index.ts';

interface ConnectedUser {
  socketId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  activeCampaignId?: string;
  inCallCampaignId?: string;
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

      // Join user's private room for direct messages
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

    // 3. Realtime Chat Messages
    socket.on('message:send', async (messageData: Partial<Message>, callback?: (res: any) => void) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const newMsg: Message = {
        id: messageData.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        senderId: user.userId,
        senderName: user.userName,
        senderAvatarUrl: user.userAvatarUrl,
        campaignId: messageData.campaignId || null,
        recipientId: messageData.recipientId || null,
        content: messageData.content || '',
        attachmentUrl: messageData.attachmentUrl || null,
        attachmentName: messageData.attachmentName || null,
        attachmentType: messageData.attachmentType || null,
        createdAt: new Date().toISOString(),
        reactions: []
      };

      const saved = await createMessage(newMsg);

      if (saved.campaignId) {
        // Broadcast to all campaign members
        io.to(`campaign:${saved.campaignId}`).emit('message:new', saved);
      } else if (saved.recipientId) {
        // Direct message: emit to both sender and recipient rooms
        io.to(`user:${saved.senderId}`).to(`user:${saved.recipientId}`).emit('message:new', saved);
      }

      if (callback) callback({ success: true, message: saved });
    });

    // 4. Message Reactions
    socket.on('message:react', async ({ messageId, emoji, campaignId, recipientId }: { messageId: string; emoji: string; campaignId?: string; recipientId?: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const updated = await toggleMessageReaction(messageId, emoji, user.userId, user.userName);
      if (updated) {
        if (campaignId) {
          io.to(`campaign:${campaignId}`).emit('message:updated', updated);
        } else if (recipientId) {
          io.to(`user:${user.userId}`).to(`user:${recipientId}`).emit('message:updated', updated);
        }
      }
    });

    // 4b. Delete message event
    socket.on('message:delete', async ({ messageId, campaignId, recipientId }: { messageId: string; campaignId?: string; recipientId?: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const msg = await getMessageById(messageId);
      if (msg) {
        const isAuthor = msg.senderId === user.userId;
        let isAdmin = false;

        const targetCampaignId = msg.campaignId || campaignId;
        if (targetCampaignId) {
          const campaign = await getCampaignById(targetCampaignId, user.userId);
          if (campaign) {
            isAdmin = campaign.adminId === user.userId || campaign.userRole === 'admin' || campaign.userRole === 'co-admin';
          }
        }

        if (!isAuthor && !isAdmin) {
          socket.emit('error', { message: 'You are only authorized to delete your own messages.' });
          return;
        }
      }

      await deleteMessage(messageId);
      if (campaignId) {
        io.to(`campaign:${campaignId}`).emit('message:deleted', { id: messageId, messageId, campaignId });
      } else if (recipientId) {
        io.to(`user:${user.userId}`).to(`user:${recipientId}`).emit('message:deleted', { id: messageId, messageId, recipientId });
      }
    });

    // 5. Typing Indicators
    socket.on('typing:start', ({ campaignId, recipientId }: { campaignId?: string; recipientId?: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      if (campaignId) {
        socket.to(`campaign:${campaignId}`).emit('typing:status', {
          campaignId,
          userId: user.userId,
          userName: user.userName,
          isTyping: true
        });
      } else if (recipientId) {
        io.to(`user:${recipientId}`).emit('typing:status', {
          recipientId,
          userId: user.userId,
          userName: user.userName,
          isTyping: true
        });
      }
    });

    socket.on('typing:stop', ({ campaignId, recipientId }: { campaignId?: string; recipientId?: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      if (campaignId) {
        socket.to(`campaign:${campaignId}`).emit('typing:status', {
          campaignId,
          userId: user.userId,
          userName: user.userName,
          isTyping: false
        });
      } else if (recipientId) {
        io.to(`user:${recipientId}`).emit('typing:status', {
          recipientId,
          userId: user.userId,
          userName: user.userName,
          isTyping: false
        });
      }
    });

    // 6. Real-time Live Study Session Status
    socket.on('study:start_session', (sessionData: { campaignId: string; campaignName: string; subjectNote: string }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const session: LiveStudySession = {
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        campaignId: sessionData.campaignId,
        campaignName: sessionData.campaignName,
        subjectNote: sessionData.subjectNote,
        startedAt: new Date().toISOString(),
        activeMinutes: 0,
        isScreenSharedLocally: false
      };

      activeStudySessions.set(user.userId, session);
      io.emit('study:session_started', session);
      broadcastStudySessions();
    });

    socket.on('study:stop_session', () => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      if (activeStudySessions.has(user.userId)) {
        activeStudySessions.delete(user.userId);
        io.emit('study:session_ended', { userId: user.userId });
        broadcastStudySessions();
      }
    });

    // 7. Live Voice/Video Calls (WebRTC signaling + participant sync)
    socket.on('call:join', async ({ campaignId, isMuted = false, isVideoOn = false, isScreenSharing = false }: { campaignId: string; isMuted?: boolean; isVideoOn?: boolean; isScreenSharing?: boolean }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      user.inCallCampaignId = campaignId;
      socket.join(`call:${campaignId}`);

      const participant: CallParticipant = {
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        socketId: socket.id,
        isMuted,
        isVideoOn,
        isScreenSharing,
        joinedAt: new Date().toISOString()
      };

      const session = await addCallParticipant(campaignId, participant);
      const existingParticipants = session.participants.filter(p => p.socketId !== socket.id);
      
      // Notify all campaign members of active call participants
      io.to(`campaign:${campaignId}`).emit('call:session_updated', session);
      
      // Send existing peers to the joiner
      socket.emit('call:existing_peers', {
        existingParticipants
      });

      // Notify others in call room of new peer
      socket.to(`call:${campaignId}`).emit('call:peer_joined', {
        participant,
        existingParticipants
      });
    });

    socket.on('call:signal', ({ toSocketId, signal, type }: { toSocketId: string; signal: any; type: string }) => {
      io.to(toSocketId).emit('call:signal', {
        fromSocketId: socket.id,
        signal,
        type
      });
    });

    socket.on('call:video_frame', ({ campaignId, frameData }: { campaignId: string; frameData: string }) => {
      socket.to(`call:${campaignId}`).to(`campaign:${campaignId}`).emit('call:video_frame', {
        fromSocketId: socket.id,
        frameData
      });
    });

    socket.on('call:audio_chunk', ({ campaignId, audioData }: { campaignId: string; audioData: string }) => {
      socket.to(`call:${campaignId}`).to(`campaign:${campaignId}`).emit('call:audio_chunk', {
        fromSocketId: socket.id,
        audioData
      });
    });

    socket.on('call:speaking', ({ campaignId, isSpeaking }: { campaignId: string; isSpeaking: boolean }) => {
      socket.to(`call:${campaignId}`).emit('call:participant_speaking', {
        socketId: socket.id,
        isSpeaking
      });
    });

    socket.on('call:state_change', async ({ campaignId, isMuted, isScreenSharing }: { campaignId: string; isMuted?: boolean; isScreenSharing?: boolean }) => {
      const session = await updateParticipantState(campaignId, socket.id, {
        ...(isMuted !== undefined && { isMuted }),
        ...(isScreenSharing !== undefined && { isScreenSharing }),
      });
      if (session) {
        io.to(`campaign:${campaignId}`).to(`call:${campaignId}`).emit('call:session_updated', session);
      }
    });

    socket.on('call:leave', async (campaignId: string) => {
      handleCallLeave(socket, campaignId);
    });

    // 8. Disconnect handling
    socket.on('disconnect', async () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        // Leave call if any
        if (user.inCallCampaignId) {
          handleCallLeave(socket, user.inCallCampaignId);
        }
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

  async function handleCallLeave(socket: Socket, campaignId: string) {
    socket.leave(`call:${campaignId}`);
    const user = connectedUsers.get(socket.id);
    if (user) {
      user.inCallCampaignId = undefined;
    }
    const session = await removeCallParticipant(campaignId, socket.id);
    socket.to(`call:${campaignId}`).emit('call:peer_left', { socketId: socket.id });
    io.to(`campaign:${campaignId}`).emit('call:session_updated', session);
  }

  function broadcastOnlineUsers() {
    if (ioInstance) {
      ioInstance.emit('presence:online_users', getOnlineUserIds());
    }
  }

  return io;
}
