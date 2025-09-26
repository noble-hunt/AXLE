import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { LoadingState } from '@/components/ui/loading-state';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthed(!!session);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Handle redirect in useEffect to avoid side effects during render
  useEffect(() => {
    if (!loading && !authed) {
      setLocation('/auth/login');
    }
  }, [loading, authed, setLocation]);

  if (loading) return <LoadingState message="Authenticating..." />;
  return authed ? <>{children}</> : null;
}