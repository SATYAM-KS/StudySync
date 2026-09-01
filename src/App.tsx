import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SocketProvider, useSocket } from './context/SocketContext.tsx';
import { StudyProvider, useStudy } from './context/StudyContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { CampaignsList } from './components/CampaignsList.tsx';
import { CampaignDetail } from './components/CampaignDetail.tsx';
import { CreateCampaignModal } from './components/CreateCampaignModal.tsx';
import { EditProfileModal } from './components/EditProfileModal.tsx';
import { DailyRoutineModal } from './components/DailyRoutineModal.tsx';
import { AnimatedBackground } from './components/AnimatedBackground.tsx';
import { AppLoadingScreen } from './components/AppLoadingScreen.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { Campaign } from './types/index.ts';
import { 
  Square, 
  ArrowRight, 
  BookOpen
} from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { socket } = useSocket();
  const { 
    isStudying, 
    activeCampaignId, 
    activeCampaignName, 
    sessionElapsedSeconds, 
    stopStudying,
    collegeRoutine,
    todayTargetHours,
    dailyTargetHours,
    showRoutineModal,
    setShowRoutineModal,
    setDailyTargetHours,
    setDailyCollegeRoutine
  } = useStudy();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
    return sessionStorage.getItem('study_active_campaign') || null;
  });
  const [campaignTab, setCampaignTab] = useState<'focus' | 'leaderboard' | 'history'>(() => {
    return (sessionStorage.getItem('study_active_tab') as 'focus' | 'leaderboard' | 'history') || 'focus';
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);

  const handleSelectCampaign = (id: string | null) => {
    setSelectedCampaignId(id);
    if (id) {
      sessionStorage.setItem('study_active_campaign', id);
    } else {
      sessionStorage.removeItem('study_active_campaign');
    }
  };

  const handleCampaignTabChange = (tab: 'focus' | 'leaderboard' | 'history') => {
    setCampaignTab(tab);
    sessionStorage.setItem('study_active_tab', tab);
  };

  // Fetch all campaigns when authenticated
  const fetchCampaigns = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : []);
      } else {
        setCampaigns([]);
      }
    } catch (e) {
      console.error('Failed to fetch campaigns:', e);
      setCampaigns([]);
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCampaigns();
    } else {
      setCampaigns([]);
      handleSelectCampaign(null);
      setIsLoadingCampaigns(false);
    }
  }, [token]);

  // Real-time synchronization without browser refresh
  useEffect(() => {
    if (!socket) return;

    const onCampaignCreated = (newCamp: Campaign) => {
      setCampaigns(prev => {
        if (prev.some(c => c.id === newCamp.id)) return prev;
        return [newCamp, ...prev];
      });
    };

    const onCampaignUpdated = (updatedCamp: Campaign) => {
      setCampaigns(prev => prev.map(c => c.id === updatedCamp.id ? { ...c, ...updatedCamp } : c));
    };

    const onCampaignDeleted = ({ id }: { id: string }) => {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      if (selectedCampaignId === id) {
        handleSelectCampaign(null);
      }
    };

    const onMembershipChanged = () => {
      fetchCampaigns();
    };

    socket.on('campaign:created', onCampaignCreated);
    socket.on('campaign:updated', onCampaignUpdated);
    socket.on('campaign:deleted', onCampaignDeleted);
    socket.on('campaign:member_joined', onMembershipChanged);
    socket.on('campaign:membership_updated', onMembershipChanged);
    socket.on('campaign:member_left', onMembershipChanged);

    return () => {
      socket.off('campaign:created', onCampaignCreated);
      socket.off('campaign:updated', onCampaignUpdated);
      socket.off('campaign:deleted', onCampaignDeleted);
      socket.off('campaign:member_joined', onMembershipChanged);
      socket.off('campaign:membership_updated', onMembershipChanged);
      socket.off('campaign:member_left', onMembershipChanged);
    };
  }, [socket, selectedCampaignId]);

  const handleJoinCampaign = async (campaignId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchCampaigns();
      }
    } catch (e) {
      console.error('Failed to join campaign:', e);
    }
  };

  const handleCampaignCreated = (newCampaign: Campaign) => {
    setCampaigns(prev => [newCampaign, ...prev]);
    handleSelectCampaign(newCampaign.id);
  };

  const handleCampaignDeleted = () => {
    handleSelectCampaign(null);
    fetchCampaigns();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Loading screen on initial auth check
  if (isAuthLoading) {
    return <AppLoadingScreen />;
  }

  // If not logged in, show clean Auth Screen
  if (!user) {
    return <AuthScreen />;
  }

  // Dashboard for authenticated user
  return (
    <div className="relative h-screen overflow-hidden bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black font-sans antialiased transition-colors duration-300">
      
      {/* Animated Floating Luminous Mesh Orbs for Glassmorphism */}
      <AnimatedBackground />

      {/* Top Navigation */}
      <div className="relative z-30">
        <Navbar
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onGoHome={() => handleSelectCampaign(null)}
          selectedCampaignId={selectedCampaignId}
          activeTab={campaignTab}
          onTabChange={handleCampaignTabChange}
        />
      </div>

      {/* Main Content Area — overflow-hidden, internal containers handle their own scroll */}
      <main className="relative flex-1 overflow-hidden h-full">
        {selectedCampaignId ? (
          <CampaignDetail
            campaignId={selectedCampaignId}
            activeTab={campaignTab}
            onTabChange={handleCampaignTabChange}
            onBack={() => handleSelectCampaign(null)}
            onCampaignDeleted={handleCampaignDeleted}
          />
        ) : (
          <CampaignsList
            campaigns={campaigns}
            onSelectCampaign={(id) => handleSelectCampaign(id)}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onJoinCampaign={handleJoinCampaign}
            isLoading={isLoadingCampaigns}
          />
        )}
      </main>

      {/* Floating Active Study Mini-Bar if studying and on another screen */}
      {isStudying && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-700 shadow-2xl rounded-full px-4 py-2 flex items-center space-x-3 text-xs text-white">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span className="font-semibold text-zinc-200">Focusing in {activeCampaignName}</span>
          </div>

          <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded text-white font-bold border border-zinc-700">
            {formatTime(sessionElapsedSeconds)}
          </span>

          {selectedCampaignId !== activeCampaignId && (
            <button
              onClick={() => handleSelectCampaign(activeCampaignId)}
              className="px-2.5 py-1 rounded-full bg-white text-zinc-950 font-bold transition flex items-center space-x-1 hover:bg-zinc-200 cursor-pointer"
            >
              <span>View Lounge</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={stopStudying}
            className="p-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Stop Study Session"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      )}


      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCampaignCreated={handleCampaignCreated}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* 2 AM Cycle Daily Target Focus Check-in Modal */}
      <DailyRoutineModal
        isOpen={showRoutineModal}
        onClose={() => setShowRoutineModal(false)}
        currentTargetHours={todayTargetHours}
        currentRoutine={collegeRoutine}
        onSelectTargetHours={setDailyTargetHours}
        onSelectRoutine={setDailyCollegeRoutine}
      />

    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <StudyProvider>
            <MainApp />
          </StudyProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
