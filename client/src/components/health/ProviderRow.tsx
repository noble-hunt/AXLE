import React from "react";
import clsx from "clsx";

type Status = "connected" | "disconnected" | "error" | "unavailable";

export type ProviderRowProps = {
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

function StatusDot({ status }: { status: Status }) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "error"
      ? "bg-red-500"
      : "bg-gray-500";
  return <span className={clsx("inline-block w-2 h-2 rounded-full", color)} />;
}

export default function ProviderRow({
  title,
  subtitle,
  status,
  lastSync,
  busy,
  badge,
  onConnect,
  onSync,
  onDisconnect,
}: ProviderRowProps) {
  const isUnavailable = status === "unavailable";

  return (
    <div
      className={clsx(
        "relative rounded-2xl bg-card border border-border",
        "px-4 py-4 md:px-6 md:py-5",
        "flex flex-col gap-4 md:flex-row md:items-center"
      )}
    >
      {/* Pinned badge */}
      {badge && (
        <span
          className={clsx(
            "absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-semibold z-10",
            badge === "Unavailable" ? "bg-white text-black" : "bg-white/20 text-white backdrop-blur"
          )}
        >
          {badge}
        </span>
      )}

      {/* Left: title / subtitle */}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold leading-tight truncate">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground leading-snug line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>

      {/* Middle: status/meta */}
      <div className="md:w-56">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <StatusDot status={status} />
          <span className="capitalize">
            {status === "unavailable" ? "Unavailable" : status}
          </span>
        </div>
        {lastSync && status === "connected" && (
          <div className="mt-1 text-xs text-muted-foreground">
            <span className="opacity-80">Last sync:</span> {lastSync}
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="w-full md:w-auto md:ml-auto">
        {isUnavailable ? (
          <button
            disabled
            title="Provider configuration required"
            className="w-full md:w-auto cursor-not-allowed opacity-60 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            Connect
          </button>
        ) : status === "connected" ? (
          <div className="flex flex-col md:flex-row gap-2 md:justify-end">
            <button
              onClick={onSync}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {busy ? "Syncing…" : "Sync Now"}
            </button>
            <button
              onClick={onDisconnect}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap bg-red-600/90 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={busy}
            className="w-full md:w-auto rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}