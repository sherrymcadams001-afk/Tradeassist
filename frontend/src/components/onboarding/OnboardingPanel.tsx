import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Crown, Loader2, ShieldCheck, Zap } from "lucide-react";

import type { BotDescriptor, TierDefinition, UserPreferences, UserProfile } from "../../types/bot";

type Phase = "sync" | "scan" | "reveal" | "strategy" | "complete";

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
  const [maxAllocation, setMaxAllocation] = useState(0);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [notificationLevel, setNotificationLevel] = useState<"silent" | "summary" | "verbose">("summary");
  const [explanationLevel, setExplanationLevel] = useState<"concise" | "detailed">("concise");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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

    const tierDefinition = tierMap[fallbackTier] ?? tiers.find((tier) => tier.id === fallbackTier);

    if (profile?.preferences) {
      setMaxAllocation(profile.preferences.max_allocation ?? tierDefinition?.max_allocation ?? 0);
      setSymbols(profile.preferences.symbols_whitelist ?? []);
      setNotificationLevel(profile.preferences.notification_level ?? "summary");
      setExplanationLevel(profile.preferences.explanation_level ?? "concise");
      return;
    }

    setMaxAllocation(tierDefinition?.max_allocation ?? 0);
    setSymbols(bot?.universes?.slice(0, 4) ?? []);
    setNotificationLevel("summary");
    setExplanationLevel("concise");
  }, [profile, tiers, tierMap, bot]);

  useEffect(() => {
    if (handshakeStage >= HANDSHAKE_STEPS.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      setHandshakeStage((stage) => Math.min(stage + 1, HANDSHAKE_STEPS.length));
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [handshakeStage]);

  useEffect(() => {
    onHandshakeStateChange?.(handshakeStage >= HANDSHAKE_STEPS.length);
  }, [handshakeStage, onHandshakeStateChange]);

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

  useEffect(() => {
    setStatusMessage(null);
  }, [phase]);

  const handshakeComplete = handshakeStage >= HANDSHAKE_STEPS.length;
  const inActivation = phase === "complete" && handshakeComplete;
  const baseDisabled = loading || saving || !bot || !currentTier;
  const formDisabled = baseDisabled || !inActivation;
  const tierSelectionDisabled = !inActivation || loading || saving;
  const readyToSubmit = inActivation && Boolean(selectedStrategy);
  const submissionDisabled = !readyToSubmit || loading || saving;

  const handleSymbolToggle = (symbol: string) => {
    if (formDisabled) {
      return;
    }
    setSymbols((previous) => {
      if (previous.includes(symbol)) {
        return previous.filter((entry) => entry !== symbol);
      }
      return [...previous, symbol];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!readyToSubmit) {
      return;
    }

    setStatusMessage(null);
    try {
      await onSave({
        tier: selectedTier,
        preferences: {
          max_allocation: maxAllocation,
          symbols_whitelist: symbols,
          notification_level: notificationLevel,
          explanation_level: explanationLevel,
        },
      });
      if (selectedStrategyMeta) {
        setStatusMessage(`${selectedStrategyMeta.title} profile activated.`);
      } else {
        setStatusMessage("Profile activated.");
      }
    } catch (saveError) {
      console.error(saveError);
      setStatusMessage("Unable to save profile");
    }
  };

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
    <section className="flex min-h-[600px] items-center justify-center rounded-3xl border border-amber-500/30 bg-[#0B0C10] p-8 shadow-[0_0_120px_rgba(251,191,36,0.2)]">
      <div className={`transition-transform duration-700 ${isFlipping ? "scale-110" : "scale-100"}`}>
        <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-900/20 to-amber-600/10 p-12 text-center backdrop-blur-xl">
          <div className="mb-6 flex justify-center">
            <Crown className="h-20 w-20 text-amber-400" />
          </div>
          <p className="mb-2 text-sm uppercase tracking-[0.5em] text-amber-200">Status</p>
          <h1 className="mb-4 text-5xl font-black tracking-wider text-amber-300">Tier 2 (Gold)</h1>
          <p className="text-2xl font-semibold text-white">Verified</p>
          <div className="mt-8 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-6 py-3">
            <p className="text-sm text-emerald-200">Tier 2 access granted. Advanced algorithms unlocked.</p>
          </div>
        </div>
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
          onClick={() => {
            if (!selectedStrategy || !handshakeComplete) {
              return;
            }
            setPhase("complete");
          }}
          disabled={!selectedStrategy || !handshakeComplete}
          className="cta-primary inline-flex items-center gap-3"
          style={{ padding: "var(--space-4) var(--space-8)", minHeight: "56px" }}
        >
          {selectedStrategy ? "Activate strategy" : "Select a strategy"}
          <ArrowRight className="h-5 w-5" />
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

  if (phase === "strategy") {
    return renderStrategyPhase();
  }

  const symbolUniverse = bot?.universes ?? [];

  return (
    <section className="rounded-3xl border border-slate-900 bg-[#0B0C10] p-8 shadow-[0_0_120px_rgba(5,15,45,0.75)]">
      <header className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-cyan-400">Phase 3 - Activation</p>
        <h2 className="mt-2 text-4xl font-bold text-white">Configure your command profile</h2>
        <p className="mt-3 text-sm text-slate-400">
          Finalize capital envelopes, market universe, and briefing cadence before we hand control to the command center.
        </p>
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      {statusMessage ? (
        <div className="mb-6 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{statusMessage}</div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">Handshake transcript</h3>
              <span className={`text-xs uppercase tracking-[0.3em] ${handshakeComplete ? "text-emerald-300" : "text-amber-300"}`}>
                {handshakeComplete ? "Integrity confirmed" : "In progress"}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {HANDSHAKE_STEPS.map((step, index) => {
                const status = index < handshakeStage ? "done" : index === handshakeStage ? "active" : "pending";
                const statusClass =
                  status === "done"
                    ? "border-emerald-300/60 bg-emerald-300/5"
                    : status === "active"
                      ? "border-amber-400/60 bg-amber-400/5"
                      : "border-slate-800 bg-slate-900/40";

                return (
                  <article key={step.id} className={`rounded-lg border px-4 py-4 text-left transition ${statusClass}`}>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Step {index + 1}</p>
                    <h4 className="mt-2 text-sm font-semibold text-white">{step.title}</h4>
                    <p className="mt-2 text-xs text-slate-400">{step.detail}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs">
                      {status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                      )}
                      <span className={status === "done" ? "text-emerald-300" : "text-slate-400"}>
                        {status === "done" ? step.result : "Processing"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">Tier access</h3>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Current - {currentTier?.label ?? "Unknown"}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {tiers.map((tier) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  active={selectedTier === tier.id}
                  onSelect={() => {
                    if (tierSelectionDisabled) {
                      return;
                    }
                    setSelectedTier(tier.id);
                  }}
                  disabled={tierSelectionDisabled}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">Strategy lattice</h3>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {selectedStrategyMeta ? selectedStrategyMeta.title : "Select"}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {STRATEGY_PROFILES.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  active={selectedStrategy === strategy.id}
                  onSelect={() => {
                    if (strategy.status === "locked" || tierSelectionDisabled) {
                      return;
                    }
                    setSelectedStrategy(strategy.id);
                  }}
                  tierStatus={currentTier?.label ?? "Tier 2"}
                  disabled={tierSelectionDisabled}
                />
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Capital envelope</p>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <label className="flex flex-col text-sm text-slate-300" htmlFor="max-allocation-input" style={{ gap: "var(--space-2)" }}>
                Allocation (USDT)
                <span className="text-xs text-slate-500">Max {currentTier?.max_allocation?.toLocaleString() ?? "0"} USDT</span>
              </label>
              <input
                id="max-allocation-input"
                type="number"
                className="mt-4 w-full rounded-md border border-slate-700 bg-black/60 text-sm text-slate-100 transition focus:is-focused"
                style={{ padding: "var(--space-3) var(--space-4)", minHeight: "44px" }}
                min={0}
                max={currentTier?.max_allocation ?? 0}
                step={100}
                value={maxAllocation}
                onChange={(event) => setMaxAllocation(Number(event.target.value))}
                disabled={formDisabled}
                aria-label="Set maximum allocation in USDT"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Market universe</p>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">{symbols.length} selected</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {symbolUniverse.map((symbol) => {
                const isActive = symbols.includes(symbol);
                const className = [
                  "flex items-center justify-between rounded-xl border px-3 py-3 text-sm transition",
                  isActive
                    ? "border-cyan-400/80 bg-cyan-400/10 text-cyan-200"
                    : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-cyan-400/40",
                ].join(" ");

                return (
                  <button
                    key={symbol}
                    type="button"
                    className={className}
                    onClick={() => handleSymbolToggle(symbol)}
                    disabled={formDisabled}
                  >
                    <span>{symbol}</span>
                    {isActive ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Notification cadence</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["silent", "summary", "verbose"] as const).map((level) => {
                const isActive = notificationLevel === level;
                const label = notificationLabels[level];

                return (
                  <button
                    key={level}
                    type="button"
                    className={`rounded-xl border px-4 py-3 text-sm transition ${
                      isActive
                        ? "border-cyan-400/80 bg-cyan-400/10 text-cyan-200"
                        : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-cyan-400/40"
                    }`}
                    onClick={() => setNotificationLevel(level)}
                    disabled={formDisabled}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Explanation depth</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["concise", "detailed"] as const).map((level) => {
                const isActive = explanationLevel === level;
                const label = explanationLabels[level];

                return (
                  <button
                    key={level}
                    type="button"
                    className={`rounded-xl border px-4 py-3 text-sm transition ${
                      isActive
                        ? "border-cyan-400/80 bg-cyan-400/10 text-cyan-200"
                        : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-cyan-400/40"
                    }`}
                    onClick={() => setExplanationLevel(level)}
                    disabled={formDisabled}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Strategy</p>
                <p className="mt-2 text-sm text-slate-300">
                  {selectedStrategyMeta
                    ? selectedStrategyMeta.description
                    : "Select a strategy to enable activation."}
                </p>
              </div>
              {selectedStrategyMeta ? (
                <div className="hidden rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200 md:block">
                  {selectedStrategyMeta.title} - {selectedStrategyMeta.yield}
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submissionDisabled}
              className="cta-primary inline-flex items-center justify-center gap-3"
              style={{ minHeight: "56px" }}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              <span>{saving ? "Activating..." : "Confirm activation"}</span>
            </button>
            <p className="text-xs text-slate-500">
              Activation becomes available once the handshake completes and a strategy is selected.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
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
