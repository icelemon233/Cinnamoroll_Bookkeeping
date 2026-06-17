# cinna-bookkeeping

肉桂卷记账的原生双端版本。仓库已经从小程序/uni-app/H5 代码完全重构为：

```text
.
├── ios/      # SwiftUI iOS app
├── android/  # Kotlin + Jetpack Compose Android app
└── shared/   # 双端领域契约与对齐说明
```

## 当前决策

- 暂不拆分仓库：iOS 和 Android 共享同一个产品节奏，放在一个 monorepo 更容易保证展示结构、分类、统计口径和预算逻辑一致。
- 本地优先：移除旧版 Supabase/H5/小程序依赖，双端都使用本机 JSON 文件保存账单与预算。
- 原生 UI：iOS 使用 SwiftUI，Android 使用 Kotlin + Compose。视觉保持同一信息层级和配色，但保留平台原生交互差异。

## 功能范围

- 收入/支出记账
- 分类选择、备注、日期
- 账单列表、月份切换、搜索、类型筛选
- 编辑/删除账单
- 月度收入、支出、结余汇总
- 月度预算与进度
- 重复记账提示
- 分类占比、近 6 个月趋势、每日热力
- CSV 导出/复制

## iOS

```bash
cd ios
xcodegen generate
open CinnaBookkeeping.xcodeproj
```

要求：

- Xcode 16 或更新版本
- iOS 17+
- XcodeGen 用于生成 `.xcodeproj`

核心文件：

- `ios/CinnaBookkeeping/Domain/Models.swift`
- `ios/CinnaBookkeeping/Domain/Analytics.swift`
- `ios/CinnaBookkeeping/Data/BookkeepingStore.swift`
- `ios/CinnaBookkeeping/UI/Screens.swift`

## Android

用 Android Studio 打开 `android/` 目录后运行 `:app`。

要求：

- Android Studio Ladybug 或更新版本
- JDK 17
- minSdk 26 / targetSdk 35

核心文件：

- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/domain/Models.kt`
- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/domain/Analytics.kt`
- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/data/BookkeepingRepository.kt`
- `android/app/src/main/java/com/icelemon233/cinnabookkeeping/ui/CinnaBookkeepingApp.kt`

## 双端对齐原则

详见 `shared/domain-contract.md`。当前强制对齐：

- 分类名称和 emoji
- `expense` / `income` 类型语义
- 月份口径 `yyyy-MM`
- 金额保留 2 位小数
- 预算按月保存
- 统计包含收入、支出、结余、分类占比、趋势、热力

## 性能与展示重构点

- 旧版多页面重复拉取/重复聚合已改为统一 Store/Repository 管理。
- 统计计算集中在 `Analytics`，页面只消费派生数据，减少展示层复杂度。
- 列表使用 SwiftUI `List` / Compose `LazyColumn`，避免一次性渲染所有账单。
- 趋势和热力图使用原生轻量绘制，不依赖 WebView 或小程序 canvas。
- 卡片、按钮和列表行尺寸固定，长金额/长备注使用单行压缩或截断，降低布局抖动。
