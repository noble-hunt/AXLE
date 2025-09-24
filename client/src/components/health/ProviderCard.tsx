import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  status?: 'connected' | 'disconnected' | 'error' | 'unavailable';
  lastSync?: string | null;
  onConnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
  busy?: boolean;
  disabled?: boolean;
};

export function ProviderCard({
  id, title, subtitle, status = 'disconnected', lastSync, onConnect, onSync, onDisconnect, busy, disabled = false
}: Props) {
  const dot =
    status === 'connected' ? 'bg-green-500' :
    status === 'error' ? 'bg-red-500' :
    status === 'unavailable' ? 'bg-gray-300' : 'bg-gray-500';
  
  const statusText =
    status === 'connected' ? 'Connected' :
    status === 'unavailable' ? 'Unavailable' : 'Not connected';

  return (
    <div className={`rounded-2xl bg-card p-4 flex flex-col gap-3 border border-border ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-card-foreground">{title}</div>
          {subtitle && <div className="text-muted-foreground text-sm">{subtitle}</div>}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
            {statusText}
            {lastSync && status !== 'unavailable' && <span className="ml-2">• Last sync: {lastSync}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {disabled || status === 'unavailable' ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full text-center text-sm text-muted-foreground py-2">
                  Provider configuration required
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Configure in Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : status !== 'connected' ? (
          <button className="btn w-full" onClick={onConnect} disabled={busy}>
            Connect
          </button>
        ) : (
          <>
            <button className="btn flex-1" onClick={onSync} disabled={busy}>Sync Now</button>
            <button className="btn-destructive flex-1" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}