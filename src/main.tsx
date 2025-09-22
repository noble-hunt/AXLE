// Temporary shim to fix Vite path resolution
// Re-exports from the actual main.tsx in client directory
export * from '../client/src/main.tsx';
import '../client/src/main.tsx';