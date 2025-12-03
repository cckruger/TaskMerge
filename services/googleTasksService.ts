
import { Priority, Task } from "../types";

const TASKS_API_BASE = "https://tasks.googleapis.com/tasks/v1";
const USER_INFO_API = "https://www.googleapis.com/oauth2/v3/userinfo";

interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  parent?: string; // The ID of the parent task
  position?: string;
}

export const fetchGoogleProfile = async (token: string) => {
  const response = await fetch(USER_INFO_API, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Failed to fetch user profile");
  return response.json();
};

export const fetchGoogleTaskLists = async (token: string): Promise<GoogleTaskList[]> => {
  const response = await fetch(`${TASKS_API_BASE}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to fetch task lists (${response.status})`);
  }
  
  const data = await response.json();
  return data.items || [];
};

export const fetchTasksFromList = async (token: string, listId: string, accountId: string): Promise<Task[]> => {
  const response = await fetch(`${TASKS_API_BASE}/lists/${listId}/tasks?showCompleted=true&showHidden=false`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to fetch tasks (${response.status})`);
  }

  const data = await response.json();
  const rawGoogleTasks: GoogleTask[] = data.items || [];

  // First Pass: Convert all Google Tasks to our internal Task format
  // We use a Map for O(1) lookup during tree construction
  const taskMap = new Map<string, Task>();
  
  rawGoogleTasks.forEach(gt => {
    const task: Task = {
      id: `g_${gt.id}`,
      accountId: accountId,
      title: gt.title || "Untitled Task",
      description: gt.notes,
      priority: Priority.MEDIUM,
      completed: gt.status === 'completed',
      dueDate: gt.due,
      subTasks: [], // Initialize empty
      googleTaskId: gt.id,
      googleTaskListId: listId,
      googleParentId: gt.parent
    };
    taskMap.set(gt.id, task);
  });

  // Second Pass: Build the Tree
  const rootTasks: Task[] = [];

  rawGoogleTasks.forEach(gt => {
    const currentTask = taskMap.get(gt.id);
    if (!currentTask) return;

    if (gt.parent && taskMap.has(gt.parent)) {
      // This is a subtask, add it to its parent
      const parentTask = taskMap.get(gt.parent);
      if (parentTask && parentTask.subTasks) {
        parentTask.subTasks.push(currentTask);
      }
    } else {
      // This is a root task (no parent, or parent not found in this list)
      rootTasks.push(currentTask);
    }
  });

  return rootTasks;
};

export const fetchAllGoogleTasksForAccount = async (token: string, accountId: string): Promise<Task[]> => {
  try {
    // 1. Get all lists
    const lists = await fetchGoogleTaskLists(token);
    if (lists.length === 0) return [];

    // 2. For simplicity, we pull from the first list
    const defaultList = lists[0];
    return await fetchTasksFromList(token, defaultList.id, accountId);
  } catch (error) {
    console.warn("Error fetching tasks for account:", error);
    return [];
  }
};

export const updateGoogleTaskStatus = async (token: string, listId: string, taskId: string, isCompleted: boolean): Promise<void> => {
  const status = isCompleted ? 'completed' : 'needsAction';
  
  const response = await fetch(`${TASKS_API_BASE}/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || "Failed to update Google Task status");
  }
};
