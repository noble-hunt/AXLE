import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/hooks/use-toast';
import { fetchTodaySuggestion, startSuggestedWorkout, rotateSuggestion } from './suggest/api';

export function useDailySuggestion() {
  const { isAuthenticated } = useAppStore();
  const [isStarting, setIsStarting] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/workouts/suggest/today'],
    queryFn: fetchTodaySuggestion,
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });

  const startNow = async () => {
    if (!data) return;
    
    setIsStarting(true);
    try {
      // Transform data to match the expected suggestion format
      const suggestion = {
        focus: data.config.focus || 'Mixed Training',
        minutes: data.config.duration || 30,
        intensity: data.config.intensity || 5,
        seed: data.seed || {},
        generatorVersion: data.seed?.generatorVersion || 'v0.3.0'
      };

      const workoutId = await startSuggestedWorkout(suggestion);
      setLocation(`/workout/${workoutId}`);
    } catch (error: any) {
      const status = error?.status ?? 0;
      
      if (status === 401) {
        toast({
          variant: 'destructive',
          title: 'Sign in required',
          description: 'Please sign in to start your suggested workout.',
        });
        setLocation('/auth/login');
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to start workout',
          description: error?.message ?? 'Please try again.',
        });
        // Fall back to the generator
        setLocation('/workout/generate');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const tryDifferentFocus = async () => {
    setIsRotating(true);
    try {
      // Use the rotateSuggestion function which handles fallback automatically
      await rotateSuggestion();
      
      // Invalidate the cache and refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/workouts/suggest/today'] 
      });
      await refetch();
      
      toast({
        title: 'New suggestion generated',
        description: 'Here\'s a different workout for you to try.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to generate new suggestion',
        description: error?.message ?? 'Please try again.',
      });
    } finally {
      setIsRotating(false);
    }
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    data,
    isLoading,
    error,
    isStarting,
    isRotating,
    startNow,
    tryDifferentFocus,
    refresh
  };
}