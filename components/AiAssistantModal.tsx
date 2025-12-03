import React from 'react';
import { X, Sparkles, Bot } from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  response: string | null;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose, response }) => {
  if (!isOpen || !response) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2 text-indigo-700">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
                <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-lg">AI Insight</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="flex gap-4">
             <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <Bot className="w-5 h-5" />
                </div>
             </div>
             <div className="flex-1 text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">
                {response}
             </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
           <button 
             onClick={onClose}
             className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
};