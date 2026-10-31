// 最小可运行示例：8×8 小岛，四步看懂一个场景
// 运行：node examples/minimal.mjs [--out=minimal.png]
import { makeWorld, renderPNG, cliOpt } from "../src/render-core.mjs";

const W = 8, D = 8, HMAX = 10;
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WATER = 4;
const w = makeWorld(W, D, HMAX, [WATER]);      // ① 建世界；WATER 不遮挡视线
const { set } = w;

// ② 造地形：中心草、往下泥土、最底石头
const heightAt = (x, z) => 3 + Math.round(Math.sin(x * 0.8) * Math.cos(z * 0.9));   // 2..4
for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
  const h = heightAt(x, z);
  set(x, 0, z, STONE);
  for (let y = 1; y < h; y++) set(x, y, z, DIRT);
  set(x, h, z, GRASS);
}

// ③ 挖一个小水洼
for (let x = 2; x <= 4; x++) for (let z = 5; z <= 6; z++) set(x, heightAt(x, z), z, WATER);

// ④ 渲染：texel 返回 [r,g,b] 即该像素颜色
renderPNG({
  w,
  s: 28, iso: 30, pad: 30, bg: [223, 238, 250],
  out: cliOpt(process.argv.slice(2), "out", "minimal.png"),
  water: WATER,
  blockHeight: b => (b === WATER ? 0.86 : 1),
  texel: (b, face, tx, ty) => {
    const n = ((tx * 7 + ty * 13) % 5) / 5;          // 便宜的伪随机，替代 hash2
    if (b === GRASS) return face === "top" ? [106, 168, 79] : [134, 96, 67];
    if (b === DIRT) return [134, 96, 67].map(v => v * (0.9 + 0.2 * n));
    if (b === STONE) return [138, 138, 138].map(v => v * (0.88 + 0.24 * n));
    if (b === WATER) return [58, 124, 214];
    return [200, 200, 200];
  },
});
