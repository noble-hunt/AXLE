import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  debounceMs?: number;
}

export function useRateLimit(options: RateLimitOptions) {
  const { maxAttempts, windowMs, debounceMs = 300 } = options;
  const { toast } = useToast();
  
  const [attempts, setAttempts] = useState<number[]>([]);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const isRateLimited = useCallback(() => {
    const now = Date.now();
    const recentAttempts = attempts.filter(attempt => now - attempt < windowMs);
    return recentAttempts.length >= maxAttempts;
  }, [attempts, maxAttempts, windowMs]);

  const execute = useCallback(async <T,>(
    fn: () => Promise<T> | T,
    onRateLimited?: () => void
  ): Promise<T | null> => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set debouncing state
    setIsDebouncing(true);

    return new Promise((resolve) => {
      debounceTimerRef.current = setTimeout(async () => {
        setIsDebouncing(false);
        
        if (isRateLimited()) {
          toast({
            title: "Slow down! 🐌",
            description: `Please wait before trying again. Rate limit: ${maxAttempts} attempts per ${Math.floor(windowMs / 1000)} seconds.`,
            variant: "destructive",
          });
          
          onRateLimited?.();
          resolve(null);
          return;
        }

        // Record this attempt
        const now = Date.now();
        setAttempts(prev => {
          const recent = prev.filter(attempt => now - attempt < windowMs);
          return [...recent, now];
        });

        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          console.error('Rate limited function failed:', error);
          resolve(null);
        }
      }, debounceMs);
    });
  }, [isRateLimited, maxAttempts, windowMs, debounceMs, toast]);

  const reset = useCallback(() => {
    setAttempts([]);
    setIsDebouncing(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    execute,
    isRateLimited: isRateLimited(),
    isDebouncing,
    reset,
  };
}

// Specific hooks for common use cases
export function useReactionRateLimit() {
  return useRateLimit({
    maxAttempts: 15, // Client-side limit is lower than server (20/min)
    windowMs: 60 * 1000, // 1 minute
    debounceMs: 100, // Quick reactions should still feel responsive
  });
}

export function useComposerRateLimit() {
  return useRateLimit({
    maxAttempts: 5, // 5 posts per minute
    windowMs: 60 * 1000, // 1 minute  
    debounceMs: 500, // Half second debounce for posts
  });
}