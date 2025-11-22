import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Crown, Loader2, ShieldCheck, Zap } from "lucide-react";

import type { BotDescriptor, TierDefinition, UserPreferences, UserProfile } from "../../types/bot";

type Phase = "sync" | "scan" | "reveal" | "strategy";

type OnboardingPanelProps = {
  bot: BotDescriptor | null;
  tiers: TierDefinition[];
  tierMap: Record<string, TierDefinition>;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  onSave: (payload: { tier: string; preferences: Partial<UserPreferences> }) => Promise<UserProfile>;
  onHandshakeStateChange?: (complete: boolean) => void;
};

type StrategyProfileCard = {
  id: "foundational" | "advanced" | "prime";
  title: string;
  logic: string;
  risk: string;
  yield: string;
  status: "available" | "locked";
  icon: "shield" | "lightning" | "crown";
  description: string;
  highlights: string[];
};

const notificationLabels: Record<string, string> = {
  silent: "Silent",
  summary: "Summary",
  verbose: "Verbose",
};

const explanationLabels: Record<string, string> = {
  concise: "Concise",
  detailed: "Detailed",
};

const HANDSHAKE_STEPS = [
  {
    id: "token",
    title: "Authenticating API token...",
    detail: "Establishing tunnel with parent exchange edge.",
    result: "Tunnel integrity verified",
  },
  {
    id: "wallet",
    title: "Scanning wallet liquidity...",
    detail: "Validating hot and cold storage reserves.",
    result: "Liquidity depth confirmed",
  },
  {
    id: "tier",
    title: "Verifying user tier...",
    detail: "Cross-checking entitlement registry.",
    result: "Tier 2 status confirmed",
  },
];

const STRATEGY_PROFILES: StrategyProfileCard[] = [
  {
    id: "foundational",
    title: "Foundational",
    logic: "Mean reversion grid",
    risk: "Conservative",
    yield: "~2.4% weekly",
    status: "available",
    icon: "shield",
    description: "Stabilizes spreads and leans into intraday reversals.",
    highlights: [
      "Market neutral posture with capital preservation",
      "Hedged entries dampen volatility spikes",
      "Ideal for new deposits and steady growth",
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    logic: "Momentum and swing hybrid",
    risk: "Dynamic",
    yield: "~5.0% weekly",
    status: "available",
    icon: "lightning",
    description: "Rides directional pushes with adaptive trailing intelligence.",
    highlights: [
      "Volatility harvesting with disciplined drawdown limits",
      "Inter-market arbitration for rapid pivots",
      "Tier 2 verified and recommended pathway",
    ],
  },
  {
    id: "prime",
    title: "Prime",
    logic: "High frequency arbitrage",
    risk: "Aggressive",
    yield: "Tier 3 unlock",
    status: "locked",
    icon: "crown",
    description: "Latency sensitive routing targeting institutional grade alpha.",
    highlights: [
      "Microsecond execution mesh",
      "Triangular liquidity extraction",
      "Requires Tier 3 deposit or referrals",
    ],
  },
];

export function OnboardingPanel({
  bot,
  tiers,
  tierMap,
  profile,
  loading,
  error,
  saving,
  onSave,
  onHandshakeStateChange,
}: OnboardingPanelProps) {
  const [phase, setPhase] = useState<Phase>("sync");
  const [selectedTier, setSelectedTier] = useState(() => profile?.tier ?? tiers[0]?.id ?? "foundation");
  const [handshakeStage, setHandshakeStage] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyProfileCard["id"] | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const currentTier = useMemo(() => {
    if (tierMap[selectedTier]) {
      return tierMap[selectedTier];
    }
    return tiers.find((tier) => tier.id === selectedTier) ?? tiers[0] ?? null;
  }, [selectedTier, tierMap, tiers]);

  const selectedStrategyMeta = useMemo(() => {
    if (!selectedStrategy) {
      return null;
    }
    return STRATEGY_PROFILES.find((entry) => entry.id === selectedStrategy) ?? null;
  }, [selectedStrategy]);

  useEffect(() => {
    if (!tiers.length) {
      return;
    }

    const fallbackTier = profile?.tier ?? tiers[0]?.id ?? "foundation";
    setSelectedTier(fallbackTier);
  }, [profile, tiers]);

  useEffect(() => {
    if (handshakeStage >= HANDSHAKE_STEPS.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      setHandshakeStage((stage) => Math.min(stage + 1, HANDSHAKE_STEPS.length));
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [handshakeStage]);

  // Handshake completion is tracked internally; external notification happens after strategy selection

  useEffect(() => {
    if (phase === "sync") {
      const timer = window.setTimeout(() => setPhase("scan"), 1600);
      return () => window.clearTimeout(timer);
    }

    if (phase === "scan") {
      setScanProgress(0);
      let completionTimer: number | undefined;
      const interval = window.setInterval(() => {
        setScanProgress((progress) => {
          const next = Math.min(progress + 11, 100);
          if (next >= 100) {
            window.clearInterval(interval);
            completionTimer = window.setTimeout(() => setPhase("reveal"), 320);
          }
          return next;
        });
      }, 160);
      return () => {
        window.clearInterval(interval);
        if (completionTimer) {
          window.clearTimeout(completionTimer);
        }
      };
    }

    if (phase === "reveal") {
      setIsFlipping(true);
      const timer = window.setTimeout(() => {
        setIsFlipping(false);
        setPhase("strategy");
      }, 1200);
      return () => {
        window.clearTimeout(timer);
        setIsFlipping(false);
      };
    }

    return () => undefined;
  }, [phase]);

  const handshakeComplete = handshakeStage >= HANDSHAKE_STEPS.length;

  const renderSyncPhase = () => (
    <section className="flex min-h-[600px] items-center justify-center rounded-3xl border border-cyan-500/20 bg-[#0B0C10] p-8 shadow-[0_0_80px_rgba(6,182,212,0.15)]">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="h-24 w-24 animate-pulse rounded-full border-4 border-cyan-400/30 bg-cyan-400/10" />
        </div>
        <h2 className="mb-2 text-3xl font-bold tracking-wider text-cyan-300">System synchronization</h2>
        <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Establishing secure channel</p>
      </div>
    </section>
  );

  const renderScanPhase = () => (
    <section className="flex min-h-[600px] items-center justify-center rounded-3xl border border-cyan-500/20 bg-[#0B0C10] p-8 shadow-[0_0_80px_rgba(6,182,212,0.15)]">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
        </div>
        <h2 className="mb-4 text-2xl font-bold tracking-wider text-cyan-300">Analyzing user liquidity and history</h2>
        <div className="mx-auto mb-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-300" style={{ width: `${scanProgress}%` }} />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{scanProgress}% complete</p>
      </div>
    </section>
  );

  const renderRevealPhase = () => (
    <section className="relative flex min-h-[600px] items-center justify-center overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#0B0C10] via-[#1a1508] to-[#0B0C10] p-8 shadow-[0_0_160px_rgba(251,191,36,0.25),inset_0_0_80px_rgba(251,191,36,0.05)]">
      {/* Animated border glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-40 blur-xl" style={{ animation: 'pulse 3s ease-in-out infinite' }} />
      
      <div className={`relative z-10 transition-all duration-700 ${isFlipping ? "scale-105 rotate-1" : "scale-100 rotate-0"}`}>
        <div className="relative rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/30 via-slate-950/40 to-amber-900/20 p-16 text-center shadow-[0_20px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          {/* Inner glow effect */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-amber-500/10 to-transparent" />
          
          {/* Crown icon with multi-layer glow */}
          <div className="relative mb-8 flex justify-center">
            <div className="absolute h-24 w-24 animate-pulse rounded-full bg-amber-400/20 blur-3xl" />
            <div className="relative rounded-full border border-amber-400/30 bg-gradient-to-br from-amber-400/20 to-transparent p-6 shadow-[0_0_40px_rgba(251,191,36,0.3)]">
              <Crown className="h-12 w-12 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </div>
          </div>
          
          {/* Status label */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-amber-300/80">Access Level</p>
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          </div>
          
          {/* Tier display */}
          <h1 className="mb-3 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-6xl font-black tracking-[0.15em] text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
            TIER II
          </h1>
          <div className="mb-6 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-6 py-1.5">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Gold Mastery</p>
          </div>
          
          {/* Verification badge */}
          <div className="mx-auto mt-10 max-w-md space-y-4">
            <div className="flex items-center justify-center gap-3 rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-950/40 to-emerald-900/20 px-6 py-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-200">Cryptographic verification complete</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 px-4 py-3">
                <p className="mb-1 font-mono uppercase tracking-wider text-slate-500">Allocation</p>
                <p className="font-bold text-amber-300">50,000 USDT</p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 px-4 py-3">
                <p className="mb-1 font-mono uppercase tracking-wider text-slate-500">Strategy Access</p>
                <p className="font-bold text-cyan-300">Advanced+</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Background ambient particles */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute left-1/4 top-1/4 h-2 w-2 animate-ping rounded-full bg-amber-400" style={{ animationDuration: '4s' }} />
        <div className="absolute right-1/3 top-1/2 h-1.5 w-1.5 animate-ping rounded-full bg-cyan-400" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/2 h-2 w-2 animate-ping rounded-full bg-amber-400" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
    </section>
  );

  const renderStrategyPhase = () => (
    <section className="rounded-3xl border border-slate-800 bg-[#0B0C10] p-8 shadow-[0_0_120px_rgba(5,15,45,0.75)]">
      <header className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-cyan-400">Phase 2 - The Brain</p>
        <h2 className="mt-2 text-4xl font-bold text-white">Select your strategy</h2>
        <p className="mt-3 text-sm text-slate-400">Choose the algorithm that matches your risk posture.</p>
      </header>

      {!handshakeComplete ? (
        <div className="mx-auto mb-6 w-fit rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">
          Completing tier verification...
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {STRATEGY_PROFILES.map((strategy) => (
          <StrategySpotlight
            key={strategy.id}
            strategy={strategy}
            active={selectedStrategy === strategy.id}
            disabled={!handshakeComplete || strategy.status === "locked"}
            onSelect={() => {
              if (!handshakeComplete || strategy.status === "locked") {
                return;
              }
              setSelectedStrategy(strategy.id);
            }}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={async () => {
            if (!selectedStrategy || !handshakeComplete || saving) {
              return;
            }
            
            // Save profile with selected strategy and trigger completion
            try {
              await onSave({
                tier: selectedTier,
                preferences: {
                  max_allocation: currentTier?.max_allocation ?? 0,
                  symbols_whitelist: bot?.universes?.slice(0, 6) ?? [],
                  notification_level: "summary",
                  explanation_level: "concise",
                },
              });
              
              // Notify parent: onboarding complete
              onHandshakeStateChange?.(true);
            } catch (err) {
              console.error("Strategy activation failed", err);
            }
          }}
          disabled={!selectedStrategy || !handshakeComplete || saving}
          className="cta-primary inline-flex items-center gap-3"
          style={{ padding: "var(--space-4) var(--space-8)", minHeight: "56px" }}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Activating...
            </>
          ) : selectedStrategy ? (
            <>
              Activate strategy
              <ArrowRight className="h-5 w-5" />
            </>
          ) : (
            "Select a strategy"
          )}
        </button>
      </div>
    </section>
  );

  if (phase === "sync") {
    return renderSyncPhase();
  }

  if (phase === "scan") {
    return renderScanPhase();
  }

  if (phase === "reveal") {
    return renderRevealPhase();
  }

  return renderStrategyPhase();
}

type StrategyIconProps = {
  icon: StrategyProfileCard["icon"];
  className?: string;
};

const StrategyIcon = ({ icon, className }: StrategyIconProps) => {
  if (icon === "shield") {
    return <ShieldCheck className={className} />;
  }
  if (icon === "lightning") {
    return <Zap className={className} />;
  }
  return <Crown className={className} />;
};

type TierCardProps = {
  tier: TierDefinition;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function TierCard({ tier, active, disabled, onSelect }: TierCardProps) {
  const className = [
    "flex min-h-[180px] flex-col rounded-xl border p-4 text-left transition",
    active ? "border-cyan-400/80 bg-cyan-400/10" : "border-slate-800 bg-slate-900/40 hover:border-cyan-400/40",
    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
  ].join(" ");

  return (
    <button type="button" onClick={disabled ? undefined : onSelect} disabled={disabled} className={className}>
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-white">{tier.label}</h4>
        {active ? <CheckCircle2 className="h-5 w-5 text-cyan-300" /> : null}
      </div>
      <p className="mt-3 text-xs text-slate-400">{tier.description}</p>
      <p className="mt-4 text-xs text-slate-500">Allocation limit: {tier.max_allocation.toLocaleString()} USDT</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
        {tier.capabilities.slice(0, 3).map((capability) => (
          <span key={capability} className="rounded-md border border-slate-700/70 px-2 py-1">
            {capability}
          </span>
        ))}
      </div>
    </button>
  );
}

type StrategyCardProps = {
  strategy: StrategyProfileCard;
  active: boolean;
  tierStatus: string;
  disabled: boolean;
  onSelect: () => void;
};

function StrategyCard({ strategy, active, tierStatus, disabled, onSelect }: StrategyCardProps) {
  const locked = strategy.status === "locked";
  const isDisabled = disabled || locked;
  const className = [
    "flex min-h-[220px] flex-col rounded-xl border p-4 text-left transition",
    active ? "border-cyan-400/80 bg-cyan-400/10" : "border-slate-800 bg-slate-900/40 hover:border-cyan-400/40",
    isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
  ].join(" ");

  return (
    <button type="button" onClick={isDisabled ? undefined : onSelect} disabled={isDisabled} className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 p-2 text-cyan-300">
            <StrategyIcon icon={strategy.icon} className="h-5 w-5" />
          </span>
          <h4 className="text-base font-semibold text-white">{strategy.title}</h4>
        </div>
        {active ? <CheckCircle2 className="h-5 w-5 text-cyan-300" /> : null}
      </div>
      <p className="mt-3 text-xs text-slate-400">{strategy.description}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{strategy.logic}</span>
        <span>{strategy.risk}</span>
      </div>
      <div className="mt-2 text-xs text-cyan-300">{strategy.yield}</div>
      {locked ? (
        <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-amber-300">Requires higher tier</p>
      ) : (
        <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-slate-500">{tierStatus}</p>
      )}
    </button>
  );
}

type StrategySpotlightProps = {
  strategy: StrategyProfileCard;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function StrategySpotlight({ strategy, active, disabled, onSelect }: StrategySpotlightProps) {
  const locked = strategy.status === "locked" || disabled;
  const className = [
    "flex min-h-[360px] flex-col rounded-2xl border px-6 py-8 text-left transition",
    active ? "border-cyan-400/80 bg-cyan-400/10 shadow-[0_0_40px_rgba(6,182,212,0.25)]" : "border-slate-800 bg-slate-900/40 hover:border-cyan-400/40 hover:bg-slate-900/60",
    locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
  ].join(" ");

  return (
    <button type="button" onClick={locked ? undefined : onSelect} disabled={locked} className={className}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.35em] text-slate-500">{strategy.logic}</span>
        {strategy.status === "locked" ? (
          <span className="text-[11px] uppercase tracking-[0.3em] text-amber-300">Locked</span>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 p-3 text-cyan-300">
          <StrategyIcon icon={strategy.icon} className="h-6 w-6" />
        </span>
        <h3 className="text-2xl font-semibold text-white">{strategy.title}</h3>
      </div>
      <p className="mt-4 text-sm text-slate-300">{strategy.description}</p>
      <ul className="mt-6 space-y-2 text-sm text-slate-400">
        {strategy.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-cyan-400" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
        <span className="uppercase tracking-[0.35em] text-slate-500">{strategy.risk}</span>
        <span className="text-cyan-300">{strategy.yield}</span>
      </div>
    </button>
  );
}
