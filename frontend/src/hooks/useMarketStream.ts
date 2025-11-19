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

  useEffect(() => {
    socketRef.current = new WebSocket(url);
    const socket = socketRef.current;

    socket.addEventListener("open", () => {
      setConnected(true);
      if (symbols?.length) {
        socket.send(JSON.stringify({ action: "subscribe", symbols }));
      }
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data) as SocketMessage;
        if (message && "type" in message && message.type === "tick") {
          const payload = message.payload;
          setTicks((prev) => ({ ...prev, [payload.symbol]: payload }));
        }
      } catch (err) {
        console.error("Malformed tick payload", err);
      }
    });

    socket.addEventListener("close", () => setConnected(false));

    return () => {
      socket.close(4000, "component_unmount");
      socketRef.current = null;
    };
  }, [url, symbols?.join(",")]);

  return { ticks, connected };
}
