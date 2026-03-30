import React, { useState, useEffect, useMemo } from 'react';
import { User, NewHireProfile, TrainingModule } from '../types';
import { formatDate } from '../lib/formatDate';
// Static UI content — intentionally kept as constant (not user data)
import { UNIVERSAL_SERVICE_STEPS } from '../constants';
import { CheckCircle, Circle, Video, FileText, ArrowRight, Slack, Megaphone, Target, ClipboardList, Users, UserCheck, BookOpen, X, Save, AtSign, Lightbulb, PenTool, MessageSquare, Quote, ChevronRight, Calendar as CalendarIcon, ChevronLeft, AlertTriangle, ArrowUpRight, PlayCircle, MapPin, LayoutDashboard, HeartHandshake, Eye, Star, Compass, ListOrdered, Info, Briefcase, MessageCircle, Globe, GraduationCap, LifeBuoy, User as UserIcon, Link as LinkIcon, ThumbsUp, Send, Timer, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useToast } from './Toast';
import { useModules } from '../hooks/useModules';
import { useWorkbook } from '../hooks/useWorkbook';
import { useShoutouts } from '../hooks/useShoutouts';
import { useProfileById } from '../hooks/useProfileById';
import { useLeadershipTeam } from '../hooks/useLeadershipTeam';
import { getModuleComments, addModuleComment, getAllModuleComments } from '../services/moduleService';
import { getCohortStartingDateForUser } from '../services/cohortService';
import type { ModuleComment } from '../types';

interface NewHireDashboardProps {
  user: User;
  initialTab?: 'dashboard' | 'calendar' | 'workbook';
  onTabChange?: (tab: string) => void;
}

const NewHireDashboard: React.FC<NewHireDashboardProps> = ({ user, initialTab, onTabChange }) => {
  const toast = useToast();
  // Supabase hooks for data fetching
  const { profile: supabaseProfile, loading: profileLoading } = useProfileById(user.id);
  const { modules: supabaseModules, loading: modulesLoading, markComplete, markIncomplete, toggleLike } = useModules(user.id);
  const { responsesMap: workbookResponses, commentsMap: workbookComments, loading: workbookLoading, saveResponse } = useWorkbook(user.id);
  const { shoutouts: supabaseShoutouts } = useShoutouts(user.id);

  // Build profile from Supabase data with explicit defaults for null fields
  const myProfile = useMemo(() => {
    if (supabaseProfile) {
      return {
        id: supabaseProfile.id,
        name: supabaseProfile.name,
        email: supabaseProfile.email,
        role: supabaseProfile.role || 'New Hire',
        avatar: supabaseProfile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(supabaseProfile.name)}&background=013E3F&color=F3EEE7`,
        title: supabaseProfile.title || 'Team Member',
        managerId: supabaseProfile.manager_id || null,
        startDate: supabaseProfile.start_date || new Date().toISOString().split('T')[0],
        department: supabaseProfile.department || '',
        region: supabaseProfile.region || null,
        modules: [] as TrainingModule[],
        okrs: [] as any[],
        shoutouts: [] as any[],
        customPrompts: [] as any[],
        workbookResponses: workbookResponses,
        workbookComments: workbookComments,
        progress: 0,
      };
    }
    // Minimal defaults while loading
    return {
      id: user.id,
      name: user.name,
      email: user.email || '',
      role: user.role || 'New Hire',
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=013E3F&color=F3EEE7`,
      title: user.title || 'Team Member',
      managerId: null as string | null,
      startDate: new Date().toISOString().split('T')[0],
      department: '',
      region: null as string | null,
      modules: [] as TrainingModule[],
      okrs: [] as any[],
      shoutouts: [] as any[],
      customPrompts: [] as any[],
      workbookResponses: workbookResponses || {},
      workbookComments: workbookComments || {},
      progress: 0,
    };
  }, [supabaseProfile, user, workbookResponses, workbookComments]);

  // Cohort starting date — used for computing module due dates from day_offset
  const [cohortStartingDate, setCohortStartingDate] = useState<string | null>(null);
  useEffect(() => {
    const startDate = myProfile.startDate;
    if (startDate && startDate !== new Date().toISOString().split('T')[0]) {
      getCohortStartingDateForUser(startDate).then(date => {
        if (date) setCohortStartingDate(date);
      });
    }
  }, [myProfile.startDate]);

  // Transform Supabase modules to match the expected TrainingModule interface
  const myModules: TrainingModule[] = useMemo(() => {
    if (supabaseModules.length > 0) {
      const baseDate = cohortStartingDate || myProfile.startDate;
      // Determine audience type: cohort if in a cohort, direct if has manager_id, both if both
      const inCohort = !!cohortStartingDate;
      const isDirect = !!myProfile.managerId;
      const audienceType = inCohort && isDirect ? 'both' : inCohort ? 'cohort' : isDirect ? 'direct' : 'both';

      // Filter modules by audience
      const audienceFiltered = supabaseModules.filter(m => {
        const audience = (m as any).audience as string | null;
        if (!audience) return true; // null = all students
        if (audienceType === 'both') return true;
        return audience === audienceType;
      });

      return audienceFiltered.map(m => {
        // Compute due date from cohort starting date + module day_offset (same as manager view)
        const computedDueDate = m.day_offset != null && baseDate
          ? new Date(new Date(baseDate + 'T00:00:00').getTime() + m.day_offset * 86400000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        return {
          id: m.id,
          title: m.title,
          description: m.description || '',
          type: m.type as TrainingModule['type'],
          duration: m.duration || '',
          completed: m.progress?.completed || false,
          dueDate: m.progress?.due_date || computedDueDate,
          link: m.link || undefined,
          score: m.progress?.score || undefined,
          host: m.host || undefined,
          liked: m.progress?.liked || false,
          likes: m.progress?.liked ? 1 : 0,
        };
      });
    }
    return [];
  }, [supabaseModules, cohortStartingDate, myProfile.startDate]);

  // Fetch manager profile from Supabase
  const { profile: managerProfile, loading: managerLoading } = useProfileById(myProfile.managerId);
  const myManager = managerProfile
    ? { name: managerProfile.name, avatar: managerProfile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(managerProfile.name)}&background=013E3F&color=F3EEE7`, id: managerProfile.id }
    : { name: 'No manager assigned', avatar: `https://ui-avatars.com/api/?name=NA&background=013E3F&color=F3EEE7`, id: '' };

  // Navigation State
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('newhire_welcome_dismissed') !== 'true';
    }
    return true;
  });
  const [activeTab, setActiveTabRaw] = useState<'dashboard' | 'calendar' | 'workbook'>(initialTab ?? 'dashboard');
  const setActiveTab = (tab: 'dashboard' | 'calendar' | 'workbook') => {
    setActiveTabRaw(tab);
    onTabChange?.(tab);
  };

  // We use a counter to force re-renders when deep objects (like comments/likes) change in the mock data
  const [updateCounter, setUpdateCounter] = useState(0);

  // Compute completed modules from actual module data
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());

  // Sync completed modules when module data changes
  useEffect(() => {
    const completed = new Set(myModules.filter(m => m.completed).map(m => m.id));
    setCompletedModules(completed);
  }, [myModules]);

  // Modal State
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  // Workbook State
  const [showWorkbook, setShowWorkbook] = useState(false);
  const [workbookTab, setWorkbookTab] = useState<'principles' | 'welcomed' | 'orientation' | 'empowered' | 'manager'>('principles');
  const [workbookInputs, setWorkbookInputs] = useState<Record<string, string>>(
    myProfile.workbookResponses || {}
  );
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});
  
  // Engagement State
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [moduleComments, setModuleComments] = useState<Record<string, ModuleComment[]>>({});

  // Initialize prompt answers
  useEffect(() => {
    if (myProfile.customPrompts) {
       const initialAnswers: Record<string, string> = {};
       myProfile.customPrompts.forEach(p => {
         initialAnswers[p.id] = p.answer;
       });
       setPromptAnswers(initialAnswers);
    }
  }, [myProfile]);

  // Sync workbook inputs when Supabase data loads
  useEffect(() => {
    if (workbookResponses && Object.keys(workbookResponses).length > 0) {
      setWorkbookInputs(prev => ({ ...prev, ...workbookResponses }));
    }
  }, [workbookResponses]);

  // Load all module comments on mount
  useEffect(() => {
    getAllModuleComments().then(setModuleComments);
  }, []);
  
  // Filter State
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  // Calendar State (Defaults to today's week)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  // Monthly Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 0, 1));

  // Fetch leadership team from Supabase by region
  const { leaders: leadershipData, loading: leadershipLoading } = useLeadershipTeam(myProfile.region);
  const unitLeaders = leadershipData.map(l => ({
    id: l.profile.id,
    name: l.profile.name,
    avatar: l.profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.profile.name)}&background=013E3F&color=F3EEE7`,
    title: l.profile.title || l.roleLabel,
    roleLabel: l.roleLabel,
  }));

  const toggleModule = async (id: string) => {
    const newSet = new Set(completedModules);
    const wasCompleted = newSet.has(id);

    if (wasCompleted) {
      newSet.delete(id);
    } else {
      newSet.add(id);
      // Trigger confetti celebration with vibrant multi-colors
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FDD344', '#013E3F', '#EF4444', '#3B82F6', '#10B981'] // Yellow, Brand Green, Red, Blue, Bright Green
      });
    }

    setCompletedModules(newSet);

    // Persist to Supabase
    if (!wasCompleted) {
      await markComplete(id);
    } else {
      await markIncomplete(id);
    }
  };

  // Engagement Handlers
  const handleLike = async (module: TrainingModule) => {
    const newLikedState = !module.liked;

    // Persist to Supabase if connected
    if (supabaseModules.length > 0) {
      await toggleLike(module.id, newLikedState);
    }

    // Update local state for mock data compatibility
    if (module.liked) {
      module.likes = (module.likes || 1) - 1;
      module.liked = false;
    } else {
      module.likes = (module.likes || 0) + 1;
      module.liked = true;
      // Small confetti for liking
      confetti({
        particleCount: 30,
        spread: 30,
        origin: { y: 0.7 },
        colors: ['#FDD344']
      });
    }
    setUpdateCounter(c => c + 1);
  };

  const toggleComments = (id: string) => {
    const newSet = new Set(expandedComments);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedComments(newSet);
  };

  const handlePostComment = async (module: TrainingModule) => {
    const text = commentDrafts[module.id];
    if (!text || !text.trim()) return;

    const comment = await addModuleComment(module.id, user.id, text);
    if (comment) {
      setModuleComments(prev => ({
        ...prev,
        [module.id]: [...(prev[module.id] || []), comment],
      }));
    }

    setCommentDrafts(prev => ({...prev, [module.id]: ''}));
  };

  // Automated handler for calls
  const handleJoinCall = (id: string) => {
    // Automatically mark as complete if not already done
    if (!completedModules.has(id)) {
      toggleModule(id);
    }
    // Allow the link to open naturally
  };

  const handleOpenWorkbookTask = (moduleId: string) => {
    // Logic to map specific modules to workbook tabs
    if (moduleId.includes('w1-2')) setWorkbookTab('principles');
    else if (moduleId.includes('w2-3')) setWorkbookTab('welcomed');
    else if (moduleId.includes('w1-4')) setWorkbookTab('orientation');
    else if (moduleId.includes('w2-4')) setWorkbookTab('empowered');
    else setWorkbookTab('principles'); // Default

    setActiveTab('workbook');
    setShowWorkbook(true);
    setShowOverdueModal(false);
  };

  const handleWorkbookSave = async () => {
    // Save all workbook inputs to Supabase
    if (supabaseProfile) {
      const savePromises = Object.entries(workbookInputs).map(([key, value]) =>
        saveResponse(key, value as string)
      );
      await Promise.all(savePromises);
    }

    // Prompts are saved via Supabase hooks — no mock data mutation needed

    setShowWorkbook(false);
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FDD344', '#013E3F']
    });
    toast.success("Workbook progress saved!");
  };

  const updateWorkbookInput = (key: string, value: string) => {
    setWorkbookInputs(prev => ({...prev, [key]: value}));
  };

  const updatePromptAnswer = (id: string, value: string) => {
    setPromptAnswers(prev => ({...prev, [id]: value}));
  };

  const tagManager = (key: string) => {
    const currentVal = workbookInputs[key] || '';
    const tag = ` @${myManager.name} `;
    updateWorkbookInput(key, currentVal + tag);
    toast.info(`Tagged ${myManager.name} in your response.`);
  };

  const handleStart = () => {
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.8 },
      colors: ['#FDD344', '#013E3F', '#EF4444', '#3B82F6', '#10B981']
    });
    localStorage.setItem('newhire_welcome_dismissed', 'true');
    setShowWelcomeGuide(false);
    window.scrollTo(0, 0);
  };

  const progress = Math.round((completedModules.size / myModules.length) * 100);

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'LIVE_CALL': return <Video className="w-3 h-3" />;
      case 'WORKBOOK': return <BookOpen className="w-3 h-3" />;
      case 'PERFORM': return <ClipboardList className="w-3 h-3" />;
      case 'SHADOW': return <Users className="w-3 h-3" />;
      case 'MANAGER_LED': return <UserCheck className="w-3 h-3" />;
      case 'LESSONLY': return <PlayCircle className="w-3 h-3" />;
      case 'BAU': return <MapPin className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  const getModuleLabel = (type: string) => {
    return type.replace('_', ' ');
  };

  // Helper to determine styling based on legend
  const getModuleStyles = (type: string, completed: boolean) => {
    if (completed) return 'bg-gray-100 border-gray-200 text-gray-500 opacity-80';

    switch (type) {
      case 'LIVE_CALL': // Hosted Training -> Green
        return 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534] border-l-4 border-l-[#166534]';
      case 'WORKBOOK': // Workbook -> Grey
        return 'bg-slate-50 border-slate-200 text-slate-700 border-l-4 border-l-slate-500';
      case 'MANAGER_LED': // Manager Led -> Red
        return 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b] border-l-4 border-l-[#991b1b]';
      case 'BAU': // BAU -> Orange/Yellow
        return 'bg-[#fef3c7] border-[#fde68a] text-[#92400e] border-l-4 border-l-[#92400e]';
      case 'LESSONLY': // Lessonly -> Blue
        return 'bg-[#dbeafe] border-[#bfdbfe] text-[#1e40af] border-l-4 border-l-[#1e40af]';
      default:
        return 'bg-white border-[#013E3F]/10 text-[#013E3F] border-l-4 border-l-[#013E3F]';
    }
  };
  
  const getBadgeColor = (type: string) => {
     switch (type) {
        case 'LIVE_CALL': return 'bg-green-100 text-green-800';
        case 'WORKBOOK': return 'bg-slate-100 text-slate-800';
        case 'MANAGER_LED': return 'bg-red-100 text-red-800';
        case 'BAU': return 'bg-amber-100 text-amber-800';
        case 'LESSONLY': return 'bg-blue-100 text-blue-800';
        default: return 'bg-[#F3EEE7] text-[#013E3F]/50';
     }
  }

  // Helper to filter modules
  const shouldShowModule = (module: any) => {
    if (module.type === 'PERFORM') {
      const startDate = new Date(myProfile.startDate);
      const dueDate = new Date(module.dueDate);
      const diffTime = Math.abs(dueDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // If due date is more than 14 days after start date, hide it
      if (diffDays > 14 && dueDate > startDate) {
        return false;
      }
    }
    return true;
  };

  const visibleModules = myModules.filter(module => {
    if (showIncompleteOnly && completedModules.has(module.id)) return false;
    return shouldShowModule(module);
  });

  // --- CALENDAR LOGIC (WEEK AT A GLANCE) ---
  const getWeekDays = (date: Date) => {
    const days = [];
    const startOfWeek = new Date(date);
    // Align to Sunday of current week
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day; // adjust when day is sunday
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const changeWeek = (offset: number) => {
    const newDate = new Date(currentCalendarDate);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setCurrentCalendarDate(newDate);
  };

  const weekDays = getWeekDays(currentCalendarDate);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // --- MONTHLY CALENDAR LOGIC ---
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonthDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonthDate(newDate);
  };

  const renderMonthCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonthDate);
    const firstDay = getFirstDayOfMonth(currentMonthDate);
    const days = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-[#F3EEE7]/10 border-r border-b border-[#013E3F]/10"></div>);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayModules = myModules.filter(m => m.dueDate === dateStr);
      
      days.push(
        <div key={day} className="h-32 bg-white border-r border-b border-[#013E3F]/10 p-2 relative group hover:bg-[#F3EEE7]/10 transition-colors">
          <span className="text-xs font-bold text-[#013E3F]/50 absolute top-2 left-2">{day}</span>
          <div className="mt-5 space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar pr-1">
            {dayModules.map(module => (
              <div 
                key={module.id} 
                className={`text-[10px] p-1.5 rounded border shadow-sm ${getModuleStyles(module.type, completedModules.has(module.id))}`}
              >
                <div className="font-bold truncate leading-tight">{module.title}</div>
                {module.link ? (
                  <a href={module.link} target="_blank" rel="noreferrer" className="opacity-80 hover:opacity-100 hover:underline flex items-center gap-1 mt-1 font-medium">
                    <Video className="w-2.5 h-2.5" /> Open
                  </a>
                ) : (
                  <div className="opacity-70 mt-0.5">{module.duration}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  // --- BANNER LOGIC ---
  const overdueTasks = myModules.filter(m => !completedModules.has(m.id) && new Date(m.dueDate) < new Date());
  // Sort incomplete tasks by due date to find next up
  const incompleteTasks = myModules
    .filter(m => !completedModules.has(m.id))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  const nextUpTask = incompleteTasks.find(m => new Date(m.dueDate) >= new Date()) || incompleteTasks[0];

  // --- WELCOME GUIDE RENDER ---
  if (showWelcomeGuide) {
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-[#F3EEE7] rounded-xl overflow-hidden shadow-2xl border border-[#013E3F]/10">
          
          {/* Header */}
          <div className="bg-[#013E3F] p-10 text-[#F3EEE7] relative overflow-hidden">
            <div className="relative z-10 max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-4">Congratulations!</h1>
              <p className="text-xl md:text-2xl text-[#FDD344] font-medium mb-6 font-serif">
                {user.name.split(' ')[0]} &mdash; We are SO glad you are here!
              </p>
              <p className="text-[#F3EEE7]/80 leading-relaxed text-lg font-light">
                This training schedule and your onboarding workbook is designed to empower you to learn the ropes in your new role. 
                Much of this tour training checklist is self-driven and will require you to organize and schedule time to learn your roles and responsibilities, but your manager is always here to help. 
                This by no means is a full list of your entire role, but these topics will help build a strong foundation.
              </p>
            </div>
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FDD344] rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
          </div>

          <div className="p-10 bg-white">
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-10">
               {/* Left Col: Methods of Learning */}
               <div>
                  <h2 className="text-2xl font-serif text-[#013E3F] mb-6 flex items-center gap-2 border-b border-[#F3EEE7] pb-2">
                    <Info className="w-6 h-6 text-[#FDD344]" />
                    Methods of Learning
                  </h2>
                  <div className="space-y-6">
                    <div className="flex gap-4 group">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#fee2e2] text-[#991b1b] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#013E3F] text-sm uppercase tracking-wide">Manager Led</h3>
                        <p className="text-sm text-[#013E3F]/70 mt-1 leading-relaxed">
                          Your General Manager will guide you through this content. Practice soliciting feedback and sharing thoughts along the way.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 group">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#dbeafe] text-[#1e40af] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#013E3F] text-sm uppercase tracking-wide">Lessonly</h3>
                        <p className="text-sm text-[#013E3F]/70 mt-1 leading-relaxed">
                          Lessonly is our learning delivery tool that will empower you with information you can refer back to as you continue your development.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 group">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#F3EEE7] text-[#013E3F] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#013E3F] text-sm uppercase tracking-wide">Self Led</h3>
                        <p className="text-sm text-[#013E3F]/70 mt-1 leading-relaxed">
                          Additional resources provided to read and comprehend throughout your training
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 group">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#f3f4f6] text-[#4b5563] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#013E3F] text-sm uppercase tracking-wide">Workbook</h3>
                        <p className="text-sm text-[#013E3F]/70 mt-1 leading-relaxed">
                          There will be workbook pages throughout training to connect ideas and reflect on training.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 group">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#fef3c7] text-[#92400e] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <HeartHandshake className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#013E3F] text-sm uppercase tracking-wide">Peer Partner</h3>
                        <p className="text-sm text-[#013E3F]/70 mt-1 leading-relaxed">
                          Learning with a buddy! Work with {myProfile.name === 'Alex Joiner' ? 'Casey Newbie' : 'Alex Joiner'} (or assigned peer).
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 group">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Star className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#013E3F] text-sm uppercase tracking-wide">Perform</h3>
                        <p className="text-sm text-[#013E3F]/70 mt-1 leading-relaxed">
                          An opportunity for <span className="font-bold text-[#166534]">#ownership</span>! A core value and a great way to get tactical experience on the job.
                        </p>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Right Col: How to Use */}
               <div className="flex flex-col h-full">
                  <div className="bg-[#013E3F] p-8 rounded-xl border border-[#013E3F] shadow-lg flex-1 relative overflow-hidden group">
                     {/* Decorative blur behind */}
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[60px] opacity-10 pointer-events-none"></div>
                     
                     <h2 className="text-2xl font-serif text-[#F3EEE7] mb-6 flex items-center gap-2 border-b border-[#F3EEE7]/10 pb-2 relative z-10">
                       <ListOrdered className="w-6 h-6 text-[#FDD344]" />
                       How to Use this Website
                     </h2>
                     <ol className="space-y-4 relative z-10">
                       <li className="flex gap-4 items-start">
                         <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#FDD344] text-[#013E3F] font-bold text-sm shadow-sm">1</span>
                         <p className="text-[#F3EEE7] font-medium text-sm pt-1">Follow the daily cadence to keep on track with your onboarding and training requirements.</p>
                       </li>
                       <li className="flex gap-4 items-start">
                         <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#FDD344] text-[#013E3F] font-bold text-sm shadow-sm">2</span>
                         <p className="text-[#F3EEE7] font-medium text-sm pt-1">Collaborate with your manager on any tasks or timing that may need to be modified or moved.</p>
                       </li>
                       <li className="flex gap-4 items-start">
                         <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#FDD344] text-[#013E3F] font-bold text-sm shadow-sm">3</span>
                         <p className="text-[#F3EEE7] font-medium text-sm pt-1">Check off completion as you progress to track your journey.</p>
                       </li>
                       <li className="flex gap-4 items-start">
                         <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#FDD344] text-[#013E3F] font-bold text-sm shadow-sm">4</span>
                         <p className="text-[#F3EEE7] font-medium text-sm pt-1">Take your time and have fun! This is your journey to finding your place and making your mark at Industrious.</p>
                       </li>
                     </ol>
                     <div className="mt-6 p-4 bg-[#F3EEE7]/10 rounded-lg border border-[#F3EEE7]/5 flex gap-3 shadow-sm relative z-10">
                         <div className="shrink-0 text-[#FDD344]">
                             <UserCheck className="w-5 h-5" />
                         </div>
                         <p className="text-[#F3EEE7] text-sm italic leading-relaxed">
                             <span className="font-bold">Note:</span> Your manager will also be tracking your progress and is here to support you throughout your training journey!
                         </p>
                     </div>
                  </div>
               </div>
             </div>

             {/* Get Started Box (Bottom) - Swapped back to Green box, Yellow button */}
              <div className="bg-[#013E3F] text-[#F3EEE7] p-8 rounded-xl flex flex-col items-center text-center relative overflow-hidden shadow-xl border border-[#013E3F]">
                 <div className="relative z-10">
                    <p className="mb-6 font-serif text-lg italic opacity-90">
                      "We're so excited you're here!"
                    </p>
                    <button 
                      onClick={handleStart}
                      className="bg-[#FDD344] text-[#013E3F] px-16 py-4 rounded-lg font-bold uppercase tracking-widest text-sm hover:bg-[#ffe175] transition-all transform hover:scale-105 shadow-xl flex items-center gap-3 mx-auto"
                    >
                      Get Started! <ArrowRight className="w-5 h-5" />
                    </button>
                 </div>
                 <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#FDD344] rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
                 <div className="absolute -top-20 -left-20 w-64 h-64 bg-[#FDD344] rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
              </div>

          </div>
        </div>
      </div>
    );
  }

  // --- STANDARD DASHBOARD RENDER ---
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8">
      
      {/* Top Header (Nav moved to Sidebar) */}
      <div className="flex justify-between items-end border-b border-[#F3EEE7]/10 pb-6">
        <div>
          <h2 className="text-3xl font-medium text-[#F3EEE7] font-serif">
            {activeTab === 'dashboard' && 'My Journey'}
            {activeTab === 'calendar' && 'Training Calendar'}
            {activeTab === 'workbook' && 'Workbook Hub'}
          </h2>
          <p className="text-[#F3EEE7]/70 mt-2 font-light text-lg">
            {activeTab === 'dashboard' && 'Your personalized onboarding roadmap.'}
            {activeTab === 'calendar' && 'Upcoming sessions and deadlines.'}
            {activeTab === 'workbook' && 'Your interactive guide to service excellence.'}
          </p>
        </div>
        
        {/* Help / Guide Button to reopen the welcome screen */}
        <button 
          onClick={() => { localStorage.removeItem('newhire_welcome_dismissed'); setShowWelcomeGuide(true); }}
          className="text-xs font-bold uppercase tracking-wide flex items-center gap-2 text-[#F3EEE7]/30 hover:text-[#FDD344] transition-colors whitespace-nowrap"
        >
           <Info className="w-4 h-4" /> Help
        </button>
      </div>

      {/* NAVIGATION WIDGETS (Restored) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div 
           onClick={() => setActiveTab('dashboard')}
           className={`bg-white p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3 shadow-sm group ${activeTab === 'dashboard' ? 'border-[#FDD344] ring-1 ring-[#FDD344]' : 'border-[#013E3F]/10 hover:border-[#013E3F]/30'}`}
         >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${activeTab === 'dashboard' ? 'bg-[#FDD344] text-[#013E3F]' : 'bg-[#F3EEE7] text-[#013E3F]/50 group-hover:text-[#013E3F]'}`}>
               <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-[#013E3F] text-sm">My Journey</h3>
               <p className="text-xs text-[#013E3F]/50">Overview</p>
            </div>
         </div>

         <div 
           onClick={() => setActiveTab('calendar')}
           className={`bg-white p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3 shadow-sm group ${activeTab === 'calendar' ? 'border-[#FDD344] ring-1 ring-[#FDD344]' : 'border-[#013E3F]/10 hover:border-[#013E3F]/30'}`}
         >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${activeTab === 'calendar' ? 'bg-[#FDD344] text-[#013E3F]' : 'bg-[#F3EEE7] text-[#013E3F]/50 group-hover:text-[#013E3F]'}`}>
               <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-[#013E3F] text-sm">Training Calendar</h3>
               <p className="text-xs text-[#013E3F]/50">Schedule</p>
            </div>
         </div>

         <div 
           onClick={() => setActiveTab('workbook')}
           className={`bg-white p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3 shadow-sm group ${activeTab === 'workbook' ? 'border-[#FDD344] ring-1 ring-[#FDD344]' : 'border-[#013E3F]/10 hover:border-[#013E3F]/30'}`}
         >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${activeTab === 'workbook' ? 'bg-[#FDD344] text-[#013E3F]' : 'bg-[#F3EEE7] text-[#013E3F]/50 group-hover:text-[#013E3F]'}`}>
               <BookOpen className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-[#013E3F] text-sm">Workbook Hub</h3>
               <p className="text-xs text-[#013E3F]/50">Exercises</p>
            </div>
         </div>

         <a 
           href="https://drive.google.com/file/d/1zFpunY-fcOpqabD9-0toImjWFchV9cMr/view?usp=drive_link" 
           target="_blank" 
           rel="noopener noreferrer"
           className="bg-white p-4 rounded-xl border border-[#013E3F]/10 hover:border-[#FDD344] transition-all cursor-pointer flex items-center gap-3 shadow-sm group"
         >
            <div className="w-10 h-10 rounded-full bg-[#F3EEE7] text-[#013E3F]/50 flex items-center justify-center group-hover:bg-[#FDD344] group-hover:text-[#013E3F] transition-colors">
               <LinkIcon className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-[#013E3F] text-sm group-hover:text-[#FDD344] transition-colors">Employee Handbook</h3>
               <p className="text-xs text-[#013E3F]/50">PDF Resource</p>
            </div>
         </a>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT SIDEBAR - Universal Service Steps (Visible on all tabs) */}
        <div className="hidden lg:block w-64 shrink-0 sticky top-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-[#013E3F]/10">
            <h3 className="font-serif text-xl font-medium text-[#013E3F] mb-4 border-b border-[#F3EEE7] pb-2">Universal Service Steps</h3>
            <div className="space-y-6">
              {UNIVERSAL_SERVICE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={idx} className="group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#F3EEE7] text-[#013E3F] flex items-center justify-center group-hover:bg-[#FDD344] transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-xs uppercase text-[#013E3F]">{step.title}</h4>
                    </div>
                    <p className="text-xs text-[#013E3F]/70 leading-relaxed pl-11">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shoutouts Card */}
          {myProfile.shoutouts && myProfile.shoutouts.length > 0 && (
            <div className="bg-[#FDD344] p-6 rounded-xl shadow-lg relative overflow-hidden text-[#013E3F]">
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-4 font-serif flex items-center gap-2">
                   <Megaphone className="w-5 h-5" /> Team Love
                </h3>
                <div className="space-y-4">
                   {myProfile.shoutouts.map(shout => (
                     <div key={shout.id} className="bg-white/90 p-3 rounded-lg text-sm shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-2">
                           <img src={shout.avatar} alt={shout.from} className="w-6 h-6 rounded-full border border-[#013E3F]/10" />
                           <span className="text-xs font-bold uppercase">{shout.from}</span>
                           <span className="text-[10px] text-[#013E3F]/50 ml-auto">{formatDate(shout.date)}</span>
                        </div>
                        <p className="italic text-[#013E3F]/80 leading-snug">"{shout.message}"</p>
                     </div>
                   ))}
                </div>
              </div>
              {/* Texture */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
            </div>
          )}
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 w-full space-y-8">
          
          {/* ---- CALENDAR TAB CONTENT (Full Monthly View) ---- */}
          {activeTab === 'calendar' && (
             <div className="animate-in fade-in duration-300">
               <div className="bg-white rounded-xl shadow-sm border border-[#013E3F]/10 overflow-hidden">
                <div className="bg-[#013E3F] p-4 flex items-center justify-between text-[#F3EEE7]">
                   <div className="flex items-center gap-3">
                     <CalendarIcon className="w-5 h-5 text-[#FDD344]" />
                     <h3 className="font-serif text-lg font-medium">Training Schedule</h3>
                   </div>
                   <div className="flex items-center gap-4">
                      <span className="text-sm font-bold uppercase tracking-wider">
                         {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <div className="flex bg-[#F3EEE7]/10 rounded-lg">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-[#F3EEE7]/20 rounded-l-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="w-[1px] bg-[#F3EEE7]/20"></div>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-[#F3EEE7]/20 rounded-r-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                   </div>
                </div>
                
                {/* Legend for Calendar */}
                <div className="bg-[#F3EEE7] px-4 py-2 flex flex-wrap gap-4 border-b border-[#013E3F]/5">
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-green-100 border border-green-300 rounded-sm"></div> Hosted Training
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-red-100 border border-red-300 rounded-sm"></div> Manager Led
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-purple-100 border border-purple-300 rounded-sm"></div> Peer Partner
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-slate-100 border border-slate-300 rounded-sm"></div> Workbook
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded-sm"></div> BAU
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-blue-100 border border-blue-300 rounded-sm"></div> Lessonly
                   </div>
                </div>
                
                {/* Calendar Grid Header (7 Cols) */}
                <div className="grid grid-cols-7 bg-[#F3EEE7] border-b border-[#013E3F]/10">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-bold uppercase tracking-wide text-[#013E3F]/60">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid Body (7 Cols) */}
                <div className="grid grid-cols-7 bg-[#F3EEE7] gap-[1px] border-l border-[#013E3F]/10">
                   {renderMonthCalendarDays()}
                </div>
              </div>
             </div>
          )}

          {/* ---- DASHBOARD TAB CONTENT ---- */}
          {activeTab === 'dashboard' && (
            <>
              {/* ACTION BANNER */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Next Up Card */}
                <div className="bg-[#013E3F] rounded-xl p-6 text-[#F3EEE7] shadow-lg flex items-center justify-between border border-[#F3EEE7]/10 relative overflow-hidden group">
                   <div className="relative z-10">
                      <div className="text-xs font-bold uppercase tracking-widest text-[#FDD344] mb-1 flex items-center gap-2">
                         <ArrowUpRight className="w-4 h-4" /> Up Next
                      </div>
                      {nextUpTask ? (
                        <>
                          <h3 className="font-serif text-xl font-medium mb-1 truncate max-w-[250px]">{nextUpTask.title}</h3>
                          <p className="text-sm opacity-70">Due {formatDate(nextUpTask.dueDate)}</p>
                        </>
                      ) : (
                        <h3 className="font-serif text-xl font-medium">All caught up!</h3>
                      )}
                   </div>
                   {nextUpTask && (
                     <button onClick={() => toggleModule(nextUpTask.id)} className="relative z-10 bg-[#FDD344] text-[#013E3F] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#ffe175] transition-colors shadow-lg">
                        Start
                     </button>
                   )}
                   <div className="absolute -right-4 -bottom-10 w-32 h-32 bg-[#FDD344] rounded-full blur-[60px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                </div>

                {/* Overdue Alert Card */}
                {overdueTasks.length > 0 ? (
                  <div className="bg-red-50 rounded-xl p-6 text-red-900 border border-red-100 flex items-center justify-between">
                     <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-red-600 mb-1 flex items-center gap-2">
                           <AlertTriangle className="w-4 h-4" /> Attention Needed
                        </div>
                        <h3 className="font-serif text-xl font-medium mb-1">{overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''}</h3>
                        <p className="text-sm text-red-700/70 truncate max-w-[250px]">{overdueTasks[0].title}...</p>
                     </div>
                     <button 
                       onClick={() => { setShowOverdueModal(true); }}
                       className="bg-white text-red-700 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border border-red-200 hover:bg-red-50 transition-colors shadow-sm active:scale-95 transform"
                     >
                        Review
                     </button>
                  </div>
                ) : (
                  <div className="bg-green-50 rounded-xl p-6 text-green-900 border border-green-100 flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700">
                        <CheckCircle className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="font-serif text-lg font-medium">You're on track!</h3>
                        <p className="text-sm text-green-700/70">No overdue items.</p>
                     </div>
                  </div>
                )}
              </div>

              {/* Welcome Hero */}
              <div className="bg-[#F3EEE7] rounded-2xl p-8 lg:p-10 text-[#013E3F] shadow-sm relative overflow-hidden border border-[#013E3F]/5 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 relative z-10">
                  <h1 className="text-4xl font-medium mb-3 text-[#013E3F] font-serif tracking-tight">Welcome to Industrious, {user.name.split(' ')[0]}!</h1>
                  <p className="text-[#013E3F]/70 mb-6 text-lg font-light leading-relaxed">
                    We’re so glad you’re here. This is your personal hub to track your onboarding journey.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a 
                      href="https://sites.google.com/industriousoffice.com/industrious-unit-ops/home?authuser=0&utm_source=Unit+Ops+Comms-+%28JEN+ONLY%29&utm_campaign=fbbaad489c-EMAIL_CAMPAIGN_2023_05_12_04_46&utm_medium=email&utm_term=0_-fbbaad489c-%5BLIST_EMAIL_ID%5D" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#013E3F] text-[#F3EEE7] px-5 py-3 rounded-lg flex items-center gap-2 shadow-lg shadow-[#013E3F]/10 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 font-bold uppercase tracking-wide text-xs"
                    >
                        <Globe className="w-4 h-4" />
                        Open Unit Ops Portal
                    </a>
                    <a 
                      href="https://calendar.google.com/calendar/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#013E3F] text-[#F3EEE7] px-5 py-3 rounded-lg flex items-center gap-2 shadow-lg shadow-[#013E3F]/10 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 font-bold uppercase tracking-wide text-xs"
                    >
                        <CalendarIcon className="w-4 h-4" />
                        Open Your Calendar
                    </a>
                    <a 
                      href="https://industrious.zendesk.com/hc/en-us" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#013E3F] text-[#F3EEE7] px-5 py-3 rounded-lg flex items-center gap-2 shadow-lg shadow-[#013E3F]/10 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 font-bold uppercase tracking-wide text-xs"
                    >
                        <LifeBuoy className="w-4 h-4" />
                        Open Zendesk
                    </a>
                    <a 
                      href="https://industrious.lessonly.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#013E3F] text-[#F3EEE7] px-5 py-3 rounded-lg flex items-center gap-2 shadow-lg shadow-[#013E3F]/10 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 font-bold uppercase tracking-wide text-xs"
                    >
                        <GraduationCap className="w-4 h-4" />
                        Open Lessonly
                    </a>
                    <a 
                      href="https://industrious.slack.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#013E3F] text-[#F3EEE7] px-5 py-3 rounded-lg flex items-center gap-2 shadow-lg shadow-[#013E3F]/10 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 font-bold uppercase tracking-wide text-xs"
                    >
                        <Slack className="w-4 h-4" />
                        Open Slack
                    </a>
                  </div>
                </div>

                {/* Unit Leadership Card */}
                <div className="relative z-10 bg-white p-6 rounded-xl border border-[#013E3F]/10 shadow-sm w-full md:w-auto min-w-[300px]">
                   <h3 className="text-xs font-bold uppercase text-[#013E3F]/40 tracking-widest mb-4 border-b border-[#F3EEE7] pb-2 flex items-center gap-2">
                     <Briefcase className="w-3 h-3" /> Your Leadership!
                   </h3>
                   <div className="space-y-4">
                      {leadershipLoading ? (
                        <div className="flex items-center gap-2 text-[#013E3F]/50 text-sm py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading leadership team...
                        </div>
                      ) : unitLeaders.length === 0 ? (
                        <p className="text-[#013E3F]/50 text-sm py-2">Leadership team not available</p>
                      ) : null}
                      {unitLeaders.map((leader) => {
                         const isManager = leader.id === myProfile.managerId;
                         return (
                           <div key={leader.roleLabel} className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${isManager ? 'bg-[#FDD344]/10' : ''}`}>
                              <img src={leader.avatar} alt={leader.name} className={`w-10 h-10 rounded-full object-cover border-2 flex-shrink-0 ${isManager ? 'border-[#FDD344]' : 'border-[#F3EEE7]'}`} />
                              <div className="flex flex-col">
                                 <p className="text-[9px] font-bold uppercase text-[#013E3F]/40 tracking-widest leading-none mb-1">{leader.roleLabel}</p>
                                 <h3 className={`font-serif font-bold text-sm leading-tight ${isManager ? 'text-[#013E3F]' : 'text-[#013E3F]/80'}`}>{leader.name}</h3>
                                 {isManager && (
                                   <span className="mt-1 text-[9px] font-bold text-[#013E3F] bg-[#FDD344] px-1.5 py-0.5 rounded w-fit">
                                     Your Manager!
                                   </span>
                                 )}
                              </div>
                           </div>
                         );
                      })}
                   </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute right-0 top-0 h-full w-1/3 opacity-[0.03] pointer-events-none">
                  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
                    <path fill="#013E3F" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-5.3C93.5,8.6,82.2,21.5,70.6,32.3C59,43.1,47.1,51.8,34.8,58.7C22.5,65.6,9.8,70.7,-1.8,73.8C-13.4,76.9,-23.9,78,-35.3,74.1C-46.7,70.2,-59,61.3,-68.6,50.1C-78.2,38.9,-85.1,25.4,-84.9,11.9C-84.9,-1.6,-77.4,-15.1,-68.7,-26.8C-60,-38.5,-49.9,-48.4,-38.3,-56.9C-26.7,-65.4,-13.3,-72.5,0.7,-73.7C14.7,-74.9,29.4,-70.1,44.7,-76.4Z" transform="translate(100 100)" />
                  </svg>
                </div>
              </div>

              {/* CALENDAR SECTION (Week At A Glance) */}
              <div className="bg-white rounded-xl shadow-sm border border-[#013E3F]/10 overflow-hidden">
                <div className="bg-[#FDD344] p-4 flex items-center justify-between text-[#013E3F]">
                   <div className="flex items-center gap-3">
                     <CalendarIcon className="w-5 h-5 text-[#013E3F]" />
                     <h3 className="font-serif text-lg font-medium">Week At a Glance</h3>
                   </div>
                   <div className="flex items-center gap-4">
                      <span className="text-sm font-bold uppercase tracking-wider">
                         {weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex bg-[#013E3F]/10 rounded-lg">
                        <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-[#013E3F]/20 rounded-l-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="w-[1px] bg-[#013E3F]/20"></div>
                        <button onClick={() => changeWeek(1)} className="p-2 hover:bg-[#013E3F]/20 rounded-r-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                   </div>
                </div>
                
                {/* Legend for Calendar */}
                <div className="bg-[#F3EEE7] px-4 py-2 flex flex-wrap gap-4 border-b border-[#013E3F]/5">
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-green-100 border border-green-300 rounded-sm"></div> Hosted Training
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-red-100 border border-red-300 rounded-sm"></div> Manager Led
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-purple-100 border border-purple-300 rounded-sm"></div> Peer Partner
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-slate-100 border border-slate-300 rounded-sm"></div> Workbook
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded-sm"></div> BAU
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                      <div className="w-2.5 h-2.5 bg-blue-100 border border-blue-300 rounded-sm"></div> Lessonly
                   </div>
                </div>
                
                {/* Calendar Grid Header (7 Cols) */}
                <div className="grid grid-cols-7 bg-[#F3EEE7] border-b border-[#013E3F]/10">
                  {weekDays.map(day => (
                    <div key={day.toString()} className="py-2 text-center text-xs font-bold uppercase tracking-wide text-[#013E3F]/60">
                      {day.toLocaleDateString('default', { weekday: 'short' })}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid Body (7 Cols) */}
                <div className="grid grid-cols-7 bg-[#F3EEE7] gap-[1px] border-l border-[#013E3F]/10">
                   {weekDays.map(day => {
                     const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                     const dayModules = myModules.filter(m => m.dueDate === dateStr);
                     const isToday = new Date().toDateString() === day.toDateString(); // Won't match mock dates easily but logic is here

                     return (
                        <div key={day.toString()} className={`min-h-[150px] bg-white border-r border-b border-[#013E3F]/10 p-2 relative group hover:bg-[#F3EEE7]/10 transition-colors ${isToday ? 'bg-[#FDD344]/5' : ''}`}>
                          <span className={`text-xs font-bold absolute top-2 left-2 ${isToday ? 'text-[#013E3F] bg-[#FDD344] px-1.5 rounded' : 'text-[#013E3F]/50'}`}>{day.getDate()}</span>
                          <div className="mt-6 space-y-1.5">
                            {dayModules.map(module => (
                              <div 
                                key={module.id} 
                                className={`text-[10px] p-1.5 rounded border shadow-sm ${getModuleStyles(module.type, completedModules.has(module.id))}`}
                              >
                                <div className="font-bold truncate leading-tight">{module.title}</div>
                                {module.link ? (
                                  <a href={module.link} target="_blank" rel="noreferrer" className="opacity-80 hover:opacity-100 hover:underline flex items-center gap-1 mt-1 font-medium">
                                    <Video className="w-2.5 h-2.5" /> Open
                                  </a>
                                ) : (
                                  <div className="opacity-70 mt-0.5">{module.duration}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                     );
                   })}
                </div>
              </div>

              {/* Modules Section */}
              <div className="space-y-6">
                <div className="border-b border-[#F3EEE7]/10 pb-6">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-medium text-[#F3EEE7] font-serif">Your Path</h2>
                        <p className="text-[#F3EEE7]/60 text-sm mt-1">
                          {showIncompleteOnly ? 'Showing remaining tasks' : 'Complete these modules to get started.'}
                        </p>
                    </div>
                    <button 
                      className="text-right hover:opacity-80 transition-opacity focus:outline-none group"
                      onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                      title="Filter incomplete tasks"
                    >
                        <span className="text-3xl font-serif text-[#FDD344] block transition-all duration-500 group-hover:scale-105">{progress}%</span>
                        <span className="text-xs uppercase tracking-widest text-[#F3EEE7]/50 font-bold group-hover:text-[#F3EEE7]">
                          {showIncompleteOnly ? 'Show All' : 'Tap to Filter'}
                        </span>
                    </button>
                  </div>
                  
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[#F3EEE7]/10 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-[#FDD344] rounded-full transition-all duration-1000 ease-out relative"
                        style={{ width: `${progress}%` }}
                      >
                        {/* Subtle Shimmer Effect on the bar */}
                        <div className="absolute top-0 right-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] translate-x-[-100%] opacity-0 animate-[shimmer_2s_infinite]" />
                      </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-[#013E3F]/5 divide-y divide-[#F3EEE7]">
                  {visibleModules.length > 0 ? visibleModules.map((module) => {
                    const isCompleted = completedModules.has(module.id);
                    const isExpanded = expandedComments.has(module.id);

                    return (
                      <div key={module.id} className={`p-6 transition-all duration-300 ${isCompleted ? 'bg-[#F3EEE7]/20 opacity-75' : 'bg-white hover:bg-[#F3EEE7]/10'}`}>
                        <div className="flex items-start gap-5">
                          <button 
                            onClick={() => toggleModule(module.id)}
                            className={`mt-1 flex-shrink-0 transition-colors ${isCompleted ? 'text-[#013E3F]' : 'text-[#013E3F]/20 hover:text-[#013E3F]/60'}`}
                          >
                            {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className={`font-semibold text-lg font-serif ${isCompleted ? 'text-[#013E3F]/40 line-through decoration-[#013E3F]/20' : 'text-[#013E3F]'}`}>
                                {module.title}
                              </h3>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-widest flex items-center gap-1 ${getBadgeColor(module.type)}`}>
                                {getModuleIcon(module.type)}
                                {getModuleLabel(module.type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-[#013E3F]/50 uppercase tracking-widest mb-2">
                               <CalendarIcon className="w-3 h-3" />
                               Due: {formatDate(module.dueDate)}
                            </div>
                            
                            {/* Live Call Host Display */}
                            {module.type === 'LIVE_CALL' && module.host && (
                               <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#166534] bg-[#dcfce7]/50 px-2 py-1 rounded w-fit border border-[#dcfce7]">
                                  <UserIcon className="w-3 h-3" />
                                  Hosted by: {module.host}
                               </div>
                            )}

                            <p className="text-[#013E3F]/70 text-sm mb-4 font-light leading-relaxed">{module.description}</p>
                            
                            {/* Engagement Buttons */}
                            <div className="flex items-center gap-4 mb-4 border-t border-[#F3EEE7] pt-3">
                               <button 
                                 onClick={() => handleLike(module)}
                                 className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${module.liked ? 'text-[#FDD344]' : 'text-[#013E3F]/40 hover:text-[#013E3F]'}`}
                               >
                                  <ThumbsUp className={`w-4 h-4 ${module.liked ? 'fill-current' : ''}`} />
                                  {module.likes || 0}
                               </button>
                               <button 
                                 onClick={() => toggleComments(module.id)}
                                 className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${isExpanded ? 'text-[#013E3F]' : 'text-[#013E3F]/40 hover:text-[#013E3F]'}`}
                               >
                                  <MessageCircle className="w-4 h-4" />
                                  {moduleComments[module.id]?.length || 0} Comments
                               </button>
                            </div>

                            {/* Expanded Comments Section */}
                            {isExpanded && (
                               <div className="bg-[#F3EEE7]/60 p-4 rounded-lg mb-4 animate-in slide-in-from-top-2">
                                  <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto custom-scrollbar">
                                     {moduleComments[module.id] && moduleComments[module.id].length > 0 ? (
                                        moduleComments[module.id].map(comment => (
                                           <div key={comment.id} className="bg-white p-3 rounded border border-[#013E3F]/15 text-sm shadow-sm">
                                              <div className="flex justify-between items-center mb-1">
                                                 <span className="font-bold text-[#013E3F] text-xs uppercase">{comment.author}</span>
                                                 <span className="text-[10px] text-[#013E3F]/40">{formatDate(comment.date)}</span>
                                              </div>
                                              <p className="text-[#013E3F]/80">{comment.text}</p>
                                           </div>
                                        ))
                                     ) : (
                                        <p className="text-center text-[#013E3F]/50 text-xs italic py-2">No comments yet. Be the first!</p>
                                     )}
                                  </div>
                                  <div className="flex gap-2">
                                     <input
                                       type="text"
                                       placeholder="Add a comment..."
                                       className="flex-1 text-sm p-2 border border-[#013E3F]/30 rounded focus:outline-none focus:border-[#013E3F]"
                                       value={commentDrafts[module.id] || ''}
                                       onChange={(e) => setCommentDrafts({...commentDrafts, [module.id]: e.target.value})}
                                       onKeyDown={(e) => e.key === 'Enter' && handlePostComment(module)}
                                     />
                                     <button
                                       onClick={() => handlePostComment(module)}
                                       className="bg-[#013E3F] text-[#F3EEE7] p-2 rounded hover:bg-[#013E3F]/90 transition-colors"
                                     >
                                        <Send className="w-4 h-4" />
                                     </button>
                                  </div>
                               </div>
                            )}
                            
                            <div className="flex gap-3">
                              {module.type === 'LIVE_CALL' && !isCompleted && (
                                <a 
                                  href={module.link || "#"} 
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => handleJoinCall(module.id)}
                                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#013E3F] hover:text-[#013E3F]/80 bg-[#FDD344] hover:bg-[#FDD344]/90 px-4 py-2 rounded transition-colors shadow-sm cursor-pointer"
                                >
                                  <Video className="w-3 h-3" />
                                  Open
                                </a>
                              )}
                              
                              {/* Specific button for Workbook modules to open and link to tab */}
                              {module.type === 'WORKBOOK' && !isCompleted && (
                                <button 
                                  onClick={() => handleOpenWorkbookTask(module.id)}
                                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#013E3F] border border-[#013E3F]/20 hover:border-[#013E3F] hover:bg-[#F3EEE7]/50 bg-white px-4 py-2 rounded transition-all"
                                >
                                  {getModuleIcon(module.type)}
                                  Open Workbook
                                </button>
                              )}

                              {(module.type === 'MANAGER_LED' || module.type === 'PERFORM' || module.type === 'SHADOW' || module.type === 'BAU' || module.type === 'LESSONLY') && !isCompleted && (
                                module.link && module.type !== 'PERFORM' && module.type !== 'BAU' ? (
                                  <a href={module.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#013E3F] border border-[#013E3F]/20 hover:border-[#013E3F] hover:bg-[#F3EEE7]/50 bg-white px-4 py-2 rounded transition-all">
                                    {getModuleIcon(module.type)}
                                    View Details
                                  </a>
                                ) : (
                                  <button className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#013E3F] border border-[#013E3F]/20 hover:border-[#013E3F] hover:bg-[#F3EEE7]/50 bg-white px-4 py-2 rounded transition-all">
                                    {getModuleIcon(module.type)}
                                    {module.type === 'PERFORM' || module.type === 'BAU' ? 'Mark Complete' : 'View Details'}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-10 text-center text-[#013E3F]/40 italic">
                      {showIncompleteOnly ? 'Great job! No incomplete tasks remaining.' : 'No modules available.'}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ---- WORKBOOK TAB CONTENT ---- */}
          {activeTab === 'workbook' && (
             <div className="animate-in fade-in duration-300">
               {!showWorkbook ? (
                 <>
                    <h2 className="text-2xl font-medium text-[#F3EEE7] font-serif mb-6">Workbook Library</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Guide to Service Workbook Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#013E3F]/10 overflow-hidden group cursor-pointer hover:shadow-md transition-all relative" onClick={() => setShowWorkbook(true)}>
                          <div className="bg-[#013E3F] p-6 text-[#F3EEE7] relative overflow-hidden h-40">
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="flex justify-between items-start">
                                   <div className="bg-[#FDD344] p-2 rounded text-[#013E3F]">
                                     <BookOpen className="w-5 h-5" />
                                   </div>
                                </div>
                                <div>
                                  <h2 className="font-serif text-2xl mb-1">Guide to Service</h2>
                                  <p className="text-[#F3EEE7]/70 text-xs uppercase tracking-wide font-bold">Foundation Module</p>
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#FDD344]/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                          </div>
                          <div className="p-6">
                            <p className="text-[#013E3F] text-sm mb-6 line-clamp-2 leading-relaxed">
                              Master the art of the "Heartfelt Hello", practice your orientation scripts, and explore what it means to be empowered.
                            </p>
                            <button className="w-full bg-[#F3EEE7] hover:bg-[#FDD344] py-3 rounded text-[#013E3F] font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all group-hover:shadow-md">
                              Open Workbook <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Placeholder Cards */}
                        <div className="bg-white/5 border border-[#F3EEE7]/10 rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-40 hover:opacity-60 transition-opacity">
                            <BookOpen className="w-10 h-10 text-[#F3EEE7]/30 mb-3" />
                            <h3 className="text-[#F3EEE7]/50 font-serif text-lg mb-1">Conflict Resolution</h3>
                            <p className="text-xs text-[#F3EEE7]/30 uppercase tracking-widest font-bold">Coming Soon</p>
                        </div>
                        
                        <div className="bg-white/5 border border-[#F3EEE7]/10 rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-40 hover:opacity-60 transition-opacity">
                            <BookOpen className="w-10 h-10 text-[#F3EEE7]/30 mb-3" />
                            <h3 className="text-[#F3EEE7]/50 font-serif text-lg mb-1">Advanced Sales</h3>
                            <p className="text-xs text-[#F3EEE7]/30 uppercase tracking-widest font-bold">Coming Soon</p>
                        </div>
                    </div>
                 </>
               ) : (
                 <div className="bg-white rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#013E3F]/10">
                    {/* Inline Workbook Header */}
                    <div className="p-6 border-b border-[#F3EEE7] flex justify-between items-center bg-[#013E3F] text-[#F3EEE7]">
                        <div className="flex items-center gap-4">
                           <button onClick={() => setShowWorkbook(false)} className="hover:bg-[#F3EEE7]/10 p-2 rounded-full transition-colors mr-2">
                              <ArrowRight className="w-5 h-5 rotate-180" />
                           </button>
                           <div className="bg-[#FDD344] p-2 rounded text-[#013E3F]">
                              <BookOpen className="w-5 h-5" />
                           </div>
                           <div>
                             <h3 className="font-serif text-xl font-medium">Guide to Service Workbook</h3>
                             <p className="text-xs text-[#F3EEE7]/60 font-light">Your personal guide to mastering member experience.</p>
                           </div>
                        </div>
                        <div className="hidden md:block">
                           <span className="text-xs bg-[#F3EEE7]/10 px-3 py-1 rounded-full text-[#F3EEE7]/60 border border-[#F3EEE7]/10">Auto-Save Enabled</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[#F3EEE7] px-6 pt-4 space-x-6 overflow-x-auto bg-[#F9F7F5]">
                      {[
                        { id: 'principles', label: 'Heartfelt Hello', icon: MessageSquare },
                        { id: 'welcomed', label: 'Feeling Welcomed', icon: Quote },
                        { id: 'orientation', label: 'Orientation', icon: Lightbulb },
                        { id: 'empowered', label: 'Empowerment', icon: PenTool },
                        { id: 'manager', label: 'From Your Manager', icon: MessageCircle },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setWorkbookTab(tab.id as any)}
                            className={`pb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${workbookTab === tab.id ? 'border-[#013E3F] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                          >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Content Body */}
                    <div className="p-8 bg-white min-h-[500px]">
                        {/* 1. PRINCIPLES / HEARTFELT HELLO */}
                        {workbookTab === 'principles' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto">
                              <div className="bg-white p-6 rounded-lg border border-[#013E3F]/10 shadow-sm hover:shadow-md transition-shadow">
                                 <h4 className="font-serif text-lg text-[#013E3F] mb-2 flex items-center gap-2">
                                   <MessageSquare className="w-5 h-5 text-[#FDD344]" />
                                   The Heartfelt Hello Script
                                 </h4>
                                 <p className="text-sm text-[#013E3F]/70 mb-4">
                                   Write a script for greeting a new member. How do you make them feel seen immediately?
                                 </p>
                                 <textarea 
                                   className="w-full p-4 border border-[#013E3F]/10 rounded-lg text-sm text-[#013E3F] focus:outline-none focus:border-[#013E3F] bg-[#F3EEE7]/10 h-32 leading-relaxed"
                                   placeholder="Ex: 'Good morning, Sarah! I have your usual oat latte ready...'"
                                   value={workbookInputs['principles_script'] || ''}
                                   onChange={(e) => updateWorkbookInput('principles_script', e.target.value)}
                                 />
                                 <div className="flex justify-end mt-2">
                                    <button onClick={() => tagManager('principles_script')} className="text-xs font-bold uppercase text-[#013E3F]/50 hover:text-[#013E3F] flex items-center gap-1">
                                       <AtSign className="w-3 h-3" /> Tag Manager for Feedback
                                    </button>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* 2. FEELING WELCOMED */}
                        {workbookTab === 'welcomed' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto">
                              <div className="bg-white p-6 rounded-lg border border-[#013E3F]/10 shadow-sm hover:shadow-md transition-shadow">
                                 <h4 className="font-serif text-lg text-[#013E3F] mb-4">Reflecting on Hospitality</h4>
                                 
                                 <div className="space-y-4">
                                    <div>
                                      <label className="block text-xs font-bold uppercase tracking-wide text-[#013E3F]/60 mb-2">Think of a place where you felt truly welcomed.</label>
                                      <input 
                                        type="text"
                                        className="w-full p-3 border border-[#013E3F]/10 rounded-lg text-sm"
                                        placeholder="E.g. My grandmother's house, The Ritz, a local cafe..."
                                        value={workbookInputs['welcomed_place'] || ''}
                                        onChange={(e) => updateWorkbookInput('welcomed_place', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold uppercase tracking-wide text-[#013E3F]/60 mb-2">What specifically made you feel that way?</label>
                                      <textarea 
                                        className="w-full p-3 border border-[#013E3F]/10 rounded-lg text-sm h-24"
                                        placeholder="They remembered my name, the lighting was warm..."
                                        value={workbookInputs['welcomed_concrete'] || ''}
                                        onChange={(e) => updateWorkbookInput('welcomed_concrete', e.target.value)}
                                      />
                                    </div>
                                 </div>
                              </div>

                              <div className="bg-[#FDD344]/10 p-6 rounded-lg border border-[#FDD344]/20">
                                 <h4 className="font-bold text-[#013E3F] mb-2 text-sm uppercase tracking-wide">Brainstorming Challenge</h4>
                                 <p className="text-sm text-[#013E3F]/80 mb-4">Identify 3 times in a member's day when it is <span className="italic font-bold">hardest</span> to make them feel welcome.</p>
                                 <div className="space-y-2">
                                    <input className="w-full p-2 text-sm border rounded" placeholder="1." value={workbookInputs['welcomed_hard_1'] || ''} onChange={(e) => updateWorkbookInput('welcomed_hard_1', e.target.value)} />
                                    <input className="w-full p-2 text-sm border rounded" placeholder="2." value={workbookInputs['welcomed_hard_2'] || ''} onChange={(e) => updateWorkbookInput('welcomed_hard_2', e.target.value)} />
                                    <input className="w-full p-2 text-sm border rounded" placeholder="3." value={workbookInputs['welcomed_hard_3'] || ''} onChange={(e) => updateWorkbookInput('welcomed_hard_3', e.target.value)} />
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* 3. ORIENTATION */}
                        {workbookTab === 'orientation' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto">
                              <div className="bg-white p-6 rounded-lg border border-[#013E3F]/10 shadow-sm hover:shadow-md transition-shadow">
                                 <h4 className="font-serif text-lg text-[#013E3F] mb-2">The "Quickie" Orientation</h4>
                                 <p className="text-sm text-[#013E3F]/70 mb-4">You have 60 seconds to orient a guest. What are the absolute non-negotiables they need to know?</p>
                                 <textarea 
                                    className="w-full p-4 border border-[#013E3F]/10 rounded-lg text-sm h-32"
                                    placeholder="WiFi, Bathroom, Coffee..."
                                    value={workbookInputs['orientation_script'] || ''}
                                    onChange={(e) => updateWorkbookInput('orientation_script', e.target.value)}
                                 />
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                   <label className="block text-xs font-bold uppercase text-red-800 mb-2">What goes wrong in a bad orientation?</label>
                                   <textarea className="w-full bg-white p-2 text-sm rounded border border-red-200 h-24" value={workbookInputs['orientation_wrong'] || ''} onChange={(e) => updateWorkbookInput('orientation_wrong', e.target.value)} />
                                 </div>
                                 <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                   <label className="block text-xs font-bold uppercase text-green-800 mb-2">How do we make it incredible?</label>
                                   <textarea className="w-full bg-white p-2 text-sm rounded border border-green-200 h-24" value={workbookInputs['orientation_incredible'] || ''} onChange={(e) => updateWorkbookInput('orientation_incredible', e.target.value)} />
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* 4. EMPOWERMENT */}
                        {workbookTab === 'empowered' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto">
                              <div className="bg-[#013E3F] text-[#F3EEE7] p-8 rounded-lg shadow-lg relative overflow-hidden">
                                 <div className="relative z-10">
                                   <Quote className="w-8 h-8 text-[#FDD344] mb-4 opacity-50" />
                                   <p className="text-xl font-serif italic leading-relaxed mb-6">
                                     "We empower our members to do their best work. But first, we must be empowered ourselves."
                                   </p>
                                   <p className="text-sm opacity-70">- Industrious Principle</p>
                                 </div>
                                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#FDD344] blur-[80px] opacity-20"></div>
                              </div>

                              <div className="bg-white p-6 rounded-lg border border-[#013E3F]/10 shadow-sm hover:shadow-md transition-shadow">
                                 <div className="mb-6">
                                   <label className="block text-sm font-bold text-[#013E3F] mb-2">Describe a behavior of a member who feels fully empowered in our space.</label>
                                   <input className="w-full p-3 border rounded text-sm" placeholder="They move furniture to suit their needs..." value={workbookInputs['empowered_most'] || ''} onChange={(e) => updateWorkbookInput('empowered_most', e.target.value)} />
                                 </div>
                                 <div>
                                   <label className="block text-sm font-bold text-[#013E3F] mb-2">Describe a behavior of a member who does NOT feel empowered.</label>
                                   <input className="w-full p-3 border rounded text-sm" placeholder="They ask permission to grab a cup of water..." value={workbookInputs['empowered_least'] || ''} onChange={(e) => updateWorkbookInput('empowered_least', e.target.value)} />
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* 5. MANAGER PROMPTS */}
                        {workbookTab === 'manager' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto">
                              <div className="bg-[#013E3F] text-[#F3EEE7] p-8 rounded-lg shadow-lg relative overflow-hidden flex items-center justify-between">
                                 <div className="relative z-10">
                                    <h4 className="font-serif text-xl font-medium mb-2">From Your Manager</h4>
                                    <p className="text-[#F3EEE7]/70 text-sm">Specific questions from {myManager.name} to help guide your growth.</p>
                                 </div>
                                 <MessageCircle className="w-10 h-10 text-[#FDD344] opacity-50" />
                              </div>

                              {myProfile.customPrompts && myProfile.customPrompts.length > 0 ? (
                                myProfile.customPrompts.map(prompt => (
                                   <div key={prompt.id} className="bg-white p-6 rounded-lg border border-[#013E3F]/10 shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex items-start gap-4 mb-4">
                                         <div className="w-8 h-8 rounded-full bg-[#FDD344]/20 flex items-center justify-center text-[#013E3F]">
                                            <span className="font-serif font-bold text-lg">Q</span>
                                         </div>
                                         <h4 className="font-serif text-lg text-[#013E3F] pt-1">{prompt.question}</h4>
                                      </div>
                                      
                                      <textarea 
                                        className="w-full p-4 border border-[#013E3F]/10 rounded-lg text-sm text-[#013E3F] focus:outline-none focus:border-[#013E3F] bg-[#F3EEE7]/10 h-32 leading-relaxed"
                                        placeholder="Type your answer here..."
                                        value={promptAnswers[prompt.id] || ''}
                                        onChange={(e) => updatePromptAnswer(prompt.id, e.target.value)}
                                      />
                                   </div>
                                ))
                              ) : (
                                 <div className="text-center py-12 text-[#013E3F]/40 italic bg-white rounded-lg border border-[#013E3F]/5">
                                    No custom prompts from your manager yet.
                                 </div>
                              )}
                           </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-[#F3EEE7] bg-[#F9F7F5] flex justify-between items-center z-10">
                        <span className="text-xs text-[#013E3F]/40 italic">Draft saved automatically locally.</span>
                        <div className="flex gap-3">
                           <button onClick={() => setShowWorkbook(false)} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide text-[#013E3F]/60 hover:text-[#013E3F] hover:bg-[#F3EEE7] transition-colors">Close</button>
                           <button onClick={handleWorkbookSave} className="px-6 py-2.5 bg-[#013E3F] text-[#F3EEE7] rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/90 transition-colors shadow-lg flex items-center gap-2">
                             <Save className="w-4 h-4" /> Save & Complete
                           </button>
                        </div>
                    </div>
                 </div>
               )}
             </div>
          )}
        </div>

      </div>

      {/* OVERDUE TASKS REVIEW MODAL */}
      {showOverdueModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="bg-red-600 p-6 text-white flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-serif text-2xl">Priority Review</h3>
                </div>
                <p className="text-white/80 text-sm font-medium">The following tasks are currently behind schedule.</p>
              </div>
              <button 
                onClick={() => setShowOverdueModal(false)}
                className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              {/* Decorative Circle */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
              {overdueTasks.map(module => (
                <div key={module.id} className="bg-[#F9F7F5] border border-red-100 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${getBadgeColor(module.type)}`}>
                      {getModuleIcon(module.type)}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#013E3F] leading-tight mb-1">{module.title}</h4>
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-red-600 flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          Missed: {formatDate(module.dueDate)}
                        </span>
                        <span className="text-[#013E3F]/40 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {module.duration}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {module.type === 'WORKBOOK' ? (
                      <button 
                        onClick={() => handleOpenWorkbookTask(module.id)}
                        className="flex-1 md:flex-none px-4 py-2 bg-[#013E3F] text-white text-xs font-bold uppercase rounded-lg hover:bg-[#013E3F]/90 transition-colors"
                      >
                        Open
                      </button>
                    ) : module.type === 'LIVE_CALL' ? (
                      <a 
                        href={module.link} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={() => handleJoinCall(module.id)}
                        className="flex-1 md:flex-none px-4 py-2 bg-[#013E3F] text-white text-xs font-bold uppercase rounded-lg hover:bg-[#013E3F]/90 transition-colors text-center"
                      >
                        Join
                      </a>
                    ) : (
                      <button 
                        onClick={() => toggleModule(module.id)}
                        className="flex-1 md:flex-none px-4 py-2 bg-[#013E3F] text-white text-xs font-bold uppercase rounded-lg hover:bg-[#013E3F]/90 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-[#F3EEE7] bg-[#F9F7F5] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <img src={myManager.avatar} className="w-8 h-8 rounded-full border border-[#013E3F]/10" alt="" />
                 <p className="text-xs text-[#013E3F]/60">
                    Reach out to <span className="font-bold text-[#013E3F]">{myManager.name}</span> if you need help!
                 </p>
              </div>
              <button 
                onClick={() => setShowOverdueModal(false)}
                className="w-full md:w-auto px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-[#013E3F] hover:bg-[#F3EEE7] transition-colors"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewHireDashboard;