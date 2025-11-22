import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { NotificationItem } from "../types/notifications";

interface BotNotificationProps {
  message: NotificationItem;
  onClose: () => void;
  duration?: number;
}

export default function BotNotification({ message, onClose, duration = 5000 }: BotNotificationProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`
        pointer-events-auto group relative w-full max-w-sm overflow-hidden rounded-lg border backdrop-blur-md
        bg-gradient-to-r ${message.color.from} ${message.color.to} ${message.color.border}
        shadow-xl transition-all duration-300
        ${isExiting ? "animate-slideOutRight" : "animate-slideInRight"}
        ${message.priority === "high" ? "ring-1 ring-white/30" : ""}
      `}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-lg sm:text-xl">{message.icon}</div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/60">
                {message.category}
              </span>
              {message.priority === "high" && (
                <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase bg-red-500/30 text-red-200">
                  High
                </span>
              )}
            </div>
            <p className="break-words text-[13px] font-mono leading-relaxed text-white/90">
              {message.body}
            </p>
            {message.symbol && (
              <div className="mt-2 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                <span>Symbol</span>
                <span className="text-white">{message.symbol}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex-shrink-0 rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all"
          style={{
            width: isExiting ? "0%" : "100%",
            transition: `width ${duration}ms linear`,
          }}
        />
      </div>
    </div>
  );
}
