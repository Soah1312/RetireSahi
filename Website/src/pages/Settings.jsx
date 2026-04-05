import React, { useState } from 'react';
import { 
  User, Wallet, Target, Shield, Settings as SettingsIcon, Info, 
  ChevronDown, ChevronUp, Save, X, Trash2, Download, LogOut, 
  ExternalLink, CheckCircle2, AlertCircle, Bot
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { calculateRetirement, getMaxEquityPct, formatIndian } from '../utils/math';
import DashboardLayout from '../components/DashboardLayout';
import { useUser } from '../components/UserContext';
import InfoTooltip from '../components/InfoTooltip';
import { SETTINGS_TIPS } from '../constants/tooltips';
import { encryptUserData } from '../utils/encryption';
import { writeUserProfileCache } from '../lib/userProfileCache';
import {
  OTHER_SCHEME_CONFIGS,
  RETIREMENT_MODES,
  SCHEME_ASSUMPTION_BASIS,
  ASSUMED_RETURN_MIN_PCT,
  ASSUMED_RETURN_MAX_PCT,
  inferRetirementMode,
  getSchemeAssumedReturnPct,
  normalizeAssumedReturnPct,
} from '../constants/investmentSchemes.js';

const SectionHeader = ({ icon: Icon, title, editing, onEdit, color }) => (
  <div className="flex items-center justify-between py-5 sm:py-6 px-4 sm:px-8 border-b border-[#1E293B]/5 transition-all gap-3">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B]`} style={{ backgroundColor: `${color}22` }}>
        {React.createElement(Icon, { className: 'w-5 h-5 text-[#1E293B]', strokeWidth: 2.5, style: { color } })}
      </div>
      <h2 className="font-heading font-black text-xl md:text-2xl text-[#1E293B]">{title}</h2>
    </div>
    <button 
      onClick={onEdit}
      className={`touch-target px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[2px] border-2 border-[#1E293B] transition-all pop-shadow hover:-translate-y-0.5 ${editing ? 'bg-slate-100 text-[#1E293B]' : 'bg-white text-[#8B5CF6]'}`}
    >
      {editing ? 'Cancel' : 'Edit'}
    </button>
  </div>
);

const formatScore = (value) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const ScoreImpact = ({ oldScore, newScore, oldUncappedScore, newUncappedScore }) => {
  const delta = Number((newScore - oldScore).toFixed(1));
  const uncappedDelta = Number(((newUncappedScore ?? 0) - (oldUncappedScore ?? 0)).toFixed(1));
  const cappedButMoved = oldScore === 100 && newScore === 100 && Math.abs(uncappedDelta) >= 0.1;

  if (delta === 0 && !cappedButMoved) return null;

  return (
    <div className={`mt-6 p-4 rounded-xl border-2 border-[#1E293B] flex items-center justify-between font-bold text-[10px] uppercase tracking-widest ${delta > 0 ? 'bg-[#D1FAE5] text-emerald-700' : 'bg-[#FFFBEB] text-amber-700'}`}>
       <div className="flex flex-col gap-1">
         <span>Preview Score Impact</span>
         {cappedButMoved && (
           <span className="text-[9px] normal-case tracking-normal opacity-80">
             Capped at 100. Readiness moved {uncappedDelta > 0 ? '+' : ''}{uncappedDelta} pts underneath.
           </span>
         )}
       </div>
       <div className="flex items-center gap-3">
          <span className="opacity-40">{formatScore(oldScore)}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="bg-white border-2 border-[#1E293B] px-2 py-0.5 rounded-full shadow-[2px_2px_0_0_#1E293B]">
             {formatScore(newScore)} ({delta > 0 ? '+' : ''}{formatScore(delta)} pts)
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

  const parseNumericInput = (value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const normalized = value.replace(/[₹,\s]/g, '').trim();
    if (!normalized) return 0;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseIntegerInput = (value, fallback) => {
    const parsed = parseNumericInput(value);
    if (!Number.isFinite(parsed) || parsed === 0) return fallback;
    return Math.floor(parsed);
  };

  const normalizeRetirementMode = (source) => {
    if (Object.values(RETIREMENT_MODES).includes(source?.retirementMode)) {
      return source.retirementMode;
    }
    return inferRetirementMode(source);
  };

  const includesNpsForMode = (mode) => mode === RETIREMENT_MODES.NPS_ONLY || mode === RETIREMENT_MODES.HYBRID;
  const includesOtherForMode = (mode) => mode === RETIREMENT_MODES.NON_NPS_ONLY || mode === RETIREMENT_MODES.HYBRID;

  const toParsedData = (source) => {
    const retirementMode = normalizeRetirementMode(source);
    const includeNps = includesNpsForMode(retirementMode);
    const includeOther = includesOtherForMode(retirementMode);
    const assumptionValues = OTHER_SCHEME_CONFIGS.reduce((acc, scheme) => {
      acc[scheme.assumptionField] = normalizeAssumedReturnPct(source?.[scheme.assumptionField], scheme.annualReturn);
      return acc;
    }, {});

    return {
      ...source,
      retirementMode,
      age: parseIntegerInput(source.age, 28),
      monthlyIncome: parseNumericInput(source.monthlyIncome),
      npsUsage: includeNps ? (source.npsUsage || 'manual') : 'none',
      npsContribution: includeNps ? parseNumericInput(source.npsContribution) : 0,
      npsCorpus: includeNps ? parseNumericInput(source.npsCorpus) : 0,
      addSavings: includeOther,
      totalSavings: includeOther ? parseNumericInput(source.totalSavings) : 0,
      usesPPF: includeOther ? Boolean(source.usesPPF) : false,
      ppfMonthlyContribution: includeOther ? parseNumericInput(source.ppfMonthlyContribution) : 0,
      usesEPFVPF: includeOther ? Boolean(source.usesEPFVPF) : false,
      epfVpfMonthlyContribution: includeOther ? parseNumericInput(source.epfVpfMonthlyContribution) : 0,
      usesMFSIP: includeOther ? Boolean(source.usesMFSIP) : false,
      mfSipMonthlyContribution: includeOther ? parseNumericInput(source.mfSipMonthlyContribution) : 0,
      usesStocksETF: includeOther ? Boolean(source.usesStocksETF) : false,
      stocksEtfMonthlyContribution: includeOther ? parseNumericInput(source.stocksEtfMonthlyContribution) : 0,
      usesFDRD: includeOther ? Boolean(source.usesFDRD) : false,
      fdRdMonthlyContribution: includeOther ? parseNumericInput(source.fdRdMonthlyContribution) : 0,
      usesOtherScheme: includeOther ? Boolean(source.usesOtherScheme) : false,
      otherSchemeMonthlyContribution: includeOther ? parseNumericInput(source.otherSchemeMonthlyContribution) : 0,
      customSchemeAssumptionsEnabled: includeOther ? Boolean(source.customSchemeAssumptionsEnabled) : false,
      ...assumptionValues,
      retireAge: parseIntegerInput(source.retireAge, 60),
      stepUp: parseNumericInput(source.stepUp),
      npsEquity: parseNumericInput(source.npsEquity) || 50,
    };
  };

  const toggleEditSection = (sectionName) => {
    if (editingSection === sectionName) {
      setEditingSection(null);
      return;
    }

    setFormData(userData || {});
    setEditingSection(sectionName);
  };

  const showToast = (message, type = 'success', extra = null) => {
    setToast({ message, type, extra });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    try {
      const parsedData = toParsedData(formData);

      if (parsedData.monthlyIncome <= 0) {
        showToast('Monthly income must be a positive number.', 'red');
        return;
      }

      const includeNps = includesNpsForMode(parsedData.retirementMode);
      const includeOther = includesOtherForMode(parsedData.retirementMode);

      if (includeNps) {
        if (parsedData.npsContribution < 0) {
          showToast('NPS contribution cannot be negative.', 'red');
          return;
        }

        if (parsedData.npsContribution > parsedData.monthlyIncome) {
          showToast('NPS contribution cannot exceed monthly income.', 'red');
          return;
        }
      }

      if (includeOther && parsedData.totalSavings <= 0) {
        showToast('Add an approximate other-savings corpus for this mode.', 'red');
        return;
      }

      if (includeOther) {
        const missingSchemeContribution = OTHER_SCHEME_CONFIGS.find((scheme) => {
          if (!parsedData[scheme.toggleField]) return false;
          return !(parsedData[scheme.monthlyField] > 0);
        });

        if (missingSchemeContribution) {
          showToast(`Add monthly contribution for ${missingSchemeContribution.label}.`, 'red');
          return;
        }
      }

      const newResults = calculateRetirement(parsedData);
      const updatedData = { 
        ...parsedData, 
        ...newResults, 
        updatedAt: new Date().toISOString() 
      };
      
      const encrypted = await encryptUserData(updatedData, auth.currentUser.uid);
      await setDoc(doc(db, 'users', auth.currentUser.uid), encrypted, { merge: true });
      
      const oldScore = userData.score;
      const newScore = newResults.score;
      
      setUserData(updatedData);
      writeUserProfileCache(auth.currentUser.uid, updatedData);
      setEditingSection(null);
      
      if (newScore > oldScore) {
        showToast(`Your score improved from ${oldScore} to ${newScore}! 🎉`, 'emerald');
      } else if (newScore < oldScore) {
        showToast(`Your score dropped to ${newScore}. Check your biggest lever.`, 'pink');
      } else {
        showToast("Changes saved! Your dashboard has been updated.", 'amber');
      }
    } catch {
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
    } catch {
      showToast("Requires recent login to delete account.", 'red');
      setShowDeleteModal(false);
    }
  };

  if (!userData) return null;

  const parsedPreviewData = toParsedData(formData);
  const baseResults = calculateRetirement(userData);
  const simulatedResults = calculateRetirement(parsedPreviewData);
  const currentMode = normalizeRetirementMode(formData);
  const viewingMode = normalizeRetirementMode(userData);
  const showNpsInputs = includesNpsForMode(currentMode);
  const showOtherInputs = includesOtherForMode(currentMode);

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-8 max-w-4xl mx-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-24">
      {/* Section 1: Personal Info */}
      <div className={`relative bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow transition-all ${editingSection === 'personal' && 'ring-4 ring-[#8B5CF6]/10'}`}>
        <div className="w-1.5 absolute left-0 top-0 h-full bg-[#8B5CF6]" />
        <SectionHeader 
          icon={User} title="Personal Info" color="#8B5CF6"
          editing={editingSection === 'personal'} 
          onEdit={() => toggleEditSection('personal')} 
        />
        <div className="p-5 sm:p-8">
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
                        className={`touch-target py-3 rounded-full border-2 border-[#1E293B] font-black text-[10px] uppercase tracking-widest transition-all ${formData.workContext === s ? 'bg-[#8B5CF6] text-white shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
              </div>
              <ScoreImpact
                oldScore={baseResults.scorePrecise ?? baseResults.score}
                newScore={simulatedResults.scorePrecise ?? simulatedResults.score}
                oldUncappedScore={baseResults.uncappedScore}
                newUncappedScore={simulatedResults.uncappedScore}
              />
              <button 
                onClick={() => handleSave('personal')}
                className="touch-target w-full py-4 bg-[#8B5CF6] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
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
          icon={Wallet} title={viewingMode === RETIREMENT_MODES.NPS_ONLY ? 'Income & NPS Details' : 'Income & Retirement Savings'} color="#F472B6"
          editing={editingSection === 'income'} 
          onEdit={() => toggleEditSection('income')} 
        />
        <div className="p-5 sm:p-8">
          {editingSection === 'income' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retirement setup</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, retirementMode: RETIREMENT_MODES.NPS_ONLY, npsUsage: formData.npsUsage === 'none' ? 'manual' : (formData.npsUsage || 'manual') })}
                    className={`touch-target py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-[10px] transition-all ${currentMode === RETIREMENT_MODES.NPS_ONLY ? 'bg-[#8B5CF6] text-white shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}
                  >
                    NPS only
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, retirementMode: RETIREMENT_MODES.NON_NPS_ONLY, npsUsage: 'none' })}
                    className={`touch-target py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-[10px] transition-all ${currentMode === RETIREMENT_MODES.NON_NPS_ONLY ? 'bg-[#34D399] text-[#1E293B] shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}
                  >
                    Non-NPS only
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, retirementMode: RETIREMENT_MODES.HYBRID, npsUsage: formData.npsUsage === 'none' ? 'manual' : (formData.npsUsage || 'manual') })}
                    className={`touch-target py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-[10px] transition-all ${currentMode === RETIREMENT_MODES.HYBRID ? 'bg-[#FBBF24] text-[#1E293B] shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}
                  >
                    NPS + Other
                  </button>
                </div>
              </div>

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
                {showNpsInputs && (
                  <>
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
                  </>
                )}

                {showOtherInputs && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Other Savings Corpus (you can change later)</label>
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
                )}
              </div>

              {showNpsInputs && (
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
                          className={`touch-target py-3 rounded-full border-2 border-[#1E293B] font-black text-[10px] uppercase tracking-widest transition-all ${formData.npsEquity === eq ? 'bg-[#F472B6] text-white shadow-[3px_3px_0_0_#1E293B]' : eq > getMaxEquityPct(formData.age) ? 'opacity-20 cursor-not-allowed' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                        >
                          {eq}%
                        </button>
                      ))}
                    </div>
                </div>
              )}

              {showOtherInputs && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Other scheme monthly contributions</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {OTHER_SCHEME_CONFIGS.map((scheme) => (
                      <div key={scheme.id} className="border-2 border-[#1E293B]/10 rounded-2xl p-4 space-y-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, [scheme.toggleField]: !formData[scheme.toggleField] })}
                          className={`touch-target w-full py-2 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-[10px] transition-all ${formData[scheme.toggleField] ? 'bg-[#34D399] text-[#1E293B] shadow-[2px_2px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}
                        >
                          {scheme.label}
                        </button>
                        {formData[scheme.toggleField] && (
                          <div className="space-y-2">
                            <div className="relative">
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300">₹</span>
                              <input
                                type="number"
                                className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-10 py-3 font-bold text-sm outline-none"
                                value={formData[scheme.monthlyField]}
                                onChange={e => setFormData({...formData, [scheme.monthlyField]: e.target.value})}
                                placeholder="2,000"
                              />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E293B]/50">
                              Assumed return: {getSchemeAssumedReturnPct(parsedPreviewData, scheme)}% p.a.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#FFFDF5] border-2 border-[#1E293B] rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#1E293B]/50">Advanced Return Assumptions</div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E293B]/40">{SCHEME_ASSUMPTION_BASIS}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, customSchemeAssumptionsEnabled: !formData.customSchemeAssumptionsEnabled })}
                        className={`touch-target px-4 py-2 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-[10px] transition-all ${formData.customSchemeAssumptionsEnabled ? 'bg-[#34D399] text-[#1E293B] shadow-[2px_2px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}
                      >
                        {formData.customSchemeAssumptionsEnabled ? 'Custom ON' : 'Use Defaults'}
                      </button>
                    </div>

                    {formData.customSchemeAssumptionsEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {OTHER_SCHEME_CONFIGS.filter((scheme) => formData[scheme.toggleField]).map((scheme) => (
                          <div key={`${scheme.id}-assumption`} className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{scheme.label} Return Assumption</label>
                            <div className="relative">
                              <input
                                type="number"
                                min={ASSUMED_RETURN_MIN_PCT}
                                max={ASSUMED_RETURN_MAX_PCT}
                                step="0.1"
                                className="w-full bg-white border-2 border-[#1E293B] rounded-full px-4 py-2.5 pr-10 font-bold text-sm outline-none"
                                value={formData[scheme.assumptionField]}
                                onChange={e => setFormData({ ...formData, [scheme.assumptionField]: e.target.value })}
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                            </div>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-[#1E293B]/45">{scheme.assumptionLabel}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E293B]/45">
                      Allowed range: {ASSUMED_RETURN_MIN_PCT}% to {ASSUMED_RETURN_MAX_PCT}% annualized.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-[#FFFDF5] border-2 border-[#1E293B] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">NPS Corpus</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(simulatedResults.npsCorpusUsed)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Other Savings</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(simulatedResults.otherSavingsUsed)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Combined Savings</div>
                  <div className="font-bold text-[#8B5CF6]">{formatIndian(simulatedResults.combinedSavingsUsed)}</div>
                </div>
              </div>

              <ScoreImpact
                oldScore={baseResults.scorePrecise ?? baseResults.score}
                newScore={simulatedResults.scorePrecise ?? simulatedResults.score}
                oldUncappedScore={baseResults.uncappedScore}
                newUncappedScore={simulatedResults.uncappedScore}
              />
              <button 
                onClick={() => handleSave('income')}
                className="touch-target w-full py-4 bg-[#F472B6] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
              >
                Update Retirement Inputs
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Mode</div>
                  <div className="font-bold text-[#1E293B] uppercase text-[10px] tracking-widest">{viewingMode.replaceAll('_', ' ')}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Income</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(userData.monthlyIncome)}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">NPS Corpus</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(baseResults.npsCorpusUsed)}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Other Savings</div>
                  <div className="font-bold text-[#1E293B]">{formatIndian(baseResults.otherSavingsUsed)}</div>
              </div>
              <div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Combined Savings</div>
                  <div className="font-bold text-[#8B5CF6]">{formatIndian(baseResults.combinedSavingsUsed)}</div>
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
          onEdit={() => toggleEditSection('retirement')} 
        />
        <div className="p-5 sm:p-8">
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
                          className={`touch-target p-4 rounded-xl border-2 border-[#1E293B] text-left transition-all ${formData.lifestyle === l ? 'bg-[#FFFDF5] border-[#FBBF24] shadow-[4px_4px_0_0_#FBBF24] -translate-y-1' : 'bg-white opacity-50'}`}
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
                className="touch-target w-full py-4 bg-[#FBBF24] text-[#1E293B] border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
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
          onEdit={() => toggleEditSection('tax')} 
        />
        <div className="p-5 sm:p-8">
          {editingSection === 'tax' ? (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setFormData({...formData, taxRegime: 'new'})}
                    className={`touch-target p-4 rounded-xl border-2 border-[#1E293B] text-left ${formData.taxRegime === 'new' ? 'bg-[#D1FAE5] border-[#34D399] shadow-[3px_3px_0_0_#34D399]' : 'bg-white opacity-40'}`}
                  >
                      <div className="font-black text-xs uppercase tracking-widest flex items-center gap-1">New Regime <InfoTooltip text={SETTINGS_TIPS.taxRegime} size={12} /></div>
                      <div className="text-[9px] font-bold text-slate-500 mt-1">Budget 2025 Standard</div>
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, taxRegime: 'old'})}
                    className={`touch-target p-4 rounded-xl border-2 border-[#1E293B] text-left ${formData.taxRegime === 'old' ? 'bg-[#D1FAE5] border-[#34D399] shadow-[3px_3px_0_0_#34D399]' : 'bg-white opacity-40'}`}
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
                className="touch-target w-full py-4 bg-emerald-500 text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
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
      <div className="bg-white border-2 border-[#1E293B] rounded-[24px] overflow-hidden pop-shadow">
        <div className="p-5 sm:p-8 space-y-4">
          <h3 className="font-heading font-black text-lg text-[#1E293B] uppercase tracking-widest flex items-center gap-2">
            <Bot className="w-5 h-5" /> AI Preferences
          </h3>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 border-b border-[#E2E8F0]">
            <div>
              <p className="font-heading font-bold text-[0.95rem] text-[#1E293B] mb-0.5">AI Data Mode</p>
              <p className="text-[0.8rem] text-[#64748B] font-['Plus_Jakarta_Sans']">
                {userData.aiPrivacyMode === 'full'
                  ? '⚡ Full Mode — Groq receives your complete financial profile'
                  : '🔒 Privacy Mode — Groq sees only computed insights'}
              </p>
            </div>
            <button
              onClick={async () => {
                const newMode = userData.aiPrivacyMode === 'full' ? 'privacy' : 'full';
                await setDoc(doc(db, 'users', auth.currentUser.uid), { aiPrivacyMode: newMode }, { merge: true });
                const nextUserData = { ...userData, aiPrivacyMode: newMode };
                setUserData(nextUserData);
                writeUserProfileCache(auth.currentUser.uid, nextUserData);
                showToast(`AI mode switched to ${newMode === 'full' ? 'Full' : 'Privacy'} mode.`, 'amber');
              }}
              className="touch-target text-white border-2 border-[#1E293B] rounded-full px-4 py-2 font-['Plus_Jakarta_Sans'] font-bold text-[0.75rem] uppercase tracking-[0.06em] shadow-[3px_3px_0_#1E293B]"
              style={{ background: userData.aiPrivacyMode === 'full' ? '#F472B6' : '#8B5CF6' }}
            >
              Switch to {userData.aiPrivacyMode === 'full' ? 'Privacy' : 'Full'} Mode
            </button>
          </div>
        </div>
      </div>

      {/* Section 6: Account Actions */}
      <div className="bg-slate-50 border-2 border-[#1E293B]/10 rounded-[24px] overflow-hidden">
          <div className="p-5 sm:p-8 space-y-4">
            <h3 className="font-heading font-black text-lg text-[#1E293B] uppercase tracking-widest flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> Account Actions
            </h3>
            
            <div className="flex flex-wrap gap-4">
                <button 
                onClick={exportData}
                className="touch-target px-6 py-3 bg-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-[10px] pop-shadow flex items-center gap-2 hover:-translate-y-0.5 transition-all"
                >
                  <Download className="w-4 h-4" /> Export My Data (.json)
                </button>
                
                <button 
                onClick={() => setShowDeleteModal(true)}
                className="touch-target px-6 py-3 bg-white border-2 border-[#EF4444] text-[#EF4444] rounded-full font-black uppercase tracking-widest text-[10px] shadow-[4px_4px_0_0_#EF4444] flex items-center gap-2 hover:-translate-y-0.5 transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Permanently Delete My Account
                </button>
            </div>
          </div>
      </div>

      {/* Section 7: About */}
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
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-12 left-1/2 -translate-x-1/2 z-50 animate-slide-up px-3 w-full max-w-xl">
          <div className={`border-2 border-[#1E293B] px-8 py-4 rounded-full font-black text-xs uppercase tracking-[3px] shadow-[6px_6px_0_0_#1E293B] flex items-center gap-4 transition-colors`} style={{ backgroundColor: toast.type === 'red' ? '#EF4444' : toast.type === 'amber' ? '#FBBF24' : toast.type === 'emerald' ? '#34D399' : userData.score > simulatedResults.score ? '#F472B6' : '#FFFDF5' }}>
              {toast.type === 'red' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              {toast.message}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-[#1E293B]/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white border-2 border-[#1E293B] rounded-[24px] sm:rounded-[32px] p-5 sm:p-10 max-w-lg w-full pop-shadow-vivid relative animate-scale-up max-h-[90dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <button onClick={() => setShowDeleteModal(false)} className="touch-target absolute top-4 sm:top-6 right-4 sm:right-6 p-2 text-slate-300 hover:text-slate-900"><X /></button>
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
                  className="touch-target py-4 rounded-full border-2 border-[#1E293B] font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                  >
                    No, Keep It
                  </button>
                  <button 
                  onClick={deleteAccount}
                  className="touch-target py-4 bg-[#EF4444] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1 transition-all"
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
