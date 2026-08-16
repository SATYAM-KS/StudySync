import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.tsx';
import { LiveStudySession, Message, CallSession } from '../types/index.ts';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUserIds: string[];
  activeStudySessions: LiveStudySession[];
  activeCallSession: CallSession | null;
  joinCampaignRoom: (campaignId: string) => void;
  leaveCampaignRoom: (campaignId: string) => void;
  sendMessage: (data: Partial<Message>) => Promise<{ success: boolean; message?: Message }>;
  reactToMessage: (messageId: string, emoji: string, campaignId?: string, recipientId?: string) => void;
  startTyping: (params: { campaignId?: string; recipientId?: string }) => void;
  stopTyping: (params: { campaignId?: string; recipientId?: string }) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [activeStudySessions, setActiveStudySessions] = useState<LiveStudySession[]>([]);
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);

  useEffect(() => {
    if (!user) return;

    const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

    const newSocket = io(window.location.origin, {
      reconnectionAttempts: isVercelHost ? 1 : 5,
      reconnectionDelay: 3000,
      timeout: 4000,
      transports: ['websocket', 'polling'],
      autoConnect: !isVercelHost // On Vercel, REST polling handles real-time sync
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('user:online', {
        userId: user.id,
        userName: user.name,
        userAvatarUrl: user.avatarUrl
      });
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('presence:online_users', (userIds: string[]) => {
      setOnlineUserIds(userIds);
    });

    newSocket.on('study:active_sessions', (sessions: LiveStudySession[]) => {
      setActiveStudySessions(sessions);
    });

    newSocket.on('call:session_updated', (session: CallSession | null) => {
      setActiveCallSession(session);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id]);

  // Presence & Active Study Sessions Heartbeat via REST (ensures online users & live study peers sync even on Vercel)
  const { token } = useAuth();
  useEffect(() => {
    if (!token || !user) return;

    const syncPresenceAndSessions = async () => {
      try {
        // 1. Presence Heartbeat
        const presRes = await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (presRes.ok) {
          const presData = await presRes.json();
          if (Array.isArray(presData.onlineUserIds)) {
            setOnlineUserIds(presData.onlineUserIds);
          }
        }

        // 2. Active Study Sessions Query
        const studyRes = await fetch('/api/study/sessions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (studyRes.ok) {
          const studyData = await studyRes.json();
          if (Array.isArray(studyData)) {
            setActiveStudySessions(studyData);
          }
        }
      } catch {}
    };

    syncPresenceAndSessions();
    const interval = setInterval(syncPresenceAndSessions, 2000);
    return () => clearInterval(interval);
  }, [token, user]);

  const joinCampaignRoom = (campaignId: string) => {
    if (socket && isConnected) {
      socket.emit('campaign:join_room', campaignId);
    }
  };

  const leaveCampaignRoom = (campaignId: string) => {
    if (socket && isConnected) {
      socket.emit('campaign:leave_room', campaignId);
    }
  };

  const sendMessage = async (data: Partial<Message>): Promise<{ success: boolean; message?: Message }> => {
    if (socket && isConnected) {
      return new Promise((resolve) => {
        socket.emit('message:send', data, (res: any) => {
          resolve(res || { success: true });
        });
      });
    }

    // REST Fallback for Serverless / Vercel
    if (!token) return { success: false };
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const msg = await res.json();
        return { success: true, message: msg };
      }
    } catch (e) {
      console.error('REST sendMessage error:', e);
    }
    return { success: false };
  };

  const reactToMessage = async (messageId: string, emoji: string, campaignId?: string, recipientId?: string) => {
    if (socket && isConnected) {
      socket.emit('message:react', { messageId, emoji, campaignId, recipientId });
      return;
    }

    // REST Fallback
    if (!token) return;
    try {
      await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });
    } catch {}
  };

  const startTyping = (params: { campaignId?: string; recipientId?: string }) => {
    if (socket && isConnected) {
      socket.emit('typing:start', params);
    }
  };

  const stopTyping = (params: { campaignId?: string; recipientId?: string }) => {
    if (socket && isConnected) {
      socket.emit('typing:stop', params);
    }
  };

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      onlineUserIds,
      activeStudySessions,
      activeCallSession,
      joinCampaignRoom,
      leaveCampaignRoom,
      sendMessage,
      reactToMessage,
      startTyping,
      stopTyping
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
