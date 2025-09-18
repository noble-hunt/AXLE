const fs = require("fs");
const path = require("path");

const dir = "public/ui_ref";
if (!fs.existsSync(dir)) {
  console.error(`[refs] directory not found: ${dir}`);
  process.exit(1);
}

const files = fs.readdirSync(dir)
  .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

// refs.json: [{ "file": "ref-01.png" }, ...]
fs.writeFileSync(
  path.join(dir, "refs.json"),
  JSON.stringify(files.map(file => ({ file })), null, 2)
);

// map.json template (only if missing)
const mapPath = path.join(dir, "map.json");
if (!fs.existsSync(mapPath)) {
  const defaults = ["/", "/workout/:id", "/history", "/prs"];
  const mapping = Object.fromEntries(files.map((f, i) => [f, defaults[i] || "/"]));
  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
}

console.log(`[refs] wrote ${files.length} refs to public/ui_ref/refs.json`);
