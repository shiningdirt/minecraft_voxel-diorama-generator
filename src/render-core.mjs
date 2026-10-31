// 通用体素正交渲染核心：世界数组 + 投影 + 面剔除 + AO + painter 排序 + PNG 编码
import fs from "node:fs";
import zlib from "node:zlib";

export function makeWorld(W, D, HMAX, seeThrough = []) {
  const world = new Uint8Array(W * HMAX * D);
  const idx = (x, y, z) => (y * D + z) * W + x;
  const inb = (x, y, z) => x >= 0 && x < W && y >= 0 && y < HMAX && z >= 0 && z < D;
  const get = (x, y, z) => (inb(x, y, z) ? world[idx(x, y, z)] : 0);
  const set = (x, y, z, b) => { if (inb(x, y, z)) world[idx(x, y, z)] = b; };
  const solid = (x, y, z) => { const b = get(x, y, z); return b !== 0 && !seeThrough.includes(b); };
  return { world, get, set, solid, idx, inb, W, D, HMAX, seeThrough };
}

export function renderPNG(o) {
  const { w, s = 20, iso = 30, pad = 30, bg = [223, 238, 250], out = "out.png" } = o;
  const { W, D, HMAX, get, solid, seeThrough } = w;
  const texel = o.texel, blockHeight = o.blockHeight || (() => 1), water = o.water ?? 0;
  const sprites = o.sprites || [];          // 这些方块画成两片交叉竖直面片
  const emissive = o.emissive || [];         // 自发光方块：忽略 AO，亮度只跟朝向有关
  const cosA = Math.cos(iso * Math.PI / 180), sinA = Math.sin(iso * Math.PI / 180);
  const proj = (wx, wy, wz) => [(wx - wz) * cosA * s, (wx + wz) * sinA * s - wy * s];

  // 先收集要画的方块（完全被遮挡的不进入绘制队列）
  const blocks = [];
  for (let y = 0; y < HMAX; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const b = get(x, y, z); if (b === 0) continue;
    // 完全被遮挡才跳过：判定必须和 hidden() 一致——水算遮挡，半透明的面片（作物/花）不算
    const occ = (dx, dy, dz) => solid(x+dx, y+dy, z+dz) || get(x+dx, y+dy, z+dz) === water;
    if (occ(0,-1,0) && occ(0,1,0) && occ(-1,0,0) && occ(1,0,0) && occ(0,0,-1) && occ(0,0,1)) continue;
    blocks.push({ x, y, z, b, k: x + y + z });
  }
  blocks.sort((a, b) => a.k - b.k);

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  if (o.fit && blocks.length) {
    // 按真实方块范围裁边：省掉只在理论包围盒里才存在的空白
    for (const { x, y, z, b } of blocks) {
      const hh = blockHeight(b);
      for (const dx of [0, 1]) for (const dy of [0, hh]) for (const dz of [0, 1]) {
        const [px, py] = proj(x+dx, y+dy, z+dz);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
  } else {
    for (const [x, y, z] of [[0, 0, 0], [W, 0, 0], [0, 0, D], [0, HMAX, 0], [W, 0, D]]) {
      const [px, py] = proj(x, y, z);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const PADPX = pad;
  const IW = Math.ceil(maxX - minX + 2 * PADPX), IH = Math.ceil(maxY - minY + 2 * PADPX);
  const bg2 = o.bg2 || bg;                        // 可选：背景竖向渐变（bg 顶部 → bg2 底部）
  const buf = new Float32Array(IW * IH * 3);
  for (let y = 0; y < IH; y++) {
    const t = IH > 1 ? y / (IH - 1) : 0;
    const cr = bg[0] + (bg2[0]-bg[0])*t, cg = bg[1] + (bg2[1]-bg[1])*t, cb = bg[2] + (bg2[2]-bg[2])*t;
    for (let x = 0; x < IW; x++) { const i = (y*IW + x)*3; buf[i] = cr; buf[i+1] = cg; buf[i+2] = cb; }
  }
  const OX = -minX + PADPX, OY = -minY + PADPX;

  function putpx(x, y, c) {
    if (x < 0 || y < 0 || x >= IW || y >= IH) return;
    const i = (y * IW + x) * 3;
    if (c.length === 4 && c[3] < 1) {            // [r,g,b,a] 半透明叠加
      const a = c[3];
      buf[i]   = buf[i]   * (1 - a) + c[0] * a;
      buf[i+1] = buf[i+1] * (1 - a) + c[1] * a;
      buf[i+2] = buf[i+2] * (1 - a) + c[2] * a;
      return;
    }
    buf[i] = c[0]; buf[i+1] = c[1]; buf[i+2] = c[2];
  }
  const NX = [1, 0, 0], NY = [0, 1, 0], NZ = [0, 0, 1];
  function aoAt(x, y, z, n, a, b) {
    const s1 = solid(x+n[0]+a[0], y+n[1]+a[1], z+n[2]+a[2]) ? 1 : 0;
    const s2 = solid(x+n[0]+b[0], y+n[1]+b[1], z+n[2]+b[2]) ? 1 : 0;
    const co = solid(x+n[0]+a[0]+b[0], y+n[1]+a[1]+b[1], z+n[2]+a[2]+b[2]) ? 1 : 0;
    const lvl = (s1 && s2) ? 0 : 3 - (s1 + s2 + co);
    return 0.55 + 0.15 * lvl;
  }
  const EPS = 0.035;
  function fill(P, ao, face, blk, shade, axis) {
    const O = P[0], U = [P[1][0]-O[0], P[1][1]-O[1]], V = [P[3][0]-O[0], P[3][1]-O[1]];
    const det = U[0]*V[1] - U[1]*V[0]; if (Math.abs(det) < 1e-9) return;
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1;
    const y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 1;
    for (let py = y0; py <= y1; py++) for (let pxx = x0; pxx <= x1; pxx++) {
      const dx = pxx + 0.5 - O[0], dy = py + 0.5 - O[1];
      let u = (dx*V[1] - dy*V[0]) / det, v = (U[0]*dy - U[1]*dx) / det;
      if (u < -EPS || u > 1 + EPS || v < -EPS || v > 1 + EPS) continue;
      u = Math.min(0.9999, Math.max(0, u)); v = Math.min(0.9999, Math.max(0, v));
      const tx = Math.floor(u * 16), ty = Math.floor(v * 16);
      const col = texel(blk, face, tx, ty, axis);   // 第 5 参：'y' 顶面 / 'x' 右面 / 'z' 左面
      if (!col) continue;                       // null = 透明，透出下层
      const t0 = ao[0] + (ao[1]-ao[0]) * u, t1 = ao[3] + (ao[2]-ao[3]) * u;
      const k = emissive.includes(blk) ? 1 : shade * (t0 + (t1 - t0) * v);   // 自发光全亮，不吃 AO/shade
      putpx(pxx, py, col.map(c => c * k));
    }
  }

  for (const B of blocks) {
    const { x, y, z, b } = B, hh = blockHeight(b);
    if (sprites.includes(b)) {
      // 交叉面片：两条对角线各一片，贴图带透明镂空
      for (const [[ax, az], [bx, bz]] of [[[x, z], [x + 1, z + 1]], [[x + 1, z], [x, z + 1]]]) {
        const P = [proj(ax, y, az), proj(bx, y, bz), proj(bx, y + hh, bz), proj(ax, y + hh, az)].map(p => [p[0] + OX, p[1] + OY]);
        fill(P, [1, 1, 1, 1], "cross", b, 1.0, "c");
      }
      continue;
    }
    const yt = y + hh;
    const hidden = (dx, dy, dz) => solid(x+dx, y+dy, z+dz) || get(x+dx, y+dy, z+dz) === water;
    if (!hidden(0, 1, 0)) {
      const P = [proj(x,yt,z), proj(x+1,yt,z), proj(x+1,yt,z+1), proj(x,yt,z+1)].map(p => [p[0]+OX, p[1]+OY]);
      const ao = [aoAt(x,y,z,NY,[-1,0,0],[0,0,-1]), aoAt(x,y,z,NY,[1,0,0],[0,0,-1]), aoAt(x,y,z,NY,[1,0,0],[0,0,1]), aoAt(x,y,z,NY,[-1,0,0],[0,0,1])];
      fill(P, ao, "top", b, 1.0, "y");
    }
    if (!hidden(1, 0, 0)) {
      const P = [proj(x+1,yt,z), proj(x+1,y,z), proj(x+1,y,z+1), proj(x+1,yt,z+1)].map(p => [p[0]+OX, p[1]+OY]);
      const ao = [aoAt(x,y,z,NX,[0,1,0],[0,0,1]), aoAt(x,y,z,NX,[0,-1,0],[0,0,1]), aoAt(x,y,z,NX,[0,-1,0],[0,0,-1]), aoAt(x,y,z,NX,[0,1,0],[0,0,-1])];
      fill(P, ao, "side", b, 0.82, "x");
    }
    if (!hidden(0, 0, 1)) {
      const P = [proj(x,yt,z+1), proj(x+1,yt,z+1), proj(x+1,y,z+1), proj(x,y,z+1)].map(p => [p[0]+OX, p[1]+OY]);
      const ao = [aoAt(x,y,z,NZ,[0,1,0],[-1,0,0]), aoAt(x,y,z,NZ,[0,1,0],[1,0,0]), aoAt(x,y,z,NZ,[0,-1,0],[1,0,0]), aoAt(x,y,z,NZ,[0,-1,0],[-1,0,0])];
      fill(P, ao, "side", b, 0.66, "z");
    }
  }

  if (o.bloom) {                                  // 廉价 bloom：亮像素散射 + 加权叠加
    const { thr = 190, strength = 0.6, radius = 5 } = o.bloom;
    const ker = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx*dx + dy*dy; if (d2 > radius*radius) continue;
      ker.push([dx, dy, Math.exp(-d2 / (radius*radius * 0.55))]);
    }
    const bl = new Float32Array(IW * IH * 3);
    for (let i = 0; i < IW * IH; i++) {
      const r = buf[i*3], g = buf[i*3+1], b = buf[i*3+2];
      const l = 0.2126*r + 0.7152*g + 0.0722*b;
      if (l <= thr) continue;
      const w = Math.min(1, (l - thr) / (255 - thr));
      const px = i % IW, py = (i - px) / IW;
      for (const [dx, dy, kw] of ker) {
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= IW || y >= IH) continue;
        const j = (y * IW + x) * 3, s = kw * w;
        bl[j] += r * s; bl[j+1] += g * s; bl[j+2] += b * s;
      }
    }
    for (let i = 0; i < IW*IH*3; i++) buf[i] = Math.min(255, buf[i] + bl[i] * strength);
  }

  function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
  function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
  const raw = Buffer.alloc(IH * (IW * 3 + 1));
  for (let y = 0; y < IH; y++) { raw[y*(IW*3+1)] = 0; for (let x = 0; x < IW; x++) { const i = (y*IW+x)*3, o = y*(IW*3+1)+1+x*3; for (let k = 0; k < 3; k++) raw[o+k] = Math.max(0, Math.min(255, Math.round(buf[i+k]))); } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(IW, 0); ihdr.writeUInt32BE(IH, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  fs.writeFileSync(out, png);
  console.log("saved", out, IW + "x" + IH, "blocks", blocks.length);
  return { IW, IH, n: blocks.length };
}

export function hash2(a, b, seed) {
  let n = (a * 73856093) ^ (b * 19349663) ^ (seed * 83492791);
  n = (n ^ (n >>> 13)) * 1274126177; n = n ^ (n >>> 16);
  return ((n >>> 0) % 100000) / 100000;
}

export function cliOpt(argv, k, def) {
  const p = argv.find(a => a.startsWith("--" + k + "="));
  return p === undefined ? def : p.slice(k.length + 3);
}
