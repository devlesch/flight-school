import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NewHireProfile, User, CalendarEvent, TrainingModule, UserRole } from '../types';
import type { Profile, TrainingModule as DbTrainingModule, ModuleType } from '../types/database';
import { NEW_HIRES, MANAGERS, MOCK_TRAINING_MODULES, MANAGER_ONBOARDING_TASKS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, PieChart as RePieChart, Pie, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts';
import { Mail, Calendar, TrendingUp, CheckCircle, AlertCircle, FileText, Loader2, Wand2, UploadCloud, Video, ArrowRight, X, Users, Plus, Clock, MessageSquare, Zap, PieChart, Settings, Palette, UserCheck, Search, Send, ChevronLeft, ChevronRight, MessageCircle, Globe, AtSign, Filter, BarChart2, MousePointer2, Check, UserMinus, ArrowLeft, Slack, ClipboardCheck, Info, Target, LayoutDashboard, Star, ShieldCheck, UserCog, UserPlus, ZapOff, Activity, History, HelpCircle, FileUp, Building2, UserCircle, Save, Briefcase, RefreshCw, Edit3, BookOpen, Layers, UserPlus2, UserCheck2, HelpCircle as HelpIcon, Timer, ListTodo } from 'lucide-react';
import { analyzeProgress, ExtractedHireData, generateManagerNotification, generateEmailDraft } from '../services/geminiService';
import { createModule, getModules, updateModule } from '../services/moduleService';
import { createCohort, updateCohort, LEADER_ROLE_MAP, upsertCohortLeader } from '../services/cohortService';
import { parseWorkdayExcel, importWorkdayData, ImportResult } from '../services/workdayImportService';
import { updateProfile } from '../services/profileService';
import { sendSlackDM } from '../services/slackService';
import confetti from 'canvas-confetti';
import { useAllUsers } from '../hooks/useTeam';
import { useCohorts } from '../hooks/useCohorts';

export type AdminViewMode = 'dashboard' | 'workflow' | 'tasks' | 'cohorts' | 'agenda' | 'communications' | 'engagement' | 'settings';

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
  // Supabase hook for all users (admin view)
  const { users: supabaseUsers, loading: usersLoading, refetch: refetchUsers } = useAllUsers();
  // Cohorts hook
  const { cohorts, loading: cohortsLoading, refetch: refetchCohorts } = useCohorts();

  // Transform Supabase users to managers/new hires for backward compatibility
  const allUsers = useMemo(() => {
    if (supabaseUsers.length > 0) {
      return supabaseUsers;
    }
    return [];
  }, [supabaseUsers]);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [workflowSubTab, setWorkflowSubTab] = useState<'upload' | 'manual' | 'edit'>('edit');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [manualHire, setManualHire] = useState({ firstName: '', lastName: '', email: '', managerName: '', managerEmail: '', startDate: '', location: '', role: '', hasDirectReports: false });
  const [editingHireId, setEditingHireId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', role: '', managerId: '', email: '', startDate: '', department: '', region: '', location: '', userRole: 'New Hire' as UserRole, standardizedRole: '' });
  const [registryFilters, setRegistryFilters] = useState({ employee: '', role: '', manager: '', startDate: '', region: '', missingRegion: false, standardizedRole: '' });

  const filteredRegistryUsers = useMemo(() => {
    return allUsers.filter(profile => {
      if (registryFilters.employee) {
        const q = registryFilters.employee.toLowerCase();
        const match = profile.name.toLowerCase().includes(q) ||
          (profile.title || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (registryFilters.role && profile.role !== registryFilters.role) return false;
      if (registryFilters.manager && profile.manager_id !== registryFilters.manager) return false;
      if (registryFilters.startDate && !(profile.start_date || '').includes(registryFilters.startDate)) return false;
      if (registryFilters.missingRegion && profile.region) return false;
      if (registryFilters.region && profile.region !== registryFilters.region) return false;
      if (registryFilters.standardizedRole && profile.standardized_role !== registryFilters.standardizedRole) return false;
      return true;
    });
  }, [allUsers, registryFilters]);

  const [trainingData, setTrainingData] = useState({ title: '', description: '', method: 'MANAGER_LED' as TrainingModule['type'], targetRole: 'All Roles', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
  const [taskCategory, setTaskCategory] = useState<'module' | 'call'>('module');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSuccess, setTaskSuccess] = useState(false);
  const [messageTarget, setMessageTarget] = useState<'managers' | 'newhires'>('newhires');
  const [messageSearch, setMessageSearch] = useState('');
  const [commsDraft, setCommsDraft] = useState('');
  const [activeCommsAction, setActiveCommsAction] = useState<'email' | 'slack' | 'survey' | null>(null);
  const [selectedUserForComms, setSelectedUserForComms] = useState<User | null>(null);
  const [sendingComms, setSendingComms] = useState(false);
  const [showEnrolledDrilldown, setShowEnrolledDrilldown] = useState(false);
  const [enrolledFilter, setEnrolledFilter] = useState<'summary' | 'onTrack' | 'behind'>('summary');
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [selectedRegionName, setSelectedRegionName] = useState<string | null>(null);
  const [selectedCohortManager, setSelectedCohortManager] = useState<User | null>(null);
  const [cohortsSearch, setCohortsSearch] = useState('');
  const [assigningSlot, setAssigningSlot] = useState<string | null>(null);
  const [selectedSlotRole, setSelectedSlotRole] = useState<string | null>(null);
  const [selectedSlotRegion, setSelectedSlotRegion] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 0, 1));
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // New states for Hire Drilldown in Cohorts View
  const [selectedHireForDrilldown, setSelectedHireForDrilldown] = useState<NewHireProfile | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<'overview' | 'workbook' | 'tracker'>('overview');
  
  // Historical Metric View
  const [managerMetricMode, setManagerMetricMode] = useState<'snapshot' | 'history'>('snapshot');

  // Create Cohort modal state
  const [showCreateCohortModal, setShowCreateCohortModal] = useState(false);
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortStartDate, setNewCohortStartDate] = useState('');
  const [newCohortEndDate, setNewCohortEndDate] = useState('');
  const [newCohortStartingDate, setNewCohortStartingDate] = useState('');
  const [newCohortLeaders, setNewCohortLeaders] = useState<Record<string, string>>({});
  const [creatingCohort, setCreatingCohort] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);

  // Tasks view state
  const [allModules, setAllModules] = useState<DbTrainingModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [taskFilters, setTaskFilters] = useState({ title: '', type: '', targetRole: '' });
  const [agendaFilters, setAgendaFilters] = useState({ cohort: '', role: '' });
  const [showTaskBuilderModal, setShowTaskBuilderModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  useEffect(() => {
    setModulesLoading(true);
    getModules().then(data => { setAllModules(data); setModulesLoading(false); });
  }, []);

  const filteredModules = useMemo(() => {
    return allModules.filter(mod => {
      if (taskFilters.title && !mod.title.toLowerCase().includes(taskFilters.title.toLowerCase())) return false;
      if (taskFilters.type && mod.type !== taskFilters.type) return false;
      if (taskFilters.targetRole && (mod.target_role || '') !== taskFilters.targetRole) return false;
      return true;
    });
  }, [allModules, taskFilters]);

  const COHORT_COLORS = [
    { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', border: 'border-[#166534]' },
    { bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]', border: 'border-[#1e40af]' },
    { bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', border: 'border-[#854d0e]' },
    { bg: 'bg-[#fce7f3]', text: 'text-[#9d174d]', border: 'border-[#9d174d]' },
    { bg: 'bg-[#ede9fe]', text: 'text-[#5b21b6]', border: 'border-[#5b21b6]' },
    { bg: 'bg-[#ffedd5]', text: 'text-[#9a3412]', border: 'border-[#9a3412]' },
  ];

  const openEditCohortModal = (cohort: typeof cohorts[number]) => {
    setEditingCohortId(cohort.id);
    setNewCohortName(cohort.name);
    setNewCohortStartDate(cohort.hire_start_date);
    setNewCohortEndDate(cohort.hire_end_date);
    setNewCohortStartingDate(cohort.starting_date || '');
    const leaders: Record<string, string> = {};
    cohort.cohort_leaders.forEach(l => {
      leaders[`${l.role_label}-${l.region}`] = l.profile_id;
    });
    setNewCohortLeaders(leaders);
    setShowCreateCohortModal(true);
  };

  const calendarEvents = useMemo(() => {
    const computed: (CalendarEvent & {
      colorIdx: number;
      cohortName: string;
      cohortId: string;
      moduleData: DbTrainingModule;
    })[] = [];
    cohorts.forEach((cohort, idx) => {
      if (!cohort.starting_date) return;
      const start = new Date(cohort.starting_date + 'T00:00:00');
      for (const mod of allModules) {
        const taskDate = new Date(start);
        taskDate.setDate(taskDate.getDate() + (mod.day_offset ?? 0));
        computed.push({
          id: `${cohort.id}-${mod.id}`,
          title: `${cohort.name}: ${mod.title}`,
          date: taskDate.toISOString(),
          attendees: [mod.target_role || 'All Roles'],
          link: mod.link || '',
          colorIdx: idx % COHORT_COLORS.length,
          cohortName: cohort.name,
          cohortId: cohort.id,
          moduleData: mod,
        });
      }
    });
    return computed;
  }, [cohorts, allModules]);

  const filteredCalendarEvents = useMemo(() => {
    return calendarEvents.filter(ev => {
      if (agendaFilters.cohort && ev.cohortId !== agendaFilters.cohort) return false;
      if (agendaFilters.role && (ev.moduleData.target_role || '') !== agendaFilters.role) return false;
      return true;
    });
  }, [calendarEvents, agendaFilters]);

  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<typeof calendarEvents[number] | null>(null);

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

  const selectedCohortData = useMemo(() => {
    if (!selectedCohort) return null;
    return cohorts.find(c => c.id === selectedCohort) || null;
  }, [cohorts, selectedCohort]);

  const leaderGrid = useMemo(() => {
    if (!selectedCohortData) return {} as Record<string, (typeof selectedCohortData.cohort_leaders)[number] | null>;
    const grid: Record<string, (typeof selectedCohortData.cohort_leaders)[number] | null> = {};
    for (const role of ['MxA', 'MxM', 'AGM', 'GM']) {
      for (const region of ['East', 'Central', 'West']) {
        grid[`${role}-${region}`] = selectedCohortData.cohort_leaders.find(
          l => l.role_label === role && l.region === region
        ) || null;
      }
    }
    return grid;
  }, [selectedCohortData]);

  const slotMembers = useMemo(() => {
    if (!selectedSlotRole || !selectedSlotRegion) return [];
    return allUsers.filter(u => {
      if (u.standardized_role !== selectedSlotRole || u.region !== selectedSlotRegion) return false;
      if (selectedCohortData && u.start_date) {
        if (u.start_date < selectedCohortData.hire_start_date || u.start_date > selectedCohortData.hire_end_date) return false;
      }
      return true;
    });
  }, [allUsers, selectedSlotRole, selectedSlotRegion, selectedCohortData]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setImportError('Please upload an .xlsx or .xls file.');
      return;
    }

    setIsProcessingFile(true);
    setImportError(null);
    setImportResult(null);

    try {
      const rows = await parseWorkdayExcel(file);
      if (rows.length === 0) {
        setImportError('No valid data rows found in the uploaded file. Check the file format.');
        setIsProcessingFile(false);
        return;
      }
      const result = await importWorkdayData(rows);
      setImportResult(result);
      setImportSuccess(true);
      await refetchUsers();
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'An unexpected error occurred during import.');
    } finally {
      setIsProcessingFile(false);
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

  const handleUpdateHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHireId) return;
    const result = await updateProfile(editingHireId, {
      name: editFormData.name,
      title: editFormData.role,
      manager_id: editFormData.managerId || null,
      email: editFormData.email,
      start_date: editFormData.startDate || null,
      department: editFormData.department || null,
      region: editFormData.region || null,
      location: editFormData.location || null,
      role: editFormData.userRole,
      standardized_role: editFormData.standardizedRole || null,
    });
    if (result) {
      await refetchUsers();
      setEditingHireId(null);
    } else {
      alert('Failed to save changes. Please try again.');
    }
  };

  const openEditModal = (mod: DbTrainingModule) => {
    const isCall = mod.type === 'LIVE_CALL';
    setEditingModuleId(mod.id);
    setTaskCategory(isCall ? 'call' : 'module');
    setTrainingData({
      title: mod.title,
      description: mod.description || '',
      method: mod.type as TrainingModule['type'],
      targetRole: mod.target_role || 'All Roles',
      assignmentDay: mod.day_offset ?? 0,
      hasWorkbook: false,
      workbookContent: '',
    });
    setLink(mod.link || '');
    setTaskError(null);
    setTaskSuccess(false);
    setShowTaskBuilderModal(true);
  };

  const handleAddTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTaskError(null);

    const payload = {
      title: trainingData.title,
      type: (taskCategory === 'call' ? 'LIVE_CALL' : trainingData.method) as ModuleType,
      link: link || null,
      target_role: trainingData.targetRole === 'All Roles' ? null : trainingData.targetRole,
      day_offset: trainingData.assignmentDay,
    };

    const result = editingModuleId
      ? await updateModule(editingModuleId, payload)
      : await createModule(payload);

    setSubmitting(false);

    if (result) {
      setTaskSuccess(true);
      setTimeout(() => {
        setTrainingData({ title: '', description: '', method: 'MANAGER_LED', targetRole: 'All Roles', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
        setTaskCategory('module');
        setLink('');
        setTaskSuccess(false);
        setEditingModuleId(null);
        setShowTaskBuilderModal(false);
        getModules().then(data => setAllModules(data));
      }, 1500);
    } else {
      setTaskError(editingModuleId ? 'Failed to update task. Please try again.' : 'Failed to save task. Please try again.');
    }
  };

  const startEditingHire = (profile: Profile) => {
    setEditingHireId(profile.id);
    setEditFormData({ name: profile.name, role: profile.title || '', managerId: profile.manager_id || '', email: profile.email, startDate: profile.start_date || '', department: profile.department || '', region: profile.region || '', location: profile.location || '', userRole: profile.role, standardizedRole: profile.standardized_role || '' });
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
      const dayEvents = filteredCalendarEvents.filter(e => e.date.startsWith(dateStr));
      days.push(
        <div key={day} className="h-32 bg-white border-r border-b border-[#013E3F]/10 p-2 relative hover:bg-[#F3EEE7]/5">
          <span className="text-xs font-bold text-[#013E3F]/50 absolute top-2 left-2">{day}</span>
          <div className="mt-5 space-y-1 overflow-y-auto max-h-[100px]">
            {dayEvents.map(event => {
              const color = COHORT_COLORS[event.colorIdx];
              return (
                <div key={event.id} onClick={() => setSelectedCalendarEvent(event)} className={`text-[9px] p-1 rounded ${color.bg} ${color.text} border-l-2 ${color.border} truncate cursor-pointer hover:opacity-80`}>{event.title}</div>
              );
            })}
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
    <div className="space-y-4 max-w-7xl mx-auto pb-20">
      <div className="border-b border-[#F3EEE7]/10 pb-6">
          <h2 className="text-3xl font-medium text-[#F3EEE7] font-serif">
            {viewMode === 'dashboard' && 'Operations Dashboard'}
            {viewMode === 'workflow' && 'People'}
            {viewMode === 'cohorts' && 'New Bees & Cohorts'}
            {viewMode === 'agenda' && 'Agenda & Presenters'}
            {viewMode === 'communications' && 'Communications'}
            {viewMode === 'engagement' && 'Cohort Engagement'}
            {viewMode === 'tasks' && 'Tasks'}
            {viewMode === 'settings' && 'Settings'}
          </h2>
          <p className="text-[#F3EEE7]/70 mt-2 font-light text-lg">
            {viewMode === 'dashboard' && 'High-level status of Industrious onboarding.'}
            {viewMode === 'workflow' && 'Import team members, manage active registry, and automate training.'}
            {viewMode === 'tasks' && 'Manage training modules and assignments.'}
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
                { id: 'edit', label: 'Team Registry', icon: UserCog },
                { id: 'upload', label: 'Workday Import', icon: FileUp },
                { id: 'manual', label: 'New Team Member', icon: UserPlus2 },
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
                   {importSuccess ? <button onClick={() => { setImportSuccess(false); setImportResult(null); setImportError(null); }} className="text-[#013E3F] font-bold text-xs underline">Upload another report</button> : <div className="relative group"><input type="file" accept=".xlsx,.xls" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileUpload} disabled={isProcessingFile} /><button className="bg-[#013E3F] text-white px-12 py-4 rounded-xl font-bold uppercase text-xs flex items-center gap-3">Select Workday Report <FileText className="w-4 h-4" /></button></div>}
                   {importError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium whitespace-pre-wrap max-h-48 overflow-y-auto">{importError}</div>}
                </div>
                <div className="bg-[#F3EEE7]/20 border border-[#F3EEE7]/10 p-8 rounded-2xl">
                   {importResult ? (
                     <>
                       <h4 className="text-xs font-bold uppercase tracking-[2px] text-[#FDD344] mb-6 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Import Results</h4>
                       <div className="grid grid-cols-2 gap-3 mb-6">
                         <div className="p-3 bg-green-900/30 rounded-lg text-center"><p className="text-[10px] font-bold uppercase text-green-400">Created</p><p className="text-2xl font-serif text-green-300">{importResult.created}</p></div>
                         <div className="p-3 bg-blue-900/30 rounded-lg text-center"><p className="text-[10px] font-bold uppercase text-blue-400">Updated</p><p className="text-2xl font-serif text-blue-300">{importResult.updated}</p></div>
                         <div className="p-3 bg-[#013E3F]/30 rounded-lg text-center"><p className="text-[10px] font-bold uppercase text-[#F3EEE7]/50">Skipped</p><p className="text-2xl font-serif text-[#F3EEE7]/60">{importResult.skipped}</p></div>
                         <div className="p-3 bg-amber-900/30 rounded-lg text-center"><p className="text-[10px] font-bold uppercase text-amber-400">Managers</p><p className="text-2xl font-serif text-amber-300">{importResult.managersCreated}</p></div>
                       </div>
                       {importResult.errors.length > 0 && (
                         <div className="mb-4 p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
                           <p className="text-[10px] font-bold uppercase text-red-400 mb-2">Errors ({importResult.errors.length})</p>
                           <div className="max-h-32 overflow-y-auto space-y-1">
                             {importResult.errors.map((err, i) => <p key={i} className="text-[10px] text-red-300">{err}</p>)}
                           </div>
                         </div>
                       )}
                       <div className="max-h-48 overflow-y-auto space-y-1">
                         {importResult.details.slice(0, 20).map((detail, i) => (
                           <p key={i} className="text-[10px] text-[#F3EEE7]/50">{detail}</p>
                         ))}
                         {importResult.details.length > 20 && <p className="text-[10px] text-[#F3EEE7]/30 italic">...and {importResult.details.length - 20} more</p>}
                       </div>
                     </>
                   ) : (
                     <>
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
                     </>
                   )}
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
                {usersLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[#013E3F]/40">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Loading team registry…</p>
                  </div>
                ) : allUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[#013E3F]/40">
                    <Users className="w-10 h-10 mb-4 opacity-30" />
                    <p className="text-sm font-bold uppercase tracking-widest">No profiles found</p>
                    <p className="text-xs mt-2 opacity-60">Import from Workday or add a team member manually.</p>
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#F9F7F5] text-[#013E3F]/40 text-[10px] uppercase font-bold tracking-widest border-b">
                      <tr>
                        <th className="px-8 py-4">Employee</th>
                        <th className="px-8 py-4">Role</th>
                        <th className="px-8 py-4">Std. Role</th>
                        <th className="px-8 py-4">Current Manager</th>
                        <th className="px-8 py-4">Start Date</th>
                        <th className="px-8 py-4">Region</th>
                        <th className="px-8 py-4 text-right">Edit</th>
                      </tr>
                      <tr className="bg-white border-b border-[#013E3F]/10">
                        <th className="px-8 py-2">
                          <input
                            type="text"
                            placeholder="Search name or title…"
                            value={registryFilters.employee}
                            onChange={e => setRegistryFilters(f => ({ ...f, employee: e.target.value }))}
                            className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                          />
                        </th>
                        <th className="px-8 py-2">
                          <select
                            value={registryFilters.role}
                            onChange={e => setRegistryFilters(f => ({ ...f, role: e.target.value }))}
                            className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                          >
                            <option value="">All</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="New Hire">New Hire</option>
                          </select>
                        </th>
                        <th className="px-8 py-2">
                          <select
                            value={registryFilters.standardizedRole}
                            onChange={e => setRegistryFilters(f => ({ ...f, standardizedRole: e.target.value }))}
                            className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                          >
                            <option value="">All</option>
                            <option value="MxA">MxA</option>
                            <option value="MxM">MxM</option>
                            <option value="AGM">AGM</option>
                            <option value="GM">GM</option>
                            <option value="RD">RD</option>
                          </select>
                        </th>
                        <th className="px-8 py-2">
                          <select
                            value={registryFilters.manager}
                            onChange={e => setRegistryFilters(f => ({ ...f, manager: e.target.value }))}
                            className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                          >
                            <option value="">All</option>
                            {[...new Map(allUsers.filter(u => allUsers.some(p => p.manager_id === u.id)).map(u => [u.id, u.name])).entries()].map(([id, name]) => (
                              <option key={id} value={id}>{name}</option>
                            ))}
                          </select>
                        </th>
                        <th className="px-8 py-2">
                          <input
                            type="month"
                            value={registryFilters.startDate}
                            onChange={e => setRegistryFilters(f => ({ ...f, startDate: e.target.value }))}
                            className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                          />
                        </th>
                        <th className="px-8 py-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={registryFilters.region}
                              onChange={e => setRegistryFilters(f => ({ ...f, region: e.target.value }))}
                              className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] font-normal normal-case tracking-normal outline-none"
                            >
                              <option value="">All</option>
                              <option value="East">East</option>
                              <option value="Central">Central</option>
                              <option value="West">West</option>
                            </select>
                            <label className="flex items-center gap-1 text-[10px] text-[#013E3F]/60 font-normal normal-case tracking-normal whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={registryFilters.missingRegion}
                                onChange={e => setRegistryFilters(f => ({ ...f, missingRegion: e.target.checked }))}
                                className="rounded border-[#013E3F]/20"
                              />
                              Missing only
                            </label>
                          </div>
                        </th>
                        <th className="px-8 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3EEE7]">
                      {filteredRegistryUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-8 py-16 text-center">
                            <p className="text-sm font-bold text-[#013E3F]/40">No team members match the current filters</p>
                            <button
                              onClick={() => setRegistryFilters({ employee: '', role: '', manager: '', startDate: '', region: '', missingRegion: false, standardizedRole: '' })}
                              className="mt-3 text-xs font-bold uppercase tracking-wider text-[#013E3F]/60 hover:text-[#013E3F] underline underline-offset-2"
                            >
                              Clear filters
                            </button>
                          </td>
                        </tr>
                      ) : filteredRegistryUsers.map(profile => (
                        <tr key={profile.id} className="hover:bg-[#F9F7F5] transition-colors">
                          <td className="px-8 py-5 flex items-center gap-3">
                            <img src={profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=013E3F&color=F3EEE7`} className="w-10 h-10 rounded-full" />
                            <div>
                              <p className="font-serif font-bold text-[#013E3F]">{profile.name}</p>
                              <p className="text-[10px] uppercase text-[#013E3F]/40 tracking-wider">{profile.title || '—'}</p>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${profile.role === 'Admin' ? 'bg-purple-100 text-purple-700' : profile.role === 'Manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{profile.role}</span>
                          </td>
                          <td className="px-8 py-5">
                            <select
                              value={profile.standardized_role || ''}
                              onChange={async (e) => {
                                await updateProfile(profile.id, { standardized_role: e.target.value || null });
                                await refetchUsers();
                              }}
                              className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] outline-none"
                            >
                              <option value="">—</option>
                              <option value="MxA">MxA</option>
                              <option value="MxM">MxM</option>
                              <option value="AGM">AGM</option>
                              <option value="GM">GM</option>
                              <option value="RD">RD</option>
                            </select>
                          </td>
                          <td className="px-8 py-5 text-xs font-bold text-[#013E3F]/60">{profile.manager_id ? allUsers.find(u => u.id === profile.manager_id)?.name || '—' : '—'}</td>
                          <td className="px-8 py-5 text-xs text-[#013E3F]/60">{profile.start_date || '—'}</td>
                          <td className="px-8 py-5">
                            <select
                              value={profile.region || ''}
                              onChange={async (e) => {
                                await updateProfile(profile.id, { region: e.target.value || null });
                                await refetchUsers();
                              }}
                              className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] outline-none"
                            >
                              <option value="">—</option>
                              <option value="East">East</option>
                              <option value="Central">Central</option>
                              <option value="West">West</option>
                            </select>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button onClick={() => startEditingHire(profile)} className="p-2 hover:bg-[#013E3F]/5 rounded-lg text-[#013E3F]/40 hover:text-[#013E3F]"><Edit3 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
             </div>
           )}

        </div>
      )}

      {/* TASKS VIEW */}
      {viewMode === 'tasks' && (
        <div className="animate-in fade-in duration-300 space-y-8">
          <div className="bg-white rounded-2xl shadow-xl border border-[#013E3F]/10 overflow-hidden">
            <div className="p-8 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-serif text-[#013E3F]">Task Registry</h3>
                <p className="text-sm italic text-[#013E3F]/60 mt-4 leading-relaxed">
                  <strong>All Tasks:</strong> Training modules and calls created via the Task Builder.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingModuleId(null);
                  setTrainingData({ title: '', description: '', method: 'MANAGER_LED', targetRole: 'All Roles', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
                  setTaskCategory('module');
                  setLink('');
                  setTaskError(null);
                  setTaskSuccess(false);
                  setShowTaskBuilderModal(true);
                }}
                className="flex items-center gap-2 bg-[#013E3F] text-[#FDD344] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#013E3F]/80 transition-colors shadow-md"
              >
                <Plus className="w-4 h-4" /> New Task
              </button>
            </div>
            {modulesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#013E3F]/40">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Loading tasks…</p>
              </div>
            ) : allModules.length === 0 && !taskFilters.title && !taskFilters.type && !taskFilters.targetRole ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#013E3F]/40">
                <ListTodo className="w-10 h-10 mb-4 opacity-30" />
                <p className="text-sm font-bold uppercase tracking-widest">No tasks found</p>
                <p className="text-xs mt-2 opacity-60">Click &ldquo;New Task&rdquo; to create your first task.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F9F7F5] text-[#013E3F]/40 text-[10px] uppercase font-bold tracking-widest border-b">
                    <tr>
                      <th className="px-8 py-4">Title</th>
                      <th className="px-8 py-4">Type</th>
                      <th className="px-8 py-4">Target Role</th>
                      <th className="px-8 py-4">Duration</th>
                      <th className="px-8 py-4">Host</th>
                      <th className="px-8 py-4">Link</th>
                      <th className="px-8 py-4">Created</th>
                    </tr>
                    <tr className="bg-white border-b border-[#013E3F]/10">
                      <th className="px-8 py-2">
                        <input
                          type="text"
                          placeholder="Search title…"
                          value={taskFilters.title}
                          onChange={e => setTaskFilters(f => ({ ...f, title: e.target.value }))}
                          className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                        />
                      </th>
                      <th className="px-8 py-2">
                        <select
                          value={taskFilters.type}
                          onChange={e => setTaskFilters(f => ({ ...f, type: e.target.value }))}
                          className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                        >
                          <option value="">All</option>
                          <option value="WORKBOOK">Workbook</option>
                          <option value="VIDEO">Video</option>
                          <option value="LIVE_CALL">Live Call</option>
                          <option value="PERFORM">Perform</option>
                          <option value="SHADOW">Shadow</option>
                          <option value="MANAGER_LED">Manager Led</option>
                          <option value="BAU">BAU</option>
                          <option value="LESSONLY">Lessonly</option>
                          <option value="PEER_PARTNER">Peer Partner</option>
                        </select>
                      </th>
                      <th className="px-8 py-2">
                        <select
                          value={taskFilters.targetRole}
                          onChange={e => setTaskFilters(f => ({ ...f, targetRole: e.target.value }))}
                          className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                        >
                          <option value="">All</option>
                          <option value="MxA">MxA</option>
                          <option value="MxM">MxM</option>
                          <option value="AGM">AGM</option>
                          <option value="GM">GM</option>
                          <option value="RD">RD</option>
                        </select>
                      </th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EEE7]">
                    {filteredModules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-8 py-16 text-center">
                          <p className="text-sm font-bold text-[#013E3F]/40">No tasks match the current filters</p>
                          <button
                            onClick={() => setTaskFilters({ title: '', type: '', targetRole: '' })}
                            className="mt-3 text-xs font-bold uppercase tracking-wider text-[#013E3F]/60 hover:text-[#013E3F] underline underline-offset-2"
                          >
                            Clear filters
                          </button>
                        </td>
                      </tr>
                    ) : filteredModules.map(mod => (
                      <tr key={mod.id} onClick={() => openEditModal(mod)} className="hover:bg-[#F9F7F5] transition-colors cursor-pointer">
                        <td className="px-8 py-5">
                          <p className="font-serif font-bold text-[#013E3F]">{mod.title}</p>
                          {mod.description && <p className="text-[10px] text-[#013E3F]/40 mt-0.5">{mod.description}</p>}
                        </td>
                        <td className="px-8 py-5">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                            mod.type === 'WORKBOOK' ? 'bg-purple-100 text-purple-700' :
                            mod.type === 'VIDEO' ? 'bg-blue-100 text-blue-700' :
                            mod.type === 'LIVE_CALL' ? 'bg-green-100 text-green-700' :
                            mod.type === 'MANAGER_LED' ? 'bg-amber-100 text-amber-700' :
                            mod.type === 'LESSONLY' ? 'bg-cyan-100 text-cyan-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{mod.type.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{mod.target_role || 'All Roles'}</td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{mod.duration || '—'}</td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{mod.host || '—'}</td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">
                          {mod.link ? (
                            <a href={mod.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline truncate block max-w-[200px]">
                              {mod.link.length > 40 ? mod.link.slice(0, 40) + '…' : mod.link}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{new Date(mod.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Builder Modal */}
      {showTaskBuilderModal && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#013E3F]/80 backdrop-blur-md">
          <div className="bg-[#012d2e] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-10 bg-[#001f20] text-[#F3EEE7] border-b border-[#F3EEE7]/5 flex items-center justify-between">
              <div><h3 className="text-3xl font-serif">Task Builder</h3><p className="text-[#FDD344] text-xs font-bold uppercase tracking-widest mt-1">{editingModuleId ? 'Edit existing task' : 'Multi-method training mapping'}</p></div>
              <button onClick={() => { setShowTaskBuilderModal(false); setEditingModuleId(null); }} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6 text-[#F3EEE7]" /></button>
            </div>
            <div className="overflow-y-auto">
              <form onSubmit={handleAddTraining} className="p-10 space-y-12 text-[#F3EEE7]">
                {/* Module / Call segmented control */}
                <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 w-fit">
                  <button type="button" onClick={() => { setTaskCategory('module'); setTrainingData({...trainingData, method: 'MANAGER_LED'}); }} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${taskCategory === 'module' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}>Module</button>
                  <button type="button" onClick={() => { setTaskCategory('call'); setTrainingData({...trainingData, method: 'LIVE_CALL'}); }} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${taskCategory === 'call' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}>Call</button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Structure</h4>
                    <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Module Title</label><input required className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" placeholder="Member Crisis Resolution" value={trainingData.title} onChange={e => setTrainingData({...trainingData, title: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-6">
                      {taskCategory === 'module' && <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80" htmlFor="method-select">Method</label><select id="method-select" aria-label="Method" className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm" value={trainingData.method} onChange={e => setTrainingData({...trainingData, method: e.target.value as any})}><option value="MANAGER_LED">Manager Led</option><option value="LESSONLY">Lessonly</option><option value="WORKBOOK">Self-Led Workbook</option><option value="LIVE_CALL">Hosted Training</option><option value="PERFORM">Perform (#Ownership)</option><option value="PEER_PARTNER">Peer Partner</option></select></div>}
                      <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Day Offset</label><input type="number" className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm" value={trainingData.assignmentDay} onChange={e => setTrainingData({...trainingData, assignmentDay: parseInt(e.target.value)})} /></div>
                    </div>
                    <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Link</label><input className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm focus:border-[#FDD344] outline-none" placeholder="https://app.lessonly.com or Google Slides link..." value={link} onChange={e => setLink(e.target.value)} /></div>
                  </div>
                  <div className="space-y-8">
                    <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Targeting</h4>
                    <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Target Role</label><select className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-3 text-sm" value={trainingData.targetRole} onChange={e => setTrainingData({...trainingData, targetRole: e.target.value})}><option>All Roles</option><option>MxA</option><option>MxM</option><option>AGM</option><option>GM</option><option>RD</option></select></div>
                    {taskCategory === 'module' && <div className="p-6 bg-[#F3EEE7]/5 rounded-xl border border-[#F3EEE7]/10 space-y-6"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BookOpen className="w-4 h-4" /><p className="text-xs font-bold uppercase">Workbook Prompt</p></div><button type="button" onClick={() => setTrainingData({...trainingData, hasWorkbook: !trainingData.hasWorkbook})} className={`w-12 h-6 rounded-full relative flex items-center transition-colors ${trainingData.hasWorkbook ? 'bg-green-600' : 'bg-[#F3EEE7]/20'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${trainingData.hasWorkbook ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>{trainingData.hasWorkbook && <textarea className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 rounded-lg p-4 text-sm focus:border-[#FDD344] outline-none h-24" placeholder="Enter reflection question..." value={trainingData.workbookContent} onChange={e => setTrainingData({...trainingData, workbookContent: e.target.value})} />}</div>}
                  </div>
                </div>
                <div className="pt-8 border-t border-[#F3EEE7]/10 flex flex-col items-end gap-3">
                  <button type="submit" disabled={submitting || taskSuccess} className={`px-12 py-3 rounded-xl font-bold uppercase text-xs transition-colors ${taskSuccess ? 'bg-green-600 text-white' : 'bg-[#FDD344] text-[#013E3F]'}`}>{taskSuccess ? (editingModuleId ? '✓ Task Updated' : '✓ Task Assigned') : submitting ? 'Saving...' : (editingModuleId ? 'Update Task' : 'Assign Resource')}</button>
                  {taskError && <p className="text-red-400 text-xs">{taskError}</p>}
                </div>
              </form>
            </div>
          </div>
        </div>,
      document.body)}

      {/* NEW BEES & COHORTS VIEW */}
      {viewMode === 'cohorts' && (
        <div className="animate-in fade-in duration-300 space-y-2">
           <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F3EEE7]/40">
                 <button onClick={() => { setSelectedCohort(null); setSelectedRegionName(null); setSelectedCohortManager(null); setSelectedSlotRole(null); setSelectedSlotRegion(null); }} className="hover:text-[#FDD344] transition-colors">All Cohorts</button>
                 {selectedCohort && (<><ChevronRight className="w-3 h-3" /><button onClick={() => { setSelectedCohortManager(null); }} className="hover:text-[#FDD344] transition-colors">{cohorts.find(c => c.id === selectedCohort)?.name}</button></>)}
                 {selectedCohortManager && (<><ChevronRight className="w-3 h-3" /><span className="text-[#FDD344]">{selectedSlotRegion}</span><ChevronRight className="w-3 h-3" /><span className="text-[#FDD344]">{selectedSlotRole}</span></>)}
              </div>
           </div>


           {!selectedCohort ? (
              <div className="bg-white rounded-2xl shadow-xl border border-[#013E3F]/10 overflow-hidden">
                <div className="p-8 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-serif text-[#013E3F]">Cohort Directory</h3>
                    <p className="text-sm italic text-[#013E3F]/60 mt-4 leading-relaxed">Select a cohort to view regional performance and manager drill-downs.</p>
                  </div>
                  <button onClick={() => { setEditingCohortId(null); setNewCohortName(''); setNewCohortStartDate(''); setNewCohortEndDate(''); setNewCohortStartingDate(''); setNewCohortLeaders({}); setShowCreateCohortModal(true); }} className="flex items-center gap-2 bg-[#013E3F] text-[#FDD344] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#013E3F]/80 transition-colors shadow-md"><Plus className="w-4 h-4" /> New Cohort</button>
                </div>
                {cohortsLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#013E3F]/40" /><span className="ml-3 text-sm text-[#013E3F]/40">Loading cohorts...</span></div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#F9F7F5] text-[#013E3F]/40 text-[10px] uppercase font-bold tracking-widest border-b">
                      <tr>
                        <th className="px-8 py-4">Cohort</th>
                        <th className="px-8 py-4">Hire Period</th>
                        <th className="px-8 py-4">Leaders</th>
                        <th className="px-8 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3EEE7]">
                      {cohorts.filter(c => !cohortsSearch || c.name.toLowerCase().includes(cohortsSearch.toLowerCase())).map((cohort, idx) => {
                        const assignedLeaders = cohort.cohort_leaders?.length || 0;
                        return (
                          <tr key={cohort.id} onClick={() => setSelectedCohort(cohort.id)} className="hover:bg-[#F9F7F5] transition-colors cursor-pointer group">
                            <td className="px-8 py-5 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#013E3F] flex items-center justify-center text-[#FDD344] text-xs font-bold">{idx + 1}</div>
                              <div>
                                <p className="font-serif font-bold text-[#013E3F]">{cohort.name}</p>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-xs font-bold text-[#013E3F]/60">{new Date(cohort.hire_start_date + 'T00:00:00').toLocaleDateString()} — {new Date(cohort.hire_end_date + 'T00:00:00').toLocaleDateString()}</td>
                            <td className="px-8 py-5"><span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${assignedLeaders === 12 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{assignedLeaders} / 12 assigned</span></td>
                            <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                              <button onClick={(e) => { e.stopPropagation(); openEditCohortModal(cohort); }} className="p-1.5 rounded-lg hover:bg-[#013E3F]/10 transition-colors" title="Edit Cohort"><Edit3 className="w-4 h-4 text-[#013E3F]/30 hover:text-[#013E3F] transition-colors" /></button>
                              <ArrowRight className="w-5 h-5 text-[#013E3F]/20 group-hover:text-[#013E3F] transition-colors" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
           ) : !selectedCohortManager ? (
              <div className="space-y-4">
                {/* One card per region */}
                {(['East', 'Central', 'West'] as const).map(region => {
                  const regionLeaderCount = (['MxA', 'MxM', 'AGM', 'GM'] as const).filter(
                    role => leaderGrid[`${role}-${region}`]
                  ).length;
                  return (
                    <div key={region} className="bg-white rounded-2xl shadow-sm border border-[#013E3F]/10 overflow-hidden">
                      <div className="px-8 py-5 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-[#013E3F]/40" />
                          <h4 className="font-serif text-xl text-[#013E3F]">{region} Region</h4>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${regionLeaderCount === 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {regionLeaderCount} / 4 assigned
                        </span>
                      </div>
                      <div className="divide-y divide-[#F3EEE7]">
                        {(['MxA', 'MxM', 'AGM', 'GM'] as const).map(role => {
                          const key = `${role}-${region}`;
                          const leader = leaderGrid[key];
                          if (leader) {
                            const profile = leader.profiles;
                            // Hardcoded progress stats per slot
                            const hash = (role.length * 7 + region.length * 13) % 30;
                            const avgProgress = 55 + hash;
                            const onTrack = 2 + (hash % 3);
                            const behind = hash % 2;
                            const hireCount = onTrack + behind;
                            return (
                              <div
                                key={role}
                                onClick={() => {
                                  setSelectedSlotRole(role);
                                  setSelectedSlotRegion(region);
                                  setSelectedCohortManager({
                                    id: profile.id,
                                    name: profile.name,
                                    role: UserRole.MANAGER,
                                    avatar: profile.avatar || '/default-avatar.png',
                                    title: profile.title || '',
                                    email: profile.email,
                                    region: profile.region || region,
                                  });
                                }}
                                className="px-8 py-4 flex items-center justify-between hover:bg-[#F9F7F5] transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 w-10">{role}</span>
                                  <img src={profile.avatar || '/default-avatar.png'} className="w-9 h-9 rounded-full border-2 border-[#013E3F]/10" alt="" />
                                  <div>
                                    <p className="text-sm font-bold text-[#013E3F]">{profile.name}</p>
                                    <p className="text-[10px] text-[#013E3F]/40">{profile.title || role}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                                  <span className="text-[#013E3F]/40">Progress <span className="text-[#013E3F] text-xs normal-case">{avgProgress}%</span></span>
                                  <span className="text-[#013E3F]/40">Hires <span className="text-[#013E3F] text-xs normal-case">{hireCount}</span></span>
                                  <span className="text-green-600">{onTrack} On Track</span>
                                  <span className="text-[#013E3F]/20">/</span>
                                  <span className="text-red-600">{behind} At Risk</span>
                                  <ArrowRight className="w-4 h-4 text-[#013E3F]/20 group-hover:text-[#013E3F] transition-colors" />
                                </div>
                              </div>
                            );
                          }
                          // Unassigned slot
                          const allowedRoles = LEADER_ROLE_MAP[role] || [];
                          const candidates = allUsers.filter(u => allowedRoles.includes(u.standardized_role || '') && u.region === region);
                          return (
                            <div key={role} className="px-8 py-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 w-10">{role}</span>
                                <select
                                  disabled={assigningSlot === key}
                                  value=""
                                  onChange={async (e) => {
                                    const profileId = e.target.value;
                                    if (!profileId || !selectedCohort) return;
                                    setAssigningSlot(key);
                                    await upsertCohortLeader(selectedCohort, role, region, profileId);
                                    await refetchCohorts();
                                    setAssigningSlot(null);
                                  }}
                                  className="border border-dashed border-[#013E3F]/20 rounded-lg px-3 py-2 text-xs text-[#013E3F]/40 focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20 bg-white min-w-[180px]"
                                >
                                  <option value="">
                                    {assigningSlot === key ? 'Assigning...' : '— Unassigned —'}
                                  </option>
                                  {candidates.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-6 text-[#013E3F]/20">
                                <span className="text-[10px] italic">No data</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
           ) : (
              <div className="space-y-8 animate-in slide-in-from-bottom-4">
                 <div className="bg-[#013E3F] text-[#F3EEE7] p-8 rounded-2xl border border-[#F3EEE7]/10 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="flex items-center gap-8 z-10">
                      <img src={selectedCohortManager.avatar} className="w-24 h-24 rounded-full border-4 border-[#FDD344]" />
                      <div>
                         <button onClick={() => { setSelectedCohortManager(null); setSelectedSlotRole(null); setSelectedSlotRegion(null); }} className="text-xs font-bold uppercase text-[#FDD344] mb-2 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to {selectedSlotRegion} Region</button>
                         <h3 className="font-serif text-4xl">{selectedSlotRole} Leader</h3>
                         <div className="flex items-center gap-3 mt-2">
                           <img src={selectedCohortManager.avatar} className="w-8 h-8 rounded-full border-2 border-[#FDD344]" alt="" />
                           <span className="text-sm font-bold">{selectedCohortManager.name}</span>
                           <select
                             className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#F3EEE7] focus:outline-none"
                             value={selectedCohortManager.id}
                             onChange={async (e) => {
                               const newProfileId = e.target.value;
                               if (!newProfileId || !selectedCohort || !selectedSlotRole || !selectedSlotRegion) return;
                               await upsertCohortLeader(selectedCohort, selectedSlotRole, selectedSlotRegion, newProfileId);
                               await refetchCohorts();
                               const newProfile = allUsers.find(u => u.id === newProfileId);
                               if (newProfile) {
                                 setSelectedCohortManager({
                                   id: newProfile.id,
                                   name: newProfile.name,
                                   role: UserRole.MANAGER,
                                   avatar: newProfile.avatar || '/default-avatar.png',
                                   title: newProfile.title || '',
                                   email: newProfile.email,
                                   region: newProfile.region || selectedSlotRegion,
                                 });
                               }
                             }}
                           >
                             {(() => {
                               const allowedRoles = selectedSlotRole ? LEADER_ROLE_MAP[selectedSlotRole] || [] : [];
                               const candidates = allUsers.filter(u => allowedRoles.includes(u.standardized_role || '') && u.region === selectedSlotRegion);
                               return candidates.map(u => (
                                 <option key={u.id} value={u.id} style={{ color: '#013E3F' }}>{u.name}</option>
                               ));
                             })()}
                           </select>
                         </div>
                         <p className="text-xs font-bold opacity-50 uppercase tracking-widest mt-1">{selectedSlotRegion} Region</p>
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
                     {/* Cohort Members from Supabase profiles */}
                     {slotMembers.length > 0 ? (
                       <div>
                         <h4 className="text-xs font-bold uppercase tracking-widest text-[#013E3F]/40 mb-4">
                           {selectedSlotRole} Members — {selectedSlotRegion} Region ({slotMembers.length})
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {slotMembers.map(profile => {
                             const progress = ((profile.id.charCodeAt(0) * 7 + profile.id.charCodeAt(1) * 13) % 80) + 10;
                             const avatarUrl = profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=013E3F&color=F3EEE7`;
                             return (
                               <div key={profile.id} onClick={() => {
                                const cohortStart = selectedCohortData?.starting_date;
                                const userModules = allModules
                                  .filter(mod => !mod.target_role || mod.target_role === profile.standardized_role)
                                  .map(mod => {
                                    const dueDate = cohortStart
                                      ? new Date(new Date(cohortStart + 'T00:00:00').getTime() + (mod.day_offset ?? 0) * 86400000).toISOString().split('T')[0]
                                      : new Date().toISOString().split('T')[0];
                                    return {
                                      id: mod.id,
                                      title: mod.title,
                                      description: mod.description || '',
                                      type: mod.type as TrainingModule['type'],
                                      duration: mod.duration || '',
                                      completed: false,
                                      dueDate,
                                      link: mod.link || undefined,
                                      host: mod.host || undefined,
                                    };
                                  });
                                setSelectedHireForDrilldown({ id: profile.id, name: profile.name, role: profile.role as UserRole, avatar: avatarUrl, title: profile.title || '—', email: profile.email, managerId: profile.manager_id || '', startDate: profile.start_date || new Date().toISOString(), progress, department: profile.department || '', modules: userModules }); setDrilldownTab('overview'); }} className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 hover:border-[#FDD344] transition-all group cursor-pointer shadow-sm relative overflow-hidden">
                                  <div className="flex items-center gap-4 mb-4"><img src={avatarUrl} className="w-12 h-12 rounded-full border border-[#013E3F]/10" /><div><h4 className="font-bold text-[#013E3F] text-lg leading-tight group-hover:text-[#FDD344] transition-colors">{profile.name}</h4><p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{profile.title || '—'}</p></div></div><div className="w-full bg-[#F3EEE7] h-2 rounded-full overflow-hidden mb-3"><div className="h-full bg-[#013E3F] transition-all duration-500" style={{ width: `${progress}%` }} /></div><div className="flex justify-between items-center"><div className="flex flex-col"><span className="text-[10px] font-bold uppercase opacity-30">Completion</span><span className="font-serif font-bold text-[#013E3F]">{progress}%</span></div><button className="text-[9px] font-bold uppercase tracking-widest text-[#013E3F]/40 group-hover:text-[#013E3F] flex items-center gap-1">View Profile <ArrowRight className="w-3 h-3" /></button></div><div className="absolute right-0 top-0 w-24 h-24 bg-[#FDD344]/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-500"></div>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     ) : selectedSlotRole && selectedSlotRegion ? (
                       <p className="text-sm text-[#013E3F]/40 italic">No team members with {selectedSlotRole} role in {selectedSlotRegion} region.</p>
                     ) : null}
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

      {/* CREATE COHORT MODAL */}
      {showCreateCohortModal && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#013E3F]/80 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex justify-between items-center">
              <h3 className="font-serif text-3xl text-[#013E3F]">{editingCohortId ? 'Edit Cohort' : 'Create New Cohort'}</h3>
              <button onClick={() => { setShowCreateCohortModal(false); setEditingCohortId(null); }} className="p-3 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-[#013E3F]" /></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-2">Cohort Name</label>
                <input type="text" value={newCohortName} onChange={e => setNewCohortName(e.target.value)} placeholder="e.g. Cohort Jan 2026" className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-[#013E3F] focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-2">Hire Start Date</label>
                  <input type="date" value={newCohortStartDate} onChange={e => setNewCohortStartDate(e.target.value)} className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-[#013E3F] focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-2">Hire End Date</label>
                  <input type="date" value={newCohortEndDate} onChange={e => setNewCohortEndDate(e.target.value)} className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-[#013E3F] focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-2">Training Starting Date</label>
                  <input type="date" value={newCohortStartingDate} onChange={e => setNewCohortStartingDate(e.target.value)} className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-[#013E3F] focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-4">Training Leaders</label>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40">
                        <th className="py-2 pr-4"></th>
                        <th className="py-2 px-2">West</th>
                        <th className="py-2 px-2">Central</th>
                        <th className="py-2 px-2">East</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['MxA', 'MxM', 'AGM', 'GM'] as const).map(role => (
                        <tr key={role} className="border-t border-[#F3EEE7]">
                          <td className="py-3 pr-4 font-bold text-[#013E3F] text-xs">{role}</td>
                          {(['West', 'Central', 'East'] as const).map(region => {
                            const key = `${role}-${region}`;
                            const allowedRoles = LEADER_ROLE_MAP[role] || [];
                            const candidates = allUsers.filter(u => allowedRoles.includes(u.standardized_role || '') && u.region === region);
                            return (
                              <td key={region} className="py-3 px-2">
                                <select
                                  value={newCohortLeaders[key] || ''}
                                  onChange={e => setNewCohortLeaders(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full border border-[#013E3F]/10 rounded-lg px-2 py-2 text-xs text-[#013E3F] focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20 bg-white"
                                >
                                  <option value="">— Select —</option>
                                  {candidates.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#013E3F]/10 flex justify-end gap-3">
              <button onClick={() => { setShowCreateCohortModal(false); setEditingCohortId(null); }} className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-[#013E3F]/60 hover:text-[#013E3F] transition-colors">Cancel</button>
              <button
                disabled={creatingCohort || !newCohortName || !newCohortStartDate || !newCohortEndDate}
                onClick={async () => {
                  setCreatingCohort(true);
                  const leaders = Object.entries(newCohortLeaders)
                    .filter(([, profileId]) => profileId)
                    .map(([key, profileId]: [string, string]) => {
                      const [role_label, region] = key.split('-');
                      return { role_label, region, profile_id: profileId };
                    });

                  let success = false;
                  if (editingCohortId) {
                    const result = await updateCohort(editingCohortId, {
                      name: newCohortName,
                      hire_start_date: newCohortStartDate,
                      hire_end_date: newCohortEndDate,
                      starting_date: newCohortStartingDate || null,
                    });
                    if (result) {
                      for (const l of leaders) {
                        await upsertCohortLeader(editingCohortId, l.role_label, l.region, l.profile_id);
                      }
                      success = true;
                    }
                  } else {
                    const result = await createCohort(
                      { name: newCohortName, hire_start_date: newCohortStartDate, hire_end_date: newCohortEndDate, starting_date: newCohortStartingDate || null },
                      leaders
                    );
                    success = !!result;
                  }

                  setCreatingCohort(false);
                  if (success) {
                    setShowCreateCohortModal(false);
                    setEditingCohortId(null);
                    setNewCohortName('');
                    setNewCohortStartDate('');
                    setNewCohortEndDate('');
                    setNewCohortStartingDate('');
                    setNewCohortLeaders({});
                    refetchCohorts();
                  }
                }}
                className="px-8 py-3 bg-[#013E3F] text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-[#013E3F]/80 transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {creatingCohort && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingCohortId ? 'Save Changes' : 'Create Cohort'}
              </button>
            </div>
          </div>
        </div>,
      document.body)}

      {/* NEW HIRE DRILLDOWN MODAL */}
      {selectedHireForDrilldown && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-[#F3EEE7] flex justify-between items-center bg-[#F3EEE7]/30">
                <div className="flex items-center gap-4">
                   <img src={selectedHireForDrilldown.avatar} className="w-14 h-14 rounded-full border border-[#013E3F]/10" alt={selectedHireForDrilldown.name} />
                   <div>
                     <h3 className="font-serif text-xl text-[#013E3F] font-medium">{selectedHireForDrilldown.name}</h3>
                     <p className="text-xs font-bold uppercase text-[#013E3F]/40 tracking-widest">{selectedHireForDrilldown.title}</p>
                   </div>
                </div>
                <button onClick={() => setSelectedHireForDrilldown(null)} className="text-[#013E3F]/40 hover:text-[#013E3F] p-1 rounded-full hover:bg-[#F3EEE7]/50"><X className="w-6 h-6" /></button>
             </div>

             <div className="flex border-b border-[#F3EEE7] px-6">
                <button
                  onClick={() => setDrilldownTab('overview')}
                  className={`py-3 px-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${drilldownTab === 'overview' ? 'border-[#FDD344] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setDrilldownTab('workbook')}
                  className={`py-3 px-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-2 ${drilldownTab === 'workbook' ? 'border-[#FDD344] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                >
                  <BookOpen className="w-4 h-4" /> Workbook
                </button>
                <button
                  onClick={() => setDrilldownTab('tracker')}
                  className={`py-3 px-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-2 ${drilldownTab === 'tracker' ? 'border-[#FDD344] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                >
                  <ListTodo className="w-4 h-4" /> Tracker
                </button>
             </div>

             <div className="p-6 overflow-y-auto bg-[#F9F7F5] flex-1">
                {drilldownTab === 'overview' && (
                  <>
                    <div className="mb-8">
                      <h4 className="font-bold text-[#013E3F] mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Attention Needed (Overdue)
                      </h4>
                      <div className="space-y-3">
                        {selectedHireForDrilldown.modules.filter(m => !m.completed && new Date(m.dueDate) < new Date()).length === 0 ? (
                          <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-center">
                              <p className="text-sm font-medium text-green-700 flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" /> No overdue items.
                              </p>
                          </div>
                        ) : (
                          selectedHireForDrilldown.modules.filter(m => !m.completed && new Date(m.dueDate) < new Date()).map(m => (
                            <div key={m.id} className="bg-white border border-red-100 p-4 rounded-lg shadow-sm flex justify-between items-center group hover:border-red-200 transition-colors">
                                <div>
                                  <p className="font-bold text-red-700 text-sm mb-1">{m.title}</p>
                                  <p className="text-xs text-red-400 font-medium">Due: {new Date(m.dueDate).toLocaleDateString()}</p>
                                </div>
                                <span className="bg-red-50 text-red-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide border border-red-100">Late</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <h4 className="font-bold text-[#013E3F] mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-[#013E3F]" />
                        Training Progress
                    </h4>
                    <div className="bg-white rounded-lg border border-[#013E3F]/10 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-[#F3EEE7] text-[#013E3F]/60 text-xs uppercase tracking-wider font-bold">
                            <tr>
                              <th className="p-4">Module</th>
                              <th className="p-4">Lead/Host</th>
                              <th className="p-4 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F3EEE7]">
                            {selectedHireForDrilldown.modules.map(m => {
                              const isOverdue = !m.completed && new Date(m.dueDate) < new Date();
                              return (
                                <tr key={m.id} className="hover:bg-[#F3EEE7]/20 transition-colors">
                                  <td className="p-4 font-medium text-[#013E3F]">
                                    <div className="flex flex-col">
                                      <span>{m.title}</span>
                                      {isOverdue && <span className="text-red-500 text-[10px] font-bold uppercase mt-1">Overdue since {new Date(m.dueDate).toLocaleDateString()}</span>}
                                    </div>
                                  </td>
                                  <td className="p-4 text-xs font-bold text-[#013E3F]/60">{m.host || 'General Manager'}</td>
                                  <td className="p-4 text-right">
                                    {m.completed ? (
                                      <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">Complete</span>
                                    ) : (
                                      <span className="text-[#013E3F]/40 bg-[#F3EEE7] px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">Pending</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                    </div>
                  </>
                )}

                {drilldownTab === 'workbook' && (
                  <div className="space-y-6">
                     {selectedHireForDrilldown.workbookResponses && Object.keys(selectedHireForDrilldown.workbookResponses).length > 0 ? (
                       Object.entries(selectedHireForDrilldown.workbookResponses).map(([key, response]) => (
                         <div key={key} className="bg-white border border-[#013E3F]/10 p-5 rounded-lg shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#013E3F]/50 mb-2">{QUESTION_LABELS[key] || key}</p>
                            <p className="text-[#013E3F] text-sm leading-relaxed whitespace-pre-wrap mb-4 font-medium">{response}</p>
                            {selectedHireForDrilldown.workbookComments?.[key] && (
                               <div className="mt-4 pt-4 border-t border-[#F3EEE7]">
                                  <p className="text-xs font-bold text-[#013E3F] mb-1 flex items-center gap-2"><MessageCircle className="w-3 h-3 text-[#FDD344]" /> Manager Comment</p>
                                  <div className="bg-[#F3EEE7] p-3 rounded text-sm text-[#013E3F]">{selectedHireForDrilldown.workbookComments[key]}</div>
                               </div>
                            )}
                         </div>
                       ))
                     ) : (
                       <div className="text-center py-6 text-[#013E3F]/40">
                          <p>No workbook responses yet.</p>
                       </div>
                     )}
                  </div>
                )}

                {drilldownTab === 'tracker' && (
                  <div className="space-y-6">
                    <div className="bg-[#F3EEE7] border border-[#013E3F]/5 p-6 rounded-lg text-sm text-[#013E3F]">
                       <h4 className="font-bold text-lg mb-2 font-serif">Onboarding Path Completion Tracker</h4>
                       <p className="text-[#013E3F]/70 mb-4">Track the tasks {MANAGERS.find(m => m.id === selectedHireForDrilldown.managerId)?.name || 'the manager'} is responsible for.</p>
                       <div className="w-full bg-[#013E3F]/10 rounded-full h-2 mb-2">
                          <div className="bg-[#013E3F] h-2 rounded-full transition-all duration-500" style={{ width: `${Math.round(((selectedHireForDrilldown.managerTasks?.filter(t => t.completed).length || 0) / (selectedHireForDrilldown.managerTasks?.length || 1)) * 100)}%` }} />
                       </div>
                       <p className="text-xs font-bold text-[#013E3F]/40 uppercase tracking-widest text-right">
                          {Math.round(((selectedHireForDrilldown.managerTasks?.filter(t => t.completed).length || 0) / (selectedHireForDrilldown.managerTasks?.length || 1)) * 100)}% Complete
                       </p>
                    </div>
                    <div className="space-y-3">
                       {selectedHireForDrilldown.managerTasks?.map(task => (
                         <div key={task.id} className={`p-4 rounded-lg border flex items-start gap-4 ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-[#013E3F]/10 shadow-sm'}`}>
                            {task.completed ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> : <Clock className="w-5 h-5 text-[#013E3F]/20 mt-0.5" />}
                            <div className="flex-1">
                               <p className={`text-xs font-bold ${task.completed ? 'text-green-800 line-through decoration-green-800/30' : 'text-[#013E3F]'}`}>{task.title}</p>
                               <p className={`text-[10px] ${task.completed ? 'text-green-600' : 'text-[#013E3F]/40'}`}>{task.description}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
             </div>

             <div className="p-4 border-t border-[#F3EEE7] bg-white flex justify-end gap-3 z-10">
                <button onClick={() => handleInitiateComms(selectedHireForDrilldown, 'slack')} className="px-5 py-2.5 border border-[#013E3F]/10 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#F3EEE7] transition-colors text-[#013E3F]">Slack Nudge</button>
                <button onClick={() => handleInitiateComms(selectedHireForDrilldown, 'email')} className="px-5 py-2.5 bg-[#013E3F] text-[#F3EEE7] rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/90 transition-colors shadow-lg shadow-[#013E3F]/20">Draft Email</button>
             </div>
          </div>
        </div>,
      document.body)}

      {/* AGENDA VIEW */}
      {viewMode === 'agenda' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           {/* Agenda Filters */}
           <div className="flex items-center gap-3">
             <select
               value={agendaFilters.cohort}
               onChange={e => setAgendaFilters(f => ({ ...f, cohort: e.target.value }))}
               className="text-xs font-bold uppercase tracking-widest bg-[#F3EEE7]/10 border border-[#F3EEE7]/20 rounded-lg px-4 py-2.5 text-[#F3EEE7] focus:outline-none focus:ring-1 focus:ring-[#FDD344]/40 appearance-none cursor-pointer hover:bg-[#F3EEE7]/15 transition-colors"
             >
               <option value="" className="bg-[#013E3F] text-[#F3EEE7]">All Cohorts</option>
               {cohorts.map(c => <option key={c.id} value={c.id} className="bg-[#013E3F] text-[#F3EEE7]">{c.name}</option>)}
             </select>
             <select
               value={agendaFilters.role}
               onChange={e => setAgendaFilters(f => ({ ...f, role: e.target.value }))}
               className="text-xs font-bold uppercase tracking-widest bg-[#F3EEE7]/10 border border-[#F3EEE7]/20 rounded-lg px-4 py-2.5 text-[#F3EEE7] focus:outline-none focus:ring-1 focus:ring-[#FDD344]/40 appearance-none cursor-pointer hover:bg-[#F3EEE7]/15 transition-colors"
             >
               <option value="" className="bg-[#013E3F] text-[#F3EEE7]">All Roles</option>
               <option value="MxA" className="bg-[#013E3F] text-[#F3EEE7]">MxA</option>
               <option value="MxM" className="bg-[#013E3F] text-[#F3EEE7]">MxM</option>
               <option value="AGM" className="bg-[#013E3F] text-[#F3EEE7]">AGM</option>
               <option value="GM" className="bg-[#013E3F] text-[#F3EEE7]">GM</option>
               <option value="RD" className="bg-[#013E3F] text-[#F3EEE7]">RD</option>
             </select>
             {(agendaFilters.cohort || agendaFilters.role) && (
               <button
                 onClick={() => setAgendaFilters({ cohort: '', role: '' })}
                 className="text-xs font-bold uppercase tracking-widest text-[#F3EEE7]/50 hover:text-[#FDD344] transition-colors"
               >
                 Clear
               </button>
             )}
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
                    {filteredCalendarEvents.length === 0 ? (
                       <p className="text-sm text-[#013E3F]/40 text-center py-8">No training events yet. Create cohorts with a starting date and add tasks with day offsets to populate the calendar.</p>
                    ) : filteredCalendarEvents.slice(0, 10).map(event => (
                       <div key={event.id} className="space-y-3 cursor-pointer hover:bg-[#F3EEE7]/30 rounded-lg p-2 -m-2 transition-colors" onClick={() => setSelectedCalendarEvent(event)}>
                          <div className="flex items-start justify-between">
                             <h4 className="font-bold text-[#013E3F] text-sm leading-tight max-w-[70%]">{event.title}</h4>
                             <span className="text-[9px] font-bold uppercase bg-[#013E3F]/5 text-[#013E3F]/40 px-2 py-0.5 rounded">
                                {new Date(event.date).toLocaleDateString()}
                             </span>
                          </div>
                          <div className="text-[10px] text-[#013E3F]/50">{event.attendees.join(', ')}</div>
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

      {/* Calendar Event Detail Modal */}
      {selectedCalendarEvent && (() => {
        const ev = selectedCalendarEvent;
        const mod = ev.moduleData;
        const color = COHORT_COLORS[ev.colorIdx];
        return createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setSelectedCalendarEvent(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className={`p-6 ${color.bg} border-b border-[#013E3F]/10`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className={`font-serif text-xl font-bold ${color.text}`}>{mod.title}</h3>
                    <p className="text-sm text-[#013E3F]/60 mt-1">{ev.cohortName}</p>
                  </div>
                  <button onClick={() => setSelectedCalendarEvent(null)} className="p-1 rounded-lg hover:bg-black/10 transition-colors">
                    <X className="w-5 h-5 text-[#013E3F]/60" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${mod.type === 'call' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {mod.type === 'call' ? 'Call' : 'Task'}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#013E3F]/10 text-[#013E3F]/60">
                    Day {mod.day_offset ?? 0} of training
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {mod.description && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 tracking-wider mb-1">Description</p>
                    <p className="text-sm text-[#013E3F]/80">{mod.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 tracking-wider mb-1">Scheduled Date</p>
                    <p className="text-sm text-[#013E3F] font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 tracking-wider mb-1">Target Role</p>
                    <p className="text-sm text-[#013E3F] font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {mod.target_role || 'All Roles'}
                    </p>
                  </div>
                  {mod.duration && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 tracking-wider mb-1">Duration</p>
                      <p className="text-sm text-[#013E3F] font-medium flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5" />
                        {mod.duration}
                      </p>
                    </div>
                  )}
                  {mod.host && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 tracking-wider mb-1">Host</p>
                      <p className="text-sm text-[#013E3F] font-medium flex items-center gap-1.5">
                        <UserCircle className="w-3.5 h-3.5" />
                        {mod.host}
                      </p>
                    </div>
                  )}
                </div>

                {mod.link && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 tracking-wider mb-1">Link</p>
                    <a href={mod.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      {mod.link}
                    </a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-[#F3EEE7]/30 border-t border-[#013E3F]/10 flex justify-end">
                <button onClick={() => setSelectedCalendarEvent(null)} className="px-4 py-2 text-sm font-bold text-[#013E3F]/60 hover:text-[#013E3F] transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>,
        document.body);
      })()}

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
      {selectedUserForComms && activeCommsAction && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-10 animate-in zoom-in-95"><div className="flex justify-between items-center mb-8"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#F3EEE7] rounded-full flex items-center justify-center text-[#013E3F]">{activeCommsAction === 'email' && <Mail />}{activeCommsAction === 'slack' && <Slack />}{activeCommsAction === 'survey' && <ClipboardCheck />}</div><div><h3 className="font-serif text-2xl text-[#013E3F]">{activeCommsAction === 'survey' ? 'Satisfaction Survey' : `Draft ${activeCommsAction.charAt(0).toUpperCase() + activeCommsAction.slice(1)}`}</h3><p className="text-sm opacity-40 font-bold uppercase tracking-widest">To: {selectedUserForComms.name}</p></div></div><button onClick={() => setSelectedUserForComms(null)}><X className="w-5 h-5"/></button></div><div className="p-6 bg-[#F9F7F5] rounded-xl border border-[#013E3F]/10 min-h-[200px] relative">{sendingComms ? <div className="absolute inset-0 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" /><span>AI Drafting...</span></div> : <textarea className="w-full bg-transparent border-none text-sm text-[#013E3F] min-h-[200px] resize-none focus:ring-0" value={commsDraft} onChange={e => setCommsDraft(e.target.value)} />}</div><button disabled={sendingComms || !commsDraft.trim()} onClick={async () => { if (activeCommsAction === 'slack') { setSendingComms(true); const result = await sendSlackDM(selectedUserForComms.email, commsDraft); setSendingComms(false); if (result.success) { setSelectedUserForComms(null); alert('Slack message sent!'); } else { alert(`Failed to send: ${result.error || 'Unknown error'}`); } } else if (activeCommsAction === 'email') { window.open(`mailto:${selectedUserForComms.email}?subject=Onboarding Update&body=${encodeURIComponent(commsDraft)}`); setSelectedUserForComms(null); } else { setSelectedUserForComms(null); } }} className="w-full mt-6 py-5 bg-[#013E3F] text-[#F3EEE7] rounded-xl font-bold uppercase shadow-xl tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">{sendingComms ? 'Sending...' : activeCommsAction === 'slack' ? 'Send via Slack' : activeCommsAction === 'email' ? 'Send Email' : 'Dispatch Message'}</button></div></div>,
      document.body)}

      {showEnrolledDrilldown && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl max-w-lg w-full p-8 animate-in zoom-in-95 shadow-2xl"><div className="flex justify-between items-center mb-6"><h3 className="font-serif text-2xl text-[#013E3F]">Enrollment Detail</h3><button onClick={() => setShowEnrolledDrilldown(false)}><X className="w-5 h-5 text-[#013E3F]/40 hover:text-[#013E3F]"/></button></div><div className="max-h-[60vh] overflow-y-auto space-y-3">{(enrolledFilter === 'summary' ? NEW_HIRES : enrolledFilter === 'onTrack' ? NEW_HIRES.filter(h => !isHireBehind(h)) : NEW_HIRES.filter(isHireBehind)).map(hire => (<div key={hire.id} className="flex items-center justify-between p-4 bg-[#F9F7F5] border border-[#013E3F]/5 rounded-xl"><div className="flex items-center gap-3"><img src={hire.avatar} className="w-10 h-10 rounded-full border border-[#013E3F]/10" /><div><h4 className="font-bold text-[#013E3F] leading-tight">{hire.name}</h4><p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{hire.title}</p></div></div><div className="font-serif font-bold text-[#013E3F]">{hire.progress}%</div></div>))}</div></div></div>,
      document.body)}

      {editingHireId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 border border-[#013E3F]/10"><div className="p-6 bg-[#013E3F] text-white flex justify-between items-center"><h3 className="font-serif text-xl">Edit Registry Details</h3><button onClick={() => setEditingHireId(null)}><X className="w-6 h-6" /></button></div><form onSubmit={handleUpdateHire} className="p-8 space-y-6"><div className="space-y-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Name</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required /></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Email</label><input type="email" className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Role (Title)</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} /></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Start Date</label><input type="date" className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.startDate} onChange={e => setEditFormData({...editFormData, startDate: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Department</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.department} onChange={e => setEditFormData({...editFormData, department: e.target.value})} /></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Location</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Region</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.region} onChange={e => setEditFormData({...editFormData, region: e.target.value})}><option value="">No Region</option><option value="East">East</option><option value="Central">Central</option><option value="West">West</option></select></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">System Role</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.userRole} onChange={e => setEditFormData({...editFormData, userRole: e.target.value as UserRole})}><option value="Admin">Admin</option><option value="Manager">Manager</option><option value="New Hire">New Hire</option></select></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Assigned Manager</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.managerId} onChange={e => setEditFormData({...editFormData, managerId: e.target.value})}><option value="">None</option>{allUsers.filter(u => u.role === 'Manager').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Std. Role</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.standardizedRole} onChange={e => setEditFormData({...editFormData, standardizedRole: e.target.value})}><option value="">No Role</option><option value="MxA">MxA</option><option value="MxM">MxM</option><option value="AGM">AGM</option><option value="GM">GM</option><option value="RD">RD</option></select></div></div></div><div className="flex gap-3 pt-4"><button type="button" onClick={() => setEditingHireId(null)} className="flex-1 py-3 text-xs font-bold uppercase border rounded-lg text-[#013E3F] hover:bg-gray-50 transition-colors">Discard</button><button type="submit" className="flex-1 py-3 bg-[#013E3F] text-white text-xs font-bold uppercase rounded-lg shadow-lg hover:bg-[#013E3F]/90 transition-all">Save Changes</button></div></form></div></div>,
      document.body)}
    </div>
  );
};

export default AdminDashboard;