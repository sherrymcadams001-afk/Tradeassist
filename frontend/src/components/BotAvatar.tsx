import React from "react";

interface BotAvatarProps {
  isActive: boolean;
  marketCondition?: "volatile" | "stable" | "trending" | "ranging";
  className?: string;
}

/**
 * Orion Bot Avatar - Visual representation of the bot with status indicators
 */
export default function BotAvatar({ isActive, marketCondition = "stable", className = "" }: BotAvatarProps) {
  const getStatusColor = () => {
    if (!isActive) return "bg-gray-500";
    switch (marketCondition) {
      case "volatile":
        return "bg-red-500";
      case "trending":
        return "bg-green-500";
      case "ranging":
        return "bg-blue-500";
      default:
        return "bg-cyan-400";
    }
  };

  const getGlowColor = () => {
    if (!isActive) return "shadow-gray-500/20";
    switch (marketCondition) {
      case "volatile":
        return "shadow-red-500/50";
      case "trending":
        return "shadow-green-500/50";
      case "ranging":
        return "shadow-blue-500/50";
      default:
        return "shadow-cyan-400/50";
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Outer pulse ring */}
      {isActive && (
        <div
          className={`absolute inset-0 rounded-full ${getStatusColor()} opacity-75 animate-ping`}
          style={{ animationDuration: "2s" }}
        />
      )}

      {/* Main avatar container */}
      <div
        className={`relative w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700 p-[2px] shadow-lg ${getGlowColor()}`}
      >
        <div className="w-full h-full rounded-full bg-[#0B0C10] flex items-center justify-center">
          {/* Bot icon - using stylized "O" for Orion */}
          <div className="relative">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer ring */}
              <circle cx="14" cy="14" r="11" stroke="url(#gradient1)" strokeWidth="2" fill="none" />
              
              {/* Inner star pattern */}
              <path
                d="M14 7 L16 12 L21 12 L17 15 L18.5 20 L14 17 L9.5 20 L11 15 L7 12 L12 12 Z"
                fill="url(#gradient2)"
                className={isActive ? "animate-pulse" : ""}
              />
              
              <defs>
                <linearGradient id="gradient1" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="gradient2" x1="7" y1="7" x2="21" y2="20">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>

            {/* Activity indicator dot */}
            {isActive && (
              <div className="absolute -top-1 -right-1">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status label */}
      {isActive && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div className="text-[10px] font-semibold text-cyan-400 tracking-wider">
            {marketCondition.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}
