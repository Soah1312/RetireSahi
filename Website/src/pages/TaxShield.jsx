import React from 'react';
import { ShieldAlert, Construction } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
const PageContent = () => {
  return (
    <div className="min-h-[70vh] p-3 sm:p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center">
      <section className="w-full rounded-[28px] sm:rounded-[36px] border-2 border-[#1E293B] bg-white p-5 sm:p-8 md:p-12 pop-shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 h-56 w-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#FBBF24]/20" />
        <div className="absolute left-0 bottom-0 h-72 w-72 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#8B5CF6]/10" />

        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-3 rounded-full border-2 border-[#1E293B] bg-[#FFFDF5] px-4 py-2 text-[10px] font-black uppercase tracking-[4px] text-[#1E293B] shadow-[3px_3px_0_0_#1E293B]">
            <Construction className="h-4 w-4 text-[#F97316]" />
            Under Construction
          </div>

          <div className="w-20 h-20 rounded-full border-2 border-[#1E293B] bg-[#FFFDF5] flex items-center justify-center shadow-[4px_4px_0_0_#1E293B]">
            <ShieldAlert className="h-10 w-10 text-[#EF4444]" />
          </div>

          <div className="space-y-3 max-w-2xl">
            <h1 className="font-heading text-3xl md:text-5xl font-black uppercase tracking-tight text-[#1E293B] leading-tight">
              Tax Shield is being rebuilt
            </h1>
            <p className="text-sm md:text-base font-bold leading-relaxed text-[#1E293B]/70">
              This section is not ready yet. We are redesigning the tax experience, so for now the dashboard will show this placeholder instead of the full Tax Shield view.
            </p>
          </div>

          <div className="rounded-[28px] border-2 border-dashed border-[#1E293B]/20 bg-[#FFFDF5] px-6 py-5 max-w-xl">
            <p className="text-xs md:text-sm font-black uppercase tracking-[3px] text-[#EF4444]">
              Coming soon: a full tax battle mode with strategy cards, leakage analysis, and personalized optimization.
            </p>
          </div>
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
