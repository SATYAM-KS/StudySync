import React, { useEffect, useRef, useState } from 'react';
import { Campaign, CallParticipant } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useCall } from '../context/CallContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { 
  Mic, 
  MicOff, 
  Monitor, 
  PhoneOff, 
  Users, 
  Headphones,
  Maximize2,
  Minimize2,
  Volume2,
  Sparkles
} from 'lucide-react';

interface VoiceRoomProps {
  campaign: Campaign;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

export const VoiceRoom: React.FC<VoiceRoomProps> = ({ campaign }) => {
  const { user } = useAuth();
  const {
    isInCall,
    activeCampaignId,
    isMuted,
    isScreenSharing,
    localScreenStream,
    remoteStreams,
    remoteScreenFrames,
    speakingUsers,
    isLocalSpeaking,
    participants: contextParticipants,
    joinCall,
    leaveCall,
    toggleMute,
    toggleScreenShare
  } = useCall();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [channelParticipants, setChannelParticipants] = useState<CallParticipant[]>([]);
  const screenContainerRef = useRef<HTMLDivElement>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement>(null);

  const isCurrentCampaignInCall = isInCall && activeCampaignId === campaign.id;

  // Poll live call session so users always see connected members even before joining
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/calls/${campaign.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.participants)) {
            setChannelParticipants(data.participants);
          }
        }
      } catch {}
    };

    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [campaign.id, isCurrentCampaignInCall]);

  // Combine context and polled participants
  const effectiveParticipants = isCurrentCampaignInCall && contextParticipants.length > 0
    ? contextParticipants
    : channelParticipants;

  // Only show screen theater when a participant has explicitly set isScreenSharing: true
  const remoteScreenSharer = effectiveParticipants.find(p => p.userId !== user?.id && p.isScreenSharing === true);
  
  // Show theater as soon as someone is confirmed sharing
  const isAnyScreenActive = isScreenSharing || Boolean(remoteScreenSharer);

  const activeRemoteStream = remoteScreenSharer
    ? remoteStreams.find(r => r.socketId === remoteScreenSharer.socketId || r.participant.userId === remoteScreenSharer.userId)?.stream
    : undefined;
  
  const activeRemoteFrame = remoteScreenSharer
    ? (remoteScreenFrames[remoteScreenSharer.socketId || ''] || remoteScreenFrames[remoteScreenSharer.userId] || Object.values(remoteScreenFrames)[0])
    : Object.values(remoteScreenFrames)[0];

  // Attach local screen video
  useEffect(() => {
    if (localScreenVideoRef.current && localScreenStream) {
      localScreenVideoRef.current.srcObject = localScreenStream;
      localScreenVideoRef.current.play().catch(() => {});
    }
  }, [localScreenStream, isScreenSharing]);

  const handleJoin = () => {
    joinCall(campaign.id, campaign.name);
  };

  const toggleFullscreen = () => {
    if (!screenContainerRef.current) return;
    if (!document.fullscreenElement) {
      screenContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm text-zinc-900 dark:text-zinc-100 transition-colors">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-950 dark:text-white flex items-center gap-2">
              Voice & Screen Channel
              {isCurrentCampaignInCall ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black font-bold uppercase animate-pulse">
                  Connected
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
                  {effectiveParticipants.length} active
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live group audio channel with screen sharing for {campaign.name}
            </p>
          </div>
        </div>

        {/* Join/Leave Button */}
        {!isCurrentCampaignInCall ? (
          <button
            onClick={handleJoin}
            className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-sm flex items-center space-x-2 transition transform active:scale-95 cursor-pointer"
          >
            <Headphones className="w-4 h-4" />
            <span>Connect to Voice</span>
          </button>
        ) : (
          <button
            onClick={leaveCall}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold text-xs border border-zinc-300 dark:border-zinc-700 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        
        {/* Active Call Controls Bar (when connected) */}
        {isCurrentCampaignInCall ? (
          <div className="flex items-center justify-center space-x-4 bg-zinc-100 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm mx-auto shadow-sm">
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-xl flex items-center justify-center transition cursor-pointer ${
                isMuted
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700'
                  : 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-bold ring-2 ring-zinc-400 dark:ring-zinc-600'
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-xl flex items-center justify-center transition cursor-pointer ${
                isScreenSharing
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm font-bold ring-2 ring-zinc-400 dark:ring-zinc-600'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700'
              }`}
              title={isScreenSharing ? "Stop Screen Sharing" : "Share Screen"}
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* Leave Room Button */}
            <button
              onClick={leaveCall}
              className="p-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white shadow-sm transition cursor-pointer"
              title="Disconnect"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-black dark:bg-white animate-pulse" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {effectiveParticipants.length > 0 
                  ? `${effectiveParticipants.length} student${effectiveParticipants.length > 1 ? 's' : ''} currently in this voice channel` 
                  : 'Voice channel is open. Be the first to join!'}
              </span>
            </div>
            <button
              onClick={handleJoin}
              className="px-4 py-1.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs transition cursor-pointer"
            >
              Connect
            </button>
          </div>
        )}

        {/* Screen Share Active Theater View */}
        {isAnyScreenActive && (
          <div 
            ref={screenContainerRef} 
            className="relative rounded-3xl overflow-hidden bg-black border border-zinc-300 dark:border-zinc-800 aspect-video shadow-2xl flex items-center justify-center"
          >
            {isScreenSharing ? (
              <video
                ref={localScreenVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : (
              <RemoteScreenDisplay 
                participantName={remoteScreenSharer?.userName || 'Study Partner'} 
                stream={activeRemoteStream}
                frameData={activeRemoteFrame}
              />
            )}

            {/* Theater Overlay Bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="px-3 py-1 rounded-xl bg-black/70 backdrop-blur text-xs text-white font-semibold border border-white/10 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-zinc-300" />
                {isScreenSharing ? 'You are sharing your screen' : `${remoteScreenSharer?.userName || 'Study Partner'}'s Screen`}
              </span>

              <button
                onClick={toggleFullscreen}
                className="pointer-events-auto p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur border border-white/10 transition cursor-pointer"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Voice Lounge Participant Tiles (Always visible Discord Channel Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* Local User Tile (if in call) */}
          {isCurrentCampaignInCall && (
            <div className={`relative rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-950 border transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] ${
              isLocalSpeaking 
                ? 'border-zinc-900 dark:border-white shadow-md ring-2 ring-zinc-400 dark:ring-zinc-600' 
                : 'border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="relative">
                <UserAvatar
                  name={user?.name || 'You'}
                  avatarUrl={user?.avatarUrl}
                  size="2xl"
                  rounded="2xl"
                  className={isLocalSpeaking ? 'scale-105 ring-4 ring-black dark:ring-white transition-transform' : 'ring-1 ring-zinc-300 dark:ring-zinc-700 transition-transform'}
                />
                
                {/* Speaking / Muted status ring badge */}
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white dark:border-zinc-950 ${
                  isMuted ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'bg-black text-white dark:bg-white dark:text-black'
                }`}>
                  {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-950 dark:text-white truncate max-w-[140px]">
                  {user?.name} (You)
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {isLocalSpeaking ? 'Speaking...' : isMuted ? 'Muted' : 'Listening'}
                </p>
              </div>

              {isScreenSharing && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center gap-1 border border-zinc-300 dark:border-zinc-700">
                  <Monitor className="w-2.5 h-2.5" /> Sharing
                </span>
              )}
            </div>
          )}

          {/* Remote Peers Audio Tiles */}
          {effectiveParticipants
            .filter(p => p.userId !== user?.id)
            .map((p) => {
              const streamData = remoteStreams.find(r => r.socketId === p.socketId || r.participant.userId === p.userId);
              const isSpeaking = speakingUsers.has(p.socketId || '') || speakingUsers.has(p.userId);

              return (
                <RemoteAudioParticipantTile 
                  key={p.socketId || p.userId} 
                  participant={p} 
                  stream={streamData?.stream}
                  isSpeaking={isSpeaking}
                />
              );
            })}

          {/* Open Seat Card / Connect Prompter */}
          {effectiveParticipants.length === 0 && !isCurrentCampaignInCall && (
            <div 
              onClick={handleJoin}
              className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-5 flex flex-col items-center justify-center text-center min-h-[160px] col-span-full hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer"
            >
              <Users className="w-6 h-6 text-zinc-400 dark:text-zinc-600 mb-1.5" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Voice Channel Empty</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Click here to enter the channel and study with peers</p>
            </div>
          )}

        </div>

        {/* Etiquette Banner */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-start space-x-3">
          <Sparkles className="w-4 h-4 text-zinc-800 dark:text-zinc-200 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-200">Study Lounge Etiquette:</span> Microphones are active with noise suppression. Share your screen to review problems, inspect code, or study side-by-side!
          </div>
        </div>

      </div>

    </div>
  );
};

// Subcomponent for Remote Peer Audio Tile
const RemoteAudioParticipantTile: React.FC<{ 
  participant: CallParticipant; 
  stream?: MediaStream;
  isSpeaking: boolean;
}> = ({ participant, stream, isSpeaking }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach remote audio stream and trigger playback
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = false;
      audioRef.current.volume = 1.0;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.log('Audio autoplay scheduled on interaction:', err);
          const handleUserInteraction = () => {
            audioRef.current?.play().catch(() => {});
            window.removeEventListener('click', handleUserInteraction);
            window.removeEventListener('keydown', handleUserInteraction);
          };
          window.addEventListener('click', handleUserInteraction);
          window.addEventListener('keydown', handleUserInteraction);
        });
      }
    }
  }, [stream]);

  const avatarUrl = participant.userAvatarUrl || DEFAULT_AVATAR;

  return (
    <div className={`relative rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-950 border transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] ${
      isSpeaking 
        ? 'border-zinc-900 dark:border-white shadow-md ring-2 ring-zinc-400 dark:ring-zinc-600' 
        : 'border-zinc-200 dark:border-zinc-800'
    }`}>
      {/* Hidden audio element to playback peer's voice */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        onLoadedMetadata={() => audioRef.current?.play().catch(() => {})}
      />

      <div className="relative">
        <UserAvatar
          name={participant.userName}
          avatarUrl={participant.userAvatarUrl}
          size="2xl"
          rounded="2xl"
          className={isSpeaking ? 'scale-105 ring-4 ring-black dark:ring-white transition-transform' : 'ring-1 ring-zinc-300 dark:ring-zinc-700 transition-transform'}
        />
        
        {/* Status ring badge */}
        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white dark:border-zinc-950 ${
          participant.isMuted ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'bg-black text-white dark:bg-white dark:text-black'
        }`}>
          {participant.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-zinc-950 dark:text-white truncate max-w-[140px]">
          {participant.userName}
        </p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {isSpeaking ? 'Speaking...' : participant.isMuted ? 'Muted' : 'Listening'}
        </p>
      </div>

      {participant.isScreenSharing && (
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center gap-1 border border-zinc-300 dark:border-zinc-700">
          <Monitor className="w-2.5 h-2.5" /> Sharing
        </span>
      )}
    </div>
  );
};

// Subcomponent for Remote Screen Share Theater
const RemoteScreenDisplay: React.FC<{
  participantName: string;
  stream?: MediaStream;
  frameData?: string;
}> = ({ participantName, stream, frameData }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideoStream = Boolean(stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks().some(t => t.enabled));

  useEffect(() => {
    if (videoRef.current && stream && hasVideoStream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, hasVideoStream]);

  if (hasVideoStream) {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
        onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
      />
    );
  }

  if (frameData) {
    return (
      <img
        src={frameData}
        alt={`${participantName}'s Screen`}
        className="w-full h-full object-contain"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-zinc-400 space-y-2">
      <Monitor className="w-10 h-10 animate-pulse text-zinc-500" />
      <p className="text-xs font-semibold text-zinc-300">Connecting to {participantName}'s screen...</p>
    </div>
  );
};
