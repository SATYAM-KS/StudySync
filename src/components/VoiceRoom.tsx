import React, { useState, useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
  AudioTrack
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  Track,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant
} from "livekit-client";
import {
  Headphones, PhoneOff, Mic, MicOff, Monitor, Users, Sparkles, Maximize2, Minimize2
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { useCall } from "../context/CallContext.tsx";
import { UserAvatar } from "./UserAvatar.tsx";
import { Campaign, CallParticipant } from "../types/index.ts";

interface VoiceRoomProps { campaign: Campaign; }

function LiveKitRoomUI({ campaign, onLeave, isScreenSharing, setIsScreenSharing, isMuted, setIsMuted }: { campaign: Campaign; onLeave: () => void; isScreenSharing: boolean; setIsScreenSharing: (v: boolean) => void; isMuted: boolean; setIsMuted: (v: boolean) => void; }) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const activeScreen = screenTracks[0];

  const toggleMic = async () => { await localParticipant.setMicrophoneEnabled(isMuted); setIsMuted(!isMuted); };
  const toggleScreen = async () => { try { await localParticipant.setScreenShareEnabled(!isScreenSharing); setIsScreenSharing(!isScreenSharing); } catch { setIsScreenSharing(false); } };
  const toggleFullscreen = () => { if (!screenRef.current) return; if (!document.fullscreenElement) { screenRef.current.requestFullscreen().catch(() => {}); setIsFullscreen(true); } else { document.exitFullscreen().catch(() => {}); setIsFullscreen(false); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-x-4 bg-zinc-100 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm mx-auto shadow-sm">
        <button onClick={toggleMic} className={`p-3.5 rounded-xl flex items-center justify-center transition cursor-pointer ${isMuted ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700" : "bg-black text-white dark:bg-white dark:text-black shadow-sm font-bold ring-2 ring-zinc-400 dark:ring-zinc-600"}`} title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={toggleScreen} className={`p-3.5 rounded-xl flex items-center justify-center transition cursor-pointer ${isScreenSharing ? "bg-black text-white dark:bg-white dark:text-black shadow-sm font-bold ring-2 ring-zinc-400 dark:ring-zinc-600" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"}`} title={isScreenSharing ? "Stop sharing" : "Share screen"}>
          <Monitor className="w-5 h-5" />
        </button>
        <button onClick={onLeave} className="p-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white shadow-sm transition cursor-pointer" title="Disconnect">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
      {activeScreen && (
        <div ref={screenRef} className="relative rounded-3xl overflow-hidden bg-black border border-zinc-300 dark:border-zinc-800 aspect-video shadow-2xl">
          <VideoTrack trackRef={activeScreen} className="w-full h-full object-contain" />
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <span className="px-3 py-1 rounded-xl bg-black/70 backdrop-blur text-xs text-white font-semibold border border-white/10 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-zinc-300" />{activeScreen.participant.name || activeScreen.participant.identity}&apos;s Screen
            </span>
            <button onClick={toggleFullscreen} className="pointer-events-auto p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur border border-white/10 transition cursor-pointer">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <LocalTile participant={localParticipant} isMuted={isMuted} isScreenSharing={isScreenSharing} />
        {remoteParticipants.map(p => <RemoteTile key={p.identity} participant={p} />)}
        {remoteParticipants.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-5 flex flex-col items-center justify-center text-center min-h-[160px]">
            <Users className="w-6 h-6 text-zinc-400 dark:text-zinc-600 mb-1.5" />
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Waiting for study partners</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Share your campaign link to invite others</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LocalTile({ participant, isMuted, isScreenSharing }: { participant: LocalParticipant; isMuted: boolean; isScreenSharing: boolean; }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  useEffect(() => { const id = setInterval(() => setIsSpeaking(participant.isSpeaking), 200); return () => clearInterval(id); }, [participant]);
  return (
    <div className={`relative rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-950 border transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] ${isSpeaking ? "border-zinc-900 dark:border-white shadow-md ring-2 ring-zinc-400 dark:ring-zinc-600" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="relative">
        <UserAvatar name={participant.name || participant.identity} size="2xl" rounded="2xl" className={isSpeaking ? "scale-105 ring-4 ring-black dark:ring-white transition-transform" : "ring-1 ring-zinc-300 dark:ring-zinc-700 transition-transform"} />
        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white dark:border-zinc-950 ${isMuted ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300" : "bg-black text-white dark:bg-white dark:text-black"}`}>
          {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-950 dark:text-white truncate max-w-[140px]">{participant.name || participant.identity} (You)</p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{isSpeaking ? "Speaking..." : isMuted ? "Muted" : "Listening"}</p>
      </div>
      {isScreenSharing && <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center gap-1 border border-zinc-300 dark:border-zinc-700"><Monitor className="w-2.5 h-2.5" /> Sharing</span>}
    </div>
  );
}

function RemoteTile({ participant }: { participant: RemoteParticipant }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const audioTracks = useTracks([Track.Source.Microphone], { participant });
  useEffect(() => { const id = setInterval(() => { setIsSpeaking(participant.isSpeaking); const mic = participant.getTrackPublication(Track.Source.Microphone); setIsMuted(!mic || mic.isMuted); const screen = participant.getTrackPublication(Track.Source.ScreenShare); setIsSharing(Boolean(screen && !screen.isMuted)); }, 250); return () => clearInterval(id); }, [participant]);
  return (
    <div className={`relative rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-950 border transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] ${isSpeaking ? "border-zinc-900 dark:border-white shadow-md ring-2 ring-zinc-400 dark:ring-zinc-600" : "border-zinc-200 dark:border-zinc-800"}`}>
      {audioTracks.map(t => <AudioTrack key={t.publication.trackSid} trackRef={t} />)}
      <div className="relative">
        <UserAvatar name={participant.name || participant.identity} size="2xl" rounded="2xl" className={isSpeaking ? "scale-105 ring-4 ring-black dark:ring-white transition-transform" : "ring-1 ring-zinc-300 dark:ring-zinc-700 transition-transform"} />
        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white dark:border-zinc-950 ${isMuted ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300" : "bg-black text-white dark:bg-white dark:text-black"}`}>
          {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-950 dark:text-white truncate max-w-[140px]">{participant.name || participant.identity}</p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{isSpeaking ? "Speaking..." : isMuted ? "Muted" : "Listening"}</p>
      </div>
      {isSharing && <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center gap-1 border border-zinc-300 dark:border-zinc-700"><Monitor className="w-2.5 h-2.5" /> Sharing</span>}
    </div>
  );
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({ campaign }) => {
  const { token: authToken } = useAuth();
  const { setLiveKitConnected } = useCall();
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("wss://santam-kfcwvgq2.livekit.cloud");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [channelParticipants, setChannelParticipants] = useState<CallParticipant[]>([]);

  useEffect(() => {
    const poll = async () => { try { const res = await fetch(`/api/calls/${campaign.id}`); if (res.ok) { const d = await res.json(); if (d?.participants) setChannelParticipants(d.participants); } } catch {} };
    poll(); const id = setInterval(poll, 5000); return () => clearInterval(id);
  }, [campaign.id]);

  const connectToRoom = useCallback(async () => {
    if (!authToken) return;
    setIsConnecting(true);
    try {
      const res = await fetch("/api/livekit/token", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ campaignId: campaign.id }) });
      const data = await res.json();
      if (data.token) { setLivekitToken(data.token); setLivekitUrl(data.url || livekitUrl); setIsConnected(true); setLiveKitConnected(campaign.id); }
    } catch (err) { console.error("LiveKit connect error:", err); } finally { setIsConnecting(false); }
  }, [authToken, campaign.id]);

  const disconnect = () => { setIsConnected(false); setLivekitToken(null); setIsScreenSharing(false); setIsMuted(false); setLiveKitConnected(null); };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white"><Headphones className="w-5 h-5" /></div>
          <div>
            <h3 className="font-bold text-base text-zinc-950 dark:text-white flex items-center gap-2">
              Voice &amp; Screen Channel
              {isConnected ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white dark:bg-white dark:text-black font-bold uppercase animate-pulse">Live</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">{channelParticipants.length} active</span>}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Real-time audio + screen share powered by LiveKit</p>
          </div>
        </div>
        {!isConnected ? (
          <button onClick={connectToRoom} disabled={isConnecting} className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-sm flex items-center space-x-2 transition transform active:scale-95 cursor-pointer disabled:opacity-50">
            <Headphones className="w-4 h-4" /><span>{isConnecting ? "Connecting..." : "Connect to Voice"}</span>
          </button>
        ) : (
          <button onClick={disconnect} className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold text-xs border border-zinc-300 dark:border-zinc-700 flex items-center space-x-1.5 transition cursor-pointer">
            <PhoneOff className="w-4 h-4" /><span>Disconnect</span>
          </button>
        )}
      </div>

      {!isConnected ? (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-black dark:bg-white animate-pulse" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{channelParticipants.length > 0 ? `${channelParticipants.length} student${channelParticipants.length > 1 ? "s" : ""} currently in this voice channel` : "Voice channel is open — be the first to join!"}</span>
            </div>
            <button onClick={connectToRoom} disabled={isConnecting} className="px-4 py-1.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs transition cursor-pointer disabled:opacity-50">{isConnecting ? "Connecting..." : "Connect"}</button>
          </div>
          {channelParticipants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {channelParticipants.map(p => (
                <div key={p.userId} className="rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px]">
                  <div className="relative">
                    <UserAvatar name={p.userName} avatarUrl={p.userAvatarUrl} size="2xl" rounded="2xl" className="ring-1 ring-zinc-300 dark:ring-zinc-700" />
                    <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white dark:border-zinc-950 ${p.isMuted ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300" : "bg-black text-white dark:bg-white dark:text-black"}`}>{p.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}</div>
                  </div>
                  <div><p className="text-xs font-bold text-zinc-950 dark:text-white truncate max-w-[140px]">{p.userName}</p><p className="text-[10px] text-zinc-500 dark:text-zinc-400">{p.isMuted ? "Muted" : "In call"}</p></div>
                </div>
              ))}
            </div>
          ) : (
            <div onClick={connectToRoom} className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-10 flex flex-col items-center justify-center text-center hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer">
              <Users className="w-7 h-7 text-zinc-400 dark:text-zinc-600 mb-2" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Voice Channel Empty</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Click to enter and study with peers</p>
            </div>
          )}
        </div>
      ) : (
        livekitToken && (
          <LiveKitRoom token={livekitToken} serverUrl={livekitUrl} connect={true} audio={true} video={false} onDisconnected={disconnect} options={{ adaptiveStream: true, dynacast: true }}>
            <LiveKitRoomUI campaign={campaign} onLeave={disconnect} isScreenSharing={isScreenSharing} setIsScreenSharing={setIsScreenSharing} isMuted={isMuted} setIsMuted={setIsMuted} />
          </LiveKitRoom>
        )
      )}

      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-start space-x-3">
        <Sparkles className="w-4 h-4 text-zinc-800 dark:text-zinc-200 shrink-0 mt-0.5" />
        <div><span className="font-bold text-zinc-900 dark:text-zinc-200">Study Lounge Etiquette:</span> Microphones are active with noise suppression. Share your screen to review problems, inspect code, or study side-by-side!</div>
      </div>
    </div>
  );
};

