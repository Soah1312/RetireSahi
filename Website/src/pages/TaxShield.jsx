// src/pages/TaxShield.jsx
// ─────────────────────────────────────────────────────────────────────────────
// RetireSahi · TaxShield  —  Full page component
// Wrapped in DashboardLayout to integrate with the existing sidebar/nav.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useContext, useMemo, useEffect } from 'react';
import { computeTaxSavings, computeTaxWhatIf } from '../utils/taxShieldMath';
import { UserContext } from '../components/UserContext';
import DashboardLayout from '../components/DashboardLayout';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { encryptUserData } from '../utils/encryption';
import { writeUserProfileCache } from '../lib/userProfileCache';

// ─── lucide icons ─────────────────────────────────────────────────────────────
import {
  ShieldCheck, TrendingDown, AlertTriangle, Zap, ChevronRight,
  IndianRupee, BarChart3, Target, Info,
  CheckCircle2, Lightbulb, RefreshCw, Flame,
} from 'lucide-react';

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  emerald: '#34D399',
  slate: '#1E293B',
};

// ─── DATA MAPPER ──────────────────────────────────────────────────────────────
// Maps UserContext field names → taxShieldMath expected field names
function mapUserDataToTaxInput(userData) {
  if (!userData) return {};
  const monthlyIncome = Math.max(0, Number(userData.monthlyIncome) || 0);
  const basicPct = Number(userData.basicSalaryPct) || 0.4;

  return {
    // Income
    grossIncome:          monthlyIncome * 12,
    annualIncome:         monthlyIncome * 12,
    basicSalary:          monthlyIncome * 12 * basicPct,

    // NPS
    npsSelfMonthly:       Math.max(0, Number(userData.npsContribution) || 0),
    npsEmployerMonthly:   userData.hasOptedForEmployerNPS
      ? Math.round(monthlyIncome * basicPct * 0.10)
      : 0,

    // Other investments mapped to 80C instruments
    epfMonthly:           Math.max(0, Number(userData.epfVpfMonthlyContribution) || 0),
    elssMonthly:          Math.max(0, Number(userData.mfSipMonthlyContribution) || 0),
    ppfMonthly:           Math.max(0, Number(userData.ppfMonthlyContribution) || 0),
    licPremium:           Math.max(0, Number(userData.lifeInsurance_80C) || 0),

    // Insurance & loans
    healthInsuranceSelf:    Math.max(0, Number(userData.medicalInsurance_80D) || 0),
    healthInsuranceParents: 0,
    homeLoanInterest:       Math.max(0, Number(userData.homeLoanInterest) || 0),
    homeLoanPrincipal:      0,

    // HRA
    hraReceived:          Math.max(0, Number(userData.houseRentAllowance_HRA) || 0),
    rentPaid:             Math.max(0, Number(userData.actualRentPaid) || 0),
    isMetroCity:          false,

    // Profile
    age:                  parseInt(userData.age) || 30,
    isGovtEmployee:       userData.workContext === 'Government',

    // LTA
    ltaDeclared:          Math.max(0, Number(userData.leaveTravelAllowance_LTA) || 0),
    ltaEntitled:          Math.max(0, Number(userData.leaveTravelAllowance_LTA) || 0),
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const inr = (n) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n ?? 0);

const pct = (n) => `${(n ?? 0).toFixed(1)}%`;

function Badge({ children, color = 'emerald' }) {
  const map = {
    emerald: { bg: COLORS.emerald, text: '#065F46' },
    amber:   { bg: COLORS.amber,   text: '#92400E' },
    red:     { bg: '#EF4444',      text: '#7F1D1D' },
    blue:    { bg: '#3B82F6',      text: '#1E3A5F' },
    violet:  { bg: COLORS.violet,  text: 'white' },
  };
  const c = map[color] || map.emerald;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-black px-3 py-1 rounded-full border-2 border-[#1E293B] uppercase tracking-widest"
      style={{ backgroundColor: `${c.bg}33`, color: c.text }}
    >
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent = COLORS.emerald }) {
  return (
    <div className="bg-white border-2 border-[#1E293B] rounded-[16px] p-5 pop-shadow hover:-translate-y-1 transition-all flex flex-col gap-3 group">
      <div className="flex justify-between items-start">
        <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[#1E293B]/40">{label}</div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B] group-hover:shadow-[3px_3px_0_0_#1E293B] transition-all"
          style={{ backgroundColor: `${accent}22` }}
        >
          <Icon size={18} strokeWidth={2.5} style={{ color: accent }} />
        </div>
      </div>
      <div className="font-heading font-extrabold text-2xl md:text-3xl text-[#1E293B]">{value}</div>
      {sub && <div className="text-[9px] font-bold text-[#1E293B]/50 uppercase tracking-widest">{sub}</div>}
    </div>
  );
}

// ─── REGIME COMPARISON CARD ───────────────────────────────────────────────────

function RegimeCard({ label, data, recommended }) {
  const isRec = recommended === (label === 'Old Regime' ? 'OLD' : 'NEW');
  const accentColor = isRec ? COLORS.emerald : '#94A3B8';
  return (
    <div
      className={`relative bg-white border-2 border-[#1E293B] rounded-[20px] p-6 transition-all ${
        isRec
          ? 'pop-shadow -translate-y-1'
          : 'shadow-[2px_2px_0_0_#CBD5E1]'
      }`}
    >
      {isRec && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#34D399] text-[#1E293B] text-[9px] font-black px-4 py-1 rounded-full flex items-center gap-1.5 border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B] uppercase tracking-widest">
            <CheckCircle2 size={10} strokeWidth={3} /> RECOMMENDED
          </span>
        </div>
      )}

      <h3 className="font-heading font-extrabold text-lg mb-5 uppercase tracking-widest" style={{ color: isRec ? COLORS.emerald : '#64748B' }}>
        {label}
      </h3>

      <div className="space-y-3">
        {[
          { l: 'Gross Income',       v: inr(data.grossIncome) },
          { l: 'Total Deductions',   v: inr(data.totalDeductions),  highlight: true },
          { l: 'Taxable Income',     v: inr(data.taxableIncome) },
          { l: 'Rebate 87A',         v: data.rebate87A > 0 ? `-${inr(data.rebate87A)}` : '—', green: data.rebate87A > 0 },
          { l: 'Total Tax + Cess',   v: inr(data.totalTax),          red: true },
          { l: 'Effective Tax Rate', v: pct(data.effectiveRate) },
          { l: 'Annual Take-Home',   v: inr(data.takeHome),          bold: true },
        ].map(({ l, v, highlight, red, green, bold }) => (
          <div key={l} className={`flex justify-between text-sm ${highlight ? 'bg-[#FBBF24]/10 -mx-2 px-2 py-1.5 rounded-xl border border-[#1E293B]/10' : ''}`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1E293B]/40">{l}</span>
            <span className={`font-bold ${red ? 'text-[#EF4444]' : green ? 'text-[#34D399]' : bold ? 'text-[#1E293B] text-base font-extrabold' : 'text-[#1E293B]'}`}>
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DEDUCTION BAR ────────────────────────────────────────────────────────────

function DeductionBar({ label, oldVal, newVal }) {
  const maxVal = Math.max(oldVal, newVal, 1);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#1E293B]/40">
        <span>{label}</span>
        <span className="text-[#1E293B] font-extrabold">{oldVal > 0 ? inr(oldVal) : '—'} / {newVal > 0 ? inr(newVal) : '—'}</span>
      </div>
      <div className="flex gap-1.5 h-3">
        <div
          className="h-full rounded-full border border-[#1E293B]/20 transition-all"
          style={{ width: `${(oldVal / maxVal) * 100}%`, minWidth: oldVal > 0 ? 6 : 0, backgroundColor: COLORS.violet }}
        />
        <div
          className="h-full rounded-full border border-[#1E293B]/20 transition-all"
          style={{ width: `${(newVal / maxVal) * 100}%`, minWidth: newVal > 0 ? 6 : 0, backgroundColor: COLORS.pink }}
        />
      </div>
    </div>
  );
}


// ─── WHAT-IF SCENARIO CARD ───────────────────────────────────────────────────

function WhatIfCard({ scenario }) {
  return (
    <div className="bg-white border-2 border-[#1E293B] rounded-[16px] p-5 pop-shadow hover:-translate-y-1 hover:rotate-[-1deg] transition-all group cursor-pointer">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#1E293B] bg-[#FBBF24]/20 flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]">
          <Lightbulb size={14} className="text-[#FBBF24]" strokeWidth={2.5} />
        </div>
        <p className="font-heading font-extrabold text-sm text-[#1E293B] group-hover:text-[#8B5CF6] transition-colors">{scenario.title}</p>
      </div>
      <p className="text-[10px] font-bold text-[#1E293B]/50 uppercase tracking-wide mb-4">{scenario.description}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black text-[#1E293B]/30 uppercase tracking-widest">Annual Tax Saving</p>
          <p className="font-heading font-extrabold text-xl text-[#34D399]">{inr(scenario.delta)}</p>
        </div>
        <span className="text-[9px] font-black text-[#1E293B] bg-[#FBBF24] px-3 py-1.5 rounded-full border-2 border-[#1E293B] shadow-[2px_2px_0_0_#1E293B] uppercase tracking-widest">
          +{inr(scenario.monthlyChange)}/mo
        </span>
      </div>
    </div>
  );
}

// ─── INPUT PANEL (MINI FORM) ──────────────────────────────────────────────────

const FIELD_GROUPS = [
  {
    title: 'Income',
    fields: [
      { key: 'monthlyIncome',         label: 'Gross Monthly Income',     prefix: '₹' },
      { key: 'basicSalaryPct',      label: 'Basic Salary fraction (e.g. 0.4)',   prefix: '' },
      { key: 'houseRentAllowance_HRA',         label: 'HRA Received (Annual)',   prefix: '₹' },
      { key: 'actualRentPaid',            label: 'Rent Paid (Annual)',      prefix: '₹' },
    ],
  },
  {
    title: 'Investments & Deductions',
    fields: [
      { key: 'epfVpfMonthlyContribution',          label: 'EPF/VPF (Monthly)',           prefix: '₹' },
      { key: 'mfSipMonthlyContribution',         label: 'ELSS SIP (Monthly)',      prefix: '₹' },
      { key: 'ppfMonthlyContribution',          label: 'PPF (Monthly)',           prefix: '₹' },
      { key: 'npsContribution',      label: 'NPS Self (Monthly)',      prefix: '₹' },
      { key: 'lifeInsurance_80C',          label: 'LIC Premium (Annual)',    prefix: '₹' },
    ],
  },
  {
    title: 'Insurance & Loans',
    fields: [
      { key: 'medicalInsurance_80D',    label: 'Health Ins. Self (Annual)',    prefix: '₹' },
      { key: 'homeLoanInterest',       label: 'Home Loan Interest (Annual)',  prefix: '₹' },
    ],
  },
];

function InputPanel({ values, onChange }) {
  return (
    <div className="space-y-8">
      {FIELD_GROUPS.map(grp => (
        <div key={grp.title}>
          <h4 className="text-[10px] font-black text-[#1E293B]/40 uppercase tracking-widest mb-4">{grp.title}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {grp.fields.map(({ key, label, prefix }) => (
              <div key={key} className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
                <div className="relative">
                  {prefix && (
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300">{prefix}</span>
                  )}
                  <input
                    type="number"
                    value={values[key] || ''}
                    onChange={e => onChange(key, Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-10 py-3 font-bold text-sm outline-none focus:border-[#8B5CF6] transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div>
        <h4 className="text-[10px] font-black text-[#1E293B]/40 uppercase tracking-widest mb-4">Profile</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Age</label>
            <input
              type="number"
              value={values.age || ''}
              onChange={e => onChange('age', Number(e.target.value))}
              placeholder="30"
              className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-5 py-3 font-bold text-sm outline-none focus:border-[#8B5CF6] transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">City Type</label>
            <select
              value={values.isMetroCity ? 'metro' : 'non-metro'}
              onChange={e => onChange('isMetroCity', e.target.value === 'metro')}
              className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full px-5 py-3 font-bold text-sm outline-none focus:border-[#8B5CF6] transition-colors"
            >
              <option value="metro">Metro City</option>
              <option value="non-metro">Non-Metro</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',      Icon: ShieldCheck   },
  { id: 'comparison',  label: 'Regime Compare', Icon: BarChart3    },
  { id: 'whatif',      label: 'What-If',        Icon: Zap          },
  { id: 'inputs',      label: 'Edit Inputs',   Icon: RefreshCw     },
];

// ─── REGIME FEATURES TABLE ────────────────────────────────────────────────────

function RegimeFeaturesTable() {
  const features = [
    { label: 'Standard Deduction', old: '₹50,000', new: '₹75,000', winner: 'new' },
    { label: '80C (PPF/LIC/ELSS)', old: 'Up to ₹1.5L', new: 'None', winner: 'old' },
    { label: '80D (Health Insurance)', old: 'Yes', new: 'None', winner: 'old' },
    { label: 'NPS Self (80CCD 1B)', old: '₹50,000 extra', new: 'None', winner: 'old' },
    { label: 'NPS Employer (80CCD 2)', old: '10% (Private only)', new: '14% (All employers)', winner: 'new' },
    { label: 'Home Loan Interest', old: 'Up to ₹2L', new: 'None', winner: 'old' },
    { label: 'Tax-Free Limit', old: '~₹5–5.5L (with 87A)', new: 'Up to ₹12.75L (with SD)', winner: 'new' },
  ];

  return (
    <div className="bg-white border-2 border-[#1E293B] rounded-[24px] pop-shadow p-5 sm:p-6 overflow-hidden mt-8 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full border-2 border-[#1E293B] bg-[#FBBF24]/20 flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]">
          <BarChart3 size={18} className="text-[#FBBF24]" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="font-heading font-extrabold text-[#1E293B] uppercase tracking-widest">Feature Comparison</h3>
        </div>
      </div>

      <div className="border-2 border-[#1E293B] rounded-[16px] overflow-hidden mb-6">
        <div className="grid grid-cols-3 bg-[#FFFDF5] border-b-2 border-[#1E293B]">
          <div className="p-3 sm:p-4 font-black text-[10px] sm:text-xs text-[#1E293B] uppercase tracking-widest border-r-2 border-[#1E293B]">Feature</div>
          <div className="p-3 sm:p-4 font-black text-[10px] sm:text-xs text-[#1E293B] uppercase tracking-widest border-r-2 border-[#1E293B] text-center">Old Regime</div>
          <div className="p-3 sm:p-4 font-black text-[10px] sm:text-xs text-[#1E293B] uppercase tracking-widest flex justify-center items-center gap-2">
            New Regime <Badge color="violet">2026</Badge>
          </div>
        </div>
        
        {features.map((f, idx) => (
          <div key={f.label} className={`grid grid-cols-3 border-b-2 border-[#1E293B] last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
            <div className="p-3 sm:p-4 text-[10px] sm:text-xs font-bold text-[#1E293B]/70 uppercase tracking-widest border-r-2 border-[#1E293B] flex items-center">
              {f.label}
            </div>
            <div className={`p-3 sm:p-4 text-xs sm:text-sm font-extrabold border-r-2 border-[#1E293B] text-center flex items-center justify-center ${f.winner === 'old' ? 'text-[#34D399] bg-[#34D399]/10' : 'text-[#1E293B]/40'}`}>
              {f.old}
            </div>
            <div className={`p-3 sm:p-4 text-xs sm:text-sm font-extrabold text-center flex items-center justify-center ${f.winner === 'new' ? 'text-[#34D399] bg-[#34D399]/10' : 'text-[#1E293B]/40'}`}>
              {f.new}
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-[#8B5CF6]/10 border-2 border-[#1E293B] rounded-xl p-4 flex items-start gap-4">
        <Info size={20} className="text-[#8B5CF6] mt-0.5 flex-shrink-0" strokeWidth={2.5} />
        <div>
          <p className="font-heading font-extrabold text-[#1E293B] text-sm mb-1 uppercase tracking-widest">Summary Callout</p>
          <p className="text-[10px] sm:text-xs font-bold text-[#1E293B]/70 uppercase tracking-widest leading-relaxed">
            <span className="text-[#8B5CF6] font-black">Old Regime</span> suits those with heavy investments. <span className="text-[#F472B6] font-black">New Regime</span> suits salaried individuals with fewer deductions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE CONTENT ─────────────────────────────────────────────────────────────

function TaxShieldContent() {
  const { userData, setUserData } = useContext(UserContext) ?? {};
  const [tab, setTab]       = useState('overview');
  
  const [formData, setFormData] = useState(userData || {});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userData && Object.keys(formData).length === 0) setFormData(userData);
  }, [userData]);

  const mappedData = useMemo(() => mapUserDataToTaxInput(formData), [formData]);
  const result   = useMemo(() => computeTaxSavings(mappedData), [mappedData]);
  const whatIf   = useMemo(() => computeTaxWhatIf(mappedData),  [mappedData]);

  const handleChange = (key, val) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!auth?.currentUser) return;
    setIsSaving(true);
    try {
      const updatedData = { ...formData, updatedAt: new Date().toISOString() };
      const encrypted = await encryptUserData(updatedData, auth.currentUser.uid);
      await setDoc(doc(db, 'users', auth.currentUser.uid), encrypted, { merge: true });
      setUserData(updatedData);
      writeUserProfileCache(auth.currentUser.uid, updatedData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const saving      = result.annualTaxSaving;
  const recommended = result.recommendedRegime;
  const chosen      = result[recommended === 'OLD' ? 'old' : 'new'];

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-8 md:space-y-10 max-w-6xl mx-auto w-full pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-24">

      {/* ── KPI STRIP ──────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#1E293B] bg-[#34D399]/15 flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]">
            <ShieldCheck size={20} className="text-[#34D399]" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-xl md:text-2xl uppercase tracking-widest">Tax Shield</h2>
            <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest">FY 2025-26 · AY 2026-27</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'You Can Save',
              value: inr(saving),
              sub: 'vs current regime',
              color: saving > 0 ? COLORS.emerald : '#EF4444',
            },
            {
              label: 'Best Regime',
              value: recommended === 'OLD' ? 'Old Regime' : 'New Regime',
              sub: 'recommended for you',
              color: COLORS.violet,
            },
            {
              label: 'Effective Tax Rate',
              value: pct(chosen.effectiveRate),
              sub: 'on gross income',
              color: COLORS.amber,
            },
            {
              label: 'Tax Leakages',
              value: String(result.leakages.length),
              sub: 'opportunities found',
              color: result.leakages.length > 0 ? COLORS.pink : COLORS.emerald,
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white border-2 border-[#1E293B] rounded-[16px] p-4 pop-shadow hover:-translate-y-1 transition-all group">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#1E293B]/40 mb-2">{label}</p>
              <p className="font-heading font-extrabold text-lg sm:text-xl" style={{ color }}>{value}</p>
              <p className="text-[9px] font-bold text-[#1E293B]/40 uppercase tracking-widest mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TAB NAV ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 no-scrollbar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black whitespace-nowrap transition-all uppercase tracking-widest border-2 border-transparent cursor-pointer ${
              tab === id
                ? 'bg-[#8B5CF6] text-white border-[#1E293B] pop-shadow'
                : 'text-[#1E293B]/40 hover:bg-[#FBBF24] hover:text-[#1E293B] hover:border-[#1E293B]'
            }`}
          >
            <Icon size={14} strokeWidth={2.5} />
            {label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}

      {/* ═══ OVERVIEW ════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-8">
          {/* Top stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
            <StatCard
              icon={IndianRupee}
              label="Annual Tax (Best)"
              value={inr(chosen.totalTax)}
              sub="incl. cess & surcharge"
              accent="#EF4444"
            />
            <StatCard
              icon={TrendingDown}
              label="Tax You Can Save"
              value={inr(saving)}
              sub={`${inr(result.monthlySaving)}/month`}
              accent={COLORS.emerald}
            />
            <StatCard
              icon={Target}
              label="NPS Tax Benefit"
              value={inr(result.nps.taxBenefit)}
              sub="via 80CCD(1B)"
              accent={COLORS.violet}
            />
            <StatCard
              icon={BarChart3}
              label="Total Deductions"
              value={inr(chosen.totalDeductions)}
              sub={`${recommended} regime`}
              accent={COLORS.amber}
            />
          </div>

          {/* Recommended regime banner */}
          <div
            className={`bg-white border-2 border-[#1E293B] rounded-[20px] p-6 pop-shadow flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4`}
          >
            <div className="w-12 h-12 rounded-full border-2 border-[#1E293B] flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]"
              style={{ backgroundColor: `${recommended === 'OLD' ? COLORS.violet : COLORS.emerald}22` }}
            >
              <CheckCircle2 size={24} strokeWidth={2.5} style={{ color: recommended === 'OLD' ? COLORS.violet : COLORS.emerald }} />
            </div>
            <div className="flex-1">
              <p className="font-heading font-extrabold text-[#1E293B] text-lg">
                {recommended === 'OLD' ? 'Old Regime' : 'New Regime'} is better for you
              </p>
              <p className="text-[10px] font-bold text-[#1E293B]/50 uppercase tracking-widest mt-1">
                You save <strong className="text-[#1E293B]">{inr(saving)}</strong> more per year
                {saving > 0 && ` — that's ${inr(result.monthlySaving)}/month back in your pocket.`}
              </p>
            </div>
            <Badge color={recommended === 'OLD' ? 'violet' : 'emerald'}>
              {recommended === 'OLD' ? 'Old Regime' : 'New Regime'}
            </Badge>
          </div>

          {/* NPS breakdown */}
          <div className="bg-white border-2 border-[#1E293B] rounded-[24px] pop-shadow p-5 sm:p-6 relative overflow-hidden">
            <div className="w-1.5 absolute left-0 top-0 h-full bg-[#8B5CF6]" />
            <h3 className="font-heading font-extrabold text-[#1E293B] mb-5 flex items-center gap-3 ml-2">
              <Target size={18} className="text-[#8B5CF6]" strokeWidth={2.5} /> NPS Tax Benefits
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
              {[
                { label: 'Annual Contribution', value: inr(result.nps.annualContribution) },
                { label: '80CCD(1B) Claimed',   value: inr(result.nps.deductionClaimed) },
                { label: 'Tax Saved via NPS',   value: inr(result.nps.taxBenefit), color: COLORS.emerald },
                { label: 'Remaining 80CCD Gap', value: inr(result.nps.unutilised1B), color: result.nps.unutilised1B > 0 ? '#EF4444' : undefined },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#FFFDF5] border-2 border-[#1E293B]/10 rounded-xl p-3">
                  <p className="text-[9px] font-black text-[#1E293B]/40 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-base sm:text-lg font-extrabold" style={{ color: color || '#1E293B' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {result.nps.unutilised1B > 0 && (
              <div className="mt-5 p-4 bg-[#FBBF24]/15 border-2 border-[#1E293B] rounded-xl flex items-start gap-3">
                <AlertTriangle size={16} className="text-[#FBBF24] mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                <p className="text-[10px] font-bold text-[#1E293B]/70 uppercase tracking-wide">
                  You have <strong className="text-[#1E293B]">{inr(result.nps.unutilised1B)}</strong> of 80CCD(1B) deduction unused.
                  Increasing your NPS Tier-I SIP by <strong className="text-[#1E293B]">{inr(Math.ceil(result.nps.unutilised1B / 12))}/month</strong> could
                  save you an additional <strong className="text-[#1E293B]">{inr(Math.round(result.nps.unutilised1B * 0.30 * 1.04))}</strong> in tax.
                </p>
              </div>
            )}
          </div>


        </div>
      )}

      {/* ═══ REGIME COMPARISON ═══════════════════════════════════════════════ */}
      {tab === 'comparison' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <RegimeCard label="Old Regime" data={result.old} recommended={recommended} />
            <RegimeCard label="New Regime" data={result.new} recommended={recommended} />
          </div>

          {/* Deduction breakdown */}
          <div className="bg-white border-2 border-[#1E293B] rounded-[24px] pop-shadow p-5 sm:p-6 relative overflow-hidden">
            <div className="w-1.5 absolute left-0 top-0 h-full bg-[#F472B6]" />
            <div className="flex items-center justify-between mb-6 ml-2">
              <h3 className="font-heading font-extrabold text-[#1E293B] uppercase tracking-widest">Deduction Breakdown</h3>
              <div className="flex items-center gap-4 text-[9px] font-black text-[#1E293B]/40 uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.violet }} /> Old</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.pink }} /> New</span>
              </div>
            </div>
            <div className="space-y-5">
              {result.deductionBreakdown.map(d => (
                <DeductionBar key={d.label} label={d.label} oldVal={d.old} newVal={d.new} />
              ))}
            </div>
          </div>

          {/* Feature Comparison Table */}
          <RegimeFeaturesTable />

          {/* Verdict */}
          <div className="bg-[#34D399] border-2 border-[#1E293B] rounded-[20px] p-6 pop-shadow text-[#1E293B]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#065F46] mb-2">Verdict</p>
            <p className="font-heading font-extrabold text-xl sm:text-2xl mb-2">
              {recommended === 'OLD' ? 'Old Regime' : 'New Regime'} saves you {inr(saving)}/year
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#065F46]">
              Old regime total tax: <strong className="text-[#1E293B]">{inr(result.old.totalTax)}</strong> ·
              New regime total tax: <strong className="text-[#1E293B]">{inr(result.new.totalTax)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ═══ LEAKAGES ════════════════════════════════════════════════════════ */}
      {tab === 'leakages' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#EF4444]/15 border-2 border-[#1E293B] flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]">
              <AlertTriangle size={18} className="text-[#EF4444]" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-[#1E293B] uppercase tracking-widest">Tax Leakage Analysis</h3>
              <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest">Opportunities to reduce your tax outgo</p>
            </div>
          </div>
          {result.leakages.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-[#34D399]" strokeWidth={2} />
              <p className="font-heading font-extrabold text-xl text-[#1E293B]">No leakages detected!</p>
              <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest mt-2">Your tax optimisation looks great.</p>
            </div>
          ) : (
            result.leakages.map(l => <LeakageCard key={l.id} leakage={l} />)
          )}
        </div>
      )}

      {/* ═══ WHAT-IF ═════════════════════════════════════════════════════════ */}
      {tab === 'whatif' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#FBBF24]/20 border-2 border-[#1E293B] flex items-center justify-center shadow-[2px_2px_0_0_#1E293B]">
              <Zap size={18} className="text-[#FBBF24]" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-[#1E293B] uppercase tracking-widest">What-If Scenarios</h3>
              <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest">How small changes can dramatically lower your tax</p>
            </div>
          </div>
          {whatIf.length === 0 ? (
            <div className="text-center py-16">
              <Zap size={48} className="mx-auto mb-4 text-[#FBBF24]" strokeWidth={2} />
              <p className="font-heading font-extrabold text-xl text-[#1E293B]">All optimisations maxed!</p>
              <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest mt-2">You{"'"}re using your deductions very efficiently.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {whatIf.map(s => <WhatIfCard key={s.id} scenario={s} />)}
            </div>
          )}

          <div className="bg-[#FFFDF5] border-2 border-[#1E293B] rounded-xl p-4 text-[10px] font-bold text-[#1E293B]/50 uppercase tracking-wide">
            <strong className="text-[#1E293B]">Note:</strong> Projections assume 8% annual salary growth and 12% CAGR on re-invested savings.
            Scenarios model only income tax — consult a CA for personalised advice.
          </div>
        </div>
      )}


      {/* ═══ INPUTS ══════════════════════════════════════════════════════════ */}
      {tab === 'inputs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-heading font-extrabold text-[#1E293B] uppercase tracking-widest">Edit Financial Details</h3>
              <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase tracking-widest">Changes are saved to your profile to ensure consistency across the app</p>
            </div>
            <button
              onClick={() => setFormData(userData || {})}
              className="text-[10px] font-black text-[#8B5CF6] flex items-center gap-1.5 hover:gap-2.5 transition-all cursor-pointer uppercase tracking-widest"
            >
              <RefreshCw size={12} strokeWidth={3} /> Reset
            </button>
          </div>
          <div className="bg-white border-2 border-[#1E293B] rounded-[24px] pop-shadow p-5 sm:p-6 relative overflow-hidden">
            <div className="w-1.5 absolute left-0 top-0 h-full bg-[#FBBF24]" />
            <InputPanel values={formData} onChange={handleChange} />
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-[#8B5CF6] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck size={16} strokeWidth={2.5} /> {isSaving ? "Saving..." : "Save Insights"}
          </button>
        </div>
      )}

      {/* ── FOOTER DISCLAIMER ────────────────────────────────────────────────── */}
      <div className="text-center pt-4 border-t-2 border-[#1E293B]/5">
        <p className="text-[9px] font-bold text-[#1E293B]/30 uppercase tracking-widest">
          Calculations are based on FY 2025-26 / AY 2026-27 income tax rules. This is for
          informational purposes only and does not constitute tax advice. Consult a qualified
          CA or tax advisor for personalised guidance.
        </p>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT (wrapped in DashboardLayout) ────────────────────────────────

export default function TaxShield() {
  return (
    <DashboardLayout title="Tax Shield">
      <TaxShieldContent />
    </DashboardLayout>
  );
}
