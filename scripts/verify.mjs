#!/usr/bin/env node
// 冒烟自检：依次渲染全部场景，核对输出尺寸与绘制方块数；任何一项不符即以非 0 退出。
// 用法：node scripts/verify.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".verify");
const CASES = [
  { id: "diorama", mod: "src/scenes/voxel-diorama.mjs", w: 1030, h: 940, blocks: 2234 },
  { id: "rural",   mod: "src/scenes/rural-16.mjs",      w: 836,  h: 788, blocks: 777 },
  { id: "nether",  mod: "src/scenes/nether-16.mjs",     w: 1030, h: 774, blocks: 1207 },
  { id: "end",     mod: "src/scenes/end-32.mjs",        w: 788,  h: 790, blocks: 1818 },
  { id: "example", mod: "examples/minimal.mjs",         w: 448,  h: 564, blocks: 186 },
];

const realLog = console.log;
fs.mkdirSync(outDir, { recursive: true });
let failed = 0;

for (const c of CASES) {
  const out = path.join(outDir, c.id + ".png");
  process.argv = [process.argv[0], "verify-runner", "--out=" + out];
  let line = "";
  console.log = (...a) => { line = a.join(" "); };
  try {
    const mod = await import(new URL("../" + c.mod, import.meta.url).href);
    if (typeof mod.render === "function") mod.render();
  } catch (e) {
    console.log = realLog;
    failed++; realLog("FAIL " + c.id.padEnd(8) + "渲染抛错：" + e.message); continue;
  } finally {
    console.log = realLog;
  }
  const m = line.match(/(\d+)x(\d+) blocks (\d+)/);
  if (!fs.existsSync(out)) { failed++; realLog("FAIL " + c.id.padEnd(8) + "没有生成文件"); continue; }
  if (!m) { failed++; realLog("FAIL " + c.id.padEnd(8) + "输出行无法解析：" + line); continue; }
  const w = +m[1], h = +m[2], blocks = +m[3];
  const ok = w === c.w && h === c.h && blocks === c.blocks;
  realLog((ok ? "PASS " : "FAIL ") + c.id.padEnd(8) + w + "x" + h + " blocks " + blocks +
    (ok ? "" : "  期望 " + c.w + "x" + c.h + " blocks " + c.blocks));
  if (!ok) failed++;
}

fs.rmSync(outDir, { recursive: true, force: true });
if (failed) { realLog("\n" + failed + " 项失败"); process.exit(1); }
realLog("\n全部通过 ✓");
