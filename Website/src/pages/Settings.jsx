import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Wallet, Target, Shield, Settings as SettingsIcon, Info, 
  ChevronDown, ChevronUp, Save, X, Trash2, Download, LogOut, 
  ExternalLink, CheckCircle2, AlertCircle, Bot
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { calculateRetirement, getMaxEquityPct, formatIndian } from '../utils/math';
import DashboardLayout, { useUser } from '../components/DashboardLayout';
import InfoTooltip from '../components/InfoTooltip';
import { SETTINGS_TIPS } from '../constants/tooltips';

const SectionHeader = ({ icon: Icon, title, editing, onEdit, color }) => (
  <div className="flex items-center justify-between py-6 px-8 border-b border-[#1E293B]/5 transition-all">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B]`} style={{ backgroundColor: `${color}22` }}>
        <Icon className="w-5 h-5 text-[#1E293B]" strokeWidth={2.5} style={{ color }} />
      </div>
      <h2 className="font-heading font-black text-xl md:text-2xl text-[#1E293B]">{title}</h2>
    </div>
    <button 
      onClick={onEdit}
      className={`px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[2px] border-2 border-[#1E293B] transition-all pop-shadow hover:-translate-y-0.5 ${editing ? 'bg-slate-100 text-[#1E293B]' : 'bg-white text-[#8B5CF6]'}`}
    >
      {editing ? 'Cancel' : 'Edit'}
    </button>
  </div>
);

const ScoreImpact = ({ oldScore, newScore }) => {
  if (oldScore === newScore) return null;
  const delta = newScore - oldScore;
  return (
    <div className={`mt-6 p-4 rounded-xl border-2 border-[#1E293B] flex items-center justify-between font-bold text-[10px] uppercase tracking-widest ${delta > 0 ? 'bg-[#D1FAE5] text-emerald-700' : 'bg-[#FFFBEB] text-amber-700'}`}>
       <span>Preview Score Impact</span>
       <div className="flex items-center gap-3">
          <span className="opacity-40">{oldScore}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="bg-white border-2 border-[#1E293B] px-2 py-0.5 rounded-full shadow-[2px_2px_0_0_#1E293B]">
             {newScore} ({delta > 0 ? '+' : ''}{delta} pts)
          </span>
       </div>
    </div>
  );
};

const ArrowRight = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const PageContent = () => {
  const { userData, setUserData } = useUser();
  const [editingSection, setEditingSection] = useState(null);
  const [formData, setFormData] = useState(userData || {});
  const [toast, setToast] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (userData && !editingSection) {
      setFormData(userData);
    }
  }, [userData, editingSection]);

  const showToast = (message, type = 'success', extra = null) => {
    setToast({ message, type, extra });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async (section) => {
    if (!auth.currentUser) return;
    try {
      const parsedData = {
        ...formData,
        age: parseInt(formData.age) || 28,
        monthlyIncome: parseFloat(formData.monthlyIncome) || 0,
        npsContribution: parseFloat(formData.npsContribution) || 0,
        npsCorpus: parseFloat(formData.npsCorpus) || 0,
        totalSavings: parseFloat(formData.totalSavings) || 0,
        retireAge: parseInt(formData.retireAge) || 60,
        stepUp: parseFloat(formData.stepUp) || 0,
        npsEquity: parseFloat(formData.npsEquity) || 50,
      };

      const newResults = calculateRetirement(parsedData);
      const updatedData = { 
        ...parsedData, 
        ...newResults, 
        updatedAt: new Date().toISOString() 
      };
      
      await setDoc(doc(db, 'users', auth.currentUser.uid), updatedData, { merge: true });
      
      const oldScore = userData.score;
      const newScore = newResults.score;
      
      setUserData(updatedData);
      setEditingSection(null);
      
      if (newScore > oldScore) {
        showToast(`Your score improved from ${oldScore} to ${newScore}! 🎉`, 'emerald');
      } else if (newScore < oldScore) {
        showToast(`Your score dropped to ${newScore}. Check your biggest lever.`, 'pink');
      } else {
        showToast("Changes saved! Your dashboard has been updated.", 'amber');
      }
    } catch (e) {
      showToast("Something went wrong. Please try again.", 'red');
    }
  };

  const exportData = () => {
    if (!userData) return;
    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retiresahi-data-${userData.firstName}-${Date.now()}.json`;
    a.click();
    showToast("Data exported successfully!", 'emerald');
  };

  const deleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      window.location.href = '/';
    } catch (e) {
      showToast("Requires recent login to delete account.", 'red');
      setShowDeleteModal(false);
    }
  };

  if (!userData) return null;

  const simulatedResults = calculateRetirement(formData);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto pb-24">
      {/* Section 1: Personal Info */}
      <div className={`relative bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow transition-all ${editingSection === 'personal' && 'ring-4 ring-[#8B5CF6]/10'}`}>
        <div className="w-1.5 absolute left-0 top-0 h-full bg-[#8B5CF6]" />
        <SectionHeader 
          icon={User} title="Personal Info" color="#8B5CF6"
          editing={editingSection === 'personal'} 
          onEdit={() => setEditingSection(editingSection === 'personal' ? null : 'personal')} 
        />
        <div className="p-8">
          {editingSection === 'personal' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Name</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-5 py-3 font-bold text-sm outline-none focus:border-[#8B5CF6] transition-colors"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Age</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-5 py-3 font-bold text-sm outline-none"
                    value={formData.age}
                    onChange={e => setFormData({...formData, age: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Work Sector</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Private Sector', 'Government', 'Self-Employed', 'Student'].map(s => (
                      <button 
                        key={s}
                        onClick={() => setFormData({...formData, workContext: s})}
                        className={`py-3 rounded-full border-2 border-[#1E293B] font-black text-[10px] uppercase tracking-widest transition-all ${formData.workContext === s ? 'bg-[#8B5CF6] text-white shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
              </div>
              <ScoreImpact oldScore={userData.score} newScore={simulatedResults.score} />
              <button 
                onClick={() => handleSave('personal')}
                className="w-full py-4 bg-[#8B5CF6] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
              >
                Save Personal Info
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Name</div>
                  <div className="font-bold text-[#1E293B]">{userData.firstName}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Age</div>
                  <div className="font-bold text-[#1E293B]">{userData.age} years old</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Sector</div>
                  <div className="font-bold text-[#1E293B]">{userData.workContext}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Income & Contributions */}
      <div className={`relative bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow transition-all ${editingSection === 'income' && 'ring-4 ring-[#F472B6]/10'}`}>
        <div className="w-1.5 absolute left-0 top-0 h-full bg-[#F472B6]" />
        <SectionHeader 
          icon={Wallet} title="Income & NPS Details" color="#F472B6"
          editing={editingSection === 'income'} 
          onEdit={() => setEditingSection(editingSection === 'income' ? null : 'income')} 
        />
        <div className="p-8">
          {editingSection === 'income' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Income (CTC)</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300">₹</span>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-10 py-3 font-bold text-sm outline-none"
                      value={formData.monthlyIncome}
                      onChange={e => setFormData({...formData, monthlyIncome: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly NPS Contribution</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300">₹</span>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-10 py-3 font-bold text-sm outline-none"
                      value={formData.npsContribution}
                      onChange={e => setFormData({...formData, npsContribution: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current NPS Corpus</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300">₹</span>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-10 py-3 font-bold text-sm outline-none"
                      value={formData.npsCorpus}
                      onChange={e => setFormData({...formData, npsCorpus: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Other Savings (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300">₹</span>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-10 py-3 font-bold text-sm outline-none"
                      value={formData.totalSavings}
                      onChange={e => setFormData({...formData, totalSavings: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">Equity Allocation <InfoTooltip text={SETTINGS_TIPS.equityAllocation} size={12} /></label>
                    <span className="text-[9px] font-black text-[#F472B6]">Max for your age: {getMaxEquityPct(formData.age)}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[25, 50, 75].map(eq => (
                      <button 
                        key={eq}
                        disabled={eq > getMaxEquityPct(formData.age)}
                        onClick={() => setFormData({...formData, npsEquity: eq})}
                        className={`py-3 rounded-full border-2 border-[#1E293B] font-black text-[10px] uppercase tracking-widest transition-all ${formData.npsEquity === eq ? 'bg-[#F472B6] text-white shadow-[3px_3px_0_0_#1E293B]' : eq > getMaxEquityPct(formData.age) ? 'opacity-20 cursor-not-allowed' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        {eq}%
                      </button>
                    ))}
                  </div>
              </div>

              <ScoreImpact oldScore={userData.score} newScore={simulatedResults.score} />
              <button 
                onClick={() => handleSave('income')}
                className="w-full py-4 bg-[#F472B6] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
              >
                Update Income & Savings
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Income</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(userData.monthlyIncome)}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Contribution</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(userData.npsContribution)}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Corpus</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(userData.npsCorpus)}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Equity %</div>
                  <div className="font-bold text-[#1E293B]">{userData.npsEquity}%</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Retirement Goal */}
      <div className={`relative bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow transition-all ${editingSection === 'retirement' && 'ring-4 ring-[#FBBF24]/10'}`}>
        <div className="w-1.5 absolute left-0 top-0 h-full bg-[#FBBF24]" />
        <SectionHeader 
          icon={Target} title="Retirement Goal" color="#FBBF24"
          editing={editingSection === 'retirement'} 
          onEdit={() => setEditingSection(editingSection === 'retirement' ? null : 'retirement')} 
        />
        <div className="p-8">
          {editingSection === 'retirement' ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Retirement Age</label>
                  <span className="font-black text-[#FBBF24] text-lg">{formData.retireAge}</span>
                </div>
                <input 
                  type="range" min="50" max="70" step="1"
                  className="w-full h-3 bg-slate-50 border-2 border-[#1E293B] rounded-full appearance-none cursor-pointer accent-[#FBBF24]"
                  value={formData.retireAge} 
                  onChange={e => setFormData({...formData, retireAge: parseInt(e.target.value)})}
                />
              </div>

              <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retirement Lifestyle</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['essential', 'comfortable', 'premium'].map(l => (
                        <button 
                          key={l}
                          onClick={() => setFormData({...formData, lifestyle: l})}
                          className={`p-4 rounded-xl border-2 border-[#1E293B] text-left transition-all ${formData.lifestyle === l ? 'bg-[#FFFDF5] border-[#FBBF24] shadow-[4px_4px_0_0_#FBBF24] -translate-y-1' : 'bg-white opacity-50'}`}
                        >
                          <div className="font-black uppercase tracking-widest text-xs mb-1">{l}</div>
                          <div className="text-[9px] font-bold text-slate-400 tracking-wide">
                              {l === 'essential' ? '40%' : l === 'comfortable' ? '60%' : '80%'} OF CTC
                          </div>
                        </button>
                    ))}
                  </div>
              </div>

              <ScoreImpact oldScore={userData.score} newScore={simulatedResults.score} />
              <button 
                onClick={() => handleSave('retirement')}
                className="w-full py-4 bg-[#FBBF24] text-[#1E293B] border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
              >
                Adjust Retirement Goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Target Age</div>
                  <div className="font-bold text-[#1E293B]">{userData.retireAge} years</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Lifestyle</div>
                  <div className="font-bold text-[#1E293B] uppercase">{userData.lifestyle}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Future Need</div>
                  <div className="font-bold text-[#FBBF24]">{formatIndian(userData.monthlySpendAtRetirement)}/m</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Tax Preferences */}
      <div className={`relative bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow transition-all ${editingSection === 'tax' && 'ring-4 ring-emerald-500/10'}`}>
        <div className="w-1.5 absolute left-0 top-0 h-full bg-emerald-400" />
        <SectionHeader 
          icon={Shield} title="Tax Preferences" color="#34D399"
          editing={editingSection === 'tax'} 
          onEdit={() => setEditingSection(editingSection === 'tax' ? null : 'tax')} 
        />
        <div className="p-8">
          {editingSection === 'tax' ? (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setFormData({...formData, taxRegime: 'new'})}
                    className={`p-4 rounded-xl border-2 border-[#1E293B] text-left ${formData.taxRegime === 'new' ? 'bg-[#D1FAE5] border-[#34D399] shadow-[3px_3px_0_0_#34D399]' : 'bg-white opacity-40'}`}
                  >
                      <div className="font-black text-xs uppercase tracking-widest flex items-center gap-1">New Regime <InfoTooltip text={SETTINGS_TIPS.taxRegime} size={12} /></div>
                      <div className="text-[9px] font-bold text-slate-500 mt-1">Budget 2025 Standard</div>
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, taxRegime: 'old'})}
                    className={`p-4 rounded-xl border-2 border-[#1E293B] text-left ${formData.taxRegime === 'old' ? 'bg-[#D1FAE5] border-[#34D399] shadow-[3px_3px_0_0_#34D399]' : 'bg-white opacity-40'}`}
                  >
                      <div className="font-black text-xs uppercase tracking-widest">Old Regime</div>
                      <div className="text-[9px] font-bold text-slate-500 mt-1">Deduction Based</div>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">Basic Salary Assumption <InfoTooltip text={SETTINGS_TIPS.basicSalaryPct} size={12} /></label>
                    <span className="font-black text-[#34D399]">{formData.basicSalaryPct * 100}%</span>
                  </div>
                  <input 
                    type="range" min="0.3" max="0.7" step="0.05"
                    className="w-full h-3 bg-slate-50 border-2 border-[#1E293B] rounded-full appearance-none cursor-pointer accent-emerald-500"
                    value={formData.basicSalaryPct} 
                    onChange={e => setFormData({...formData, basicSalaryPct: parseFloat(e.target.value)})}
                  />
                </div>
                <button 
                onClick={() => handleSave('tax')}
                className="w-full py-4 bg-emerald-500 text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
              >
                Save Tax Preferences
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Current Regime</div>
                  <div className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest inline-block">
                    {userData.taxRegime || 'New'} Regime
                  </div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Basic % of CTC</div>
                  <div className="font-bold text-[#1E293B]">{userData.basicSalaryPct * 100}%</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Account Actions */}
      <div className="bg-slate-50 border-2 border-[#1E293B]/10 rounded-[24px] overflow-hidden">
          <div className="p-8 space-y-4">
            <h3 className="font-heading font-black text-lg text-[#1E293B] uppercase tracking-widest flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> Account Actions
            </h3>
            
            <div className="flex flex-wrap gap-4">
                <button 
                onClick={exportData}
                className="px-6 py-3 bg-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-[10px] pop-shadow flex items-center gap-2 hover:-translate-y-0.5 transition-all"
                >
                  <Download className="w-4 h-4" /> Export My Data (.json)
                </button>
                
                <button 
                onClick={() => setShowDeleteModal(true)}
                className="px-6 py-3 bg-white border-2 border-[#EF4444] text-[#EF4444] rounded-full font-black uppercase tracking-widest text-[10px] shadow-[4px_4px_0_0_#EF4444] flex items-center gap-2 hover:-translate-y-0.5 transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Permanently Delete My Account
                </button>
            </div>
          </div>
      </div>

      {/* Section 6: About */}
      <div className="text-center space-y-4 pt-8 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[3px] text-slate-300">
            <Bot className="w-4 h-4" /> Developed by RetireSahi Team
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <a href="#" className="hover:text-[#8B5CF6] transition-colors flex items-center gap-1">Methodology <ExternalLink className="w-3 h-3" /></a>
            <a href="#" className="hover:text-[#8B5CF6] transition-colors flex items-center gap-1">Privacy Policy <ExternalLink className="w-3 h-3" /></a>
            <a href="#" className="hover:text-[#8B5CF6] transition-colors flex items-center gap-1">Terms <ExternalLink className="w-3 h-3" /></a>
          </div>
          <div className="text-[10px] font-black text-slate-200">v1.2.0-stable</div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className={`border-2 border-[#1E293B] px-8 py-4 rounded-full font-black text-xs uppercase tracking-[3px] shadow-[6px_6px_0_0_#1E293B] flex items-center gap-4 transition-colors`} style={{ backgroundColor: toast.type === 'red' ? '#EF4444' : toast.type === 'amber' ? '#FBBF24' : toast.type === 'emerald' ? '#34D399' : userData.score > simulatedResults.score ? '#F472B6' : '#FFFDF5' }}>
              {toast.type === 'red' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              {toast.message}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1E293B]/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white border-2 border-[#1E293B] rounded-[32px] p-10 max-w-lg w-full pop-shadow-vivid relative animate-scale-up">
              <button onClick={() => setShowDeleteModal(false)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900"><X /></button>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-500 shadow-[4px_4px_0_0_#EF4444]">
                  <Trash2 className="w-10 h-10 text-red-500" strokeWidth={2.5} />
              </div>
              <h2 className="font-heading font-black text-3xl text-[#1E293B] text-center mb-4">Are you absolutely sure?</h2>
              <p className="text-center text-slate-500 font-bold mb-10 leading-relaxed uppercase text-[10px] tracking-widest">
                  This will permanently delete your financial profile, score history, and tax analysis. This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-4">
                  <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="py-4 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                  >
                    No, Keep It
                  </button>
                  <button 
                  onClick={deleteAccount}
                  className="py-4 bg-[#EF4444] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1 transition-all"
                  >
                    Yes, Delete Everything
                  </button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default function Settings() {
  return (
    <DashboardLayout title="Settings">
      <PageContent />
    </DashboardLayout>
  );
}
