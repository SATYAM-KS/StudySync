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

    const newSocket = io(window.location.origin, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('user:online', {
        userId: user.id,
        userName: user.name,
        userAvatarUrl: user.avatarUrl
      });
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

  const joinCampaignRoom = (campaignId: string) => {
    if (socket) {
      socket.emit('campaign:join_room', campaignId);
    }
  };

  const leaveCampaignRoom = (campaignId: string) => {
    if (socket) {
      socket.emit('campaign:leave_room', campaignId);
    }
  };

  const sendMessage = (data: Partial<Message>): Promise<{ success: boolean; message?: Message }> => {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ success: false });
        return;
      }
      socket.emit('message:send', data, (res: any) => {
        resolve(res || { success: true });
      });
    });
  };

  const reactToMessage = (messageId: string, emoji: string, campaignId?: string, recipientId?: string) => {
    if (socket) {
      socket.emit('message:react', { messageId, emoji, campaignId, recipientId });
    }
  };

  const startTyping = (params: { campaignId?: string; recipientId?: string }) => {
    if (socket) {
      socket.emit('typing:start', params);
    }
  };

  const stopTyping = (params: { campaignId?: string; recipientId?: string }) => {
    if (socket) {
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
