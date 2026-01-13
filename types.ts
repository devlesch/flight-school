
export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  NEW_HIRE = 'New Hire'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  title: string;
  email: string;
  region?: string;
}

export interface KeyResult {
  description: string;
  target?: string;
}

export interface Objective {
  title: string;
  keyResults: KeyResult[];
}

export interface ModuleComment {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  type: 'WORKBOOK' | 'VIDEO' | 'LIVE_CALL' | 'PERFORM' | 'SHADOW' | 'MANAGER_LED' | 'BAU' | 'LESSONLY' | 'PEER_PARTNER';
  duration: string;
  completed: boolean;
  dueDate: string; // ISO String (YYYY-MM-DD)
  link?: string;
  score?: number; // Added score field (0-100)
  host?: string; // Added host field for live calls
  likes?: number;
  liked?: boolean;
  comments?: ModuleComment[];
}

export interface Shoutout {
  id: string;
  from: string;
  message: string;
  date: string; // ISO String
  avatar: string;
}

export interface ManagerTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  dueDateOffset: number; // Days relative to start date (negative for prior)
  timeEstimate: string;
}

export interface WorkbookPrompt {
  id: string;
  question: string;
  answer: string;
  dateAdded: string;
}

export interface NewHireProfile extends User {
  managerId: string;
  startDate: string;
  progress: number;
  department: string;
  modules: TrainingModule[];
  nextLiveTraining?: string; // ISO String
  okrs?: Objective[];
  workbookResponses?: Record<string, string>;
  workbookComments?: Record<string, string>; // Added for manager comments
  shoutouts?: Shoutout[]; // Added for shoutouts
  managerTasks?: ManagerTask[]; // Added for manager onboarding tracker
  customPrompts?: WorkbookPrompt[]; // Added for manager prompts
}

export interface Presenter {
  name: string;
  confirmed: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO String
  attendees: string[];
  link: string;
  presenters?: Presenter[];
}