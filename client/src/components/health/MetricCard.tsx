import { useState } from "react";
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
          data-testid={`metric-sheet-${keyName}`}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#101215] p-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h3 className="text-white text-lg font-semibold mb-1">{title}</h3>
              <div className="text-white/60 text-sm">
                Current: {latest != null ? `${latest}${unit ?? ""}` : "--"}
              </div>
            </div>
            
            <div className="h-40 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.map((d: any) => ({ x: d.date, y: d.value }))}>
                  <XAxis dataKey="x" hide />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(v) => v == null ? "--" : v} 
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: '#1d1f24',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
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
            
            <div className="mb-4">
              <h4 className="text-white/90 text-sm font-medium mb-2">Why it matters</h4>
              <p className="text-white/70 text-sm leading-relaxed">{description}</p>
            </div>
            
            <button 
              className="mt-4 mb-1 h-11 w-full rounded-xl bg-white/10 text-white font-medium transition-colors hover:bg-white/15"
              onClick={() => setOpen(false)}
              data-testid="close-metric-sheet"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}