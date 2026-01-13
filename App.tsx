import React, { useState } from 'react';
import { UserRole, User } from './types';
import { CURRENT_USER_ADMIN, MANAGERS, NEW_HIRES } from './constants';
import AdminDashboard from './components/AdminDashboard';
import type { AdminViewMode } from './components/AdminDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import NewHireDashboard from './components/NewHireDashboard';
import Login from './components/Login';
import { LayoutDashboard, Users, BookOpen, LogOut, Menu, ClipboardList, Calendar, MessageSquare, PieChart, Settings, ChevronRight } from 'lucide-react';

// Using a data URI for a reliable, offline-capable logo placeholder that resembles the brand
const INDUSTRIOUS_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-weight='bold' font-size='32' fill='%23F3EEE7' letter-spacing='4'%3EINDUSTRIOUS%3C/text%3E%3C/svg%3E";

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  
  // View State (Dashboard Switching)
  const [currentView, setCurrentView] = useState<UserRole | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Admin Sub-View State (Lifted from AdminDashboard)
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode>('dashboard');

  // Combine all mocked users into a single registry for auth check
  const USER_REGISTRY = [CURRENT_USER_ADMIN, ...MANAGERS, ...NEW_HIRES];

  const handleLogin = (input: string) => {
    const term = input.trim().toLowerCase();
    let user = USER_REGISTRY.find(u => u.email.toLowerCase() === term || u.name.toLowerCase() === term);
    if (!user) {
      if (term === 'admin') user = CURRENT_USER_ADMIN;
      if (term === 'manager') user = MANAGERS[0];
      if (term === 'new') user = NEW_HIRES[0];
    }
    if (user) {
      setCurrentUser(user);
      setCurrentView(user.role);
      setLoginError(undefined);
    } else {
      setLoginError("We couldn't find an active account with that email or name. Try 'admin', 'manager', or 'new' for testing.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(null);
    setLoginError(undefined);
    setIsSidebarOpen(false);
    setAdminViewMode('dashboard');
  };

  const handleViewSwitch = (view: UserRole) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const renderDashboard = () => {
    if (!currentUser || !currentView) return null;
    switch (currentView) {
      case UserRole.ADMIN:
        return <AdminDashboard user={currentUser} viewMode={adminViewMode} setViewMode={setAdminViewMode} />;
      case UserRole.MANAGER:
        return <ManagerDashboard user={currentUser} />;
      case UserRole.NEW_HIRE:
        return <NewHireDashboard user={currentUser} />;
      default:
        return <div>Unknown View</div>;
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="min-h-screen flex bg-[#013E3F]">
      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#012d2e] border-r border-[#F3EEE7]/5 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-8 border-b border-[#F3EEE7]/5 flex items-center gap-3">
             <img src={INDUSTRIOUS_LOGO_SVG} alt="Industrious Logo" className="h-8 w-auto object-contain opacity-90" />
          </div>
          
          <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar">
             {/* Admin View Navigation Group */}
             {currentUser.role === UserRole.ADMIN && (
               <div className="space-y-1">
                 <p className="px-4 text-[11px] font-bold text-[#F3EEE7]/40 uppercase tracking-[2px] mb-4">Admin Console</p>
                 
                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('dashboard'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'dashboard' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <LayoutDashboard className="w-5 h-5" /> Dashboard
                 </button>

                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('workflow'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'workflow' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <ClipboardList className="w-5 h-5" /> Workflow & Tasks
                 </button>

                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('cohorts'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'cohorts' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <Users className="w-5 h-5" /> New Bees & Cohorts
                 </button>

                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('agenda'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'agenda' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <Calendar className="w-5 h-5" /> Agenda & Presenters
                 </button>

                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('communications'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'communications' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <MessageSquare className="w-5 h-5" /> Communications
                 </button>

                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('engagement'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'engagement' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <PieChart className="w-5 h-5" /> Cohort Engagement
                 </button>

                 <button 
                   onClick={() => { handleViewSwitch(UserRole.ADMIN); setAdminViewMode('settings'); }}
                   className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'settings' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5" /> 
                      Settings & Branding
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${currentView === UserRole.ADMIN && adminViewMode === 'settings' ? 'rotate-90' : 'opacity-40'}`} />
                 </button>
                 
                 <div className="h-4"></div>
               </div>
             )}

             {/* Secondary Views (Preview for Admin, Primary for Manager/Hire) */}
             <p className="px-4 text-[10px] font-bold text-[#F3EEE7]/20 uppercase tracking-[1px] mb-4 mt-8">Unit Views</p>
             
             {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
               <button 
                 onClick={() => handleViewSwitch(UserRole.MANAGER)}
                 className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all mt-1 ${currentView === UserRole.MANAGER ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
               >
                  <Users className="w-5 h-5" /> Manager Overview
               </button>
             )}

             <button 
               onClick={() => handleViewSwitch(UserRole.NEW_HIRE)}
               className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all mt-1 ${currentView === UserRole.NEW_HIRE ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
             >
                <BookOpen className="w-5 h-5" /> {currentUser.role === UserRole.NEW_HIRE ? 'My Journey' : 'New Hire View'}
             </button>
          </nav>

          <div className="p-4 border-t border-[#F3EEE7]/5 bg-[#012526]">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <img src={currentUser.avatar} alt="User" className="w-9 h-9 rounded-full border border-[#F3EEE7]/10" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate text-[#F3EEE7] font-serif">{currentUser.name}</p>
                <p className="text-[10px] text-[#F3EEE7]/40 truncate uppercase tracking-widest">{currentUser.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F3EEE7]/50 hover:text-[#F3EEE7] py-3 rounded transition-colors group"
            >
              <LogOut className="w-3 h-3 group-hover:text-[#FDD344]" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-[#013E3F] border-b border-[#F3EEE7]/10 px-4 py-4 flex items-center justify-between">
           <img src={INDUSTRIOUS_LOGO_SVG} alt="Industrious Logo" className="h-6 w-auto object-contain" />
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-[#F3EEE7]"><Menu /></button>
        </header>

        <div className="hidden lg:flex items-center justify-between px-10 py-6 bg-[#013E3F]">
          <h1 className="text-2xl font-serif font-medium text-[#F3EEE7]">
            {currentView === UserRole.ADMIN && 'Operations Admin Portal'}
            {currentView === UserRole.MANAGER && 'Manager Overview'}
            {currentView === UserRole.NEW_HIRE && 'Onboarding Journey'}
          </h1>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-bold text-[#FDD344] uppercase tracking-widest bg-[#FDD344]/10 px-3 py-1 rounded-full border border-[#FDD344]/20 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-[#FDD344] animate-pulse"></div> {currentUser.email}
             </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:px-10 lg:pb-10 custom-scrollbar">
          {renderDashboard()}
        </main>
      </div>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

export default App;