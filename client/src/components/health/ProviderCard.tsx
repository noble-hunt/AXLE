import React from "react";
import clsx from "clsx";

type Status = "connected" | "disconnected" | "error" | "unavailable";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  status: Status;
  lastSync?: string | null;
  busy?: boolean;
  badge?: "Unavailable" | "Beta" | null;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
};

export function ProviderCard({
  id,
  title,
  subtitle,
  status,
  lastSync,
  busy,
  badge,
  onConnect,
  onSync,
  onDisconnect,
}: Props) {
  const dot =
    status === "connected"
      ? "bg-green-500"
      : status === "error"
      ? "bg-red-500"
      : "bg-gray-500";

  const disabled = status === "unavailable";

  return (
    <div
      className={clsx(
        "relative rounded-2xl bg-card shadow/20 shadow-black/10",
        "p-4 flex flex-col justify-between min-h-[220px]",
        "border border-border"
      )}
    >
      {/* Badge (pinned) */}
      {badge && (
        <span
          className={clsx(
            "absolute top-3 right-3 z-10",
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            badge === "Unavailable"
              ? "bg-white text-black"
              : "bg-white/20 text-white backdrop-blur"
          )}
        >
          {badge}
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold leading-tight truncate">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground leading-snug line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Status & meta */}
      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
        <span className={clsx("inline-block w-2 h-2 rounded-full", dot)} />
        <span className="capitalize">
          {status === "unavailable" ? "Unavailable" : status}
        </span>
        {lastSync && status === "connected" && (
          <span className="before:content-['•'] before:mx-2">
            Last sync: {lastSync}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4">
        {/* Unavailable → disabled */}
        {status === "unavailable" ? (
          <button
            disabled
            className="w-full cursor-not-allowed opacity-60 select-none rounded-xl border border-white/10 px-4 py-2 text-sm"
            title="Provider configuration required"
          >
            Connect
          </button>
        ) : status === "connected" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onSync}
              disabled={busy}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {busy ? "Syncing…" : "Sync Now"}
            </button>
            <button
              onClick={onDisconnect}
              disabled={busy}
              className="rounded-xl bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}