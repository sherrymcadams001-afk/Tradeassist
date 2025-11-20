import { useEffect, useRef, useState } from "react";

type TickPayload = {
  symbol: string;
  price?: number;
  bid?: number;
  ask?: number;
  last?: number;
  ts: number;
};

type SocketMessage =
  | { type: "tick"; payload: TickPayload }
  | { type: "env"; payload: Record<string, unknown> }
  | Record<string, unknown>;

type UseMarketStreamParams = {
  url: string;
  symbols?: string[];
};

export function useMarketStream({ url, symbols }: UseMarketStreamParams) {
  const socketRef = useRef<WebSocket | null>(null);
  const [ticks, setTicks] = useState<Record<string, TickPayload>>({});
  const [connected, setConnected] = useState(false);
  const symbolKey = symbols?.join(",") ?? "";

  useEffect(() => {
    let retryHandle: number | null = null;
    let shouldReconnect = true;

    const connect = () => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnected(true);
        if (symbols?.length) {
          socket.send(JSON.stringify({ action: "subscribe", symbols }));
        }
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data) as SocketMessage;
          if (isTickMessage(message)) {
            const payload = message.payload;
            setTicks((prev) => ({ ...prev, [payload.symbol]: payload }));
          }
        } catch (err) {
          console.error("Malformed tick payload", err);
        }
      });

      socket.addEventListener("error", (event) => {
        const target = event.currentTarget as WebSocket | null;
        if (target && (target.readyState === WebSocket.CLOSING || target.readyState === WebSocket.CLOSED)) {
          return;
        }
        console.error("Market stream error", event);
      });

      socket.addEventListener("close", (event) => {
        setConnected(false);
        if (shouldReconnect && event.code !== 4000) {
          retryHandle = window.setTimeout(connect, 2000);
        }
      });
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (retryHandle) {
        window.clearTimeout(retryHandle);
      }
      socketRef.current?.close(4000, "component_unmount");
      socketRef.current = null;
    };
  }, [url, symbolKey]);

  return { ticks, connected };
}

function isTickMessage(message: SocketMessage): message is { type: "tick"; payload: TickPayload } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type?: unknown }).type === "tick" &&
    "payload" in message
  );
}
