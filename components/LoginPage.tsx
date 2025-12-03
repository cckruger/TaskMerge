
import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { decodeJwt } from '../utils/jwt';
import { Logo } from './Logo';
import { GOOGLE_CLIENT_ID } from '../config';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  useEffect(() => {
    /* global google */
    if (window.google) {
      // Cast to any to access 'id' property which might be missing from global declarations
      const googleAccounts = window.google.accounts as any;
      
      try {
        googleAccounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            const profile = decodeJwt(response.credential);
            if (profile) {
              onLoginSuccess({
                name: profile.name,
                email: profile.email,
                picture: profile.picture,
                sub: profile.sub
              });
            }
          }
        });

        // Render button - we re-render when mode changes to ensure it stays visible
        const btnParent = document.getElementById("googleIconBtn");
        if (btnParent) {
            googleAccounts.id.renderButton(
                btnParent,
                { 
                    theme: "outline", 
                    size: "large", 
                    text: isSignUp ? "signup_with" : "continue_with", // Change button text based on mode
                    width: "280" 
                }
            );
        }
      } catch (e) {
        console.error("Google Sign-In Initialization Error:", e);
      }
    }
  }, [onLoginSuccess, isSignUp]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Hero */}
        <div className="md:w-1/2 bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          
          <div className="relative z-10">
             <div className="flex items-center gap-3 mb-8">
                <Logo className="w-12 h-12 rounded-xl shadow-lg" />
                <span className="text-2xl font-bold tracking-tight">TaskMerge</span>
             </div>
             
             <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
               {isSignUp ? "Start your journey." : "Unify your tasks."} <br/>
               <span className="text-indigo-200">{isSignUp ? "Get organized today." : "Amplify your focus."}</span>
             </h1>
             
             <p className="text-indigo-100 text-lg leading-relaxed max-w-sm">
               Manage multiple Google Accounts and local lists in one intelligent, AI-powered dashboard.
             </p>
          </div>

          <div className="relative z-10 mt-12 space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium text-indigo-100">
               <CheckCircle2 className="w-5 h-5 text-teal-300" />
               <span>Multi-account Google Tasks sync</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-indigo-100">
               <Zap className="w-5 h-5 text-yellow-300" />
               <span>Gemini AI Smart Input & Sorting</span>
            </div>
             <div className="flex items-center gap-3 text-sm font-medium text-indigo-100">
               <ShieldCheck className="w-5 h-5 text-emerald-300" />
               <span>Secure Client-side Processing</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login/Signup */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col items-center justify-center bg-white transition-all overflow-y-auto">
           <div className="w-full max-w-xs space-y-6">
               <div className="text-center mb-6">
                 <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {isSignUp ? "Create your account" : "Welcome Back"}
                 </h2>
                 <p className="text-gray-500">
                    {isSignUp ? "Join free with your Google account" : "Sign in to access your workspace"}
                 </p>
               </div>

              <div className="flex justify-center min-h-[50px]">
                  <div id="googleIconBtn"></div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">Secure Authentication</span>
                </div>
              </div>

              <div className="text-center">
                  {isSignUp ? (
                      <p className="text-sm text-gray-600">
                          Already have an account?{' '}
                          <button 
                              onClick={() => setIsSignUp(false)} 
                              className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline transition-all"
                          >
                              Log in
                          </button>
                      </p>
                  ) : (
                      <p className="text-sm text-gray-600">
                          Don't have an account?{' '}
                          <button 
                              onClick={() => setIsSignUp(true)} 
                              className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline transition-all inline-flex items-center gap-1"
                          >
                              Sign up for free <ArrowRight className="w-3 h-3" />
                          </button>
                      </p>
                  )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
