import React from "react";

type ProviderCardProps = {
  name: string;
  description?: string;
  status: "connected" | "disconnected" | "unavailable";
  lastSyncText?: string;       // e.g. "Last sync: 1:42 PM"
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
};

export default function ProviderCard({
  name,
  description,
  status,
  lastSyncText,
  onConnect,
  onSync,
  onDisconnect,
}: ProviderCardProps) {
  const isConnected = status === "connected";
  const isUnavailable = status === "unavailable";

  return (
    <div className="w-full rounded-2xl bg-[#1d1f24] shadow px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        {/* LEFT: text/status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-block h-2 w-2 rounded-full",
                isConnected ? "bg-emerald-400" : isUnavailable ? "bg-zinc-500" : "bg-zinc-400",
              ].join(" ")}
            />
            <span className="text-base font-semibold text-white truncate">{name}</span>
          </div>

          {description ? (
            <p className="text-sm text-zinc-300 mt-1">{description}</p>
          ) : null}

          {isConnected && lastSyncText ? (
            <p className="text-xs text-zinc-400 mt-2">{lastSyncText}</p>
          ) : null}

          {!isConnected && !isUnavailable ? (
            <p className="text-sm text-zinc-400 mt-2">Disconnected</p>
          ) : null}

          {isUnavailable ? (
            <div className="mt-2 inline-flex px-2 py-0.5 text-xs rounded-full bg-white/90 text-zinc-900">
              Unavailable
            </div>
          ) : null}
        </div>

        {/* RIGHT: actions (stacked) */}
        <div className="flex flex-col items-stretch gap-2 shrink-0 w-36">
          {isConnected ? (
            <>
              <button
                className="h-9 rounded-xl bg-[#3267ff] text-white text-sm font-medium"
                onClick={onSync}
              >
                Sync Now
              </button>
              <button
                className="h-9 rounded-xl bg-[#e23d36] text-white text-sm font-medium"
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            </>
          ) : isUnavailable ? (
            <button
              className="h-9 rounded-xl bg-zinc-700 text-zinc-300 text-sm font-medium cursor-not-allowed"
              disabled
            >
              Connect
            </button>
          ) : (
            <button
              className="h-9 rounded-xl bg-[#3267ff] text-white text-sm font-medium"
              onClick={onConnect}
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}