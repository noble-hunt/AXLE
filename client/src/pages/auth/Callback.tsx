import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Callback() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    (async () => {
      try {
        // First, try OAuth code exchange for PKCE (Google OAuth)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        
        if (exchangeError && !exchangeError.message?.includes('No code detected')) {
          console.error('OAuth code exchange error:', exchangeError);
          setLocation('/auth/login', { replace: true });
          return;
        }
        
        // Fallback: ensure session is set (magic link, hash flow)
        await supabase.auth.getSession();
        setLocation('/', { replace: true });
      } catch (error) {
        console.error('Callback error:', error);
        setLocation('/auth/login', { replace: true });
      }
    })();
  }, [setLocation]);
  
  return (
    <div className="h-screen grid place-items-center text-muted-foreground">
      <div className="flex items-center gap-2">
        <Loader2 className="animate-spin" />
        <span>Signing you in…</span>
      </div>
    </div>
  );
}