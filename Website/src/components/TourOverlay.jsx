import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

/**
 * TourOverlay — full-screen spotlight guided tour.
 * Uses an absolute positioning engine so elements scroll naturally with the page
 * without javascript tracking lag during scroll events.
 */
export default function TourOverlay({ steps, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  // document relative coordinates, almost never changes during scrolling!
  const [pageRect, setPageRect] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cardRef = useRef(null);
  
  const step = steps[currentStep];

  // ─── Measure target element (Document Relative) ─────────────────────
  useEffect(() => {
    if (!step) return;
    
    let rafId;
    let scrollAttempts = 0;
    let scrolledOnce = false;

    const measureAndSync = () => {
      const el = document.getElementById(step.targetId);
      if (el) {
        // Only scroll on exactly the first successful locate of the new step
        if (!scrolledOnce) {
          scrolledOnce = true;
          // Smooth scroll browser to the element
          el.scrollIntoView({ 
            block: 'center', 
            behavior: 'smooth' 
          });
        }

        const r = el.getBoundingClientRect();
        const pad = 12;
        
        // Convert viewport coordinates to document-absolute coordinates
        // This stops the rect from updating while the user is simply scrolling!
        const newRect = {
          x: r.x + window.scrollX - pad,
          y: r.y + window.scrollY - pad,
          w: r.width + pad * 2,
          h: r.height + pad * 2,
        };
        
        setPageRect(prev => {
          if (prev && 
              Math.abs(prev.x - newRect.x) < 0.5 && 
              Math.abs(prev.y - newRect.y) < 0.5 && 
              Math.abs(prev.w - newRect.w) < 0.5 && 
              Math.abs(prev.h - newRect.h) < 0.5) return prev;
          return newRect;
        });

      } else {
        // Element not mounted yet, keep trying
        scrollAttempts++;
        if (scrollAttempts > 60) return; // give up tracking
      }
      
      rafId = requestAnimationFrame(measureAndSync);
    };

    // Tiny delay so we don't measure during route transitions
    const timer = setTimeout(() => {
      rafId = requestAnimationFrame(measureAndSync);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [currentStep, step]);

  // ─── Keyboard handling ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ─── Focus trap ──────────────────────────────────────────────────
  useEffect(() => {
    if (!cardRef.current) return;
    const focusable = cardRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, [currentStep]);

  // ─── Navigation ──────────────────────────────────────────────────
  const goNext = () => {
    if (isTransitioning) return;
    if (currentStep < steps.length - 1) {
      setIsTransitioning(true);
      setCurrentStep((s) => s + 1);
      setTimeout(() => setIsTransitioning(false), 500); // match css transition
    } else {
      onComplete();
    }
  };
  
  const goPrev = () => {
    if (isTransitioning) return;
    if (currentStep > 0) {
      setIsTransitioning(true);
      setCurrentStep((s) => s - 1);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  };

  // ─── Card positioning ────────────────────────────────────────────
  const getCardStyle = () => {
    if (!pageRect) return { opacity: 0, top: 0, left: 0 };
    
    const cardW = Math.min(380, window.innerWidth - 32);
    const cardH = 220; // approximate height
    const gap = 20;

    let top = pageRect.y + pageRect.h + gap;
    // If placing below goes past document height, place above
    if (top + cardH > document.documentElement.scrollHeight) {
      top = pageRect.y - cardH - gap;
    }

    let left = pageRect.x + pageRect.w / 2 - cardW / 2;
    // Bound horizontally to window
    left = Math.max(16, Math.min(left, document.documentElement.scrollWidth - cardW - 16));

    return { 
      top, 
      left, 
      width: cardW,
      opacity: 1
    };
  };

  if (!step) return null;

  const cardStyle = getCardStyle();

  return (
    <div className="tour-overlay-root">
      
      {/* ── Click-to-skip backdrop (fixed invisibly over the screen) ── */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={onSkip}
        aria-label="Skip tour"
      />

      {/* ── Spotlight Hole & Dark Shadow ── */}
      {/* This uses an absolute positioning trick with a giant box-shadow 
          to render the dark overlay without complex SVGs. Since it's absolutely 
          positioned, it scrolls smoothly with the document without JS tracking lag. */}
      {pageRect && (
        <div
          className="tour-spotlight-hole"
          style={{
            position: 'absolute',
            top: pageRect.y,
            left: pageRect.x,
            width: pageRect.w,
            height: pageRect.h,
            borderRadius: 16,
            boxShadow: '0 0 0 9999px rgba(30, 41, 59, 0.75)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}

      {/* ── Pulse ring around target ── */}
      {pageRect && (
        <div
          className="tour-pulse-ring"
          style={{
            position: 'absolute',
            top: pageRect.y,
            left: pageRect.x,
            width: pageRect.w,
            height: pageRect.h,
            borderRadius: 16,
            border: '3px solid #8B5CF6',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        />
      )}

      {/* ── Tour Card ── */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${currentStep + 1} of ${steps.length}`}
        className="tour-card"
        style={{
          position: 'absolute',
          top: cardStyle.top,
          left: cardStyle.left,
          width: cardStyle.width,
          opacity: cardStyle.opacity,
          zIndex: 10001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator strip */}
        <div className="flex gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full flex-1"
              style={{
                backgroundColor: i <= currentStep ? '#8B5CF6' : 'rgba(255,255,255,0.15)',
                transition: 'background-color 0.3s ease'
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#FBBF24]" fill="currentColor" />
          <span className="text-[9px] font-black uppercase tracking-[3px] text-white/40">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        <h3
          className="font-heading font-extrabold text-xl text-white mb-2 leading-tight"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          {step.title}
        </h3>

        <p
          aria-live="polite"
          className="text-[12px] font-bold text-white/70 leading-relaxed mb-6"
        >
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors px-2 py-1"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={goPrev}
                disabled={isTransitioning}
                className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={goNext}
              disabled={isTransitioning}
              className="px-6 h-10 bg-[#8B5CF6] text-white rounded-full border-2 border-white/20 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-[#7C3AED] transition-colors shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] disabled:opacity-50"
            >
              {currentStep < steps.length - 1 ? (
                <>Next <ChevronRight className="w-4 h-4" /></>
              ) : (
                <>Finish <span>🎉</span></>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        /* Smooth transitions that map completely natively to scroll positioning */
        .tour-spotlight-hole,
        .tour-pulse-ring,
        .tour-card {
          transition: top 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                      left 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                      width 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                      height 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                      opacity 0.4s ease;
        }

        .tour-card {
          background: #1E293B;
          border: 2px solid #8B5CF6;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 8px 8px 0 0 rgba(139, 92, 246, 0.3);
        }
        
        .tour-pulse-ring {
          animation: tourPulse 2s ease-in-out infinite;
        }

        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .tour-card, .tour-spotlight-hole, .tour-pulse-ring {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
