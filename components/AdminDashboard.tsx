import React, { useState, useMemo } from 'react';
import { NewHireProfile, User, CalendarEvent, TrainingModule, UserRole } from '../types';
import { NEW_HIRES, MANAGERS, MOCK_TRAINING_MODULES, MANAGER_ONBOARDING_TASKS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, PieChart as RePieChart, Pie, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts';
import { Mail, Calendar, TrendingUp, CheckCircle, AlertCircle, FileText, Loader2, Wand2, UploadCloud, Video, ArrowRight, X, Users, Plus, Clock, MessageSquare, Zap, PieChart, Settings, Palette, UserCheck, Search, Send, ChevronLeft, ChevronRight, MessageCircle, Globe, AtSign, Filter, BarChart2, MousePointer2, Check, UserMinus, ArrowLeft, Slack, ClipboardCheck, Info, Target, LayoutDashboard, Star, ShieldCheck, UserCog, UserPlus, ZapOff, Activity, History, HelpCircle, FileUp, Building2, UserCircle, Save, Briefcase, RefreshCw, Edit3, BookOpen, Layers, UserPlus2, UserCheck2, HelpCircle as HelpIcon, Timer, ListTodo } from 'lucide-react';
import { analyzeProgress, ExtractedHireData, generateManagerNotification, generateEmailDraft } from '../services/geminiService';
import confetti from 'canvas-confetti';

export type AdminViewMode = 'dashboard' | 'workflow' | 'cohorts' | 'agenda' | 'communications' | 'engagement' | 'settings';

interface AdminDashboardProps {
  user: User;
  viewMode: AdminViewMode;
  setViewMode: (mode: AdminViewMode) => void;
}

const QUESTION_LABELS: Record<string, string> = {
  'principles_script': 'The Heartfelt Hello Script',
  'welcomed_place': 'A place they felt welcomed',
  'welcomed_concrete': 'Why they felt welcomed',
  'welcomed_hard_1': 'Hardest time to welcome (1)',
  'welcomed_hard_2': 'Hardest time to welcome (2)',
  'welcomed_hard_3': 'Hardest time to welcome (3)',
  'orientation_script': 'Orientation "Quickie" Script',
  'orientation_wrong': 'What goes wrong in orientation',
  'orientation_incredible': 'How to make orientation incredible',
  'empowered_most': 'Most empowered member behavior',
  'empowered_least': 'Least empowered member behavior',
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, viewMode, setViewMode }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [workflowSubTab, setWorkflowSubTab] = useState<'upload' | 'manual' | 'edit' | 'training'>('upload');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [manualHire, setManualHire] = useState({ firstName: '', lastName: '', email: '', managerName: '', managerEmail: '', startDate: '', location: '', role: '', hasDirectReports: false });
  const [editingHireId, setEditingHireId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ role: '', managerId: '', email: '', startDate: '' });
  const [trainingData, setTrainingData] = useState({ title: '', description: '', method: 'MANAGER_LED' as TrainingModule['type'], targetRole: 'All Roles', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
  const [messageTarget, setMessageTarget] = useState<'managers' | 'newhires'>('newhires');
  const [messageSearch, setMessageSearch] = useState('');
  const [commsDraft, setCommsDraft] = useState('');
  const [activeCommsAction, setActiveCommsAction] = useState<'email' | 'slack' | 'survey' | null>(null);
  const [selectedUserForComms, setSelectedUserForComms] = useState<User | null>(null);
  const [sendingComms, setSendingComms] = useState(false);
  const [showEnrolledDrilldown, setShowEnrolledDrilldown] = useState(false);
  const [enrolledFilter, setEnrolledFilter] = useState<'summary' | 'onTrack' | 'behind'>('summary');
  const [selectedRegionName, setSelectedRegionName] = useState<string | null>(null);
  const [selectedCohortManager, setSelectedCohortManager] = useState<User | null>(null);
  const [cohortsSearch, setCohortsSearch] = useState('');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 0, 1));
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // New states for Hire Drilldown in Cohorts View
  const [selectedHireForDrilldown, setSelectedHireForDrilldown] = useState<NewHireProfile | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<'overview' | 'workbook' | 'tracker'>('overview');
  
  // Historical Metric View
  const [managerMetricMode, setManagerMetricMode] = useState<'snapshot' | 'history'>('snapshot');

  const [events, setEvents] = useState<CalendarEvent[]>([
    { 
      id: 'evt-1', 
      title: 'Cohort 1: Welcome Kickoff', 
      date: '2026-01-05T10:00:00', 
      attendees: ['All New Hires'], 
      link: 'hangouts.google.com/meet/abc',
      presenters: [{ name: 'Sarah Operations', confirmed: true }, { name: 'Kevin Jung', confirmed: true }]
    },
    { 
      id: 'evt-2', 
      title: 'Ops Systems Q&A', 
      date: '2026-01-07T14:00:00', 
      attendees: ['MxMs', 'Ops Associates'], 
      link: 'hangouts.google.com/meet/xyz',
      presenters: [{ name: 'Elena Supervisor', confirmed: false }]
    },
    { 
      id: 'evt-3', 
      title: 'National Ops All Hands', 
      date: '2026-01-09T11:00:00', 
      attendees: ['All Staff'], 
      link: 'hangouts.google.com/meet/national',
      presenters: [{ name: 'Sarah Operations', confirmed: true }, { name: 'Justin CEO', confirmed: false }]
    },
  ]);

  const isHireBehind = (h: NewHireProfile) => h.progress < 25 || h.modules.some(m => !m.completed && new Date(m.dueDate) < new Date());

  const regionalData = useMemo(() => {
    const regions = ['East', 'West', 'Central'];
    return regions.map(name => {
      const managersInRegion = MANAGERS.filter(m => m.region === name);
      const managerIds = managersInRegion.map(m => m.id);
      const hires = NEW_HIRES.filter(h => managerIds.includes(h.managerId));
      const behind = hires.filter(isHireBehind).length;
      return { name, enrolled: hires.length, behind, onTrack: hires.length - behind, managers: managersInRegion, hiresList: hires };
    });
  }, []);

  const getManagerStats = (managerId: string) => {
    const hires = NEW_HIRES.filter(h => h.managerId === managerId);
    if (hires.length === 0) return { avgProgress: 0, behind: 0, onTrack: 0, followUps: 0, responseTime: 'N/A', loginFrequency: '0x/week' };
    const avgProgress = Math.round(hires.reduce((acc, h) => acc + h.progress, 0) / hires.length);
    const behind = hires.filter(isHireBehind).length;
    const hash = managerId.length;
    return { avgProgress, behind, onTrack: hires.length - behind, followUps: (hash * 3) % 25, responseTime: `< ${(hash % 12) + 1}h`, loginFrequency: `${(hash % 5) + 2}.2x/week` };
  };

  // Generate Mock History for Charts
  const getHistoricalData = (managerId: string) => {
    const stats = getManagerStats(managerId);
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    return weeks.map((w, i) => ({
      name: w,
      avgProgress: Math.max(0, stats.avgProgress - (15 * (3 - i))),
      interactions: Math.max(2, stats.followUps - (2 * (3 - i))),
      responseTime: Math.min(24, (managerId.length % 12) + (3 - i) * 2),
      logins: Math.max(1, (managerId.length % 5) + i),
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessingFile(true);
      setTimeout(() => { setIsProcessingFile(false); setImportSuccess(true); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }, 2000);
    }
  };

  const handleManualHireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newHireObj: NewHireProfile = {
      id: `nh-${Date.now()}`,
      name: `${manualHire.firstName} ${manualHire.lastName}`,
      email: manualHire.email,
      role: UserRole.NEW_HIRE,
      title: manualHire.role,
      avatar: `https://ui-avatars.com/api/?name=${manualHire.firstName}+${manualHire.lastName}&background=013E3F&color=F3EEE7`,
      managerId: 'mgr-1',
      startDate: manualHire.startDate,
      progress: 0,
      department: 'Operations',
      modules: [...MOCK_TRAINING_MODULES],
      managerTasks: MANAGER_ONBOARDING_TASKS.map(t => ({ ...t, completed: false })),
    };
    NEW_HIRES.push(newHireObj);
    alert(`Success: ${newHireObj.name} created.`);
    setManualHire({ firstName: '', lastName: '', email: '', managerName: '', managerEmail: '', startDate: '', location: '', role: '', hasDirectReports: false });
  };

  const handleUpdateHire = (e: React.FormEvent) => {
    e.preventDefault();
    const hire = NEW_HIRES.find(h => h.id === editingHireId);
    if (hire) {
      hire.title = editFormData.role; hire.managerId = editFormData.managerId; hire.email = editFormData.email; hire.startDate = editFormData.startDate;
      alert("Updates saved."); setEditingHireId(null);
    }
  };

  const handleAddTraining = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Training "${trainingData.title}" created.`);
    setTrainingData({ title: '', description: '', method: 'MANAGER_LED', targetRole: 'All Roles', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
  };

  const startEditingHire = (hire: NewHireProfile) => {
    setEditingHireId(hire.id);
    setEditFormData({ role: hire.title, managerId: hire.managerId, email: hire.email, startDate: hire.startDate });
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const result = await analyzeProgress(NEW_HIRES);
    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const handleSyncCalendar = () => {
    setIsSyncingCalendar(true);
    setTimeout(() => {
      setIsSyncingCalendar(false);
      setLastSyncedAt(new Date().toLocaleTimeString());
      confetti({
        particleCount: 50,
        spread: 30,
        origin: { y: 0.2 },
        colors: ['#FDD344']
      });
      alert('Unit Ops-Comms Calendar Synced Successfully!');
    }, 1800);
  };

  const handleInitiateComms = async (targetUser: User, type: 'email' | 'slack' | 'survey') => {
    setSelectedUserForComms(targetUser);
    setActiveCommsAction(type);
    setSendingComms(true);
    setCommsDraft('');

    if (type === 'survey') {
      setCommsDraft(`Hi ${targetUser.name.split(' ')[0]},\n\nWe'd love to get your feedback on your first week at Industrious. Please take a moment to fill out this short satisfaction survey: [Link to Survey]\n\nYour feedback helps us improve the flight school experience for everyone!\n\nBest,\nIndustrious Operations`);
      setSendingComms(false);
      return;
    }

    try {
      const hireProfile = NEW_HIRES.find(h => h.id === targetUser.id);
      const progress = hireProfile?.progress || 0;
      const overdueItems = hireProfile?.modules
        .filter(m => !m.completed && new Date(m.dueDate) < new Date())
        .map(m => m.title) || [];

      const draft = await generateEmailDraft(
        targetUser.name,
        user.name,
        progress,
        type === 'email' ? 'Onboarding progress update' : 'Quick check-in on Slack',
        overdueItems
      );
      setCommsDraft(draft);
    } catch (error) {
      console.error("Error drafting comms:", error);
      setCommsDraft("Error generating draft. Please try again or draft manually.");
    } finally {
      setSendingComms(false);
    }
  };

  const renderMonthCalendarDays = () => {
    const daysInMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-32 bg-[#F3EEE7]/10 border-r border-b border-[#013E3F]/10"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date.startsWith(dateStr));
      days.push(
        <div key={day} className="h-32 bg-white border-r border-b border-[#013E3F]/10 p-2 relative hover:bg-[#F3EEE7]/5">
          <span className="text-xs font-bold text-[#013E3F]/50 absolute top-2 left-2">{day}</span>
          <div className="mt-5 space-y-1 overflow-y-auto max-h-[100px]">
            {dayEvents.map(event => (
              <div key={event.id} className="text-[9px] p-1 rounded bg-[#dcfce7] text-[#166534] border-l-2 border-[#166534] truncate">{event.title}</div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  const behindEmployees = useMemo(() => NEW_HIRES.filter(isHireBehind), []);
  const enrolledCount = NEW_HIRES.length;
  const avgCompletion = Math.round(NEW_HIRES.reduce((a,c) => a + c.progress, 0) / NEW_HIRES.length);
  const behindCount = behindEmployees.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="border-b border-[#F3EEE7]/10 pb-6">
          <h2 className="text-3xl font-medium text-[#F3EEE7] font-serif">
            {viewMode === 'dashboard' && 'Operations Dashboard'}
            {viewMode === 'workflow' && 'Workflow & Tasks'}
            {viewMode === 'cohorts' && 'New Bees & Cohorts'}
            {viewMode === 'agenda' && 'Agenda & Presenters'}
            {viewMode === 'communications' && 'Communications'}
            {viewMode === 'engagement' && 'Cohort Engagement'}
            {viewMode === 'settings' && 'Settings & Branding'}
          </h2>
          <p className="text-[#F3EEE7]/70 mt-2 font-light text-lg">
            {viewMode === 'dashboard' && 'High-level status of Industrious onboarding.'}
            {viewMode === 'workflow' && 'Import team members, manage active registry, and automate training.'}
            {viewMode === 'cohorts' && 'Regional performance and manager drill-downs.'}
          </p>
      </div>

      {/* DASHBOARD VIEW */}
      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
           <div className="bg-white p-8 rounded-xl shadow-sm border border-[#013E3F]/5">
              <h3 className="font-serif text-xl text-[#013E3F] mb-6">Pipeline Health</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div onClick={() => { setEnrolledFilter('summary'); setShowEnrolledDrilldown(true); }} className="p-4 bg-[#F3EEE7] rounded-lg cursor-pointer hover:bg-[#FDD344]/10 transition-colors border border-transparent hover:border-[#FDD344]/30">
                    <span className="text-[10px] uppercase font-bold text-[#013E3F]/40 group-hover:text-[#013E3F]">Active Hires</span>
                    <div className="text-2xl font-serif text-[#013E3F] flex justify-between">{enrolledCount} <ChevronRight className="w-4 h-4 opacity-30" /></div>
                 </div>
                 <div className="p-4 bg-[#F3EEE7] rounded-lg"><span className="text-[10px] uppercase font-bold text-[#013E3F]/40">Avg Progress</span><div className="text-2xl font-serif text-[#013E3F]">{avgCompletion}%</div></div>
                 <div className="p-4 bg-[#F3EEE7] rounded-lg col-span-2 text-red-500"><span className="text-[10px] uppercase font-bold text-[#013E3F]/40">At Risk (Overdue)</span><div className="text-2xl font-serif">{behindCount}</div></div>
              </div>
           </div>
           <div className="bg-[#013E3F] border border-[#F3EEE7]/10 p-8 rounded-xl relative overflow-hidden text-[#F3EEE7]">
              <h3 className="font-serif text-xl flex items-center gap-2 mb-4"><Wand2 className="w-5 h-5 text-[#FDD344]" /> AI Progress Intelligence</h3>
              <div className="bg-[#002b2c] p-6 rounded-lg text-sm leading-relaxed italic">{analyzing ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /> : analysisResult || "Request a regional analysis to see performance trends across cohorts."}</div>
              {!analysisResult && <button onClick={handleAnalyze} className="mt-4 bg-[#FDD344] text-[#013E3F] px-8 py-3 rounded text-xs font-bold uppercase tracking-wide">Execute Analysis</button>}
           </div>
        </div>
      )}

      {/* WORKFLOW VIEW */}
      {viewMode === 'workflow' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           <div className="flex bg-[#012d2e] p-1 rounded-xl shadow-inner border border-[#F3EEE7]/10 w-fit overflow-x-auto">
              {[
                { id: 'upload', label: 'Workday Import', icon: FileUp },
                { id: 'manual', label: 'New Team Member', icon: UserPlus2 },
                { id: 'edit', label: 'Team Registry', icon: UserCog },
                { id: 'training', label: 'Upload Training', icon: BookOpen }
              ].map(tab => (
                <button 
                  key={tab.id} onClick={() => setWorkflowSubTab(tab.id as any)}
                  className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${workflowSubTab === tab.id ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7]'}`}
                >
                   <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
           </div>

           {/* 1. WORKDAY UPLOAD */}
           {workflowSubTab === 'upload' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-2xl shadow-lg border border-[#013E3F]/10 text-center flex flex-col items-center justify-center min-h-[400px]">
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${isProcessingFile ? 'bg-amber-100 text-amber-600 animate-pulse' : importSuccess ? 'bg-green-100 text-green-600' : 'bg-[#F3EEE7] text-[#013E3F]/40'}`}>
                      {isProcessingFile ? <Loader2 className="w-10 h-10 animate-spin" /> : importSuccess ? <CheckCircle className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
                   </div>
                   <h3 className="text-2xl font-serif text-[#013E3F] mb-4">Workday Automation</h3>
                   <p className="text-[#013E3F]/60 max-w-sm mx-auto mb-8 leading-relaxed text-sm font-medium">
                     Upload your Workday New Hire Report (CSV or Excel) to automatically create member profiles and link them to managers. This triggers regional roadmap assignments and identity verification.
                   </p>
                   {importSuccess ? <button onClick={() => setImportSuccess(false)} className="text-[#013E3F] font-bold text-xs underline">Upload another report</button> : <div className="relative group"><input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileUpload} disabled={isProcessingFile} /><button className="bg-[#013E3F] text-white px-12 py-4 rounded-xl font-bold uppercase text-xs flex items-center gap-3">Select Workday Report <FileText className="w-4 h-4" /></button></div>}
                </div>
                <div className="bg-[#F3EEE7]/20 border border-[#F3EEE7]/10 p-8 rounded-2xl">
                   <h4 className="text-xs font-bold uppercase tracking-[2px] text-[#FDD344] mb-6 flex items-center gap-2"><Info className="w-4 h-4" /> Import Logic</h4>
                   <div className="space-y-4">
                      {[
                        { title: 'Identity Verification', desc: 'New hires are identified by their official Workday email address and mapped to their Flight School profile.' },
                        { title: 'Management Mapping', desc: 'System automatically assigns the supervisor listed in the "Superior" column as the manager in Flight School.' },
                        { title: 'Regional Automation', desc: 'Location, Unit, and regional cohort assignments are synced based on the "Unit Assignment" column.' }
                      ].map((item, idx) => (
                        <div key={idx} className="flex gap-4">
                           <div className="w-5 h-5 shrink-0 rounded-full bg-[#013E3F]/10 flex items-center justify-center text-[10px] font-bold text-[#013E3F]">{idx+1}</div>
                           <div><p className="text-xs font-bold text-[#F3EEE7]">{item.title}</p><p className="text-xs text-[#F3EEE7]/50 mt-1">{item.desc}</p></div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}

           {/* 2. NEW TEAM MEMBER (Creation Tool) */}
           {workflowSubTab === 'manual' && (
             <div className="bg-[#012d2e] rounded-2xl shadow-xl border border-[#F3EEE7]/10 overflow-hidden">
                <div className="p-8 bg-[#001f20] text-[#F3EEE7] border-b border-[#F3EEE7]/5">
                   <div className="flex items-center gap-4 mb-4"><div className="p-3 bg-[#FDD344] rounded-lg text-[#013E3F]"><UserPlus2 className="w-6 h-6" /></div><div><h3 className="text-3xl font-serif">Creation Tool: New Team Member</h3><p className="text-[#FDD344] text-xs font-bold uppercase tracking-widest mt-1">Manual system bypass</p></div></div>
                   <div className="p-4 bg-[#F3EEE7]/5 rounded-lg border border-[#F3EEE7]/10">
                      <p className="text-sm leading-relaxed text-[#F3EEE7]/80 italic"><strong>Distinction:</strong> Use this page to add someone brand new who does not yet exist in the system. This form triggers the initial identity verification and regional roadmap automation.</p>
                   </div>
                </div>
                <form onSubmit={handleManualHireSubmit} className="p-10 space-y-12 text-[#F3EEE7]">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      <div className="space-y-6">
                         <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Hire Identity</h4>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">First Name</label><input required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.firstName} onChange={e => setManualHire({...manualHire, firstName: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Last Name</label><input required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.lastName} onChange={e => setManualHire({...manualHire, lastName: e.target.value})} /></div>
                         </div>
                         <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Email</label><input type="email" required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.email} onChange={e => setManualHire({...manualHire, email: e.target.value})} /></div>
                         <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Role</label><input required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.role} onChange={e => setManualHire({...manualHire, role: e.target.value})} /></div>
                      </div>
                      <div className="space-y-6">
                         <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Logistics</h4>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Manager Name</label><input required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.managerName} onChange={e => setManualHire({...manualHire, managerName: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Manager Email</label><input type="email" required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.managerEmail} onChange={e => setManualHire({...manualHire, managerEmail: e.target.value})} /></div>
                         </div>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Start Date</label><input type="date" required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.startDate} onChange={e => setManualHire({...manualHire, startDate: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Location</label><input required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.location} onChange={e => setManualHire({...manualHire, location: e.target.value})} /></div>
                         </div>
                         <div className="flex items-center gap-4 pt-4"><button type="button" onClick={() => setManualHire({...manualHire, hasDirectReports: !manualHire.hasDirectReports})} className={`w-12 h-6 rounded-full relative flex items-center transition-colors ${manualHire.hasDirectReports ? 'bg-green-600' : 'bg-[#F3EEE7]/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${manualHire.hasDirectReports ? 'translate-x-6' : 'translate-x-1'}`} /></button><span className="text-xs font-bold text-[#F3EEE7]/70">This hire has direct reports</span></div>
                      </div>
                   </div>
                   <div className="pt-8 border-t border-[#F3EEE7]/10 flex justify-end"><button type="submit" className="bg-[#FDD344] text-[#013E3F] px-12 py-3 rounded-xl font-bold uppercase text-xs">Create Member Profile</button></div>
                </form>
             </div>
           )}

           {/* 3. TEAM REGISTRY (Management Tool) */}
           {workflowSubTab === 'edit' && (
             <div className="bg-white rounded-2xl shadow-xl border border-[#013E3F]/10 overflow-hidden">
                <div className="p-8 bg-[#F3EEE7] border-b border-[#013E3F]/10">
                   <h3 className="text-3xl font-serif text-[#013E3F]">Management Tool: Team Registry</h3>
                   <p className="text-sm italic text-[#013E3F]/60 mt-4 leading-relaxed"><strong>Distinction:</strong> Use this page to update details for active team members already in the system. Edit their role, manager, or organizational details when changes occur.</p>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-[#F9F7F5] text-[#013E3F]/40 text-[10px] uppercase font-bold tracking-widest border-b"><tr><th className="px-8 py-4">Employee</th><th className="px-8 py-4">Current Manager</th><th className="px-8 py-4">Start Date</th><th className="px-8 py-4 text-right">Edit</th></tr></thead><tbody className="divide-y divide-[#F3EEE7]">{NEW_HIRES.map(hire => (<tr key={hire.id} className="hover:bg-[#F9F7F5] transition-colors"><td className="px-8 py-5 flex items-center gap-3"><img src={hire.avatar} className="w-10 h-10 rounded-full" /><div><p className="font-serif font-bold text-[#013E3F]">{hire.name}</p><p className="text-[10px] uppercase text-[#013E3F]/40 tracking-wider">{hire.title}</p></div></td><td className="px-8 py-5 text-xs font-bold text-[#013E3F]/60">{MANAGERS.find(m => m.id === hire.managerId)?.name}</td><td className="px-8 py-5 text-xs text-[#013E3F]/60">{hire.startDate}</td><td className="px-8 py-5 text-right"><button onClick={() => startEditingHire(hire)} className="p-2 hover:bg-[#013E3F]/5 rounded-lg text-[#013E3F]/40 hover:text-[#013E3F]"><Edit3 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div>
             </div>
           )}

           {/* 4. CURRICULUM BUILDER */}
           {workflowSubTab === 'training' && (
             <div className="bg-[#012d2e] rounded-2xl shadow-xl border border-[#F3EEE7]/10 overflow-hidden">
                <div className="p-10 bg-[#001f20] text-[#F3EEE7] border-b border-[#F3EEE7]/5 flex items-center justify-between"><div><h3 className="text-3xl font-serif">Curriculum Module Builder</h3><p className="text-[#FDD344] text-xs font-bold uppercase tracking-widest mt-1">Multi-method training mapping</p></div><Layers className="w-10 h-10 opacity-20" /></div>
                <form onSubmit={handleAddTraining} className="p-10 space-y-12 text-[#F3EEE7]">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-8">
                         <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Structure</h4>
                         <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Module Title</label><input required className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" placeholder="Member Crisis Resolution" value={trainingData.title} onChange={e => setTrainingData({...trainingData, title: e.target.value})} /></div>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Method</label><select className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm" value={trainingData.method} onChange={e => setTrainingData({...trainingData, method: e.target.value as any})}><option value="MANAGER_LED">Manager Led</option><option value="LESSONLY">Lessonly</option><option value="WORKBOOK">Self-Led Workbook</option><option value="LIVE_CALL">Hosted Training</option><option value="PERFORM">Perform (#Ownership)</option><option value="PEER_PARTNER">Peer Partner</option></select></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Day Offset</label><input type="number" className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm" value={trainingData.assignmentDay} onChange={e => setTrainingData({...trainingData, assignmentDay: parseInt(e.target.value)})} /></div>
                         </div>
                      </div>
                      <div className="space-y-8">
                         <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Targeting</h4>
                         <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Target Role</label><select className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm" value={trainingData.targetRole} onChange={e => setTrainingData({...trainingData, targetRole: e.target.value})}><option>All Roles</option><option>Assistant General Manager</option><option>Regional Director</option><option>MXA</option><option>MXM</option></select></div>
                         <div className="p-6 bg-[#F3EEE7]/5 rounded-xl border border-[#F3EEE7]/10 space-y-6"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BookOpen className="w-4 h-4" /><p className="text-xs font-bold uppercase">Workbook Prompt</p></div><button type="button" onClick={() => setTrainingData({...trainingData, hasWorkbook: !trainingData.hasWorkbook})} className={`w-12 h-6 rounded-full relative flex items-center transition-colors ${trainingData.hasWorkbook ? 'bg-green-600' : 'bg-[#F3EEE7]/20'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${trainingData.hasWorkbook ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>{trainingData.hasWorkbook && <textarea className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-4 text-sm focus:border-[#FDD344] outline-none h-24" placeholder="Enter reflection question..." value={trainingData.workbookContent} onChange={e => setTrainingData({...trainingData, workbookContent: e.target.value})} />}</div>
                      </div>
                   </div>
                   <div className="pt-8 border-t border-[#F3EEE7]/10 flex justify-end"><button type="submit" className="bg-[#FDD344] text-[#013E3F] px-12 py-3 rounded-xl font-bold uppercase text-xs">Assign Resource</button></div>
                </form>
             </div>
           )}
        </div>
      )}

      {/* NEW BEES & COHORTS VIEW */}
      {viewMode === 'cohorts' && (
        <div className="animate-in fade-in duration-300 space-y-8">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F3EEE7]/40">
                 <button onClick={() => { setSelectedRegionName(null); setSelectedCohortManager(null); }} className="hover:text-[#FDD344] transition-colors">All Regions</button>
                 {selectedRegionName && (<><ChevronRight className="w-3 h-3" /><button onClick={() => { setSelectedCohortManager(null); }} className="hover:text-[#FDD344] transition-colors">{selectedRegionName} Region</button></>)}
                 {selectedCohortManager && (<><ChevronRight className="w-3 h-3" /><span className="text-[#FDD344]">{selectedCohortManager.name}</span></>)}
              </div>
              <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F3EEE7]/30" /><input type="text" placeholder="Search cohorts..." className="w-full bg-[#012d2e] border border-[#F3EEE7]/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#F3EEE7] focus:outline-none" value={cohortsSearch} onChange={e => setCohortsSearch(e.target.value)} /></div>
           </div>

           {!selectedRegionName ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {regionalData.map(region => (
                    <div key={region.name} onClick={() => { setSelectedRegionName(region.name); }} className="bg-white p-8 rounded-2xl shadow-sm border border-[#013E3F]/10 cursor-pointer hover:border-[#FDD344] transition-all group overflow-hidden relative">
                       <h3 className="font-serif text-2xl text-[#013E3F] mb-6 flex items-center justify-between">{region.name} Region <ArrowRight className="w-5 h-5 opacity-20 group-hover:opacity-100" /></h3>
                       <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#F3EEE7]"><div className="text-center p-3 bg-green-50 rounded-xl"><p className="text-[10px] font-bold text-green-700">On Track</p><p className="text-xl font-serif text-green-800">{region.onTrack}</p></div><div className="text-center p-3 bg-red-50 rounded-xl"><p className="text-[10px] font-bold text-red-700">At Risk</p><p className="text-xl font-serif text-red-800">{region.behind}</p></div></div>
                    </div>
                 ))}
              </div>
           ) : !selectedCohortManager ? (
              <div className="bg-white rounded-2xl shadow-sm border border-[#013E3F]/10 overflow-hidden"><table className="w-full text-left"><thead className="bg-[#F3EEE7] text-[#013E3F]/40 text-[10px] uppercase font-bold tracking-widest border-b"><tr><th className="px-8 py-4">Manager</th><th className="px-8 py-4">Region</th><th className="px-8 py-4">Status</th><th className="px-8 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#F3EEE7]">{MANAGERS.filter(m => m.region === selectedRegionName).map(mgr => { const stats = getManagerStats(mgr.id); return (<tr key={mgr.id} className="hover:bg-[#F9F7F5] transition-colors"><td className="px-8 py-4 flex items-center gap-3"><img src={mgr.avatar} className="w-10 h-10 rounded-full" /><p className="font-bold text-[#013E3F]">{mgr.name}</p></td><td className="px-8 py-4 text-xs font-medium text-[#013E3F]/60 uppercase">{mgr.region}</td><td className="px-8 py-4"><span className="text-xs font-bold text-green-600">{stats.onTrack} On Track</span> / <span className="text-xs font-bold text-red-600">{stats.behind} At Risk</span></td><td className="px-8 py-4 text-right"><button onClick={() => setSelectedCohortManager(mgr)} className="text-[10px] font-bold uppercase bg-[#013E3F] text-white px-4 py-2 rounded-lg">View Cohort</button></td></tr>); })}</tbody></table></div>
           ) : (
              <div className="space-y-8 animate-in slide-in-from-bottom-4">
                 <div className="bg-[#013E3F] text-[#F3EEE7] p-8 rounded-2xl border border-[#F3EEE7]/10 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="flex items-center gap-8 z-10">
                      <img src={selectedCohortManager.avatar} className="w-24 h-24 rounded-full border-4 border-[#FDD344]" />
                      <div>
                         <button onClick={() => setSelectedCohortManager(null)} className="text-xs font-bold uppercase text-[#FDD344] mb-2 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Managers</button>
                         <h3 className="font-serif text-4xl">{selectedCohortManager.name}</h3>
                         <p className="text-xs font-bold opacity-50 uppercase tracking-widest">{selectedCohortManager.title} • {selectedCohortManager.region} Region</p>
                      </div>
                    </div>
                    
                    {/* Mode Toggle */}
                    <div className="z-10 flex bg-white/10 p-1 rounded-xl border border-white/10">
                      <button 
                        onClick={() => setManagerMetricMode('snapshot')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${managerMetricMode === 'snapshot' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}
                      >
                        <LayoutDashboard className="w-4 h-4" /> Snapshot
                      </button>
                      <button 
                        onClick={() => setManagerMetricMode('history')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${managerMetricMode === 'history' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}
                      >
                        <History className="w-4 h-4" /> History
                      </button>
                    </div>

                    <div className="absolute right-0 top-0 w-64 h-full bg-[#FDD344]/5 skew-x-[-15deg] translate-x-20"></div>
                 </div>

                 {/* METRIC EXPLANATION BLOCK */}
                 <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 flex flex-col md:flex-row items-center gap-6 shadow-sm">
                    <div className="shrink-0 w-12 h-12 bg-[#F3EEE7] rounded-full flex items-center justify-center text-[#013E3F]"><HelpIcon className="w-6 h-6" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-[11px] leading-relaxed">
                       <div><p className="font-bold uppercase text-[#013E3F] mb-1">Avg Progress</p><p className="text-[#013E3F]/60 italic">Weighted completion percentage across all assigned modules.</p></div>
                       <div><p className="font-bold uppercase text-[#013E3F] mb-1">Interactions</p><p className="text-[#013E3F]/60 italic">Count of manager-led debriefs and manual sign-offs in the registry.</p></div>
                       <div><p className="font-bold uppercase text-[#013E3F] mb-1">At-Risk Response</p><p className="text-[#013E3F]/60 italic">Average time taken for a manager to acknowledge an overdue task.</p></div>
                       <div><p className="font-bold uppercase text-[#013E3F] mb-1">Logins</p><p className="text-[#013E3F]/60 italic">Frequency of portal activity relative to the current onboarding week.</p></div>
                    </div>
                 </div>

                 {/* Conditional Content Based on Mode */}
                 {managerMetricMode === 'snapshot' ? (
                   <>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                       {(() => { 
                         const stats = getManagerStats(selectedCohortManager.id); 
                         return (
                           <>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">Avg Progress</p><p className="text-3xl font-serif text-[#013E3F]">{stats.avgProgress}%</p></div>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">Interactions</p><p className="text-3xl font-serif text-[#013E3F]">{stats.followUps}</p></div>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">At-Risk Response</p><p className="text-3xl font-serif text-[#013E3F]">{stats.responseTime}</p></div>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">Logins</p><p className="text-3xl font-serif text-[#013E3F]">{stats.loginFrequency}</p></div>
                           </>
                         ); 
                       })()}
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       {NEW_HIRES.filter(h => h.managerId === selectedCohortManager.id).map(hire => (
                         <div key={hire.id} onClick={() => setSelectedHireForDrilldown(hire)} className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 hover:border-[#FDD344] transition-all group cursor-pointer shadow-sm relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-4"><img src={hire.avatar} className="w-12 h-12 rounded-full border border-[#013E3F]/10" /><div><h4 className="font-bold text-[#013E3F] text-lg leading-tight group-hover:text-[#FDD344] transition-colors">{hire.name}</h4><p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{hire.title}</p></div></div><div className="w-full bg-[#F3EEE7] h-2 rounded-full overflow-hidden mb-3"><div className={`h-full transition-all duration-500 ${isHireBehind(hire) ? 'bg-red-400' : 'bg-[#013E3F]'}`} style={{ width: `${hire.progress}%` }} /></div><div className="flex justify-between items-center"><div className="flex flex-col"><span className="text-[10px] font-bold uppercase opacity-30">Completion</span><span className="font-serif font-bold text-[#013E3F]">{hire.progress}%</span></div><button className="text-[9px] font-bold uppercase tracking-widest text-[#013E3F]/40 group-hover:text-[#013E3F] flex items-center gap-1">View Profile <ArrowRight className="w-3 h-3" /></button></div><div className="absolute right-0 top-0 w-24 h-24 bg-[#FDD344]/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-500"></div>
                         </div>
                       ))}
                     </div>
                   </>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                      {/* Trend Charts */}
                      {[
                        { key: 'avgProgress', label: 'Avg. Progress Trend (%)', color: '#013E3F', suffix: '%' },
                        { key: 'interactions', label: 'Monthly Interactions', color: '#FDD344', suffix: '' },
                        { key: 'responseTime', label: 'At-Risk Response (Hours)', color: '#EF4444', suffix: 'h' },
                        { key: 'logins', label: 'Weekly Logins', color: '#3B82F6', suffix: 'x' }
                      ].map(metric => (
                        <div key={metric.key} className="bg-white p-8 rounded-2xl border border-[#013E3F]/10 shadow-sm h-[320px] flex flex-col">
                           <h4 className="font-serif text-lg text-[#013E3F] mb-6 flex items-center justify-between">
                             {metric.label}
                             <TrendingUp className="w-4 h-4 opacity-30" />
                           </h4>
                           <div className="flex-1 min-h-0">
                              <ResponsiveContainer width="100%" height="100%">
                                 <AreaChart data={getHistoricalData(selectedCohortManager.id)}>
                                    <defs>
                                       <linearGradient id={`grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={metric.color} stopOpacity={0.2}/>
                                          <stop offset="95%" stopColor={metric.color} stopOpacity={0}/>
                                       </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#013E3F40'}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#013E3F40'}} unit={metric.suffix} />
                                    <Tooltip 
                                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                       cursor={{ stroke: metric.color, strokeWidth: 1 }}
                                    />
                                    <Area type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={3} fillOpacity={1} fill={`url(#grad-${metric.key})`} />
                                 </AreaChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           )}
        </div>
      )}

      {/* NEW HIRE DRILLDOWN MODAL */}
      {selectedHireForDrilldown && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#013E3F]/80 backdrop-blur-md">
           <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="p-8 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex justify-between items-center">
                 <div className="flex items-center gap-5">
                    <img src={selectedHireForDrilldown.avatar} className="w-16 h-16 rounded-full border-2 border-white shadow-md" alt="" />
                    <div>
                       <h3 className="font-serif text-3xl text-[#013E3F]">{selectedHireForDrilldown.name}</h3>
                       <p className="text-xs font-bold uppercase text-[#013E3F]/40 tracking-[2px]">{selectedHireForDrilldown.title} • Joined {new Date(selectedHireForDrilldown.startDate).toLocaleDateString()}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedHireForDrilldown(null)} className="p-3 hover:bg-white rounded-full transition-colors">
                    <X className="w-6 h-6 text-[#013E3F]" />
                 </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#013E3F]/5 bg-white px-8">
                 {[
                    { id: 'overview', label: 'Progress Overview', icon: LayoutDashboard },
                    { id: 'workbook', label: 'Workbook Responses', icon: BookOpen },
                    { id: 'tracker', label: 'Manager Checklist', icon: ListTodo }
                 ].map(tab => (
                    <button 
                       key={tab.id}
                       onClick={() => setDrilldownTab(tab.id as any)}
                       className={`py-4 px-6 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${drilldownTab === tab.id ? 'border-[#013E3F] text-[#013E3F]' : 'border-transparent text-[#013E3F]/30 hover:text-[#013E3F]/60'}`}
                    >
                       <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                 ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 bg-[#F9F7F5] custom-scrollbar">
                 {drilldownTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#013E3F]/5">
                             <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 mb-1">Total Completion</p>
                             <div className="flex items-end gap-2">
                                <span className="text-4xl font-serif text-[#013E3F]">{selectedHireForDrilldown.progress}%</span>
                                <span className="text-[10px] font-bold text-green-600 mb-1.5">+12% vs last week</span>
                             </div>
                          </div>
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#013E3F]/5">
                             <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 mb-1">Pending Modules</p>
                             <div className="flex items-end gap-2">
                                <span className="text-4xl font-serif text-[#013E3F]">{selectedHireForDrilldown.modules.filter(m => !m.completed).length}</span>
                                <span className="text-[10px] font-bold text-[#013E3F]/30 mb-1.5">of {selectedHireForDrilldown.modules.length} total</span>
                             </div>
                          </div>
                          <div className="bg-white p-5 rounded-xl shadow-sm border border-[#013E3F]/5">
                             <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 mb-1">At Risk Tasks</p>
                             <div className="flex items-end gap-2">
                                <span className={`text-4xl font-serif ${isHireBehind(selectedHireForDrilldown) ? 'text-red-500' : 'text-green-600'}`}>
                                   {selectedHireForDrilldown.modules.filter(m => !m.completed && new Date(m.dueDate) < new Date()).length}
                                </span>
                             </div>
                          </div>
                       </div>

                       <div className="bg-white rounded-2xl border border-[#013E3F]/10 overflow-hidden">
                          <table className="w-full text-left">
                             <thead className="bg-[#F3EEE7] text-[#013E3F]/40 text-[10px] uppercase font-bold tracking-widest border-b">
                                <tr>
                                   <th className="px-6 py-4">Module Name</th>
                                   <th className="px-6 py-4">Type</th>
                                   <th className="px-6 py-4">Due Date</th>
                                   <th className="px-6 py-4 text-right">Status</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-[#F3EEE7]">
                                {selectedHireForDrilldown.modules.map(module => (
                                   <tr key={module.id} className="hover:bg-[#F9F7F5] transition-colors">
                                      <td className="px-6 py-4">
                                         <p className="font-bold text-[#013E3F] text-sm">{module.title}</p>
                                      </td>
                                      <td className="px-6 py-4">
                                         <span className="text-[9px] font-bold uppercase text-[#013E3F]/50">{module.type.replace('_', ' ')}</span>
                                      </td>
                                      <td className="px-6 py-4">
                                         <p className={`text-xs font-medium ${!module.completed && new Date(module.dueDate) < new Date() ? 'text-red-500 font-bold' : 'text-[#013E3F]/60'}`}>
                                            {new Date(module.dueDate).toLocaleDateString()}
                                         </p>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                         {module.completed ? (
                                            <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">Complete</span>
                                         ) : (
                                            <span className="text-[10px] font-bold uppercase text-[#013E3F]/30 bg-[#F3EEE7] px-3 py-1 rounded-full border border-[#013E3F]/5">In Progress</span>
                                         )}
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 )}

                 {drilldownTab === 'workbook' && (
                    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl mx-auto">
                       {selectedHireForDrilldown.workbookResponses && Object.keys(selectedHireForDrilldown.workbookResponses).length > 0 ? (
                          Object.entries(selectedHireForDrilldown.workbookResponses).map(([key, response]) => (
                             <div key={key} className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm">
                                <p className="text-[10px] font-bold uppercase text-[#013E3F]/30 mb-2 tracking-widest">{QUESTION_LABELS[key] || key}</p>
                                <p className="text-[#013E3F] text-sm leading-relaxed mb-4 italic font-medium">"{response}"</p>
                                {selectedHireForDrilldown.workbookComments?.[key] && (
                                   <div className="mt-4 pt-4 border-t border-[#F3EEE7] flex gap-3">
                                      <div className="shrink-0 w-8 h-8 bg-[#FDD344] rounded-full flex items-center justify-center text-[#013E3F]"><MessageCircle className="w-4 h-4" /></div>
                                      <div>
                                         <p className="text-[10px] font-bold text-[#013E3F]/60 uppercase mb-1">Manager Feedback</p>
                                         <p className="text-xs text-[#013E3F]/80 leading-relaxed">{selectedHireForDrilldown.workbookComments[key]}</p>
                                      </div>
                                   </div>
                                )}
                             </div>
                          ))
                       ) : (
                          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#013E3F]/10">
                             <BookOpen className="w-12 h-12 text-[#013E3F]/10 mx-auto mb-4" />
                             <p className="text-[#013E3F]/40 text-sm">No workbook responses recorded yet.</p>
                          </div>
                       )}
                    </div>
                 )}

                 {drilldownTab === 'tracker' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                       <div className="bg-[#013E3F] text-[#F3EEE7] p-6 rounded-2xl mb-6 flex items-center justify-between">
                          <div>
                             <h4 className="font-serif text-xl mb-1">Manager Checklist Audit</h4>
                             <p className="text-xs text-[#F3EEE7]/60">Track the tasks {MANAGERS.find(m => m.id === selectedHireForDrilldown.managerId)?.name} is responsible for.</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-bold uppercase text-[#FDD344] mb-1">Completion</p>
                             <p className="text-2xl font-serif">{Math.round(((selectedHireForDrilldown.managerTasks?.filter(t => t.completed).length || 0) / (selectedHireForDrilldown.managerTasks?.length || 1)) * 100)}%</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedHireForDrilldown.managerTasks?.map(task => (
                             <div key={task.id} className={`p-4 rounded-xl border flex items-center gap-4 ${task.completed ? 'bg-white border-green-100' : 'bg-white border-[#013E3F]/5'}`}>
                                {task.completed ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Clock className="w-5 h-5 text-[#013E3F]/20" />}
                                <div className="flex-1">
                                   <p className={`text-xs font-bold ${task.completed ? 'text-[#013E3F]/40 line-through' : 'text-[#013E3F]'}`}>{task.title}</p>
                                   <p className="text-[10px] text-[#013E3F]/40">{task.description}</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-white border-t border-[#013E3F]/5 flex justify-end gap-3">
                 <button onClick={() => handleInitiateComms(selectedHireForDrilldown, 'email')} className="px-6 py-2.5 rounded-xl border border-[#013E3F]/10 text-xs font-bold uppercase tracking-widest text-[#013E3F] hover:bg-[#F3EEE7] transition-all">Send Nudge</button>
                 <button onClick={() => setSelectedHireForDrilldown(null)} className="px-8 py-2.5 bg-[#013E3F] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#013E3F]/90 transition-all">Close Profile</button>
              </div>
           </div>
        </div>
      )}

      {/* AGENDA VIEW */}
      {viewMode === 'agenda' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <button 
                    disabled={isSyncingCalendar}
                    onClick={handleSyncCalendar}
                    className="bg-[#012d2e] border border-[#F3EEE7]/10 text-[#F3EEE7] px-6 py-2.5 rounded-xl font-bold uppercase text-xs flex items-center gap-2 hover:bg-[#FDD344] hover:text-[#013E3F] transition-all disabled:opacity-50"
                 >
                    {isSyncingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sync Unit Ops Calendar
                 </button>
                 {lastSyncedAt && (
                    <span className="text-[10px] font-bold text-[#F3EEE7]/40 uppercase tracking-widest flex items-center gap-1">
                       <CheckCircle className="w-3 h-3" /> Last Synced: {lastSyncedAt}
                    </span>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Calendar Column */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-[#013E3F]/10 overflow-hidden">
                 <div className="bg-[#013E3F] p-4 flex items-center justify-between text-[#F3EEE7]">
                    <div className="flex items-center gap-3">
                       <Calendar className="w-5 h-5 text-[#FDD344]" />
                       <h3 className="font-serif text-lg font-medium">Ops Training Calendar</h3>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="text-sm font-bold uppercase tracking-wider">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    </div>
                 </div>
                 <div className="grid grid-cols-7 bg-[#F3EEE7] border-b border-[#013E3F]/10">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="py-2 text-center text-xs font-bold uppercase text-[#013E3F]/60 tracking-wider">{day}</div>))}</div>
                 <div className="grid grid-cols-7 bg-[#F3EEE7] gap-[1px] border-l border-[#013E3F]/10">{renderMonthCalendarDays()}</div>
              </div>

              {/* Presenter Confirmation Column */}
              <div className="bg-white rounded-xl shadow-sm border border-[#013E3F]/10 overflow-hidden flex flex-col">
                 <div className="p-6 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex items-center justify-between">
                    <h3 className="font-serif text-xl text-[#013E3F]">Presenter Tracker</h3>
                    <UserCheck2 className="w-6 h-6 text-[#013E3F]/20" />
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {events.map(event => (
                       <div key={event.id} className="space-y-3">
                          <div className="flex items-start justify-between">
                             <h4 className="font-bold text-[#013E3F] text-sm leading-tight max-w-[70%]">{event.title}</h4>
                             <span className="text-[9px] font-bold uppercase bg-[#013E3F]/5 text-[#013E3F]/40 px-2 py-0.5 rounded">
                                {new Date(event.date).toLocaleDateString()}
                             </span>
                          </div>
                          <div className="space-y-2">
                             {event.presenters?.map((presenter, pIdx) => (
                                <div key={pIdx} className="flex items-center justify-between p-3 rounded-xl bg-[#F9F7F5] border border-[#013E3F]/5">
                                   <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${presenter.confirmed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-amber-400 animate-pulse'}`}></div>
                                      <span className="text-xs font-medium text-[#013E3F]">{presenter.name}</span>
                                   </div>
                                   {presenter.confirmed ? (
                                      <span className="text-[9px] font-bold text-green-600 uppercase flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                         <CheckCircle className="w-3 h-3" /> Confirmed
                                      </span>
                                   ) : (
                                      <span className="text-[9px] font-bold text-amber-600 uppercase flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                         <Clock className="w-3 h-3" /> Pending Hold
                                      </span>
                                   )}
                                </div>
                             ))}
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className="p-4 bg-[#F3EEE7]/30 border-t border-[#013E3F]/10">
                    <p className="text-[10px] text-[#013E3F]/40 italic text-center">Calendar holds are sent automatically upon call creation.</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* COMMUNICATIONS VIEW */}
      {viewMode === 'communications' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           <div className="flex gap-1 p-1 bg-[#012d2e] rounded-xl w-fit"><button onClick={() => setMessageTarget('newhires')} className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest ${messageTarget === 'newhires' ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60'}`}>New Hires</button><button onClick={() => setMessageTarget('managers')} className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest ${messageTarget === 'managers' ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60'}`}>Managers</button></div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{NEW_HIRES.map(targetUser => (<div key={targetUser.id} className="bg-white rounded-2xl p-6 border border-[#013E3F]/10 shadow-sm"><div className="flex items-center gap-4 mb-6"><img src={targetUser.avatar} className="w-12 h-12 rounded-full" /><div><h4 className="font-bold text-[#013E3F] truncate">{targetUser.name}</h4><p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{targetUser.title}</p></div></div><div className="grid grid-cols-3 gap-2"><button onClick={() => handleInitiateComms(targetUser, 'email')} className="flex flex-col items-center p-3 rounded-xl bg-[#F3EEE7]/50 hover:bg-[#FDD344]/10 transition-colors"><Mail className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Email</span></button><button onClick={() => handleInitiateComms(targetUser, 'slack')} className="flex flex-col items-center p-3 rounded-xl bg-[#F3EEE7]/50 hover:bg-[#FDD344]/10 transition-colors"><Slack className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Slack</span></button><button onClick={() => handleInitiateComms(targetUser, 'survey')} className="flex flex-col items-center p-3 rounded-xl bg-[#F3EEE7]/50 hover:bg-[#FDD344]/10 transition-colors"><ClipboardCheck className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Survey</span></button></div></div>))}</div>
        </div>
      )}

      {/* ENGAGEMENT VIEW */}
      {viewMode === 'engagement' && (
        <div className="bg-white p-12 rounded-xl text-center shadow-lg border border-[#013E3F]/10 animate-in fade-in duration-300">
           <PieChart className="w-16 h-16 text-[#013E3F]/10 mx-auto mb-6" />
           <h3 className="text-2xl font-serif text-[#013E3F] mb-2">Cohort Engagement Visualizer</h3>
           <p className="text-[#013E3F]/60 max-w-md mx-auto">participation trends and sentiment analysis across regional cohorts.</p>
        </div>
      )}

      {/* SETTINGS VIEW */}
      {viewMode === 'settings' && (
        <div className="bg-white p-12 rounded-xl text-center shadow-lg border border-[#013E3F]/10 animate-in fade-in duration-300">
           <Settings className="w-16 h-16 text-[#013E3F]/10 mx-auto mb-6" />
           <h3 className="text-2xl font-serif text-[#013E3F] mb-2">Platform Controls</h3>
           <p className="text-[#013E3F]/60 max-w-md mx-auto">Manage team permissions, branding assets, and system integrations.</p>
        </div>
      )}

      {/* MODALS */}
      {selectedUserForComms && activeCommsAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-10 animate-in zoom-in-95"><div className="flex justify-between items-center mb-8"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#F3EEE7] rounded-full flex items-center justify-center text-[#013E3F]">{activeCommsAction === 'email' && <Mail />}{activeCommsAction === 'slack' && <Slack />}{activeCommsAction === 'survey' && <ClipboardCheck />}</div><div><h3 className="font-serif text-2xl text-[#013E3F]">{activeCommsAction === 'survey' ? 'Satisfaction Survey' : `Draft ${activeCommsAction.charAt(0).toUpperCase() + activeCommsAction.slice(1)}`}</h3><p className="text-sm opacity-40 font-bold uppercase tracking-widest">To: {selectedUserForComms.name}</p></div></div><button onClick={() => setSelectedUserForComms(null)}><X className="w-5 h-5"/></button></div><div className="p-6 bg-[#F9F7F5] rounded-xl border border-[#013E3F]/10 min-h-[200px] relative">{sendingComms ? <div className="absolute inset-0 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" /><span>AI Drafting...</span></div> : <textarea className="w-full bg-transparent border-none text-sm text-[#013E3F] min-h-[200px] resize-none focus:ring-0" value={commsDraft} onChange={e => setCommsDraft(e.target.value)} />}</div><button onClick={() => { alert('Dispatched!'); setSelectedUserForComms(null); }} className="w-full mt-6 py-5 bg-[#013E3F] text-[#F3EEE7] rounded-xl font-bold uppercase shadow-xl tracking-widest">Dispatch Message</button></div></div>
      )}

      {showEnrolledDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl max-w-lg w-full p-8 animate-in zoom-in-95 shadow-2xl"><div className="flex justify-between items-center mb-6"><h3 className="font-serif text-2xl text-[#013E3F]">Enrollment Detail</h3><button onClick={() => setShowEnrolledDrilldown(false)}><X className="w-5 h-5 text-[#013E3F]/40 hover:text-[#013E3F]"/></button></div><div className="max-h-[60vh] overflow-y-auto space-y-3">{(enrolledFilter === 'summary' ? NEW_HIRES : enrolledFilter === 'onTrack' ? NEW_HIRES.filter(h => !isHireBehind(h)) : NEW_HIRES.filter(isHireBehind)).map(hire => (<div key={hire.id} className="flex items-center justify-between p-4 bg-[#F9F7F5] border border-[#013E3F]/5 rounded-xl"><div className="flex items-center gap-3"><img src={hire.avatar} className="w-10 h-10 rounded-full border border-[#013E3F]/10" /><div><h4 className="font-bold text-[#013E3F] leading-tight">{hire.name}</h4><p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{hire.title}</p></div></div><div className="font-serif font-bold text-[#013E3F]">{hire.progress}%</div></div>))}</div></div></div>
      )}

      {editingHireId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 border border-[#013E3F]/10"><div className="p-6 bg-[#013E3F] text-white flex justify-between items-center"><h3 className="font-serif text-xl">Edit Registry Details</h3><button onClick={() => setEditingHireId(null)}><X className="w-6 h-6" /></button></div><form onSubmit={handleUpdateHire} className="p-8 space-y-6"><div className="space-y-4"><div><label className="block text-[10px] font-bold uppercase opacity-40 mb-1">Email</label><input type="email" className="w-full border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#013E3F]" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase opacity-40 mb-1">Role</label><input className="w-full border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#013E3F]" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} /></div><div><label className="block text-[10px] font-bold uppercase opacity-40 mb-1">Start Date</label><input type="date" className="w-full border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#013E3F]" value={editFormData.startDate} onChange={e => setEditFormData({...editFormData, startDate: e.target.value})} /></div></div><div><label className="block text-[10px] font-bold uppercase opacity-40 mb-1">Assigned Manager</label><select className="w-full border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#013E3F]" value={editFormData.managerId} onChange={e => setEditFormData({...editFormData, managerId: e.target.value})}>{MANAGERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div></div><div className="flex gap-3 pt-4"><button type="button" onClick={() => setEditingHireId(null)} className="flex-1 py-3 text-xs font-bold uppercase border rounded-lg hover:bg-gray-50 transition-colors">Discard</button><button type="submit" className="flex-1 py-3 bg-[#013E3F] text-white text-xs font-bold uppercase rounded-lg shadow-lg hover:bg-[#013E3F]/90 transition-all">Save Changes</button></div></form></div></div>
      )}
    </div>
  );
};

export default AdminDashboard;