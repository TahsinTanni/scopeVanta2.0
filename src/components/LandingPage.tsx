"use client";

import React, { useRef } from "react";
import Link from "next/link";
import MoltenMetal from "@/components/MoltenMetal";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";

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

export default function LandingPage() {
  const bentoGridRef = useRef<HTMLDivElement>(null);
  const pricingGridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-h-screen bg-surface-0 text-ink-primary font-body overflow-x-hidden selection:bg-accent/30 selection:text-white">
      {/* Background WebGL Molten Metal Canvas */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <MoltenMetal
          color1="#4E8770"
          color2="#1B2E26"
          color3="#8A9E96"
          backgroundColor="#0E1312"
          speed={0.25}
          scale={3.2}
          detail={3}
          glow={1.4}
          coreSize={0.12}
          swirl={1.2}
          fold={-0.2}
          blackPoint={0.06}
          brightness={1.15}
          grain={true}
          grainIntensity={0.05}
          opacity={0.8}
        />
      </div>

      {/* Subtle radial overlay for contrast & readability */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(78,135,112,0.15),rgba(14,19,18,0.95))]" />

      {/* Global Cursor Spotlight for Interactive Bento Grids */}
      <GlobalSpotlight
        gridRef={bentoGridRef}
        glowColor="78, 135, 112"
        spotlightRadius={360}
      />
      <GlobalSpotlight
        gridRef={pricingGridRef}
        glowColor="78, 135, 112"
        spotlightRadius={360}
      />

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
            <Link
              href="/sign-in"
              className="text-xs font-medium text-ink-secondary hover:text-ink-primary px-3.5 py-1.5 transition-colors cursor-pointer"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-[4px] bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-all shadow-[0_2px_12px_rgba(78,135,112,0.3)] cursor-pointer"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="pt-24 pb-20 px-6 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-hairline bg-surface-1/90 px-3.5 py-1 text-xs font-mono text-ink-secondary mb-6 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span>Commercial Intelligence OS 2.0</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-ink-primary leading-[1.1]">
            Turn vague client briefs into <span className="italic font-medium text-accent-hover">iron-clad, high-margin</span> agreements.
          </h1>

          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed font-body">
            ScopeVanta deconstructs requirements, models commercial friction, red-teams liability, and protects your margins from initial discovery to final change orders.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[4px] bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-all shadow-[0_4px_20px_rgba(78,135,112,0.35)]"
            >
              <span>Launch Commercial Command Center</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[4px] border border-border-hairline bg-surface-1/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:bg-surface-2 hover:text-ink-primary transition-all"
            >
              <span>Explore Subscription Styles</span>
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
            </a>
          </div>

          {/* Workflow Sequence Pill Strip */}
          <div id="pipeline" className="mt-16 pt-8 border-t border-border-hairline/60 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-mono text-ink-muted">
            {["Analyze", "Clarify", "Scope", "Price", "Propose", "Win", "Protect"].map((step, i) => (
              <React.Fragment key={step}>
                <span className="px-2.5 py-1 rounded-[4px] bg-surface-1 border border-border-subtle text-ink-secondary">
                  {step}
                </span>
                {i < 6 && <span className="text-accent/60">→</span>}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Feature Bento Grid Section */}
        <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
          <div className="mb-12 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">Deal Architecture</p>
            <h2 className="font-display text-3xl sm:text-4xl font-normal text-ink-primary tracking-tight">
              Engineered to eliminate commercial leakage
            </h2>
            <p className="mt-3 text-sm text-ink-muted max-w-xl mx-auto font-body">
              Every proposal is fortified with active risk calculations, margin controls, and automated client clarity.
            </p>
          </div>

          <BentoCardGrid gridRef={bentoGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, index) => (
              <BentoCard
                key={index}
                className="p-6 flex flex-col justify-between min-h-[220px]"
                glowColor="78, 135, 112"
              >
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
        </section>

        {/* Subscription Style & Pricing Section */}
        <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto border-t border-border-hairline/60">
          <div className="mb-14 text-center">
            <p className="text-xs font-mono uppercase tracking-wider text-accent-hover mb-2">Flexible Commercial Membership</p>
            <h2 className="font-display text-3xl sm:text-5xl font-normal text-ink-primary tracking-tight">
              Choose your subscription style
            </h2>
            <p className="mt-3 text-sm text-ink-muted max-w-xl mx-auto font-body">
              Transparent, per-workspace tiers backed by Square. Switch or cancel anytime without friction.
            </p>
          </div>

          <BentoCardGrid gridRef={pricingGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {TIERS.map((tier) => (
              <BentoCard
                key={tier.name}
                className={`p-8 flex flex-col justify-between ${
                  tier.popular
                    ? "border-accent/60 bg-surface-2/95 shadow-[0_0_30px_rgba(78,135,112,0.15)]"
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
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-[4px] py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                      tier.popular
                        ? "bg-accent text-[#002116] hover:bg-accent-hover active:bg-accent-pressed shadow-[0_2px_12px_rgba(78,135,112,0.25)]"
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
