import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NewHireProfile, User, CalendarEvent, TrainingModule, UserRole } from '../types';
import { formatDate } from '../lib/formatDate';
import type { Profile, TrainingModule as DbTrainingModule, ModuleType } from '../types/database';
// Mock imports removed — KPIs and AI analytics now use real Supabase data via useAdminDashboard()
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, PieChart as RePieChart, Pie, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts';
import { Mail, Calendar, TrendingUp, CheckCircle, AlertCircle, FileText, Loader2, Wand2, UploadCloud, Video, ArrowRight, X, Users, Plus, Clock, MessageSquare, Zap, PieChart, Settings, Palette, UserCheck, Search, Send, ChevronLeft, ChevronRight, MessageCircle, Globe, AtSign, Filter, BarChart2, MousePointer2, Check, UserMinus, ArrowLeft, Slack, ClipboardCheck, Info, Target, LayoutDashboard, Star, ShieldCheck, UserCog, UserPlus, ZapOff, Activity, History, HelpCircle, FileUp, Building2, UserCircle, Save, Briefcase, RefreshCw, Edit3, BookOpen, Layers, UserPlus2, UserCheck2, HelpCircle as HelpIcon, Timer, ListTodo } from 'lucide-react';
import { analyzeProgress, ExtractedHireData, generateManagerNotification, generateEmailDraft, generateManagerDraft } from '../services/geminiService';
import { createModule, getModules, updateModule, deleteModule, restoreModule, getUserModulesBatch } from '../services/moduleService';
import type { UserModule as DbUserModule, ManagerTaskTemplate } from '../types/database';
import { createCohort, updateCohort, LEADER_ROLE_MAP, upsertCohortLeader } from '../services/cohortService';
import { getTaskTemplates, createTaskTemplate, updateTaskTemplate, deleteTaskTemplate, restoreTaskTemplate } from '../services/managerTaskService';
import { parseWorkdayExcel, importWorkdayData, ImportResult } from '../services/workdayImportService';
import { updateProfile, deleteProfile } from '../services/profileService';
import { sendSlackDM } from '../services/slackService';
import { useToast } from './Toast';
import confetti from 'canvas-confetti';
import { useAllUsers } from '../hooks/useTeam';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { useCohorts } from '../hooks/useCohorts';
import { syncLessonlyStatus } from '../services/lessonlySyncService';
import { getMessagesForUser, getMessagesSentBy, getMessageCounts, MessageRecord, GroupedMessages } from '../services/messageHistoryService';
import { supabase } from '../lib/supabase';

export type AdminViewMode = 'dashboard' | 'workflow' | 'tasks' | 'manager-tasks' | 'cohorts' | 'agenda' | 'communications' | 'engagement' | 'settings';

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

function getWeekBoundaries(startDateStr: string): { label: string; start: Date; end: Date }[] {
  const start = new Date(startDateStr + 'T00:00:00');
  const now = new Date();
  const weeks: { label: string; start: Date; end: Date }[] = [];
  let weekStart = new Date(start);
  let weekNum = 1;
  while (weekStart < now) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    weeks.push({ label: `Week ${weekNum}`, start: new Date(weekStart), end: weekEnd > now ? now : weekEnd });
    weekStart = weekEnd;
    weekNum++;
  }
  return weeks;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, viewMode, setViewMode }) => {
  const toast = useToast();
  // Real data hook for dashboard KPIs and AI analytics
  const { students, stats, loading: dashboardLoading, error: dashboardError, refetch: refetchDashboard } = useAdminDashboard();
  // Supabase hook for all users (admin view - used for registry, comms, etc.)
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
  const [manualHire, setManualHire] = useState({ firstName: '', lastName: '', email: '', startDate: '', location: '', role: '', department: '', region: '', userRole: 'New Hire' as UserRole, standardizedRole: '', managerId: '' });
  const [editingHireId, setEditingHireId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  const [trainingData, setTrainingData] = useState({ title: '', description: '', method: 'MANAGER_LED' as TrainingModule['type'], targetRole: 'All Roles', audience: 'cohort' as 'cohort' | 'direct', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
  const [taskCategory, setTaskCategory] = useState<'module' | 'call'>('module');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSuccess, setTaskSuccess] = useState(false);
  const [messageTarget, setMessageTarget] = useState<'managers' | 'newhires'>('newhires');
  const [messageSearch, setMessageSearch] = useState('');
  const [commsPanelUser, setCommsPanelUser] = useState<Profile | null>(null);
  const [commsPanelMessages, setCommsPanelMessages] = useState<MessageRecord[]>([]);
  const [commsPanelGrouped, setCommsPanelGrouped] = useState<GroupedMessages[]>([]);
  const [commsPanelLoading, setCommsPanelLoading] = useState(false);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const filteredCommsUsers = useMemo(() => {
    let filtered = allUsers.filter(p =>
      messageTarget === 'managers'
        ? p.role === 'Manager' || p.role === 'Admin'
        : p.role === 'New Hire'
    );
    if (messageSearch.trim()) {
      const q = messageSearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allUsers, messageTarget, messageSearch]);

  // Fetch message counts when communications view loads
  useEffect(() => {
    if (viewMode !== 'communications' || filteredCommsUsers.length === 0) return;
    const ids = filteredCommsUsers.map(u => u.id);
    const direction = messageTarget === 'newhires' ? 'received' : 'sent';
    getMessageCounts(ids, direction).then(setMessageCounts);
  }, [viewMode, filteredCommsUsers, messageTarget]);

  const openCommsPanel = async (profile: Profile) => {
    setCommsPanelUser(profile);
    setCommsPanelLoading(true);
    setExpandedMessages(new Set());
    try {
      if (profile.role === 'New Hire') {
        const msgs = await getMessagesForUser(profile.id);
        setCommsPanelMessages(msgs);
        setCommsPanelGrouped([]);
      } else {
        const grouped = await getMessagesSentBy(profile.id);
        setCommsPanelGrouped(grouped);
        setCommsPanelMessages([]);
      }
    } catch {
      setCommsPanelMessages([]);
      setCommsPanelGrouped([]);
    }
    setCommsPanelLoading(false);
  };

  const [commsDraft, setCommsDraft] = useState('');
  const [activeCommsAction, setActiveCommsAction] = useState<'email' | 'slack' | 'survey' | null>(null);
  const [selectedUserForComms, setSelectedUserForComms] = useState<{ id: string; name: string; email: string } | null>(null);
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
  const [taskFilters, setTaskFilters] = useState({ title: '', type: '', targetRole: '', audience: '' });
  const [agendaFilters, setAgendaFilters] = useState({ cohort: '', role: '' });
  const [showTaskBuilderModal, setShowTaskBuilderModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [showDeletedTasks, setShowDeletedTasks] = useState(false);
  const [confirmDeleteModuleId, setConfirmDeleteModuleId] = useState<string | null>(null);

  // Manager Tasks state
  const [managerTemplates, setManagerTemplates] = useState<ManagerTaskTemplate[]>([]);
  const [managerTemplatesLoading, setManagerTemplatesLoading] = useState(false);
  const [showManagerTaskBuilder, setShowManagerTaskBuilder] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showDeletedManagerTasks, setShowDeletedManagerTasks] = useState(false);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);
  const [managerTaskData, setManagerTaskData] = useState({ title: '', description: '', dueOffset: 0, timeEstimate: '', link: '' });
  const [managerTaskSearch, setManagerTaskSearch] = useState('');
  const [managerTaskSubmitting, setManagerTaskSubmitting] = useState(false);
  const [managerTaskSuccess, setManagerTaskSuccess] = useState(false);
  const [managerTaskError, setManagerTaskError] = useState<string | null>(null);

  useEffect(() => {
    setModulesLoading(true);
    getModules(true).then(data => { setAllModules(data); setModulesLoading(false); });
  }, []);

  // Fetch manager task templates
  useEffect(() => {
    if (viewMode === 'manager-tasks') {
      setManagerTemplatesLoading(true);
      getTaskTemplates(true).then(data => { setManagerTemplates(data); setManagerTemplatesLoading(false); });
    }
  }, [viewMode]);

  const filteredManagerTemplates = useMemo(() => {
    return managerTemplates.filter(t => {
      if (!showDeletedManagerTasks && (t as any).deleted_at) return false;
      if (managerTaskSearch && !t.title.toLowerCase().includes(managerTaskSearch.toLowerCase())) return false;
      return true;
    });
  }, [managerTemplates, showDeletedManagerTasks, managerTaskSearch]);

  // Active modules (excludes deleted) — used for calendar, stats, drilldown
  const activeModules = useMemo(() => allModules.filter(m => !(m as any).deleted_at), [allModules]);

  const filteredModules = useMemo(() => {
    return allModules.filter(mod => {
      if (!showDeletedTasks && (mod as any).deleted_at) return false;
      if (taskFilters.title && !mod.title.toLowerCase().includes(taskFilters.title.toLowerCase())) return false;
      if (taskFilters.type && mod.type !== taskFilters.type) return false;
      if (taskFilters.targetRole && (mod.target_role || '') !== taskFilters.targetRole) return false;
      if (taskFilters.audience) {
        const modAudience = (mod as any).audience || 'cohort';
        if (taskFilters.audience !== modAudience) return false;
      }
      return true;
    });
  }, [allModules, taskFilters, showDeletedTasks]);

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
      for (const mod of activeModules) {
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
    const managerUsers = allUsers.filter(u => u.role === 'Manager');
    return regions.map(name => {
      const managersInRegion = managerUsers.filter(m => m.region === name);
      const managerIds = managersInRegion.map(m => m.id);
      const hires = students.filter(h => managerIds.includes(h.managerId));
      const behind = hires.filter(isHireBehind).length;
      return { name, enrolled: hires.length, behind, onTrack: hires.length - behind, managers: managersInRegion, hiresList: hires };
    });
  }, [allUsers, students]);

  // Pre-compute real stats per cohort role+region slot (MxA-East, MxM-East, etc.)
  // Students have standardized_role matching leader role_label, and region matching leader region
  const cohortSlotStats = useMemo(() => {
    const statsMap = new Map<string, { hireCount: number; avgProgress: number; onTrack: number; atRisk: number }>();
    // Build a lookup: userId → standardized_role (from allUsers, which has this field)
    const userRoleMap = new Map(allUsers.map(u => [u.id, u.standardized_role || '']));
    const userRegionMap = new Map(allUsers.map(u => [u.id, u.region || '']));

    for (const cohort of cohorts) {
      const cohortStudents = students.filter(s => {
        if (!s.startDate) return false;
        return s.startDate >= cohort.hire_start_date && s.startDate <= cohort.hire_end_date;
      });
      for (const role of ['MxA', 'MxM', 'AGM', 'GM']) {
        for (const region of ['East', 'Central', 'West']) {
          const slotStudents = cohortStudents.filter(s =>
            userRoleMap.get(s.id) === role && userRegionMap.get(s.id) === region
          );
          const hireCount = slotStudents.length;
          const avgProgress = hireCount > 0 ? Math.round(slotStudents.reduce((sum, s) => sum + s.progress, 0) / hireCount) : 0;
          const atRisk = slotStudents.filter(isHireBehind).length;
          const onTrack = hireCount - atRisk;
          statsMap.set(`${cohort.id}-${role}-${region}`, { hireCount, avgProgress, onTrack, atRisk });
        }
      }
    }
    return statsMap;
  }, [students, cohorts, allUsers]);

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
      // Cohort membership based on standardized_role + region + start_date, not system role
      // Exclude profiles without a start_date — they can't be cohort members
      if (!u.start_date) return false;
      if (selectedCohortData) {
        if (u.start_date < selectedCohortData.hire_start_date || u.start_date > selectedCohortData.hire_end_date) return false;
      }
      return true;
    });
  }, [allUsers, selectedSlotRole, selectedSlotRegion, selectedCohortData]);

  const [userProgressMap, setUserProgressMap] = useState<Record<string, DbUserModule[]>>({});

  useEffect(() => {
    if (slotMembers.length === 0) { setUserProgressMap({}); return; }
    const ids = slotMembers.map(u => u.id);
    getUserModulesBatch(ids).then(rows => {
      const map: Record<string, DbUserModule[]> = {};
      for (const row of rows) {
        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push(row);
      }
      setUserProgressMap(map);
    });
  }, [slotMembers]);

  const [loginCount, setLoginCount] = useState(0);

  useEffect(() => {
    if (slotMembers.length === 0) { setLoginCount(0); return; }
    const ids = slotMembers.map(u => u.id);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    supabase
      .from('session_logs')
      .select('id', { count: 'exact', head: true })
      .in('user_id', ids)
      .gte('logged_in_at', sevenDaysAgo)
      .then(({ count }) => setLoginCount(count ?? 0));
  }, [slotMembers]);

  // Interaction count: messages sent by this manager to cohort students
  const [interactionCount, setInteractionCount] = useState(0);
  useEffect(() => {
    if (!selectedCohortManager || slotMembers.length === 0) { setInteractionCount(0); return; }
    const recipientIds = slotMembers.map(u => u.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('slack_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', selectedCohortManager.id)
      .in('recipient_id', recipientIds)
      .then(({ count }: { count: number | null }) => setInteractionCount(count ?? 0));
  }, [selectedCohortManager, slotMembers]);

  const [sessionLogs, setSessionLogs] = useState<{ user_id: string; logged_in_at: string }[]>([]);

  useEffect(() => {
    if (slotMembers.length === 0 || !selectedCohortData?.starting_date) { setSessionLogs([]); return; }
    const ids = slotMembers.map(u => u.id);
    supabase
      .from('session_logs')
      .select('user_id, logged_in_at')
      .in('user_id', ids)
      .gte('logged_in_at', selectedCohortData.starting_date)
      .order('logged_in_at', { ascending: true })
      .then(({ data }) => setSessionLogs(data ?? []));
  }, [slotMembers, selectedCohortData]);

  const avgProgressChartData = useMemo(() => {
    if (!selectedCohortData?.starting_date || slotMembers.length === 0) return [];
    const weeks = getWeekBoundaries(selectedCohortData.starting_date);
    return weeks.map(week => {
      const totalPct = slotMembers.reduce((sum, member) => {
        const modules = userProgressMap[member.id] || [];
        if (modules.length === 0) return sum;
        const completed = modules.filter(m => m.completed_at && new Date(m.completed_at) <= week.end).length;
        return sum + Math.round((completed / modules.length) * 100);
      }, 0);
      return { name: week.label, avgProgress: slotMembers.length > 0 ? Math.round(totalPct / slotMembers.length) : 0 };
    });
  }, [selectedCohortData, slotMembers, userProgressMap]);

  const loginsChartData = useMemo(() => {
    if (!selectedCohortData?.starting_date || slotMembers.length === 0) return [];
    const weeks = getWeekBoundaries(selectedCohortData.starting_date);
    return weeks.map(week => {
      const count = sessionLogs.filter(log => {
        const d = new Date(log.logged_in_at);
        return d >= week.start && d < week.end;
      }).length;
      return { name: week.label, logins: count };
    });
  }, [selectedCohortData, slotMembers, sessionLogs]);

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

  const handleManualHireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fullName = `${manualHire.firstName} ${manualHire.lastName}`.trim();
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(manualHire.firstName)}+${encodeURIComponent(manualHire.lastName)}&background=013E3F&color=F3EEE7`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: manualHire.email,
          name: fullName,
          role: manualHire.userRole,
          avatar,
          title: manualHire.role || null,
          location: manualHire.location || null,
          department: manualHire.department || null,
          region: manualHire.region || null,
          standardized_role: manualHire.standardizedRole || null,
          manager_id: manualHire.managerId || null,
          start_date: manualHire.startDate || null,
          provisioned: true,
        });

      if (insertError) {
        toast.error(`Failed to create member: ${insertError.message}`);
        return;
      }

      await refetchUsers();
      toast.success(`Success: ${fullName} created. Use Workday Import to assign training modules.`);
      setManualHire({ firstName: '', lastName: '', email: '', startDate: '', location: '', role: '', department: '', region: '', userRole: 'New Hire' as UserRole, standardizedRole: '', managerId: '' });
    } catch (err) {
      toast.error(`Error creating member: ${err instanceof Error ? err.message : String(err)}`);
    }
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
      toast.error('Failed to save changes. Please try again.');
    }
  };

  const handleDeleteHire = async () => {
    if (!confirmDeleteId) return;
    const success = await deleteProfile(confirmDeleteId);
    if (success) {
      await refetchUsers();
      setConfirmDeleteId(null);
      setEditingHireId(null);
      toast.success('Member deleted successfully.');
    } else {
      toast.error('Failed to delete member. Please try again.');
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
      audience: (mod.audience === 'direct' ? 'direct' : 'cohort') as 'cohort' | 'direct',
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
      description: trainingData.description || null,
      type: (taskCategory === 'call' ? 'LIVE_CALL' : trainingData.method) as ModuleType,
      link: link || null,
      target_role: trainingData.targetRole === 'All Roles' ? null : trainingData.targetRole,
      audience: trainingData.audience,
      day_offset: trainingData.assignmentDay,
    };

    const result = editingModuleId
      ? await updateModule(editingModuleId, payload)
      : await createModule(payload);

    setSubmitting(false);

    if (result) {
      setTaskSuccess(true);
      setTimeout(() => {
        setTrainingData({ title: '', description: '', method: 'MANAGER_LED', targetRole: 'All Roles', audience: 'cohort', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
        setTaskCategory('module');
        setLink('');
        setTaskSuccess(false);
        setEditingModuleId(null);
        setShowTaskBuilderModal(false);
        getModules(true).then(data => setAllModules(data));
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
    const result = await analyzeProgress(students);
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
      toast.success('Unit Ops-Comms Calendar Synced Successfully!');
    }, 1800);
  };

  const handleInitiateComms = async (
    targetUser: { id: string; name: string; email: string },
    type: 'email' | 'slack' | 'survey'
  ) => {
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
      const isSlack = type === 'slack';
      const targetProfile = allUsers.find(u => u.id === targetUser.id);
      const isManager = targetProfile?.role === 'Manager' || targetProfile?.role === 'Admin';

      let draft: string;

      if (isManager) {
        // Manager target: summarize their students' progress
        // Find students managed by this person (by manager_id or cohort)
        const managerStudents = students.filter(s => s.managerId === targetUser.id);
        const summaries = managerStudents.map(s => ({
          name: s.name,
          progress: s.progress,
          completedCount: s.modules.filter(m => m.completed).length,
          totalCount: s.modules.length,
          overdueItems: s.modules
            .filter(m => !m.completed && new Date(m.dueDate + 'T00:00:00') < new Date())
            .map(m => m.title),
        }));
        draft = await generateManagerDraft(user.name, targetUser.name, summaries, isSlack);
      } else {
        // Student target: direct message about their progress
        const studentData = students.find(s => s.id === targetUser.id);
        const progress = studentData?.progress || 0;
        const overdueItems = studentData?.modules
          .filter(m => !m.completed && new Date(m.dueDate + 'T00:00:00') < new Date())
          .map(m => m.title) || [];
        const topic = isSlack ? 'Quick check-in on Slack' : 'Onboarding progress update';
        draft = await generateEmailDraft(targetUser.name, user.name, progress, topic, overdueItems);
      }

      // Remove subject line for Slack messages
      const cleanedDraft = isSlack
        ? draft.replace(/^Subject:.*\n+/im, '').trim()
        : draft;
      setCommsDraft(cleanedDraft);
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

  const behindEmployees = useMemo(() => students.filter(isHireBehind), [students]);
  const enrolledCount = stats.activeCount;
  const avgCompletion = stats.avgProgress;
  const behindCount = stats.atRiskCount;

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
            {viewMode === 'tasks' && 'Tasks - Student'}
            {viewMode === 'manager-tasks' && 'Tasks - Manager'}
            {viewMode === 'settings' && 'Settings'}
          </h2>
          <p className="text-[#F3EEE7]/70 mt-2 font-light text-lg">
            {viewMode === 'dashboard' && 'High-level status of Industrious onboarding.'}
            {viewMode === 'workflow' && 'Import team members, manage active registry, and automate training.'}
            {viewMode === 'tasks' && 'Manage training modules and assignments.'}
            {viewMode === 'manager-tasks' && 'Manage onboarding tasks assigned to managers for their new hires.'}
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
              <div className="bg-[#002b2c] p-6 rounded-lg text-sm leading-relaxed">{analyzing ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /> : analysisResult ? <div className="space-y-3">{analysisResult.split('\n').filter(l => l.trim()).map((line, i) => {
                const rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#FDD344]">$1</strong>').replace(/^- /, '');
                const isBullet = line.trimStart().startsWith('- ');
                return <div key={i} className={`${isBullet ? 'flex gap-2' : ''}`}>{isBullet && <span className="text-[#FDD344] mt-0.5 shrink-0">&#8226;</span>}<span dangerouslySetInnerHTML={{ __html: rendered }} /></div>;
              })}</div> : <span className="italic opacity-70">Request a regional analysis to see performance trends across cohorts.</span>}</div>
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
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Role (Title)</label><input className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.role} onChange={e => setManualHire({...manualHire, role: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Start Date</label><div className="relative"><input type="date" required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 text-transparent cursor-pointer" value={manualHire.startDate} onChange={e => setManualHire({...manualHire, startDate: e.target.value})} /><span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-[#F3EEE7] pointer-events-none">{manualHire.startDate ? formatDate(manualHire.startDate) : ''}</span></div></div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Logistics</h4>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Department</label><input className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.department} onChange={e => setManualHire({...manualHire, department: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Location</label><input className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={manualHire.location} onChange={e => setManualHire({...manualHire, location: e.target.value})} /></div>
                         </div>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Region</label><select required className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 text-[#F3EEE7]" value={manualHire.region} onChange={e => setManualHire({...manualHire, region: e.target.value})}><option value="">Select Region</option><option value="East">East</option><option value="Central">Central</option><option value="West">West</option></select></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">System Role</label><select className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 text-[#F3EEE7]" value={manualHire.userRole} onChange={e => setManualHire({...manualHire, userRole: e.target.value as UserRole})}><option value="New Hire">New Hire</option><option value="Manager">Manager</option><option value="Admin">Admin</option></select></div>
                         </div>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Assigned Manager</label><select className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 text-[#F3EEE7]" value={manualHire.managerId} onChange={e => setManualHire({...manualHire, managerId: e.target.value})}><option value="">None</option>{allUsers.filter(u => u.role === 'Manager' || u.role === 'Admin').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Std. Role</label><select className="w-full bg-[#013E3F] border-b-2 border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 text-[#F3EEE7]" value={manualHire.standardizedRole} onChange={e => setManualHire({...manualHire, standardizedRole: e.target.value})}><option value="">No Role</option><option value="MxA">MxA</option><option value="MxM">MxM</option><option value="AGM">AGM</option><option value="GM">GM</option><option value="RD">RD</option></select></div>
                         </div>
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
                          <td colSpan={8} className="px-8 py-16 text-center">
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
                          <td className="px-8 py-5 text-xs text-[#013E3F]/60">{profile.start_date ? formatDate(profile.start_date) : '—'}</td>
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeletedTasks(!showDeletedTasks)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${showDeletedTasks ? 'bg-red-100 text-red-600 border border-red-200' : 'text-[#013E3F]/40 hover:text-[#013E3F] border border-[#013E3F]/10'}`}
                >
                  {showDeletedTasks ? 'Hide Deleted' : 'Show Deleted'}
                </button>
                <button
                  onClick={() => {
                    setEditingModuleId(null);
                    setTrainingData({ title: '', description: '', method: 'MANAGER_LED', targetRole: 'All Roles', audience: 'cohort', assignmentDay: 0, hasWorkbook: false, workbookContent: '' });
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
            </div>
            {modulesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#013E3F]/40">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Loading tasks…</p>
              </div>
            ) : allModules.length === 0 && !taskFilters.title && !taskFilters.type && !taskFilters.targetRole && !taskFilters.audience ? (
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
                      <th className="px-8 py-4">Audience</th>
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
                      <th className="px-8 py-2">
                        <select
                          value={taskFilters.audience}
                          onChange={e => setTaskFilters(f => ({ ...f, audience: e.target.value }))}
                          className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none"
                        >
                          <option value="">All</option>
                          <option value="cohort">Cohort</option>
                          <option value="direct">Direct Reports</option>
                        </select>
                      </th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EEE7]">
                    {filteredModules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-8 py-16 text-center">
                          <p className="text-sm font-bold text-[#013E3F]/40">No tasks match the current filters</p>
                          <button
                            onClick={() => setTaskFilters({ title: '', type: '', targetRole: '', audience: '' })}
                            className="mt-3 text-xs font-bold uppercase tracking-wider text-[#013E3F]/60 hover:text-[#013E3F] underline underline-offset-2"
                          >
                            Clear filters
                          </button>
                        </td>
                      </tr>
                    ) : filteredModules.map(mod => {
                      const isDeleted = !!(mod as any).deleted_at;
                      return (
                      <tr key={mod.id} onClick={() => !isDeleted && openEditModal(mod)} className={`transition-colors ${isDeleted ? 'opacity-50 bg-red-50/30' : 'hover:bg-[#F9F7F5] cursor-pointer'}`}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <p className={`font-serif font-bold text-[#013E3F] ${isDeleted ? 'line-through' : ''}`}>{mod.title}</p>
                            {isDeleted && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-600">Deleted</span>}
                            {isDeleted && <button onClick={(e) => { e.stopPropagation(); restoreModule(mod.id).then(ok => ok && getModules(true).then(setAllModules)); }} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Restore</button>}
                          </div>
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
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            (mod as any).audience === 'direct' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          }`}>{(mod as any).audience === 'direct' ? 'Direct' : 'Cohort'}</span>
                        </td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{mod.duration || '—'}</td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{mod.host || '—'}</td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">
                          {mod.link ? (
                            <a href={mod.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline truncate block max-w-[200px]">
                              {mod.link.length > 40 ? mod.link.slice(0, 40) + '…' : mod.link}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-8 py-5 text-xs text-[#013E3F]/60">{formatDate(mod.created_at)}</td>
                      </tr>
                      );
                    })}
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
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 w-fit">
                    <button type="button" onClick={() => { setTaskCategory('module'); setTrainingData({...trainingData, method: 'MANAGER_LED'}); }} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${taskCategory === 'module' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}>Module</button>
                    <button type="button" onClick={() => { setTaskCategory('call'); setTrainingData({...trainingData, method: 'LIVE_CALL'}); }} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${taskCategory === 'call' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}>Call</button>
                  </div>
                  <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 w-fit">
                    <button type="button" onClick={() => setTrainingData({...trainingData, audience: 'cohort'})} className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${trainingData.audience === 'cohort' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}>Cohort</button>
                    <button type="button" onClick={() => setTrainingData({...trainingData, audience: 'direct'})} className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${trainingData.audience === 'direct' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'}`}>Direct</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <h4 className="text-[11px] font-bold uppercase text-[#F3EEE7]/40 tracking-[3px] border-b border-[#F3EEE7]/10 pb-2">Structure</h4>
                    <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Module Title</label><input required className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" placeholder="Member Crisis Resolution" value={trainingData.title} onChange={e => setTrainingData({...trainingData, title: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Description</label><textarea className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 px-3 rounded-lg text-sm h-20 resize-none" placeholder="Brief description of this module..." value={trainingData.description} onChange={e => setTrainingData({...trainingData, description: e.target.value})} /></div>
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
                <div className="pt-8 border-t border-[#F3EEE7]/10 flex items-center gap-3">
                  {editingModuleId && (
                    <button type="button" onClick={() => setConfirmDeleteModuleId(editingModuleId)} className="px-6 py-3 rounded-xl font-bold uppercase text-xs border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors">Delete</button>
                  )}
                  <div className="flex-1" />
                  <button type="submit" disabled={submitting || taskSuccess} className={`px-12 py-3 rounded-xl font-bold uppercase text-xs transition-colors ${taskSuccess ? 'bg-green-600 text-white' : 'bg-[#FDD344] text-[#013E3F]'}`}>{taskSuccess ? (editingModuleId ? '✓ Task Updated' : '✓ Task Assigned') : submitting ? 'Saving...' : (editingModuleId ? 'Update Task' : 'Assign Resource')}</button>
                  {taskError && <p className="text-red-400 text-xs">{taskError}</p>}
                </div>
                {confirmDeleteModuleId && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-800 mb-3">Are you sure you want to delete <strong>{trainingData.title}</strong>? This module will be hidden from all student and manager views. Student progress is preserved.</p>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setConfirmDeleteModuleId(null)} className="px-4 py-2 text-xs font-bold uppercase rounded-lg border text-[#013E3F] hover:bg-gray-50">Cancel</button>
                      <button type="button" onClick={async () => {
                        const ok = await deleteModule(confirmDeleteModuleId);
                        if (ok) {
                          toast.success('Task deleted.');
                          setConfirmDeleteModuleId(null);
                          setShowTaskBuilderModal(false);
                          setEditingModuleId(null);
                          getModules(true).then(setAllModules);
                        } else {
                          toast.error('Failed to delete task.');
                        }
                      }} className="px-4 py-2 text-xs font-bold uppercase rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
                    </div>
                  </div>
                )}
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
                            <td className="px-8 py-5 text-xs font-bold text-[#013E3F]/60">{formatDate(cohort.hire_start_date)} — {formatDate(cohort.hire_end_date)}</td>
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
                            // Real stats per role+region slot
                            const slotStats = selectedCohort ? cohortSlotStats.get(`${selectedCohort}-${role}-${region}`) : undefined;
                            const avgProgress = slotStats?.avgProgress ?? 0;
                            const onTrack = slotStats?.onTrack ?? 0;
                            const behind = slotStats?.atRisk ?? 0;
                            const hireCount = slotStats?.hireCount ?? 0;
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
                 <div className="bg-[#013E3F] text-[#F3EEE7] px-8 py-6 rounded-2xl border border-[#F3EEE7]/10 relative overflow-hidden">
                   <div className="flex flex-wrap items-center justify-between gap-6 z-10 relative">
                     {/* Left: Back + Identity */}
                     <div className="flex items-center gap-4">
                       <button
                         onClick={() => { setSelectedCohortManager(null); setSelectedSlotRole(null); setSelectedSlotRegion(null); }}
                         className="text-[#F3EEE7]/40 hover:text-[#FDD344] transition-colors shrink-0"
                         title="Back"
                       >
                         <ArrowLeft className="w-5 h-5" />
                       </button>
                       <img
                         src={selectedCohortManager.avatar}
                         alt={selectedCohortManager.name}
                         className="w-14 h-14 rounded-full border-2 border-[#FDD344] shrink-0"
                       />
                       <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-[#F3EEE7]/40 mb-0.5">
                           {selectedSlotRole} Leader &middot; {selectedSlotRegion} Region
                         </p>
                         <h3 className="font-serif text-2xl leading-tight">{selectedCohortManager.name}</h3>
                       </div>
                     </div>

                     {/* Center: Mode Toggle */}
                     <div className="flex bg-white/10 p-1 rounded-xl border border-white/10">
                       <button
                         onClick={() => setManagerMetricMode('snapshot')}
                         className={`px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                           managerMetricMode === 'snapshot' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'
                         }`}
                       >
                         <LayoutDashboard className="w-3.5 h-3.5" /> Snapshot
                       </button>
                       <button
                         onClick={() => setManagerMetricMode('history')}
                         className={`px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                           managerMetricMode === 'history' ? 'bg-[#FDD344] text-[#013E3F]' : 'text-white/60 hover:text-white'
                         }`}
                       >
                         <History className="w-3.5 h-3.5" /> History
                       </button>
                     </div>

                     {/* Right: Reassign Action */}
                     <div className="flex items-center gap-3 shrink-0">
                       <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#F3EEE7]/30">
                         <RefreshCw className="w-3.5 h-3.5" />
                         Reassign
                       </div>
                       <select
                         className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-[#F3EEE7] focus:outline-none focus:border-[#FDD344]/50 cursor-pointer"
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
                   </div>

                   {/* Decorative element */}
                   <div className="absolute right-0 top-0 w-64 h-full bg-[#FDD344]/5 skew-x-[-15deg] translate-x-20" />
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
                         const memberCount = slotMembers.length;
                         const avgProgress = memberCount > 0
                           ? Math.round(slotMembers.reduce((acc, m) => {
                               const prog = userProgressMap[m.id] || [];
                               const completed = prog.filter(p => p.completed).length;
                               return acc + (activeModules.length > 0 ? (completed / activeModules.length) * 100 : 0);
                             }, 0) / memberCount)
                           : 0;
                         const today = new Date().toISOString().split('T')[0];
                         const cohortStart = selectedCohortData?.starting_date;
                         const overdueCount = slotMembers.reduce((acc, m) => {
                           const prog = userProgressMap[m.id] || [];
                           const progressMap = new Map(prog.map(p => [p.module_id, p]));
                           return acc + allModules.filter(mod => {
                             const p = progressMap.get(mod.id);
                             if (p?.completed) return false;
                             const due = cohortStart
                               ? new Date(new Date(cohortStart + 'T00:00:00').getTime() + (mod.day_offset ?? 0) * 86400000).toISOString().split('T')[0]
                               : today;
                             return due < today;
                           }).length;
                         }, 0);
                         return (
                           <>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">Avg Progress</p><p className="text-3xl font-serif text-[#013E3F]">{avgProgress}%</p></div>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">Interactions</p><p className="text-3xl font-serif text-[#013E3F]">{interactionCount > 0 ? `${interactionCount} msg${interactionCount === 1 ? '' : 's'}` : 'None'}</p></div>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">At-Risk Response</p><p className="text-3xl font-serif text-[#013E3F]">{overdueCount > 0 ? `${overdueCount} overdue` : 'None'}</p></div>
                             <div className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 shadow-sm"><p className="text-[10px] font-bold text-[#013E3F]/40 uppercase tracking-widest mb-1">Logins</p><p className="text-3xl font-serif text-[#013E3F]">{loginCount > 0 ? `${loginCount} login${loginCount === 1 ? '' : 's'}` : 'None'}</p></div>
                           </>
                         );
                       })()}
                     </div>
                     {/* Cohort Members from Supabase profiles */}
                     {slotMembers.length > 0 ? (
                       <div>
                         <h4 className="text-xs font-bold uppercase tracking-widest text-[#013E3F]/40 mb-4">
                           {selectedSlotRole} Members — {selectedSlotRegion} Region ({slotMembers.length})
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {slotMembers.map(profile => {
                             const userProgress = userProgressMap[profile.id] || [];
                             const completedCount = userProgress.filter(up => up.completed).length;
                             const progress = activeModules.length > 0
                               ? Math.round((completedCount / activeModules.length) * 100)
                               : 0;
                             const avatarUrl = profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=013E3F&color=F3EEE7`;
                             return (
                               <div key={profile.id} onClick={() => {
                                const cohortStart = selectedCohortData?.starting_date;
                                const memberProgress = userProgressMap[profile.id] || [];
                                const progressByModuleId = new Map(memberProgress.map(p => [p.module_id, p]));
                                const userModules = activeModules
                                  .map(mod => {
                                    const prog = progressByModuleId.get(mod.id);
                                    const dueDate = cohortStart
                                      ? new Date(new Date(cohortStart + 'T00:00:00').getTime() + (mod.day_offset ?? 0) * 86400000).toISOString().split('T')[0]
                                      : new Date().toISOString().split('T')[0];
                                    return {
                                      id: mod.id,
                                      title: mod.title,
                                      description: mod.description || '',
                                      type: mod.type as TrainingModule['type'],
                                      duration: mod.duration || '',
                                      completed: prog?.completed || false,
                                      dueDate,
                                      link: mod.link || undefined,
                                      host: mod.host || undefined,
                                      score: prog?.score || undefined,
                                    };
                                  });
                                const modalProgress = userModules.length > 0
                                  ? Math.round((userModules.filter(m => m.completed).length / userModules.length) * 100)
                                  : 0;
                                const drilldownHire = { id: profile.id, name: profile.name, role: profile.role as UserRole, avatar: avatarUrl, title: profile.title || '—', email: profile.email, managerId: profile.manager_id || '', startDate: profile.start_date || new Date().toISOString(), progress: modalProgress, department: profile.department || '', modules: userModules }; setSelectedHireForDrilldown(drilldownHire); setDrilldownTab('overview'); syncLessonlyStatus(profile.id, profile.email, userModules); }} className="bg-white p-6 rounded-2xl border border-[#013E3F]/10 hover:border-[#FDD344] transition-all group cursor-pointer shadow-sm relative overflow-hidden">
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
                      {/* Avg Progress Trend */}
                      <div className="bg-white p-8 rounded-2xl border border-[#013E3F]/10 shadow-sm h-[320px] flex flex-col">
                        <h4 className="font-serif text-lg text-[#013E3F] mb-6 flex items-center justify-between">
                          Avg. Progress Trend (%)
                          <TrendingUp className="w-4 h-4 opacity-30" />
                        </h4>
                        {avgProgressChartData.length > 0 ? (
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={avgProgressChartData}>
                                <defs>
                                  <linearGradient id="grad-avgProgress" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#013E3F" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#013E3F" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#013E3F40'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#013E3F40'}} unit="%" />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} cursor={{ stroke: '#013E3F', strokeWidth: 1 }} />
                                <Area type="monotone" dataKey="avgProgress" stroke="#013E3F" strokeWidth={3} fillOpacity={1} fill="url(#grad-avgProgress)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-[#013E3F]/30">
                            <CheckCircle className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm font-medium">No completion data yet</p>
                          </div>
                        )}
                      </div>

                      {/* Monthly Interactions — empty state */}
                      <div className="bg-white p-8 rounded-2xl border border-[#013E3F]/10 shadow-sm h-[320px] flex flex-col">
                        <h4 className="font-serif text-lg text-[#013E3F] mb-6 flex items-center justify-between">
                          Monthly Interactions
                          <TrendingUp className="w-4 h-4 opacity-30" />
                        </h4>
                        <div className="flex-1 flex flex-col items-center justify-center text-[#013E3F]/30">
                          <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                          <p className="text-sm font-medium">No data yet</p>
                          <p className="text-xs mt-1 opacity-60">Debrief and sign-off tracking coming soon</p>
                        </div>
                      </div>

                      {/* At-Risk Response — empty state */}
                      <div className="bg-white p-8 rounded-2xl border border-[#013E3F]/10 shadow-sm h-[320px] flex flex-col">
                        <h4 className="font-serif text-lg text-[#013E3F] mb-6 flex items-center justify-between">
                          At-Risk Response
                          <TrendingUp className="w-4 h-4 opacity-30" />
                        </h4>
                        <div className="flex-1 flex flex-col items-center justify-center text-[#013E3F]/30">
                          <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
                          <p className="text-sm font-medium">No data yet</p>
                          <p className="text-xs mt-1 opacity-60">Overdue task acknowledgment tracking coming soon</p>
                        </div>
                      </div>

                      {/* Weekly Logins */}
                      <div className="bg-white p-8 rounded-2xl border border-[#013E3F]/10 shadow-sm h-[320px] flex flex-col">
                        <h4 className="font-serif text-lg text-[#013E3F] mb-6 flex items-center justify-between">
                          Weekly Logins
                          <TrendingUp className="w-4 h-4 opacity-30" />
                        </h4>
                        {loginsChartData.length > 0 ? (
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={loginsChartData}>
                                <defs>
                                  <linearGradient id="grad-logins" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#013E3F40'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#013E3F40'}} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} cursor={{ stroke: '#3B82F6', strokeWidth: 1 }} />
                                <Area type="monotone" dataKey="logins" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#grad-logins)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-[#013E3F]/30">
                            <Activity className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm font-medium">No login data yet</p>
                          </div>
                        )}
                      </div>
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
                  <div className="relative"><input type="date" value={newCohortStartDate} onChange={e => setNewCohortStartDate(e.target.value)} className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-transparent focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20 cursor-pointer" /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#013E3F] pointer-events-none">{newCohortStartDate ? formatDate(newCohortStartDate) : 'Select date'}</span></div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-2">Hire End Date</label>
                  <div className="relative"><input type="date" value={newCohortEndDate} onChange={e => setNewCohortEndDate(e.target.value)} className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-transparent focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20 cursor-pointer" /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#013E3F] pointer-events-none">{newCohortEndDate ? formatDate(newCohortEndDate) : 'Select date'}</span></div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#013E3F]/40 mb-2">Training Starting Date</label>
                  <div className="relative"><input type="date" value={newCohortStartingDate} onChange={e => setNewCohortStartingDate(e.target.value)} className="w-full border border-[#013E3F]/10 rounded-xl px-4 py-3 text-sm text-transparent focus:outline-none focus:ring-2 focus:ring-[#013E3F]/20 cursor-pointer" /><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#013E3F] pointer-events-none">{newCohortStartingDate ? formatDate(newCohortStartingDate) : 'Select date'}</span></div>
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
                                  <p className="text-xs text-red-400 font-medium">Due: {formatDate(m.dueDate)}</p>
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
                              <th className="p-4 text-center">Score</th>
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
                                      {isOverdue && <span className="text-red-500 text-[10px] font-bold uppercase mt-1">Overdue since {formatDate(m.dueDate)}</span>}
                                    </div>
                                  </td>
                                  <td className="p-4 text-xs font-bold text-[#013E3F]/60">{m.host || 'General Manager'}</td>
                                  <td className="p-4 text-center">
                                    {m.score != null ? <span className="text-xs font-bold text-[#013E3F]">{m.score}%</span> : <span className="text-xs text-[#013E3F]/20">—</span>}
                                  </td>
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
                       <p className="text-[#013E3F]/70 mb-4">Track the tasks {allUsers.find(u => u.id === selectedHireForDrilldown.managerId)?.name || 'the manager'} is responsible for.</p>
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
                                {formatDate(event.date)}
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
                      {formatDate(ev.date)}
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
           <div className="flex items-center gap-4 flex-wrap">
             <div className="flex gap-1 p-1 bg-[#012d2e] rounded-xl w-fit">
               <button onClick={() => { setMessageTarget('newhires'); setMessageSearch(''); }} className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest ${messageTarget === 'newhires' ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60'}`}>New Hires</button>
               <button onClick={() => { setMessageTarget('managers'); setMessageSearch(''); }} className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest ${messageTarget === 'managers' ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60'}`}>Managers</button>
             </div>
             <div className="relative flex-1 max-w-xs">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F3EEE7]/40" />
               <input
                 type="text"
                 placeholder="Search by name, email, or title…"
                 value={messageSearch}
                 onChange={e => setMessageSearch(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-[#012d2e] border border-[#F3EEE7]/10 rounded-xl text-sm text-[#F3EEE7] placeholder-[#F3EEE7]/30 focus:outline-none focus:ring-1 focus:ring-[#FDD344]/50"
               />
             </div>
           </div>
           {filteredCommsUsers.length === 0 ? (
             <div className="bg-white/5 border border-[#F3EEE7]/10 rounded-2xl p-12 text-center">
               <Users className="w-10 h-10 text-[#F3EEE7]/20 mx-auto mb-3" />
               <p className="text-[#F3EEE7]/40 text-sm">{usersLoading ? 'Loading users…' : 'No users found'}</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {filteredCommsUsers.map(profile => (
                 <div key={profile.id} className="bg-white rounded-2xl p-6 border border-[#013E3F]/10 shadow-sm hover:border-[#FDD344] transition-colors cursor-pointer" onClick={() => openCommsPanel(profile)}>
                   <div className="flex items-center gap-4 mb-6">
                     <div className="relative">
                       <img src={profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=013E3F&color=F3EEE7`} className="w-12 h-12 rounded-full" />
                       {messageCounts[profile.id] > 0 && (
                         <span className="absolute -top-1 -right-1 bg-[#FDD344] text-[#013E3F] text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{messageCounts[profile.id]}</span>
                       )}
                     </div>
                     <div>
                       <h4 className="font-bold text-[#013E3F] truncate">{profile.name}</h4>
                       <p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{profile.title || profile.standardized_role || profile.role}</p>
                     </div>
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                     <button onClick={() => handleInitiateComms(profile, 'slack')} className="flex flex-col items-center p-3 rounded-xl border border-[#013E3F]/15 bg-[#013E3F]/5 hover:bg-[#FDD344]/20 hover:border-[#FDD344]/40 transition-colors text-[#013E3F]">
                       <Slack className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Slack</span>
                     </button>
                     <button disabled title="Coming soon" className="flex flex-col items-center p-3 rounded-xl border border-[#013E3F]/10 bg-[#F3EEE7]/30 opacity-40 cursor-not-allowed text-[#013E3F]/50">
                       <Mail className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Email</span>
                     </button>
                     <button disabled title="Coming soon" className="flex flex-col items-center p-3 rounded-xl border border-[#013E3F]/10 bg-[#F3EEE7]/30 opacity-40 cursor-not-allowed text-[#013E3F]/50">
                       <ClipboardCheck className="w-5 h-5 mb-1" /><span className="text-[9px] font-bold uppercase">Survey</span>
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

      {/* COMMS HISTORY SIDE PANEL */}
      {commsPanelUser && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setCommsPanelUser(null)} onKeyDown={e => e.key === 'Escape' && setCommsPanelUser(null)}>
          <div className="bg-black/30 absolute inset-0" />
          <div className="relative w-[420px] max-w-full bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 bg-[#013E3F] text-white flex items-center gap-4">
              <img src={commsPanelUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(commsPanelUser.name)}&background=013E3F&color=F3EEE7`} className="w-10 h-10 rounded-full border border-white/20" />
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-lg truncate">{commsPanelUser.name}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/60">{commsPanelUser.role === 'New Hire' ? 'Messages Received' : 'Messages Sent'}</p>
              </div>
              <button onClick={() => setCommsPanelUser(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Disclaimer */}
            <div className="px-6 py-2 bg-[#F3EEE7] text-[10px] text-[#013E3F]/50 uppercase tracking-wider border-b border-[#013E3F]/5">
              Showing messages sent from Flight School
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {commsPanelLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#013E3F]/30" /></div>
              ) : commsPanelUser.role === 'New Hire' ? (
                /* Student view: chronological */
                commsPanelMessages.length === 0 ? (
                  <div className="text-center py-12"><MessageCircle className="w-8 h-8 text-[#013E3F]/10 mx-auto mb-3" /><p className="text-sm text-[#013E3F]/40">No messages sent yet</p></div>
                ) : (
                  <div className="space-y-4">
                    {commsPanelMessages.map(msg => (
                      <div key={msg.id} className="border border-[#013E3F]/10 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-[#013E3F]">{msg.senderName}</span>
                          <span className="text-[10px] text-[#013E3F]/40">{formatDate(msg.sentAt)}</span>
                        </div>
                        <p className="text-sm text-[#013E3F]/70 leading-relaxed">
                          {expandedMessages.has(msg.id) || msg.messageText.length <= 150
                            ? msg.messageText
                            : msg.messageText.substring(0, 150) + '...'}
                        </p>
                        {msg.messageText.length > 150 && (
                          <button onClick={() => setExpandedMessages(prev => { const s = new Set(prev); s.has(msg.id) ? s.delete(msg.id) : s.add(msg.id); return s; })} className="text-[10px] font-bold text-[#FDD344] mt-1">{expandedMessages.has(msg.id) ? 'Show less' : 'Show more'}</button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Manager view: grouped by student */
                commsPanelGrouped.length === 0 ? (
                  <div className="text-center py-12"><MessageCircle className="w-8 h-8 text-[#013E3F]/10 mx-auto mb-3" /><p className="text-sm text-[#013E3F]/40">No messages sent yet</p></div>
                ) : (
                  <div className="space-y-6">
                    {commsPanelGrouped.map(group => (
                      <div key={group.recipientId}>
                        <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setExpandedMessages(prev => { const s = new Set(prev); s.has(group.recipientId) ? s.delete(group.recipientId) : s.add(group.recipientId); return s; })}>
                          <img src={group.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.recipientName)}&background=013E3F&color=F3EEE7`} className="w-8 h-8 rounded-full" />
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-[#013E3F]">{group.recipientName}</h4>
                          </div>
                          <span className="bg-[#FDD344] text-[#013E3F] text-[9px] font-bold px-2 py-0.5 rounded-full">{group.count} msg{group.count !== 1 ? 's' : ''}</span>
                        </div>
                        {expandedMessages.has(group.recipientId) && (
                          <div className="ml-11 space-y-3 border-l-2 border-[#F3EEE7] pl-4">
                            {group.messages.map(msg => (
                              <div key={msg.id} className="text-sm">
                                <span className="text-[10px] text-[#013E3F]/40">{formatDate(msg.sentAt)}</span>
                                <p className="text-[#013E3F]/70 leading-relaxed mt-0.5">
                                  {msg.messageText.length <= 150 ? msg.messageText : msg.messageText.substring(0, 150) + '...'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>,
      document.body)}

      {/* MANAGER TASKS VIEW */}
      {viewMode === 'manager-tasks' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-[#013E3F]/10 overflow-hidden">
            <div className="p-8 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-serif text-[#013E3F]">Manager Task Templates</h3>
                <p className="text-sm italic text-[#013E3F]/60 mt-4 leading-relaxed">
                  <strong>All Templates:</strong> Onboarding tasks that managers must complete for each new hire.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeletedManagerTasks(!showDeletedManagerTasks)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${showDeletedManagerTasks ? 'bg-red-100 text-red-600 border border-red-200' : 'text-[#013E3F]/40 hover:text-[#013E3F] border border-[#013E3F]/10'}`}
                >
                  {showDeletedManagerTasks ? 'Hide Deleted' : 'Show Deleted'}
                </button>
                <button
                  onClick={() => {
                    setEditingTemplateId(null);
                    setManagerTaskData({ title: '', description: '', dueOffset: 0, timeEstimate: '', link: '' });
                    setManagerTaskError(null);
                    setManagerTaskSuccess(false);
                    setConfirmDeleteTemplateId(null);
                    setShowManagerTaskBuilder(true);
                  }}
                  className="flex items-center gap-2 bg-[#013E3F] text-[#FDD344] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#013E3F]/80 transition-colors shadow-md"
                >
                  <Plus className="w-4 h-4" /> New Task
                </button>
              </div>
            </div>
            {managerTemplatesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#013E3F]/40">
                <Loader2 className="w-8 h-8 animate-spin mb-2" /><p className="text-sm">Loading templates...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F9F7F5] text-[#013E3F]/60 text-xs uppercase tracking-wider font-bold border-b border-[#013E3F]/10">
                    <tr>
                      <th className="px-8 py-4">Title</th>
                      <th className="px-8 py-4">Day Offset</th>
                      <th className="px-8 py-4">Time Estimate</th>
                      <th className="px-8 py-4">Link</th>
                      <th className="px-8 py-4">Created</th>
                    </tr>
                    <tr className="bg-white border-b border-[#013E3F]/10">
                      <th className="px-8 py-2">
                        <input type="text" placeholder="Search title…" value={managerTaskSearch} onChange={e => setManagerTaskSearch(e.target.value)} className="text-xs bg-white border border-[#013E3F]/15 rounded-md px-2 py-1.5 text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] w-full font-normal normal-case tracking-normal outline-none" />
                      </th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EEE7]">
                    {filteredManagerTemplates.length === 0 ? (
                      <tr><td colSpan={5} className="px-8 py-16 text-center"><p className="text-sm font-bold text-[#013E3F]/40">No templates found</p></td></tr>
                    ) : filteredManagerTemplates.map(tmpl => {
                      const isDeleted = !!(tmpl as any).deleted_at;
                      return (
                        <tr key={tmpl.id} onClick={() => {
                          if (isDeleted) return;
                          setEditingTemplateId(tmpl.id);
                          setManagerTaskData({ title: tmpl.title, description: tmpl.description || '', dueOffset: tmpl.due_date_offset, timeEstimate: tmpl.time_estimate || '', link: tmpl.link || '' });
                          setManagerTaskError(null);
                          setManagerTaskSuccess(false);
                          setConfirmDeleteTemplateId(null);
                          setShowManagerTaskBuilder(true);
                        }} className={`transition-colors ${isDeleted ? 'opacity-50 bg-red-50/30' : 'hover:bg-[#F9F7F5] cursor-pointer'}`}>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <p className={`font-serif font-bold text-[#013E3F] ${isDeleted ? 'line-through' : ''}`}>{tmpl.title}</p>
                              {isDeleted && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-600">Deleted</span>}
                              {isDeleted && <button onClick={(e) => { e.stopPropagation(); restoreTaskTemplate(tmpl.id).then(ok => ok && getTaskTemplates(true).then(setManagerTemplates)); }} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors">Restore</button>}
                            </div>
                            {tmpl.description && <p className="text-[10px] text-[#013E3F]/40 mt-0.5">{tmpl.description}</p>}
                          </td>
                          <td className="px-8 py-5 text-xs text-[#013E3F]/60">
                            {tmpl.due_date_offset < 0 ? `${Math.abs(tmpl.due_date_offset)} days before start` : tmpl.due_date_offset === 0 ? 'Start day' : `Day ${tmpl.due_date_offset}`}
                          </td>
                          <td className="px-8 py-5 text-xs text-[#013E3F]/60">{tmpl.time_estimate || '—'}</td>
                          <td className="px-8 py-5 text-xs text-[#013E3F]/60">
                            {tmpl.link ? (
                              <a href={tmpl.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline truncate block max-w-[200px]">
                                {tmpl.link.length > 30 ? tmpl.link.slice(0, 30) + '…' : tmpl.link}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-8 py-5 text-xs text-[#013E3F]/60">{formatDate((tmpl as any).created_at || '')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manager Task Builder Modal */}
      {showManagerTaskBuilder && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#013E3F] rounded-2xl shadow-2xl max-w-xl w-full p-10 animate-in zoom-in-95 text-[#F3EEE7]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-serif text-2xl">{editingTemplateId ? 'Edit Manager Task' : 'New Manager Task'}</h3>
                <p className="text-[#FDD344] text-xs font-bold uppercase tracking-widest mt-1">{editingTemplateId ? 'Edit existing template' : 'Create new template'}</p>
              </div>
              <button onClick={() => setShowManagerTaskBuilder(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setManagerTaskSubmitting(true);
              setManagerTaskError(null);
              const payload = {
                title: managerTaskData.title,
                description: managerTaskData.description || null,
                due_date_offset: managerTaskData.dueOffset,
                time_estimate: managerTaskData.timeEstimate || null,
                link: managerTaskData.link || null,
              };
              const result = editingTemplateId
                ? await updateTaskTemplate(editingTemplateId, payload)
                : await createTaskTemplate(payload);
              setManagerTaskSubmitting(false);
              if (result) {
                setManagerTaskSuccess(true);
                setTimeout(() => {
                  setShowManagerTaskBuilder(false);
                  setManagerTaskSuccess(false);
                  setManagerTaskData({ title: '', description: '', dueOffset: 0, timeEstimate: '', link: '' });
                  getTaskTemplates(true).then(setManagerTemplates);
                }, 800);
              } else {
                setManagerTaskError('Failed to save. Please try again.');
              }
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Task Title</label>
                <input required className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" placeholder="Schedule 1:1 with new hire" value={managerTaskData.title} onChange={e => setManagerTaskData({...managerTaskData, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Description</label>
                <textarea className="w-full bg-[#013E3F] border border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2 px-3 rounded-lg text-sm h-20 resize-none" placeholder="Brief description..." value={managerTaskData.description} onChange={e => setManagerTaskData({...managerTaskData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Day Offset</label>
                  <input type="number" className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" value={managerTaskData.dueOffset} onChange={e => setManagerTaskData({...managerTaskData, dueOffset: parseInt(e.target.value) || 0})} />
                  <p className="text-[10px] text-[#F3EEE7]/30">Negative = before start date</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Time Estimate</label>
                  <input className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" placeholder="15 min" value={managerTaskData.timeEstimate} onChange={e => setManagerTaskData({...managerTaskData, timeEstimate: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-[#FDD344]/80">Link</label>
                <input className="w-full bg-[#013E3F] border-b border-[#F3EEE7]/20 focus:border-[#FDD344] outline-none py-2" placeholder="https://..." value={managerTaskData.link} onChange={e => setManagerTaskData({...managerTaskData, link: e.target.value})} />
              </div>
              <div className="pt-6 border-t border-[#F3EEE7]/10 flex items-center gap-3">
                {editingTemplateId && (
                  <button type="button" onClick={() => setConfirmDeleteTemplateId(editingTemplateId)} className="px-6 py-3 rounded-xl font-bold uppercase text-xs border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors">Delete</button>
                )}
                <div className="flex-1" />
                <button type="submit" disabled={managerTaskSubmitting || managerTaskSuccess} className={`px-12 py-3 rounded-xl font-bold uppercase text-xs transition-colors ${managerTaskSuccess ? 'bg-green-600 text-white' : 'bg-[#FDD344] text-[#013E3F]'}`}>{managerTaskSuccess ? '✓ Saved' : managerTaskSubmitting ? 'Saving...' : (editingTemplateId ? 'Update Task' : 'Create Task')}</button>
                {managerTaskError && <p className="text-red-400 text-xs">{managerTaskError}</p>}
              </div>
              {confirmDeleteTemplateId && (
                <div className="mt-4 p-4 bg-red-50/10 border border-red-400/20 rounded-xl">
                  <p className="text-sm text-red-300 mb-3">Are you sure you want to delete <strong>{managerTaskData.title}</strong>?</p>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setConfirmDeleteTemplateId(null)} className="px-4 py-2 text-xs font-bold uppercase rounded-lg border border-[#F3EEE7]/20 text-[#F3EEE7] hover:bg-white/5">Cancel</button>
                    <button type="button" onClick={async () => {
                      const ok = await deleteTaskTemplate(confirmDeleteTemplateId);
                      if (ok) {
                        toast.success('Template deleted.');
                        setConfirmDeleteTemplateId(null);
                        setShowManagerTaskBuilder(false);
                        setEditingTemplateId(null);
                        getTaskTemplates(true).then(setManagerTemplates);
                      } else {
                        toast.error('Failed to delete.');
                      }
                    }} className="px-4 py-2 text-xs font-bold uppercase rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>,
      document.body)}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-10 animate-in zoom-in-95"><div className="flex justify-between items-center mb-8"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#F3EEE7] rounded-full flex items-center justify-center text-[#013E3F]">{activeCommsAction === 'email' && <Mail />}{activeCommsAction === 'slack' && <Slack />}{activeCommsAction === 'survey' && <ClipboardCheck />}</div><div><h3 className="font-serif text-2xl text-[#013E3F]">{activeCommsAction === 'survey' ? 'Satisfaction Survey' : `Draft ${activeCommsAction.charAt(0).toUpperCase() + activeCommsAction.slice(1)}`}</h3><p className="text-sm text-[#013E3F]/60 font-bold uppercase tracking-widest">To: {selectedUserForComms.name}</p></div></div><button onClick={() => setSelectedUserForComms(null)}><X className="w-5 h-5"/></button></div><div className="p-6 bg-[#F9F7F5] rounded-xl border border-[#013E3F]/10 min-h-[200px] relative">{sendingComms ? <div className="absolute inset-0 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" /><span>AI Drafting...</span></div> : <textarea className="w-full bg-transparent border-none text-sm text-[#013E3F] min-h-[200px] resize-none focus:ring-0" value={commsDraft} onChange={e => setCommsDraft(e.target.value)} />}</div><button disabled={sendingComms || !commsDraft.trim()} onClick={async () => { if (activeCommsAction === 'slack') { setSendingComms(true); const result = await sendSlackDM(selectedUserForComms.email, commsDraft); setSendingComms(false); if (result.success) { setSelectedUserForComms(null); toast.success('Slack message sent!'); } else { toast.error(`Failed to send: ${result.error || 'Unknown error'}`); } } else if (activeCommsAction === 'email') { window.open(`mailto:${selectedUserForComms.email}?subject=Onboarding Update&body=${encodeURIComponent(commsDraft)}`); setSelectedUserForComms(null); } else { setSelectedUserForComms(null); } }} className="w-full mt-6 py-5 bg-[#013E3F] text-[#F3EEE7] rounded-xl font-bold uppercase shadow-xl tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">{sendingComms ? 'Sending...' : activeCommsAction === 'slack' ? 'Send via Slack' : activeCommsAction === 'email' ? 'Send Email' : 'Dispatch Message'}</button></div></div>,
      document.body)}

      {showEnrolledDrilldown && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl max-w-lg w-full p-8 animate-in zoom-in-95 shadow-2xl"><div className="flex justify-between items-center mb-6"><h3 className="font-serif text-2xl text-[#013E3F]">Enrollment Detail</h3><button onClick={() => setShowEnrolledDrilldown(false)}><X className="w-5 h-5 text-[#013E3F]/40 hover:text-[#013E3F]"/></button></div><div className="max-h-[60vh] overflow-y-auto space-y-3">{(enrolledFilter === 'summary' ? students : enrolledFilter === 'onTrack' ? students.filter(h => !isHireBehind(h)) : students.filter(isHireBehind)).map(hire => (<div key={hire.id} className="flex items-center justify-between p-4 bg-[#F9F7F5] border border-[#013E3F]/5 rounded-xl"><div className="flex items-center gap-3"><img src={hire.avatar} className="w-10 h-10 rounded-full border border-[#013E3F]/10" /><div><h4 className="font-bold text-[#013E3F] leading-tight">{hire.name}</h4><p className="text-[10px] uppercase font-bold text-[#013E3F]/40 tracking-wider">{hire.title}</p></div></div><div className="font-serif font-bold text-[#013E3F]">{hire.progress}%</div></div>))}</div></div></div>,
      document.body)}

      {editingHireId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 border border-[#013E3F]/10 relative"><div className="p-6 bg-[#013E3F] text-white flex justify-between items-center"><h3 className="font-serif text-xl">Edit Registry Details</h3><button onClick={() => setEditingHireId(null)}><X className="w-6 h-6" /></button></div><form onSubmit={handleUpdateHire} className="p-8 space-y-6"><div className="space-y-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Name</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required /></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Email</label><input type="email" className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Role (Title)</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})} /></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Start Date</label><div className="relative"><input type="date" className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-transparent focus:ring-1 focus:ring-[#013E3F] cursor-pointer" value={editFormData.startDate} onChange={e => setEditFormData({...editFormData, startDate: e.target.value})} /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#013E3F] pointer-events-none">{editFormData.startDate ? formatDate(editFormData.startDate) : ''}</span></div></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Department</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.department} onChange={e => setEditFormData({...editFormData, department: e.target.value})} /></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Location</label><input className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Region</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.region} onChange={e => setEditFormData({...editFormData, region: e.target.value})}><option value="">No Region</option><option value="East">East</option><option value="Central">Central</option><option value="West">West</option></select></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">System Role</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.userRole} onChange={e => setEditFormData({...editFormData, userRole: e.target.value as UserRole})}><option value="Admin">Admin</option><option value="Manager">Manager</option><option value="New Hire">New Hire</option></select></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Assigned Manager</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.managerId} onChange={e => setEditFormData({...editFormData, managerId: e.target.value})}><option value="">None</option>{allUsers.filter(u => u.role === 'Manager' || u.role === 'Admin').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div><label className="block text-[10px] font-bold uppercase text-[#013E3F]/70 mb-1">Std. Role</label><select className="w-full border-[#013E3F]/20 border rounded-lg p-3 text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F]" value={editFormData.standardizedRole} onChange={e => setEditFormData({...editFormData, standardizedRole: e.target.value})}><option value="">No Role</option><option value="MxA">MxA</option><option value="MxM">MxM</option><option value="AGM">AGM</option><option value="GM">GM</option><option value="RD">RD</option></select></div></div></div><div className="flex gap-3 pt-4"><button type="button" onClick={() => setConfirmDeleteId(editingHireId)} className="flex-1 py-3 text-xs font-bold uppercase border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors">Delete</button><button type="submit" className="flex-1 py-3 bg-[#013E3F] text-white text-xs font-bold uppercase rounded-lg shadow-lg hover:bg-[#013E3F]/90 transition-all">Save Changes</button></div></form>{confirmDeleteId && (() => { const leaderAssignments = cohorts.flatMap(c => c.cohort_leaders.filter(l => l.profile_id === confirmDeleteId).map(l => `${l.role_label} - ${l.region} (${c.name})`)); return <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl"><div className="bg-white rounded-xl p-6 m-6 shadow-lg space-y-4"><p className="text-sm text-[#013E3F]">Are you sure you want to delete <strong>{editFormData.name}</strong>? This action cannot be undone.</p>{leaderAssignments.length > 0 && <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg"><p className="text-xs font-bold text-amber-800 mb-1">Cohort Leader Warning</p><p className="text-xs text-amber-700">This member is assigned as a cohort leader in: {leaderAssignments.join(', ')}. Deleting them will leave these slots unassigned.</p></div>}<div className="flex gap-3"><button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 text-xs font-bold uppercase border rounded-lg text-[#013E3F] hover:bg-gray-50 transition-colors">Cancel</button><button onClick={handleDeleteHire} className="flex-1 py-2 bg-red-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-red-700 transition-colors">Delete</button></div></div></div>; })()}</div></div>,
      document.body)}
    </div>
  );
};

export default AdminDashboard;