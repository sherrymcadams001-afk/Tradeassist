import { useState } from "react";

import { Dashboard } from "./components/Dashboard";
import { ApiKeyManager } from "./components/settings/ApiKeyManager";
import { OnboardingPanel } from "./components/onboarding/OnboardingPanel";
import { VerificationSequence } from "./components/VerificationSequence";
import { useAuth } from "./contexts/AuthContext";
import { useBotProfile } from "./hooks/useBotProfile";

type AppPhase = "verification" | "onboarding" | "dashboard";

export default function App() {
  const { user, loading: authLoading, error: authError, login } = useAuth();
  const authReady = Boolean(user);
  const { bot, tiers, tierMap, profile, loading, error, saving, saveProfile } = useBotProfile(user?.userId ?? null, {
    enabled: authReady,
  });
  const [phase, setPhase] = useState<AppPhase>("verification");
  const [handshakeComplete, setHandshakeComplete] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#01030a] text-slate-100">
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Securing session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#01030a] text-slate-100">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/40 px-8 py-10 text-center shadow-[0_0_60px_rgba(6,182,212,0.15)]">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Orion Suite</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Authenticate to continue</h1>
          <p className="mt-2 text-sm text-slate-400">Zero trust session required before accessing the control surface.</p>
          {authError ? <p className="mt-4 text-xs text-rose-400">{authError}</p> : null}
          <button
            type="button"
            onClick={() => {
              void login();
            }}
            className="mt-6 inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200 transition hover:bg-cyan-400/20"
          >
            Initiate Secure Login
          </button>
        </div>
      </div>
    );
  }

  if (phase === "verification") {
    return <VerificationSequence onComplete={() => setPhase("onboarding")} />;
  }

  if (phase === "onboarding") {
    return (
      <div className="min-h-screen bg-[#01030a] text-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
          <OnboardingPanel
            bot={bot}
            tiers={tiers}
            tierMap={tierMap}
            profile={profile}
            loading={loading}
            error={error}
            saving={saving}
            onSave={saveProfile}
            onHandshakeStateChange={(complete) => {
              setHandshakeComplete(complete);
              if (complete) {
                setPhase("dashboard");
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#01030a] text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
        <Dashboard bot={bot} profile={profile} tier={profile ? tierMap[profile.tier] : undefined} />
        <ApiKeyManager />
      </div>
    </div>
  );
}
