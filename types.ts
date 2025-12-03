
export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export type AccountProvider = 'google' | 'local';

export interface Account {
  id: string;
  name: string;
  email: string;
  color: string; // Tailwind color class prefix e.g. 'blue'
  initials: string;
  provider: AccountProvider;
  isPrimary?: boolean; // Indicates the main account used to login to the app
}

export interface User {
  name: string;
  email: string;
  picture: string;
  sub?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string; // Tailwind color name
}

// SubTask is removed as a distinct separate type, we use Task recursively now.
// However, for legacy prop compatibility in some drag-handlers, we can alias it.
export type SubTask = Task;

export interface Task {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  priority: Priority;
  completed: boolean;
  dueDate?: string;
  subTasks?: Task[]; // Recursive structure
  tags?: string[]; // Array of Tag IDs
  
  // Google Tasks Specific Identifiers
  googleTaskId?: string;
  googleTaskListId?: string;
  googleParentId?: string; // ID of the parent task if this is a subtask
}

export interface AiParsedTask {
  title: string;
  accountNameMatch: string; // The AI tries to match the user intent to an account name
  priority: string;
  description?: string;
  dueDate?: string; // ISO 8601 string
}
