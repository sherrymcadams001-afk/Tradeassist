import { useCallback, useEffect, useMemo, useState } from "react";

import type { ApiKeyPayload, ApiKeyRecord } from "../types/auth";
import { normalizeApiKey } from "../types/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useApiKeys(enabled: boolean) {
  const [records, setRecords] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/v1/api-keys`, {
        credentials: "include",
      });
      if (!resp.ok) {
        throw new Error("Unable to load API keys");
      }
      const payload = (await resp.json()) as ApiKeyRecord[];
      setRecords(payload.map((entry) => normalizeApiKey(entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createKey = useCallback(
    async (payload: ApiKeyPayload) => {
      if (!enabled) {
        throw new Error("Authentication required");
      }
      const resp = await fetch(`${API_BASE}/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: payload.label,
          provider: payload.provider,
          public_key: payload.publicKey,
          secret: payload.secret,
          passphrase: payload.passphrase,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({}));
        throw new Error(detail?.detail ?? "Failed to store API key");
      }
      const record = normalizeApiKey((await resp.json()) as ApiKeyRecord);
      setRecords((prev) => [record, ...prev]);
      return record;
    },
    [enabled]
  );

  const deleteKey = useCallback(
    async (id: string) => {
      if (!enabled) {
        throw new Error("Authentication required");
      }
      const resp = await fetch(`${API_BASE}/v1/api-keys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (resp.status !== 204) {
        throw new Error("Failed to delete key");
      }
      setRecords((prev) => prev.filter((item) => item.id !== id));
    },
    [enabled]
  );

  return useMemo(
    () => ({ records, loading, error, refresh, createKey, deleteKey }),
    [records, loading, error, refresh, createKey, deleteKey]
  );
}