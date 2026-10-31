// 场景：16×22 下界——岩浆湖 / 黑曜石传送门 / 跨图天桥 + 两座塔楼 + 尽头门楼
import { makeWorld, renderPNG, hash2, cliOpt } from "../render-core.mjs";

const W = 16, D = 24, HMAX = 16;
const AIR = 0, RACK = 1, BRICK = 2, OBS = 3, PORTAL = 4, GLOW = 5, LAVA = 6, SOUL = 7, BASALT = 8, STEM = 9;
const C = {
  1:[142,68,62], 2:[76,42,46], 3:[26,20,40], 4:[150,58,214], 5:[236,196,96],
  6:[214,92,24], 7:[92,66,54], 8:[62,58,66], 9:[110,30,36],
};

export function build() {
  const w = makeWorld(W, D, HMAX, [PORTAL]);   // 传送门不遮挡视线：能透出后面的岩壁
  const { get, set } = w;

  // ---- 地形 ----
  const isLake = (x, z) => x >= 1 && x <= 4 && z >= 9 && z <= 13;
  const hmap = new Int8Array(W*D);
  for (let x=0;x<W;x++) for (let z=0;z<D;z++){
    const n = 1.1*Math.sin(x*0.75)*Math.cos(z*0.62) + 0.9*Math.sin((x+z)*0.45);
    hmap[z*W+x] = Math.max(2, Math.min(5, 3 + Math.round(n)));
  }
  for (let x=0;x<W;x++) for (let z=0;z<D;z++){
    if (x>=4 && x<=8 && z>=1 && z<=6) hmap[z*W+x] = 3;      // 传送门平台压平
    if (isLake(x,z)) hmap[z*W+x] = 0;
  }
  for (let x=0;x<W;x++) for (let z=0;z<D;z++){
    const h = hmap[z*W+x];
    for (let y=0;y<=h;y++) set(x,y,z,RACK);
    if (isLake(x,z)) set(x,1,z,LAVA);
  }

  // ---- 传送门：4×5 黑曜石门框，内侧 2×3 ----
  for (let y=4;y<=8;y++) for (let z=2;z<=5;z++){
    const edge = (y===4 || y===8 || z===2 || z===5);
    set(6,y,z, edge ? OBS : PORTAL);
  }
  set(6,9,3,GLOW);                                     // 门楣上的辉石灯

  // ---- 天桥：x=10,11 贯穿 z 0..21 ----
  // 塔楼放在 z>=12：屏幕横轴上 (x-z) 全落在传送门左侧，不会挡住门面
  const TOWERS = [12, 17];
  const inTower = z => TOWERS.some(t => z >= t-1 && z <= t+3);
  const inGate = z => z >= 21 && z <= 23;
  for (let z=0;z<D;z++){ set(10,7,z,BRICK); set(11,7,z,BRICK); }          // 桥面
  for (let z=0;z<D;z+=2){                                                 // 栏杆（跳过塔与门楼）
    if (inTower(z) || inGate(z)) continue;
    set(10,8,z,BRICK); set(11,8,z,BRICK);
  }
  for (const pz of [2,8,12,17,22]){                                          // 桥墩
    for (const px of [10,11]) for (let y=hmap[pz*W+px]+1;y<=6;y++) set(px,y,pz,BRICK);
  }

  // ---- 两座塔楼：4 宽 × 3 深，桥从中间穿过 ----
  for (const t of TOWERS){
    for (let y=8;y<=12;y++) for (let x=9;x<=12;x++) for (let z=t;z<=t+2;z++){
      const edge = (x===9 || x===12 || z===t || z===t+2);
      if (edge) set(x,y,z,BRICK);
    }
    for (let y=8;y<=9;y++){ set(10,y,t,AIR); set(11,y,t,AIR);              // 前后门洞
                             set(10,y,t+2,AIR); set(11,y,t+2,AIR); }
    for (let y=10;y<=11;y++){ set(9,y,t+1,AIR); set(12,y,t+1,AIR); }       // 侧窗
    for (let x=9;x<=12;x++) for (let z=t;z<=t+2;z++) set(x,13,z,BRICK);    // 屋顶
    for (let x=9;x<=12;x++) for (let z=t;z<=t+2;z++){                      // 雉堞
      const edge = (x===9 || x===12 || z===t || z===t+2);
      if (edge && (x+z)%2===0) set(x,14,z,BRICK);
    }
    set(10,13,t+1,GLOW); set(11,13,t+1,GLOW);                              // 屋顶辉石灯
  }

  // ---- 尽头门楼：桥从中穿过 ----
  for (let y=8;y<=10;y++) for (let x=9;x<=12;x++) for (let z=21;z<=23;z++){
    const edge = (x===9 || x===12 || z===21 || z===23);
    if (edge) set(x,y,z,BRICK);
  }
  for (let x=9;x<=12;x++) for (let z=21;z<=23;z++) set(x,11,z,BRICK);      // 屋顶
  for (let y=8;y<=9;y++){ set(10,y,21,AIR); set(11,y,21,AIR); set(10,y,23,AIR); set(11,y,23,AIR); }
  for (const [cx,cz] of [[9,21],[12,21],[9,23],[12,23]]) set(cx,12,cz,BRICK);

  // ---- 岩浆瀑布 + 火光 ----
  set(12,7,12,BRICK);
  for (let y=1;y<=6;y++) set(12,y,12,LAVA);
  for (const [gx,gy,gz] of [[12,5,9],[3,3,7],[13,2,12],[9,5,14],[12,5,4],[2,2,10],[6,9,3],[9,6,7]]) set(gx,gy,gz,GLOW);

  // ---- 灵魂沙 / 玄武岩柱 / 绯红菌柄 ----
  for (let x=5;x<=7;x++) for (let z=9;z<=11;z++) set(x,hmap[z*W+x],z,SOUL);
  for (const [bx,bz] of [[5,13],[1,8]]){ const h=hmap[bz*W+bx]; for (let y=h+1;y<=h+3;y++) set(bx,y,bz,BASALT); }
  for (const [sx,sz,n] of [[8,12,2],[13,5,3]]){ const h=hmap[sz*W+sx]; for (let i=1;i<=n;i++) set(sx,h+i,sz,STEM); }
  return w;
}

// ---- 贴图 ----
export function texel(b, face, tx, ty, axis){
  const n = hash2(tx + b*31, ty + (face === 'top' ? 0 : 97), b*7 + 3);
  let col = (C[b] ?? [200,200,200]).map(v => v*(0.9 + 0.2*n));
  if (b === RACK){
    const bl = hash2(tx >> 1, ty >> 1, 21);
    col = [142,68,62].map(v => v*(bl > 0.74 ? 0.82 : 1)*(0.9 + 0.2*n));
  }
  if (b === BRICK){
    const row = Math.floor(ty/4), off = row%2 ? 4 : 0;
    const mortar = (ty%4 === 0) || ((tx + off)%8 === 0);
    col = mortar ? [40,20,24] : [78,44,48].map(v => v*(0.92 + 0.16*n));
  }
  if (b === OBS){
    const sp = hash2(tx,ty,41);
    col = sp > 0.86 ? [66,46,112] : [26,20,40].map(v => v*(0.85 + 0.3*n));
  }
  if (b === PORTAL){
    if (axis !== 'x') return null;                     // 只在朝 +X 的那一面画门面
    const sw = Math.sin(tx*0.9 + ty*0.55 + 1.7*Math.sin(ty*0.4));
    const t = (sw + 1)/2;
    const c = [96,30,168].map((v,k) => v + ([186,108,240][k] - v)*t);
    const edge = (tx < 1 || tx > 14 || ty < 1 || ty > 14) ? 0.75 : 1;
    return [...c.map(v => v*edge), 0.95];
  }
  if (b === GLOW){
    const g = hash2(tx>>1, ty>>1, 53);
    col = g > 0.55 ? [246,220,140] : [206,164,72].map(v => v*(0.9 + 0.2*n));
  }
  if (b === LAVA){
    const sv = Math.sin(tx*0.7 + ty*0.5 + Math.sin(ty*0.3)*2);
    col = (sv > 0.35 ? [232,136,44] : [188,70,14]).map(v => v*(0.9 + 0.2*n));
  }
  if (b === SOUL){
    const pit = hash2(tx,ty,61);
    col = pit > 0.84 ? [58,40,32] : [96,70,56].map(v => v*(0.9 + 0.2*n));
  }
  if (b === BASALT){
    const st = hash2(tx,0,33);
    col = [62,58,66].map(v => v*(0.8 + 0.35*st)*(0.95 + 0.1*n));
  }
  if (b === STEM){
    col = [110,30,36].map(v => v*((tx%4 === 0) ? 0.74 : 1)*(0.9 + 0.2*n));
  }
  return col;
}

export function render() {
  const argv = process.argv.slice(2);
  const opt = (k, def) => cliOpt(argv, k, def);
  const bgHex = opt("bg", "2A0E12");
  const bg = [0,2,4].map(i => parseInt(bgHex.slice(i, i+2), 16));
  renderPNG({
    w: build(),
    s: +opt("s", 28), iso: +opt("iso", 30), pad: +opt("pad", 30), bg,
    out: opt("out", "nether-16.png"), fit: true,
    water: LAVA,
    texel,
    blockHeight: b => (b === LAVA ? 0.9 : 1),
    emissive: [GLOW, LAVA, PORTAL],
    bloom: { thr: 200, strength: 0.40, radius: 5 },
  });
}

const isMain = process.argv[1] && process.argv[1].endsWith("nether-16.mjs");
if (isMain) render();
