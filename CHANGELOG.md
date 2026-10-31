# Changelog

本文件格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.0] - 2026-11-01

### Added

- 渲染核心 `src/render-core.mjs`：体素世界、三面剔除、正交等距投影、顶点 AO、painter 排序、手写 PNG 编码。
- 统一入口 `src/cli.mjs`：`--scene=<diorama|rural|nether|end>`，`--list` / `--help`，参数透传给场景。
- 四个内置场景：`voxel-diorama`（28×28）、`rural-16`（16×16）、`nether-16`（16×24）、`end-32`（32×32）。
- 场景能力：`sprites` 交叉面片作物、`texel` 返回 `null` 的镂空、`emissive` 自发光、`bloom` 泛光、`fit` 裁边、`bg2` 渐变天空。
- `examples/minimal.mjs`：60 行最小可运行样例。
- `scripts/verify.mjs`：五个用例的尺寸与方块数冒烟自检。
- 文档：`README.md`、`SKILL.md`（参数表 / FAQ / 扩展模板）、`manifest.json`、`LICENSE`。

### Changed

- 目录结构由平铺改为 `src/` + `src/scenes/` + `examples/` + `scripts/`，场景脚本统一导出 `render()`。
- 文档中所有本地绝对路径改为相对路径，可直接发布。

### Fixed

- 农田顶面被"完全包围即跳过"优化误删，导致背景色泄漏 11.17%（跳过判定改用与水判定一致的 `occ()`）。
- 末地祭坛的 3×3 传送门被黑曜石柱遮挡 3 格（祭坛抬高 2 格 + 环形起始角 0.28→0.36）。
