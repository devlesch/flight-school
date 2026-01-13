import React, { useState } from 'react';
import { User, NewHireProfile, WorkbookPrompt, ManagerTask, TrainingModule } from '../types';
import { NEW_HIRES, MANAGERS } from '../constants';
import { Slack, Mail, CheckSquare, Clock, AlertTriangle, MessageSquarePlus, ChevronRight, X, AlertCircle, CheckCircle, BookOpen, MessageCircle, Megaphone, ListTodo, Calendar, Timer, Info, Target, ArrowRight, LayoutDashboard, Eye, PlusCircle, Send, Users, UserCheck, ChevronLeft, ClipboardList, Briefcase, UserPlus, Search, Filter, UserCog, RefreshCw } from 'lucide-react';
import { generateEmailDraft } from '../services/geminiService';
import confetti from 'canvas-confetti';

interface ManagerDashboardProps {
  user: User;
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

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ user }) => {
  const myHires = NEW_HIRES.filter(h => h.managerId === user.id || NEW_HIRES.length > 0); 
  
  // Navigation State
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(true);
  const [activeTab, setActiveTab] = useState<'team' | 'tracker'>('team');

  // Calendar State (Defaults to Jan 5 2026 to align with mock data)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 0, 5)); 

  const [selectedHireForEmail, setSelectedHireForEmail] = useState<NewHireProfile | null>(null);
  const [viewingHire, setViewingHire] = useState<NewHireProfile | null>(null);
  const [viewingHireTab, setViewingHireTab] = useState<'overview' | 'workbook' | 'tracker'>('overview');

  const [drafting, setDrafting] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  
  // Reassignment State
  const [reassigningTask, setReassigningTask] = useState<{ hireId: string; moduleId: string; title: string } | null>(null);
  
  // Comment & Shoutout state
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [shoutoutMessage, setShoutoutMessage] = useState('');
  const [isSendingShoutout, setIsSendingShoutout] = useState(false);
  
  // Custom Prompts State
  const [newPromptText, setNewPromptText] = useState('');

  // Tracker State
  const [hireTasks, setHireTasks] = useState<Record<string, boolean>>({});
  const [trackerSearch, setTrackerSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  // --- CALENDAR LOGIC ---
  const getWeekDays = (date: Date) => {
    const days = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day; 
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

  // --- WEEK AT A GLANCE AGGREGATION ---
  const getWeeklyTasks = () => {
    let tasks: { 
      id: string; 
      title: string; 
      hireName: string; 
      hireAvatar: string;
      dueDate: Date; 
      dueDateStr: string; 
      type: 'TRAINING' | 'ADMIN'; 
      completed: boolean;
      hire: NewHireProfile; 
      moduleType?: string;
    }[] = [];

    myHires.forEach(hire => {
      hire.modules
        .filter(m => (m.type === 'MANAGER_LED' || m.type === 'LIVE_CALL') && !m.completed)
        .forEach(m => {
          const d = new Date(m.dueDate);
          tasks.push({
            id: m.id,
            title: m.title,
            hireName: hire.name,
            hireAvatar: hire.avatar,
            dueDate: d,
            dueDateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            type: 'TRAINING',
            moduleType: m.type,
            completed: false,
            hire: hire
          });
        });

      if (hire.managerTasks) {
        hire.managerTasks.forEach(t => {
           if (!t.completed) {
             const due = new Date(hire.startDate);
             due.setDate(due.getDate() + t.dueDateOffset);
             
             tasks.push({
               id: t.id,
               title: t.title,
               hireName: hire.name,
               hireAvatar: hire.avatar,
               dueDate: due,
               dueDateStr: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`,
               type: 'ADMIN',
               completed: false,
               hire: hire
             });
           }
        });
      }
    });

    return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  };

  const upcomingTasks = getWeeklyTasks();

  const handleSlackNudge = (name: string) => {
    alert(`Slack reminder sent to ${name}: "Hi! Checking in on your workbook progress."`);
  };

  const handleGenerateNudge = async (hire: NewHireProfile) => {
    setDrafting(true);
    const overdue = hire.modules
      .filter(m => !m.completed && new Date(m.dueDate) < new Date())
      .map(m => m.title);
    const topic = overdue.length > 0 ? "Urgent: Overdue Training Items" : "Checking in on training workbook";
    const draft = await generateEmailDraft(hire.name, user.name, hire.progress, topic, overdue);
    setGeneratedMessage(draft);
    setDrafting(false);
    setSelectedHireForEmail(hire);
  };

  const openHireModal = (hire: NewHireProfile, tab: 'overview' | 'workbook' | 'tracker' = 'overview') => {
    setViewingHire(hire);
    setViewingHireTab(tab);
    setCommentInputs({});
    setShoutoutMessage('');
    setIsSendingShoutout(false);
    setNewPromptText('');
    if (hire.managerTasks) {
       const initialTasks: Record<string, boolean> = {};
       hire.managerTasks.forEach(t => {
         initialTasks[t.id] = t.completed;
       });
       setHireTasks(initialTasks);
    }
  };

  const handleSaveComment = (hire: NewHireProfile, questionKey: string) => {
    if (!hire.workbookComments) hire.workbookComments = {};
    hire.workbookComments[questionKey] = commentInputs[questionKey];
    alert("Comment saved!");
    setCommentInputs(prev => ({...prev})); 
  };

  const handleAddPrompt = (hire: NewHireProfile) => {
    if (!newPromptText.trim()) return;
    if (!hire.customPrompts) hire.customPrompts = [];
    const newPrompt: WorkbookPrompt = {
      id: `cp-${Date.now()}`,
      question: newPromptText,
      answer: '',
      dateAdded: new Date().toISOString()
    };
    hire.customPrompts.unshift(newPrompt);
    setNewPromptText('');
    alert(`Question added to ${hire.name.split(' ')[0]}'s workbook.`);
    setViewingHire({...hire});
  };

  const handleSendShoutout = (hire: NewHireProfile) => {
    if (!shoutoutMessage.trim()) return;
    if (!hire.shoutouts) hire.shoutouts = [];
    hire.shoutouts.unshift({
      id: `s-${Date.now()}`,
      from: user.name,
      message: shoutoutMessage,
      date: new Date().toISOString(),
      avatar: user.avatar
    });
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
    alert(`Shoutout sent to ${hire.name}!`);
    setShoutoutMessage('');
    setIsSendingShoutout(false);
  };

  const toggleManagerTask = (hire: NewHireProfile, taskId: string) => {
    const newVal = !hireTasks[taskId];
    setHireTasks(prev => ({...prev, [taskId]: newVal}));
    const task = hire.managerTasks?.find(t => t.id === taskId);
    if (task) task.completed = newVal;
    if (newVal) {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#FDD344', '#013E3F']
      });
    }
  };

  const handleReassign = (selectedManager: User) => {
    if (!reassigningTask) return;
    const hire = NEW_HIRES.find(h => h.id === reassigningTask.hireId);
    if (hire) {
      const module = hire.modules.find(m => m.id === reassigningTask.moduleId);
      if (module) {
        module.host = selectedManager.name;
        alert(`Successfully reassigned "${module.title}" to ${selectedManager.name}.`);
      }
    }
    setReassigningTask(null);
  };

  const isTaskOverdue = (hire: NewHireProfile, task: ManagerTask) => {
    if (task.completed) return false;
    const dueDate = new Date(hire.startDate);
    dueDate.setDate(dueDate.getDate() + task.dueDateOffset);
    // Using fixed mock "today" as Jan 5, 2026 to stay consistent with training data
    const mockToday = new Date(2026, 0, 5);
    return dueDate < mockToday;
  };

  // --- WELCOME GUIDE RENDER ---
  if (showWelcomeGuide) {
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-[#F3EEE7] rounded-xl overflow-hidden shadow-2xl border border-[#013E3F]/10">
            <div className="bg-[#013E3F] p-10 text-[#F3EEE7] relative overflow-hidden">
                <div className="relative z-10 max-w-3xl">
                  <h1 className="text-4xl md:text-5xl font-serif font-medium mb-4">Welcome, {user.name.split(' ')[0]}!</h1>
                  <p className="text-xl md:text-2xl text-[#FDD344] font-medium mb-6 font-serif">
                    Your Command Center for Onboarding Success
                  </p>
                  <p className="text-[#F3EEE7]/80 text-lg font-light leading-relaxed">
                    This dashboard is designed to give you complete visibility into your new hires' journey. 
                    Track progress, identify coaching opportunities, and ensure your team feels supported from day one.
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FDD344] rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
            </div>
            
            <div className="p-10 bg-white">
                <div className="mb-6 flex items-center gap-2">
                   <Info className="w-5 h-5 text-[#FDD344]" />
                   <h2 className="text-xl font-serif font-medium text-[#013E3F]">How to Use this Website</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                    <div className="p-6 bg-[#F3EEE7]/30 rounded-xl border border-[#013E3F]/5 group hover:border-[#013E3F]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#dcfce7] text-[#166534] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Target className="w-6 h-6" />
                        </div>
                        <h3 className="font-serif text-lg font-bold text-[#013E3F] mb-2">Track Progress</h3>
                        <p className="text-sm text-[#013E3F]/70 leading-relaxed">
                            See at a glance how your team members are trending with their onboarding modules and daily milestones.
                        </p>
                    </div>
                    <div className="p-6 bg-[#F3EEE7]/30 rounded-xl border border-[#013E3F]/5 group hover:border-[#013E3F]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#fee2e2] text-[#991b1b] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="font-serif text-lg font-bold text-[#013E3F] mb-2">Identify Struggles</h3>
                        <p className="text-sm text-[#013E3F]/70 leading-relaxed">
                            Spot where team members are stuck, falling behind, or have overdue tasks so you can intervene immediately.
                        </p>
                    </div>
                     <div className="p-6 bg-[#F3EEE7]/30 rounded-xl border border-[#013E3F]/5 group hover:border-[#013E3F]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#dbeafe] text-[#1e40af] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <h3 className="font-serif text-lg font-bold text-[#013E3F] mb-2">Review Workbooks</h3>
                        <p className="text-sm text-[#013E3F]/70 leading-relaxed">
                             Deep dive into your workbook responses, leave comments, and provide specific feedback.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-center border-t border-[#F3EEE7] pt-8">
                     <p className="text-[#013E3F]/60 text-sm mb-6 italic">
                        "Great managers don't just manage tasks, they empower growth."
                     </p>
                     <button 
                      onClick={() => { setShowWelcomeGuide(false); window.scrollTo(0, 0); }}
                      className="bg-[#FDD344] text-[#013E3F] px-12 py-4 rounded-lg font-bold uppercase tracking-widest text-sm hover:bg-[#ffe175] transition-all transform hover:scale-105 shadow-xl flex items-center gap-3"
                    >
                      Get Started! <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#F3EEE7]/10 pb-6 gap-4">
        <div>
          <h2 className="text-3xl font-medium text-[#F3EEE7] font-serif">
            {activeTab === 'team' ? 'My Team' : 'Onboarding Tracker'}
          </h2>
          <p className="text-[#F3EEE7]/70 mt-2 font-light text-lg">
            {activeTab === 'team' ? 'Overview of your direct reports.' : 'Consolidated manager checklist for your team.'}
          </p>
        </div>
        
        {/* TAB SWITCHER */}
        <div className="flex bg-[#012d2e] p-1 rounded-xl shadow-inner border border-[#F3EEE7]/10">
           <button 
             onClick={() => setActiveTab('team')}
             className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'team' ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7]'}`}
           >
              <Users className="w-4 h-4" /> My Team
           </button>
           <button 
             onClick={() => setActiveTab('tracker')}
             className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'tracker' ? 'bg-[#FDD344] text-[#013E3F] shadow-lg' : 'text-[#F3EEE7]/60 hover:text-[#F3EEE7]'}`}
           >
              <ClipboardList className="w-4 h-4" /> Tracker
           </button>
        </div>
      </div>

      {/* --- TRACKER VIEW --- */}
      {activeTab === 'tracker' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           {/* Global Tracker Stats */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#012d2e] p-6 rounded-xl border border-[#F3EEE7]/10">
                 <h4 className="text-[10px] font-bold uppercase text-[#FDD344] tracking-widest mb-4">Pending Hires</h4>
                 <div className="flex items-center gap-4">
                    <UserPlus className="w-8 h-8 text-[#F3EEE7]/30" />
                    <span className="text-4xl font-serif text-[#F3EEE7]">{myHires.filter(h => new Date(h.startDate) > new Date()).length}</span>
                    <span className="text-xs text-[#F3EEE7]/40 font-medium">starting in next 30 days</span>
                 </div>
              </div>
              <div className="bg-[#012d2e] p-6 rounded-xl border border-[#F3EEE7]/10">
                 <h4 className="text-[10px] font-bold uppercase text-[#FDD344] tracking-widest mb-4">Pre-boarding Tasks</h4>
                 <div className="flex items-center gap-4">
                    <Clock className="w-8 h-8 text-[#F3EEE7]/30" />
                    <span className="text-4xl font-serif text-[#F3EEE7]">
                       {myHires.reduce((acc, h) => acc + (h.managerTasks?.filter(t => !t.completed && t.dueDateOffset < 0).length || 0), 0)}
                    </span>
                    <span className="text-xs text-[#F3EEE7]/40 font-medium">unresolved offer-to-start items</span>
                 </div>
              </div>
              <div className="bg-[#FDD344] p-6 rounded-xl shadow-lg text-[#013E3F]">
                 <h4 className="text-[10px] font-bold uppercase text-[#013E3F]/60 tracking-widest mb-4">Overall Completion</h4>
                 <div className="flex items-center gap-4">
                    <CheckCircle className="w-8 h-8 text-[#013E3F]/30" />
                    <span className="text-4xl font-serif font-bold">
                       {Math.round((myHires.reduce((acc, h) => acc + (h.managerTasks?.filter(t => t.completed).length || 0), 0) / 
                       myHires.reduce((acc, h) => acc + (h.managerTasks?.length || 0), 0)) * 100)}%
                    </span>
                    <span className="text-xs text-[#013E3F]/60 font-bold uppercase">Average across team</span>
                 </div>
              </div>
           </div>

           {/* Filter/Search */}
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F3EEE7]/30" />
                 <input 
                   type="text" 
                   placeholder="Search hires or tasks..." 
                   className="w-full bg-[#012d2e] border border-[#F3EEE7]/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#F3EEE7] focus:outline-none focus:ring-1 focus:ring-[#FDD344]/50"
                   value={trackerSearch}
                   onChange={(e) => setTrackerSearch(e.target.value)}
                 />
              </div>
           </div>

           {/* Detailed Hire List */}
           <div className="space-y-12">
              {myHires
                .filter(h => h.name.toLowerCase().includes(trackerSearch.toLowerCase()) || 
                             h.managerTasks?.some(t => t.title.toLowerCase().includes(trackerSearch.toLowerCase())))
                .map(hire => {
                  const preBoardingTasks = hire.managerTasks?.filter(t => t.dueDateOffset < 0) || [];
                  const onboardingTasks = hire.managerTasks?.filter(t => t.dueDateOffset >= 0) || [];
                  const isPreStart = new Date(hire.startDate) > new Date();

                  return (
                    <div key={hire.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#013E3F]/10">
                       {/* Hire Header */}
                       <div className="p-6 bg-[#F3EEE7]/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                             <img src={hire.avatar} className="w-12 h-12 rounded-full border border-[#013E3F]/10" alt="" />
                             <div>
                                <h3 className="font-serif text-xl text-[#013E3F] font-bold">{hire.name}</h3>
                                <p className="text-xs font-bold uppercase text-[#013E3F]/40">{hire.title}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6">
                             <div className="text-right">
                                <p className="text-[10px] font-bold uppercase text-[#013E3F]/40 mb-1">Start Date</p>
                                <div className="flex items-center gap-2">
                                   <Calendar className={`w-4 h-4 ${isPreStart ? 'text-amber-500' : 'text-green-600'}`} />
                                   <span className={`text-sm font-bold ${isPreStart ? 'text-amber-600' : 'text-green-700'}`}>
                                      {new Date(hire.startDate).toLocaleDateString()}
                                      {isPreStart && <span className="ml-2 text-[9px] bg-amber-100 px-1.5 py-0.5 rounded">PRE-BOARDING</span>}
                                   </span>
                                </div>
                             </div>
                             <div className="w-px h-10 bg-[#013E3F]/10 hidden md:block"></div>
                             <button 
                                onClick={() => openHireModal(hire, 'tracker')}
                                className="bg-[#013E3F] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#013E3F]/90 shadow-md"
                             >
                                Full View
                             </button>
                          </div>
                       </div>

                       {/* Task Content */}
                       <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                          {/* Left: Pre-boarding (The "Golden Period") */}
                          <div>
                             <h4 className="text-xs font-bold uppercase tracking-[2px] text-[#013E3F]/40 mb-6 flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-amber-500" /> Pre-Boarding Tasks (Offer to Day 1)
                             </h4>
                             {preBoardingTasks.length > 0 ? (
                                <div className="space-y-3">
                                   {preBoardingTasks.map(task => {
                                      const overdue = isTaskOverdue(hire, task);
                                      return (
                                        <div 
                                          key={task.id} 
                                          onClick={() => toggleManagerTask(hire, task.id)}
                                          className={`p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer ${task.completed ? 'bg-green-50/50 border-green-200' : overdue ? 'bg-red-50 border-red-200 ring-2 ring-red-500 ring-offset-2 animate-pulse' : 'bg-amber-50/30 border-amber-100 hover:border-amber-300'}`}
                                        >
                                           <div className={`w-5 h-5 rounded border flex items-center justify-center ${task.completed ? 'bg-green-600 border-green-600 text-white' : overdue ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-amber-300 text-transparent'}`}>
                                              {overdue && !task.completed ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckSquare className="w-3 h-3" />}
                                           </div>
                                           <div className="flex-1">
                                              <p className={`text-xs font-bold ${task.completed ? 'text-green-800 line-through decoration-green-800/20' : overdue ? 'text-red-700' : 'text-[#013E3F]'}`}>
                                                 {task.title}
                                                 {overdue && !task.completed && <span className="ml-2 text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">OVERDUE</span>}
                                              </p>
                                              <p className={`text-[10px] ${overdue && !task.completed ? 'text-red-600/70' : 'text-[#013E3F]/50'}`}>{task.description}</p>
                                           </div>
                                           <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${overdue && !task.completed ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                              {Math.abs(task.dueDateOffset)}d Prior
                                           </span>
                                        </div>
                                      );
                                   })}
                                </div>
                             ) : (
                                <p className="text-xs text-[#013E3F]/40 italic">No pre-boarding tasks assigned.</p>
                             )}
                          </div>

                          {/* Right: Post-boarding / First Month */}
                          <div>
                             <h4 className="text-xs font-bold uppercase tracking-[2px] text-[#013E3F]/40 mb-6 flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-blue-500" /> Onboarding Path (First 30 Days)
                             </h4>
                             <div className="space-y-3">
                                {onboardingTasks.map(task => (
                                   <div 
                                     key={task.id} 
                                     onClick={() => toggleManagerTask(hire, task.id)}
                                     className={`p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer ${task.completed ? 'bg-green-50/50 border-green-200' : 'bg-white border-[#013E3F]/5 hover:border-[#013E3F]/20'}`}
                                   >
                                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${task.completed ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-[#013E3F]/20 text-transparent'}`}>
                                         <CheckSquare className="w-3 h-3" />
                                      </div>
                                      <div className="flex-1">
                                         <p className={`text-xs font-bold ${task.completed ? 'text-green-800 line-through decoration-green-800/20' : 'text-[#013E3F]'}`}>{task.title}</p>
                                      </div>
                                      <span className="text-[9px] font-bold text-[#013E3F]/30 uppercase">
                                         {task.dueDateOffset === 0 ? 'Day 1' : `Day ${task.dueDateOffset}`}
                                      </span>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>

                       {/* Progress Footer */}
                       <div className="bg-[#013E3F] px-8 py-3 flex items-center justify-between">
                          <div className="flex-1 max-w-xs mr-8">
                             <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="h-full bg-[#FDD344] rounded-full transition-all duration-700"
                                  style={{ width: `${Math.round(((hire.managerTasks?.filter(t => t.completed).length || 0) / (hire.managerTasks?.length || 1)) * 100)}%` }}
                                ></div>
                             </div>
                          </div>
                          <p className="text-[10px] font-bold uppercase text-[#F3EEE7]/50 tracking-widest">
                             Checklist Progress: {Math.round(((hire.managerTasks?.filter(t => t.completed).length || 0) / (hire.managerTasks?.length || 1)) * 100)}%
                          </p>
                       </div>
                    </div>
                  );
                })}
           </div>

           {/* Bulk Actions / Reminders footer */}
           <div className="bg-[#F3EEE7] p-8 rounded-2xl border border-[#013E3F]/10 flex flex-col items-center text-center">
              <Megaphone className="w-10 h-10 text-[#FDD344] mb-4" />
              <h3 className="font-serif text-2xl text-[#013E3F] mb-2">Need a reminder of what's next?</h3>
              <p className="text-sm text-[#013E3F]/60 max-w-lg mb-6 leading-relaxed">
                 Use the calendar at the top of your My Team view to see exactly which manager-led training sessions you have scheduled for this week.
              </p>
              <button 
                onClick={() => setActiveTab('team')}
                className="bg-[#013E3F] text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform"
              >
                 Return to Weekly View
              </button>
           </div>
        </div>
      )}

      {/* --- TEAM GRID VIEW --- */}
      {activeTab === 'team' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-[#013E3F]/10 overflow-hidden mb-2">
            <div className="bg-[#FDD344] p-4 flex items-center justify-between text-[#013E3F]">
               <div className="flex items-center gap-3">
                 <Calendar className="w-5 h-5 text-[#013E3F]" />
                 <h3 className="font-serif text-lg font-medium">Your Week at a Glance</h3>
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
            
            <div className="bg-[#F3EEE7] px-4 py-2 flex flex-wrap gap-4 border-b border-[#013E3F]/5">
               <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                  <div className="w-2.5 h-2.5 bg-red-600 border border-red-800 rounded-sm"></div> Manager Led Training
               </div>
               <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/60">
                  <div className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded-sm"></div> Admin Task
               </div>
            </div>
            
            <div className="grid grid-cols-7 bg-[#F3EEE7] border-b border-[#013E3F]/10">
              {weekDays.map(day => (
                <div key={day.toString()} className="py-2 text-center text-xs font-bold uppercase tracking-wide text-[#013E3F]/60">
                  {day.toLocaleDateString('default', { weekday: 'short' })}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-[#F3EEE7] gap-[1px] border-l border-[#013E3F]/10">
               {weekDays.map(day => {
                 const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                 const dayTasks = upcomingTasks.filter(t => t.dueDateStr === dateStr);
                 const isToday = new Date().toDateString() === day.toDateString(); 

                 return (
                    <div key={day.toString()} className={`min-h-[150px] bg-white border-r border-b border-[#013E3F]/10 p-2 relative group hover:bg-[#F3EEE7]/10 transition-colors ${isToday ? 'bg-[#FDD344]/5' : ''}`}>
                      <span className={`text-xs font-bold absolute top-2 left-2 ${isToday ? 'text-[#013E3F] bg-[#FDD344] px-1.5 rounded' : 'text-[#013E3F]/50'}`}>{day.getDate()}</span>
                      <div className="mt-6 space-y-1.5">
                        {dayTasks.map(task => {
                          const isManagerLed = task.moduleType === 'MANAGER_LED';
                          return (
                            <div 
                              key={task.id} 
                              onClick={() => openHireModal(task.hire, task.type === 'TRAINING' ? 'overview' : 'tracker')}
                              className={`text-[10px] p-1.5 rounded border shadow-sm cursor-pointer hover:shadow-md transition-all ${isManagerLed ? 'bg-red-600 border-red-800 text-white border-l-4 font-bold' : task.type === 'TRAINING' ? 'bg-red-50 border-red-200 text-red-900 border-l-4 border-l-red-500' : 'bg-amber-50 border-amber-200 text-amber-900 border-l-4 border-l-amber-500'}`}
                            >
                              <div className="truncate leading-tight">{task.title}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                 <img src={task.hireAvatar} alt={task.hireName} className="w-4 h-4 rounded-full border border-black/10" />
                                 <span className={`${isManagerLed ? 'text-white/80' : 'opacity-80'} truncate`}>{task.hireName.split(' ')[0]}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                 );
               })}
            </div>
          </div>

          {/* TEAM LIST SEARCH */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#012d2e] p-6 rounded-xl border border-[#F3EEE7]/10">
             <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F3EEE7]/30" />
                <input 
                  type="text" 
                  placeholder="Search your team..." 
                  className="w-full bg-[#013E3F] border border-[#F3EEE7]/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#F3EEE7] focus:outline-none focus:ring-1 focus:ring-[#FDD344]/50"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                />
             </div>
             <p className="text-[10px] font-bold uppercase text-[#F3EEE7]/40 tracking-widest">
                Showing {myHires.filter(h => h.name.toLowerCase().includes(teamSearch.toLowerCase()) || h.title.toLowerCase().includes(teamSearch.toLowerCase())).length} team members
             </p>
          </div>

          {myHires.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myHires
                .filter(h => h.name.toLowerCase().includes(teamSearch.toLowerCase()) || h.title.toLowerCase().includes(teamSearch.toLowerCase()))
                .map((hire) => {
                 const overdueCount = hire.modules.filter(m => !m.completed && new Date(m.dueDate) < new Date()).length;
                 return (
                  <div 
                    key={hire.id} 
                    onClick={() => openHireModal(hire)} 
                    className="bg-white p-6 rounded-xl shadow-sm border border-[#013E3F]/10 cursor-pointer hover:shadow-md hover:border-[#FDD344] transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-4">
                       <div className="flex items-center gap-4">
                          <div className="relative">
                            <img src={hire.avatar} className="w-14 h-14 rounded-full border border-[#013E3F]/10 object-cover" alt={hire.name} />
                            {overdueCount > 0 && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold animate-pulse shadow-sm">
                                {overdueCount}
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-serif text-lg text-[#013E3F] font-bold group-hover:text-[#FDD344] transition-colors">{hire.name}</h3>
                            <p className="text-xs text-[#013E3F]/60 uppercase tracking-widest font-bold">{hire.title}</p>
                          </div>
                       </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#F3EEE7]">
                        <div className="flex justify-between text-xs mb-2">
                           <span className="text-[#013E3F]/60 font-bold uppercase tracking-wide">Progress</span>
                           <span className={`font-bold ${hire.progress < 20 ? 'text-red-500' : 'text-[#013E3F]'}`}>{hire.progress}%</span>
                        </div>
                        <div className="w-full bg-[#F3EEE7] h-2 rounded-full mb-4">
                           <div className={`h-2 rounded-full transition-all duration-500 ${hire.progress < 20 ? 'bg-red-400' : 'bg-[#013E3F]'}`} style={{width: `${hire.progress}%`}}></div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] bg-[#F3EEE7] px-2 py-1 rounded text-[#013E3F]/60 font-bold uppercase tracking-wide">
                               {hire.department}
                            </span>
                            <ChevronRight className="w-4 h-4 text-[#013E3F]/30 group-hover:text-[#FDD344] transition-colors" />
                        </div>
                    </div>
                  </div>
                 );
              })}
            </div>
          ) : (
            <div className="mt-8 p-10 bg-[#F3EEE7]/10 rounded-xl border border-[#F3EEE7]/10 text-[#F3EEE7]/50 italic text-center">
               No direct reports found.
            </div>
          )}
        </div>
      )}

      {/* Detailed Profile Modal */}
      {viewingHire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-[#F3EEE7] flex justify-between items-center bg-[#F3EEE7]/30">
                <div className="flex items-center gap-4">
                   <img src={viewingHire.avatar} className="w-14 h-14 rounded-full border border-[#013E3F]/10" alt={viewingHire.name} />
                   <div>
                     <h3 className="font-serif text-xl text-[#013E3F] font-medium">{viewingHire.name}</h3>
                     <p className="text-xs font-bold uppercase text-[#013E3F]/40 tracking-widest">{viewingHire.title}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setIsSendingShoutout(!isSendingShoutout)}
                     className={`p-2 rounded-full transition-colors ${isSendingShoutout ? 'bg-[#FDD344] text-[#013E3F]' : 'text-[#013E3F]/40 hover:bg-[#F3EEE7] hover:text-[#013E3F]'}`}
                     title="Give Shoutout"
                   >
                     <Megaphone className="w-5 h-5" />
                   </button>
                   <button onClick={() => setViewingHire(null)} className="text-[#013E3F]/40 hover:text-[#013E3F] p-1 rounded-full hover:bg-[#F3EEE7]/50"><X className="w-6 h-6" /></button>
                </div>
             </div>

             {isSendingShoutout && (
                <div className="bg-[#FDD344]/10 p-6 border-b border-[#FDD344]/20 animate-in slide-in-from-top-4">
                  <h4 className="text-sm font-bold uppercase text-[#013E3F] mb-2 flex items-center gap-2">
                    <Megaphone className="w-4 h-4" /> Give a Shoutout
                  </h4>
                  <textarea 
                    className="w-full p-3 border border-[#013E3F]/10 rounded-lg text-sm text-[#013E3F] focus:outline-none focus:border-[#013E3F] bg-white resize-none h-24 mb-3"
                    placeholder={`Write something nice about ${viewingHire.name.split(' ')[0]}...`}
                    value={shoutoutMessage}
                    onChange={(e) => setShoutoutMessage(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                     <button onClick={() => setIsSendingShoutout(false)} className="text-xs font-bold text-[#013E3F]/50 hover:text-[#013E3F] px-3 py-2">Cancel</button>
                     <button onClick={() => handleSendShoutout(viewingHire)} className="bg-[#013E3F] text-[#F3EEE7] px-4 py-2 rounded text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/90">Send Shoutout</button>
                  </div>
                </div>
             )}
             
             <div className="flex border-b border-[#F3EEE7] px-6">
                <button 
                  onClick={() => setViewingHireTab('overview')}
                  className={`py-3 px-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${viewingHireTab === 'overview' ? 'border-[#FDD344] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                >
                  Overview
                </button>
                <button 
                  onClick={() => setViewingHireTab('workbook')}
                  className={`py-3 px-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-2 ${viewingHireTab === 'workbook' ? 'border-[#FDD344] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                >
                  <BookOpen className="w-4 h-4" /> Workbook
                </button>
                <button 
                  onClick={() => setViewingHireTab('tracker')}
                  className={`py-3 px-4 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-2 ${viewingHireTab === 'tracker' ? 'border-[#FDD344] text-[#013E3F]' : 'border-transparent text-[#013E3F]/40 hover:text-[#013E3F]/70'}`}
                >
                  <ListTodo className="w-4 h-4" /> Tracker
                </button>
             </div>

             <div className="p-6 overflow-y-auto bg-[#F9F7F5] flex-1">
                {viewingHireTab === 'overview' && (
                  <>
                    <div className="mb-8">
                      <h4 className="font-bold text-[#013E3F] mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" /> 
                        Attention Needed (Overdue)
                      </h4>
                      <div className="space-y-3">
                        {viewingHire.modules.filter(m => !m.completed && new Date(m.dueDate) < new Date()).length === 0 ? (
                          <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-center">
                              <p className="text-sm font-medium text-green-700 flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" /> No overdue items.
                              </p>
                          </div>
                        ) : (
                          viewingHire.modules.filter(m => !m.completed && new Date(m.dueDate) < new Date()).map(m => (
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

                    {viewingHire.okrs && viewingHire.okrs.length > 0 && (
                        <div className="mb-8">
                           <h4 className="font-bold text-[#013E3F] mb-4 flex items-center gap-2">
                              <Target className="w-5 h-5 text-[#FDD344]" /> 
                              Objectives & Key Results
                           </h4>
                           <div className="space-y-3">
                              {viewingHire.okrs.map((okr, idx) => (
                                 <div key={idx} className="bg-white border border-[#013E3F]/10 p-4 rounded-lg shadow-sm">
                                    <h5 className="font-bold text-[#013E3F] text-sm mb-3 font-serif leading-snug">{okr.title}</h5>
                                    <ul className="space-y-2">
                                       {okr.keyResults.map((kr, kIdx) => (
                                          <li key={kIdx} className="flex items-start gap-2 text-xs text-[#013E3F]/70 leading-relaxed">
                                             <div className="w-1.5 h-1.5 rounded-full bg-[#FDD344] mt-1.5 flex-shrink-0" />
                                             <span>{kr.description}</span>
                                          </li>
                                       ))}
                                    </ul>
                                 </div>
                              ))}
                           </div>
                        </div>
                    )}

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
                            {viewingHire.modules.map(m => {
                              const isOverdue = !m.completed && new Date(m.dueDate) < new Date();
                              const canReassign = m.type === 'MANAGER_LED' || m.type === 'LIVE_CALL';
                              return (
                                <tr key={m.id} className="hover:bg-[#F3EEE7]/20 transition-colors">
                                  <td className="p-4 font-medium text-[#013E3F]">
                                    <div className="flex flex-col">
                                      <span>{m.title}</span>
                                      {isOverdue && <span className="text-red-500 text-[10px] font-bold uppercase mt-1">Overdue since {new Date(m.dueDate).toLocaleDateString()}</span>}
                                    </div>
                                  </td>
                                  <td className="p-4 text-xs font-bold text-[#013E3F]/60">
                                    <div className="flex items-center gap-2">
                                      {m.host || 'General Manager'}
                                      {canReassign && (
                                        <button 
                                          onClick={() => setReassigningTask({ hireId: viewingHire.id, moduleId: m.id, title: m.title })}
                                          className="p-1 hover:bg-[#013E3F]/10 rounded text-[#013E3F]"
                                          title="Reassign Task"
                                        >
                                          <UserCog className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    {m.completed ? (
                                      <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">Complete</span>
                                    ) : (
                                      <span className="text-[#013E3F]/40 bg-[#F3EEE7] px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">Pending</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                    </div>
                  </>
                )}

                {viewingHireTab === 'workbook' && (
                  <div className="space-y-6">
                     <div className="bg-[#F3EEE7]/50 border border-[#F3EEE7] p-4 rounded-lg text-sm text-[#013E3F]/80 italic">
                        Responses are saved automatically from the employee's workbook. You can leave comments or ask new questions.
                     </div>
                     
                     <div className="bg-white border border-[#013E3F]/10 p-5 rounded-lg shadow-sm">
                        <h5 className="font-bold text-[#013E3F] mb-3 flex items-center gap-2 text-sm">
                           <PlusCircle className="w-4 h-4 text-[#FDD344]" />
                           Add Custom Prompt
                        </h5>
                        <div className="flex gap-2">
                           <input 
                             type="text" 
                             className="flex-1 border border-[#013E3F]/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#013E3F]"
                             placeholder="Ask a question..."
                             value={newPromptText}
                             onChange={(e) => setNewPromptText(e.target.value)}
                           />
                           <button 
                             onClick={() => handleAddPrompt(viewingHire)}
                             className="bg-[#013E3F] text-[#F3EEE7] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/90 flex items-center gap-1"
                           >
                             Add
                           </button>
                        </div>
                     </div>

                     {viewingHire.customPrompts && viewingHire.customPrompts.length > 0 && (
                        <div className="space-y-4">
                           <h5 className="font-bold text-[#013E3F] text-xs uppercase tracking-wide border-b border-[#013E3F]/10 pb-2">Custom Questions</h5>
                           {viewingHire.customPrompts.map(prompt => (
                              <div key={prompt.id} className="bg-white border border-[#013E3F]/10 p-5 rounded-lg shadow-sm">
                                 <p className="text-xs font-bold uppercase tracking-wide text-[#013E3F]/50 mb-2">Manager Question</p>
                                 <p className="text-[#013E3F] text-sm font-medium mb-3">{prompt.question}</p>
                                 {prompt.answer ? (
                                    <div className="bg-[#F3EEE7]/50 p-3 rounded text-sm text-[#013E3F] italic">"{prompt.answer}"</div>
                                 ) : (
                                    <p className="text-xs text-[#013E3F]/40 italic">Waiting for response...</p>
                                 )}
                              </div>
                           ))}
                        </div>
                     )}
                     
                     <div className="border-t border-[#013E3F]/10 pt-4"></div>

                     {viewingHire.workbookResponses && Object.keys(viewingHire.workbookResponses).length > 0 ? (
                       Object.entries(viewingHire.workbookResponses).map(([key, answer]) => {
                         const existingComment = viewingHire.workbookComments?.[key];
                         return (
                           <div key={key} className="bg-white border border-[#013E3F]/10 p-5 rounded-lg shadow-sm">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#013E3F]/50 mb-2">{QUESTION_LABELS[key] || key}</p>
                              <p className="text-[#013E3F] text-sm leading-relaxed whitespace-pre-wrap mb-4 font-medium">{answer}</p>
                              <div className="mt-4 pt-4 border-t border-[#F3EEE7]">
                                <label className="block text-xs font-bold text-[#013E3F] mb-1 flex items-center gap-2">
                                  <MessageCircle className="w-3 h-3 text-[#FDD344]" /> Manager Comment
                                </label>
                                {existingComment ? (
                                  <div className="bg-[#F3EEE7] p-3 rounded text-sm text-[#013E3F]">{existingComment}</div>
                                ) : (
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      className="flex-1 border border-[#013E3F]/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#013E3F]"
                                      placeholder="Add feedback..."
                                      value={commentInputs[key] || ''}
                                      onChange={(e) => setCommentInputs({...commentInputs, [key]: e.target.value})}
                                    />
                                    <button 
                                      onClick={() => handleSaveComment(viewingHire, key)}
                                      className="bg-[#013E3F] text-[#F3EEE7] px-3 py-2 rounded text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/90"
                                    >
                                      Save
                                    </button>
                                  </div>
                                )}
                              </div>
                           </div>
                         );
                       })
                     ) : (
                       <div className="text-center py-6 text-[#013E3F]/40">
                          <p>No standard workbook responses yet.</p>
                       </div>
                     )}
                  </div>
                )}
                
                {viewingHireTab === 'tracker' && (
                  <div className="space-y-6">
                    <div className="bg-[#F3EEE7] border border-[#013E3F]/5 p-6 rounded-lg text-sm text-[#013E3F]">
                       <h4 className="font-bold text-lg mb-2 font-serif">Onboarding Path Completion Tracker</h4>
                       <p className="text-[#013E3F]/70 mb-4">Complete these tasks to ensure your new hire has a smooth start. These are monitored by Ops Admins.</p>
                       <div className="w-full bg-[#013E3F]/10 rounded-full h-2 mb-2">
                          <div 
                             className="bg-[#013E3F] h-2 rounded-full transition-all duration-500" 
                             style={{ width: `${Math.round(((viewingHire.managerTasks?.filter(t => hireTasks[t.id]).length || 0) / (viewingHire.managerTasks?.length || 1)) * 100)}%` }}
                          ></div>
                       </div>
                       <p className="text-xs font-bold text-[#013E3F]/40 uppercase tracking-widest text-right">
                          {Math.round(((viewingHire.managerTasks?.filter(t => hireTasks[t.id]).length || 0) / (viewingHire.managerTasks?.length || 1)) * 100)}% Complete
                       </p>
                    </div>

                    <div className="space-y-3">
                       {viewingHire.managerTasks?.map((task) => {
                         const isCompleted = hireTasks[task.id];
                         const isPreBoarding = task.dueDateOffset < 0;
                         const overdue = isTaskOverdue(viewingHire, task);
                         return (
                           <div 
                              key={task.id} 
                              onClick={() => toggleManagerTask(viewingHire, task.id)}
                              className={`p-4 rounded-lg border cursor-pointer transition-all group flex items-start gap-4 ${isCompleted ? 'bg-green-50 border-green-200' : overdue ? 'bg-red-50 border-red-300 ring-2 ring-red-500/20' : 'bg-white border-[#013E3F]/10 hover:border-[#013E3F]/30 shadow-sm'}`}
                           >
                              <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-600 border-green-600 text-white' : overdue ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-[#013E3F]/20 text-transparent'}`}>
                                 {overdue && !isCompleted ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-1">
                                    <h5 className={`font-bold text-sm ${isCompleted ? 'text-green-800 line-through decoration-green-800/30' : overdue ? 'text-red-700' : 'text-[#013E3F]'}`}>
                                      {task.title}
                                    </h5>
                                    {isPreBoarding && !isCompleted && !overdue && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Pre-Boarding</span>}
                                    {overdue && !isCompleted && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Overdue Action Needed</span>}
                                 </div>
                                 <p className={`text-xs ${isCompleted ? 'text-green-600' : overdue ? 'text-red-600/70' : 'text-[#013E3F]/60'}`}>{task.description}</p>
                                 <div className="flex gap-3 mt-3">
                                   <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#013E3F]/40">
                                      <Timer className="w-3 h-3" /> {task.timeEstimate}
                                   </span>
                                   <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${task.dueDateOffset < 0 && !isCompleted ? (overdue ? 'text-red-600' : 'text-amber-500') : 'text-[#013E3F]/40'}`}>
                                      <Calendar className="w-3 h-3" /> 
                                      {task.dueDateOffset < 0 ? `${Math.abs(task.dueDateOffset)} days before start` : `${task.dueDateOffset === 0 ? 'On' : `${task.dueDateOffset} days after`} start`}
                                   </span>
                                 </div>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                )}
             </div>
             
             <div className="p-4 border-t border-[#F3EEE7] bg-white flex justify-end gap-3 z-10">
                <button onClick={() => handleSlackNudge(viewingHire.name)} className="px-5 py-2.5 border border-[#013E3F]/10 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#F3EEE7] transition-colors text-[#013E3F]">Slack Nudge</button>
                <button onClick={() => { setViewingHire(null); handleGenerateNudge(viewingHire); }} className="px-5 py-2.5 bg-[#013E3F] text-[#F3EEE7] rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/90 transition-colors shadow-lg shadow-[#013E3F]/20">Draft Email</button>
             </div>
          </div>
        </div>
      )}

      {/* AI Draft Modal */}
      {selectedHireForEmail && generatedMessage && (
        <div className="fixed inset-0 bg-[#013E3F]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-[#013E3F]/10">
            <div className="p-5 border-b border-[#F3EEE7] flex justify-between items-center bg-[#F3EEE7]/30">
              <h3 className="font-semibold text-[#013E3F] flex items-center gap-2 font-serif">
                <MessageSquarePlus className="w-5 h-5 text-[#FDD344]" />
                Draft to {selectedHireForEmail.name}
              </h3>
              <button onClick={() => setSelectedHireForEmail(null)} className="text-[#013E3F]/40 hover:text-[#013E3F] transition-colors">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold text-[#013E3F]/40 uppercase tracking-widest mb-2">AI Generated Draft</p>
              <textarea 
                className="w-full h-40 p-4 border border-[#013E3F]/10 rounded-lg text-sm text-[#013E3F] focus:ring-1 focus:ring-[#013E3F] focus:border-[#013E3F] outline-none resize-none bg-[#F3EEE7]/20 font-sans leading-relaxed"
                defaultValue={generatedMessage}
              />
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setSelectedHireForEmail(null)} className="px-5 py-2.5 text-sm font-medium text-[#013E3F]/70 hover:text-[#013E3F] transition-colors">Cancel</button>
                <button onClick={() => {alert("Message sent!"); setSelectedHireForEmail(null);}} className="px-5 py-2.5 text-sm font-bold bg-[#013E3F] text-[#F3EEE7] hover:bg-[#013E3F]/90 rounded-lg shadow-lg shadow-[#013E3F]/20 flex items-center gap-2">
                   Send Message <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN MODAL */}
      {reassigningTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#013E3F]/80 backdrop-blur-md">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 bg-[#F3EEE7] border-b border-[#013E3F]/10 flex justify-between items-center">
                 <div>
                    <h3 className="font-serif text-xl text-[#013E3F]">Reassign Training</h3>
                    <p className="text-xs font-bold uppercase text-[#013E3F]/40 tracking-widest mt-1">Delegating: {reassigningTask.title}</p>
                 </div>
                 <button onClick={() => setReassigningTask(null)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-5 h-5 text-[#013E3F]" /></button>
              </div>
              <div className="p-6 max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar">
                 <p className="text-sm text-[#013E3F]/60 mb-4 leading-relaxed">Select a leader to take ownership of this session. They will see this in their "Your Week at a Glance" view.</p>
                 {MANAGERS.filter(m => m.id !== user.id).map(mgr => (
                    <button 
                       key={mgr.id}
                       onClick={() => handleReassign(mgr)}
                       className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#013E3F]/5 bg-[#F9F7F5] hover:border-[#FDD344] hover:bg-white transition-all text-left group"
                    >
                       <img src={mgr.avatar} className="w-10 h-10 rounded-full border border-[#013E3F]/10" alt="" />
                       <div className="flex-1">
                          <h4 className="font-bold text-[#013E3F] text-sm group-hover:text-[#FDD344] transition-colors">{mgr.name}</h4>
                          <p className="text-[10px] font-bold uppercase text-[#013E3F]/40">{mgr.title} • {mgr.region}</p>
                       </div>
                       <RefreshCw className="w-4 h-4 text-[#013E3F]/20 group-hover:text-[#FDD344] group-hover:rotate-180 transition-all duration-500" />
                    </button>
                 ))}
                 
                 {/* Placeholder for Assistant Managers/Other Roles mentioned by user */}
                 <div className="pt-4 border-t border-[#F3EEE7]">
                    <p className="text-[10px] font-bold uppercase text-[#013E3F]/30 tracking-widest mb-3">Other Support Staff</p>
                    <div className="p-4 rounded-xl border border-dashed border-[#013E3F]/10 flex items-center justify-center gap-2 text-xs font-bold text-[#013E3F]/40 italic">
                       Search for specific Assistant Managers or MXMs...
                    </div>
                 </div>
              </div>
              <div className="p-4 bg-[#F3EEE7]/50 border-t border-[#F3EEE7] flex justify-end">
                 <button onClick={() => setReassigningTask(null)} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-[#013E3F]/60 hover:text-[#013E3F]">Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;