#!/usr/bin/env node
// 统一入口：node src/cli.mjs --scene=<diorama|rural|nether|end> [其余参数透传给场景]
import { cliOpt, renderPNG } from "./render-core.mjs";

export const SCENES = {
  diorama: { mod: "./scenes/voxel-diorama.mjs", desc: "28×28 乡村小世界：池塘 / 橙顶小屋 / 铁轨 / 橡树", out: "voxel-diorama.png" },
  rural:   { mod: "./scenes/rural-16.mjs",     desc: "16×16 乡村：小溪 / 农田 / 木桥 / 稻草人",     out: "rural-16.png" },
  nether:  { mod: "./scenes/nether-16.mjs",    desc: "16×24 下界：岩浆湖 / 地狱门 / 天桥塔楼",       out: "nether-16.png" },
  end:     { mod: "./scenes/end-32.mjs",       desc: "32×32 末地：浮空岛 / 中央祭坛 / 黑曜石柱",     out: "end-32.png" },
};

const argv = process.argv.slice(2);
const usage = () => {
  const lines = ["voxel-diorama — 等距像素体素场景直出 PNG", "", "用法：node src/cli.mjs --scene=<name> [--s=] [--iso=] [--bg=] [--out=]", "", "可用场景："];
  for (const [k, v] of Object.entries(SCENES)) lines.push("  " + k.padEnd(8) + v.desc);
  lines.push("", "通用参数：--s 像素密度 / --iso 等距角 / --pad 留白 / --bg --bg2 背景 / --out 输出名", "其它：--list 列出场景，--help 显示本帮助");
  return lines.join("\n");
};

if (argv.includes("--help") || argv.includes("-h")) { console.log(usage()); process.exit(0); }
if (argv.includes("--list")) { for (const [k, v] of Object.entries(SCENES)) console.log(k.padEnd(8) + v.desc); process.exit(0); }

const name = cliOpt(argv, "scene", "diorama");
if (!SCENES[name]) {
  console.error("未知场景：" + name + "\n\n" + usage());
  process.exit(2);
}

const t0 = Date.now();
const mod = await import(SCENES[name].mod);
if (typeof mod.render !== "function") {
  console.error("场景 " + name + " 未导出 render()");
  process.exit(3);
}
mod.render();
console.log("done in " + (Date.now() - t0) + "ms");
