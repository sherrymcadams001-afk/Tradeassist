import React, { useRef, useEffect } from "react";
import { Activity } from "lucide-react";
import { BotMessage, MessageCategory } from "../utils/botMessages";

interface BotActivityFeedProps {
  messages: BotMessage[];
  maxMessages?: number;
  className?: string;
}

const CATEGORY_ICONS: Record<MessageCategory, string> = {
  market_scanning: "🔍",
  trade_execution: "⚡",
  risk_management: "🛡️",
  technical_analysis: "📊",
  order_management: "📋",
  portfolio_actions: "💼",
  advanced_signals: "🎯",
};

const CATEGORY_COLORS: Record<MessageCategory, string> = {
  market_scanning: "text-blue-300 bg-blue-500/15 border-blue-500/40",
  trade_execution: "text-green-300 bg-green-500/15 border-green-500/40",
  risk_management: "text-orange-300 bg-orange-500/15 border-orange-500/40",
  technical_analysis: "text-purple-300 bg-purple-500/15 border-purple-500/40",
  order_management: "text-cyan-300 bg-cyan-500/15 border-cyan-500/40",
  portfolio_actions: "text-indigo-300 bg-indigo-500/15 border-indigo-500/40",
  advanced_signals: "text-pink-300 bg-pink-500/15 border-pink-500/40",
};

const PRIORITY_STYLES = {
  low: "opacity-80",
  medium: "opacity-90",
  high: "opacity-100 ring-1 ring-cyan-500/20",
};

/**
 * Bot Activity Feed - Real-time display of bot trading activities
 */
export default function BotActivityFeed({
  messages,
  maxMessages = 30,
  className = "",
}: BotActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const displayMessages = messages.slice(-maxMessages);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  };

  const getCategoryLabel = (category: MessageCategory) => {
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar"
      >
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-purple-400/40 animate-pulse" />
            </div>
            <p>Waiting for bot activity...</p>
          </div>
        ) : (
          displayMessages.map((message, index) => (
            <div
              key={message.id}
              className={`group relative rounded-xl border backdrop-blur-sm transition-all duration-300 p-3.5 hover:scale-[1.01] hover:shadow-lg ${
                CATEGORY_COLORS[message.category]
              } ${PRIORITY_STYLES[message.priority]} animate-fadeIn`}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {/* Category badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{CATEGORY_ICONS[message.category]}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                  {getCategoryLabel(message.category)}
                </span>
                <span className="ml-auto text-[10px] text-white/40 font-mono tabular-nums">
                  {formatTime(message.timestamp)}
                </span>
              </div>

              {/* Message content */}
              <div className="text-xs text-white/85 leading-relaxed font-mono break-words">
                {message.content}
              </div>

              {/* Priority indicator */}
              {message.priority === "high" && (
                <div className="absolute top-2 right-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                </div>
              )}

              {/* Symbol tag */}
              {message.symbol && (
                <div className="mt-2.5 inline-block px-2.5 py-1 rounded-md text-[10px] font-bold bg-white/10 text-white/70 border border-white/10">
                  {message.symbol}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="text-[10px] text-green-400/60 uppercase tracking-wider">Trades</div>
          <div className="text-sm font-bold text-green-400">
            {displayMessages.filter((m) => m.category === "trade_execution").length}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <div className="text-[10px] text-purple-400/60 uppercase tracking-wider">Signals</div>
          <div className="text-sm font-bold text-purple-400">
            {displayMessages.filter((m) => m.category === "advanced_signals").length}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="text-[10px] text-orange-400/60 uppercase tracking-wider">Alerts</div>
          <div className="text-sm font-bold text-orange-400">
            {displayMessages.filter((m) => m.priority === "high").length}
          </div>
        </div>
      </div>
    </div>
  );
}
