import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { Send, Paperclip, Hash, X, Smile, Download } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

interface ChatRoomProps {
  campaign: Campaign;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '💪', '🎯', '😂', '🙌'];

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
  const { socket, isConnected, sendMessage, reactToMessage, startTyping, stopTyping } = useSocket();

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
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

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
    const interval = setInterval(fetchMsgs, isConnected ? 10000 : 3000);
    return () => clearInterval(interval);
  }, [campaign.id, token, isConnected]);

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
    socket.on('typing:status', onTyping);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('typing:status', onTyping);
    };
  }, [socket, campaign.id]);

  // ── Scroll helpers ─────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Track whether user is near bottom
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => { scrollToBottom(); }, [campaign.id]);

  // Only auto-scroll on new messages if user was already at bottom
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [typingUsers.length]);

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
        attachmentType: currentAttachment?.type ?? null,
      });
      if (res?.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? res.message! : m));
      }
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  // ── File upload ────────────────────────────────────────────────────
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
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAttachment({ url: data.url, type: data.type, filename: data.filename });
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  const grouped = groupMessages(messages);

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
      onClick={() => reactionPickerMsgId && setReactionPickerMsgId(null)}
    >
      {/* ── Channel Header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur shrink-0">
        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Hash className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-none">
            {campaign.name}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-none">
            Study lounge · ask questions, share notes, celebrate wins
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* ── Messages Area ── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2"
        style={{ overscrollBehavior: 'contain' }}
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
                    <div className="flex items-start gap-3 px-3 pt-3 pb-0.5">
                      <UserAvatar
                        name={first.senderName}
                        avatarUrl={first.senderAvatarUrl}
                        size="md"
                        rounded="xl"
                        className="mt-0.5"
                      />
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className={`text-sm font-bold leading-none truncate ${isMe ? 'text-zinc-950 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}>
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
                          {msg.attachmentUrl && (msg.attachmentType === 'image' || msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i)) && (
                            <div className="mt-1.5 max-w-xs rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-pointer group/img"
                              onClick={() => window.open(msg.attachmentUrl!, '_blank')}>
                              <img
                                src={msg.attachmentUrl}
                                alt="attachment"
                                className="w-full max-h-60 object-cover group-hover/img:brightness-90 transition"
                              />
                            </div>
                          )}

                          {/* File attachment */}
                          {msg.attachmentUrl && !(msg.attachmentType === 'image' || msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i)) && (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[180px]">Download file</span>
                            </a>
                          )}

                          {/* Reactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {msg.reactions.map(r => {
                                const mine = user && r.userIds.includes(user.id);
                                return (
                                  <button
                                    key={r.emoji}
                                    type="button"
                                    onClick={e => { e.stopPropagation(); reactToMessage(msg.id, r.emoji, campaign.id); }}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition cursor-pointer select-none ${
                                      mine
                                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white font-bold'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                                  >
                                    <span>{r.emoji}</span>
                                    <span className="font-semibold">{r.userIds.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Hover action bar */}
                        {hoveredMsgId === msg.id && (
                          <div
                            className="absolute right-3 -top-3 z-10 flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-md px-1 py-0.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                              title="Add reaction"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Reaction picker popover */}
                        {reactionPickerMsgId === msg.id && (
                          <div
                            className="absolute right-3 -top-10 z-20 flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl px-2 py-1.5"
                            onClick={e => e.stopPropagation()}
                          >
                            {QUICK_REACTIONS.map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => { reactToMessage(msg.id, emoji, campaign.id); setReactionPickerMsgId(null); }}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-base cursor-pointer select-none hover:scale-125 active:scale-100 duration-100"
                              >
                                {emoji}
                              </button>
                            ))}
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

      {/* ── Attachment preview strip ── */}
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
        <div className="flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-colors">
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
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition shrink-0 cursor-pointer mb-0.5"
            title="Attach file"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          {/* Textarea — grows with content, Enter sends, Shift+Enter newline */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${campaign.name}…`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none leading-5 max-h-[120px] overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() && !attachment}
            className="p-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition shrink-0 mb-0.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send message (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1.5 px-1">
          <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
};
