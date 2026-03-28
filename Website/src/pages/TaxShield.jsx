import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, TrendingUp, Info, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { computeTax, NEW_REGIME_SLABS, OLD_REGIME_SLABS } from '../utils/math';
import DashboardLayout, { useUser } from '../components/DashboardLayout';

const formatIndian = (num) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

const PageContent = () => {
  const navigate = useNavigate();
  const { userData } = useUser();
  
  // Custom states for what-if tax scenarios
  const [investments, setInvestments] = useState({
    extra80C: 0,
    nps80CCD1B: 50000,
    employerNPS: 0 // 80CCD(2)
  });

  useEffect(() => {
    if (userData) {
      if (userData.workContext === 'Government' || userData.workContext === 'Private Sector') {
         const basic = userData.monthlyIncome * 12 * 0.40;
         setInvestments(prev => ({ ...prev, employerNPS: Math.round(basic * 0.10) }));
      }
    }
  }, [userData]);

  const taxAnalysis = useMemo(() => {
    if (!userData) return null;
    const annualIncome = userData.monthlyIncome * 12;

    const currentTaxNew = computeTax(annualIncome, 'new', investments.employerNPS); 
    
    const oldDeductions = Math.min(150000, investments.extra80C) + investments.nps80CCD1B + investments.employerNPS;
    const currentTaxOld = computeTax(annualIncome, 'old', oldDeductions);

    const optDeductions = 150000 + 50000 + investments.employerNPS;
    const optTaxOld = computeTax(annualIncome, 'old', optDeductions);

    return {
      annualIncome,
      newRegime: { tax: currentTaxNew, slabs: NEW_REGIME_SLABS },
      oldRegime: { tax: currentTaxOld, slabs: OLD_REGIME_SLABS },
      optimizedOld: optTaxOld,
      bestRegime: currentTaxNew < currentTaxOld ? 'new' : 'old',
      savings: Math.abs(currentTaxNew - currentTaxOld)
    };
  }, [userData, investments]);

  if (!userData) return null;

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-6xl mx-auto pb-32">
       {/* 1. Hero Summary */}
       <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-[#8B5CF6] border-2 border-[#1E293B] rounded-[32px] p-8 lg:p-10 text-white pop-shadow-lg relative overflow-hidden flex flex-col justify-between">
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                   <Zap className="text-[#FBBF24]" fill="currentColor" />
                   <span className="font-black uppercase tracking-[3px] text-xs opacity-70">Tax Intelligence</span>
                </div>
                <h2 className="font-heading font-black text-3xl md:text-5xl lg:text-5xl leading-tight mb-6 uppercase tracking-tight">
                   You save <span className="text-[#34D399] tracking-normal">{formatIndian(taxAnalysis.savings)}</span> in the {taxAnalysis.bestRegime} Regime.
                </h2>
                <p className="text-white/60 font-bold text-sm md:text-base max-w-lg leading-relaxed">
                   Based on your annual gross income of <span className="text-white">{formatIndian(taxAnalysis.annualIncome)}</span> and current NPS contributions.
                </p>
             </div>
             
             <div className="mt-12 flex flex-wrap gap-4 relative z-10">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex-1 min-w-[150px]">
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">New Regime Tax</div>
                   <div className="font-heading font-bold text-2xl">{formatIndian(taxAnalysis.newRegime.tax)}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex-1 min-w-[150px]">
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Old Regime Tax</div>
                   <div className="font-heading font-bold text-2xl">{formatIndian(taxAnalysis.oldRegime.tax)}</div>
                </div>
             </div>

             {/* Background Shapes */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/2 -translate-y-1/2" />
             <Shield className="absolute bottom-[-20px] right-[-20px] w-48 h-48 text-white/5 rotate-[-15deg] pointer-events-none" />
          </div>

          <div className="lg:col-span-5 bg-white border-2 border-[#1E293B] rounded-[32px] p-8 pop-shadow-lg flex flex-col justify-between">
             <div className="space-y-6">
                <h3 className="font-heading font-black text-2xl uppercase tracking-widest text-[#1E293B]">NPS Benefits</h3>
                <div className="space-y-4">
                   <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#34D399]/10 border-2 border-[#1E293B] flex items-center justify-center shrink-0">
                         <CheckCircle2 className="w-5 h-5 text-[#34D399]" />
                      </div>
                      <div>
                         <div className="font-black text-sm uppercase tracking-wide">80CCD(1B) Bonus</div>
                         <p className="text-xs font-bold text-[#1E293B]/50 leading-relaxed max-w-xs">Exclusive ₹50,000 deduction for NPS subscribers only in the Old Regime.</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 border-2 border-[#1E293B] flex items-center justify-center shrink-0">
                         <CheckCircle2 className="w-5 h-5 text-[#8B5CF6]" />
                      </div>
                      <div>
                         <div className="font-black text-sm uppercase tracking-wide">80CCD(2) Corporate</div>
                         <p className="text-xs font-bold text-[#1E293B]/50 leading-relaxed max-w-xs">Up to 10% basic salary deduction allowed in BOTH regimes. (14% for Govt)</p>
                      </div>
                   </div>
                </div>
             </div>
             
             <div className="bg-[#FFFDF5] border-2 border-[#1E293B] border-dashed rounded-2xl p-4 mt-8">
                <div className="flex items-center gap-2 text-[#EF4444] mb-2 font-black text-[10px] uppercase tracking-widest">
                   <AlertCircle className="w-4 h-4" /> Pro Tip
                </div>
                <p className="text-xs font-bold text-[#1E293B]/70 leading-relaxed">
                   Switching to the New Regime? Standard deduction is now ₹75,000. You still get NPS corporate benefits!
                </p>
             </div>
          </div>
       </section>

       {/* 2. Slab Visualization */}
       <section className="space-y-8">
          <div className="flex items-center gap-4">
             <h2 className="font-heading font-black text-3xl uppercase tracking-widest leading-none">Tax Slab Pulse</h2>
             <div className="flex-1 h-1 bg-[#1E293B] relative opacity-10"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
             {/* New Regime Slabs */}
             <div className="space-y-6">
                <div className="flex justify-between items-end">
                   <h3 className="font-black text-xl uppercase tracking-wider text-[#8B5CF6]">New Regime</h3>
                   <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded-full">Default FY 2025-26</span>
                </div>
                <div className="space-y-3">
                   {NEW_REGIME_SLABS.map((slab, i) => {
                      const prev = i === 0 ? 0 : NEW_REGIME_SLABS[i-1].limit;
                      const range = slab.limit === Infinity ? `Above ${formatIndian(prev)}` : `${formatIndian(prev)} - ${formatIndian(slab.limit)}`;
                      return (
                        <div key={i} className="flex items-center gap-4">
                           <div className="w-16 text-[10px] font-black text-slate-400">{slab.rate * 100}%</div>
                           <div className="flex-1 h-10 bg-white border-2 border-[#1E293B] rounded-xl overflow-hidden relative group transition-all">
                              <div className="absolute inset-0 bg-[#8B5CF6]/5 group-hover:bg-[#8B5CF6]/10 transition-colors" />
                              <div className="absolute inset-y-0 left-0 bg-[#8B5CF6]" style={{ width: `${slab.rate * 100 * 2.5}%` }} />
                              <div className="absolute inset-0 flex items-center px-4 justify-between transition-transform duration-300">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-[#1E293B]">{range}</span>
                              </div>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>

             {/* Old Regime Slabs */}
             <div className="space-y-6">
                <div className="flex justify-between items-end">
                   <h3 className="font-black text-xl uppercase tracking-wider text-[#34D399]">Old Regime</h3>
                   <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded-full">Deduction Based</span>
                </div>
                <div className="space-y-3">
                   {OLD_REGIME_SLABS.map((slab, i) => {
                      const prev = i === 0 ? 0 : OLD_REGIME_SLABS[i-1].limit;
                      const range = slab.limit === Infinity ? `Above ${formatIndian(prev)}` : `${formatIndian(prev)} - ${formatIndian(slab.limit)}`;
                      return (
                        <div key={i} className="flex items-center gap-4">
                           <div className="w-16 text-[10px] font-black text-slate-400">{slab.rate * 100}%</div>
                           <div className="flex-1 h-10 bg-white border-2 border-[#1E293B] rounded-xl overflow-hidden relative group transition-all">
                              <div className="absolute inset-0 bg-[#34D399]/5 group-hover:bg-[#34D399]/10 transition-colors" />
                              <div className="absolute inset-y-0 left-0 bg-[#34D399]" style={{ width: `${slab.rate * 100 * 2.5}%` }} />
                              <div className="absolute inset-0 flex items-center px-4 justify-between transition-transform duration-300">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-[#1E293B]">{range}</span>
                              </div>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>
          </div>
       </section>

       {/* 3. Personalized Settings (What If) */}
       <section className="bg-white border-2 border-[#1E293B] rounded-[32px] p-8 lg:p-12 pop-shadow-lg relative overflow-hidden group">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
             <div className="lg:w-1/3">
                <h3 className="font-heading font-black text-3xl uppercase tracking-widest mb-4">Precision Tweak</h3>
                <p className="text-sm font-bold text-[#1E293B]/60 leading-relaxed uppercase tracking-wider text-[11px]">
                   Add your other tax-saving investments to see if the Old Regime becomes more beneficial for you.
                </p>
             </div>
             
             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">Sec 80C (PPF, ELSS, Insurance)</label>
                   <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-300">₹</span>
                      <input 
                         type="number" step="1000"
                         value={investments.extra80C}
                         onChange={e => setInvestments({...investments, extra80C: parseInt(e.target.value) || 0})}
                         className="w-full bg-slate-50 border-2 border-[#1E293B] rounded-full p-4 pl-12 font-black text-xl outline-none focus:border-[#8B5CF6] transition-all" 
                      />
                   </div>
                </div>
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">NPS Bonus 80CCD(1B)</label>
                   <div className="flex gap-3">
                      {[0, 25000, 50000].map(val => (
                         <button 
                            key={val}
                            onClick={() => setInvestments({...investments, nps80CCD1B: val})}
                            className={`flex-1 py-4 rounded-full border-2 border-[#1E293B] font-black text-[10px] uppercase tracking-widest transition-all ${investments.nps80CCD1B === val ? 'bg-[#FBBF24] shadow-[3px_3px_0_0_#1E293B] -translate-y-1' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                         >
                            {val === 0 ? 'Skip' : formatIndian(val)}
                         </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>
          
          <div className="mt-12 pt-12 border-t-2 border-[#1E293B]/10 flex flex-col md:flex-row justify-between items-center gap-8">
             <div className="flex items-center gap-3">
                <TrendingUp className="text-[#8B5CF6]" />
                <span className="font-black uppercase tracking-widest text-[11px]">Potential Annual Savings: <span className="text-[#8B5CF6] text-base ml-2 tracking-normal">{formatIndian(taxAnalysis.savings)}</span></span>
             </div>
             <button 
               onClick={() => navigate('/dashboard')}
               className="px-8 py-4 bg-[#1E293B] text-white border-2 border-[#1E293B] rounded-full font-black uppercase tracking-widest text-xs flex items-center gap-4 group pop-shadow hover:-translate-y-1 transition-all"
             >
                Dashboard Pulse <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
       </section>
    </div>
  );
};

export default function TaxShield() {
  return (
    <DashboardLayout title="Tax Shield">
      <PageContent />
    </DashboardLayout>
  );
}
