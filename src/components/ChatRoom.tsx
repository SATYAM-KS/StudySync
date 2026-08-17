import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { MediaViewerModal } from './MediaViewerModal.tsx';
import { Send, Paperclip, Hash, X, Trash2, Download, Search, File, FileText, FileImage, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

interface ChatRoomProps {
  campaign: Campaign;
}

function safeDate(val: any): Date {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Groups consecutive messages from the same sender within 5 minutes
function groupMessages(messages: Message[]) {
  const groups: { messages: Message[]; key: string }[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const sameAuthor = lastMsg?.senderId === msg.senderId;
    const msgDate = safeDate(msg.createdAt || (msg as any).timestamp);
    const lastDate = lastMsg ? safeDate(lastMsg.createdAt || (lastMsg as any).timestamp) : msgDate;
    const withinWindow =
      lastMsg &&
      msgDate.getTime() - lastDate.getTime() < 5 * 60 * 1000;
    if (last && sameAuthor && withinWindow) {
      last.messages.push(msg);
    } else {
      groups.push({ messages: [msg], key: msg.id });
    }
  }
  return groups;
}

function DateSeparator({ date }: { date: Date }) {
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  const label = isToday(validDate)
    ? 'Today'
    : isYesterday(validDate)
    ? 'Yesterday'
    : format(validDate, 'MMMM d, yyyy');
  return (
    <div className="flex items-center gap-3 my-4 select-none">
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {label}
      </span>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-[3px] h-4 ml-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </span>
  );
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ campaign }) => {
  const { user, token } = useAuth();
  const { socket, isConnected, sendMessage, startTyping, stopTyping } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachment, setAttachment] = useState<{
    url: string;
    type: 'image' | 'file';
    filename: string;
  } | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [chatView, setChatView] = useState<'chat' | 'media' | 'docs'>('chat');
  const [activeMediaViewer, setActiveMediaViewer] = useState<{
    url: string;
    name?: string | null;
    senderName?: string | null;
    timestamp?: string | null;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

  // ── Delete message permission helper ────────────────────────────────
  const canDeleteMessage = (msg: Message) => {
    if (!user) return false;
    // 1. Author can always delete their own message
    if (msg.senderId === user.id) return true;
    // 2. Cohort Admin / Co-Admin can delete anyone's message
    if (campaign.adminId === user.id || campaign.userRole === 'admin' || campaign.userRole === 'co-admin') return true;
    return false;
  };

  // ── Delete message handler ─────────────────────────────────────────
  const handleDeleteMessage = async (messageId: string) => {
    // 0ms instant optimistic removal
    setMessages(prev => prev.filter(m => m.id !== messageId));

    if (socket) {
      socket.emit('message:delete', { messageId, campaignId: campaign.id });
    }

    if (token) {
      try {
        await fetch(`/api/messages/${messageId}?campaignId=${campaign.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    }
  };

  // ── Fetch history & Polling Fallback ──────────────────────────────
  useEffect(() => {
    if (!token) return;

    const fetchMsgs = () => {
      fetch(`/api/messages/campaign/${campaign.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then((data: Message[]) => {
          if (Array.isArray(data)) {
            setMessages(prev => {
              if (data.length === 0 && prev.length > 0) return prev;
              const map = new Map<string, Message>();
              for (const m of prev) map.set(m.id, m);
              for (const m of data) map.set(m.id, m);
              return Array.from(map.values()).sort((a, b) => {
                const ta = new Date(a.createdAt || a.timestamp || 0).getTime();
                const tb = new Date(b.createdAt || b.timestamp || 0).getTime();
                return ta - tb;
              });
            });
          }
        })
        .catch(() => {});
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, isConnected ? 45000 : 15000);
    return () => clearInterval(interval);
  }, [campaign.id, token, isConnected]);

  // Reset view when campaign changes
  useEffect(() => {
    setChatView('chat');
    setSearchQuery('');
    setIsSearchOpen(false);
  }, [campaign.id]);

  // ── Socket listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onNew = (msg: Message) => {
      if (msg.campaignId !== campaign.id) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    };

    const onUpdated = (msg: Message) => {
      if (msg.campaignId !== campaign.id) return;
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    };

    const onDeleted = (data: { id?: string; messageId?: string }) => {
      const delId = data.id || data.messageId;
      if (!delId) return;
      setMessages(prev => prev.filter(m => m.id !== delId));
    };

    const onTyping = (data: { campaignId?: string; userName: string; isTyping: boolean }) => {
      if (data.campaignId !== campaign.id) return;
      setTypingUsers(prev =>
        data.isTyping
          ? prev.includes(data.userName) ? prev : [...prev, data.userName]
          : prev.filter(n => n !== data.userName)
      );
    };

    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('typing:status', onTyping);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('typing:status', onTyping);
    };
  }, [socket, campaign.id]);

  // ── Scroll helpers ─────────────────────────────────────────────────
  const hasInitiallyScrolledRef = useRef(false);

  const scrollToBottom = useCallback((force = false) => {
    const doScroll = () => {
      const el = messagesContainerRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    };
    if (force) {
      isAtBottomRef.current = true;
    }
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 20);
    setTimeout(doScroll, 80);
    setTimeout(doScroll, 200);
  }, []);

  // Track whether user is near bottom
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    hasInitiallyScrolledRef.current = false;
    scrollToBottom(true);
  }, [campaign.id, scrollToBottom]);

  // When switching between chatView ('chat', 'media', 'docs'), ensure we land on the latest chat
  useEffect(() => {
    if (chatView === 'chat') {
      scrollToBottom(true);
    }
  }, [chatView, scrollToBottom]);

  // Listen for tab switch events from parent (e.g. CampaignDetail switching to chat)
  useEffect(() => {
    const onScrollToBottomEvent = () => {
      if (chatView === 'chat') {
        scrollToBottom(true);
      }
    };
    window.addEventListener('chat:scroll_to_bottom', onScrollToBottomEvent);
    return () => window.removeEventListener('chat:scroll_to_bottom', onScrollToBottomEvent);
  }, [chatView, scrollToBottom]);

  // Auto-scroll on initial load and when new messages arrive if user was at bottom
  useEffect(() => {
    if (messages.length > 0) {
      if (!hasInitiallyScrolledRef.current) {
        hasInitiallyScrolledRef.current = true;
        scrollToBottom(true);
      } else if (isAtBottomRef.current) {
        scrollToBottom();
      }
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [typingUsers.length, scrollToBottom]);

  // ── Auto-resize textarea ───────────────────────────────────────────
  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  // ── Input handlers ─────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    resizeTextarea();
    startTyping({ campaignId: campaign.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping({ campaignId: campaign.id }), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSend();
    }
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content && !attachment) return;

    const currentAttachment = attachment;
    setInputText('');
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
    stopTyping({ campaignId: campaign.id });

    // Immediate optimistic message display
    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user?.id || 'me',
      senderName: user?.name || 'You',
      senderAvatarUrl: user?.avatarUrl || '',
      campaignId: campaign.id,
      content,
      attachmentUrl: currentAttachment?.url ?? null,
      attachmentName: currentAttachment?.filename ?? null,
      attachmentType: currentAttachment?.type ?? null,
      createdAt: nowIso,
      timestamp: nowIso,
      reactions: []
    };

    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      const res = await sendMessage({
        id: tempId,
        campaignId: campaign.id,
        content,
        attachmentUrl: currentAttachment?.url ?? null,
        attachmentName: currentAttachment?.filename ?? null,
        attachmentType: currentAttachment?.type ?? null,
      });
      if (res?.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? res.message! : m));
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  // Helper to reliably test if an attachment is an image
  const isImageAttachment = (url?: string | null, type?: string | null, name?: string | null): boolean => {
    if (!url) return false;
    if (type === 'image') return true;
    if (url.startsWith('data:image/')) return true;
    if (url.match(/\.(jpeg|jpg|gif|png|webp|svg|avif|bmp)/i)) return true;
    if (name && name.match(/\.(jpeg|jpg|gif|png|webp|svg|avif|bmp)/i)) return true;
    return false;
  };

  // ── File upload ────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const originalFileName = file.name;
    const isImg = file.type.startsWith('image/') || file.name.match(/\.(jpeg|jpg|gif|png|webp|svg|avif|bmp)/i);
    setIsUploading(true);

    // Read immediately for instant optimistic data URL
    if (isImg) {
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        const localDataUrl = uploadEvt.target?.result as string;
        if (localDataUrl) {
          setAttachment({
            url: localDataUrl,
            type: 'image',
            filename: originalFileName
          });
        }
      };
      reader.readAsDataURL(file);
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const realFileName = data.originalName || data.filename || data.name || originalFileName;
        setAttachment({ url: data.url, type: data.type || (isImg ? 'image' : 'file'), filename: realFileName });
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  // Filter messages by search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.attachmentName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;
  const grouped = groupMessages(filteredMessages);

  // File icon helper
  const getFileIcon = (url: string, name?: string | null) => {
    const ext = (name || url).split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <FileImage className="w-4 h-4 shrink-0 text-blue-500" />;
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return <FileText className="w-4 h-4 shrink-0 text-orange-500" />;
    return <File className="w-4 h-4 shrink-0 text-zinc-500" />;
  };

  const toggleSearch = () => {
    setIsSearchOpen(v => {
      if (!v) setTimeout(() => searchInputRef.current?.focus(), 50);
      else setSearchQuery('');
      return !v;
    });
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      onClick={() => reactionPickerMsgId && setReactionPickerMsgId(null)}
    >
      {/* ── Channel Header ── */}
      <div className="flex flex-col border-b border-zinc-200/60 dark:border-white/[0.08] glass-nav shrink-0">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xs shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-zinc-950 dark:text-white tracking-tight leading-none truncate">
                Cohort Lounge
              </h3>
              <p className="text-xs text-zinc-400 mt-1 truncate leading-none">
                {searchQuery ? `Showing results for "${searchQuery}"` : 'Live discussion'}
              </p>
            </div>
          </div>

          {/* Right: Search toggle + View Tabs (Chat / Media / Docs) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search toggle */}
            <button
              type="button"
              onClick={toggleSearch}
              className={`h-9 w-9 flex items-center justify-center rounded-xl transition cursor-pointer active:scale-95 ${
                isSearchOpen
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs'
                  : 'glass-pill text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Search messages"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* View Tabs (Chat / Media / Docs) */}
            <div className="h-9 flex items-center gap-1 glass-pill p-1 rounded-xl">
              {(['chat', 'media', 'docs'] as const).map(view => {
                const labels: Record<typeof view, { label: string; icon: React.ReactNode }> = {
                  chat: { label: 'Chat', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                  media: { label: 'Media', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                  docs: { label: 'Documents', icon: <FileText className="w-3.5 h-3.5" /> }
                };
                const active = chatView === view;
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setChatView(view)}
                    className={`h-7 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                      active
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {labels[view].icon}
                    <span className="hidden sm:inline">{labels[view].label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search bar — slides in */}
        {isSearchOpen && (
          <div className="px-5 pb-3 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 glass-card rounded-xl px-3 py-2 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-colors">
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages…"
                className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 font-medium">
                {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Media Grid ── */}
      {chatView === 'media' && (() => {
        const mediaMessages = messages.filter(m => m.attachmentUrl && isImageAttachment(m.attachmentUrl, m.attachmentType, m.attachmentName));
        return (
          <div className="flex-1 overflow-y-auto p-4">
            {mediaMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-1">
                  <ImageIcon className="w-6 h-6 text-zinc-400" />
                </div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No media shared yet</p>
                <p className="text-xs text-zinc-500 max-w-xs">Images shared in the chat will appear here.</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3">{mediaMessages.length} image{mediaMessages.length !== 1 ? 's' : ''}</p>
                <div className="grid grid-cols-3 gap-2">
                  {mediaMessages.map(m => (
                    <div
                      key={m.id}
                      className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer group"
                      onClick={() => setActiveMediaViewer({
                        url: m.attachmentUrl!,
                        name: m.attachmentName,
                        senderName: m.senderName,
                        timestamp: format(safeDate(m.createdAt), 'h:mm a')
                      })}
                    >
                      <img src={m.attachmentUrl!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-1.5">
                        <span className="text-[10px] text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity truncate">{m.senderName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Documents List ── */}
      {chatView === 'docs' && (() => {
        const docMessages = messages.filter(m => m.attachmentUrl && !isImageAttachment(m.attachmentUrl, m.attachmentType, m.attachmentName));
        return (
          <div className="flex-1 overflow-y-auto p-4">
            {docMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-1">
                  <FileText className="w-6 h-6 text-zinc-400" />
                </div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No documents shared yet</p>
                <p className="text-xs text-zinc-500 max-w-xs">Files shared in the chat will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3">{docMessages.length} document{docMessages.length !== 1 ? 's' : ''}</p>
                {docMessages.map(m => {
                  const ext = (m.attachmentName || m.attachmentUrl || '').split('.').pop()?.toLowerCase();
                  const icon = ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')
                    ? <FileText className="w-5 h-5 shrink-0 text-orange-500" />
                    : <File className="w-5 h-5 shrink-0 text-zinc-500" />;
                  return (
                    <div 
                      key={m.id} 
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer group"
                      onClick={() => {
                        setActiveMediaViewer({
                          url: m.attachmentUrl!,
                          name: m.attachmentName,
                          senderName: m.senderName,
                          timestamp: format(safeDate(m.createdAt), 'MMM d, h:mm a')
                        });
                      }}
                    >
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                          {m.attachmentName || m.attachmentUrl!.split('/').pop() || 'File'}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {m.senderName} · {format(safeDate(m.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-500 transition cursor-pointer shrink-0 active:scale-95"
                        title="Download file"
                        onClick={e => {
                          e.stopPropagation();
                          const link = document.createElement('a');
                          link.href = m.attachmentUrl!;
                          link.download = m.attachmentName || 'document';
                          link.target = '_blank';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Messages Area (chat view only) ── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2"
        style={{
          overscrollBehavior: 'contain',
          display: chatView === 'chat' ? 'block' : 'none'
        }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-1">
              <Hash className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Welcome to #{campaign.name}!
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 max-w-xs">
              This is the start of your study lounge. Say hello, ask questions, or share what you're working on.
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-0.5">
            {grouped.map((group, groupIdx) => {
              const first = group.messages[0];
              const prev = grouped[groupIdx - 1]?.messages[0];
              const showDateSep =
                !prev || !isSameDay(new Date(first.createdAt), new Date(prev.createdAt));
              const isMe = first.senderId === user?.id;

              return (
                <React.Fragment key={group.key}>
                  {showDateSep && <DateSeparator date={new Date(first.createdAt)} />}

                  {/* Message Group */}
                  <div className="group/group">
                    {/* Author row (only once per group) */}
                    <div className="flex items-center gap-3 px-3 pt-3 pb-1">
                      <UserAvatar
                        name={first.senderName}
                        avatarUrl={first.senderAvatarUrl}
                        size="md"
                        rounded="xl"
                        className="shrink-0"
                      />
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={`text-sm font-bold leading-normal truncate pb-0.5 ${isMe ? 'text-zinc-950 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}>
                          {first.senderName}
                          {isMe && <span className="ml-1.5 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">You</span>}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                          {format(safeDate(first.createdAt || (first as any).timestamp), 'h:mm a')}
                        </span>
                      </div>
                    </div>

                    {/* Messages in group */}
                    {group.messages.map((msg, msgIdx) => (
                      <div
                        key={msg.id}
                        className="relative flex items-start gap-3 px-3 py-[2px] rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-100"
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        {/* Avatar spacer for follow-up messages */}
                        <div className="w-9 shrink-0 flex justify-center">
                          {msgIdx === 0 ? null : (
                            <span className="text-[9px] text-zinc-300 dark:text-zinc-700 mt-1.5 leading-none select-none opacity-0 group-hover/group:opacity-100 transition-opacity">
                              {format(safeDate(msg.createdAt || (msg as any).timestamp), 'h:mm')}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Text */}
                          {msg.content && (
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}

                          {/* Image attachment */}
                          {msg.attachmentUrl && isImageAttachment(msg.attachmentUrl, msg.attachmentType, msg.attachmentName) && (
                            <div className="mt-1.5 max-w-xs rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer group/img relative bg-zinc-100 dark:bg-zinc-800"
                              onClick={() => setActiveMediaViewer({
                                url: msg.attachmentUrl!,
                                name: msg.attachmentName,
                                senderName: msg.senderName,
                                timestamp: format(safeDate(msg.createdAt), 'h:mm a')
                              })}>
                              <img
                                src={msg.attachmentUrl}
                                alt={msg.attachmentName || "image"}
                                className="w-full max-h-60 object-cover group-hover/img:brightness-90 transition block"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div style={{ display: 'none' }} className="p-3.5 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                                <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="truncate flex-1 font-semibold">{msg.attachmentName || 'Image Attachment'}</span>
                                <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              </div>
                              {msg.attachmentName && (
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs text-[10px] text-white px-2.5 py-1 truncate opacity-0 group-hover/img:opacity-100 transition-opacity">
                                  {msg.attachmentName}
                                </div>
                              )}
                            </div>
                          )}

                          {/* File attachment — shows name + download & opens in-app viewer */}
                          {msg.attachmentUrl && !isImageAttachment(msg.attachmentUrl, msg.attachmentType, msg.attachmentName) && (
                            <div 
                              className="mt-1.5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 max-w-xs shadow-xs cursor-pointer group/doc transition"
                              onClick={() => {
                                setActiveMediaViewer({
                                  url: msg.attachmentUrl!,
                                  name: msg.attachmentName,
                                  senderName: msg.senderName,
                                  timestamp: format(safeDate(msg.createdAt), 'h:mm a')
                                });
                              }}
                            >
                              {getFileIcon(msg.attachmentUrl, msg.attachmentName)}
                              <span className="flex-1 text-xs text-zinc-800 dark:text-zinc-100 font-semibold truncate min-w-0 group-hover/doc:underline" title={msg.attachmentName || undefined}>
                                {msg.attachmentName || msg.attachmentUrl.split('/').pop() || 'File'}
                              </span>
                              <button
                                type="button"
                                className="ml-1 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-500 transition cursor-pointer shrink-0 active:scale-95"
                                title="Download file"
                                onClick={e => {
                                  e.stopPropagation();
                                  const link = document.createElement('a');
                                  link.href = msg.attachmentUrl!;
                                  link.download = msg.attachmentName || 'document';
                                  link.target = '_blank';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                        </div>

                        {/* Hover action bar: Delete Message */}
                        {hoveredMsgId === msg.id && canDeleteMessage(msg) && (
                          <div
                            className="absolute right-3 -top-3 z-10 flex items-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-md px-1 py-0.5 animate-in fade-in zoom-in-95 duration-100"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded hover:bg-rose-500/15 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                              title={msg.senderId === user?.id ? "Delete message" : "Delete message (Admin)"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-5 pb-3 text-xs text-zinc-500 dark:text-zinc-400 italic">
            <TypingDots />
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing`
                : `${typingUsers.join(', ')} are typing`}
            </span>
          </div>
        )}
      </div>

      {/* ── Attachment preview + Input Bar (chat view only) ── */}
      <div className={chatView === 'chat' ? 'block' : 'hidden'}>
        {attachment && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-700 dark:text-zinc-300">
          <Paperclip className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
          <span className="truncate flex-1">{attachment.filename}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="px-4 pb-4 shrink-0">
        <div className="flex items-center gap-2 bg-zinc-100/90 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] px-3 py-2 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-colors shadow-xs">
          {/* Attach file button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition shrink-0 cursor-pointer flex items-center justify-center active:scale-95"
            title="Attach file"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          {/* Textarea — borderless, centered, seamless */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${campaign.name}…`}
            rows={1}
            className="flex-1 bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-none shadow-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none leading-5 max-h-[120px] overflow-y-auto py-1 px-1 m-0"
            style={{ overscrollBehavior: 'contain', border: 'none', outline: 'none', boxShadow: 'none' }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() && !attachment}
            className="p-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-xs active:scale-95"
            title="Send message (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 px-1 font-mono">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
      </div>

      {/* ── Custom Media Viewer Modal ── */}
      {activeMediaViewer && (
        <MediaViewerModal
          isOpen={Boolean(activeMediaViewer)}
          onClose={() => setActiveMediaViewer(null)}
          mediaUrl={activeMediaViewer.url}
          mediaName={activeMediaViewer.name}
          senderName={activeMediaViewer.senderName}
          timestamp={activeMediaViewer.timestamp}
        />
      )}
    </div>
  );
};
