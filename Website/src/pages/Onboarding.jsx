import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Upload, Check, Loader2, Activity, Sparkles, IndianRupee, Zap } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { calculateRetirement, getScoreBand } from '../utils/math';
import { encryptUserData } from '../utils/encryption';

const COLORS = {
  bg: '#FFFDF5',
  fg: '#1E293B',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  emerald: '#34D399'
};

const MIN_AGE = 18;
const MAX_RETIRE_AGE = 75;
const MIN_MONTHLY_INCOME = 1000;
const MAX_MONTHLY_INCOME = 100000000; // 10 Cr
const MAX_NPS_CONTRIBUTION = 100000000; // 10 Cr
const MAX_NPS_CORPUS = 1000000000; // 100 Cr

const parseNumericInput = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value !== 'string') {
    return NaN;
  }

  const normalized = value.replace(/[₹,\s]/g, '').trim();
  if (!normalized) return NaN;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parsePositiveNumber = (value) => parseNumericInput(value);

const parseIntegerInput = (value, fallback) => {
  const parsed = parseNumericInput(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
};

const MemphisDotGrid = ({ className = '', opacity = 0.06 }) => (
  <div 
    className={`absolute inset-0 z-0 pointer-events-none ${className}`}
    style={{
      backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      opacity: opacity
    }}
    aria-hidden="true"
  />
);

const Confetti = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <polygon className="animate-float" style={{ animationDelay: '0s' }} points="50,15 65,40 35,40" fill={COLORS.pink} transform="translate(10vw, 15vh) rotate(20) scale(0.6)" />
      <polygon className="animate-float" style={{ animationDelay: '1.2s' }} points="50,15 65,40 35,40" fill={COLORS.amber} transform="translate(80vw, 30vh) rotate(-45) scale(0.7)" />
      <circle className="animate-float" style={{ animationDelay: '0.8s' }} cx="30" cy="30" r="15" fill={COLORS.emerald} transform="translate(85vw, 15vh)" />
      <circle className="animate-float" style={{ animationDelay: '1.5s' }} cx="30" cy="30" r="10" fill={COLORS.violet} transform="translate(15vw, 45vh)" />
      <rect className="animate-float" style={{ animationDelay: '2.1s' }} x="0" y="0" width="24" height="24" fill={COLORS.amber} transform="translate(45vw, 20vh) rotate(15)" />
      <rect className="animate-float" style={{ animationDelay: '1.8s' }} x="0" y="0" width="30" height="12" rx="6" fill={COLORS.pink} transform="translate(8vw, 25vh) rotate(35)" />
      <circle className="animate-float" style={{ animationDelay: '0.3s' }} cx="30" cy="30" r="12" fill={COLORS.pink} transform="translate(75vw, 80vh)" />
      <rect className="animate-float" style={{ animationDelay: '0.9s' }} x="0" y="0" width="20" height="20" fill={COLORS.violet} transform="translate(90vw, 60vh) rotate(-20)" />
      <polygon className="animate-float" style={{ animationDelay: '2.5s' }} points="50,15 65,40 35,40" fill={COLORS.emerald} transform="translate(20vw, 75vh) rotate(110) scale(0.5)" />
    </svg>
  </div>
);

const FinalScoreArc = ({ score = 82 }) => {
  const [offset, setOffset] = useState(283);
  useEffect(() => {
    const timeout = setTimeout(() => { setOffset(283 - (283 * (score / 100))); }, 300);
    return () => clearTimeout(timeout);
  }, [score]);

  return (
    <div className="relative w-full aspect-square max-w-[320px] mx-auto flex items-center justify-center animate-scale-up">
      <div className="absolute inset-0 bg-[#34D399] rounded-full mix-blend-multiply opacity-50 -translate-x-4 translate-y-4" />
      <div className="relative z-10 w-full h-full bg-white border-4 border-[#1E293B] rounded-full p-8 flex flex-col items-center justify-center pop-shadow">
        <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 -rotate-90 p-4 pb-0 overflow-visible">
           <circle cx="50" cy="50" r="45" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeDasharray="283" strokeLinecap="round" />
           <circle 
            cx="50" cy="50" r="45" fill="none" stroke={COLORS.emerald} strokeWidth="8" 
            strokeDasharray="283" strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        </svg>
        <div className="text-center relative z-20 mt-4">
          <div className="font-heading font-extrabold text-[#1E293B] text-7xl leading-none">{score}</div>
          <div className={`font-bold uppercase tracking-widest text-sm mt-2`} style={{ color: getScoreBand(score).color }}>{getScoreBand(score).label}</div>
        </div>
      </div>
    </div>
  );
};

const CardOption = ({ label, selected, onClick, desc }) => (
  <button 
    onClick={onClick}
    className={`w-full p-4 text-left border-2 rounded-xl transition-all cubic tracking-wide cursor-pointer flex flex-col justify-center ${
      selected 
        ? 'bg-[#1E293B] border-[#1E293B] text-white shadow-[4px_4px_0_0_#FBBF24] translate-x-[-2px] translate-y-[-2px] scale-[1.02]' 
        : 'bg-white border-[#1E293B] text-[#1E293B] shadow-[2px_2px_0_0_#1E293B] hover:bg-[#F1F5F9] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#1E293B]'
    }`}
  >
    <span className={`font-black text-lg uppercase tracking-widest ${selected ? 'text-white' : 'text-[#1E293B]'}`}>{label}</span>
    {desc && <span className={`font-bold mt-1 text-sm ${selected ? 'text-white/80' : 'text-[#1E293B]/70'}`}>{desc}</span>}
  </button>
);

const InputField = ({ label, type, name, value, onChange, suffix, placeholder, helper, error }) => (
  <div className="w-full text-left">
    <label className="block text-sm font-bold uppercase tracking-widest text-[#1E293B]/70 mb-2">{label}</label>
    <div className="relative">
      <input 
        type={type} 
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full border-2 rounded-xl p-3 text-xl font-bold bg-white focus:outline-none transition-all cubic focus:-translate-y-1 block ${
          error
            ? 'border-[#EF4444] focus:shadow-[4px_4px_0_0_#EF4444]'
            : 'border-[#1E293B] focus:shadow-[4px_4px_0_0_#8B5CF6]'
        }`}
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1E293B]/40 font-bold">{suffix}</span>}
    </div>
    {error ? (
      <p className="mt-2 text-xs font-bold text-[#EF4444] uppercase tracking-wide">{error}</p>
    ) : (
      helper && <p className="mt-2 text-xs font-bold text-[#1E293B]/60 uppercase tracking-wide">{helper}</p>
    )}
  </div>
);

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); 
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: '',
    age: '',
    workContext: '',
    monthlyIncome: '',
    npsUsage: '', 
    npsContribution: '',
    npsCorpus: '',
    npsEquity: 50,
    retireAge: 60,
    lifestyle: '',
    addSavings: false,
    totalSavings: '',
    taxRegime: 'new'
  });

  const clearErrorsForFields = (fields) => {
    setErrors((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        delete next[field];
      });
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'age' || name === 'retireAge') {
      clearErrorsForFields(['age', 'retireAge']);
      return;
    }

    clearErrorsForFields([name]);
  };

  const validateAgeRules = (data) => {
    const nextErrors = {};
    const age = parseIntegerInput(data.age, NaN);
    const retireAge = parseIntegerInput(data.retireAge, 60);

    if (!Number.isInteger(age)) {
      nextErrors.age = 'Age is required';
      return nextErrors;
    }

    if (age < MIN_AGE) {
      nextErrors.age = `Age must be at least ${MIN_AGE}`;
    }

    if (retireAge > MAX_RETIRE_AGE) {
      nextErrors.retireAge = `Retirement age cannot exceed ${MAX_RETIRE_AGE}`;
    }

    if (Number.isInteger(age) && Number.isInteger(retireAge) && age >= retireAge) {
      nextErrors.age = `Age must be less than retirement age (${retireAge})`;
      nextErrors.retireAge = 'Retirement age must be greater than current age';
    }

    return nextErrors;
  };

  const validateIncome = (data) => {
    const nextErrors = {};
    const monthlyIncome = parsePositiveNumber(data.monthlyIncome);

    if (!(monthlyIncome > 0)) {
      nextErrors.monthlyIncome = 'Monthly income must be a positive number';
    } else if (monthlyIncome < MIN_MONTHLY_INCOME) {
      nextErrors.monthlyIncome = `Monthly income must be at least ₹${MIN_MONTHLY_INCOME.toLocaleString('en-IN')}`;
    } else if (monthlyIncome >= MAX_MONTHLY_INCOME) {
      nextErrors.monthlyIncome = 'Monthly income must be less than ₹10 Cr';
    }

    return nextErrors;
  };

  const validateNps = (data, parsed) => {
    const nextErrors = {};

    if (!data.npsUsage) {
      nextErrors.npsUsage = 'Choose your NPS usage option';
      return nextErrors;
    }

    if (data.npsUsage === 'none') {
      return nextErrors;
    }

    const contribution = parsed.npsContribution;
    const corpus = parsed.npsCorpus;

    if (!(contribution > 0)) {
      nextErrors.npsContribution = 'NPS contribution must be a positive number';
    } else if (contribution > parsed.monthlyIncome) {
      nextErrors.npsContribution = 'NPS contribution cannot exceed monthly income';
    } else if (contribution >= MAX_NPS_CONTRIBUTION) {
      nextErrors.npsContribution = 'NPS contribution is too large (sanity cap exceeded)';
    }

    if (!(corpus > 0)) {
      nextErrors.npsCorpus = 'NPS corpus must be a positive number';
    } else if (corpus >= MAX_NPS_CORPUS) {
      nextErrors.npsCorpus = 'NPS corpus is too large (sanity cap exceeded)';
    }

    return nextErrors;
  };

  const validateStep1 = (data) => {
    const nextErrors = {};
    if (!data.firstName?.trim()) {
      nextErrors.firstName = 'First name is required';
    }
    return { ...nextErrors, ...validateAgeRules(data) };
  };

  const validateAll = (data, parsed) => {
    return {
      ...validateStep1(data),
      ...validateIncome(data),
      ...validateNps(data, parsed),
    };
  };

  const parsedData = useMemo(() => ({
    ...formData,
    age: parseIntegerInput(formData.age, 28),
    monthlyIncome: parseNumericInput(formData.monthlyIncome) || 0,
    npsContribution: formData.npsUsage === 'none' ? 0 : (parseNumericInput(formData.npsContribution) || (formData.npsUsage === 'upload' ? 4500 : 0)),
    npsCorpus: formData.npsUsage === 'none' ? 0 : (parseNumericInput(formData.npsCorpus) || (formData.npsUsage === 'upload' ? 120000 : 0)),
    totalSavings: parseNumericInput(formData.totalSavings) || 0,
    retireAge: parseIntegerInput(formData.retireAge, 60),
  }), [formData]);

  const results = useMemo(() => calculateRetirement(parsedData), [parsedData]);

  useEffect(() => {
    document.title = "RetireSahi | Onboarding";
    if (step === 0) {
      const t = setTimeout(() => setStep(1), 1200);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleNext = () => {
    let stepErrors = {};

    if (step === 1) {
      stepErrors = validateStep1(formData);
    }

    if (step === 3) {
      stepErrors = validateIncome(formData);
    }

    if (step === 4) {
      stepErrors = validateNps(formData, parsedData);
    }

    if (step === 5) {
      stepErrors = validateAgeRules(formData);
    }

    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      return;
    }

    if (step === 1) clearErrorsForFields(['firstName', 'age', 'retireAge']);
    if (step === 3) clearErrorsForFields(['monthlyIncome']);
    if (step === 4) clearErrorsForFields(['npsUsage', 'npsContribution', 'npsCorpus']);
    if (step === 5) clearErrorsForFields(['age', 'retireAge']);

    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const submitErrors = validateAll(formData, parsedData);
    if (Object.keys(submitErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...submitErrors }));
      return;
    }

    try {
      if (auth?.currentUser) {
        const finalResults = calculateRetirement(parsedData);
        const payload = {
          ...parsedData,
          ...finalResults,
          updatedAt: new Date().toISOString(),
        };
        const encrypted = await encryptUserData(payload, auth.currentUser.uid);
        await setDoc(doc(db, 'users', auth.currentUser.uid), encrypted, { merge: true });
      }
      setCalcMsg(0);
      setStep(8);
    } catch (error) {
      console.error('Firestore Error: ', error);
    }
  };

  const back = () => setStep(s => Math.max(1, s - 1));

  const [calcMsg, setCalcMsg] = useState(0);
  useEffect(() => {
    if (step === 8) {
      const sequence = [
        () => setCalcMsg(1),
        () => setCalcMsg(2),
        () => setCalcMsg(3),
        () => setStep(9)
      ];
      sequence.forEach((fn, i) => setTimeout(fn, (i + 1) * 800));
    }
  }, [step]);

  const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center px-4 py-12 overflow-hidden bg-[#FFFDF5] text-[#1E293B] selection:bg-[#F472B6] selection:text-white" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <style>{`
        h1, h2, h3, .font-heading { font-family: 'Outfit', sans-serif; }
        .cubic {  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
        .pop-shadow { box-shadow: 4px 4px 0px 0px #1E293B; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .candy-btn {
          background-color: ${COLORS.violet}; color: white; border: 2px solid ${COLORS.fg};
          border-radius: 12px; position: relative;
        }
        .candy-btn:hover { box-shadow: 6px 6px 0px 0px #1E293B; transform: translate(-2px, -2px); }
        .candy-btn:active { box-shadow: 2px 2px 0px 0px #1E293B; transform: translate(2px, 2px); }
        .candy-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }
        
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-scale-up { animation: scaleUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes float { 0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); } 50% { transform: translateY(-8px) rotate(calc(var(--rot, 0deg) + 5deg)); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
      `}</style>
      
      <MemphisDotGrid />
      <Confetti />

      {step === 0 && (
        <div className="z-10 text-center animate-fade-in flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#8B5CF6] mb-6" />
          <h2 className="font-heading font-extrabold text-3xl">Setting things up for you...</h2>
        </div>
      )}

      {step >= 1 && step <= 7 && (
        <div className="z-10 w-full max-w-lg bg-white border-2 border-[#1E293B] rounded-3xl p-6 md:p-8 pop-shadow animate-slide-up flex flex-col relative overflow-hidden h-auto min-h-[450px] max-h-[90vh]">
          <div className="w-full mb-6 shrink-0 relative">
             <div className="flex justify-between items-center mb-3">
               {step > 1 ? (
                 <button onClick={back} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-[#1E293B]/60 hover:text-[#1E293B]">
                   <ArrowLeft className="w-5 h-5" />
                 </button>
               ) : <div className="w-9 h-9" />}
               <span className="font-bold uppercase tracking-widest text-[#1E293B]/40 text-xs">Step {step} of 7</span>
               <div className="w-9 h-9" />
             </div>
             
             <div className="w-full h-2 border-2 border-[#1E293B] rounded-full bg-[#F1F5F9] overflow-hidden">
               <div 
                 className="h-full bg-[#8B5CF6]"
                 style={{ width: `${(step / 7) * 100}%`, transition: 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
               />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-6 px-1">
            {step === 1 && (
              <div className="animate-fade-in space-y-6">
                <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight text-center mb-6">Let’s calculate your retirement score in under 60 seconds.</h2>
                <InputField label="First Name" type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="e.g. Rahul" error={errors.firstName} />
                <InputField label="Age" type="number" name="age" value={formData.age} onChange={handleChange} placeholder="e.g. 28" error={errors.age} />
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in space-y-4">
                <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight text-center mb-6">What best describes your work?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Private Sector', 'Government', 'Self-Employed', 'Student / Other'].map(opt => (
                    <CardOption key={opt} label={opt} selected={formData.workContext === opt} onClick={() => setFormData({...formData, workContext: opt})} />
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in space-y-6">
                <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight text-center mb-4">What’s your monthly income?</h2>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-2xl text-[#1E293B]/50">₹</span>
                  <input 
                    type="number" name="monthlyIncome" value={formData.monthlyIncome} onChange={handleChange}
                    placeholder="85,000" className={`w-full border-2 rounded-xl p-4 pl-10 text-2xl font-black bg-white focus:outline-none transition-all cubic block ${
                      errors.monthlyIncome
                        ? 'border-[#EF4444] focus:shadow-[4px_4px_0_0_#EF4444]'
                        : 'border-[#1E293B] focus:shadow-[4px_4px_0_0_#8B5CF6]'
                    }`}
                  />
                </div>
                {errors.monthlyIncome && (
                  <p className="text-xs font-bold text-[#EF4444] uppercase tracking-wide">{errors.monthlyIncome}</p>
                )}
                <div className="bg-[#FFFDF5] border-2 border-[#1E293B] p-4 rounded-xl flex gap-3 text-sm font-bold text-[#1E293B]/80 shadow-[2px_2px_0_0_#1E293B]">
                  <Sparkles className="w-5 h-5 text-[#FBBF24] shrink-0" />
                  We use this to estimate your standard of living and retirement trajectory.
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-in space-y-4">
                <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight text-center">Do you already invest in NPS?</h2>
                <button 
                  onClick={() => setFormData({...formData, npsUsage: 'upload'})}
                  className={`w-full p-4 mt-2 text-left border-2 rounded-xl flex items-center gap-4 transition-all cubic cursor-pointer ${formData.npsUsage === 'upload' ? 'bg-[#34D399] border-[#1E293B] shadow-[4px_4px_0_0_#1E293B] -translate-y-1' : 'bg-white border-[#1E293B] shadow-[2px_2px_0_0_#1E293B] hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#1E293B]'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-[#1E293B] flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-[#34D399]" />
                  </div>
                  <div>
                    <div className="font-bold text-lg leading-tight text-[#1E293B]">Upload my NPS statement</div>
                    <div className={`text-xs font-bold mt-1 ${formData.npsUsage === 'upload' ? 'text-black' : 'text-[#1E293B]/60'}`}>Recommended. We'll extract contributions instantly.</div>
                  </div>
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <CardOption label="Enter manually" selected={formData.npsUsage === 'manual'} onClick={() => setFormData({...formData, npsUsage: 'manual'})} />
                  <CardOption label="Don't use NPS" selected={formData.npsUsage === 'none'} onClick={() => setFormData({...formData, npsUsage: 'none'})} />
                </div>
                
                {formData.npsUsage === 'manual' && (
                  <div className="animate-fade-in space-y-4 pt-4 border-t-2 border-dashed border-[#1E293B]/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1E293B]/60 text-center">Tier I is your main retirement account</p>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Monthly (₹)" type="number" name="npsContribution" value={formData.npsContribution} onChange={handleChange} placeholder="5,00,000" error={errors.npsContribution} />
                        <InputField label="Total Corpus (₹)" type="number" name="npsCorpus" value={formData.npsCorpus} onChange={handleChange} placeholder="1.2L" error={errors.npsCorpus} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="animate-fade-in flex flex-col items-center justify-center h-full space-y-6">
                <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight text-center mb-4">When do you want to retire?</h2>
                <div className="text-center w-full max-w-xs">
                  <div className="text-7xl md:text-8xl font-black text-[#8B5CF6] mb-6 relative inline-block">
                    {formData.retireAge}
                    <span className="text-lg md:text-xl text-[#1E293B]/50 font-bold uppercase tracking-widest absolute -right-16 md:-right-20 bottom-3 md:bottom-4">Years</span>
                  </div>
                  <input 
                    type="range" min="50" max="75" 
                    value={formData.retireAge} 
                    onChange={e => {
                      setFormData({ ...formData, retireAge: parseInt(e.target.value, 10) });
                      clearErrorsForFields(['age', 'retireAge']);
                    }}
                    className="w-full h-3 bg-[#E2E8F0] border-2 border-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#8B5CF6]"
                  />
                  {errors.retireAge && (
                    <p className="mt-3 text-xs font-bold text-[#EF4444] uppercase tracking-wide">{errors.retireAge}</p>
                  )}
                  <p className="mt-8 font-bold text-[#1E293B]/60 uppercase tracking-widest text-xs md:text-sm">Earlier retirement requires higher contributions.</p>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="animate-fade-in space-y-4">
                <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight text-center mb-6">What kind of life do you want after retirement?</h2>
                {[
                  { val: 'essential', label: 'Essential', desc: '40% of income — basic needs only' },
                  { val: 'comfortable', label: 'Comfortable', desc: '60% of income — realistic middle India' },
                  { val: 'premium', label: 'Premium', desc: '80% of income — high lifestyle' }
                ].map(opt => (
                  <CardOption 
                    key={opt.val} label={opt.label} desc={opt.desc} 
                    selected={formData.lifestyle === opt.val} 
                    onClick={() => setFormData({...formData, lifestyle: opt.val})} 
                  />
                ))}
                <p className="text-[10px] font-bold text-[#1E293B]/40 uppercase text-center mt-2 px-4 italic">Nobody needs to replace 100% of gross income in retirement.</p>
              </div>
            )}

            {step === 7 && (
              <div className="animate-fade-in space-y-6 pt-2 text-center">
                 <h2 className="font-heading font-extrabold text-2xl md:text-3xl leading-tight">Want a more accurate score?</h2>
                 <p className="font-bold text-[#1E293B]/60 uppercase tracking-widest text-sm">Add your details (Optional)</p>
                 
                 <div className="bg-white border-2 border-[#1E293B] rounded-2xl p-6 text-left space-y-6 pop-shadow">
                    <div>
                      <p className="font-bold text-[#1E293B]/60 uppercase tracking-widest text-xs mb-3">Add other savings (MF, EPF, etc.)</p>
                      <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => setFormData({...formData, addSavings: false})} className={`py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-xs ${!formData.addSavings ? 'bg-[#1E293B] text-white shadow-[3px_3px_0_0_#FBBF24]' : 'bg-white text-[#1E293B]'}`}>Skip</button>
                         <button onClick={() => setFormData({...formData, addSavings: true})} className={`py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-xs ${formData.addSavings ? 'bg-[#34D399] text-[#1E293B] shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}>Add</button>
                      </div>
                      {formData.addSavings && (
                        <div className="mt-4 animate-scale-up">
                          <InputField label="Total Savings (₹)" type="number" name="totalSavings" value={formData.totalSavings} onChange={handleChange} placeholder="5,00,000" />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-bold text-[#1E293B]/60 uppercase tracking-widest text-xs mb-3">Tax Regime (Default: New)</p>
                      <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => setFormData({...formData, taxRegime: 'new'})} className={`py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-xs ${formData.taxRegime === 'new' ? 'bg-[#8B5CF6] text-white shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}>New Regime</button>
                         <button onClick={() => setFormData({...formData, taxRegime: 'old'})} className={`py-3 rounded-xl border-2 border-[#1E293B] font-black uppercase tracking-widest text-xs ${formData.taxRegime === 'old' ? 'bg-[#8B5CF6] text-white shadow-[3px_3px_0_0_#1E293B]' : 'bg-white text-[#1E293B]'}`}>Old Regime</button>
                      </div>
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t-2 border-[#1E293B]/10 shrink-0 mt-auto">
             <button 
               onClick={step === 7 ? handleSubmit : handleNext}
                disabled={
                  (step === 1 && (!formData.firstName || !formData.age)) ||
                  (step === 2 && !formData.workContext) ||
                  (step === 3 && !formData.monthlyIncome) ||
                  (step === 4 && !formData.npsUsage) ||
                  (step === 6 && !formData.lifestyle)
                }
                className="candy-btn w-full py-4 text-base md:text-lg font-black uppercase tracking-widest pop-shadow flex justify-center items-center gap-3 cursor-pointer"
             >
                {step === 7 ? 'See My Score' : 'Continue'}
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <ArrowRight className="text-[#8B5CF6] w-3.5 h-3.5" strokeWidth={4} />
                </div>
             </button>
          </div>
        </div>
      )}

      {step === 8 && (
        <div className="z-10 animate-fade-in flex flex-col items-center">
           <h2 className="font-heading font-extrabold text-3xl md:text-4xl mb-12 text-center leading-tight">Calculating your<br/>retirement score...</h2>
           <div className="space-y-6 w-full max-w-sm px-4">
             {[
               { idx: 0, text: 'Income analysis' },
               { idx: 1, text: 'NPS growth projection' },
               { idx: 2, text: 'Inflation adjustment' },
               { idx: 3, text: 'Lifestyle mapping' }
             ].map(item => (
                <div key={item.idx} className="flex items-center gap-4 animate-fade-in">
                  <div className={`w-8 h-8 shrink-0 rounded-full border-2 border-[#1E293B] flex items-center justify-center transition-colors duration-500 ${calcMsg >= item.idx ? 'bg-[#34D399] shadow-[2px_2px_0_0_#1E293B]' : 'bg-white'}`}>
                    {calcMsg >= item.idx && <Check className="w-5 h-5 text-white" strokeWidth={4} />}
                  </div>
                  <span className={`font-bold text-lg md:text-xl uppercase tracking-widest transition-opacity duration-500 ${calcMsg >= item.idx ? 'opacity-100 text-[#1E293B]' : 'opacity-30'}`}>
                    {item.text}
                  </span>
                </div>
             ))}
           </div>
        </div>
      )}

      {step === 9 && (
        <div className="z-10 w-full max-w-4xl animate-slide-up flex flex-col lg:flex-row gap-8 items-center justify-center">
          <div className="w-full lg:w-1/2 flex justify-center">
             <FinalScoreArc score={results.score} />
          </div>

          <div className="w-full lg:w-1/2 flex flex-col gap-6">
             <div className="bg-white border-2 border-[#1E293B] rounded-3xl p-6 md:p-8 pop-shadow">
               <div className="font-bold uppercase tracking-widest text-[#1E293B]/60 text-xs md:text-sm mb-4">Your Retirement Outlook</div>
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div>
                   <div className="text-xs md:text-sm font-bold opacity-60 uppercase mb-1">Projected Value</div>
                   <div className="font-heading font-bold text-2xl md:text-3xl">{formatCurrency(results.projectedValue)}</div>
                 </div>
                 <div>
                   <div className="text-xs md:text-sm font-bold opacity-60 uppercase mb-1">Required Corpus</div>
                   <div className="font-heading font-bold text-2xl md:text-3xl">{formatCurrency(results.requiredCorpus)}</div>
                 </div>
               </div>
               <div className="h-px w-full bg-[#1E293B]/10 mb-6" />
               <div className="bg-[#FFFDF5] border-2 border-[#FBBF24] rounded-2xl p-5 md:p-6 shadow-[4px_4px_0_0_#FBBF24]">
                 <div className="font-bold uppercase tracking-widest text-[#FBBF24] text-xs md:text-sm mb-2 flex items-center gap-2">
                   <Zap className="w-4 h-4 md:w-5 md:h-5" /> Your Biggest Lever
                 </div>
                 <div className="font-bold text-base md:text-lg leading-snug">
                   {results.monthlyGap > 0 ? (
                     <>Increase your monthly contribution by <span className="text-[#8B5CF6] font-black">{formatCurrency(results.monthlyGap)}</span> to cover the gap entirely.</>
                   ) : (
                     <><span className="text-[#34D399] font-black">You are fully on track!</span> Your current plan exceeds your retirement requirements.</>
                   )}
                 </div>
               </div>
             </div>
             <button onClick={() => navigate('/dashboard')} className="candy-btn w-full py-4 text-lg md:text-xl font-black uppercase tracking-widest pop-shadow hover:bg-[#1E293B]">
               Go To Dashboard
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
