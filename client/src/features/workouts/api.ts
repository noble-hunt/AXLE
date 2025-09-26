import { httpJSON } from '@/lib/http';

export type DailySuggestionResponse = 
  | { suggestion: null; reason: 'unauthenticated' | 'insufficient-context' }
  | { suggestion: null; reason: 'server-error'; error: string; requestId?: string }
  | { suggestion: any; seed?: { rngSeed: string; generatorVersion: string } };

export async function fetchDailySuggestion(): Promise<DailySuggestionResponse> {
  try {
    const data = await httpJSON('api/suggestions/today');
    
    // If we get a valid response, return it
    if (data?.suggestion !== undefined) {
      return data;
    }
    
    // If no suggestion but no error, likely insufficient context
    return { suggestion: null, reason: 'insufficient-context' };
  } catch (error) {
    // Check if it's an authentication error
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      return { suggestion: null, reason: 'unauthenticated' };
    }
    
    // Extract requestId if available for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const requestIdMatch = errorMessage.match(/requestId[:\s]+([a-f0-9-]+)/i);
    
    return { 
      suggestion: null, 
      reason: 'server-error', 
      error: errorMessage,
      ...(requestIdMatch ? { requestId: requestIdMatch[1] } : {})
    };
  }
}