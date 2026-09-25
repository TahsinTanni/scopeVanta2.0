"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";
import { ALL_PLAN_FEATURES, PLANS, PLAN_CURRENCY, TRIAL_DAYS } from "@/lib/plans";

// ---------------------------------------------------------------------------
// Real content only. Feature copy describes capabilities that exist in the
// app; plan prices, limits and the trial length come from lib/plans.ts, the
// same module checkout and the billing settings page use. No testimonials,
// customer logos or usage stats exist yet, so none are shown.
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: "Brief & Scope Analysis",
    description: "Turn a client brief into structured requirements, clarification questions, identified risks, and a proposal-ready scope.",
    label: "Discovery",
    icon: "psychology"
  },
  {
    title: "Scope & Margin Modeling",
    description: "Build estimate lines with hours and rates, then compare floor, recommended, and premium pricing against target margins.",
    label: "Economics",
    icon: "payments"
  },
  {
    title: "Proposal Audit",
    description: "Check requirements, deliverables, acceptance criteria, exclusions, and commercial consistency before sharing a proposal.",
    label: "Quality control",
    icon: "security"
  },
  {
    title: "Client Deal Room",
    description: "Share a secure proposal link where clients can review scope, select a package, accept, or request changes.",
    label: "Client review",
    icon: "send"
  },
  {
    title: "Scope Baselines & Changes",
    description: "Record an approved scope baseline, compare new requests against it, and prepare change orders with their commercial impact.",
    label: "Change control",
    icon: "history_edu"
  },
  {
    title: "Knowledge Base Grounding",
    description: "Upload service sheets, rate cards, and reference files so proposals are grounded in your workspace context.",
    label: "Workspace context",
    icon: "auto_stories"
  }
];

// Answers must stay true to the code: see lib/plans.ts for what differs by plan.
const FAQS = [
  {
    q: "How does pricing work?",
    a: `One flat monthly price per workspace, in ${PLAN_CURRENCY}, billed through Square. Plans differ only in how many new proposals you can create each month — every feature is included on every plan.`,
  },
  {
    q: "Is there a free trial?",
    a: `Yes. Your first ${TRIAL_DAYS} days are free. You set up your subscription through Square's secure checkout, and billing starts when the trial ends.`,
  },
  {
    q: "What counts toward my monthly proposal limit?",
    a: "Each new proposal you create in a calendar month. The count resets on the 1st, and you can move to a larger plan at any time if you need more.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. The workspace owner can switch plans from Plan & billing in settings.",
  },
  {
    q: "What do my clients see?",
    a: "A private share link to the proposal's deal room, where they can review the scope, choose a package, and accept or request changes. They don't need an account.",
  },
];

// Each card describes a real, already-built capability — rephrased from
// FEATURES above as an outcome sentence (not duplicated verbatim), traceable
// 1:1 back to a real FEATURES entry.
const CAROUSEL_CARDS = [
  {
    title: "From messy brief to priced scope",
    body: "Paste a client's raw brief and get back explicit milestones, bounded deliverables, and a risk score — in seconds, not a first-draft meeting.",
    icon: "psychology",
  },
  {
    title: "Protect your margin as you price",
    body: "Model fee sensitivity and contractor cost buffers live while you build the estimate, so a client's ask never quietly erodes your profit.",
    icon: "payments",
  },
  {
    title: "Stress-test the deal before you send it",
    body: "Run the proposal through an adversarial read that surfaces unbudgeted liabilities and vague terms before the client ever sees them.",
    icon: "security",
  },
  {
    title: "Let clients approve with one click",
    body: "Share a live portal link where the buyer reviews scope, picks a package, and accepts or requests changes — no separate contract tool.",
    icon: "send",
  },
  {
    title: "Catch scope creep as it happens",
    body: "When a request falls outside the agreed baseline, get it flagged as out-of-scope with an estimated hours impact and a drafted change order — ready for you to price and approve before any work begins.",
    icon: "history_edu",
  },
  {
    title: "Get smarter with every deal you close",
    body: "Every Won or Lost deal you close feeds its outcome and reasoning into the AI's context for your next proposal, so pricing and risk calls are grounded in your actual win/loss history, not guesswork.",
    icon: "auto_stories",
  },
];

const SECTION_NAV = [
  { id: "features", label: "Features" },
  { id: "capabilities", label: "What it actually does" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

// The landing page is always dark and has no theme toggle. The wrapper's
// `dark` class handles the page itself; this also darkens <html> so the
// scrollbar and overscroll area match, then restores the visitor's saved
// preference (same logic as the root layout's theme-init script) when they
// navigate into sign-in or the app.
function useForcedDarkDocument() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => {
      let dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      try {
        const saved = localStorage.getItem("scopevanta:theme");
        if (saved === "dark" || saved === "light") dark = saved === "dark";
      } catch {}
      root.classList.toggle("dark", dark);
    };
  }, []);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Fires once, the first time the element enters the viewport — a single
// IntersectionObserver callback per element, not a scroll-frame listener.
function useInView<T extends HTMLElement>(reduced: boolean) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  return { ref, inView };
}

function CountUp({ target, suffix, active, reduced }: { target: number; suffix: string; active: boolean; reduced: boolean }) {
  const [value, setValue] = useState(reduced ? target : 0);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const durationMs = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3)))); // ease-out
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduced]);

  return (
    <span className="font-mono tabular-nums">
      {value}
      {suffix}
    </span>
  );
}

// Decorative dot-grid + sparkle texture. Flat shapes (no blur/glow), themed
// entirely via the existing --accent-rgb token so it adapts to light/dark
// automatically. Drifts slower than the page on scroll (parallax) unless
// the visitor prefers reduced motion, in which case it never moves.
function BackgroundTexture({ reduced }: { reduced: boolean }) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (layerRef.current) {
          layerRef.current.style.transform = `translateY(${window.scrollY * 0.15}px)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const sparkles = [
    { top: "8%", left: "6%", size: 14, delay: "0s" },
    { top: "18%", left: "88%", size: 10, delay: "0.6s" },
    { top: "42%", left: "12%", size: 8, delay: "1.2s" },
    { top: "62%", left: "92%", size: 12, delay: "0.3s" },
    { top: "78%", left: "8%", size: 10, delay: "0.9s" },
    { top: "88%", left: "80%", size: 14, delay: "1.5s" },
  ];

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        ref={layerRef}
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(var(--accent-rgb), 0.16) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="absolute animate-pulse motion-reduce:animate-none"
          style={{ top: s.top, left: s.left, animationDelay: s.delay, animationDuration: "3.4s" }}
        >
          <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M2 12h20" stroke="rgba(var(--accent-rgb), 0.35)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}

const BRIEF_TEXT =
  "New brief: rebuild our marketing site in 6 weeks, integrate with our CRM, budget around $18k.";
const TYPE_CHAR_MS = 28;
const ANALYZE_MS = 1000;
const RESULT_HOLD_MS = 3600;

// Live, looping mockup of ScopeVanta's own product surface — a brief typing
// itself out, a short "analyzing" beat, then the real risk-score + phase
// breakdown result, looping back to a fresh brief. Never a static screenshot.
function ProductMockup({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState<0 | 1 | 2>(0); // 0: typing brief, 1: analyzing, 2: result
  const [typed, setTyped] = useState(0);
  const RISK_TARGET = 22; // "Low" risk, matching this component's own displayed badge
  const LINES = [
    "Phase 1 — Discovery & wireframes (2 wks)",
    "Phase 2 — Build & integration (5 wks)",
    "Phase 3 — QA, handoff & launch (1 wk)",
  ];

  // Phase machine — extends the existing timeout-chain loop with a typing
  // step and an analyzing step ahead of the original result phase.
  useEffect(() => {
    if (reduced) {
      setPhase(2);
      setTyped(BRIEF_TEXT.length);
      return;
    }
    const typingMs = BRIEF_TEXT.length * TYPE_CHAR_MS;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    const loop = () => {
      setPhase(0);
      t1 = setTimeout(() => setPhase(1), typingMs + 300);
      t2 = setTimeout(() => setPhase(2), typingMs + 300 + ANALYZE_MS);
      t3 = setTimeout(loop, typingMs + 300 + ANALYZE_MS + RESULT_HOLD_MS);
    };
    loop();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [reduced]);

  // Character-by-character reveal, restarted each time phase 0 begins.
  useEffect(() => {
    if (phase !== 0 || reduced) return;
    setTyped(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= BRIEF_TEXT.length) clearInterval(id);
    }, TYPE_CHAR_MS);
    return () => clearInterval(id);
  }, [phase, reduced]);

  const riskWidth = phase >= 2 ? RISK_TARGET : 0;

  return (
    <div className="mx-auto mt-14 max-w-3xl">
      <div className="overflow-hidden rounded-[12px] border border-border-hairline bg-surface-1/95 shadow-2xl backdrop-blur-sm">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border-hairline bg-surface-2/80 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 flex-1 truncate rounded-full bg-surface-1 px-3 py-1 text-center text-[11px] font-mono text-ink-muted">
            app.scopevanta.com/proposals/{phase === 2 ? "acme-co" : "new"}
          </span>
        </div>

        {/* Mock product surface — one phase visible at a time */}
        <div className="p-5 sm:p-7 text-left min-h-[220px]">
          {phase === 0 && (
            <div className="animate-[fade-in_300ms_ease-out] motion-reduce:animate-none">
              <p className="text-xs font-mono uppercase tracking-wider text-ink-muted">New Brief</p>
              <p className="mt-3 min-h-[72px] text-sm text-ink-secondary font-body leading-relaxed">
                {BRIEF_TEXT.slice(0, typed)}
                <span className="ml-0.5 inline-block h-4 w-[2px] -mb-0.5 bg-accent animate-pulse motion-reduce:hidden" />
              </p>
            </div>
          )}

          {phase === 1 && (
            <div className="flex min-h-[172px] flex-col items-center justify-center gap-3 text-center animate-[fade-in_300ms_ease-out] motion-reduce:animate-none">
              <span className="material-symbols-outlined text-[28px] text-accent animate-spin motion-reduce:animate-none">
                progress_activity
              </span>
              <p className="text-xs font-mono uppercase tracking-wider text-ink-muted">Analyzing brief…</p>
            </div>
          )}

          {phase === 2 && (
            <div className="animate-[fade-in_300ms_ease-out] motion-reduce:animate-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-ink-muted">Client</p>
                  <p className="font-display text-lg font-medium text-ink-primary">Acme Co — Website Rebuild</p>
                </div>
                <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-success">
                  Draft
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                  <span>Risk Score</span>
                  <span className="text-ink-secondary">
                    <CountUp target={riskWidth} suffix=" / 100" active={phase === 2} reduced={reduced} />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-[1200ms] ease-out"
                    style={{ width: `${riskWidth}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 space-y-1.5 border-t border-border-subtle pt-4">
                {LINES.map((line) => (
                  <p key={line} className="text-xs text-ink-secondary font-body">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Reveal({
  as: Tag = "div",
  reduced,
  className = "",
  children,
}: {
  as?: React.ElementType;
  reduced: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(reduced);
  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${className}`}
    >
      {children}
    </Tag>
  );
}

// Horizontal infinite-scroll strip of real capability names (LogoLoop
// pattern, no library): the content list is rendered twice back-to-back and
// the track translates by exactly -50% so the loop is seamless. It continues
// through hover and freezes entirely under reduced motion.
function CapabilityLoop({ reduced }: { reduced: boolean }) {
  const chips = [...FEATURES, ...FEATURES];

  return (
    // No card/border/dot-grid wrapper — a bare, full-bleed strip sitting
    // directly on the page background, same as the reference LogoLoop usage
    // (plain `overflow:hidden` container, no boxed treatment).
    <div
      className="relative overflow-hidden"
      style={{ height: 96 }}
    >
      {/* Edge fade to the actual page background, not a card surface */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28 bg-gradient-to-r from-surface-0 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28 bg-gradient-to-l from-surface-0 to-transparent" />
      <div className="absolute inset-0 flex items-center">
        {/* Inline animation (not a Tailwind arbitrary class) so it never
            depends on the CSS bundle having recompiled a new class string. */}
        <div
          className="flex w-max items-center gap-10 sm:gap-14"
          style={
            reduced
              ? undefined
              : {
                  animationName: "sv-marquee",
                  animationDuration: "12s",
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                }
          }
        >
          {chips.map((f, i) => (
            <span
              key={`${f.title}-${i}`}
              className="flex shrink-0 items-center gap-2.5 text-sm font-mono text-ink-muted transition-colors hover:text-ink-primary"
            >
              <span className="material-symbols-outlined text-[20px] text-accent">{f.icon}</span>
              {f.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Fixed vertical section nav (desktop only). Tracks the active section via
// scroll position and shifts/scales the nearest marker on mouse proximity —
// built from the described behavior, no source available to copy from.
function SectionNav({ reduced }: { reduced: boolean }) {
  const [activeId, setActiveId] = useState(SECTION_NAV[0].id);
  const [proximity, setProximity] = useState<number[]>(SECTION_NAV.map(() => 0));
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const elements = SECTION_NAV.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const next = itemRefs.current.map((el) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(e.clientY - center);
      return Math.max(0, 1 - dist / 90); // 0 far, 1 right at the marker
    });
    setProximity(next);
  }

  function onMouseLeave() {
    setProximity(SECTION_NAV.map(() => 0));
  }

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  return (
    <div
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:flex lg:flex-col lg:gap-5"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      aria-label="Section navigation"
    >
      {SECTION_NAV.map((s, i) => {
        const isActive = activeId === s.id;
        const p = Math.max(proximity[i] ?? 0, isActive ? 1 : 0);
        return (
          <button
            key={s.id}
            type="button"
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            onClick={() => goTo(s.id)}
            className="flex items-center justify-end gap-2.5"
            aria-current={isActive ? "true" : undefined}
          >
            <span
              className="whitespace-nowrap text-[10px] font-mono uppercase tracking-wider transition-all duration-200"
              style={{
                opacity: 0.35 + p * 0.65,
                color: p > 0.15 ? "var(--accent)" : "var(--text-muted)",
                transform: `translateX(${-p * 2}px)`,
              }}
            >
              {s.label}
            </span>
            <span
              className="h-px rounded-full transition-all duration-200"
              style={{
                width: 16 + p * 12,
                backgroundColor: p > 0.15 ? "var(--accent)" : "var(--border-hairline)",
                transform: `scaleY(${1 + p * 2.2})`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

// Horizontally swipeable card carousel (CSS scroll-snap, no library). Prev/
// next buttons and dot indicators stay in sync with the real scroll position
// via a scroll listener, so dragging/swiping and the buttons agree.
// Side-by-side cards, auto-scrolling right to left in a seamless loop — same
// proven technique as CapabilityLoop (content rendered twice,
// translated by exactly -50% via the sv-marquee keyframe, applied as an
// inline animation so it never depends on a Tailwind class being freshly
// compiled). Continues through hover; frozen under reduced motion. Card copy is
// unchanged from CAROUSEL_CARDS — only the presentation changed.
function CardMarquee({ reduced }: { reduced: boolean }) {
  const cards = [...CAROUSEL_CARDS, ...CAROUSEL_CARDS];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 sm:w-24 bg-gradient-to-r from-surface-0 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 sm:w-24 bg-gradient-to-l from-surface-0 to-transparent" />
      <div
        className="flex w-max items-stretch gap-6"
        style={
          reduced
            ? undefined
            : {
                animationName: "sv-marquee",
                animationDuration: "36s",
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
              }
        }
      >
        {cards.map((card, i) => (
          <div
            key={`${card.title}-${i}`}
            className="flex aspect-square w-[340px] shrink-0 flex-col rounded-[16px] border border-border-hairline bg-surface-1 p-7 shadow-xl"
          >
            <span className="material-symbols-outlined text-[28px] text-accent">{card.icon}</span>
            <h3 className="mt-4 font-display text-xl font-medium leading-snug text-ink-primary tracking-tight">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted font-body">{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIMARY_CTA = "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-all shadow-[0_4px_20px_rgba(var(--accent-rgb),0.35)]";
const SECONDARY_CTA = "inline-flex items-center justify-center gap-2 rounded-full border border-border-hairline bg-surface-1/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:bg-surface-2 hover:text-ink-primary transition-all";
const TRIAL_CTA = `Start ${TRIAL_DAYS}-day free trial`;

// Hero entrance runs as a pure CSS animation from the server-rendered HTML,
// so the headline is visible without waiting for JavaScript to hydrate.
// (The previous version held it at opacity 0 until a client-side mount flag
// flipped, which delayed the page's largest paint.)
const LOCAL_CSS = `
  @keyframes sv-rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .sv-rise { animation: sv-rise 600ms ease-out both; }
  @keyframes sv-marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-rise { animation: none; }
  }
`;

function SectionHeading({ eyebrow, title, subtitle, reduced }: { eyebrow: string; title: string; subtitle?: string; reduced: boolean }) {
  return (
    <Reveal reduced={reduced} className="mb-12 text-center">
      <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">{eyebrow}</p>
      <h2 className="font-display text-3xl sm:text-4xl font-normal text-ink-primary tracking-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-sm text-ink-muted max-w-xl mx-auto font-body">{subtitle}</p>}
    </Reveal>
  );
}

function Logo({ size = "h-7 w-7 rounded-[4px]" }: { size?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${size} bg-accent flex items-center justify-center text-[#002116] font-bold text-xs tracking-wider shadow-sm`}>SV</div>
      <span className="font-display text-xl font-medium tracking-tight text-ink-primary">ScopeVanta</span>
    </div>
  );
}

export default function LandingPage() {
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const pricingGridRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  useForcedDarkDocument();

  return (
    // `dark` on this wrapper re-scopes every theme token to the dark palette
    // for the landing page only, from the first server-rendered paint.
    <div className="dark relative min-h-screen bg-surface-0 text-ink-primary font-body overflow-x-hidden selection:bg-accent/30 selection:text-white">
      <style>{LOCAL_CSS}</style>
      <BackgroundTexture reduced={reduced} />
      <SectionNav reduced={reduced} />

      {/* Global Cursor Spotlight for Interactive Bento Grids */}
      <GlobalSpotlight gridRef={bentoGridRef} glowColor="78, 135, 112" spotlightRadius={360} />
      <GlobalSpotlight gridRef={pricingGridRef} glowColor="78, 135, 112" spotlightRadius={360} />

      {/* Navigation Header */}
      <header className="relative z-50 border-b border-border-hairline/60 bg-surface-0/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="ScopeVanta home">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs font-mono uppercase tracking-wider text-ink-muted" aria-label="Primary">
            {SECTION_NAV.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="hover:text-ink-primary transition-colors">
                {s.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="text-xs font-medium text-ink-secondary hover:text-ink-primary px-2 sm:px-3.5 py-1.5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-all shadow-[0_2px_12px_rgba(var(--accent-rgb),0.3)]"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-20 sm:pt-24 pb-20 px-6 max-w-5xl mx-auto text-center">
          <p className="sv-rise text-xs font-mono uppercase tracking-wider text-accent-hover" style={{ animationDelay: "0ms" }}>
            For agencies, studios &amp; consultants who price client work
          </p>
          <h1 className="mt-5 font-display text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-ink-primary leading-[1.1]">
            <span className="sv-rise block" style={{ animationDelay: "100ms" }}>
              Build clearer scopes and
            </span>
            <span className="sv-rise block italic font-medium text-accent-hover" style={{ animationDelay: "220ms" }}>
              more profitable agreements.
            </span>
          </h1>

          <p
            className="sv-rise mt-6 max-w-2xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed font-display"
            style={{ animationDelay: "340ms" }}
          >
            Turn a messy client brief into a priced, risk-checked proposal your client can approve online — then keep every change request inside the margin you agreed.
          </p>

          <div className="sv-rise mt-10 flex flex-col sm:flex-row items-center justify-center gap-3" style={{ animationDelay: "460ms" }}>
            <Link href="/sign-up" className={`w-full sm:w-auto ${PRIMARY_CTA}`}>
              <span>{TRIAL_CTA}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
            <a href="#capabilities" className={`w-full sm:w-auto ${SECONDARY_CTA}`}>
              <span>See what it does</span>
            </a>
          </div>

          {/* Live product mockup — not a static screenshot */}
          <div className="sv-rise" style={{ animationDelay: "560ms" }}>
            <ProductMockup reduced={reduced} />
          </div>
        </section>

        {/* Capability loop */}
        <section aria-label="Platform capabilities" className="pb-6">
          <Reveal reduced={reduced}>
            <CapabilityLoop reduced={reduced} />
          </Reveal>
        </section>

        {/* Feature Bento Grid Section */}
        <section id="features" className="scroll-mt-20 py-20 px-6 max-w-7xl mx-auto">
          <SectionHeading
            reduced={reduced}
            eyebrow="Features"
            title="Everything between the brief and the signature"
            subtitle="Scope it, price it, check it, and get it approved — without losing margin along the way."
          />

          <Reveal reduced={reduced}>
            <BentoCardGrid gridRef={bentoGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => (
                <BentoCard key={feature.title} className="p-6 flex flex-col min-h-[200px]" glowColor="78, 135, 112">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-accent-hover font-medium">
                      {feature.label}
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-ink-muted">{feature.icon}</span>
                  </div>
                  <div className="mt-4">
                    <h3 className="font-display text-xl font-medium text-ink-primary mb-2 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-ink-muted leading-relaxed font-body">
                      {feature.description}
                    </p>
                  </div>
                </BentoCard>
              ))}
            </BentoCardGrid>
          </Reveal>
        </section>

        {/* Feature Carousel */}
        <section id="capabilities" className="py-20 px-6 max-w-7xl mx-auto border-t border-border-hairline/60">
          <Reveal reduced={reduced} className="mb-10 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">What It Actually Does</p>
            <h2 className="font-display text-3xl sm:text-4xl font-normal text-ink-primary tracking-tight">
              Every capability, in motion
            </h2>
          </Reveal>

          <div className="mt-14">
            <Reveal reduced={reduced}>
              <CardMarquee reduced={reduced} />
            </Reveal>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="scroll-mt-20 py-24 px-6 max-w-7xl mx-auto border-t border-border-hairline/60">
          <SectionHeading
            reduced={reduced}
            eyebrow="Pricing"
            title="Simple plans. Every feature included."
            subtitle={`Pick a plan by how many proposals you send. One flat price per workspace, billed monthly in ${PLAN_CURRENCY} through Square. First ${TRIAL_DAYS} days free.`}
          />

          <Reveal reduced={reduced}>
            <BentoCardGrid gridRef={pricingGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {PLANS.map((tier) => (
                <BentoCard
                  key={tier.name}
                  className={`p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-accent ${
                    tier.popular
                      ? "border-accent/60 bg-surface-2/95 shadow-[0_0_30px_rgba(var(--accent-rgb),0.15)]"
                      : "border-border-hairline bg-surface-1/90"
                  }`}
                  glowColor="78, 135, 112"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-2xl font-medium text-ink-primary">{tier.name}</h3>
                      {tier.popular && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent/20 text-accent-hover border border-accent/40 font-semibold">
                          Most popular
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl font-semibold text-ink-primary tracking-tight">{tier.price}</span>
                      <span className="text-xs font-mono text-ink-muted">
                        {PLAN_CURRENCY} {tier.cadence}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-ink-muted leading-relaxed font-body">{tier.description}</p>

                    <p className="mt-6 flex items-center gap-2.5 border-t border-border-subtle pt-6 text-sm font-medium text-ink-primary">
                      <span className="material-symbols-outlined text-accent text-[18px]">description</span>
                      {tier.limit}
                    </p>
                  </div>

                  <Link
                    href="/sign-up"
                    className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                      tier.popular
                        ? "bg-accent text-[#002116] hover:bg-accent-hover active:bg-accent-pressed shadow-[0_2px_12px_rgba(var(--accent-rgb),0.25)]"
                        : "border border-border-hairline bg-surface-2 text-ink-primary hover:bg-surface-3"
                    }`}
                  >
                    <span>Start free trial</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </BentoCard>
              ))}
            </BentoCardGrid>
          </Reveal>

          <Reveal reduced={reduced} className="mx-auto mt-10 max-w-5xl rounded-[16px] border border-border-hairline bg-surface-1/80 p-6 sm:p-8">
            <p className="text-[11px] font-mono font-medium uppercase tracking-wider text-ink-secondary">Included on every plan</p>
            <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {ALL_PLAN_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm text-ink-secondary font-body">
                  <span className="material-symbols-outlined text-accent text-[16px] mt-0.5 shrink-0">check_circle</span>
                  {feat}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20 px-6 max-w-3xl mx-auto border-t border-border-hairline/60">
          <SectionHeading reduced={reduced} eyebrow="FAQ" title="Common questions" />
          <Reveal reduced={reduced} className="divide-y divide-border-hairline overflow-hidden rounded-[16px] border border-border-hairline bg-surface-1">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group relative px-6 py-5 transition-colors duration-300 hover:bg-accent/[0.06] focus-within:bg-accent/[0.06] motion-reduce:transition-none"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-medium text-ink-primary outline-none [&::-webkit-details-marker]:hidden">
                  {/* Accent bar that grows in from the middle on hover/focus. Lives inside
                      <summary> because a closed <details> hides its other children. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-3 left-0 w-[3px] origin-center scale-y-0 rounded-full bg-accent transition-transform duration-300 ease-out group-hover:scale-y-100 group-focus-within:scale-y-100 group-open:scale-y-100 motion-reduce:transition-none"
                  />
                  <span className="transition-[transform,color] duration-300 ease-out group-hover:translate-x-1 group-hover:text-accent-hover group-focus-within:translate-x-1 group-focus-within:text-accent-hover motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                    {item.q}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-300 ease-out group-hover:scale-110 group-hover:bg-accent/15 group-focus-within:bg-accent/15 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                    <span className="material-symbols-outlined text-[20px] text-ink-muted transition-[transform,color] duration-300 group-hover:text-accent-hover group-open:rotate-45 group-open:text-accent-hover">
                      add
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted font-body">{item.a}</p>
              </details>
            ))}
          </Reveal>
        </section>

        {/* Closing CTA */}
        <section className="px-6 pb-24">
          <Reveal
            reduced={reduced}
            className="mx-auto max-w-4xl rounded-[20px] border border-accent/40 bg-surface-2/95 px-6 py-14 text-center shadow-[0_0_40px_rgba(var(--accent-rgb),0.12)]"
          >
            <h2 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink-primary">
              Send your next proposal with confidence.
            </h2>
            <p className="mt-3 text-sm text-ink-muted font-body">
              {TRIAL_DAYS} days free. Every feature included.
            </p>
            <Link href="/sign-up" className={`${PRIMARY_CTA} mt-8`}>
              <span>{TRIAL_CTA}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-hairline/60 bg-surface-1/50 px-6 pt-8 pb-5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-6 border-b border-border-hairline/60 pb-8 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))]">
            <div className="max-w-sm">
              <Logo size="h-8 w-8 rounded-[5px]" />
              <p className="mt-3 text-sm leading-relaxed text-ink-muted font-body">
                Build clearer scopes, protect your margins, and send agreements with confidence.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-mono font-medium uppercase tracking-wider text-ink-secondary">Explore</p>
              <nav className="mt-4 flex flex-col items-start gap-3 text-sm text-ink-muted font-body" aria-label="Footer navigation">
                {SECTION_NAV.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="hover:text-accent-hover transition-colors">
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>

            <div>
              <p className="text-[11px] font-mono font-medium uppercase tracking-wider text-ink-secondary">Account</p>
              <nav className="mt-4 flex flex-col items-start gap-3 text-sm text-ink-muted font-body" aria-label="Account navigation">
                <Link href="/sign-in" className="hover:text-accent-hover transition-colors">Sign in</Link>
                <Link href="/sign-up" className="hover:text-accent-hover transition-colors">Create an account</Link>
                <Link href="/terms" className="hover:text-accent-hover transition-colors">Terms of Service</Link>
                <Link href="/privacy" className="hover:text-accent-hover transition-colors">Privacy Policy</Link>
                <Link href="/refunds" className="hover:text-accent-hover transition-colors">Cancellation &amp; Refunds</Link>
              </nav>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-5 text-[11px] font-mono text-ink-disabled sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} ScopeVanta. All rights reserved.</span>
            <span className="uppercase tracking-wider">Commercial clarity for service businesses</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
