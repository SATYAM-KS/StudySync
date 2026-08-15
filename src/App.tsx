import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SocketProvider } from './context/SocketContext.tsx';
import { StudyProvider, useStudy } from './context/StudyContext.tsx';
import { CallProvider, useCall } from './context/CallContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { CampaignsList } from './components/CampaignsList.tsx';
import { CampaignDetail } from './components/CampaignDetail.tsx';
import { CreateCampaignModal } from './components/CreateCampaignModal.tsx';
import { EditProfileModal } from './components/EditProfileModal.tsx';
import { Campaign } from './types/index.ts';
import { 
  Square, 
  ArrowRight, 
  BookOpen
} from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { isStudying, activeCampaignId, activeCampaignName, sessionElapsedSeconds, stopStudying } = useStudy();
  const { isInCall, activeCampaignName: callCampaignName, leaveCall } = useCall();
  const { theme } = useTheme();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
    return sessionStorage.getItem('study_active_campaign') || null;
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

  // Loading spinner on initial auth check
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-11 h-11 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-sm">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="w-5 h-5 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If not logged in, show clean Auth Screen
  if (!user) {
    return <AuthScreen />;
  }

  // Dashboard for authenticated user
  return (
    <div className="h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black font-sans antialiased transition-colors duration-200">
      
      {/* Top Navigation */}
      <Navbar
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onGoHome={() => handleSelectCampaign(null)}
      />

      {/* Main Content Area — overflow-hidden, internal containers handle their own scroll */}
      <main className="flex-1 overflow-hidden h-full">
        {selectedCampaignId ? (
          <CampaignDetail
            campaignId={selectedCampaignId}
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

    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <StudyProvider>
            <CallProvider>
              <MainApp />
            </CallProvider>
          </StudyProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
