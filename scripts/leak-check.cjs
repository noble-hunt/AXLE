// scripts/leak-check.js
const fs = require("fs");
const path = require("path");

const distDir = path.resolve("dist");       // Vite client output
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!fs.existsSync(distDir)) {
  console.log("[leak-check] dist/ not found; skipping.");
  process.exit(0);
}
const needles = new Set([
  "SUPABASE_SERVICE_ROLE_KEY"  // Always scan for the key name
]);

// If the actual key is available, also scan for it and its partials
if (key) {
  needles.add(key);
  needles.add(key.slice(0, 10));
  needles.add(key.slice(-10));
} else {
  console.log("[leak-check] SUPABASE_SERVICE_ROLE_KEY not set; scanning for key name only.");
}

let leaked = [];
function scan(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) scan(p);
    else if (/\.(js|mjs|css|html|map|txt)$/i.test(p)) {
      const buf = fs.readFileSync(p, "utf8");
      for (const n of needles) {
        if (n && buf.includes(n)) { leaked.push(`${p}`); break; }
      }
    }
  }
}
scan(distDir);

if (leaked.length) {
  console.error("\n[leak-check] ❌ Potential secret leak detected in client build:");
  console.error(leaked.join("\n"));
  console.error("\nAborting. Ensure server secrets are NEVER imported in client code.");
  process.exit(1);
}
console.log("[leak-check] ✅ no leaks found.");