# Network Flow Implementation Plan

> Implement inline in this session using executing-plans. User's ten requirements are the binding spec.

**Goal:** 一个可以实际编辑、保存和导出网络流程图的手绘泳道网站。
**Architecture:** 原生 SVG 渲染与 Pointer Events；纯数据模型负责无重叠、剪贴和依赖关系，UI负责手势、属性和导出。
**Tech Stack:** HTML/CSS/JS ES modules、Rough.js 4.6.4、Node test、Playwright。
**Spec:** ../specs/2026-11-11-network-flow-design.md

## Global Constraints
- 默认三类空白泳道，新增只提供相同三类。
- 同泳道组件不重叠，拖动可换位，缩放保持无重叠。
- 曲线连接左右中心锚点，文字支持九种对齐。
- 原参考任务只用于理解上下文；新项目独立目录，不修改旧网站。

## Review Focus
- 拖动穿过多个相邻块、跨泳道、拖到画板边缘。
- 剪切后粘贴泳道与连接端点的ID正确性。
- 输入文本时快捷键不截获，中文输入法和多行文本。
- 缩放/滚动后拖动、连线和缩放坐标保持准确。
- 导入坏数据不破坏当前画板，导出文件可重新打开。

### Task 1: 纯数据模型
Files: dist/model.mjs, tests/model.test.mjs.
- [ ] 写默认泳道、无重叠换位/缩放、克隆泳道、删除端点/连线、循环依赖验证和导入校验测试；运行失败。
- [ ] 实现纯数据接口，运行 Node test 全绿。

### Task 2: 画板与交互
Files: dist/index.html, dist/style.css, dist/app.mjs, dist/vendor/rough.js, tests/browser.cjs.
- [ ] 写浏览器测试，先确认页面缺失导致失败。
- [ ] 实现三栏画板、拖入组件、泳道重排、组件换位/缩放、文字编辑和曲线连线。
- [ ] 实现复制剪切粘贴、删除、撤销重做、自动保存、导入导出。
- [ ] 运行浏览器行为检查并截图检查桌面与窄屏。

### Task 3: 发布和交付
- [ ] 验证全套测试、检查资源离线可用、说明使用方式。
- [ ] 使用 Sites 正式工作流保存来源和发布，确认终态成功后提供地址。
