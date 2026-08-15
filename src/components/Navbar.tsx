import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { useCall } from '../context/CallContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { 
  BookOpen, 
  Clock, 
  Mic, 
  MicOff, 
  PhoneOff, 
  ChevronDown,
  LogOut,
  User as UserIcon,
  Plus,
  Sun,
  Moon
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
  const { isInCall, activeCampaignName: callCampaignName, isMuted, toggleMute, leaveCall } = useCall();
  const { onlineUserIds, activeStudySessions } = useSocket();
  const { theme, toggleTheme } = useTheme();

  const [showUserMenu, setShowUserMenu] = useState(false);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={onGoHome}>
          <div className="w-9 h-9 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black transition transform group-hover:scale-105">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white">
                StudySync
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-full">
                Cohort
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">Accountability Study Groups</p>
          </div>
        </div>

        {/* Center Live Badges */}
        <div className="hidden md:flex items-center space-x-2.5">
          {/* Active Study Session Indicator */}
          {isStudying && (
            <div className="flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-full text-xs animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white"></span>
              <span className="font-medium truncate max-w-[130px] text-zinc-800 dark:text-zinc-200">{activeCampaignName}</span>
              <span className="font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-white px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700">
                {formatTimer(sessionElapsedSeconds)}
              </span>
            </div>
          )}

          {/* Active Voice Call Floating Pill */}
          {isInCall && (
            <div className="flex items-center space-x-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Voice Channel Live</span>
            </div>
          )}

          {/* Community Online Count */}
          <div className="flex items-center space-x-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white"></span>
            <span>{onlineUserIds.length || 1} online</span>
            {activeStudySessions.length > 0 && (
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                · {activeStudySessions.length} studying
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          
          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-zinc-200 transition transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-800 transition transform hover:-rotate-12" />
            )}
          </button>

          {/* Create Campaign Shortcut */}
          <button
            onClick={onOpenCreateModal}
            className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
            >
              <UserAvatar
                name={user?.name || 'Student'}
                avatarUrl={user?.avatarUrl}
                size="xs"
                rounded="lg"
              />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 hidden sm:inline max-w-[100px] truncate">
                {user?.name || 'Student'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 text-zinc-900 dark:text-zinc-100">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">{user?.name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
                  {user?.studyGoal && (
                    <p className="text-[11px] text-zinc-700 dark:text-zinc-300 mt-1 truncate">🎯 {user.studyGoal}</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    onOpenProfile();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Profile & Goal</span>
                </button>

                {isStudying && (
                  <button
                    onClick={() => {
                      stopStudying();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Stop Current Session</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition border-t border-zinc-100 dark:border-zinc-800 mt-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
