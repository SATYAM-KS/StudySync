import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from './AuthContext.tsx';
import { useSocket } from './SocketContext.tsx';
import { StudyBlock } from '../types/index.ts';
import { playCheckInChime, playSuccessChime } from '../utils/sound.ts';
import { formatTimeTo12h } from '../utils/schedule.ts';

export interface VerifiedSnapshot {
  id: string;
  timestamp: string;
  imageUrl: string;
  blockNumber: number;
  isProductive: boolean;
  activitySummary: string;
  reason: string;
  confidence: number;
}

export interface LastAIAnalysis {
  status: 'verified' | 'off_task' | 'analyzing' | null;
  summary: string;
  reason: string;
  timestamp: string;
}

interface StudyStats {
  todayMinutes: number;
  todayHours: number;
  thisWeekMinutes: number;
  thisWeekHours: number;
  totalMinutes: number;
  totalHours: number;
  recentDays: Array<{ date: string; dayName: string; minutes: number; hours: number }>;
  totalBlocksCount: number;
  activeBlocksCount: number;
}

interface StudyContextType {
  isStudying: boolean;
  activeCampaignId: string | null;
  activeCampaignName: string;
  subjectNote: string;
  sessionElapsedSeconds: number;
  blockRemainingSeconds: number;
  isTabHidden: boolean;
  hiddenWarning: boolean;
  screenStream: MediaStream | null;
  isScreenSharingEnabled: boolean;
  latestSnapshotUrl: string | null;
  verifiedSnapshots: VerifiedSnapshot[];
  isAnalyzing: boolean;
  lastAIAnalysis: LastAIAnalysis | null;
  screenShareError: string | null;
  stats: StudyStats | null;
  startStudying: (campaignId: string, campaignName: string, subjectNote?: string) => Promise<boolean>;
  stopStudying: () => void;
  reattachScreenShare: () => Promise<boolean>;
  triggerAIAnalysisNow: (videoElement?: HTMLVideoElement | null) => Promise<void>;
  refreshStats: () => Promise<void>;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

const BLOCK_DURATION_SECONDS = 300; // 5 minutes standard block
const PERSISTED_SESSION_KEY = 'study_active_session_state';

interface PersistedSessionState {
  campaignId: string;
  campaignName: string;
  subjectNote: string;
  sessionStartedAt: number;
}

function getInitialPersistedState(): PersistedSessionState | null {
  try {
    const raw = localStorage.getItem(PERSISTED_SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PersistedSessionState;
    const now = Date.now();
    if (saved.sessionStartedAt && now - saved.sessionStartedAt < 16 * 3600 * 1000) {
      return saved;
    }
    localStorage.removeItem(PERSISTED_SESSION_KEY);
    return null;
  } catch (e) {
    return null;
  }
}

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { socket, syncPresenceNow, updateLocalActiveStudySessions } = useSocket();

  const initialSession = getInitialPersistedState();
  const initialElapsed = initialSession ? Math.max(0, Math.floor((Date.now() - initialSession.sessionStartedAt) / 1000)) : 0;
  const initialBlockElapsed = initialSession ? (initialElapsed % BLOCK_DURATION_SECONDS) : 0;

  const [isStudying, setIsStudying] = useState<boolean>(() => Boolean(initialSession));
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(() => initialSession ? initialSession.campaignId : null);
  const [activeCampaignName, setActiveCampaignName] = useState<string>(() => initialSession ? initialSession.campaignName : '');
  const [subjectNote, setSubjectNote] = useState<string>(() => initialSession ? initialSession.subjectNote : 'Focused Study');

  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState<number>(() => initialElapsed);
  const [blockElapsedSeconds, setBlockElapsedSeconds] = useState<number>(() => initialBlockElapsed);

  // Tab visibility state
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [hiddenWarning, setHiddenWarning] = useState(false);
  const hiddenTimeRef = useRef<number | null>(null);

  // Screen Share & AI State
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharingEnabled, setIsScreenSharingEnabled] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [latestSnapshotUrl, setLatestSnapshotUrl] = useState<string | null>(null);
  const [verifiedSnapshots, setVerifiedSnapshots] = useState<VerifiedSnapshot[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAIAnalysis, setLastAIAnalysis] = useState<LastAIAnalysis | null>(null);

  // Aggregated stats
  const [stats, setStats] = useState<StudyStats | null>(null);

  // Keep refs for asynchronous interval callbacks
  const activeCampaignIdRef = useRef<string | null>(activeCampaignId);
  activeCampaignIdRef.current = activeCampaignId;
  const subjectNoteRef = useRef<string>(subjectNote);
  subjectNoteRef.current = subjectNote;
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;
  const screenStreamRef = useRef<MediaStream | null>(screenStream);
  screenStreamRef.current = screenStream;
  const lastAnalyzedMilestoneRef = useRef<number>(Math.floor(initialElapsed / BLOCK_DURATION_SECONDS));

  // Page Visibility API detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabHidden(true);
        hiddenTimeRef.current = Date.now();
        if (isStudying) {
          setHiddenWarning(true);
        }
      } else {
        setIsTabHidden(false);
        if (hiddenTimeRef.current && Date.now() - hiddenTimeRef.current > 60000) {
          setHiddenWarning(true);
        }
        hiddenTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStudying]);

  // Load user stats
  const refreshStats = async () => {
    const currentToken = tokenRef.current || token || localStorage.getItem('study_token');
    if (!currentToken) return;
    try {
      const res = await fetch('/api/study/stats', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load study stats:', e);
    }
  };

  useEffect(() => {
    if (user && token) {
      refreshStats();
    }
  }, [user?.id, token]);

  // Helper to capture a frame from the live screen stream or video element
  const captureScreenSnapshot = async (preferredVideoElement?: HTMLVideoElement | null): Promise<string | null> => {
    // 1. Direct capture from preferred or DOM video element (instant 0ms)
    if (preferredVideoElement && preferredVideoElement.videoWidth > 0) {
      try {
        const vw = preferredVideoElement.videoWidth;
        const vh = preferredVideoElement.videoHeight;
        const targetW = Math.min(vw, 1280);
        const targetH = Math.round(targetW * (vh / vw)) || 720;
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(preferredVideoElement, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          if (dataUrl && dataUrl.length > 500) {
            return dataUrl;
          }
        }
      } catch (e) {}
    }

    const stream = screenStreamRef.current || screenStream;
    if (!stream) {
      console.warn('captureScreenSnapshot: No active stream');
      return null;
    }

    try {
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') {
        console.warn('captureScreenSnapshot: Track not live');
        return null;
      }

      // Method 2: Query playing video in DOM
      const domVideos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      const activeVideo = domVideos.find(v => v.srcObject === stream && v.videoWidth > 0) || domVideos.find(v => v.videoWidth > 0);
      if (activeVideo && activeVideo.videoWidth > 0) {
        const vw = activeVideo.videoWidth;
        const vh = activeVideo.videoHeight;
        const targetW = Math.min(vw, 1280);
        const targetH = Math.round(targetW * (vh / vw)) || 720;
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          if (dataUrl && dataUrl.length > 500) {
            return dataUrl;
          }
        }
      }

      // Method 3: ImageCapture API
      if (typeof (window as any).ImageCapture === 'function') {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          const targetW = Math.min(bitmap.width || 1280, 1280);
          const targetH = Math.round(targetW * ((bitmap.height || 720) / (bitmap.width || 1280))) || 720;
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
            return dataUrl;
          }
        } catch (icErr) {}
      }

      // Method 4: Attached hidden video fallback
      const video = document.createElement('video');
      video.style.position = 'fixed';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-999';
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      document.body.appendChild(video);

      await new Promise<void>((resolve) => {
        let isDone = false;
        const done = () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        };
        video.onloadedmetadata = () => {
          video.play().then(done).catch(done);
        };
        setTimeout(done, 150);
      });

      const vw = video.videoWidth > 0 ? video.videoWidth : 1280;
      const vh = video.videoHeight > 0 ? video.videoHeight : 720;
      const targetW = Math.min(vw, 1280);
      const targetH = Math.round(targetW * (vh / vw)) || 720;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      let dataUrl: string | null = null;
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.80);
      }
      document.body.removeChild(video);
      return dataUrl;
    } catch (err) {
      console.warn('Screenshot capture error:', err);
      return null;
    }
  };

  // Perform AI Screenshot Verification
  const performAIAnalysis = async (videoElement?: HTMLVideoElement | null) => {
    const stream = screenStreamRef.current || screenStream;
    const cid = activeCampaignIdRef.current;
    const cToken = tokenRef.current || token || localStorage.getItem('study_token');
    const sNote = subjectNoteRef.current;

    console.log('[performAIAnalysis] Running check:', { cid, hasToken: Boolean(cToken), hasStream: Boolean(stream) });

    if (!cid || !cToken) {
      console.warn('[performAIAnalysis] Missing campaignId or token');
      return;
    }

    setIsAnalyzing(true);
    setLastAIAnalysis({
      status: 'analyzing',
      summary: 'AI analyzing screen activity...',
      reason: 'Evaluating active window for study content.',
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const snapUrl = await captureScreenSnapshot(videoElement);
      if (!snapUrl) {
        setIsAnalyzing(false);
        clearTimeout(timeoutId);
        setLastAIAnalysis({
          status: 'off_task',
          summary: 'Screen Stream Inactive',
          reason: 'Please ensure your entire screen is actively shared for focus verification.',
          timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
        });
        playCheckInChime();
        return;
      }

      setLatestSnapshotUrl(snapUrl);

      const res = await fetch('/api/study/verify-screen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cToken}`
        },
        body: JSON.stringify({
          campaignId: cid,
          subjectNote: sNote,
          snapshotUrl: snapUrl
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const analysis = data.analysis || {};
        const isProductive = Boolean(data.registered && analysis.isProductiveWork);
        const timeStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

        const snapshotRecord: VerifiedSnapshot = {
          id: `snap_${Date.now()}`,
          timestamp: timeStr,
          imageUrl: snapUrl,
          blockNumber: (verifiedSnapshots.length || 0) + 1,
          isProductive,
          activitySummary: analysis.activitySummary || (isProductive ? 'Technical Study Verified' : 'Non-Study Content Detected'),
          reason: analysis.reason || '',
          confidence: analysis.confidence || 85
        };

        setVerifiedSnapshots(prev => [snapshotRecord, ...prev]);

        setLastAIAnalysis({
          status: isProductive ? 'verified' : 'off_task',
          summary: snapshotRecord.activitySummary,
          reason: snapshotRecord.reason,
          timestamp: timeStr
        });

        if (isProductive) {
          playSuccessChime();
          confetti({
            particleCount: 40,
            spread: 55,
            origin: { y: 0.85 }
          });
          await refreshStats();
        } else {
          playCheckInChime();
        }
      } else {
        setLastAIAnalysis({
          status: 'off_task',
          summary: 'Verification Server Error',
          reason: 'Could not verify screen content against technical study standards.',
          timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
        });
        playCheckInChime();
      }
    } catch (e: any) {
      console.error('AI Analysis error:', e);
      setLastAIAnalysis({
        status: 'off_task',
        summary: 'Inspection Unverified',
        reason: 'Technical study content was not confirmed on screen.',
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      });
      playCheckInChime();
    } finally {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  // Study session REST heartbeat for multi-user live presence (1s interval)
  useEffect(() => {
    if (!isStudying || !activeCampaignId || !token) return;

    const sendStudyHeartbeat = async () => {
      try {
        await syncPresenceNow({
          isStudying: true,
          campaignId: activeCampaignId,
          campaignName: activeCampaignName,
          subjectNote
        });
      } catch {}
    };

    sendStudyHeartbeat();
    const interval = setInterval(sendStudyHeartbeat, 1000);
    return () => clearInterval(interval);
  }, [isStudying, activeCampaignId, activeCampaignName, subjectNote, token]);

  // Study timer loop - continues ticking seamlessly across refresh
  useEffect(() => {
    let interval: any = null;
    if (isStudying) {
      interval = setInterval(() => {
        setSessionElapsedSeconds(prev => prev + 1);
        setBlockElapsedSeconds(prev => {
          const next = prev + 1;
          if (next >= BLOCK_DURATION_SECONDS) {
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStudying]);

  // Trigger automated AI check exactly ONCE per 5-minute block milestone
  useEffect(() => {
    if (!isStudying || sessionElapsedSeconds <= 0) return;

    const currentMilestone = Math.floor(sessionElapsedSeconds / BLOCK_DURATION_SECONDS);
    if (sessionElapsedSeconds % BLOCK_DURATION_SECONDS === 0 && currentMilestone > 0 && lastAnalyzedMilestoneRef.current !== currentMilestone) {
      lastAnalyzedMilestoneRef.current = currentMilestone;
      console.log(`[StudyTimer] Automated 5-min milestone #${currentMilestone} reached at ${sessionElapsedSeconds}s - triggering check`);
      performAIAnalysis();
    }
  }, [sessionElapsedSeconds, isStudying]);

  const triggerAIAnalysisNow = async (videoElement?: HTMLVideoElement | null) => {
    if (isStudying) {
      await performAIAnalysis(videoElement);
    }
  };

  // Start Studying: Enforces screen share and persists session in localStorage
  const startStudying = async (campaignId: string, campaignName: string, subject: string = 'General Focus'): Promise<boolean> => {
    setScreenShareError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'never'
        } as any,
        audio: false
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        setScreenShareError('Screen capture is required to start a verified focus session.');
        return false;
      }

      track.onended = () => {
        setScreenStream(null);
        screenStreamRef.current = null;
        setIsScreenSharingEnabled(false);
      };

      setScreenStream(stream);
      screenStreamRef.current = stream;
      setIsScreenSharingEnabled(true);

      setIsStudying(true);
      setActiveCampaignId(campaignId);
      activeCampaignIdRef.current = campaignId;
      setActiveCampaignName(campaignName);
      setSubjectNote(subject);
      subjectNoteRef.current = subject;
      setSessionElapsedSeconds(0);
      setBlockElapsedSeconds(0);
      setHiddenWarning(false);
      setVerifiedSnapshots([]);
      setLastAIAnalysis(null);

      // Save to localStorage for refresh persistence
      localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify({
        campaignId,
        campaignName,
        subjectNote: subject,
        sessionStartedAt: Date.now()
      }));

      // Optimistic local update (0ms instant response)
      if (user) {
        updateLocalActiveStudySessions(prev => {
          const filtered = prev.filter(s => s.userId !== user.id);
          return [
            ...filtered,
            {
              userId: user.id,
              userName: user.name,
              userAvatarUrl: user.avatarUrl,
              campaignId,
              campaignName,
              subjectNote: subject,
              startedAt: new Date().toISOString(),
              activeMinutes: 0,
              isScreenSharedLocally: true
            }
          ];
        });
      }

      if (socket) {
        socket.emit('study:start_session', {
          campaignId,
          campaignName,
          subjectNote: subject
        });
      }

      // Instant pulse sync
      syncPresenceNow({
        isStudying: true,
        campaignId,
        campaignName,
        subjectNote: subject
      }).catch(() => {});

      playSuccessChime();
      return true;
    } catch (e: any) {
      console.warn('Screen share permission dismissed:', e);
      setScreenShareError('Entire screen sharing is required to start your focus session.');
      return false;
    }
  };

  // Re-attach screen share if lost after page refresh without losing session progress
  const reattachScreenShare = async (): Promise<boolean> => {
    setScreenShareError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'never'
        } as any,
        audio: false
      });

      const track = stream.getVideoTracks()[0];
      if (!track) return false;

      track.onended = () => {
        setScreenStream(null);
        screenStreamRef.current = null;
        setIsScreenSharingEnabled(false);
      };

      setScreenStream(stream);
      screenStreamRef.current = stream;
      setIsScreenSharingEnabled(true);
      playSuccessChime();
      return true;
    } catch (e: any) {
      console.warn('Re-attach screen share dismissed:', e);
      return false;
    }
  };

  const stopStudying = () => {
    setIsStudying(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setScreenStream(null);
    screenStreamRef.current = null;
    setIsScreenSharingEnabled(false);
    setIsAnalyzing(false);
    localStorage.removeItem(PERSISTED_SESSION_KEY);

    // Optimistic local removal (0ms instant response)
    if (user) {
      updateLocalActiveStudySessions(prev => prev.filter(s => s.userId !== user.id));
    }

    if (socket) {
      socket.emit('study:stop_session');
    }
    syncPresenceNow({ isStudying: false }).catch(() => {});
    if (token) {
      fetch('/api/study/session/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    refreshStats();
  };

  const blockRemainingSeconds = BLOCK_DURATION_SECONDS - blockElapsedSeconds;

  return (
    <StudyContext.Provider value={{
      isStudying,
      activeCampaignId,
      activeCampaignName,
      subjectNote,
      sessionElapsedSeconds,
      blockRemainingSeconds,
      isTabHidden,
      hiddenWarning,
      screenStream,
      isScreenSharingEnabled,
      latestSnapshotUrl,
      verifiedSnapshots,
      isAnalyzing,
      lastAIAnalysis,
      screenShareError,
      stats,
      startStudying,
      stopStudying,
      reattachScreenShare,
      triggerAIAnalysisNow,
      refreshStats
    }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) {
    throw new Error('useStudy must be used within a StudyProvider');
  }
  return context;
}
