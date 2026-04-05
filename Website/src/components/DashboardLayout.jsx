import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Shield, Moon, Bot, Settings, LogOut, Menu, X, Bell, BarChart2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { getScoreBand, calculateRetirement } from '../utils/math';
import { UserContext, withInitialUserData } from './UserContext';
import { decryptUserData } from '../utils/encryption';
import { useAuthSession } from './authSessionContext';
import { getOrLoadUserProfile, invalidateUserProfileCache } from '../lib/userProfileCache';

const SIDEBAR_STORAGE_KEY = 'retiresahi_sidebar_collapsed';

export default function DashboardLayout({ children, title, userData: passedUserData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [fetchedUserData, setFetchedUserData] = useState(null);
  const [loading, setLoading] = useState(!passedUserData);
  const [loadError, setLoadError] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentUser, authLoading } = useAuthSession();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });

  const userData = withInitialUserData(passedUserData || fetchedUserData);
  const setUserData = setFetchedUserData;

  useEffect(() => {
    if (passedUserData) {
      return;
    }

    if (authLoading) {
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        if (!currentUser) {
          navigate('/');
          return;
        }

        const profile = await getOrLoadUserProfile({
          uid: currentUser.uid,
          loader: async () => {
            const snap = await getDoc(doc(db, 'users', currentUser.uid));
            if (!snap.exists()) {
              return null;
            }

            return decryptUserData(snap.data(), currentUser.uid);
          },
        });

        if (!profile) {
          navigate('/onboarding');
          return;
        }

        if (!cancelled) {
          setFetchedUserData(profile);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load dashboard profile:', err);
          setLoadError(err?.message || 'Unable to load your profile right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser, navigate, passedUserData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleLogout = async () => {
    invalidateUserProfileCache(currentUser?.uid);
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

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFDF5] p-6">
        <div className="max-w-md w-full bg-white border-4 border-[#1E293B] rounded-2xl p-6 pop-shadow-pink space-y-4">
          <h2 className="font-heading font-black text-xl uppercase tracking-widest text-[#1E293B]">Dashboard Unavailable</h2>
          <p className="text-sm font-bold text-[#1E293B]/70 leading-relaxed">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-[#8B5CF6] text-white rounded-full font-black uppercase tracking-widest text-xs pop-shadow"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const freshResults = userData ? calculateRetirement(userData) : null;
  const displayScore = freshResults?.score || 0;
  const scoreInfo = getScoreBand(displayScore);

  return (
    <UserContext.Provider value={{ userData, setUserData }}>
      <div
        className="min-h-screen bg-[#FFFDF5] text-[#1E293B] relative font-['Plus_Jakarta_Sans']"
        style={{ '--sidebar-width': isSidebarCollapsed ? '6rem' : '15rem' }}
      >
        <style>{`
          h1, h2, h3, .font-heading { font-family: 'Outfit', sans-serif; }
          .pop-shadow { box-shadow: 4px 4px 0px 0px #1E293B; }
          .sidebar-item-active { background: #8B5CF6; color: white; border-radius: 9999px; box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.3); }
          @keyframes slideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
          .animate-slide-right { animation: slideRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @media (min-width: 1024px) {
            .dashboard-fixed-offset { left: var(--sidebar-width) !important; }
          }
        `}</style>

        {/* Sidebar (Desktop) */}
        <aside className={`fixed left-0 top-0 h-full bg-[#1E293B] z-40 hidden lg:flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-24 p-4 items-center' : 'w-60 p-6'}`}>
          <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-10 h-10 bg-[#8B5CF6] rounded-full border-2 border-white flex items-center justify-center font-heading font-extrabold text-white text-xl">R</div>
            {!isSidebarCollapsed && <span className="font-heading font-extrabold text-white text-xl uppercase tracking-widest whitespace-nowrap animate-fade-in">RetireSahi</span>}
          </div>

          <nav className="flex-1 space-y-4 w-full">
            {navItems.map(item => (
              <button 
                key={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center py-3 font-bold transition-all ${location.pathname === item.path ? 'sidebar-item-active' : 'text-white/70 hover:bg-white/10 rounded-full'} ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-4 px-4'}`}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap animate-fade-in">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="pt-8 border-t border-white/10 mt-auto w-full">
            <div className={`flex items-center p-2 bg-white/5 rounded-2xl ${isSidebarCollapsed ? 'flex-col gap-3 justify-center' : 'gap-3'}`}>
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-10 h-10 shrink-0 rounded-full border-2 border-[#8B5CF6]" />
              ) : (
                <div className="w-10 h-10 shrink-0 rounded-full bg-[#8B5CF6] border-2 border-white flex items-center justify-center font-bold text-white uppercase text-lg">
                  {userData?.firstName?.[0] || 'U'}
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-white font-bold text-sm tracking-wide truncate">{userData?.firstName || 'User'}</span>
                  <button onClick={() => navigate('/settings')} className="text-[10px] text-white/50 uppercase tracking-widest font-black hover:text-[#F472B6] text-left">Settings</button>
                </div>
              )}
              <button onClick={handleLogout} title={isSidebarCollapsed ? 'Log Out' : undefined} className={`p-2 text-white/30 hover:text-white transition-colors shrink-0 ${!isSidebarCollapsed ? 'ml-auto' : ''}`}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Nav Bottom */}
        <nav className="fixed bottom-0 left-0 w-full bg-white h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-slate-200 flex lg:hidden items-center justify-around z-50 px-2 pt-1 pb-[env(safe-area-inset-bottom)]">
          {navItems.slice(0, 5).map(item => (
            <button 
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`touch-target min-w-[56px] flex flex-col items-center justify-center gap-1 ${location.pathname === item.path ? 'text-[#8B5CF6]' : 'text-slate-400'}`}
              aria-label={item.label}
            >
              <item.icon className="w-5 h-5" strokeWidth={2.5} />
              {location.pathname === item.path && <span className="text-[9px] font-black uppercase tracking-widest leading-none">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main className={`min-h-screen flex flex-col relative pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-24' : 'lg:ml-60'}`}>
          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

          {/* Top Bar */}
          <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden touch-target p-2 -ml-2 text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors"
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <button
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="hidden lg:flex p-2 -ml-1 text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors"
                title={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
              <h1 className="font-heading font-extrabold text-lg md:text-2xl text-[#1E293B] uppercase tracking-widest truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <div className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-[9px] md:text-[10px]`} style={{ backgroundColor: `${scoreInfo.color}22` }}>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" style={{ backgroundColor: scoreInfo.color }} />
                <span>{displayScore} <span className="hidden xs:inline">{scoreInfo.label}</span></span>
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
                    <div className="w-9 h-9 bg-[#8B5CF6] rounded-full border-2 border-white flex items-center justify-center font-heading font-extrabold text-white">R</div>
                    <span className="font-heading font-extrabold text-white tracking-widest">RetireSahi</span>
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
                    {currentUser?.photoURL ? (
                      <img src={currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border-2 border-[#8B5CF6]" />
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
