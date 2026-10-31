// 场景：32×32 末地——浮空岛 / 阶梯祭坛（基岩台 + 3×3 返回传送门） / 10 根黑曜石柱 + 末影水晶
import { makeWorld, renderPNG, hash2, cliOpt } from "../render-core.mjs";

const W = 32, D = 32, HMAX = 32;
const AIR = 0, END = 1, OBS = 2, BED = 3, PORTAL = 4, CRYSTAL = 5, PURPUR = 6, CHORUS = 7;
const C = {
  1:[219,222,160], 2:[26,20,40], 3:[48,48,54], 4:[12,10,24],
  5:[236,150,240], 6:[169,125,169], 7:[150,110,160],
};
const ALT_Y = 7;          // 祭坛平台顶面高度（地形压平在 4，所以要砌 3 层基座）
const HS = [7, 10, 13, 8, 6, 9, 12, 14, 9, 11];   // 10 根柱子各自高度
const RING_A = 0.36;          // 柱子环起始角：避开 45° 视轴，否则水晶会正好压在传送门格子上

export function build() {
  const w = makeWorld(W, D, HMAX, []);
  const { get, set } = w;

  // ---- 浮空岛：半径随角度起伏，边缘天然碎成锯齿 ----
  const cx = 15.5, cz = 15.5;
  const hmap = new Int8Array(W * D).fill(-1);          // -1 = 虚空（不落任何方块）
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
    const R = 13.6 + 1.5*Math.sin(3*th + 0.7) + 1.0*Math.sin(5*th + 2.1);
    if (d > R) continue;
    let h = Math.round(3 + 1.3*Math.sin(x*0.42)*Math.cos(z*0.47) + 0.9*Math.sin((x+z)*0.33));
    h = Math.max(1, Math.min(6, h));
    if (d < 7.5) h = 4;                                 // 祭坛区压平
    hmap[z*W + x] = h;
    for (let y = 0; y <= h; y++) set(x, y, z, END);
  }
  const top = (x, z) => (x < 0 || z < 0 || x >= W || z >= D) ? -1 : hmap[z*W + x];

  // ---- 中心祭坛：实心基座 + 三级台阶 + 基岩台 + 3×3 返回传送门 ----
  for (let x = 10; x <= 21; x++) for (let z = 10; z <= 21; z++) {       // 基座填实，别让平台悬空
    if (x < 11 || x > 20 || z < 11 || z > 20) continue;
    for (let y = Math.max(0, top(x, z)) + 1; y < ALT_Y; y++) set(x, y, z, END);
  }
  for (let x = 11; x <= 20; x++) for (let z = 11; z <= 20; z++) set(x, ALT_Y, z, END);        // 10×10 平台
  for (let x = 12; x <= 19; x++) for (let z = 12; z <= 19; z++) set(x, ALT_Y+1, z, END);      // 8×8 二级
  for (let x = 13; x <= 18; x++) for (let z = 13; z <= 18; z++) set(x, ALT_Y+2, z, BED);      // 6×6 基岩台
  for (let x = 14; x <= 18; x++) for (let z = 14; z <= 18; z++) {
    const edge = (x === 14 || x === 18 || z === 14 || z === 18);
    if (edge) set(x, ALT_Y+3, z, BED);                                                        // 5×5 外圈，包住 3×3 门
  }
  for (let x = 15; x <= 17; x++) for (let z = 15; z <= 17; z++) set(x, ALT_Y+3, z, PORTAL);   // 3×3 传送门
  for (const [px, pz] of [[11,11],[11,20],[20,11],[20,20]]) {                                  // 平台四角紫珀
    set(px, ALT_Y, pz, PURPUR); set(px, ALT_Y+1, pz, PURPUR);
  }

  // ---- 10 根黑曜石柱：2×2 柱身 + 基岩顶 + 单颗末影水晶 ----
  const pillars = [];
  for (let k = 0; k < 10; k++) {
    const a = k * 2*Math.PI/10 + RING_A, r = 10;
    const px = Math.round(cx + r*Math.cos(a)), pz = Math.round(cz + r*Math.sin(a));
    const base = top(px, pz);
    if (base < 0) continue;                                    // 圆整后掉出岛就跳过
    if (pillars.some(p => Math.abs(p[0]-px) < 2 && Math.abs(p[1]-pz) < 2)) continue;
    pillars.push([px, pz]);
    const hgt = HS[k];
    for (const dx of [0,1]) for (const dz of [0,1])
      for (let y = base + 1; y <= base + hgt; y++) set(px+dx, y, pz+dz, OBS);
    set(px, base + hgt + 1, pz, BED);                          // 基岩顶
    set(px, base + hgt + 2, pz, CRYSTAL);                      // 水晶浮在顶上
  }

  // ---- 紫颂植物：末地唯一的"树" ----
  for (const [sx, sz] of [[10,23],[22,9],[23,22],[8,10],[24,15]]) {
    const base = top(sx, sz);
    if (base < 0) continue;
    set(sx, base+1, sz, CHORUS); set(sx, base+2, sz, CHORUS);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;  // 去掉四角，做出蓬松感
      set(sx+dx, base+3, sz+dz, CHORUS);
    }
    set(sx, base+4, sz, CHORUS);
  }
  return w;
}

export function texel(b, face, tx, ty, axis) {
  const n = hash2(tx + b*31, ty + (face === 'top' ? 0 : 97), b*7 + 3);

  if (b === END) {                                   // 末地石：米黄底 + 稀疏暗斑
    const sp = hash2(tx, ty, 11);
    return [219, 222, 160].map(v => v*(0.93 + 0.14*n)*(sp > 0.9 ? 0.88 : 1));
  }
  if (b === OBS) {                                   // 黑曜石：近黑 + 紫色矿点
    const sp = hash2(tx, ty, 41);
    return (sp > 0.86 ? [70, 50, 120] : [26, 20, 40]).map(v => v*(0.85 + 0.3*n));
  }
  if (b === BED) {                                   // 基岩：粗颗粒双色块
    const patch = hash2(tx >> 2, ty >> 2, 29);
    return (patch > 0.5 ? [66, 66, 72] : [38, 38, 44]).map(v => v*(0.9 + 0.2*n));
  }
  if (b === PORTAL) {                                // 返回传送门：黑底 + 星点
    return hash2(tx, ty, 77) > 0.93 ? [190, 210, 255] : [10, 8, 20];
  }
  if (b === CRYSTAL) {                               // 末影水晶：粉紫发光
    return hash2(tx, ty, 91) > 0.6 ? [252, 196, 246] : [218, 118, 230].map(v => v*(0.9 + 0.2*n));
  }
  if (b === PURPUR) {                                // 紫珀：竖向条纹
    return [169, 125, 169].map(v => v*(tx % 4 === 0 ? 0.86 : 1)*(0.94 + 0.12*n));
  }
  if (b === CHORUS) {                                // 紫颂：紫褐 + 节点
    return [150, 110, 160].map(v => v*(hash2(tx >> 1, ty >> 1, 67) > 0.7 ? 0.82 : 1)*(0.92 + 0.16*n));
  }
  return [200, 200, 200].map(v => v*(0.92 + 0.16*n));
}

export function render() {
  const argv = process.argv.slice(2);
  const opt = (k, def) => cliOpt(argv, k, def);
  const bgHex = opt("bg", "302A4E"), bg2Hex = opt("bg2", "1A1430");
  const bg = [0, 2, 4].map(i => parseInt(bgHex.slice(i, i+2), 16));
  const bg2 = [0, 2, 4].map(i => parseInt(bg2Hex.slice(i, i+2), 16));
  renderPNG({
    w: build(),
    s: +opt("s", 20), iso: +opt("iso", 30), pad: +opt("pad", 30), bg, bg2,
    out: opt("out", "end-32.png"), fit: true,
    water: -1,                                    // 没有"水"方块；默认 0 会把虚空当成遮挡
    texel,
    emissive: [CRYSTAL, PORTAL],
    bloom: { thr: 215, strength: 0.25, radius: 2 },
  });
}

const isMain = process.argv[1] && process.argv[1].endsWith("end-32.mjs");
if (isMain) render();
