import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Lightbulb, Archive, HelpCircle, Mic, MicOff } from 'lucide-react';

interface SmartInputProps {
  onProcess: (text: string) => Promise<void>;
  isProcessing: boolean;
}

// Type definition for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const SmartInput: React.FC<SmartInputProps> = ({ onProcess, isProcessing }) => {
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    await onProcess(input);
    setInput('');
  };

  const handleAction = (actionText: string) => {
    setInput(actionText);
    setIsMenuOpen(false);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setInput((prev) => {
           const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
           return prev + separator + finalTranscript;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full z-50">
      <div className="relative group">
        <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-xl blur transition duration-200 ${isListening ? 'from-red-500 to-orange-500 opacity-75 animate-pulse' : 'from-indigo-500 to-purple-600 opacity-25 group-hover:opacity-50'}`}></div>
        <div className="relative flex items-center bg-white rounded-xl shadow-xl border border-gray-100">
          
          {/* Interactive AI Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              disabled={isProcessing}
              className={`pl-4 pr-2 py-4 flex items-center gap-1 transition-colors ${isMenuOpen ? 'text-indigo-600' : 'text-indigo-500 hover:text-indigo-600'}`}
              title="AI Actions"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </button>

            {isMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-50">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Assistants</span>
                </div>
                
                <button 
                  type="button"
                  onClick={() => handleAction("Suggest 3 important tasks for my Work account based on a Product Manager role.")}
                  className="w-full px-4 py-3 text-sm text-left hover:bg-indigo-50 flex items-start gap-3 group transition-colors"
                >
                  <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg group-hover:bg-yellow-200 transition-colors">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-medium text-gray-800">Suggest Tasks</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Generate ideas for work</span>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => handleAction("Review my tasks. Which ones seem urgent but are low priority?")}
                  className="w-full px-4 py-3 text-sm text-left hover:bg-indigo-50 flex items-start gap-3 group transition-colors"
                >
                  <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-medium text-gray-800">Smart Review</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Find priority mismatches</span>
                  </div>
                </button>
                
                <div className="border-t border-gray-50 mt-1 pt-1">
                    <button 
                      type="button"
                      onClick={() => handleAction("Add 'Buy Milk' to Personal and 'Email Team' to Work")}
                      className="w-full px-4 py-2 text-xs text-left text-gray-500 hover:text-indigo-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      See example prompt
                    </button>
                </div>
              </div>
            )}
          </div>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask AI to add tasks... e.g., 'Schedule meeting with team on Work'"}
            className="w-full px-2 py-4 text-gray-700 focus:outline-none bg-transparent placeholder-gray-400"
            disabled={isProcessing}
          />

          {/* Actions Right */}
          <div className="flex items-center gap-2 mr-2">
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-2 rounded-full transition-all duration-200 ${
                isListening 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
                  : 'bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2 ml-1 text-right">
        Powered by Gemini 2.5 Flash • Supports multi-account routing
      </p>
    </form>
  );
};