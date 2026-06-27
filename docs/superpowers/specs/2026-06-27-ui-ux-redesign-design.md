# UI/UX 全面升级设计文档

## 目标

将 Project A React 工作台从功能优先的朴素界面，升级为专业金融风格的现代化工作台。

## 设计策略

- **风格**：专业金融风 — 深蓝主色调、金色点缀、克制配色
- **策略**：Token 先行 + 页面逐层推进
- **范围**：全部前端组件、页面、交互

## 设计 Token

### 配色
- 主色：深蓝 HSL(215 70% 28%)
- 强调：金融金 HSL(38 92% 50%)
- 语义：墨绿涨/深红跌/琥珀提醒
- 中性：暖白底色、纯白卡片

### 字体
- 正文 14px / 辅助 13px / 标签 11px
- 数据数字 24px Semibold

### 阴影
- 卡片默认 shadow-xs / Hover shadow-sm
- 下拉 shadow-md / 模态 shadow-lg

### 圆角
- 按钮 8px / 卡片 10px / 徽章全圆

## 改造优先级

1. P0: 设计 Token 体系 (styles.css + tailwind.config.js)
2. P1: UI 基础组件 (Button, Card, Badge, Select, Input)
3. P2: CampaignWorkbench 结果页
4. P3: FundDetailPage
5. P4: 分析前 Dashboard
6. P5: 微交互和细节打磨

## 技术约束

- 保持 Tailwind CSS + CSS 变量体系
- 不引入新的 UI 库
- 保持 shadcn/ui 风格组件架构
- 保持 React 19 + TypeScript
