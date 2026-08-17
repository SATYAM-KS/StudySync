import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { BrandLogo } from './BrandLogo.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { useCall } from '../context/CallContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { 
  Clock, 
  ChevronDown,
  LogOut,
  User as UserIcon,
  Plus,
  Sparkles,
  Flame,
  Radio
} from 'lucide-react';

interface NavbarProps {
  onOpenProfile: () => void;
  onGoHome: () => void;
  onOpenCreateModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenProfile, 
  onGoHome, 
  onOpenCreateModal 
}) => {
  const { user, logout } = useAuth();
  const { isStudying, sessionElapsedSeconds, activeCampaignName, stopStudying } = useStudy();
  const { isInCall } = useCall();
  const { onlineUserIds, activeStudySessions } = useSocket();

  const [showUserMenu, setShowUserMenu] = useState(false);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 glass-nav text-zinc-900 dark:text-zinc-100 transition-all duration-300 border-b border-zinc-200/80 dark:border-white/[0.08] shadow-sm backdrop-blur-2xl">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer group select-none" onClick={onGoHome}>
          <div className="relative">
            <BrandLogo size="sm" className="group-hover:scale-105 transition-transform duration-300 shadow-sm" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-base tracking-tight text-zinc-950 dark:text-white font-sans">
                StudySync
              </span>
              <span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs">
                Cohort
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium hidden sm:block leading-none mt-0.5">
              Peer Accountability Hub
            </p>
          </div>
        </div>

        {/* Center Live Badges (Dynamic Status Hub) */}
        <div className="hidden md:flex items-center space-x-3">
          {/* Active Study Session Indicator */}
          {isStudying && (
            <div className="flex items-center space-x-2 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs animate-pulse shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" style={{ animationDuration: '2s' }} />
              <span className="font-semibold truncate max-w-[130px] text-emerald-900 dark:text-emerald-300">{activeCampaignName}</span>
              <span className="font-mono font-bold bg-zinc-950 text-white dark:bg-white dark:text-black px-2 py-0.5 rounded-md text-[11px] shadow-xs">
                {formatTimer(sessionElapsedSeconds)}
              </span>
            </div>
          )}

          {/* Active Voice Call Floating Pill */}
          {isInCall && (
            <div className="flex items-center space-x-2 bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-sm">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Voice Channel Live</span>
            </div>
          )}

          {/* Community Online Count */}
          <div className="flex items-center space-x-2.5 text-xs text-zinc-600 dark:text-zinc-300 glass-pill px-3.5 py-1.5 rounded-full shadow-2xs border border-zinc-200/80 dark:border-white/[0.08]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            <span className="font-semibold">{onlineUserIds.length} online</span>
            {activeStudySessions.length > 0 && (
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                · {activeStudySessions.length} focus
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2.5">
          
          {/* Create Campaign Shortcut */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black text-xs font-black transition transform active:scale-95 cursor-pointer shadow-sm border border-zinc-800 dark:border-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Cohort</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2.5 p-1.5 pr-2.5 rounded-xl glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition cursor-pointer active:scale-95 border border-zinc-200/80 dark:border-white/[0.08]"
            >
              <UserAvatar
                name={user?.name || 'Student'}
                avatarUrl={user?.avatarUrl}
                size="xs"
                rounded="lg"
                className="shadow-xs"
              />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 hidden sm:inline max-w-[100px] truncate">
                {user?.name || 'Student'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.12] p-2 z-50 animate-in fade-in slide-in-from-top-2 text-zinc-900 dark:text-zinc-100 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
                <div className="px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-white/[0.08] mb-1">
                  <p className="text-xs font-black text-zinc-950 dark:text-white truncate">{user?.name}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{user?.email}</p>
                  {user?.studyGoal && (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1.5 truncate font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      <span>{user.studyGoal}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    onOpenProfile();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Profile & Target</span>
                </button>

                {isStudying && (
                  <button
                    onClick={() => {
                      stopStudying();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>End Current Focus Session</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition cursor-pointer border-t border-zinc-200/80 dark:border-white/[0.08] mt-1 pt-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
