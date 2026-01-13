import { UserRole, NewHireProfile, User, Objective, ManagerTask } from './types';
import { MessageCircleHeart, Footprints, Wrench, HeartHandshake, Network } from 'lucide-react';

export const CURRENT_USER_ADMIN: User = {
  id: 'admin-1',
  name: 'Sarah Operations',
  role: UserRole.ADMIN,
  avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  title: 'Operations Program Manager',
  email: 'sarah@industriousoffice.com'
};

export const MANAGERS: User[] = [
  {
    id: 'mgr-1',
    name: 'Kevin Jung',
    role: UserRole.MANAGER,
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    title: 'Regional Director',
    email: 'kevin.jung@industriousoffice.com',
    region: 'East'
  },
  {
    id: 'mgr-2',
    name: 'Elena Supervisor',
    role: UserRole.MANAGER,
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    title: 'Area Manager',
    email: 'elena@industriousoffice.com',
    region: 'East'
  },
  {
    id: 'mgr-3',
    name: 'Chris Calkins',
    role: UserRole.MANAGER,
    avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
    title: 'Regional Director',
    email: 'chris.calkins@industriousoffice.com',
    region: 'West'
  },
  {
    id: 'mgr-4',
    name: 'Sarah Miller',
    role: UserRole.MANAGER,
    avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
    title: 'Area Manager',
    email: 'sarah.miller@industriousoffice.com',
    region: 'West'
  },
  {
    id: 'mgr-5',
    name: 'Nicole Teague',
    role: UserRole.MANAGER,
    avatar: 'https://randomuser.me/api/portraits/women/45.jpg',
    title: 'Regional Director',
    email: 'nicole.teague@industriousoffice.com',
    region: 'Central'
  }
];

export const UNIVERSAL_SERVICE_STEPS = [
  {
    title: "The Heartfelt Hello",
    desc: "I make eye contact and offer a friendly verbal greeting to anyone within 5 feet of me. If it's a member, I greet them by name.",
    icon: MessageCircleHeart
  },
  {
    title: "The First Five Steps",
    desc: "When assisting someone, I take at least the first five steps with them to help them get where they're going.",
    icon: Footprints
  },
  {
    title: "The Problem Resolution",
    desc: "When something goes wrong, I immediately dive in to solve the problem or set expectations. I update my members daily.",
    icon: Wrench
  },
  {
    title: "The Helping Hand",
    desc: "I end every interaction with: \"How else can I help?\"",
    icon: HeartHandshake
  },
  {
    title: "The Dot Connector",
    desc: "I know something that's meaningful to each of my members, and use that to personalize my service often in unexpected ways.",
    icon: Network
  }
];

// --- MANAGER ONBOARDING TRACKER TASKS ---
export const MANAGER_ONBOARDING_TASKS: Omit<ManagerTask, 'completed'>[] = [
  {
    id: 'mt-1',
    title: 'Submit Zendesk Onboarding Ticket',
    description: 'Triggers critical processes (Workday, G-Suite, Slack, Zoom, etc.).',
    dueDateOffset: -7,
    timeEstimate: '<5 mins'
  },
  {
    id: 'mt-2',
    title: 'Order Welcome Swag Bag',
    description: 'Includes flair pen, sticker, notebook, baseball cap.',
    dueDateOffset: -7,
    timeEstimate: '<5 mins'
  },
  {
    id: 'mt-3',
    title: 'Update Admin Portal Location Page',
    description: 'Update "Location Managers" section. Wait until they log into Salesforce first.',
    dueDateOffset: 1,
    timeEstimate: '5 mins'
  },
  {
    id: 'mt-4',
    title: 'Added to Distro Lists',
    description: 'Ensure they are on local and regional Google Groups/Slack channels.',
    dueDateOffset: 1,
    timeEstimate: '5 mins'
  },
  {
    id: 'mt-5',
    title: 'Upload Member Portal Photo',
    description: 'Instruct hire to upload profile photo for the website.',
    dueDateOffset: 0,
    timeEstimate: '5 mins'
  },
  {
    id: 'mt-6',
    title: 'Training Schedule & Onboarding Toolkit',
    description: 'Duplicate template, customize, and share standard Ops Onboarding Roadmap.',
    dueDateOffset: 0,
    timeEstimate: '60 mins'
  },
  {
    id: 'mt-7',
    title: 'Growth Ops ZenDesk Ticket',
    description: 'Ticket Type: Calendly - Tour Member Availability Change (MxMs Only).',
    dueDateOffset: 7,
    timeEstimate: '<5 mins'
  },
  {
    id: 'mt-8',
    title: 'Send Team Call Invites',
    description: 'Manually add to recurring calls (NAOPs Call, All Hands, etc.).',
    dueDateOffset: 0,
    timeEstimate: '5 mins'
  },
  {
    id: 'mt-9',
    title: 'Complete Systems Checklist',
    description: 'Use the Systems Cheat Sheet to ensure access to all systems.',
    dueDateOffset: 7,
    timeEstimate: '30 mins'
  },
  {
    id: 'mt-10',
    title: 'Functional Training Debriefs',
    description: 'Conduct debriefs for Facilities, MTS, and Sales training modules.',
    dueDateOffset: 30,
    timeEstimate: '45 mins'
  }
];

// Generic modules
export const MOCK_TRAINING_MODULES = [
  {
    id: 'tm-1',
    title: 'Industrious Culture Workbook',
    description: 'Learn about our core values and mission.',
    type: 'WORKBOOK' as const,
    duration: '2 hours',
    completed: true,
    dueDate: '2026-01-05', 
    score: 95
  },
  {
    id: 'tm-2',
    title: 'Operations Systems Training',
    description: 'Deep dive into our internal tools.',
    type: 'VIDEO' as const,
    duration: '45 mins',
    completed: false,
    dueDate: '2026-01-08'
  }
];

export const MXM_ONBOARDING_MODULES = [
  {
    id: 'w1-1',
    title: 'IN PERSON OFFSITE TRAINING',
    description: 'All week: Immersion in Industrious culture and service standards.',
    type: 'LIVE_CALL' as const,
    duration: '5 Days',
    completed: true,
    dueDate: '2026-01-05',
    link: 'https://calendar.google.com',
    host: 'National Training Team'
  },
  {
    id: 'w1-2',
    title: 'Intro to Training Path & Workbook',
    description: 'Review the Guide to Service and your training roadmap.',
    type: 'WORKBOOK' as const,
    duration: '1 hour',
    completed: true,
    dueDate: '2026-01-05'
  },
  {
    id: 'w1-3',
    title: 'Systems Access Setup',
    description: 'Ensure you have access to Slack, Workday, Salesforce.',
    type: 'MANAGER_LED' as const,
    duration: '30 mins',
    completed: true,
    dueDate: '2026-01-06'
  },
  {
    id: 'w1-4',
    title: 'Day to Day Ops Overview',
    description: 'Introduction to daily checklists and rhythm of the unit.',
    type: 'WORKBOOK' as const,
    duration: '2 hours',
    completed: false,
    dueDate: '2026-01-07'
  },
  {
    id: 'w1-5',
    title: 'OKRs and Job Responsibilities',
    description: 'Deep dive into your Q1 Objectives and Key Results.',
    type: 'WORKBOOK' as const,
    duration: '1 hour',
    completed: false,
    dueDate: '2026-01-08'
  }
];

export const MXM_OKRS: Objective[] = [
  {
    title: "Deliver an experience that welcomes, empowers, and delights our members and guests so they return time and again.",
    keyResults: [
      { description: "Maintain a rolling 90 day NPS score at or above 70" },
      { description: "90% of CX Dashboard completion" },
      { description: "Quarterly Mx Review score is at or above 90%" }
    ]
  }
];

export const GM_OKRS: Objective[] = [
  {
    title: "Own the financial health and sustainability of my business from top to bottom.",
    keyResults: [
      { description: "Ensuring that the Quarterly Inc MCV Targets are achieved" },
      { description: "Deliver on Area EBITDA contribution by EOY" }
    ]
  }
];

export const NEW_HIRES: NewHireProfile[] = [
  {
    id: 'nh-3',
    name: 'Casey Newbie',
    role: UserRole.NEW_HIRE,
    avatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    title: 'Member Experience Manager', 
    managerId: 'mgr-1', 
    startDate: '2026-01-05', 
    progress: 10, 
    department: 'Experience',
    modules: MXM_ONBOARDING_MODULES, 
    nextLiveTraining: '2026-01-05T15:30:00Z',
    email: 'casey@industriousoffice.com',
    okrs: MXM_OKRS,
    workbookResponses: {
      'principles_script': 'Hi there! Welcome to Industrious. I am Casey, your community manager.',
    },
    managerTasks: MANAGER_ONBOARDING_TASKS.map(t => ({...t, completed: Math.random() > 0.5})),
  },
  {
    id: 'nh-1',
    name: 'Alex Joiner',
    role: UserRole.NEW_HIRE,
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    title: 'Member Experience Associate',
    managerId: 'mgr-1',
    startDate: '2026-01-03',
    progress: 35,
    department: 'Community',
    modules: [...MOCK_TRAINING_MODULES],
    email: 'alex@industriousoffice.com',
    managerTasks: MANAGER_ONBOARDING_TASKS.map(t => ({...t, completed: Math.random() > 0.5})),
  },
  {
    id: 'nh-4',
    name: 'Sarah Executive',
    role: UserRole.NEW_HIRE,
    avatar: 'https://randomuser.me/api/portraits/women/29.jpg',
    title: 'General Manager', 
    managerId: 'mgr-4', 
    startDate: '2026-01-01',
    progress: 5,
    department: 'Leadership',
    modules: MOCK_TRAINING_MODULES, 
    email: 'sarah.exec@industriousoffice.com',
    okrs: GM_OKRS,
    managerTasks: MANAGER_ONBOARDING_TASKS.map(t => ({...t, completed: false})),
  }
];