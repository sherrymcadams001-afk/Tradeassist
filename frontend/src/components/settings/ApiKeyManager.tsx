import { FormEvent, useMemo, useState } from "react";
import { KeyRound, Loader2, Shield } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { useApiKeys } from "../../hooks/useApiKeys";

export function ApiKeyManager() {
  const { user } = useAuth();
  const [formState, setFormState] = useState({
    label: "",
    provider: "binance",
    publicKey: "",
    secret: "",
    passphrase: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const manager = useApiKeys(Boolean(user));
  const isAdmin = useMemo(() => user?.roles.includes("admin") ?? false, [user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.publicKey || !formState.secret) {
      return;
    }
    setSubmitting(true);
    try {
      await manager.createKey({
        label: formState.label || `${formState.provider.toUpperCase()} Key`,
        provider: formState.provider,
        publicKey: formState.publicKey,
        secret: formState.secret,
        passphrase: formState.passphrase || undefined,
      });
      setFormState({ label: "", provider: formState.provider, publicKey: "", secret: "", passphrase: "" });
    } catch (err) {
      console.error("Unable to store API key", err);
      alert(err instanceof Error ? err.message : "API key storage failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-6 shadow-[0_0_60px_rgba(5,15,45,0.6)]">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">Credential vault</p>
          <h2 className="text-2xl font-semibold text-white">API Key Management</h2>
          <p className="text-sm text-slate-400">
            Keys are encrypted with server-held keys and never returned once stored. Rotate credentials regularly.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-emerald-300">
          <Shield className="h-4 w-4" />
          Zero retention vault
        </div>
      </header>

      {!isAdmin ? (
        <p className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          API key operations require elevated access. Contact an administrator to unlock provisioning.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-5" aria-disabled={!isAdmin}>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound className="h-4 w-4 text-cyan-300" />
            Store new credential
          </div>
          <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">
            Label
            <input
              type="text"
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-cyan-400"
              value={formState.label}
              onChange={(e) => setFormState((prev) => ({ ...prev, label: e.target.value }))}
              disabled={!isAdmin || submitting}
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">
            Provider
            <select
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-cyan-400"
              value={formState.provider}
              onChange={(e) => setFormState((prev) => ({ ...prev, provider: e.target.value }))}
              disabled={!isAdmin || submitting}
            >
              <option value="binance">Binance</option>
              <option value="kraken">Kraken</option>
              <option value="coinbase">Coinbase</option>
              <option value="paper">Paper Trading</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">
            Public Key / API Key
            <input
              type="text"
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-cyan-400"
              value={formState.publicKey}
              onChange={(e) => setFormState((prev) => ({ ...prev, publicKey: e.target.value }))}
              disabled={!isAdmin || submitting}
              required
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">
            Secret
            <input
              type="password"
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-cyan-400"
              value={formState.secret}
              onChange={(e) => setFormState((prev) => ({ ...prev, secret: e.target.value }))}
              disabled={!isAdmin || submitting}
              required
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.3em] text-slate-500">
            Passphrase (optional)
            <input
              type="password"
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-cyan-400"
              value={formState.passphrase}
              onChange={(e) => setFormState((prev) => ({ ...prev, passphrase: e.target.value }))}
              disabled={!isAdmin || submitting}
            />
          </label>
          <button
            type="submit"
            disabled={!isAdmin || submitting}
            className="w-full rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200 transition hover:bg-cyan-500/30"
          >
            {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Store credential"}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-5">
          <div className="flex items-center justify-between text-sm font-semibold text-white">
            <span>Active keys</span>
            {manager.loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : null}
          </div>
          {manager.error ? <p className="mt-3 text-xs text-rose-400">{manager.error}</p> : null}
          <ul className="mt-4 space-y-3">
            {manager.records.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-700/60 px-4 py-6 text-center text-sm text-slate-500">
                No keys stored yet.
              </li>
            ) : (
              manager.records.map((record) => (
                <li key={record.id} className="rounded-xl border border-slate-800/60 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-white">
                    <div>
                      <p className="font-semibold">{record.label}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{record.provider}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void manager.deleteKey(record.id).catch((err) => {
                          console.error("Deletion failed", err);
                          alert("Unable to delete key");
                        });
                      }}
                      disabled={!isAdmin}
                      className="text-xs uppercase tracking-[0.3em] text-rose-300 hover:text-rose-200"
                    >
                      Revoke
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">•••• {record.last4}</p>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                    Added {new Date(record.created_at * 1000).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}