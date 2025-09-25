/**
 * Application route constants
 */
export const ROUTES = {
  WORKOUT_GENERATE: '/workout/generate',
  WORKOUT_DETAIL: '/workout',
  WORKOUT_LOG: '/workout/log',
  HISTORY: '/history',
  HOME: '/',
  PROFILE: '/profile',
  AUTH_LOGIN: '/auth/login',
  HEALTH: '/health',
  PRS: '/prs',
  ACHIEVEMENTS: '/achievements',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RouteValue = typeof ROUTES[RouteKey];