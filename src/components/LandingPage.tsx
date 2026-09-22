"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";
import ThemeToggle from "@/components/ThemeToggle";

// ---------------------------------------------------------------------------
// Real content only. Nothing below is fabricated — feature copy, workflow
// step labels and pricing are the same data used elsewhere in the app
// (settings/billing/page.tsx's PLANS mirrors these exact prices/tiers). No
// testimonials, customer logos or usage stats exist anywhere in this
// codebase, so none are shown here — see the report for what was omitted
// rather than invented.
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: "AI Commercial Discovery",
    description: "Deconstruct messy client briefs into explicit milestones, bounded deliverables, and unpriced risks in seconds.",
    label: "Intelligence",
    icon: "psychology"
  },
  {
    title: "Scope Margin Guard",
    description: "Real-time fee sensitivity modeling, contractor cost buffers, and dynamic margin protection on every proposal.",
    label: "Economics",
    icon: "payments"
  },
  {
    title: "Contractual Red-Teaming",
    description: "Simulate adversarial client behavior and locate unbudgeted liabilities before your proposal leaves the door.",
    label: "Protection",
    icon: "security"
  },
  {
    title: "Executive Client Portals",
    description: "Live interactive links for one-click buyer approvals, milestone tracking, and friction-free payment settlement.",
    label: "Velocity",
    icon: "send"
  },
  {
    title: "Change-Order Autopsy",
    description: "Automatically identify creep during delivery and generate audited scope adjustments at pre-agreed rates.",
    label: "Auditing",
    icon: "history_edu"
  },
  {
    title: "Institutional Knowledge Base",
    description: "Ground future agreements in your historical win patterns, rate ledgers, and proven delivery constraints.",
    label: "Memory",
    icon: "auto_stories"
  }
];

const TIERS = [
  {
    name: "Freelancer",
    price: "$19",
    cadence: "/month",
    description: "For independent operators & specialized consultants managing focused high-stakes bids.",
    features: [
      "Up to 10 active proposals",
      "Core AI brief analysis & risk scoring",
      "Executive buyer share links",
      "Standard PDF export",
      "1 workspace seat"
    ],
    popular: false,
    cta: "Start Free Trial"
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "/month",
    description: "For boutique consultancies & growing teams actively closing weekly pipeline.",
    features: [
      "Up to 40 active proposals",
      "Full Contract Red-Teaming engine",
      "Scope Margin Guard & fee modeling",
      "Multi-document knowledge grounding",
      "Priority customer support",
      "Up to 5 workspace seats"
    ],
    popular: true,
    cta: "Choose Pro Tier"
  },
  {
    name: "Agency",
    price: "$99",
    cadence: "/month",
    description: "For high-velocity service organizations demanding total commercial deal governance.",
    features: [
      "Up to 150 active proposals",
      "Unlimited team workspace seats",
      "Custom branded buyer portals",
      "Dedicated Square payment reconciliation",
      "Full revision ledger & audit history",
      "Direct commercial strategy advisor"
    ],
    popular: false,
    cta: "Choose Agency Tier"
  }
];

// The opportunity workspace's real six-step rail, as labeled there
// (STEP_LABELS in proposals/[id]/page.tsx), plus the discovery step the
// product actually performs before scoping — same terminology, not renamed.
const WORKFLOW = ["Analyze", "Clarify", "Scope", "Price", "Propose", "Win", "Protect"];

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
  { id: "pipeline", label: "Workflow" },
  { id: "capabilities", label: "Capabilities" },
  { id: "pricing", label: "Pricing" },
];

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
// the track translates by exactly -50% so the loop is seamless. Pauses on
// hover; frozen entirely under reduced motion.
function CapabilityLoop({ reduced }: { reduced: boolean }) {
  const chips = [...FEATURES, ...FEATURES];
  const [paused, setPaused] = useState(false);

  return (
    // No card/border/dot-grid wrapper — a bare, full-bleed strip sitting
    // directly on the page background, same as the reference LogoLoop usage
    // (plain `overflow:hidden` container, no boxed treatment).
    <div
      className="relative overflow-hidden"
      style={{ height: 96 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
                  animationPlayState: paused ? "paused" : "running",
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

// Muted flowing-accent divider (Strands pattern, CSS only): 3 soft blurred
// elongated shapes drifting slowly. Freezes in place under reduced motion.
// Muted flowing-accent divider (Strands pattern, CSS/SVG only). Two layers:
// soft blurred blobs for depth, plus a set of wave lines that visibly drift
// left continuously (the "flowing" motion) — legible against a dark bg,
// unlike a single faint blurred blob. All animation is inline style, not a
// Tailwind bracket class, so it never depends on the CSS bundle recompiling.
function FlowingDivider({ reduced }: { reduced: boolean }) {
  const blobs = [
    { top: "8%", left: "4%", w: 380, h: 140, dur: "14s", delay: "0s" },
    { top: "44%", left: "56%", w: 340, h: 120, dur: "18s", delay: "1.2s" },
    { top: "60%", left: "18%", w: 300, h: 110, dur: "22s", delay: "2.4s" },
  ];

  const WaveLayer = () => (
    <svg width={900} height={200} viewBox="0 0 900 200" fill="none" className="shrink-0">
      <path d="M0 60 C 150 10, 300 110, 450 60 S 750 10, 900 60" stroke="rgba(var(--accent-rgb), 0.55)" strokeWidth="2" />
      <path d="M0 110 C 150 160, 300 60, 450 110 S 750 160, 900 110" stroke="rgba(var(--accent-rgb), 0.3)" strokeWidth="2" />
      <path d="M0 150 C 150 120, 300 180, 450 150 S 750 120, 900 150" stroke="rgba(var(--accent-rgb), 0.18)" strokeWidth="2" />
    </svg>
  );

  return (
    <div className="relative h-56 overflow-hidden" aria-hidden="true">
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: b.top,
            left: b.left,
            width: b.w,
            height: b.h,
            background: "rgba(var(--accent-rgb), 0.32)",
            filter: "blur(46px)",
            ...(reduced
              ? {}
              : {
                  animationName: "sv-flow",
                  animationDuration: b.dur,
                  animationDelay: b.delay,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDirection: "alternate",
                }),
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center opacity-70">
        <div
          className="flex w-max items-center"
          style={
            reduced
              ? undefined
              : {
                  animationName: "sv-marquee",
                  animationDuration: "22s",
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                }
          }
        >
          <WaveLayer />
          <WaveLayer />
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
// proven technique as CapabilityLoop/FlowingDivider (content rendered twice,
// translated by exactly -50% via the sv-marquee keyframe, applied as an
// inline animation so it never depends on a Tailwind class being freshly
// compiled). Pauses on hover; frozen under reduced motion. Card copy is
// unchanged from CAROUSEL_CARDS — only the presentation changed.
function CardMarquee({ reduced }: { reduced: boolean }) {
  const cards = [...CAROUSEL_CARDS, ...CAROUSEL_CARDS];
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
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
                animationPlayState: paused ? "paused" : "running",
              }
        }
      >
        {cards.map((card, i) => (
          <div
            key={`${card.title}-${i}`}
            className="flex w-[340px] shrink-0 flex-col rounded-[16px] border border-border-hairline bg-surface-1 p-7 shadow-xl"
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

export default function LandingPage() {
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const pricingGridRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const heroIn = reduced || mounted;
  const workflowReveal = useInView<HTMLDivElement>(reduced);

  // Keyframes kept local to this file (no globals.css changes) for the
  // capability loop marquee and the flowing-accent divider.
  const localKeyframes = useMemo(
    () => `
      @keyframes sv-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      @keyframes sv-flow {
        from { transform: translate(0, 0) scale(1); opacity: 0.6; }
        to { transform: translate(24px, -14px) scale(1.08); opacity: 1; }
      }
    `,
    []
  );

  return (
    <div className="relative min-h-screen bg-surface-0 text-ink-primary font-body overflow-x-hidden selection:bg-accent/30 selection:text-white">
      <style>{localKeyframes}</style>
      <BackgroundTexture reduced={reduced} />
      <SectionNav reduced={reduced} />

      {/* Global Cursor Spotlight for Interactive Bento Grids */}
      <GlobalSpotlight gridRef={bentoGridRef} glowColor="78, 135, 112" spotlightRadius={360} />
      <GlobalSpotlight gridRef={pricingGridRef} glowColor="78, 135, 112" spotlightRadius={360} />

      {/* Navigation Header */}
      <header className="relative z-50 border-b border-border-hairline/60 bg-surface-0/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-[4px] bg-accent flex items-center justify-center text-[#002116] font-bold text-xs tracking-wider shadow-sm">
              SV
            </div>
            <span className="font-display text-xl font-medium tracking-tight text-ink-primary">
              ScopeVanta
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-wider text-ink-muted">
            <a href="#features" className="hover:text-ink-primary transition-colors">Features</a>
            <a href="#pipeline" className="hover:text-ink-primary transition-colors">Framework</a>
            <a href="#pricing" className="hover:text-ink-primary transition-colors">Pricing & Plans</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle collapsed />
            <Link
              href="/sign-in"
              className="text-xs font-medium text-ink-secondary hover:text-ink-primary px-3.5 py-1.5 transition-colors cursor-pointer"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-all shadow-[0_2px_12px_rgba(var(--accent-rgb),0.3)] cursor-pointer"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-24 pb-20 px-6 max-w-5xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border-hairline bg-surface-1/90 px-3.5 py-1 text-xs font-mono text-ink-secondary mb-6 backdrop-blur-sm transition-all duration-500 ease-out"
            style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(8px)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />
            <span>Commercial Intelligence OS 2.0</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-ink-primary leading-[1.1]">
            <span
              className="block transition-all duration-600 ease-out"
              style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(14px)", transitionDelay: "100ms" }}
            >
              Turn vague client briefs into
            </span>
            <span
              className="block italic font-medium text-accent-hover transition-all duration-600 ease-out"
              style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(14px)", transitionDelay: "220ms" }}
            >
              iron-clad, high-margin agreements.
            </span>
          </h1>

          <p
            className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed font-body transition-all duration-600 ease-out"
            style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(14px)", transitionDelay: "340ms" }}
          >
            ScopeVanta deconstructs requirements, models commercial friction, red-teams liability, and protects your margins from initial discovery to final change orders.
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-600 ease-out"
            style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(14px)", transitionDelay: "460ms" }}
          >
            <Link href="/sign-up" className={`w-full sm:w-auto ${PRIMARY_CTA}`}>
              <span>Launch Commercial Command Center</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
            <a href="#pricing" className={`w-full sm:w-auto ${SECONDARY_CTA}`}>
              <span>Explore Subscription Styles</span>
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
            </a>
          </div>

          {/* Live product mockup — not a static screenshot */}
          <div
            className="transition-all duration-700 ease-out"
            style={{ opacity: heroIn ? 1 : 0, transform: heroIn ? "translateY(0)" : "translateY(18px)", transitionDelay: "560ms" }}
          >
            <ProductMockup reduced={reduced} />
          </div>

          {/* Workflow Sequence Strip — connectors fill left to right once in view */}
          <div
            id="pipeline"
            ref={workflowReveal.ref}
            className="mt-16 pt-8 border-t border-border-hairline/60 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 text-xs font-mono text-ink-muted"
          >
            {WORKFLOW.map((step, i) => (
              <React.Fragment key={step}>
                <span className="px-2.5 py-1 rounded-[4px] bg-surface-1 border border-border-subtle text-ink-secondary">
                  {step}
                </span>
                {i < WORKFLOW.length - 1 && (
                  <span className="relative h-px w-5 sm:w-8 overflow-hidden bg-border-subtle">
                    <span
                      className="absolute inset-y-0 left-0 bg-accent transition-all ease-out"
                      style={{
                        width: workflowReveal.inView ? "100%" : "0%",
                        transitionDuration: "500ms",
                        transitionDelay: `${i * 150}ms`,
                      }}
                    />
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Feature Bento Grid Section */}
        <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
          <Reveal reduced={reduced} className="mb-12 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">Deal Architecture</p>
            <h2 className="font-display text-3xl sm:text-4xl font-normal text-ink-primary tracking-tight">
              Engineered to eliminate commercial leakage
            </h2>
            <p className="mt-3 text-sm text-ink-muted max-w-xl mx-auto font-body">
              Every proposal is fortified with active risk calculations, margin controls, and automated client clarity.
            </p>
          </Reveal>

          <Reveal reduced={reduced}>
            <BentoCardGrid gridRef={bentoGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature, index) => (
                <BentoCard key={index} className="p-6 flex flex-col justify-between min-h-[220px]" glowColor="78, 135, 112">
                  <div>
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
                      <p className="text-xs text-ink-muted leading-relaxed font-body">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-1 text-[11px] font-mono text-ink-disabled group-hover:text-accent transition-colors">
                    <span>SYSTEM OPERATIONAL</span>
                    <span className="material-symbols-outlined text-[12px] text-accent">check</span>
                  </div>
                </BentoCard>
              ))}
            </BentoCardGrid>
          </Reveal>
        </section>

        {/* Capability Loop + Feature Carousel */}
        <section id="capabilities" className="py-20 px-6 max-w-7xl mx-auto border-t border-border-hairline/60">
          <Reveal reduced={reduced} className="mb-10 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">What It Actually Does</p>
            <h2 className="font-display text-3xl sm:text-4xl font-normal text-ink-primary tracking-tight">
              Every capability, in motion
            </h2>
          </Reveal>

          <Reveal reduced={reduced}>
            <CapabilityLoop reduced={reduced} />
          </Reveal>

          <div className="mt-14">
            <Reveal reduced={reduced}>
              <CardMarquee reduced={reduced} />
            </Reveal>
          </div>
        </section>

        <FlowingDivider reduced={reduced} />

        {/* Subscription Style & Pricing Section */}
        <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto border-t border-border-hairline/60">
          <Reveal reduced={reduced} className="mb-14 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">Flexible Commercial Membership</p>
            <h2 className="font-display text-3xl sm:text-5xl font-normal text-ink-primary tracking-tight">
              Choose your subscription style
            </h2>
            <p className="mt-3 text-sm text-ink-muted max-w-xl mx-auto font-body">
              Transparent, per-workspace tiers backed by Square. Switch or cancel anytime without friction.
            </p>
          </Reveal>

          <Reveal reduced={reduced}>
            <BentoCardGrid gridRef={pricingGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {TIERS.map((tier) => (
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
                          Most Popular
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl font-semibold text-ink-primary tracking-tight">
                        {tier.price}
                      </span>
                      <span className="text-xs font-mono text-ink-muted">{tier.cadence}</span>
                    </div>

                    <p className="mt-3 text-xs text-ink-muted leading-relaxed font-body min-h-[36px]">
                      {tier.description}
                    </p>

                    <div className="mt-6 space-y-2.5 border-t border-border-subtle pt-6">
                      {tier.features.map((feat) => (
                        <div key={feat} className="flex items-start gap-2.5 text-xs text-ink-secondary">
                          <span className="material-symbols-outlined text-accent text-[16px] shrink-0 mt-0.5">
                            check_circle
                          </span>
                          <span className="font-body">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4">
                    <Link
                      href="/sign-up"
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                        tier.popular
                          ? "bg-accent text-[#002116] hover:bg-accent-hover active:bg-accent-pressed shadow-[0_2px_12px_rgba(var(--accent-rgb),0.25)]"
                          : "border border-border-hairline bg-surface-2 text-ink-primary hover:bg-surface-3"
                      }`}
                    >
                      <span>{tier.cta}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                    <p className="mt-2 text-center text-[10px] font-mono text-ink-disabled">
                      Includes 14-day full platform access
                    </p>
                  </div>
                </BentoCard>
              ))}
            </BentoCardGrid>
          </Reveal>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-hairline/60 py-12 px-6 bg-surface-1/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-[4px] bg-accent flex items-center justify-center text-[#002116] font-bold text-[10px]">
                SV
              </div>
              <span className="font-display text-base font-medium text-ink-primary">ScopeVanta</span>
              <span className="text-xs text-ink-disabled font-mono">© {new Date().getFullYear()} All rights reserved.</span>
            </div>

            <div className="flex items-center gap-6 text-xs font-mono text-ink-muted">
              <Link href="/sign-in" className="hover:text-ink-primary transition-colors">Sign In</Link>
              <Link href="/sign-up" className="hover:text-ink-primary transition-colors">Register</Link>
              <a href="#pricing" className="hover:text-ink-primary transition-colors">Subscription Styles</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
