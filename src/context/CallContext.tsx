import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext.tsx';
import { useSocket } from './SocketContext.tsx';
import { CallParticipant } from '../types/index.ts';

interface PeerConnectionData {
  peerConnection: RTCPeerConnection;
  stream: MediaStream;
  participant: CallParticipant;
}

interface CallContextType {
  isInCall: boolean;
  activeCampaignId: string | null;
  activeCampaignName: string;
  isMuted: boolean;
  isScreenSharing: boolean;
  localAudioStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteStreams: Array<{ socketId: string; participant: CallParticipant; stream: MediaStream }>;
  remoteScreenFrames: Record<string, string>; // socketId -> screen frame fallback
  speakingUsers: Set<string>; // set of socketIds speaking
  isLocalSpeaking: boolean;
  participants: CallParticipant[];
  joinCall: (campaignId: string, campaignName: string) => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
  // LiveKit sync — called by VoiceRoom to keep global state in sync
  setLiveKitConnected: (campaignId: string | null) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { socket, activeCallSession } = useSocket();

  const [isInCall, setIsInCall] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [activeCampaignName, setActiveCampaignName] = useState<string>('');

  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Array<{ socketId: string; participant: CallParticipant; stream: MediaStream }>>([]);
  const [remoteScreenFrames, setRemoteScreenFrames] = useState<Record<string, string>>({});
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);

  const peerConnectionsRef = useRef<{ [socketId: string]: PeerConnectionData }>({});
  const iceCandidateQueuesRef = useRef<{ [socketId: string]: RTCIceCandidateInit[] }>({});
  const localAudioRef = useRef<MediaStream | null>(null);
  const localScreenRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCheckIntervalRef = useRef<any>(null);

  const screenBroadcastIntervalRef = useRef<any>(null);
  const screenVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync participants from activeCallSession
  useEffect(() => {
    if (activeCallSession && activeCallSession.campaignId === activeCampaignId) {
      const newParticipants = activeCallSession.participants || [];

      // When a participant stops screen sharing, clear their stale frame data immediately
      setParticipants(prev => {
        prev.forEach(prevP => {
          const updated = newParticipants.find(np => np.socketId === prevP.socketId);
          if (prevP.isScreenSharing && updated && !updated.isScreenSharing) {
            // They just stopped sharing — clear their frames
            setRemoteScreenFrames(frames => {
              const next = { ...frames };
              delete next[prevP.socketId];
              return next;
            });
          }
        });
        return newParticipants;
      });
    }
  }, [activeCallSession, activeCampaignId]);

  // Unlock AudioContext
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Audio activity analyzer
  const startAudioAnalyzer = (stream: MediaStream) => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      audioCheckIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || isMuted) {
          if (wasSpeaking) {
            wasSpeaking = false;
            setIsLocalSpeaking(false);
            if (socket && activeCampaignId) {
              socket.emit('call:speaking', { campaignId: activeCampaignId, isSpeaking: false });
            }
          }
          return;
        }

        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const nowSpeaking = average > 10;

        if (nowSpeaking !== wasSpeaking) {
          wasSpeaking = nowSpeaking;
          setIsLocalSpeaking(nowSpeaking);
          if (socket && activeCampaignId) {
            socket.emit('call:speaking', { campaignId: activeCampaignId, isSpeaking: nowSpeaking });
          }
        }
      }, 100);
    } catch (e) {
      console.warn('Audio analyzer notice:', e);
    }
  };

  const stopAudioAnalyzer = () => {
    if (audioCheckIntervalRef.current) {
      clearInterval(audioCheckIntervalRef.current);
      audioCheckIntervalRef.current = null;
    }
    setIsLocalSpeaking(false);
  };

  // Screen broadcast fallback
  const startScreenBroadcast = (stream: MediaStream) => {
    stopScreenBroadcast();

    const video = document.createElement('video');
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1280px';
    video.style.height = '720px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    document.body.appendChild(video);
    screenVideoElementRef.current = video;
    video.play().catch(() => {});

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    screenCanvasRef.current = canvas;

    screenBroadcastIntervalRef.current = setInterval(() => {
      if (!socket || !activeCampaignId || !screenVideoElementRef.current || !screenCanvasRef.current) return;
      const v = screenVideoElementRef.current;
      if (v.readyState < 2) return;

      const c = screenCanvasRef.current;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const frameData = c.toDataURL('image/jpeg', 0.6);
        socket.emit('call:video_frame', {
          campaignId: activeCampaignId,
          frameData
        });
      }
    }, 120); // ~8 fps HD frame broadcast
  };

  const stopScreenBroadcast = () => {
    if (screenBroadcastIntervalRef.current) {
      clearInterval(screenBroadcastIntervalRef.current);
      screenBroadcastIntervalRef.current = null;
    }
    if (screenVideoElementRef.current) {
      try {
        screenVideoElementRef.current.srcObject = null;
        if (screenVideoElementRef.current.parentNode) {
          screenVideoElementRef.current.parentNode.removeChild(screenVideoElementRef.current);
        }
      } catch (e) {}
      screenVideoElementRef.current = null;
    }
    screenCanvasRef.current = null;
  };

  // Helper to create / get peer connection
  const getOrCreatePeerConnection = (socketId: string, participant: CallParticipant) => {
    if (peerConnectionsRef.current[socketId]) {
      const existingPc = peerConnectionsRef.current[socketId].peerConnection;
      
      // Ensure audio track is attached if missing
      if (localAudioRef.current) {
        localAudioRef.current.getAudioTracks().forEach(track => {
          const senders = existingPc.getSenders();
          if (!senders.some(s => s.track === track)) {
            existingPc.addTrack(track, localAudioRef.current!);
          }
        });
      }
      return peerConnectionsRef.current[socketId];
    }

    const pc = new RTCPeerConnection(rtcConfig);
    const remoteStream = new MediaStream();

    // Attach local audio track immediately
    if (localAudioRef.current) {
      localAudioRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localAudioRef.current!);
      });
    }

    // Attach local screen track if sharing
    if (localScreenRef.current) {
      localScreenRef.current.getVideoTracks().forEach(track => {
        pc.addTrack(track, localScreenRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:signal', {
          toSocketId: socketId,
          signal: event.candidate,
          type: 'ice-candidate'
        });
      }
    };

    pc.ontrack = (event) => {
      if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      // Clone stream reference so React components trigger re-render on new tracks
      const streamClone = new MediaStream(remoteStream.getTracks());
      setRemoteStreams(prev => {
        const filtered = prev.filter(p => p.socketId !== socketId);
        return [...filtered, { socketId, participant, stream: streamClone }];
      });
    };

    const pcData: PeerConnectionData = {
      peerConnection: pc,
      stream: remoteStream,
      participant
    };

    peerConnectionsRef.current[socketId] = pcData;

    setRemoteStreams(prev => {
      const filtered = prev.filter(p => p.socketId !== socketId);
      return [...filtered, { socketId, participant, stream: remoteStream }];
    });

    return pcData;
  };

  // Handle renegotiations
  const sendOfferToPeer = async (socketId: string) => {
    const pcData = peerConnectionsRef.current[socketId];
    if (!pcData) return;
    try {
      const offer = await pcData.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pcData.peerConnection.setLocalDescription(offer);
      if (socket) {
        socket.emit('call:signal', {
          toSocketId: socketId,
          signal: offer,
          type: 'offer'
        });
      }
    } catch (err) {
      console.error('Error sending offer to peer:', err);
    }
  };

  // Socket signaling listener
  useEffect(() => {
    if (!socket || !isInCall) return;

    // Existing peers received when joiner enters
    const handleExistingPeers = async ({ existingParticipants }: { existingParticipants: CallParticipant[] }) => {
      for (const p of existingParticipants) {
        getOrCreatePeerConnection(p.socketId, p);
      }
    };

    // When a peer joins our call, initiate the offer immediately so voice connects from the start!
    const handlePeerJoined = async ({ participant }: { participant: CallParticipant }) => {
      getOrCreatePeerConnection(participant.socketId, participant);
      // Initiate offer right away
      await sendOfferToPeer(participant.socketId);
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      if (peerConnectionsRef.current[socketId]) {
        try {
          peerConnectionsRef.current[socketId].peerConnection.close();
        } catch (e) {}
        delete peerConnectionsRef.current[socketId];
      }
      delete iceCandidateQueuesRef.current[socketId];

      setRemoteStreams(prev => prev.filter(p => p.socketId !== socketId));
      setRemoteScreenFrames(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        next.delete(socketId);
        return next;
      });
    };

    const handleParticipantSpeaking = ({ socketId, isSpeaking }: { socketId: string; isSpeaking: boolean }) => {
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        if (isSpeaking) {
          next.add(socketId);
        } else {
          next.delete(socketId);
        }
        return next;
      });
    };

    const handleScreenFrame = ({ fromSocketId, frameData }: { fromSocketId: string; frameData: string }) => {
      setRemoteScreenFrames(prev => ({
        ...prev,
        [fromSocketId]: frameData
      }));
    };

    const handleSignal = async ({ fromSocketId, signal, type }: { fromSocketId: string; signal: any; type: string }) => {
      const placeholder: CallParticipant = {
        userId: 'study_partner',
        userName: 'Study Partner',
        socketId: fromSocketId,
        isMuted: false,
        isScreenSharing: false,
        joinedAt: new Date().toISOString()
      };

      const pcData = getOrCreatePeerConnection(fromSocketId, placeholder);
      const pc = pcData.peerConnection;

      try {
        if (type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));

          // Drain queued ICE candidates
          if (iceCandidateQueuesRef.current[fromSocketId]) {
            for (const cand of iceCandidateQueuesRef.current[fromSocketId]) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            delete iceCandidateQueuesRef.current[fromSocketId];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', {
            toSocketId: fromSocketId,
            signal: answer,
            type: 'answer'
          });
        } else if (type === 'answer') {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));

            // Drain queued ICE candidates
            if (iceCandidateQueuesRef.current[fromSocketId]) {
              for (const cand of iceCandidateQueuesRef.current[fromSocketId]) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
              delete iceCandidateQueuesRef.current[fromSocketId];
            }
          }
        } else if (type === 'ice-candidate') {
          if (signal) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(() => {});
            } else {
              if (!iceCandidateQueuesRef.current[fromSocketId]) {
                iceCandidateQueuesRef.current[fromSocketId] = [];
              }
              iceCandidateQueuesRef.current[fromSocketId].push(signal);
            }
          }
        }
      } catch (err) {
        console.error('Signal handling error:', err);
      }
    };

    socket.on('call:existing_peers', handleExistingPeers);
    socket.on('call:peer_joined', handlePeerJoined);
    socket.on('call:peer_left', handlePeerLeft);
    socket.on('call:participant_speaking', handleParticipantSpeaking);
    socket.on('call:signal', handleSignal);
    socket.on('call:video_frame', handleScreenFrame);

    return () => {
      socket.off('call:existing_peers', handleExistingPeers);
      socket.off('call:peer_joined', handlePeerJoined);
      socket.off('call:peer_left', handlePeerLeft);
      socket.off('call:participant_speaking', handleParticipantSpeaking);
      socket.off('call:signal', handleSignal);
      socket.off('call:video_frame', handleScreenFrame);
    };
  }, [socket, isInCall]);

  // Periodic REST Call Sync + Heartbeat for Serverless
  useEffect(() => {
    if (!token || !activeCampaignId || !isInCall) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`/api/calls/${activeCampaignId}/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            isMuted,
            isScreenSharing
          })
        });
      } catch {}
    };

    const pollCallSession = async () => {
      try {
        const res = await fetch(`/api/calls/${activeCampaignId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.participants)) {
            setParticipants(data.participants);
          }
        }
      } catch {}
    };

    // Send heartbeat immediately + every 8s to stay alive in the channel
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 8000);

    // Poll participant list every 4s so other users appear quickly
    pollCallSession();
    const pollInterval = setInterval(pollCallSession, 4000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(pollInterval);
    };
  }, [token, activeCampaignId, isInCall, isMuted, isScreenSharing]);

  const joinCall = async (campaignId: string, campaignName: string) => {
    try {
      getAudioContext();

      let audioStream: MediaStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (e) {
        const ctx = getAudioContext();
        if (ctx) {
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          audioStream = dst.stream;
        } else {
          audioStream = new MediaStream();
        }
      }

      localAudioRef.current = audioStream;
      setLocalAudioStream(audioStream);
      setIsInCall(true);
      setActiveCampaignId(campaignId);
      setActiveCampaignName(campaignName);

      startAudioAnalyzer(audioStream);

      if (socket) {
        socket.emit('call:join', {
          campaignId,
          isMuted: false,
          isScreenSharing: false
        });
      }

      if (token) {
        fetch(`/api/calls/${campaignId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            isMuted: false,
            isDeafened: false,
            isScreenSharing: false
          })
        }).then(res => res.json()).then(session => {
          if (session && Array.isArray(session.participants)) {
            setParticipants(session.participants);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to join voice call:', err);
    }
  };

  const leaveCall = () => {
    stopAudioAnalyzer();
    stopScreenBroadcast();

    const campId = activeCampaignId;

    if (socket && campId) {
      socket.emit('call:leave', campId);
    }

    if (token && campId) {
      fetch(`/api/calls/${campId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }

    if (localAudioRef.current) {
      localAudioRef.current.getTracks().forEach(t => t.stop());
      localAudioRef.current = null;
    }
    setLocalAudioStream(null);

    if (localScreenRef.current) {
      localScreenRef.current.getTracks().forEach(t => t.stop());
      localScreenRef.current = null;
    }
    setLocalScreenStream(null);

    Object.values(peerConnectionsRef.current).forEach(({ peerConnection }) => {
      try {
        peerConnection.close();
      } catch (e) {}
    });
    peerConnectionsRef.current = {};
    iceCandidateQueuesRef.current = {};
    setRemoteStreams([]);
    setRemoteScreenFrames({});
    setSpeakingUsers(new Set());
    setParticipants([]);

    setIsInCall(false);
    setActiveCampaignId(null);
    setActiveCampaignName('');
    setIsScreenSharing(false);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localAudioRef.current) {
      localAudioRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }

    if (socket && activeCampaignId) {
      socket.emit('call:state_change', {
        campaignId: activeCampaignId,
        isMuted: nextMuted,
        isScreenSharing
      });
      if (nextMuted) {
        socket.emit('call:speaking', { campaignId: activeCampaignId, isSpeaking: false });
      }
    }

    if (token && activeCampaignId) {
      fetch(`/api/calls/${activeCampaignId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isMuted: nextMuted,
          isScreenSharing
        })
      }).catch(() => {});
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      stopScreenBroadcast();

      if (localScreenRef.current) {
        const screenTracks = localScreenRef.current.getVideoTracks();
        screenTracks.forEach(t => t.stop());

        Object.keys(peerConnectionsRef.current).forEach(socketId => {
          const { peerConnection } = peerConnectionsRef.current[socketId];
          const sender = peerConnection.getSenders().find(s => s.track && screenTracks.includes(s.track));
          if (sender) {
            peerConnection.removeTrack(sender);
          }
          sendOfferToPeer(socketId);
        });

        localScreenRef.current = null;
      }
      setLocalScreenStream(null);

      if (socket && activeCampaignId) {
        socket.emit('call:state_change', {
          campaignId: activeCampaignId,
          isMuted,
          isScreenSharing: false
        });
      }

      if (token && activeCampaignId) {
        fetch(`/api/calls/${activeCampaignId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            isMuted,
            isScreenSharing: false
          })
        }).catch(() => {});
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        localScreenRef.current = screenStream;
        setLocalScreenStream(screenStream);
        setIsScreenSharing(true);

        // Add track to all peer connections and renegotiate
        Object.keys(peerConnectionsRef.current).forEach(socketId => {
          const { peerConnection } = peerConnectionsRef.current[socketId];
          peerConnection.addTrack(screenTrack, screenStream);
          sendOfferToPeer(socketId);
        });

        // Start DOM-based frame capture relay
        startScreenBroadcast(screenStream);

        if (socket && activeCampaignId) {
          socket.emit('call:state_change', {
            campaignId: activeCampaignId,
            isMuted,
            isScreenSharing: true
          });
        }

        if (token && activeCampaignId) {
          fetch(`/api/calls/${activeCampaignId}/join`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              isMuted,
              isScreenSharing: true
            })
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Screen share request cancelled:', err);
        setIsScreenSharing(false);
      }
    }
  };

  // Called by VoiceRoom to sync LiveKit connection state into global context
  const setLiveKitConnected = (campaignId: string | null) => {
    if (campaignId) {
      setIsInCall(true);
      setActiveCampaignId(campaignId);
    } else {
      setIsInCall(false);
      setActiveCampaignId(null);
    }
  };

  return (
    <CallContext.Provider value={{
      isInCall,
      activeCampaignId,
      activeCampaignName,
      isMuted,
      isScreenSharing,
      localAudioStream,
      localScreenStream,
      remoteStreams,
      remoteScreenFrames,
      speakingUsers,
      isLocalSpeaking,
      participants,
      joinCall,
      leaveCall,
      toggleMute,
      toggleScreenShare,
      setLiveKitConnected
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
