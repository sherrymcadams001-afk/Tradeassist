import { useEffect, useState } from "react";

import { Dashboard } from "./components/Dashboard";
import { OnboardingPanel } from "./components/onboarding/OnboardingPanel";
import { useBotProfile } from "./hooks/useBotProfile";

const DEMO_USER_ID = "pilot-001";

export default function App() {
  const { bot, tiers, tierMap, profile, loading, error, saving, saveProfile } = useBotProfile(DEMO_USER_ID);
  const [handshakeComplete, setHandshakeComplete] = useState(false);
  const [cockpitVisible, setCockpitVisible] = useState(false);

  useEffect(() => {
    if (handshakeComplete) {
      setCockpitVisible(true);
    }
  }, [handshakeComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
        <section className="rounded-3xl border border-slate-900 bg-[#05060f] p-6 shadow-[0_20px_90px_rgba(3,8,23,0.75)]">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Midas Touch · Module Briefing</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Link the client-side bot to the parent exchange.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            This workspace treats VERIDIAN as a remote API surface. Once the security handshake finalizes, the Midas Touch cockpit unlocks and streams live telemetry.
          </p>
        </section>

        <OnboardingPanel
          bot={bot}
          tiers={tiers}
          tierMap={tierMap}
          profile={profile}
          loading={loading}
          error={error}
          saving={saving}
          onSave={saveProfile}
          onHandshakeStateChange={setHandshakeComplete}
        />

        <section className="rounded-3xl border border-slate-900 bg-[#04050b] p-6 shadow-[0_30px_90px_rgba(3,8,23,0.65)]">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Midas Touch Cockpit</p>
              <p className="mt-1 text-sm text-slate-400">
                Handshake status: {handshakeComplete ? "Secured" : "Negotiating"}. Live feeds unlock automatically once the handshake locks.
              </p>
            </div>
            <button
              type="button"
              className="ghost-button px-4 py-2 text-sm font-medium"
              aria-pressed={cockpitVisible}
              onClick={() => setCockpitVisible((prev) => !prev)}
              disabled={!handshakeComplete && !cockpitVisible}
            >
              {cockpitVisible ? "Collapse Cockpit" : handshakeComplete ? "Launch Cockpit" : "Handshake Pending"}
            </button>
          </header>
          {cockpitVisible ? (
            <div className="mt-6">
              <Dashboard bot={bot} profile={profile} tier={profile ? tierMap[profile.tier] : undefined} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
