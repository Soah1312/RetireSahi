import React, { useEffect, useState } from 'react';
import { Mail, Lock, X, ArrowRight, Loader2 } from 'lucide-react';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  sendSignInLinkToEmail
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const COLORS = {
  bg: '#FFFDF5',
  fg: '#1E293B',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  emerald: '#34D399'
};

export default function AuthModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      if (!auth) throw new Error("Firebase config missing in .env.local");
      await signInWithPopup(auth, googleProvider);
      onClose();
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      if (!auth) throw new Error("Firebase config missing in .env.local");
      
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      } else {
        const actionCodeSettings = {
          url: window.location.origin, 
          handleCodeInApp: true,
        };
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        setSuccess('Magic link sent! Please check your email inbox.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#1E293B]/60 backdrop-blur-sm cursor-pointer" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div 
        className="relative bg-[#FFFDF5] border-2 border-[#1E293B] rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden pop-shadow flex flex-col max-h-[calc(100dvh-0.5rem)] sm:max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label={isLogin ? 'Login modal' : 'Sign up modal'}
        style={{ animation: 'slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <style>{`
          @keyframes slide-up {
            from { transform: translateY(40px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          .input-memphis {
            border: 2px solid #1E293B;
            border-radius: 8px;
            padding: 0.75rem 1rem 0.75rem 2.5rem;
            width: 100%;
            outline: none;
            transition: all 0.2s;
            background: white;
            font-family: inherit;
          }
          .input-memphis:focus {
            box-shadow: 4px 4px 0px 0px ${COLORS.violet};
            transform: translate(-2px, -2px);
          }
          .input-memphis:focus-visible {
            outline: 2px solid ${COLORS.violet};
            outline-offset: 1px;
          }
          .social-btn {
            border: 2px solid #1E293B;
            border-radius: 9999px;
            width: 100%;
            padding: 0.75rem;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            background: white;
            box-shadow: 4px 4px 0px 0px #1E293B;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .social-btn:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0px 0px #1E293B;
            background: ${COLORS.amber};
          }
          .social-btn:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px 0px #1E293B;
          }
          .social-btn:focus-visible {
            outline: 2px solid ${COLORS.violet};
            outline-offset: 2px;
          }

          @media (max-width: 640px) {
            .auth-title {
              font-size: 1.7rem;
              line-height: 1.2;
            }
          }
        `}</style>
        
        {/* Header */}
        <div className="bg-[#8B5CF6] border-b-2 border-[#1E293B] px-4 py-4 sm:p-6 relative flex justify-between items-center text-white">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFFDF5_2px,transparent_2px)] [background-size:16px_16px]" />
          <h2 className="auth-title font-heading font-extrabold text-3xl relative z-10 m-0 pr-3">
            {isLogin ? 'Welcome Back!' : 'Start Your Journey'}
          </h2>
          <button 
            onClick={onClose}
            className="touch-target w-11 h-11 sm:w-8 sm:h-8 rounded-full border-2 border-[#1E293B] bg-white flex items-center justify-center text-[#1E293B] shadow-[2px_2px_0_0_#1E293B] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#1E293B] active:translate-y-0.5 active:shadow-[1px_1px_0_0_#1E293B] transition-all relative z-10 p-0 cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain mobile-scroll-lock p-5 sm:p-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-10 flex flex-col items-center">
          
          <button onClick={handleGoogleSignIn} disabled={loading} className="social-btn mb-6 cursor-pointer disabled:opacity-50">
            {!loading ? (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
          </button>

          <div className="flex items-center w-full gap-4 mb-6">
            <div className="flex-1 h-px bg-[#1E293B]/20" />
            <span className="text-sm font-bold text-[#1E293B]/50 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-[#1E293B]/20" />
          </div>

          <form onSubmit={handleEmailAuth} className="w-full space-y-4">
            {error && (
              <div className="bg-[#F472B6]/20 border-2 border-[#F472B6] text-[#1E293B] px-4 py-2 rounded-lg font-bold text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-[#34D399]/20 border-2 border-[#34D399] text-[#1E293B] px-4 py-2 rounded-lg font-bold text-sm">
                {success}
              </div>
            )}
            
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#1E293B]/50" />
              <input 
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input-memphis"
              />
            </div>
            
            {isLogin && (
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#1E293B]/50" />
                <input 
                  type="password" 
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input-memphis"
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || success != null}
              className="candy-btn w-full py-4 mt-2 font-black uppercase tracking-widest text-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              style={{ boxShadow: '4px 4px 0px 0px #1E293B' }}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Send Magic Link'}
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <ArrowRight className="text-[#8B5CF6] w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center font-bold text-[#1E293B]/70">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccess(null);
              }}
              className="text-[#F472B6] hover:text-[#8B5CF6] underline decoration-2 underline-offset-4 cursor-pointer"
            >
              {isLogin ? 'Sign up for free' : 'Log in here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
