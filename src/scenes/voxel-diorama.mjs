// 场景：28×28 等距乡村小世界（池塘 / 橙顶小屋 / 铁轨 / 橡树）
import { makeWorld, renderPNG, hash2, cliOpt } from "../render-core.mjs";

const argv = process.argv.slice(2);
const opt = (k, def) => cliOpt(argv, k, def);

const W = +opt("w", 28), D = +opt("d", 28), HMAX = +opt("h", 16);
const AIR=0, GRASS=1, DIRT=2, STONE=3, WATER=4, LOG=5, LEAVES=6, PLANKS=7, ROOF=8, RAIL=9, SAND=10, GLASS=11, PATH=12;
const C = {
  1:[106,168,79], 2:[134,96,67], 3:[138,138,138], 4:[58,124,214], 5:[102,76,46],
  6:[60,124,48], 7:[176,138,90], 8:[196,84,40], 9:[140,140,140], 10:[219,207,163],
  11:[190,220,235], 12:[150,120,86],
};
const w = makeWorld(W, D, HMAX, [WATER, GLASS]);
const { get, set, solid, inb } = w;

const hmap = new Int8Array(W*D);
for (let x=0;x<W;x++) for (let z=0;z<D;z++){
  const v = 4.5 + 2.1*Math.sin(x*0.33)*Math.cos(z*0.29) + 1.5*Math.sin((x+z)*0.21) + 1.1*Math.cos((x-0.5*z)*0.39);
  hmap[z*W+x] = Math.max(1, Math.min(9, Math.round(v)));
}
for (let x=7;x<=14;x++) for (let z=17;z<=24;z++){
  const dx=(x-10.5)/3.6, dz=(z-20.5)/3.0;
  if (dx*dx+dz*dz < 1) hmap[z*W+x] = Math.max(1, hmap[z*W+x]-3);
}
const hx=16, hz=4, PADH=6;
for (let x=hx-2;x<=hx+7;x++) for (let z=hz-2;z<=hz+6;z++) if(inb(x,0,z)) hmap[z*W+x]=PADH;
const WATER_LEVEL = +opt("water", 4);
for (let x=0;x<W;x++) for (let z=0;z<D;z++){
  const h=hmap[z*W+x];
  for (let y=0;y<=h;y++){
    let b=STONE;
    if (y===h) b = h<=WATER_LEVEL ? SAND : GRASS;
    else if (y>=h-2) b = DIRT;
    set(x,y,z,b);
  }
  for (let y=h+1;y<=WATER_LEVEL;y++) if(get(x,y,z)===AIR) set(x,y,z,WATER);
}
for (let x=6;x<=hx;x++){ const z=12; const h=hmap[z*W+x]; if(get(x,h,z)!==WATER) set(x,h,z,PATH); }
const trees=[[3,4],[21,23],[25,11],[3,16],[13,3],[24,25]];
for (const [tx,tz] of trees){
  const h=hmap[tz*W+tx];
  if (get(tx,h,tz)!==GRASS) continue;
  for (let i=1;i<=4;i++) set(tx,h+i,tz,LOG);
  const topY=h+4;
  for (let dy=-2;dy<=1;dy++) for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++){
    if (Math.abs(dx)+Math.abs(dz)+Math.abs(dy)>3) continue;
    if (dx===0&&dz===0&&dy<=0) continue;
    const x=tx+dx,y=topY+dy,z=tz+dz;
    if (get(x,y,z)===AIR) set(x,y,z,LEAVES);
  }
}
const baseY=PADH+1, HW=6, HD=5;
for (let x=hx;x<hx+HW;x++) for (let z=hz;z<hz+HD;z++) set(x,baseY-1,z,PLANKS);
for (let y=baseY;y<baseY+3;y++) for (let x=hx;x<hx+HW;x++) for (let z=hz;z<hz+HD;z++){
  const edge=(x===hx||x===hx+HW-1||z===hz||z===hz+HD-1);
  if(edge) set(x,y,z,PLANKS);
}
set(hx, baseY, hz+2, AIR); set(hx, baseY+1, hz+2, AIR);
for (const [wx,wz] of [[hx+2,hz],[hx+3,hz],[hx+2,hz+HD-1],[hx+3,hz+HD-1]]) set(wx, baseY+1, wz, GLASS);
for (const [wx,wz] of [[hx+HW-1,hz+1],[hx+HW-1,hz+2]]) set(wx, baseY+1, wz, GLASS);
for (let x=hx;x<hx+HW;x++) for (let z=hz;z<hz+HD;z++) set(x,baseY+3,z,PLANKS);
for (let k=0;k<3;k++){
  const y=baseY+4+k, x0=hx-1+k, x1=hx+HW-k, z0=hz-1+k, z1=hz+HD-k;
  for (let x=x0;x<=x1;x++) for (let z=z0;z<=z1;z++){
    const edge=(x===x0||x===x1||z===z0||z===z1);
    if(k===1?edge:true) set(x,y,z,ROOF);
  }
}
for (let y=baseY+6;y<=baseY+8;y++) set(hx+4,y,hz+1,STONE);
for (let z=2;z<D-2;z++){ const x=26, h=hmap[z*W+x]; if(get(x,h,z)===WATER) continue; set(x,h+1,z,RAIL); }

function texel(b,face,tx,ty){
  const base=C[b]??[200,200,200];
  const n=hash2(tx+b*31,ty+(face==='top'?0:97),b*7+3);
  let m=0.9+0.2*n, col=base.map(v=>v*m);
  if(b===GRASS&&face==='side'){const cut=3+Math.floor(hash2(tx,7,11)*2);col=(ty<cut?[110,172,82]:[134,96,67]).map(v=>v*(0.9+0.2*n));}
  if(b===GRASS&&face==='top'&&n>0.94) col=col.map(v=>v*0.85);
  if(b===DIRT&&n>0.9) col=col.map(v=>v*0.8);
  if(b===PATH) col=col.map(v=>v*(n>0.85?0.86:1));
  if(b===STONE&&n>0.87) col=col.map(v=>v*0.82);
  if(b===LEAVES) col=(n>0.5?[74,142,58]:[46,100,38]).map(v=>v*(0.9+0.2*n));
  if(b===LOG&&face==='side'){const g=0.82+0.28*hash2(tx,0,5);col=[102,76,46].map(v=>v*g);}
  if(b===LOG&&face==='top'){const d=Math.hypot(tx-7.5,ty-7.5);col=[156,124,74].map(v=>v*(0.85+0.28*(Math.sin(d*1.7)>0?1:0.62)));}
  if(b===PLANKS){const seam=(ty%4===0)?0.72:1;col=[176,138,90].map(v=>v*seam*(0.9+0.2*hash2(tx,Math.floor(ty/4),3)));}
  if(b===ROOF){const sh=((tx+ty)%4===0)?0.74:1;col=[196,84,40].map(v=>v*sh*(0.92+0.14*n));}
  if(b===RAIL){const mid=Math.abs(tx-8)<2?1.15:0.8;col=[150,150,150].map(v=>v*mid);}
  if(b===WATER){col=[62,128,216].map(v=>v*(0.9+0.2*Math.sin(tx*0.8+ty*0.6)));}
  if(b===SAND&&n>0.92) col=col.map(v=>v*0.88);
  if(b===GLASS){col=[204,232,244].map(v=>v*(0.94+0.1*n));}
  return col;
}

export function render() {
  const bgHex = opt("bg", "DFEEFA");
  const bg = [0,2,4].map(i => parseInt(bgHex.slice(i, i+2), 16));
  if (bg.some(n => Number.isNaN(n))) throw new Error("bad --bg, expect 6-hex like DFEEFA");
  const pos = argv.find(a => !a.startsWith("--"));
  return renderPNG({
    w,
    s: +opt("s", 20), iso: +opt("iso", 30), pad: +opt("pad", 30), bg,
    out: opt("out", pos || "voxel-diorama.png"),
    water: WATER,
    texel,
    blockHeight: b => (b === WATER ? 0.86 : 1),
  });
}

const isMain = process.argv[1] && process.argv[1].endsWith("voxel-diorama.mjs");
if (isMain) render();
