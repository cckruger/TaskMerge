
import React, { useState, useEffect, useRef } from 'react';
import { 
  Layout, 
  Filter, 
  Settings, 
  Search, 
  RefreshCw,
  CheckCircle2,
  Menu,
  X,
  PlusCircle,
  Loader2,
  Undo,
  Check,
  ChevronDown,
  Calendar,
  ArrowDownAZ,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  Shield,
  Hash,
  Tag as TagIcon,
  Plus,
  Coffee,
  Cloud,
  CloudDownload
} from 'lucide-react';
import { Account, Task, Priority, User, Tag } from './types';
import { parseTasksFromInput, breakDownTask, generateSampleTasksForAccount, analyzeTaskList } from './services/geminiService';
import { fetchAllGoogleTasksForAccount, updateGoogleTaskStatus } from './services/googleTasksService';
import { saveDataToDrive, loadDataFromDrive, AppData } from './services/googleDriveService';
import { SmartInput } from './components/SmartInput';
import { TaskItem } from './components/TaskItem';
import { AddAccountModal } from './components/AddAccountModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { GoogleIcon } from './components/GoogleIcon';
import { LoginPage } from './components/LoginPage';
import { Logo } from './components/Logo';
import { GOOGLE_CLIENT_ID } from './config';

// Initial Mock Data - Cleared for Production/Clean State
const INITIAL_ACCOUNTS: Account[] = [];
const INITIAL_TASKS: Task[] = [];
const INITIAL_TAGS: Tag[] = [];

type SortOption = 'default' | 'alphabetical' | 'dueDate' | 'priority';

interface TokenCache {
  [accountId: string]: {
    token: string;
    expiresAt: number;
  }
}

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('tm_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  // Initialize state from LocalStorage if available
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('tm_accounts');
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tm_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [tags, setTags] = useState<Tag[]>(() => {
    const saved = localStorage.getItem('tm_tags');
    return saved ? JSON.parse(saved) : INITIAL_TAGS;
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [selectedTagId, setSelectedTagId] = useState<string | 'all'>('all');

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeBreakdownId, setActiveBreakdownId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  // Sort State
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    return (localStorage.getItem('tm_sortOption') as SortOption) || 'default';
  });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Filter State
  const [showCompleted, setShowCompleted] = useState(() => {
    const saved = localStorage.getItem('tm_showCompleted');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Undo State
  const [lastDeletedTask, setLastDeletedTask] = useState<Task | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimeoutRef = useRef<number | null>(null);
  
  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  
  // Modal States
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // Changed to store ID instead of object for live updates
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);
  
  // AI Assistant Modal State
  const [isAiResponseModalOpen, setIsAiResponseModalOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Tag Input State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagTitle, setNewTagTitle] = useState('');

  // Google Client Ref and Token Cache
  const tokenClientRef = useRef<any>(null);
  const tokenCacheRef = useRef<TokenCache>({});

  // Persistence Effects
  useEffect(() => {
    if (user) {
      localStorage.setItem('tm_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('tm_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('tm_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('tm_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('tm_tags', JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    localStorage.setItem('tm_showCompleted', JSON.stringify(showCompleted));
  }, [showCompleted]);

  useEffect(() => {
    localStorage.setItem('tm_sortOption', sortOption);
  }, [sortOption]);

  // Theme Effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Initialize Google Client
  useEffect(() => {
    const initializeTokenClient = () => {
      if (window.google && !tokenClientRef.current) {
        try {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            // Added drive.appdata scope for backups
            scope: 'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.appdata',
            prompt: 'select_account', 
            callback: () => {}, 
          });
        } catch (e) {
          console.error("Google Client Init Error:", e);
        }
      }
    };

    initializeTokenClient();
    const timer = setInterval(initializeTokenClient, 500);
    return () => clearInterval(timer);
  }, []);

  // --- Helper: Get Valid Token (Cached or Refresh) ---
  const getValidToken = async (account: Account, forceInteractive: boolean = false): Promise<string> => {
    if (account.provider !== 'google') {
      throw new Error("Not a google account");
    }

    // 1. Check Cache (skip if forceInteractive is true)
    const cached = tokenCacheRef.current[account.id];
    if (!forceInteractive && cached && Date.now() < cached.expiresAt - 300000) {
      return cached.token;
    }

    // 2. Request New Token
    return new Promise((resolve, reject) => {
      if (!tokenClientRef.current) {
        reject(new Error("Google Identity Services not initialized"));
        return;
      }

      // Override callback for this specific request
      tokenClientRef.current.callback = (resp: any) => {
        if (resp.error) {
          reject(resp);
          return;
        }
        if (resp.access_token) {
          // Cache the token
          const expiresIn = resp.expires_in ? parseInt(resp.expires_in) : 3599;
          tokenCacheRef.current[account.id] = {
            token: resp.access_token,
            expiresAt: Date.now() + (expiresIn * 1000)
          };
          resolve(resp.access_token);
        }
      };

      // Determine hint. If primary, use logged in email. If secondary, use stored email.
      const hint = account.isPrimary && user ? user.email : account.email;
      
      // If forcing interactive (e.g. after a failure), show account chooser.
      // Otherwise try silent (empty prompt).
      const promptMode = forceInteractive ? 'select_account' : '';
      
      tokenClientRef.current.requestAccessToken({ hint: hint, prompt: promptMode });
    });
  };


  // --- Auth Handlers ---

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    
    setAccounts(prev => {
      const normalizedEmail = loggedInUser.email.toLowerCase();
      
      // Find if this user is already in the list (e.g. previously added as primary)
      const existingIndex = prev.findIndex(a => 
        a.email.toLowerCase() === normalizedEmail && a.provider === 'google'
      );

      if (existingIndex >= 0) {
        // User exists: Update them to be Primary, set all others to NOT primary
        return prev.map((a, idx) => {
          if (idx === existingIndex) {
             return { 
               ...a, 
               isPrimary: true, 
               name: loggedInUser.name, 
               picture: loggedInUser.picture, // Update picture if available
               initials: loggedInUser.name.substring(0, 2).toUpperCase() 
             };
          }
          return { ...a, isPrimary: false };
        });
      } else {
        // New User Login: Create new primary account
        const primaryAccount: Account = {
          id: `acc_google_${loggedInUser.sub || Date.now()}`,
          name: loggedInUser.name,
          email: loggedInUser.email,
          color: 'indigo', 
          initials: loggedInUser.name.substring(0, 2).toUpperCase(),
          provider: 'google',
          isPrimary: true
        };
        
        // Demote any old primary accounts (if switching users on same device)
        const demotedPrev = prev.map(a => ({ ...a, isPrimary: false }));
        
        return [primaryAccount, ...demotedPrev];
      }
    });
  };

  const handleLogout = () => {
    setUser(null);
    setIsProfileMenuOpen(false);
    tokenCacheRef.current = {}; // Clear cache on logout
  };

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // --- App Logic ---
  
  // View Selection Handlers (Mutually Exclusive)
  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedTagId('all');
    setIsMobileMenuOpen(false);
  };

  const handleSelectTag = (tagId: string) => {
    setSelectedTagId(tagId);
    setSelectedAccountId('all');
    setIsMobileMenuOpen(false);
  };

  const handleSelectAllTasks = () => {
    setSelectedAccountId('all');
    setSelectedTagId('all');
    setIsMobileMenuOpen(false);
  };

  const handleAiInput = async (text: string) => {
    setIsProcessing(true);
    try {
      const lowerText = text.toLowerCase();
      const isReviewRequest = lowerText.startsWith('review') || 
                              lowerText.startsWith('analyze') || 
                              (lowerText.includes('which') && lowerText.includes('tasks')) ||
                              (lowerText.includes('what') && lowerText.includes('tasks'));

      if (isReviewRequest) {
        const contextTasks = selectedAccountId === 'all' 
           ? tasks 
           : tasks.filter(t => t.accountId === selectedAccountId);
           
        const response = await analyzeTaskList(contextTasks, text);
        setAiResponse(response);
        setIsAiResponseModalOpen(true);
      } else {
        const parsedTasks = await parseTasksFromInput(text, accounts);
        
        const newTasks: Task[] = parsedTasks.map((pt, index) => {
          const matchedAccount = accounts.find(a => 
            a.name.toLowerCase().includes(pt.accountNameMatch?.toLowerCase() || '')
          ) || accounts[0];
  
          return {
            id: `task_${Date.now()}_${index}`,
            accountId: matchedAccount.id,
            title: pt.title,
            description: pt.description,
            priority: pt.priority as Priority || Priority.MEDIUM,
            completed: false,
            dueDate: pt.dueDate,
            subTasks: []
          };
        });
  
        setTasks(prev => [...newTasks, ...prev]);
      }
    } catch (error) {
      console.error("Failed to process AI request", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if(!account) return;

    setIsProcessing(true);

    if (account.provider === 'google') {
      try {
        // Try silent auth first
        let token: string;
        try {
            token = await getValidToken(account, false);
        } catch (silentError) {
            // If silent fails (e.g. session expired), force interactive
            console.log("Silent auth failed, prompting user...", silentError);
            token = await getValidToken(account, true);
        }
        
        // Now returns a tree of tasks (nested subtasks)
        const fetchedTasks = await fetchAllGoogleTasksForAccount(token, account.id);
        
        setTasks(prev => {
          const newTaskList = [...prev];
          fetchedTasks.forEach(ft => {
            const existingIndex = newTaskList.findIndex(t => t.id === ft.id);
            if (existingIndex >= 0) {
              newTaskList[existingIndex] = {
                ...newTaskList[existingIndex],
                title: ft.title,
                description: ft.description,
                completed: ft.completed,
                dueDate: ft.dueDate,
                googleTaskId: ft.googleTaskId,
                googleTaskListId: ft.googleTaskListId,
                // Use the new subtasks from sync
                subTasks: ft.subTasks 
              };
            } else {
              newTaskList.push(ft);
            }
          });
          return newTaskList;
        });
      } catch (err: any) {
        console.error("Sync failed", err);
        alert(`Failed to sync tasks: ${err.message || "Unknown error"}`);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Simulation
      const sampleTasks = await generateSampleTasksForAccount(account.name);
      const newTasks: Task[] = sampleTasks.map((t, i) => ({
          id: `imported_${Date.now()}_${i}`,
          accountId: account.id,
          title: t.title,
          description: t.description,
          priority: t.priority as Priority,
          completed: false,
          subTasks: []
      }));
      setTasks(prev => [...prev, ...newTasks]);
      setIsProcessing(false);
    }
  };

  const toggleTask = async (id: string) => {
    // 1. Optimistic Update
    const taskToToggle = tasks.find(t => t.id === id);
    if (!taskToToggle) return;

    const newStatus = !taskToToggle.completed;
    
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newStatus } : t));

    // 2. Update Google API if applicable
    if (taskToToggle.googleTaskId && taskToToggle.googleTaskListId) {
       const account = accounts.find(a => a.id === taskToToggle.accountId);
       if (account && account.provider === 'google') {
         try {
            // Try silent, then interactive if needed
            let token: string;
            try {
                token = await getValidToken(account, false);
            } catch (e) {
                token = await getValidToken(account, true);
            }
            await updateGoogleTaskStatus(token, taskToToggle.googleTaskListId, taskToToggle.googleTaskId, newStatus);
            // Success - Silent
         } catch (err) {
           console.error("Failed to update Google Task status", err);
           // Revert optimistic update on failure
           setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !newStatus } : t));
           alert("Failed to update task on Google. Changes reverted.");
         }
       }
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    // 1. Find Parent and Subtask
    const parentTask = tasks.find(t => t.id === taskId);
    if (!parentTask || !parentTask.subTasks) return;

    const subtask = parentTask.subTasks.find(st => st.id === subtaskId);
    if (!subtask) return;

    const newStatus = !subtask.completed;

    // 2. Optimistic Update in UI
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      if (!t.subTasks) return t;
      
      const newSubtasks = t.subTasks.map(st => 
        st.id === subtaskId ? { ...st, completed: newStatus } : st
      );
      
      return { ...t, subTasks: newSubtasks };
    }));

    // 3. Update Google API (Subtasks are real tasks now)
    if (subtask.googleTaskId && subtask.googleTaskListId) {
       const account = accounts.find(a => a.id === subtask.accountId);
       if (account && account.provider === 'google') {
         try {
            let token: string;
            try {
                token = await getValidToken(account, false);
            } catch (e) {
                token = await getValidToken(account, true);
            }
            await updateGoogleTaskStatus(token, subtask.googleTaskListId, subtask.googleTaskId, newStatus);
         } catch (err) {
           console.error("Failed to update Google Subtask status", err);
           // Revert on failure
           setTasks(prev => prev.map(t => {
             if (t.id !== taskId) return t;
             const revertedSubtasks = (t.subTasks || []).map(st => 
                st.id === subtaskId ? { ...st, completed: !newStatus } : st
             );
             return { ...t, subTasks: revertedSubtasks };
           }));
           alert("Failed to update subtask on Google.");
         }
       }
    }
  };

  const deleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete) {
      setLastDeletedTask(taskToDelete);
      setTasks(prev => prev.filter(t => t.id !== id));
      setShowUndoToast(true);
      
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      
      undoTimeoutRef.current = window.setTimeout(() => {
        setShowUndoToast(false);
        setLastDeletedTask(null); 
      }, 5000);
    }
  };

  const handleUndo = () => {
    if (lastDeletedTask) {
      setTasks(prev => {
        if (prev.some(t => t.id === lastDeletedTask.id)) return prev;
        return [...prev, lastDeletedTask];
      });
      setShowUndoToast(false);
      setLastDeletedTask(null);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    }
  };

  const handleBreakdown = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setActiveBreakdownId(taskId);
    try {
      const subItems = await breakDownTask(task.title);
      
      // Create full Task objects for the subtasks
      const newSubTasks: Task[] = subItems.map((item, i) => ({
        id: `${taskId}_sub_${Date.now()}_${i}`,
        accountId: task.accountId, // Inherit account
        title: item.title,
        completed: false,
        priority: Priority.MEDIUM,
        subTasks: []
        // Note: These are local subtasks until synced, unless we call the create API (not implemented yet for subtasks)
      }));

      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, subTasks: newSubTasks } : t
      ));
    } finally {
      setActiveBreakdownId(null);
    }
  };

  const handleUpdatePriority = (taskId: string, priority: Priority) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t));
  };

  const handleUpdateDueDate = (taskId: string, date: string | undefined) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, dueDate: date } : t));
  };

  const handleUpdateTask = (taskId: string, title: string, description?: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, title, description } : t
    ));
  };

  // Tag Management Logic
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagTitle.trim()) return;

    const colors = ['blue', 'purple', 'green', 'orange', 'pink', 'teal', 'indigo'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newTag: Tag = {
      id: `tag_${Date.now()}`,
      name: newTagTitle.trim(),
      color: randomColor
    };

    setTags(prev => [...prev, newTag]);
    setNewTagTitle('');
    setIsAddingTag(false);
  };

  const handleDeleteTag = (tagId: string) => {
    if(window.confirm('Delete this tag? It will be removed from all tasks.')) {
      setTags(prev => prev.filter(t => t.id !== tagId));
      // Remove tag from tasks
      setTasks(prev => prev.map(t => ({
        ...t,
        tags: t.tags?.filter(tid => tid !== tagId)
      })));
      if (selectedTagId === tagId) setSelectedTagId('all');
    }
  };

  const handleToggleTaskTag = (taskId: string, tagId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      
      const currentTags = t.tags || [];
      const hasTag = currentTags.includes(tagId);
      
      return {
        ...t,
        tags: hasTag 
          ? currentTags.filter(id => id !== tagId)
          : [...currentTags, tagId]
      };
    }));
  };

  // Drag and Drop Handlers for Tasks
  const handleTaskDragStart = (e: React.DragEvent, id: string) => {
    // Only allow dragging if default sort is selected
    if (sortOption !== 'default') return;
    setDraggedTaskId(id);
  };

  const handleTaskDragOver = (e: React.DragEvent) => {
    if (sortOption !== 'default') return;
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleTaskDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (sortOption !== 'default') return;
    if (!draggedTaskId || draggedTaskId === targetId) return;

    setTasks(prev => {
      const list = [...prev];
      const sourceIndex = list.findIndex(t => t.id === draggedTaskId);
      const targetIndex = list.findIndex(t => t.id === targetId);
      
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      
      // Move element
      const [movedItem] = list.splice(sourceIndex, 1);
      list.splice(targetIndex, 0, movedItem);
      
      return list;
    });
    setDraggedTaskId(null);
  };

  const handleSubtasksReorder = (taskId: string, newSubtasks: Task[]) => {
    setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, subTasks: newSubtasks } : t
    ));
  };

  // Data Export/Import Handlers
  const handleExportData = () => {
    const data = {
      accounts,
      tasks,
      tags,
      version: 1
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskmerge-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.accounts && data.tasks) {
          if (window.confirm("This will replace your current local data (excluding the active session). Continue?")) {
             setAccounts(data.accounts);
             setTasks(data.tasks);
             setTags(data.tags || []);
             alert("Data restored successfully.");
          }
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        console.error("Import failed", err);
        alert("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Drive Backup Handlers
  const handleDriveBackup = async () => {
    const primaryAccount = accounts.find(a => a.isPrimary && a.provider === 'google');
    if (!primaryAccount) {
      alert("You must be logged in with a Google account to use Drive Backup.");
      return;
    }

    setIsProcessing(true);
    try {
      // Force interactive to ensure we get the Drive scope if not already granted
      let token = await getValidToken(primaryAccount, false);
      
      await saveDataToDrive(token, {
        accounts,
        tasks,
        tags,
        lastUpdated: Date.now()
      });
      alert("Backup saved to Google Drive (App Data folder) successfully.");
    } catch (error) {
      console.error("Drive backup failed", error);
      // Try again with interactive prompt if it might be a scope issue
      if (window.confirm("Backup failed. You may need to grant Google Drive permissions. Retry?")) {
          try {
             let token = await getValidToken(primaryAccount, true);
             await saveDataToDrive(token, { accounts, tasks, tags, lastUpdated: Date.now() });
             alert("Backup saved successfully.");
          } catch(retryErr) {
             alert("Backup failed again. Please check your network or permissions.");
          }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDriveRestore = async () => {
    const primaryAccount = accounts.find(a => a.isPrimary && a.provider === 'google');
    if (!primaryAccount) {
        alert("You must be logged in with a Google account to use Drive Restore.");
        return;
    }

    if (!window.confirm("This will overwrite your current local lists with the backup from Google Drive. Continue?")) {
        return;
    }

    setIsProcessing(true);
    try {
        const token = await getValidToken(primaryAccount, false);
        const data = await loadDataFromDrive(token);
        
        if (data) {
            setAccounts(data.accounts);
            setTasks(data.tasks);
            setTags(data.tags || []);
            alert("Data restored from Google Drive successfully.");
        } else {
            alert("No backup found in Google Drive.");
        }
    } catch (error) {
        console.error("Drive restore failed", error);
        alert("Failed to restore from Drive. Ensure you have a backup and permissions.");
    } finally {
        setIsProcessing(false);
    }
  };

  // Account Logic
  const handleAddAccount = (newAccount: Account, importedTasks: Task[]) => {
    if (accounts.some(a => a.email === newAccount.email && a.provider === newAccount.provider)) {
       alert("This account is already connected.");
       return;
    }

    setAccounts(prev => [...prev, newAccount]);
    
    // Note: importedTasks is already a tree from the Service
    if (importedTasks && importedTasks.length > 0) {
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const uniqueNewTasks = importedTasks.filter(t => !existingIds.has(t.id));
        return [...prev, ...uniqueNewTasks];
      });
    }
    handleSelectAccount(newAccount.id); // Switch to the new account view
  };

  const openAccountSettings = (account: Account) => {
    setSettingsAccountId(account.id);
    setIsSettingsModalOpen(true);
  };

  const handleRenameAccount = (id: string, newName: string) => {
    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, name: newName } : acc));
    setIsSettingsModalOpen(false);
    setSettingsAccountId(null);
  };

  const handleUnlinkAccount = (id: string) => {
    // Cannot unlink primary
    const acc = accounts.find(a => a.id === id);
    if (acc?.isPrimary) return;

    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, provider: 'local' } : acc));
    setIsSettingsModalOpen(false);
    setSettingsAccountId(null);
  };

  const handleDeleteAccount = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (acc?.isPrimary) {
      alert("Cannot delete the primary account.");
      return;
    }

    if(window.confirm("Are you sure? This will remove the account and its tasks from this view.")) {
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      setTasks(prev => prev.filter(t => t.accountId !== id));
      if (selectedAccountId === id) {
        handleSelectAllTasks();
      }
      setIsSettingsModalOpen(false);
      setSettingsAccountId(null);
    }
  };

  const handleUpdateAccountColor = (id: string, color: string) => {
    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, color } : acc));
  };

  // Filter and Sort Logic
  const filteredTasks = tasks.filter(t => {
    const matchesAccount = selectedAccountId === 'all' || t.accountId === selectedAccountId;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompletion = showCompleted ? true : !t.completed;
    // Tag Filter (Mutually Exclusive)
    const matchesTag = selectedTagId === 'all' || (t.tags && t.tags.includes(selectedTagId));
    
    return matchesAccount && matchesSearch && matchesCompletion && matchesTag;
  });

  const getSortedTasks = (tasksToSort: Task[]) => {
    if (sortOption === 'default') return tasksToSort;
    
    return [...tasksToSort].sort((a, b) => {
      switch (sortOption) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'dueDate':
          // Handle missing due dates (push to end)
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const pMap = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
          return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
        default:
          return 0;
      }
    });
  };

  const displayedTasks = getSortedTasks(filteredTasks);
  
  const dueTodayCount = filteredTasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const taskDate = new Date(t.dueDate);
    const today = new Date();
    return taskDate.toDateString() === today.toDateString();
  }).length;
  
  // Determine Header Title
  let headerTitle = 'All Tasks';
  if (selectedTagId !== 'all') {
    headerTitle = tags.find(t => t.id === selectedTagId)?.name || 'Unknown Tag';
  } else if (selectedAccountId !== 'all') {
    headerTitle = accounts.find(a => a.id === selectedAccountId)?.name || 'Unknown Account';
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Views</h3>
        <button 
          onClick={handleSelectAllTasks}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedAccountId === 'all' && selectedTagId === 'all' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-800'}`}
        >
          <Layout className="w-4 h-4" />
          All Tasks
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Accounts</h3>
        </div>
        
        <div className="space-y-1">
          {accounts.map(acc => (
            <div key={acc.id} className="group relative flex items-center">
              <button
                onClick={() => handleSelectAccount(acc.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all pr-14 ${
                  selectedAccountId === acc.id 
                    ? 'bg-white shadow-sm border border-gray-200 ring-1 ring-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:ring-slate-700' 
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent dark:text-gray-400 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full bg-${acc.color}-500 flex-shrink-0`} />
                  <span className="text-left truncate flex-1">{acc.name}</span>
                  {acc.isPrimary && <Shield className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                  {acc.provider === 'google' && <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                </div>
                {selectedAccountId === acc.id && (
                  <div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 absolute right-3`} />
                )}
              </button>
              
              <div className="absolute right-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleImport(acc.id); }}
                  className="p-1.5 bg-white shadow-sm border border-gray-200 rounded-md hover:text-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700 dark:hover:text-indigo-400"
                  title={acc.provider === 'google' ? "Sync with Google" : "Generate Demo Tasks"}
                  disabled={isProcessing}
                >
                  <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                </button>
                <button
                   onClick={(e) => { e.stopPropagation(); openAccountSettings(acc); }}
                   className="p-1.5 bg-white shadow-sm border border-gray-200 rounded-md hover:text-indigo-600 transition-all dark:bg-slate-800 dark:border-slate-700 dark:hover:text-indigo-400"
                   title="Account Settings"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setIsAddAccountModalOpen(true)}
          className="w-full mt-4 flex items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors group dark:border-slate-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          <PlusCircle className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 dark:text-gray-500 dark:group-hover:text-indigo-400" />
          Add Account
        </button>
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tags</h3>
          <button 
            onClick={() => setIsAddingTag(true)}
            className="p-1 hover:bg-gray-100 rounded transition-colors dark:hover:bg-slate-800"
            title="Create new tag"
          >
            <Plus className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {isAddingTag && (
          <form onSubmit={handleAddTag} className="px-2 mb-2">
             <input 
               autoFocus
               type="text"
               value={newTagTitle}
               onChange={e => setNewTagTitle(e.target.value)}
               onBlur={() => { if(!newTagTitle) setIsAddingTag(false); }}
               placeholder="Tag name..."
               className="w-full px-3 py-1.5 text-sm bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:bg-slate-800 dark:border-slate-700"
             />
          </form>
        )}
        
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {tags.map(tag => (
            <div key={tag.id} className="group relative flex items-center">
              <button
                onClick={() => handleSelectTag(tag.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all pr-8 ${
                  selectedTagId === tag.id 
                    ? `bg-${tag.color}-50 text-${tag.color}-700 dark:bg-${tag.color}-900/30 dark:text-${tag.color}-300` 
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-800'
                }`}
              >
                <Hash className={`w-3.5 h-3.5 ${selectedTagId === tag.id ? '' : 'text-gray-400'}`} />
                <span className="truncate">{tag.name}</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id); }}
                className="absolute right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity dark:hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {tags.length === 0 && !isAddingTag && (
            <p className="px-3 text-xs text-gray-400 italic">No tags yet</p>
          )}
        </div>
      </div>
    </div>
  );

  const sortLabelMap: Record<SortOption, string> = {
    default: 'Default',
    alphabetical: 'Alphabetical',
    dueDate: 'Due Date',
    priority: 'Priority'
  };
  
  // Helper to find account for settings modal
  const accountForSettings = accounts.find(a => a.id === settingsAccountId) || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex overflow-hidden font-sans dark:bg-slate-950 dark:text-slate-100">
      
      <AddAccountModal 
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onAdd={handleAddAccount}
      />

      <AccountSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => { setIsSettingsModalOpen(false); setSettingsAccountId(null); }}
        account={accountForSettings}
        onRename={handleRenameAccount}
        onUnlink={handleUnlinkAccount}
        onDelete={handleDeleteAccount}
        onUpdateColor={handleUpdateAccountColor}
      />
      
      <AiAssistantModal
        isOpen={isAiResponseModalOpen}
        onClose={() => setIsAiResponseModalOpen(false)}
        response={aiResponse}
      />

      {/* Hidden File Input for Restore */}
      <input 
        id="restoreInput" 
        type="file" 
        accept=".json" 
        className="hidden" 
        onChange={handleImportData}
      />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 dark:bg-slate-900">
             <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Logo className="w-8 h-8 rounded-lg shadow-md" />
                  <span className="font-bold text-lg text-slate-900 dark:text-white">TaskMerge</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-slate-800"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
             </div>
             <div className="p-4 flex-1 overflow-y-auto">
                <NavContent />
             </div>
             <div className="p-4 bg-gray-50 border-t border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-xs text-center text-gray-400">v1.0.0 • Mobile</p>
             </div>
          </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="w-72 bg-white border-r border-gray-200 flex-col hidden md:flex z-10 dark:bg-slate-900 dark:border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800">
          <Logo className="w-10 h-10 rounded-xl shadow-lg hover:rotate-3 transition-transform duration-300" />
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">TaskMerge</span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <NavContent />
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800">
           <a 
             href="https://ko-fi.com/L3L51OU0BR" 
             target="_blank" 
             rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 w-full bg-[#72a4f2] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#5a97f2] transition-colors shadow-sm"
           >
              <Coffee className="w-5 h-5 fill-white/20" />
              <span>Support me on Ko-fi</span>
           </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header */}
        <header className="relative z-[55] h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 lg:px-8 shrink-0 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:bg-slate-800"
             >
               <Menu className="w-6 h-6" />
             </button>
             
             <div className="flex items-center gap-3">
               <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate max-w-[150px] sm:max-w-none dark:text-gray-100">
                 {headerTitle}
               </h1>
               <span className="hidden sm:inline-block bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full dark:bg-slate-800 dark:text-slate-300">
                 {dueTodayCount} Due Today
               </span>
             </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             <div className="relative hidden sm:block">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="Search tasks..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-48 lg:w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 dark:focus:ring-indigo-500/40"
               />
             </div>
             <button className="sm:hidden p-2 text-gray-500 dark:text-gray-400">
               <Search className="w-5 h-5" />
             </button>

             {/* User Menu */}
             <div className="relative">
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="relative"
                >
                    {user.picture ? (
                        <img 
                          src={user.picture} 
                          alt={user.name} 
                          className="h-8 w-8 rounded-full border border-gray-200 shadow-sm hover:ring-2 hover:ring-indigo-100 transition-all object-cover dark:border-slate-700 dark:hover:ring-indigo-900"
                        />
                    ) : (
                        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-200 dark:bg-indigo-900/50 dark:border-indigo-800 dark:text-indigo-300">
                            {user.name.charAt(0)}
                        </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full dark:border-slate-900"></div>
                </button>

                {isProfileMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsProfileMenuOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-40 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right dark:bg-slate-900 dark:border-slate-800">
                        <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-800">
                          <p className="text-sm font-semibold text-gray-900 truncate dark:text-gray-100">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate dark:text-gray-400">{user.email}</p>
                        </div>
                         {/* Theme Toggle */}
                         <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-800">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Theme</p>
                            <div className="flex bg-gray-100 rounded-lg p-1 dark:bg-slate-800">
                              <button 
                                onClick={() => setTheme('light')}
                                className={`flex-1 py-1 text-xs font-medium rounded-md text-center transition-colors ${theme === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                              >
                                Light
                              </button>
                              <button 
                                onClick={() => setTheme('dark')}
                                className={`flex-1 py-1 text-xs font-medium rounded-md text-center transition-colors ${theme === 'dark' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                              >
                                Dark
                              </button>
                            </div>
                         </div>
                        
                         {/* Backup/Restore */}
                         <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-800">
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Data</p>
                             <button 
                                onClick={handleExportData}
                                className="w-full text-left text-xs text-gray-600 hover:text-indigo-600 hover:bg-gray-50 py-1.5 px-2 rounded transition-colors dark:text-gray-300 dark:hover:bg-slate-800"
                             >
                               Backup Data (Export)
                             </button>
                             <button 
                                onClick={() => document.getElementById('restoreInput')?.click()}
                                className="w-full text-left text-xs text-gray-600 hover:text-indigo-600 hover:bg-gray-50 py-1.5 px-2 rounded transition-colors dark:text-gray-300 dark:hover:bg-slate-800"
                             >
                               Restore Data (Import)
                             </button>
                             <button 
                                onClick={handleDriveBackup}
                                className="w-full text-left text-xs text-gray-600 hover:text-indigo-600 hover:bg-gray-50 py-1.5 px-2 rounded transition-colors dark:text-gray-300 dark:hover:bg-slate-800 flex items-center gap-1.5"
                                disabled={isProcessing}
                             >
                               <Cloud className="w-3 h-3" />
                               Backup (Drive)
                             </button>
                             <button 
                                onClick={handleDriveRestore}
                                className="w-full text-left text-xs text-gray-600 hover:text-indigo-600 hover:bg-gray-50 py-1.5 px-2 rounded transition-colors dark:text-gray-300 dark:hover:bg-slate-800 flex items-center gap-1.5"
                                disabled={isProcessing}
                             >
                               <CloudDownload className="w-3 h-3" />
                               Restore (Drive)
                             </button>
                         </div>

                        <div className="py-1">
                           <button 
                             onClick={() => {
                                window.location.href = "mailto:cckruger@gmail.com?subject=TaskMerge%20Bug%20Report";
                                setIsProfileMenuOpen(false);
                             }}
                             className="w-full px-4 py-2 text-sm text-left text-gray-600 hover:bg-gray-50 flex items-center gap-2 dark:text-gray-300 dark:hover:bg-slate-800"
                           >
                             <AlertCircle className="w-4 h-4" />
                             Report a Bug
                           </button>
                           <button 
                             onClick={handleLogout}
                             className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2 dark:text-red-400 dark:hover:bg-red-900/20"
                           >
                             <LogOut className="w-4 h-4" />
                             Sign out
                           </button>
                        </div>
                      </div>
                    </>
                )}
             </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8 dark:bg-slate-950">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            
            {/* AI Input Section */}
            <section className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur-sm md:static md:mx-0 md:p-0 md:bg-transparent md:backdrop-blur-none dark:bg-slate-950/95">
              <SmartInput onProcess={handleAiInput} isProcessing={isProcessing} />
            </section>

            {/* Task List Section */}
            <section className="space-y-4 pb-20 md:pb-0">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Tasks {dueTodayCount > 0 && <span className="sm:hidden ml-1 font-normal">({dueTodayCount} Due)</span>}
                    </h2>
                 </div>
                 
                 <div className="flex items-center gap-2">
                   {/* Show/Hide Completed Toggle */}
                   <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border shadow-sm transition-all ${showCompleted ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-800'}`}
                      title={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
                   >
                      {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      <span className="hidden sm:inline font-medium">Completed</span>
                   </button>

                   {/* Sort Menu */}
                   <div className="relative">
                     <button 
                       onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                       className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                     >
                       <Filter className="w-4 h-4 text-gray-400" />
                       <span>Sort: <span className="font-medium">{sortLabelMap[sortOption]}</span></span>
                       <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                     </button>
                     
                     {isSortMenuOpen && (
                       <>
                         <div className="fixed inset-0 z-30" onClick={() => setIsSortMenuOpen(false)}></div>
                         <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-40 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right dark:bg-slate-900 dark:border-slate-800">
                           <div className="px-3 py-2 border-b border-gray-50 dark:border-slate-800">
                             <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sort By</span>
                           </div>
                           
                           <button 
                             onClick={() => { setSortOption('default'); setIsSortMenuOpen(false); }}
                             className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between group dark:hover:bg-slate-800"
                           >
                             <span className={sortOption === 'default' ? 'text-indigo-600 font-medium dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}>Default (Custom)</span>
                             {sortOption === 'default' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                           </button>

                           <button 
                             onClick={() => { setSortOption('alphabetical'); setIsSortMenuOpen(false); }}
                             className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between group dark:hover:bg-slate-800"
                           >
                             <span className={`flex items-center gap-2 ${sortOption === 'alphabetical' ? 'text-indigo-600 font-medium dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                               <ArrowDownAZ className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-500" />
                               Alphabetical
                             </span>
                             {sortOption === 'alphabetical' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                           </button>

                           <button 
                             onClick={() => { setSortOption('dueDate'); setIsSortMenuOpen(false); }}
                             className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between group dark:hover:bg-slate-800"
                           >
                              <span className={`flex items-center gap-2 ${sortOption === 'dueDate' ? 'text-indigo-600 font-medium dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                               <Calendar className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-500" />
                               Due Date
                             </span>
                             {sortOption === 'dueDate' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                           </button>

                           <button 
                             onClick={() => { setSortOption('priority'); setIsSortMenuOpen(false); }}
                             className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between group dark:hover:bg-slate-800"
                           >
                              <span className={`flex items-center gap-2 ${sortOption === 'priority' ? 'text-indigo-600 font-medium dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                               <AlertCircle className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-500" />
                               Priority
                             </span>
                             {sortOption === 'priority' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                           </button>
                         </div>
                       </>
                     )}
                   </div>
                 </div>
              </div>

              <div className="space-y-3">
                {displayedTasks.length === 0 ? (
                  <div className="text-center py-16 md:py-20 bg-white rounded-2xl border border-dashed border-gray-300 px-4 dark:bg-slate-900 dark:border-slate-700">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-800">
                      <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-gray-900 font-medium mb-1 dark:text-gray-100">No tasks found</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto dark:text-gray-400">
                      {selectedTagId !== 'all' 
                        ? "No tasks have this tag. Add tasks or switch tags."
                        : showCompleted 
                          ? "You have no pending tasks in this view. Use the AI bar above to add new ones or sync an account."
                          : "No tasks visible. Try enabling 'Show Completed' or add a new task."}
                    </p>
                  </div>
                ) : (
                  displayedTasks.map(task => {
                    const account = accounts.find(a => a.id === task.accountId)!;
                    return (
                      <TaskItem
                        key={task.id}
                        task={task}
                        account={account}
                        availableTags={tags}
                        onToggle={toggleTask}
                        onSubtaskToggle={toggleSubtask}
                        onDelete={deleteTask}
                        onBreakdown={handleBreakdown}
                        isBreakingDown={activeBreakdownId === task.id}
                        onSubtasksReorder={handleSubtasksReorder}
                        onUpdatePriority={handleUpdatePriority}
                        onUpdateDueDate={handleUpdateDueDate}
                        onUpdateTask={handleUpdateTask}
                        onTagToggle={handleToggleTaskTag}
                        // Only allow drag and drop in Default sort mode
                        draggable={sortOption === 'default'}
                        onDragStart={handleTaskDragStart}
                        onDragOver={handleTaskDragOver}
                        onDrop={handleTaskDrop}
                        isSubtask={false}
                      />
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Undo Toast */}
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 transform ${showUndoToast ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
          <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 min-w-[300px] justify-between dark:bg-white dark:text-slate-900">
            <span className="text-sm font-medium">Task deleted</span>
            <button 
              onClick={handleUndo}
              className="text-indigo-300 hover:text-indigo-100 text-sm font-semibold flex items-center gap-1.5 transition-colors dark:text-indigo-600 dark:hover:text-indigo-800"
            >
              <Undo className="w-4 h-4" />
              Undo
            </button>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
