# Cinna Bookkeeping

云朵甜点风格的原生双端记账应用。
给日常收支、月度预算和消费统计准备的一本温柔、清晰、离线可用的小账本。

[Cinna Design](https://github.com/icelemon233/cinna-design) · [领域契约](./shared/domain-contract.md)

![version](https://img.shields.io/badge/version-1.0.0-8fc7e8)
![license](https://img.shields.io/badge/license-MIT-c9a46b)
![iOS](https://img.shields.io/badge/iOS-17%2B-f6b7c7)
![Android](https://img.shields.io/badge/Android-minSdk%2026-aed9b7)
![Swift](https://img.shields.io/badge/Swift-6.0-8fc7e8)
![Compose](https://img.shields.io/badge/Jetpack%20Compose-2024.12-aed9b7)
![local first](https://img.shields.io/badge/storage-local%20JSON-f3d58b)

---

## 为什么是 Cinna Bookkeeping？

Cinna Bookkeeping 是肉桂卷记账的原生 iOS / Android 版本。它把旧版小程序、uni-app 和 H5 实现收敛成一个原生双端仓库，用统一的领域模型和统计口径维护同一个产品体验。

应用的重点不是复杂财务系统，而是让个人记账这件事保持轻、快、稳定：打开就能记一笔，月底能看清钱花去了哪里，预算进度一眼能读懂，所有数据默认留在本机。

视觉方向参考 [Cinna Design](https://github.com/icelemon233/cinna-design)：浅蓝、奶油、草莓和黄油色作为柔和点缀，界面保持亲和，但信息层级优先清楚、可扫读、可长期使用。

## 包含什么？

### 重点打磨的核心能力

- 收入 / 支出记录：金额、分类、备注、日期。
- 账单管理：按月浏览、搜索、类型筛选、编辑和删除。
- 月度总览：收入、支出、结余和预算进度。
- 统计分析：分类占比、近 6 个月趋势、每日热力。
- 重复提示：同日、同类型、同分类且金额接近时提醒可能重复。
- CSV 导出：方便复制或迁移个人账单数据。

### 双端一致的业务语义

iOS 和 Android 共同遵守 `shared/domain-contract.md`：

- `expense` / `income` 类型语义一致。
- 月份口径统一为 `yyyy-MM`。
- 金额展示保留 2 位小数。
- 分类名称和图标保持一致。
- 预算按月保存。
- 统计计算集中在领域层，页面只消费派生结果。

## 技术栈

```text
.
├── ios/      # SwiftUI iOS app
├── android/  # Kotlin + Jetpack Compose Android app
└── shared/   # 双端领域契约与对齐说明
```

| 平台 | 实现 | 最低要求 | 数据 |
| --- | --- | --- | --- |
| iOS | SwiftUI + 本地 Store | iOS 17 / Xcode 16 | 本机 JSON |
| Android | Kotlin + Jetpack Compose | minSdk 26 / JDK 17 | 本机 JSON |

## iOS 本地预览

需要先安装 [XcodeGen](https://github.com/yonaskolb/XcodeGen)。

```bash
cd ios
xcodegen generate
open CinnaBookkeeping.xcodeproj
```

核心文件：

- `ios/CinnaBookkeeping/Domain/Models.swift`
- `ios/CinnaBookkeeping/Domain/Analytics.swift`
- `ios/CinnaBookkeeping/Data/BookkeepingStore.swift`
- `ios/CinnaBookkeeping/UI/Screens.swift`

## Android 本地预览

用 Android Studio 打开 `android/` 目录后运行 `:app`。

要求：

- Android Studio Ladybug 或更新版本
- JDK 17
- compileSdk 35 / targetSdk 35
- minSdk 26

核心文件：

- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/domain/Models.kt`
- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/domain/Analytics.kt`
- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/data/BookkeepingRepository.kt`
- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/ui/CinnaBookkeepingApp.kt`

## 设计语言

Cinna Bookkeeping 的第一版视觉方向包括：

- 用 milk-cloud blue 作为主要交互色。
- 用奶油和香草色表面承载日常账单内容。
- 用草莓、黄油和开心果色区分关键状态和统计信息。
- 用圆润但克制的卡片、按钮和列表行保持亲和力。
- 用原生列表和轻量绘制承载账单、趋势和热力图，避免 WebView 依赖。

目标不是把记账应用做成装饰品。甜味是识别点，清晰才是底座。

## 项目状态

当前版本是原生双端重构后的 `1.0.0` 原型。主要功能已经完成本地闭环，后续适合继续补充：

- iCloud / 云同步方案
- 通知与预算提醒
- 年度报表
- 数据导入
- 双端自动化测试与发布流水线

## 原创声明与灵感致谢

本仓库中的应用结构、领域模型、界面实现和文档文案均为独立设计或 AI 辅助实现。视觉语言参考同账号下的 [Cinna Design](https://github.com/icelemon233/cinna-design)，用于保持 Cinna 系列项目的统一气质。

## License

MIT License. See [LICENSE](./LICENSE).
