# 🐾 Cinnamoroll 记账本

> 玉桂狗风格的个人记账小程序，支持收支记录、分类统计、月度预算。

---

## 📁 项目结构

```
├── wx/        # 原生微信小程序版本
└── uniapp/    # uni-app 版本（支持多端）
```

## ✨ 功能

- 💸 收支记录，支持分类、备注、日期
- 📋 账单列表，按月筛选，长按编辑/删除
- 🔍 账单搜索，按分类/金额/备注搜索
- 📊 月度统计，饼图分类占比
- 🏠 首页概览，本月收支汇总 + 最近记录
- 💾 数据本地存储，无需后端
- 📤 账单导出，支持 CSV/图片格式

## 🚀 快速开始

### 微信原生版（`wx/`）

1. 打开[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入 `wx/` 目录
3. 填入自己的 AppID（或使用测试号）
4. 编译预览

### uni-app 版（`uniapp/`）

```bash
# 安装依赖（需先安装 HBuilderX 或 Vue CLI）
cd uniapp

# 使用 HBuilderX 打开 uniapp/ 目录，运行到微信小程序 / H5 / App 等
```

## 🛠 技术栈

| | 微信原生版 | uni-app 版 |
|---|---|---|
| 框架 | 原生小程序 | uni-app (Vue 3) |
| 样式 | WXSS / rpx | WXSS / rpx |
| 数据 | `wx.Storage` | `uni.Storage` |
| 多端 | 仅微信 | 微信 / H5 / App |

## 📦 目录说明

```
wx/
├── pages/          # 首页、记账、账单、统计
├── custom-tab-bar/ # 自定义 TabBar
├── utils/          # storage 工具函数
├── app.js / app.json / app.wxss
└── project.config.json

uniapp/
├── pages/          # 同上，Vue SFC 格式
├── utils/          # storage 工具函数（uni API）
├── App.vue
├── main.js
├── pages.json      # 路由 + TabBar 配置
└── manifest.json
```

## 📝 开发进度

- [x] 收支记录功能
- [x] 账单列表与月份筛选
- [x] 账单编辑与删除
- [x] 月度统计饼图
- [x] 首页月度预算
- [x] 账单搜索功能 (2026-04-14)
- [ ] 账单导出功能 (2026-04-15) ← 正在开发
- [ ] 年度统计报表
- [ ] 预算提醒通知

---

Made with 🐶 & ☁️
