import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function MetricCard({
  keyName,
  title,
  unit,
  icon,
  colorClass = "",
  description,
}: {
  keyName: string;
  title: string;
  unit?: string;
  icon?: React.ReactNode;
  colorClass?: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const charts = useAppStore(s => s.charts as any);
  const series = charts?.[keyName] ?? [];

  const latest = series.length ? series[series.length - 1].value : null;

  // Prevent body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-2xl bg-[#1d1f24] px-4 py-3 text-left shadow w-full",
          "hover:bg-[#20242b] active:bg-[#1b1e24] transition-colors"
        )}
        data-testid={`metric-card-${keyName}`}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex-shrink-0 opacity-80">
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white/90 text-base font-medium truncate">{title}</div>
            <div className="text-white/60 text-sm">
              {latest != null ? `${latest}${unit ?? ""}` : "--"}
            </div>
          </div>
          <span className={`w-2 h-2 rounded-full ${colorClass || "bg-blue-400"}`} />
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50"
          onClick={() => setOpen(false)}
          aria-modal
          role="dialog"
          data-testid={`metric-sheet-${keyName}`}
        >
          {/* Sheet container wrapper pinned to bottom */}
          <div className="absolute inset-x-0 bottom-0">
            {/* Constrained panel; centered; mobile-first */}
            <div
              className="mx-auto w-full max-w-[420px] sm:max-w-[480px]
                         rounded-t-2xl bg-[#101215] shadow-lg
                         px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0)+1rem)]
                         max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-3">
                <div className="text-white/90 text-lg font-semibold">{title}</div>
                <div className="text-white/60 text-sm">
                  Current: {latest != null ? `${latest}${unit ?? ""}` : "--"}
                </div>
              </div>

              {/* Chart */}
              <div className="h-44 sm:h-48 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series.map((d: any) => ({ x: d.date, y: d.value }))}>
                    <XAxis dataKey="x" hide />
                    <YAxis hide />
                    <Tooltip formatter={(v) => (v == null ? "--" : v)} />
                    <Line
                      type="monotone"
                      dataKey="y"
                      dot={false}
                      stroke="currentColor"
                      strokeWidth={2}
                      className={colorClass || "text-blue-400"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Description */}
              <div className="text-white/80 text-sm leading-relaxed mb-4">
                {description}
              </div>

              {/* Close */}
              <button
                className="mt-4 h-11 w-full rounded-xl bg-white/10 text-white font-medium transition-colors hover:bg-white/15"
                onClick={() => setOpen(false)}
                data-testid="close-metric-sheet"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}