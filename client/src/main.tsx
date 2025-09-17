import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Client bootstrap guard - check for required environment variables
const ok = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
if (!ok) console.error("[env] Missing VITE_SUPABASE_* client envs.");

createRoot(document.getElementById("root")!).render(<App />);
