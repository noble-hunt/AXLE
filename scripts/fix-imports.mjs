import fs from "fs";
import path from "path";
import { glob } from "glob";

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, "client", "src");

function existsAny(base) {
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  for (const ext of exts) {
    const p = path.join(appRoot, base + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function pascal(s) {
  return s.split(/[-_]/g).map(x => x ? x[0].toUpperCase() + x.slice(1) : "").join("");
}

function findByLooseName(lastSeg) {
  const needle = lastSeg.replace(/[-_]/g, "").toLowerCase();
  const files = glob.sync("**/*.{tsx,ts,jsx,js}", { cwd: appRoot, nodir: true });
  for (const f of files) {
    const base = path.basename(f, path.extname(f)).replace(/[-_]/g, "").toLowerCase();
    if (base === needle) return path.join(appRoot, f);
  }
  return null;
}

function toAlias(pAbs) {
  const rel = path.relative(path.join(repoRoot, "client", "src"), pAbs).split(path.sep).join("/");
  return "@/" + rel.replace(/\/index\.(tsx|ts)$/, "");
}

function fixInFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const importRe = /from\s+["']@\/([^"']+)["']/g;
  let changed = false;
  const seen = new Set();
  src = src.replace(importRe, (m, rel) => {
    if (seen.has(rel)) return m;
    seen.add(rel);
    // if exists as-is, keep
    const exact = existsAny(rel);
    if (exact) return m;
    // try PascalCase on last segment
    const parts = rel.split("/");
    const last = parts.pop();
    const try1 = existsAny([...parts, pascal(last)].join("/"));
    if (try1) {
      const newAlias = toAlias(try1);
      changed = true;
      return `from "${newAlias}"`;
    }
    // try PascalCase of all segments
    const try2 = existsAny(parts.map(pascal).concat(pascal(last)).join("/"));
    if (try2) {
      const newAlias = toAlias(try2);
      changed = true;
      return `from "${newAlias}"`;
    }
    // try loose search by name anywhere
    const hit = findByLooseName(last);
    if (hit) {
      const newAlias = toAlias(hit);
      changed = true;
      return `from "${newAlias}"`;
    }
    // leave as-is; will be stubbed later
    return m;
  });
  if (changed) fs.writeFileSync(file, src);
  return changed;
}

function main() {
  const files = glob.sync("client/src/**/*.{tsx,ts,jsx,js}", { cwd: repoRoot, nodir: true });
  let total = 0;
  for (const f of files) {
    if (fixInFile(path.join(repoRoot, f))) total++;
  }
  console.log(`[fix-imports] files changed: ${total}`);
}
main();