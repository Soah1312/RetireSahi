import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Shield, Moon, Bot, Settings, LogOut, Menu, X, Bell, BarChart2 
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getScoreInfo } from '../utils/math';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a DashboardLayout');
  return context;
};

export default function DashboardLayout({ children, title, userData: passedUserData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState(passedUserData || null);
  const [loading, setLoading] = useState(!passedUserData);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (passedUserData) {
      setUserData(passedUserData);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          navigate('/onboarding');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [navigate, passedUserData]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/dashboard' },
    { label: 'Tax Shield', icon: Shield, path: '/tax-shield' },
    { label: 'Dream Planner', icon: Moon, path: '/dream-planner' },
    { label: 'AI Co-Pilot', icon: Bot, path: '/ai-copilot' },
    { label: 'Methodology', icon: BarChart2, path: '/methodology' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-[#8B5CF6]/20 rounded-full mb-4" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  const score = userData?.score || 0;
  const scoreInfo = getScoreInfo(score);

  return (
    <UserContext.Provider value={{ userData, setUserData }}>
      <div className="min-h-screen bg-[#FFFDF5] text-[#1E293B] relative font-['Plus_Jakarta_Sans']">
        <style>{`
          h1, h2, h3, .font-heading { font-family: 'Outfit', sans-serif; }
          .pop-shadow { box-shadow: 4px 4px 0px 0px #1E293B; }
          .sidebar-item-active { background: #8B5CF6; color: white; border-radius: 9999px; box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.3); }
          @keyframes slideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
          .animate-slide-right { animation: slideRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        {/* Sidebar (Desktop) */}
        <aside className="fixed left-0 top-0 h-full w-60 bg-[#1E293B] z-40 hidden lg:flex flex-col p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-10 h-10 bg-[#8B5CF6] rounded-full border-2 border-white flex items-center justify-center font-heading font-extrabold text-white text-xl">N</div>
            <span className="font-heading font-extrabold text-white text-xl uppercase tracking-widest">NPS Pulse</span>
          </div>

          <nav className="flex-1 space-y-4">
            {navItems.map(item => (
              <button 
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-4 py-3 px-4 font-bold transition-all ${location.pathname === item.path ? 'sidebar-item-active' : 'text-white/70 hover:bg-white/10 rounded-full'}`}
              >
                <item.icon className="w-5 h-5" strokeWidth={2.5} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-8 border-t border-white/10 mt-auto">
            <div className="flex items-center gap-3 p-2 bg-white/5 rounded-2xl">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border-2 border-[#8B5CF6]" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6] border-2 border-white flex items-center justify-center font-bold text-white uppercase text-lg">
                  {userData?.firstName?.[0] || 'U'}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-white font-bold text-sm tracking-wide truncate">{userData?.firstName || 'User'}</span>
                <button onClick={() => navigate('/settings')} className="text-[10px] text-white/50 uppercase tracking-widest font-black hover:text-[#F472B6] text-left">Settings</button>
              </div>
              <button onClick={handleLogout} className="ml-auto p-2 text-white/30 hover:text-white transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Nav Bottom */}
        <nav className="fixed bottom-0 left-0 w-full bg-white h-16 border-t border-slate-200 flex lg:hidden items-center justify-around z-50 px-2 pb-safe">
          {navItems.slice(0, 5).map(item => (
            <button 
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 ${location.pathname === item.path ? 'text-[#8B5CF6]' : 'text-slate-400'}`}
            >
              <item.icon className="w-5 h-5" strokeWidth={2.5} />
              {location.pathname === item.path && <span className="text-[9px] font-black uppercase tracking-widest leading-none">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main className="lg:ml-60 min-h-screen flex flex-col relative pb-20 lg:pb-0">
          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

          {/* Top Bar */}
          <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 -ml-2 text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <h1 className="font-heading font-extrabold text-lg md:text-2xl text-[#1E293B] uppercase tracking-widest truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <div className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-[9px] md:text-[10px]`} style={{ backgroundColor: `${scoreInfo.color}22` }}>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" style={{ backgroundColor: scoreInfo.color }} />
                <span>{score} <span className="hidden xs:inline">{scoreInfo.label}</span></span>
              </div>
              <button className="p-1.5 md:p-2 text-[#1E293B]/60 hover:text-[#1E293B] relative">
                <Bell className="w-5 h-5" />
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F472B6] rounded-full border-2 border-white" />
              </button>
            </div>
          </header>

          {/* Mobile Sidebar Overlay */}
          {isMenuOpen && (
            <div className="fixed inset-0 z-[60] lg:hidden animate-fade-in">
              <div className="absolute inset-0 bg-[#1E293B]/40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
              <aside className="absolute top-0 left-0 h-full w-[280px] bg-[#1E293B] p-6 flex flex-col animate-slide-right">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#8B5CF6] rounded-full border-2 border-white flex items-center justify-center font-heading font-extrabold text-white">N</div>
                    <span className="font-heading font-extrabold text-white tracking-widest">NPS Pulse</span>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="text-white/40 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex-1 space-y-2">
                  {navItems.map(item => (
                    <button 
                      key={item.label}
                      onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
                      className={`w-full flex items-center gap-4 py-3.5 px-4 font-bold transition-all text-sm ${location.pathname === item.path ? 'sidebar-item-active' : 'text-white/70 hover:bg-white/5 rounded-full'}`}
                    >
                      <item.icon className="w-5 h-5" strokeWidth={2.5} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>

                <div className="pt-6 border-t border-white/10 mt-auto">
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    {auth.currentUser?.photoURL ? (
                      <img src={auth.currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border-2 border-[#8B5CF6]" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#8B5CF6] border-2 border-white flex items-center justify-center font-bold text-white text-base">
                        {userData?.firstName?.[0] || 'U'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm truncate">{userData?.firstName || 'User'}</div>
                      <button onClick={handleLogout} className="text-[10px] text-[#F472B6] font-black uppercase tracking-widest">Sign Out</button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          <div className="flex-1 z-10">
            {children}
          </div>
        </main>
      </div>
    </UserContext.Provider>
  );
}
