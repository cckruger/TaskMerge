
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { Account, Task } from '../types';
import { fetchGoogleProfile, fetchAllGoogleTasksForAccount } from '../services/googleTasksService';
import { GOOGLE_CLIENT_ID } from '../config';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (account: Account, initialTasks?: Task[]) => void;
}

// Declare google global for TypeScript
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => {
            requestAccessToken: () => void;
            callback: (response: any) => void;
          };
        };
      };
    };
  }
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [mode, setMode] = useState<'select' | 'local'>('select');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [localName, setLocalName] = useState('');
  
  // Use ref to maintain the client instance across renders without triggering re-effects
  const tokenClientRef = useRef<any>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  
  // Initialize Google Token Client
  useEffect(() => {
    const initializeGoogle = () => {
      if (window.google && !tokenClientRef.current) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            prompt: 'select_account', // Force account selection to avoid stuck sessions
            callback: () => {}, // Will be assigned dynamically in handleGoogleConnect
            error_callback: (err: any) => {
                setLoading(false);
                setStatusMessage('');
                console.error("Google Auth Error:", err);
                
                if (err.type === 'popup_closed') {
                    setError("The sign-in window was closed.");
                } else {
                    setError(`Google Sign-In Error: ${err.type || 'Unknown'}`);
                }
            }
          });
          tokenClientRef.current = client;
          setIsGoogleReady(true);
        } catch (e) {
          console.error("Error initializing Google Token Client:", e);
        }
      } else if (window.google && tokenClientRef.current) {
        setIsGoogleReady(true);
      }
    };

    initializeGoogle();
    
    // Retry initialization in case script loads late
    const timer = setInterval(initializeGoogle, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const handleGoogleConnect = () => {
    setError(null);
    
    if (!GOOGLE_CLIENT_ID) {
      setError("Configuration Error: GOOGLE_CLIENT_ID is missing.");
      return;
    }

    if (!tokenClientRef.current) {
      setError("Google Identity Services not loaded yet. Please wait a moment and try again.");
      return;
    }

    setLoading(true);
    setStatusMessage("Waiting for sign in...");

    // Assign the callback dynamically to avoid stale closures
    tokenClientRef.current.callback = async (tokenResponse: any) => {
      if (tokenResponse && tokenResponse.access_token) {
        await handleGoogleSuccess(tokenResponse.access_token);
      } else {
        setLoading(false);
        setStatusMessage('');
        setError("Access denied or no token received.");
      }
    };

    // Trigger the popup
    try {
        tokenClientRef.current.requestAccessToken();
    } catch (e) {
        setLoading(false);
        setStatusMessage('');
        setError("Failed to open popup. Please check if your browser is blocking popups.");
    }
  };

  const handleGoogleSuccess = async (accessToken: string) => {
    try {
      setStatusMessage("Fetching account profile...");
      // 1. Fetch Profile
      const profile = await fetchGoogleProfile(accessToken);
      
      if (!profile.email) {
        throw new Error("Could not retrieve email from Google profile.");
      }

      // 2. Construct Account Object
      const colors = ['blue', 'purple', 'orange', 'green', 'rose', 'indigo', 'cyan'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newAccount: Account = {
        id: `acc_google_${profile.sub || Date.now()}`,
        name: profile.name || "Google Account",
        email: profile.email,
        color: randomColor,
        initials: (profile.name || "G").substring(0, 2).toUpperCase(),
        provider: 'google'
      };

      setStatusMessage("Syncing tasks...");
      
      // 3. Fetch Tasks using the same token
      // We wrap this so if task sync fails, we still add the account (empty tasks)
      let tasks: Task[] = [];
      try {
        tasks = await fetchAllGoogleTasksForAccount(accessToken, newAccount.id);
      } catch (syncErr) {
        console.warn("Task sync warning:", syncErr);
        // We don't block account creation if task sync fails, 
        // but we might want to show a toast later.
      }

      onAdd(newAccount, tasks);
      
      // Success
      setMode('select');
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(`Failed to add account: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const handleLocalAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localName.trim()) return;
    
    const colors = ['blue', 'purple', 'orange', 'green', 'rose', 'indigo', 'cyan'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newAccount: Account = {
      id: `acc_local_${Date.now()}`,
      name: localName,
      email: 'local@taskmerge.app',
      color: randomColor,
      initials: localName.substring(0, 2).toUpperCase(),
      provider: 'local'
    };
    onAdd(newAccount, []);
    setLocalName('');
    setMode('select');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Add Account</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 space-y-3">
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="break-words">{error}</p>
              </div>
            </div>
          )}
          
          {mode === 'select' ? (
            <div className="space-y-3">
              <button
                onClick={handleGoogleConnect}
                disabled={loading || !isGoogleReady}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 relative overflow-hidden">
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    ) : (
                      <GoogleIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Google Tasks</h3>
                    <p className="text-xs text-gray-500">
                        {loading ? (statusMessage || "Processing...") : (isGoogleReady ? "Connect Gmail or Workspace" : "Initializing...")}
                    </p>
                  </div>
                </div>
                {!loading && isGoogleReady && <div className="w-2 h-2 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>

              <button
                onClick={() => setMode('local')}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shadow-sm">
                     <span className="font-bold text-gray-500 text-xs">Local</span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Local List</h3>
                    <p className="text-xs text-gray-500">Offline only task list</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
             <form onSubmit={handleLocalAdd} className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">List Name</label>
                   <input 
                     autoFocus
                     type="text" 
                     value={localName}
                     onChange={e => setLocalName(e.target.value)}
                     placeholder="e.g., Side Project"
                     className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                   />
                </div>
                <div className="flex gap-3">
                   <button 
                     type="button"
                     onClick={() => setMode('select')}
                     className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                   >
                     Back
                   </button>
                   <button 
                     type="submit"
                     disabled={!localName.trim()}
                     className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                   >
                     Create List
                   </button>
                </div>
             </form>
          )}
        </div>
      </div>
    </div>
  );
};
