import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { 
  X, 
  Send, 
  Image as ImageIcon, 
  MessageSquare, 
  Search
} from 'lucide-react';
import { format } from 'date-fns';

interface DirectMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DirectMessagesModal: React.FC<DirectMessagesModalProps> = ({ isOpen, onClose }) => {
  const { user, token, allUsers } = useAuth();
  const { socket, onlineUserIds, sendMessage, startTyping, stopTyping } = useSocket();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: 'image' | 'file'; filename: string } | null>(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Set default selected user
  useEffect(() => {
    if (allUsers.length > 0 && !selectedUser) {
      const other = allUsers.find(u => u.id !== user?.id);
      if (other) setSelectedUser(other);
    }
  }, [allUsers, user?.id]);

  // Load DM messages when recipient changes
  const fetchDMs = async () => {
    if (!token || !selectedUser) return;
    try {
      const res = await fetch(`/api/messages/direct/${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to load DMs:', e);
    }
  };

  useEffect(() => {
    fetchDMs();
  }, [selectedUser?.id, token]);

  // Real-time socket updates for DMs
  useEffect(() => {
    if (!socket || !selectedUser) return;

    const handleNewMessage = (msg: Message) => {
      if (
        (msg.senderId === selectedUser.id && msg.recipientId === user?.id) ||
        (msg.senderId === user?.id && msg.recipientId === selectedUser.id)
      ) {
        setMessages(prev => [...prev, msg]);
      }
    };

    const handleTypingStatus = (data: { recipientId?: string; userId: string; isTyping: boolean }) => {
      if (data.userId === selectedUser.id) {
        setIsRecipientTyping(data.isTyping);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:status', handleTypingStatus);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:status', handleTypingStatus);
    };
  }, [socket, selectedUser?.id, user?.id]);

  // Scroll within DM container ONLY — never let it bubble to the window
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedUser?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isRecipientTyping]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (selectedUser) {
      startTyping({ recipientId: selectedUser.id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping({ recipientId: selectedUser.id });
      }, 2000);
    }
  };

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedUser || (!inputText.trim() && !attachment)) return;

    const content = inputText.trim();
    const currAttachment = attachment;

    setInputText('');
    setAttachment(null);
    stopTyping({ recipientId: selectedUser.id });

    try {
      await sendMessage({
        recipientId: selectedUser.id,
        content,
        attachmentUrl: currAttachment?.url || null,
        attachmentType: currAttachment?.type || null
      });
    } catch (err) {
      console.error('Send DM error:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAttachment({
          url: data.url,
          type: data.type,
          filename: data.filename
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const otherUsers = allUsers.filter(u => u.id !== user?.id && u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl h-[650px] shadow-2xl flex flex-col md:flex-row overflow-hidden text-zinc-900 dark:text-zinc-100">
        
        {/* Left Sidebar: Member Directory */}
        <div className="w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950">
          
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-zinc-900 dark:text-white" />
              <h3 className="font-bold text-sm text-zinc-950 dark:text-white">Direct Messages</h3>
            </div>
            <button 
              onClick={onClose}
              className="md:hidden p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find student..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {otherUsers.map((u) => {
              const isOnline = onlineUserIds.includes(u.id);
              const isSelected = selectedUser?.id === u.id;

              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center space-x-3 p-2.5 rounded-2xl text-left transition cursor-pointer ${
                    isSelected 
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' 
                      : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      name={u.name}
                      avatarUrl={u.avatarUrl}
                      size="lg"
                      rounded="xl"
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${
                      isOnline ? (isSelected ? 'bg-white dark:bg-black' : 'bg-black dark:bg-white') : 'bg-zinc-400'
                    }`}></span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold truncate">
                        {u.name}
                      </p>
                      <span className={`text-[10px] ${isSelected ? 'opacity-80' : 'text-zinc-400'}`}>
                        {isOnline ? 'online' : 'away'}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate ${isSelected ? 'opacity-80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {u.studyGoal || u.bio || 'Accountability partner'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* Right Chat Pane */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900">
          
          {selectedUser ? (
            <>
              {/* Top Header */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <UserAvatar
                      name={selectedUser.name}
                      avatarUrl={selectedUser.avatarUrl}
                      size="sm"
                      rounded="lg"
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-zinc-900 ${
                      onlineUserIds.includes(selectedUser.id) ? 'bg-black dark:bg-white' : 'bg-zinc-400'
                    }`}></span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-950 dark:text-white">{selectedUser.name}</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{selectedUser.studyGoal || selectedUser.email}</p>
                  </div>
                </div>

                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message History */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ overscrollBehaviorY: 'contain' }}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 dark:text-zinc-500">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Start a conversation with {selectedUser.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Study together, share tips, and check in on daily progress.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === user?.id;

                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs ${
                          isMe 
                            ? 'bg-black text-white dark:bg-white dark:text-black font-medium rounded-tr-none shadow-sm' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-none border border-zinc-200 dark:border-zinc-700'
                        }`}>
                          {m.content && <p className="leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>}

                          {m.attachmentUrl && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                              <img src={m.attachmentUrl} alt="Attachment" className="max-h-48 object-cover rounded-lg" />
                            </div>
                          )}
                        </div>

                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                          {(() => {
                            const val = m.createdAt || (m as any).timestamp;
                            const d = val ? new Date(val) : new Date();
                            const valid = isNaN(d.getTime()) ? new Date() : d;
                            return format(valid, 'h:mm a');
                          })()}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing Indicator */}
              {isRecipientTyping && (
                <div className="px-4 py-1 text-[10px] text-zinc-500 italic">
                  {selectedUser.name} is typing...
                </div>
              )}

              {/* Attachment Preview */}
              {attachment && (
                <div className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 text-xs flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                  <span className="truncate">{attachment.filename}</span>
                  <button onClick={() => setAttachment(null)} className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white">×</button>
                </div>
              )}

              {/* Input Form */}
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center space-x-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${selectedUser.name}...`}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() && !attachment}
                  className="p-2 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold shadow-sm transition disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
              Select a member to start chatting
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
