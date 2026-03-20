import React, { useState, useEffect, useCallback } from 'react';
import { UserRole } from './types';
import type { Profile, UserRole as DbUserRole } from './types/database';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import AdminDashboard from './components/AdminDashboard';
import type { AdminViewMode } from './components/AdminDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import NewHireDashboard from './components/NewHireDashboard';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import { Menu, Loader2 } from 'lucide-react';

// Using a data URI for a reliable, offline-capable logo placeholder that resembles the brand
const INDUSTRIOUS_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-weight='bold' font-size='32' fill='%23F3EEE7' letter-spacing='4'%3EINDUSTRIOUS%3C/text%3E%3C/svg%3E";

// --- URL param helpers for shareable deep links ---

const VIEW_TO_ROLE: Record<string, UserRole> = {
  admin: UserRole.ADMIN,
  manager: UserRole.MANAGER,
  newhire: UserRole.NEW_HIRE,
};
const ROLE_TO_VIEW: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'admin',
  [UserRole.MANAGER]: 'manager',
  [UserRole.NEW_HIRE]: 'newhire',
};

const VALID_ADMIN_TABS: AdminViewMode[] = ['dashboard', 'workflow', 'tasks', 'cohorts', 'agenda', 'communications', 'engagement', 'settings'];
const VALID_MANAGER_TABS = ['team', 'tracker'] as const;
const VALID_NEWHIRE_TABS = ['dashboard', 'calendar', 'workbook'] as const;

function readUrlParams(): { view: UserRole | null; tab: string | null } {
  const params = new URLSearchParams(window.location.search);
  const viewStr = params.get('view');
  const tabStr = params.get('tab');
  const view = viewStr ? VIEW_TO_ROLE[viewStr] ?? null : null;
  return { view, tab: tabStr };
}

function updateUrlParams(view: string, tab?: string) {
  const params = new URLSearchParams();
  params.set('view', view);
  if (tab) params.set('tab', tab);
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', url);
}

// Map database role to UserRole enum
function mapDbRoleToUserRole(dbRole: DbUserRole): UserRole {
  switch (dbRole) {
    case 'Admin':
      return UserRole.ADMIN;
    case 'Manager':
      return UserRole.MANAGER;
    case 'New Hire':
      return UserRole.NEW_HIRE;
    default:
      return UserRole.NEW_HIRE;
  }
}

// Convert Profile to legacy User interface for existing components
function profileToUser(profile: Profile) {
  return {
    id: profile.id,
    name: profile.name,
    role: mapDbRoleToUserRole(profile.role),
    avatar: profile.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    title: profile.title || '',
    email: profile.email,
    region: profile.region || undefined,
  };
}

const App: React.FC = () => {
  // Authentication State (Supabase)
  const { user, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile(user?.id);

  // View State (Dashboard Switching)
  const [currentView, setCurrentView] = useState<UserRole | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Admin Sub-View State (Lifted from AdminDashboard)
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode>('dashboard');

  // Child dashboard tab state (Manager / NewHire)
  const [childTab, setChildTab] = useState<string | undefined>(undefined);

  // Set initial view when profile loads, respecting URL params
  useEffect(() => {
    if (profile && !currentView) {
      const urlParams = readUrlParams();
      const userRole = mapDbRoleToUserRole(profile.role);
      const isAdmin = userRole === UserRole.ADMIN;

      // Admins can deep-link to any view; others ignore the view param
      const resolvedView = (isAdmin && urlParams.view) ? urlParams.view : userRole;
      setCurrentView(resolvedView);

      // Apply tab param if valid for the resolved view
      if (urlParams.tab) {
        if (resolvedView === UserRole.ADMIN && (VALID_ADMIN_TABS as readonly string[]).includes(urlParams.tab)) {
          setAdminViewMode(urlParams.tab as AdminViewMode);
        } else if (resolvedView === UserRole.MANAGER && (VALID_MANAGER_TABS as readonly string[]).includes(urlParams.tab)) {
          setChildTab(urlParams.tab);
        } else if (resolvedView === UserRole.NEW_HIRE && (VALID_NEWHIRE_TABS as readonly string[]).includes(urlParams.tab)) {
          setChildTab(urlParams.tab);
        }
      }
    }
  }, [profile, currentView]);

  // Reset view on logout
  useEffect(() => {
    if (!user) {
      setCurrentView(null);
      setAdminViewMode('dashboard');
      setChildTab(undefined);
    }
  }, [user]);

  // Sync URL whenever navigation state changes
  useEffect(() => {
    if (currentView) {
      const viewStr = ROLE_TO_VIEW[currentView];
      let tab: string | undefined;
      if (currentView === UserRole.ADMIN) {
        tab = adminViewMode;
      } else if (currentView === UserRole.MANAGER || currentView === UserRole.NEW_HIRE) {
        tab = childTab;
      }
      updateUrlParams(viewStr, tab);
    }
  }, [currentView, adminViewMode, childTab]);

  const handleLogout = async () => {
    await signOut();
    setCurrentView(null);
    setIsSidebarOpen(false);
    setAdminViewMode('dashboard');
    setChildTab(undefined);
  };

  const handleViewSwitch = (view: UserRole) => {
    setCurrentView(view);
    setChildTab(undefined);
    setIsSidebarOpen(false);
  };

  const handleChildTabChange = useCallback((tab: string) => {
    setChildTab(tab);
  }, []);

  // Convert profile to user object for existing components
  const currentUser = profile ? profileToUser(profile) : null;

  const renderDashboard = () => {
    if (!currentUser || !currentView) return null;
    switch (currentView) {
      case UserRole.ADMIN:
        return <AdminDashboard user={currentUser} viewMode={adminViewMode} setViewMode={setAdminViewMode} />;
      case UserRole.MANAGER:
        return <ManagerDashboard user={currentUser} initialTab={childTab as 'team' | 'tracker' | undefined} onTabChange={handleChildTabChange} />;
      case UserRole.NEW_HIRE:
        return <NewHireDashboard user={currentUser} initialTab={childTab as 'dashboard' | 'calendar' | 'workbook' | undefined} onTabChange={handleChildTabChange} />;
      default:
        return <div>Unknown View</div>;
    }
  };

  // Show loading state
  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#013E3F]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FDD344] animate-spin mx-auto mb-4" />
          <p className="text-[#F3EEE7]/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return (
      <Login
        onLogin={signIn}
        loading={authLoading}
        error={authError || undefined}
      />
    );
  }

  // Show error if profile failed to load
  if (profileError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#013E3F]">
        <div className="text-center max-w-md px-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 mb-4">
            <p className="text-red-400 font-medium mb-2">Profile Error</p>
            <p className="text-[#F3EEE7]/60 text-sm">{profileError || 'Failed to load your profile. Please try signing in again.'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#FDD344] text-sm hover:underline"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
      <ConnectionStatus />
      <div className="h-screen overflow-hidden flex bg-[#013E3F]">
        {/* Sidebar Navigation */}
        <Sidebar
          isOpen={isSidebarOpen}
          currentUser={currentUser!}
          currentView={currentView}
          adminViewMode={adminViewMode}
          onViewSwitch={handleViewSwitch}
          onAdminViewModeChange={setAdminViewMode}
          onLogout={handleLogout}
        />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-[#013E3F] border-b border-[#F3EEE7]/10 px-4 py-4 flex items-center justify-between">
           <img src={INDUSTRIOUS_LOGO_SVG} alt="Industrious Logo" className="h-6 w-auto object-contain" />
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-[#F3EEE7]"><Menu /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:px-10 lg:pt-10 lg:pb-10 custom-scrollbar">
          {renderDashboard()}
        </main>
      </div>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      </div>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
