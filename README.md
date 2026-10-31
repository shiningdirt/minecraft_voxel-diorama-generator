# Voxel Diorama

> 零依赖 Node 脚本，把程序化体素世界渲染成**等距像素风 PNG**。不依赖浏览器、WebGL、Three.js 或任何 npm 包——只有 `node:fs` 和 `node:zlib`。

内置 4 个可直接出图的场景：

| 场景 | `--scene=` | 尺寸 | 内容 | 默认输出 |
|---|---|---|---|---|
| 乡村小世界 | `diorama` | 28×28 | 池塘、橙顶小屋、铁轨、6 棵橡树、小径 | 1030×940 |
| 农田小溪 | `rural` | 16×16 | 小溪、木桥、条播农田与灌溉渠、稻草人 | 836×788 |
| 下界 | `nether` | 16×24 | 岩浆湖、黑曜石地狱门、跨图天桥、两座塔楼 | 1030×774 |
| 末地 | `end` | 32×32 | 浮空岛、中央祭坛与 3×3 传送门、10 根黑曜石柱 + 水晶 | 788×790 |
<img width="836" height="788" alt="rural-16" src="https://github.com/user-attachments/assets/429614b1-104d-461e-a1d6-42c1cdba0386" />
<img width="788" height="790" alt="end-32" src="https://github.com/user-attachments/assets/69619f02-a4b9-4d32-9856-312c07b4b3cd" />
<img width="960" height="800" alt="detail-nether-towers" src="https://github.com/user-attachments/assets/15e8d5bb-efbb-47e9-bb0a-1c3b745056a4" />

## 安装

不需要安装任何依赖，只要 Node.js ≥ 18（实测 v24.21.0）：

```bash
node -v            # 应输出 v18 以上
git clone <repo> && cd voxel-diorama
```

没有 `npm install` 这一步：仓库里没有 `package.json` 依赖，也没有构建步骤。

## 快速开始

```bash
node src/cli.mjs --scene=diorama                 # → voxel-diorama.png 1030x940
node src/cli.mjs --scene=end                     # → end-32.png 788x790
node src/cli.mjs --scene=rural --s=40            # 2 倍像素
node src/cli.mjs --list                          # 列出全部场景
node src/cli.mjs --help                          # 参数帮助
```

也可以直接跑单个场景文件（等价，且适合调试）：

```bash
node src/scenes/end-32.mjs --s=32 --out=e2x.png
```

最小示例（60 行，自带地形/水面/贴图）：

```bash
node examples/minimal.mjs --out=minimal.png      # → 448x564
```

## 参数

| 参数 | 默认 | 作用 |
|---|---|---|
| `--scene=` | `diorama` | 选择场景 |
| `--s=` | 20 / 28 / 20 | 每格屏幕像素，直接决定清晰度与输出尺寸 |
| `--iso=` | 30 | 等距水平压缩角（度）；30 = 标准 2:1 等距 |
| `--pad=` | 30 | 画面四周留白像素 |
| `--bg=` `--bg2=` | 各场景不同 | 背景色；同时给两个色即竖向渐变 |
| `--water=` | 各场景不同 | 水深/水位；浮空场景传 `-1` 关闭"水"判定 |
| `--out=` | 各场景不同 | 输出文件名 |

参数一律用 `--k=v` 形式；空格分隔（`--out x.png`）不会被识别。

## 输出规格

- 8 位真彩 PNG，无 alpha；尺寸由投影包围盒反推：
  `IW = ceil((W+D)·cos(iso)·s + 2·pad)`，`IH = ceil(((W+D)·sin(iso) + HMAX)·s + 2·pad)`
- 输出文件写在工作目录（可用 `--out` 指定），仓库已用 `.gitignore` 排除 `*.png`。

## 工作原理（四步）

1. **体素世界**：`makeWorld(W, D, HMAX, seeThrough)` 返回一个一维数组 + `get/set`；`seeThrough` 里的方块（水、作物）不遮挡视线。
2. **面剔除**：只画朝向相机的 +Y / +X / +Z 三个面；六面都被实心邻居包住的方块整体跳过。
3. **投影与明暗**：正交等距 `(x−z, (x+z)·sin − y)`，无透视除法；面固定明暗（顶 1.0 / +X 0.82 / +Z 0.66）+ 顶点假 AO（0.55–1.0，四角双线性插值）。
4. **排序与编码**：painter 排序（`x+y+z` 升序）后逐面填充像素，手写 PNG（IHDR/IDAT/IEND + zlib）。

进阶特性：`sprites`（交叉面片做作物/花）、`texel` 返回 `null` 的镂空像素、`emissive` 自发光、`bloom` 泛光、`fit` 裁掉空边、`bg2` 渐变天空。完整说明见 [SKILL.md](SKILL.md)。

## 目录结构

```
.
├── src/
│   ├── cli.mjs              # 统一入口
│   ├── render-core.mjs      # 渲染核心（投影/剔除/AO/排序/PNG）
│   └── scenes/              # 4 个场景，各自导出 build() 与 render()
├── examples/minimal.mjs     # 最小可运行样例
├── scripts/verify.mjs       # 冒烟自检
├── manifest.json            # 市场清单（版本/入口/权限/依赖）
├── SKILL.md                 # 完整技术文档（参数、FAQ、扩展方法）
├── CHANGELOG.md
└── LICENSE
```

## 自检

```bash
node scripts/verify.mjs
```

期望输出（5 项全部 PASS，退出码 0）：

```
PASS diorama 1030x940 blocks 2234
PASS rural   836x788 blocks 777
PASS nether  1030x774 blocks 1207
PASS end     788x790 blocks 1818
PASS example 448x564 blocks 186

全部通过 ✓
```

`blocks` 是实际绘制的方块数，可用于判断地形是否被参数改塌。

## 已知限制

- 没有透视相机，投影写死为正交等距（这正是像素风的来源）。
- 没有实时阴影；明暗 = 面系数 + 顶点假 AO。
- 深度用 painter 排序，仅在等距视角下正确。
- 不支持导入外部模型（OBJ/GLB/.vox）或图片贴图，纹理全部程序化生成。
- 一次运行只输出一张静帧，无动画。

## 许可

MIT © 2026 dsworkplace，见 [LICENSE](LICENSE)。变更记录见 [CHANGELOG.md](CHANGELOG.md)。
