import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, CreditCard, Layers, PieChart, TrendingUp, Sliders, 
  Receipt, Scale, Zap, Gift, Calculator, Split, RefreshCw, 
  ArrowUpFromLine, LogOut, TrendingDown, AlertCircle, BarChart2, 
  Baby, ArrowRight, ChevronDown, CheckCircle2, Menu, X, Bell
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthModal from '../components/AuthModal';

const COLORS = {
  bg: '#FFFDF5',
  fg: '#1E293B',
  violet: '#8B5CF6',
  pink: '#F472B6',
  amber: '#FBBF24',
  emerald: '#34D399',
  slate: '#1E293B',
};

// --- Reusable Memphis Components ---
const MemphisDotGrid = ({ className, opacity = 0.05 }) => (
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
      <polygon className="animate-float" style={{ animationDelay: '0s' }} points="50,15 65,40 35,40" fill={COLORS.pink} transform="translate(100, 100) rotate(20) scale(0.6)" />
      <polygon className="animate-float" style={{ animationDelay: '1.2s' }} points="50,15 65,40 35,40" fill={COLORS.amber} transform="translate(800, 300) rotate(-45) scale(0.7)" />
      <polygon className="animate-float" style={{ animationDelay: '2.5s' }} points="50,15 65,40 35,40" fill={COLORS.emerald} transform="translate(200, 600) rotate(110) scale(0.5)" />
      <circle className="animate-float" style={{ animationDelay: '0.8s' }} cx="30" cy="30" r="15" fill={COLORS.emerald} transform="translate(900, 150)" />
      <circle className="animate-float" style={{ animationDelay: '1.5s' }} cx="30" cy="30" r="10" fill={COLORS.violet} transform="translate(150, 450)" />
      <circle className="animate-float" style={{ animationDelay: '0.3s' }} cx="30" cy="30" r="12" fill={COLORS.pink} transform="translate(700, 700)" />
      <rect className="animate-float" style={{ animationDelay: '2.1s' }} x="0" y="0" width="24" height="24" fill={COLORS.amber} transform="translate(450, 200) rotate(15)" />
      <rect className="animate-float" style={{ animationDelay: '0.9s' }} x="0" y="0" width="20" height="20" fill={COLORS.violet} transform="translate(950, 500) rotate(-20)" />
      <rect className="animate-float" style={{ animationDelay: '1.8s' }} x="0" y="0" width="30" height="12" rx="6" fill={COLORS.pink} transform="translate(50, 250) rotate(35)" />
    </svg>
  </div>
);

const SquigglyLine = ({ color = COLORS.violet }) => (
  <svg className="absolute w-[110%] h-4 -bottom-2 -left-[5%] z-0" viewBox="0 0 200 20" preserveAspectRatio="none">
    <path d="M0,10 Q50,20 100,10 T200,10" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
  </svg>
);

// --- Page Components ---
const ExpandableCard = ({ icon: Icon, title, teaser, expandedContent, accentColor }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={`bg-white border-2 border-[#1E293B] rounded-[20px] transition-all cubic pop-shadow group overflow-hidden ${isExpanded ? 'scale-[1.02] ring-2 ring-[#1E293B]' : 'hover:-translate-y-1'}`}
    >
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-6 flex items-start gap-3 sm:gap-4 text-left cursor-pointer transition-colors"
      >
        <div className={`w-14 h-14 rounded-full border-2 border-[#1E293B] flex items-center justify-center shrink-0 shadow-[4px_4px_0_0_#1E293B] group-hover:rotate-6 transition-all cubic`} style={{ backgroundColor: accentColor }}>
            {React.createElement(Icon, { className: 'w-8 h-8 text-white', strokeWidth: 2.5 })}
        </div>
          <div className="flex-1 min-w-0 pr-2 sm:pr-4 mt-1">
           <h3 className="font-heading font-extrabold text-[#1E293B] text-xl mb-1 truncate">{title}</h3>
           <p className="text-[#1E293B]/60 font-medium text-sm leading-relaxed">{teaser}</p>
        </div>
        <div className={`mt-2 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
           <ChevronDown className="w-6 h-6 text-[#1E293B]/40" />
        </div>
      </button>

      <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-4 sm:px-6 pb-6 sm:pb-8 ml-0 sm:ml-[72px] pr-4 sm:pr-10 border-t border-slate-100 pt-4 sm:pt-6">
            <div className="text-[#1E293B]/80 font-medium leading-relaxed prose prose-slate max-w-none">
              {expandedContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Learn() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('basics');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = "RetireSahi | Know Your NPS";
    const unsub = onAuthStateChanged(auth, setUser);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      
      // Update active category based on section position
      const sections = ['basics', 'tax', 'retirement', 'rules'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveCategory(section);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      unsub();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 140, // Adjust for sticky navbars
        behavior: 'smooth'
      });
    }
  };

  const categories = [
    { id: 'basics', label: '📘 NPS Basics' },
    { id: 'tax', label: '💰 Tax & Savings' },
    { id: 'retirement', label: '🎯 At Retirement' },
    { id: 'rules', label: '📋 Rules & Limits' }
  ];

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#1E293B] relative selection:bg-[#F472B6] selection:text-white" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
        h1, h2, h3, .font-heading { font-family: 'Outfit', sans-serif; }
        .cubic { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
        .pop-shadow { box-shadow: 4px 4px 0px 0px #1E293B; }
        .candy-btn {
          border-radius: 9999px;
          border: 2px solid #1E293B;
          box-shadow: 4px 4px 0px 0px #1E293B;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .candy-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px 0px #1E293B; }
        .candy-btn:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0px 0px #1E293B; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
      `}</style>

      {/* --- Navbar (Same as Landing) --- */}
      <nav 
        className={`bg-white border-b-2 border-[#1E293B] sticky top-0 z-[60] transition-shadow duration-300 w-full`}
        style={scrolled ? { boxShadow: '0 4px 0 0 rgba(30,41,59,0.1)' } : {}}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-[#8B5CF6] border-2 border-[#1E293B] rounded-full flex items-center justify-center pop-shadow">
              <span className="font-heading font-extrabold text-white text-xl">R</span>
            </div>
            <span className="font-heading font-extrabold text-2xl tracking-tight hidden sm:block">RetireSahi</span>
          </div>
          
          <div className="hidden md:flex gap-8 font-bold uppercase tracking-wide text-sm items-center">
             <button onClick={() => navigate('/')} className="text-[#1E293B] hover:text-[#8B5CF6] transition-colors cursor-pointer">Features</button>
             <button onClick={() => navigate('/')} className="text-[#1E293B] hover:text-[#F472B6] transition-colors cursor-pointer">How It Works</button>
             <button onClick={() => scrollTo('basics')} className="text-[#8B5CF6] border-b-4 border-[#8B5CF6] pb-1 cursor-pointer">Learn</button>
          </div>
          
          <div className="flex items-center gap-6 font-bold text-[#1E293B]">
            {user ? (
               <button 
                onClick={() => navigate('/dashboard')}
                className="touch-target candy-btn px-4 sm:px-6 py-2.5 font-bold uppercase tracking-widest text-[#1E293B] cursor-pointer bg-[#34D399] text-xs sm:text-sm"
              >
                Go Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => setIsAuthOpen(true)} className="hover:text-[#8B5CF6] transition-colors cursor-pointer hidden md:block">Sign In</button>
                <button 
                  onClick={() => setIsAuthOpen(true)}
                  className="touch-target candy-btn px-4 sm:px-6 py-2.5 font-bold uppercase tracking-widest text-[#1E293B] cursor-pointer bg-[#34D399] text-xs sm:text-sm"
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* --- Page Header --- */}
      <header className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden border-b-2 border-[#1E293B] bg-[#FFF8E7]">
         <MemphisDotGrid opacity={0.06} />
         <Confetti />
         <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-block px-4 py-1 bg-[#FBBF24] border-2 border-[#1E293B] rounded-full font-black text-[10px] uppercase tracking-[3px] pop-shadow mb-8 -rotate-1">
               UPDATED FOR FY 2025-26
            </div>
            <h1 className="font-heading font-black text-[#1E293B] mb-8 leading-[1.1]" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)' }}>
               Everything you need <br/> to know about <span className="relative inline-block">NPS <SquigglyLine color={COLORS.pink} /></span>
            </h1>
            <p className="font-bold text-[#1E293B]/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
               No jargon. No walls of text. Just the stuff that actually matters for your retirement starting today.
            </p>
         </div>
      </header>

      {/* --- Category Tab Bar (Sticky) --- */}
      <div className="sticky top-[66px] md:top-[82px] z-50 bg-white border-b-2 border-[#1E293B] overflow-x-auto no-scrollbar scroll-smooth mobile-scroll-lock">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-start md:justify-center gap-3 sm:gap-4 min-w-max">
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={`touch-target flex-shrink-0 px-4 sm:px-6 py-2 rounded-full font-black uppercase tracking-widest text-[10px] sm:text-xs border-2 border-transparent transition-all cubic ${activeCategory === cat.id ? 'bg-[#8B5CF6] text-white border-[#1E293B] pop-shadow' : 'text-[#1E293B]/40 hover:bg-[#FBBF24] hover:text-[#1E293B] hover:border-[#1E293B]'}`}
              >
                {cat.label}
              </button>
            ))}
         </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-24 sm:space-y-32">
         
         {/* SECTION 1: Basics */}
         <section id="basics" className="scroll-mt-40 space-y-12">
            <div className="space-y-2">
               <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-widest text-[#1E293B] flex items-center gap-4">
                  📘 NPS Basics
               </h2>
               <p className="font-bold text-[#1E293B]/40 uppercase tracking-[4px] text-xs">Start here if you're new to the system</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
               <ExpandableCard 
                 icon={Shield} title="What is NPS?" accentColor={COLORS.violet}
                 teaser="A government-backed retirement savings scheme open to every Indian citizen aged 18–70."
                 expandedContent={
                   <p>NPS (National Pension System) was launched by the Government of India in 2004 for government employees and opened to all citizens in 2009. You contribute monthly, the money is invested across equity, bonds, and government securities, and at retirement (age 60) you get a lump sum + a monthly pension for life. It's regulated by PFRDA (Pension Fund Regulatory and Development Authority).</p>
                 }
               />
               <ExpandableCard 
                 icon={CreditCard} title="What is a PRAN?" accentColor={COLORS.pink}
                 teaser="Your 12-digit Permanent Retirement Account Number — like a PAN card but for your retirement."
                 expandedContent={
                   <p>Every NPS subscriber gets a unique PRAN when they register. It stays with you for life — even if you change jobs, cities, or fund managers. Your PRAN is linked to your Tier I and Tier II accounts and appears on all your NPS statements. You need it to check your balance, make contributions, or update your profile on the NSDL CRA portal.</p>
                 }
               />
               <ExpandableCard 
                 icon={Layers} title="Tier I vs Tier II" accentColor={COLORS.amber}
                 teaser="Tier I is your locked retirement account. Tier II is a flexible savings account you can withdraw anytime."
                 expandedContent={
                   <div className="space-y-4">
                      <p>Tier I is mandatory for starting an NPS account, while Tier II is an optional addition.</p>
                      <div className="bg-slate-50 border-2 border-[#1E293B] rounded-xl overflow-hidden p-4">
                        <table className="w-full text-xs font-bold uppercase tracking-wider">
                           <thead><tr className="border-b border-slate-200">
                              <th className="text-left py-2">Feature</th><th className="text-left py-2">Tier I</th><th className="text-left py-2">Tier II</th>
                           </tr></thead>
                           <tbody className="divide-y divide-slate-100">
                              <tr><td className="py-2 text-[#1E293B]/50">Purpose</td><td className="py-2">Retirement</td><td className="py-2">Flexible savings</td></tr>
                              <tr><td className="py-2 text-[#1E293B]/50">Withdrawals</td><td className="py-2">Restricted</td><td className="py-2">Anytime</td></tr>
                              <tr><td className="py-2 text-[#1E293B]/50">Tax Benefit</td><td className="py-2">Yes (80CCD)</td><td className="py-2">None</td></tr>
                              <tr><td className="py-2 text-[#1E293B]/50">Min/Year</td><td className="py-2">₹1,000</td><td className="py-2">₹250</td></tr>
                           </tbody>
                        </table>
                      </div>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={PieChart} title="Scheme E, C, and G?" accentColor={COLORS.emerald}
                 teaser="The three investment buckets your money goes into — equity, bonds, and government debt."
                 expandedContent={
                   <div className="space-y-4">
                      <p>NPS invests your money across three asset classes to balance risk and return.</p>
                      <div className="space-y-4 pt-4">
                         <div className="flex items-center gap-3">
                            <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden border border-[#1E293B]/10 flex">
                               <div className="h-full bg-[#8B5CF6]" style={{ width: '50%' }} />
                               <div className="h-full bg-[#F472B6]" style={{ width: '25%' }} />
                               <div className="h-full bg-[#34D399]" style={{ width: '25%' }} />
                            </div>
                         </div>
                         <p><strong>Scheme E (Equity):</strong> Up to 12-14% historical returns. Invests in stocks. <strong>Scheme C (Corporate):</strong> Moderate returns (~8-9%). <strong>Scheme G (Government):</strong> Safest, fixed-income returns (~8-9%).</p>
                      </div>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={TrendingUp} title="What is NAV?" accentColor={COLORS.violet}
                 teaser="NAV is the daily price of one unit of your NPS fund — like a mutual fund price."
                 expandedContent={
                   <div className="space-y-4">
                      <p>When you contribute, your money is converted into units at that day's NAV. If NAV rises, your portfolio value increases even without new contributions.</p>
                      <div className="p-4 bg-[#FBBF24]/10 border-2 border-[#1E293B] border-dashed rounded-xl">
                         <div className="text-xs font-black uppercase tracking-widest text-[#FBBF24] mb-1">Example Math</div>
                         <div className="font-heading font-black text-lg text-[#1E293B]">Portfolio = Total Units × Current NAV</div>
                      </div>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={Sliders} title="Active vs Auto Choice" accentColor={COLORS.pink}
                 teaser="Active = you pick your allocation. Auto = NPS adjusts it by age automatically."
                 expandedContent={
                   <p>In <strong>Active Choice</strong>, you decide what % goes into E, C, and G (subject to PFRDA age caps). In <strong>Auto Choice</strong>, NPS picks for you using a lifecycle fund — aggressive, moderate, or conservative. Most people use 'Moderate'. For young professionals, Active Choice with high equity (75%) often yields the highest wealth.</p>
                 }
               />
            </div>
         </section>

         {/* SECTION 2: Tax & Savings */}
         <section id="tax" className="scroll-mt-40 space-y-12">
            <div className="space-y-2">
               <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-widest text-[#1E293B] flex items-center gap-4">
                  💰 Tax & Savings
               </h2>
               <p className="font-bold text-[#1E293B]/40 uppercase tracking-[4px] text-xs">The part most investors leave money on the table</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
               <ExpandableCard 
                 icon={Receipt} title="The 3 Tax Deductions" accentColor={COLORS.amber}
                 teaser="NPS gives you up to ₹2 lakh in tax deductions — split across three different legal sections."
                 expandedContent={
                   <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                         <div className="p-3 bg-slate-50 border-2 border-[#1E293B] rounded-xl flex justify-between items-center text-xs font-black uppercase tracking-widest">
                            <span>80CCD(1) - Personal</span><span>Up to ₹1.5L</span>
                         </div>
                         <div className="p-3 bg-[#FBBF24]/10 border-2 border-[#1E293B] rounded-xl flex justify-between items-center text-xs font-black uppercase tracking-widest">
                            <span>80CCD(1B) - Extra Bonus</span><span>Flat ₹50,000</span>
                         </div>
                         <div className="p-3 bg-slate-50 border-2 border-[#1E293B] rounded-xl flex justify-between items-center text-xs font-black uppercase tracking-widest">
                            <span>80CCD(2) - Employer</span><span>10% of Basic</span>
                         </div>
                      </div>
                      <p className="text-xs italic text-[#1E293B]/50 mt-2">Note: 80CCD(1) and 1B are only for the Old Tax Regime. 80CCD(2) works in both.</p>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={Scale} title="New vs Old Regime" accentColor={COLORS.violet}
                 teaser="From FY 2024-25, New Regime is the default. But Old Regime might save you more if you use NPS fully."
                 expandedContent={
                   <div className="space-y-4">
                      <p>Under the <strong>New Regime</strong>, you get lower rates but lose most deductions except 80CCD(2). Under the <strong>Old Regime</strong>, you claim everything. If you're in the 30% tax bracket, the Old Regime usually results in higher net savings after NPS deductions.</p>
                      <div className="bg-[#1E293B] text-white p-4 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                         New Regime Slabs: ₹0-4L: 0% | ₹4-8L: 5% | ₹8-12L: 10% | Above ₹24L: 30%
                      </div>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={Zap} title="The Missing ₹50,000" accentColor={COLORS.amber}
                 teaser="80CCD(1B) gives you an extra ₹50k deduction completely separate from your ₹1.5L 80C limit."
                 expandedContent={
                   <div className="space-y-4">
                      <p>Most people max out 80C (PPF/ELSS) and stop. They miss the bonus ₹50k exclusive to NPS. At a 30% tax rate, this saves you ₹15,600 every single year in cash.</p>
                      <div className="py-3 px-6 bg-[#FBBF24] text-[#1E293B] border-2 border-[#1E293B] rounded-xl text-center font-black uppercase tracking-[2px] text-sm pop-shadow">
                        Save ₹15,600/year instantly
                      </div>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={Gift} title="Employer NPS = Free Money" accentColor={COLORS.emerald}
                 teaser="Contributions from your employer are deductible under 80CCD(2) — in both tax regimes."
                 expandedContent={
                   <p>Ask your HR about the NPS Corporate Model. Up to 10% of your Basic salary can be contributed by your employer directly to your PRAN. This reduces your taxable income directly before you even see your paycheck. It is the most valuable tax-saving hack for high-earners in the New Tax Regime.</p>
                 }
               />
               <ExpandableCard 
                 icon={Calculator} title="The Basic Salary Rule" accentColor={COLORS.pink}
                 teaser="NPS tax limits are calculated on your basic salary, not your total CTC."
                 expandedContent={
                   <p>Your 'basic salary' is usually 40-50% of your CTC. NPS limits like 10% under 80CCD(1) apply to this basic, not your total ₹1L or ₹2L monthly income. Knowing your basic is key to planning your exact contribution to maximize tax shielding.</p>
                 }
               />
            </div>
         </section>

         {/* SECTION 3: Retirement */}
         <section id="retirement" className="scroll-mt-40 space-y-12">
            <div className="space-y-2">
               <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-widest text-[#1E293B] flex items-center gap-4">
                  🎯 At Retirement
               </h2>
               <p className="font-bold text-[#1E293B]/40 uppercase tracking-[4px] text-xs">The rules most people find out too late at age 60</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
               <ExpandableCard 
                 icon={Split} title="The 40/60 Split Rule" accentColor={COLORS.violet}
                 teaser="At 60, you MUST use at least 40% of your corpus to buy an annuity for pension."
                 expandedContent={
                   <div className="space-y-4">
                      <p>PFRDA mandates that minimum 40% must go to an annuity (monthly pension). The other 60% can be withdrawn as a tax-free lump sum.</p>
                      <div className="flex items-center gap-3 py-4">
                         <div className="h-4 bg-[#8B5CF6] rounded-full" style={{ width: '40%' }} />
                         <div className="h-4 bg-[#34D399] rounded-full grow shadow-[3px_3px_0_0_#1E293B]" style={{ width: '60%' }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                         <span>40% Annuity (Pension)</span><span>60% Lump Sum (Tax-Free)</span>
                      </div>
                   </div>
                 }
               />
               <ExpandableCard 
                 icon={RefreshCw} title="What is an Annuity?" accentColor={COLORS.pink}
                 teaser="An annuity converts a lump sum into a guaranteed monthly pension for life."
                 expandedContent={
                   <p>Currently, annuity rates are around 6% p.a. If you annuitize ₹40 lakh, you get roughly ₹16,667 per month for life. You can choose options like 'with return of purchase price' (where your family gets the ₹40L back after you) or 'joint life' (covers your spouse too).</p>
                 }
               />
               <ExpandableCard 
                 icon={ArrowUpFromLine} title="Partial Withdrawals" accentColor={COLORS.emerald}
                 teaser="You can withdraw from NPS before 60 — but only 3 times for specific major life events."
                 expandedContent={
                   <ul className="text-sm font-bold space-y-2 list-disc pl-5">
                      <li>After 3 years of account opening</li>
                      <li>Max 25% of your own contributions only</li>
                      <li>Allowed for: Marriage/Education of kids, First Home, or Medical Crises</li>
                   </ul>
                 }
               />
               <ExpandableCard 
                 icon={LogOut} title="Exiting Before Age 60" accentColor={COLORS.amber}
                 teaser="Exiting premature is possible but requires 80% to be annuitized — a steep penalty."
                 expandedContent={
                   <p>If you exit NPS early, the rules flip: 80% MUST be used for annuity, and only 20% is given as lump sum. Exception: if your total corpus is below ₹2.5 lakh, you can withdraw everything at once. This is why NPS should be viewed as a 20-30 year commitment.</p>
                 }
               />
            </div>
         </section>

         {/* SECTION 4: Rules & Limits */}
         <section id="rules" className="scroll-mt-40 space-y-12 pb-32">
            <div className="space-y-2">
               <h2 className="font-heading font-black text-4xl md:text-5xl uppercase tracking-widest text-[#1E293B] flex items-center gap-4">
                  📋 Rules & Limits
               </h2>
               <p className="font-bold text-[#1E293B]/40 uppercase tracking-[4px] text-xs">The fine print that's actually useful</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
               <ExpandableCard 
                 icon={TrendingDown} title="The Equity Taper Cap" accentColor={COLORS.violet}
                 teaser="NPS limits your equity risk as you age — it drops automatically from age 50."
                 expandedContent={
                   <p>PFRDA tapers your max equity from 75% (age 50) to 50% (age 60) by 2.5% every year. This protects your hard-earned wealth from stock market crashes right before you retire. Our simulator in the dashboard automatically enforces this cap.</p>
                 }
               />
               <ExpandableCard 
                 icon={AlertCircle} title="Minimum Contributions" accentColor={COLORS.pink}
                 teaser="Miss the annual minimums and your account gets frozen — requiring a penalty to fix."
                 expandedContent={
                   <p>You must contribute at least ₹1,000 to your Tier I account every year. If you miss it, the account is frozen. You'll need to pay a ₹100 penalty per year of default plus the dues to unfreeze it. Keep your pulse active!</p>
                 }
               />
               <ExpandableCard 
                 icon={BarChart2} title="NPS vs PPF vs ELSS" accentColor={COLORS.amber}
                 teaser="NPS is unique for its dedicated ₹50k 80CCD(1B) bucket that no other scheme has."
                 expandedContent={
                   <p>While PPF is safe and ELSS is faster, NPS is the only one that builds is own 'locked' retirement corpus with dedicated tax benefits. It combines market-linked growth (like ELSS) with retirement-specific safety rules (like PFRDA equity caps).</p>
                 }
               />
               <ExpandableCard 
                 icon={Baby} title="NPS Vatsalya for Kids" accentColor={COLORS.emerald}
                 teaser="Parents can now open NPS for children — it converts to a regular account at 18."
                 expandedContent={
                   <p>Launched in 2024, NPS Vatsalya lets you start the power of compounding for your children early. At 18, it becomes a standard Tier I account, giving them a massive head start in life. Compounding over 50-60 years is exceptionally powerful.</p>
                 }
               />
            </div>
         </section>

      </main>

      {/* --- Footer CTA --- */}
      <section className="bg-[#8B5CF6] border-t-4 border-[#1E293B] py-24 px-6 text-center text-white relative overflow-hidden">
         <Confetti />
         <div className="relative z-10 max-w-4xl mx-auto space-y-8">
            <h2 className="font-heading font-black text-4xl md:text-6xl uppercase tracking-tighter leading-tight">
               Ready to see your <br/> retirement score?
            </h2>
            <p className="font-bold text-[#1E293B] bg-[#FFF8E7] px-6 py-2 rounded-full inline-block uppercase tracking-widest text-xs md:text-sm">
               It takes 2 minutes. No credit card required.
            </p>
            <div className="pt-4">
               <button 
                onClick={() => user ? navigate('/dashboard') : setIsAuthOpen(true)}
                className="candy-btn bg-white text-[#8B5CF6] px-10 py-5 font-heading font-black text-xl uppercase tracking-widest flex items-center gap-4 mx-auto group cursor-pointer"
               >
                  Get Started Free <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
               </button>
            </div>
         </div>
      </section>

      {/* --- Footer (Dark) --- */}
      <footer className="bg-[#1E293B] py-20 px-6 text-white border-t-2 border-white/10">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
               <div className="w-10 h-10 bg-[#8B5CF6] border-2 border-white rounded-full flex items-center justify-center">
                  <span className="font-heading font-extrabold text-white text-xl">R</span>
               </div>
               <span className="font-heading font-extrabold text-2xl tracking-tight">RetireSahi</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-8 font-bold uppercase tracking-widest text-xs">
               <button onClick={() => navigate('/')} className="hover:text-[#F472B6] transition-colors cursor-pointer">Features</button>
               <button onClick={() => navigate('/')} className="hover:text-[#FBBF24] transition-colors cursor-pointer">How It Works</button>
               <button onClick={() => navigate('/learn')} className="text-[#8B5CF6]">Learn</button>
               <button className="hover:text-[#34D399] transition-colors cursor-pointer">Privacy</button>
            </div>

            <div className="text-white/40 font-bold uppercase tracking-widest text-[9px]">
               © 2025 RetireSahi. Built for India's Future.
            </div>
         </div>
      </footer>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
