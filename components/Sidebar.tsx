import React from 'react';
import { UserRole } from '../types';
import type { User } from '../types';
import type { Profile } from '../types/database';
import type { AdminViewMode } from './AdminDashboard';
import ImpersonationPicker from './ImpersonationPicker';
import { LayoutDashboard, Users, BookOpen, LogOut, ClipboardList, Calendar, MessageSquare, PieChart, Settings, ChevronRight, ListTodo } from 'lucide-react';

const INDUSTRIOUS_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 60'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='serif' font-weight='bold' font-size='32' fill='%23F3EEE7' letter-spacing='4'%3EINDUSTRIOUS%3C/text%3E%3C/svg%3E";

interface SidebarProps {
  isOpen: boolean;
  currentUser: User;
  currentView: UserRole | null;
  adminViewMode: AdminViewMode;
  onViewSwitch: (view: UserRole) => void;
  onAdminViewModeChange: (mode: AdminViewMode) => void;
  onLogout: () => void;
  isAdmin?: boolean;
  isImpersonating?: boolean;
  onImpersonate?: (profile: Profile) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentUser, currentView, adminViewMode, onViewSwitch, onAdminViewModeChange, onLogout, isAdmin = false, isImpersonating = false, onImpersonate }) => {
  return (
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#012d2e] border-r border-[#F3EEE7]/5 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col overflow-hidden">
          <div className="p-8 border-b border-[#F3EEE7]/5 flex items-center gap-3">
             <img src={INDUSTRIOUS_LOGO_SVG} alt="Industrious Logo" className="h-8 w-auto object-contain opacity-90" />
          </div>

          <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar">
             {/* Admin View Navigation Group */}
             {currentUser.role === UserRole.ADMIN && (
               <div className="space-y-1">
                 <p className="px-4 text-[11px] font-bold text-[#F3EEE7]/40 uppercase tracking-[2px] mb-4">Admin Console</p>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('dashboard'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'dashboard' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <LayoutDashboard className="w-5 h-5" /> Dashboard
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('workflow'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'workflow' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <ClipboardList className="w-5 h-5" /> People
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('tasks'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'tasks' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <ListTodo className="w-5 h-5" /> Tasks - Student
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('cohorts'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'cohorts' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <Users className="w-5 h-5" /> New Bees & Cohorts
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('agenda'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'agenda' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <Calendar className="w-5 h-5" /> Agenda & Presenters
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('communications'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'communications' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <MessageSquare className="w-5 h-5" /> Communications
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('engagement'); }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'engagement' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <PieChart className="w-5 h-5" /> Cohort Engagement
                 </button>

                 <button
                   onClick={() => { onViewSwitch(UserRole.ADMIN); onAdminViewModeChange('settings'); }}
                   className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all ${currentView === UserRole.ADMIN && adminViewMode === 'settings' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
                 >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5" />
                      Settings
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
                 onClick={() => onViewSwitch(UserRole.MANAGER)}
                 className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all mt-1 ${currentView === UserRole.MANAGER ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
               >
                  <Users className="w-5 h-5" /> Manager Overview
               </button>
             )}

             <button
               onClick={() => onViewSwitch(UserRole.NEW_HIRE)}
               className={`w-full flex items-center gap-3 px-4 py-3.5 rounded text-sm font-medium transition-all mt-1 ${currentView === UserRole.NEW_HIRE ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7] hover:bg-white/5'}`}
             >
                <BookOpen className="w-5 h-5" /> {currentUser.role === UserRole.NEW_HIRE ? 'My Journey' : 'New Hire View'}
             </button>
          </nav>

          <div className="flex-shrink-0 p-4 border-t border-[#F3EEE7]/5 bg-[#012526]">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <img src={currentUser.avatar} alt="User" className="w-9 h-9 rounded-full border border-[#F3EEE7]/10" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate text-[#F3EEE7] font-serif">{currentUser.name}</p>
                <p className="text-[10px] text-[#F3EEE7]/40 truncate uppercase tracking-widest">{currentUser.role}</p>
              </div>
            </div>
            {onImpersonate && (
              <ImpersonationPicker
                onSelectUser={onImpersonate}
                isAdmin={isAdmin}
                isImpersonating={isImpersonating}
              />
            )}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F3EEE7]/50 hover:text-[#F3EEE7] py-3 rounded transition-colors group"
            >
              <LogOut className="w-3 h-3 group-hover:text-[#FDD344]" /> Sign Out
            </button>
          </div>
        </div>
      </aside>
  );
};

export default Sidebar;
