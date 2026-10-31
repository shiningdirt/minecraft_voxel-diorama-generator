// 场景：16×16 乡村——小溪 / 农田 / 树 / 木桥（天蓝背景）
import { makeWorld, renderPNG, hash2, cliOpt } from "../render-core.mjs";

const argv = process.argv.slice(2);
const opt = (k, def) => cliOpt(argv, k, def);

const W = 16, D = 16, HMAX = 10;   // 场景实际最高点（树冠顶）为 10，压低画布顶部留白
const AIR=0, GRASS=1, DIRT=2, STONE=3, WATER=4, LOG=5, LEAVES=6, PLANKS=7, SAND=10, PATH=12, FARMLAND=13, WHEAT=14;
const C = {
  1:[106,168,79], 2:[134,96,67], 3:[138,138,138], 4:[58,124,214], 5:[102,76,46],
  6:[60,124,48], 7:[176,138,90], 12:[150,120,86], 13:[98,68,44], 14:[214,178,80],
};
const w = makeWorld(W, D, HMAX, [WATER, WHEAT]);   // 麦子是面片，不挡视线
const { get, set, solid } = w;

// ---- 地形 ----
const hmap = new Int8Array(W*D);
const zc = x => Math.round(3 + 0.35*x + 0.9*Math.sin(x*0.8));   // 小溪中心线：从左上游蜿蜒向右下
for (let x=0;x<W;x++) for (let z=0;z<D;z++){
  hmap[z*W+x] = Math.max(3, Math.min(5, 4 + Math.round(0.8*Math.sin(x*0.85)*Math.cos(z*1.05))));
}
for (let x=0;x<W;x++) for (const dz of [0,1,2]){ const z=zc(x)+dz; if(z>=0&&z<D) hmap[z*W+x]=2; }  // 河床（3 格宽，小图里才看得出是溪）
const FX0=9, FX1=14, FZ0=10, FZ1=14;                                                            // 农田范围
for (let x=FX0;x<=FX1;x++) for (let z=FZ0;z<=FZ1;z++) hmap[z*W+x]=4;                            // 农田整平
const WATER_LEVEL = 3;
for (let x=0;x<W;x++) for (let z=0;z<D;z++){
  const h=hmap[z*W+x];
  for (let y=0;y<=h;y++){
    let b=STONE;
    if (y===h) b = h<=WATER_LEVEL ? GRASS : GRASS;
    else if (y>=h-2) b = DIRT;
    set(x,y,z,b);
  }
  for (let y=h+1;y<=WATER_LEVEL;y++) if(get(x,y,z)===AIR) set(x,y,z,WATER);
}
// 河床两侧铺沙
for (let x=0;x<W;x++) for (const dz of [-1,3]){ const z=zc(x)+dz; if(z>=0&&z<D&&get(x,hmap[z*W+x],z)===GRASS) set(x,hmap[z*W+x],z,10); }

// ---- 农田 ----
for (let x=FX0;x<=FX1;x++) for (let z=FZ0;z<=FZ1;z++){
  const channel = (x===11);                              // 一条灌溉水渠
  if (channel){ set(x,4,z,WATER); continue; }
  set(x,4,z,FARMLAND);
  if (z%3!==1) set(x,5,z,WHEAT);                          // 留出空行，形成条播
}
// 稻草人
set(10,5,12,LOG); set(10,6,12,LOG); set(9,6,12,PLANKS); set(11,6,12,PLANKS);

// ---- 田埂小路：从桥头走向农田 ----
for (let z=7;z<=9;z++) for (const x of [7,8]) set(x,4,z,PATH);
for (let x=7;x<=10;x++) set(x,4,9,PATH);

// ---- 小溪上的木桥：2 格宽，桥面与两岸地面同高，整块对齐 ----
for (const z of [zc(7)-1, zc(7), zc(7)+1, zc(7)+2]) for (const x of [7,8]) {
  if (z<0||z>=D) continue;
  if (hmap[z*W+x] !== 2) {                 // 桥台（岸上那两格）压到 4 格高并清空上方
    set(x,4,z,GRASS);
    for (let y=5;y<HMAX;y++) set(x,y,z,AIR);
  }
  set(x,5,z,PLANKS);                       // 桥面在 y=5，正压在水面之上
}

// ---- 树 ----
const trees=[[2,1],[12,2],[2,13],[13,6]];
for (const [tx,tz] of trees){
  const h=hmap[tz*W+tx];
  if (get(tx,h,tz)!==GRASS) continue;
  for (let i=1;i<=3;i++) set(tx,h+i,tz,LOG);
  const ty=h+3;
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++){
    if (dy===1 && Math.abs(dx)+Math.abs(dz)>1) continue;   // 顶层收成十字
    if (dx===0&&dz===0&&dy<=0) continue;
    const x=tx+dx,y=ty+dy,z=tz+dz;
    if (get(x,y,z)===AIR) set(x,y,z,LEAVES);
  }
}

function texel(b,face,tx,ty){
  const base=C[b]??[200,200,200];
  const n=hash2(tx+b*31,ty+(face==='top'?0:97),b*7+3);
  let m=0.9+0.2*n, col=base.map(v=>v*m);
  if(b===GRASS&&face==='side'){const cut=3+Math.floor(hash2(tx,7,11)*2);col=(ty<cut?[110,172,82]:[134,96,67]).map(v=>v*(0.9+0.2*n));}
  if(b===GRASS&&face==='top'&&n>0.9) col=col.map(v=>v*0.86);
  if(b===DIRT&&n>0.9) col=col.map(v=>v*0.8);
  if(b===STONE&&n>0.87) col=col.map(v=>v*0.82);
  if(b===LEAVES) col=(n>0.5?[74,142,58]:[46,100,38]).map(v=>v*(0.9+0.2*n));
  if(b===LOG&&face==='side'){const g=0.82+0.28*hash2(tx,0,5);col=[102,76,46].map(v=>v*g);}
  if(b===LOG&&face==='top'){const d=Math.hypot(tx-7.5,ty-7.5);col=[156,124,74].map(v=>v*(0.85+0.28*(Math.sin(d*1.7)>0?1:0.62)));}
  if(b===PLANKS){
    const board=Math.floor(ty/4), seam=(ty%4===0)?0.72:1, tone=0.95+0.05*(board%2);
    const knot=(hash2(tx,ty,3)>0.85)?0.92:1;
    col=[176,138,90].map(v=>v*seam*tone*knot*(0.98+0.04*n));
  }
  if(b===WATER){col=[62,128,216].map(v=>v*(0.9+0.2*Math.sin(tx*0.8+ty*0.6)));}
  if(b===PATH){const st=hash2(tx,ty,17);col=[150,120,86].map(v=>v*(st>0.7?0.85:1)*(0.92+0.16*n));}
  if(b===SAND){const g=0.94+0.10*hash2(tx,ty,13); col=[214,186,134].map(v=>v*g*(n>0.93?0.9:1));}
  if(b===FARMLAND&&face==='top'){const furrow=(ty%4===0)?0.74:1;col=[104,72,46].map(v=>v*furrow*(0.9+0.2*n));}
  if(b===FARMLAND&&face==='side') col=[86,60,40].map(v=>v*(0.9+0.2*n));
  if(b===WHEAT){
    if(face!=='cross') return null;
    if(hash2(tx,0,7)>0.60) return null;                       // 秆与秆之间镂空
    const t=ty/15, g=0.90+0.20*hash2(tx,ty,11);
    const stem=[108,136,54], ear=[230,192,98];
    col=stem.map((v,k)=>v+(ear[k]-v)*t);
    col=col.map(v=>v*g);
  }
  return col;
}

export function render() {
  const bgHex = opt("bg", "87CEEB");
  const bg = [0,2,4].map(i => parseInt(bgHex.slice(i, i+2), 16));
  return renderPNG({
    w,
    s: +opt("s", 28), iso: +opt("iso", 30), pad: +opt("pad", 30), bg,
    out: opt("out", "rural-16.png"),
    water: WATER,
    texel,
    blockHeight: b => (b === WATER ? 0.86 : b === WHEAT ? 0.92 : 1),
    sprites: [WHEAT],
  });
}

const isMain = process.argv[1] && process.argv[1].endsWith("rural-16.mjs");
if (isMain) render();
