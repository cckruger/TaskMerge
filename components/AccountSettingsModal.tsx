import React, { useState, useEffect } from 'react';
import { X, Trash2, Unlink, Save, Shield, Lock, Check } from 'lucide-react';
import { Account } from '../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onUnlink: (id: string) => void;
  onUpdateColor: (id: string, color: string) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  account,
  onRename,
  onDelete,
  onUnlink,
  onUpdateColor,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (account) {
      setName(account.name);
    }
  }, [account]);

  if (!isOpen || !account) return null;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name !== account.name) {
      onRename(account.id, name);
    }
  };

  const colors = ['indigo', 'blue', 'purple', 'green', 'orange', 'rose', 'cyan', 'gray'];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">Account Settings</h2>
                {account.isPrimary && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Primary
                    </span>
                )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{account.email}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Rename Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Display Name</h3>
            <form onSubmit={handleSaveName} className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="Account Name"
              />
              <button 
                type="submit" 
                disabled={!name.trim() || name === account.name}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2">
              This only changes the name within TaskMerge.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Color Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Account Color</h3>
            <div className="flex flex-wrap gap-3">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdateColor(account.id, c)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${account.color === c ? 'ring-2 ring-offset-2 ring-gray-300 scale-110' : 'hover:scale-110'}`}
                  title={c.charAt(0).toUpperCase() + c.slice(1)}
                >
                   <div className={`w-full h-full rounded-full bg-${c}-500 border border-black/5`} />
                   {account.color === c && <Check className="w-4 h-4 text-white absolute drop-shadow-sm" />}
                </button>
              ))}
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Actions Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Actions</h3>
            
            {account.isPrimary ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700">Primary Account Locked</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            This account is used to sign in to TaskMerge and cannot be deleted or unlinked. 
                            To remove this account, sign out from the main menu.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Unlink Option (Google Only) */}
                    {account.provider === 'google' && (
                    <div className="flex items-start justify-between p-4 border border-orange-100 bg-orange-50/30 rounded-xl">
                        <div className="flex gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg h-fit">
                            <Unlink className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800">Unlink from Google</h4>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                            Disconnects sync but keeps a local copy of your tasks.
                            </p>
                        </div>
                        </div>
                        <button 
                        onClick={() => { onUnlink(account.id); onClose(); }}
                        className="px-3 py-1.5 bg-white border border-orange-200 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-50 transition-colors shadow-sm"
                        >
                        Unlink
                        </button>
                    </div>
                    )}

                    {/* Delete Option */}
                    <div className="flex items-start justify-between p-4 border border-red-100 bg-red-50/30 rounded-xl">
                    <div className="flex gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg h-fit">
                        <Trash2 className="w-4 h-4" />
                        </div>
                        <div>
                        <h4 className="text-sm font-semibold text-gray-800">Delete Account</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                            Permanently removes this account and all associated tasks from the app.
                        </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { onDelete(account.id); onClose(); }}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                    >
                        Delete
                    </button>
                    </div>
                </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};