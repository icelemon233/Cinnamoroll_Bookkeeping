import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: BookkeepingStore
    let onAdd: (RecordKind) -> Void
    let onShowRecords: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    MonthStepper(month: $store.selectedMonth)

                    let monthRecords = store.records(in: store.selectedMonth)
                    let summary = BookkeepingAnalytics.summary(for: monthRecords)
                    let budget = store.budget(for: store.selectedMonth)

                    VStack(spacing: 16) {
                        HStack(spacing: 14) {
                            MetricTile(title: "收入", amount: summary.income, kind: .income)
                            Divider()
                            MetricTile(title: "支出", amount: summary.expense, kind: .expense)
                        }
                        MetricTile(title: "结余", amount: summary.net, kind: nil)
                    }
                    .cinnaCard()

                    HStack(spacing: 12) {
                        Button {
                            onAdd(.expense)
                        } label: {
                            Label("记支出", systemImage: "minus.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)

                        Button {
                            onAdd(.income)
                        } label: {
                            Label("记收入", systemImage: "plus.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }

                    BudgetProgressView(expense: summary.expense, budget: budget)
                        .cinnaCard()

                    let trend = BookkeepingAnalytics.recentTrend(records: store.records, endingAt: store.selectedMonth)
                    Text(BookkeepingAnalytics.monthlyAdvice(summary: summary, budget: budget, trend: trend))
                        .font(.subheadline)
                        .foregroundStyle(CinnaTheme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .cinnaCard()

                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("最近账单")
                                .font(.headline)
                            Spacer()
                            Button("全部", action: onShowRecords)
                                .font(.subheadline.weight(.semibold))
                        }

                        let recent = monthRecords.prefix(5)
                        if recent.isEmpty {
                            EmptyStateView(title: "还没有账单", subtitle: "点击上方按钮开始记录第一笔。", systemImage: "tray")
                        } else {
                            ForEach(Array(recent)) { record in
                                RecordRow(record: record)
                                if record.id != recent.last?.id { Divider() }
                            }
                        }
                    }
                    .cinnaCard()
                }
                .padding(16)
            }
            .background(CinnaTheme.background.ignoresSafeArea())
            .navigationTitle("肉桂卷记账")
        }
    }
}

struct RecordEditorView: View {
    @EnvironmentObject private var store: BookkeepingStore
    @Environment(\.dismiss) private var dismiss

    private let existing: BookkeepingRecord?
    private let onSaved: (() -> Void)?

    @State private var kind: RecordKind
    @State private var amountText: String
    @State private var category: String
    @State private var note: String
    @State private var date: Date
    @State private var showSaved = false

    init(existing: BookkeepingRecord?, initialKind: RecordKind, onSaved: (() -> Void)? = nil) {
        self.existing = existing
        self.onSaved = onSaved
        let seedKind = existing?.kind ?? initialKind
        _kind = State(initialValue: seedKind)
        _amountText = State(initialValue: existing?.amount.moneyText ?? "")
        _category = State(initialValue: existing?.category ?? CategoryCatalog.categories(for: seedKind).first?.name ?? "其他")
        _note = State(initialValue: existing?.note ?? "")
        _date = State(initialValue: existing?.date ?? Date())
    }

    var body: some View {
        Form {
            typeAmountSection
            categorySection
            detailSection
            duplicateSection
            saveSection
        }
        .scrollContentBackground(.hidden)
        .background(CinnaTheme.background)
        .navigationTitle(existing == nil ? "记一笔" : "编辑账单")
        .alert("已保存", isPresented: $showSaved) {
            Button("好") {
                onSaved?()
            }
        }
    }

    @ViewBuilder
    private var typeAmountSection: some View {
        Section {
            Picker("类型", selection: $kind) {
                ForEach(RecordKind.allCases) { item in
                    Text(item.title).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: kind) { _, newKind in
                category = CategoryCatalog.categories(for: newKind).first?.name ?? "其他"
            }

            HStack {
                Text("¥")
                    .font(.title.bold())
                    .foregroundStyle(kind == .income ? CinnaTheme.mint : CinnaTheme.pink)
                TextField("0.00", text: $amountText)
                    .decimalInput()
                    .font(.largeTitle.weight(.bold))
                    .multilineTextAlignment(.trailing)
                    .minimumScaleFactor(0.6)
                    .onChange(of: amountText) { _, newValue in
                        let sanitized = sanitizedMoneyText(newValue)
                        if sanitized != newValue {
                            amountText = sanitized
                        }
                    }
            }
            .padding(.vertical, 8)
        }
    }

    @ViewBuilder
    private var categorySection: some View {
        Section("分类") {
            let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(CategoryCatalog.categories(for: kind)) { item in
                    categoryButton(item)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func categoryButton(_ item: BookkeepingCategory) -> some View {
        Button {
            category = item.name
        } label: {
            VStack(spacing: 6) {
                Text(item.emoji).font(.title2)
                Text(item.name)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 72)
            .background(category == item.name ? CinnaTheme.skySoft : Color(red: 0.94, green: 0.96, blue: 0.97))
            .clipShape(RoundedRectangle(cornerRadius: CinnaTheme.radius, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var detailSection: some View {
        Section("明细") {
            DatePicker("日期", selection: $date, displayedComponents: .date)
            TextField("备注", text: $note, axis: .vertical)
                .lineLimit(1...3)
        }
    }

    @ViewBuilder
    private var duplicateSection: some View {
        if !duplicates.isEmpty {
            Section("可能重复") {
                ForEach(duplicates.prefix(3)) { record in
                    RecordRow(record: record)
                }
            }
        }
    }

    @ViewBuilder
    private var saveSection: some View {
        Section {
            Button {
                save()
            } label: {
                Text(existing == nil ? "保存" : "保存修改")
                    .frame(maxWidth: .infinity)
            }
            .disabled(parsedAmount == nil || parsedAmount == 0)
        }
    }

    private var parsedAmount: Decimal? {
        Decimal(string: amountText.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespacesAndNewlines))?.normalizedMoney
    }

    private var duplicates: [BookkeepingRecord] {
        guard let amount = parsedAmount, amount > 0 else { return [] }
        return store.duplicateCandidates(kind: kind, category: category, amount: amount, date: date, excluding: existing?.id)
    }

    private func save() {
        guard let amount = parsedAmount, amount > 0 else { return }
        let record = BookkeepingRecord(
            id: existing?.id ?? UUID(),
            kind: kind,
            amount: amount,
            category: category,
            note: note,
            date: date,
            createdAt: existing?.createdAt ?? Date(),
            updatedAt: Date()
        )
        if existing == nil {
            store.add(record)
            amountText = ""
            note = ""
            showSaved = true
        } else {
            store.update(record)
            dismiss()
        }
    }
}

struct RecordsView: View {
    @EnvironmentObject private var store: BookkeepingStore
    @State private var query = ""
    @State private var filter: RecordKind?
    let onEdit: (BookkeepingRecord) -> Void

    var body: some View {
        NavigationStack {
            let records = store.filteredRecords(month: store.selectedMonth, query: query, kind: filter)
            let groups = BookkeepingAnalytics.groupedByDay(records)

            List {
                Section {
                    MonthStepper(month: $store.selectedMonth)
                    Picker("类型", selection: $filter) {
                        Text("全部").tag(RecordKind?.none)
                        ForEach(RecordKind.allCases) { kind in
                            Text(kind.title).tag(RecordKind?.some(kind))
                        }
                    }
                    .pickerStyle(.segmented)
                }
                .listRowBackground(Color.clear)

                if records.isEmpty {
                    EmptyStateView(title: "没有匹配账单", subtitle: "换一个月份、类型或关键词试试。", systemImage: "magnifyingglass")
                        .listRowBackground(Color.clear)
                } else {
                    ForEach(groups, id: \.date) { group in
                        Section {
                            ForEach(group.records) { record in
                                RecordRow(record: record)
                                    .swipeActions(edge: .trailing) {
                                        Button(role: .destructive) {
                                            store.delete(record)
                                        } label: {
                                            Label("删除", systemImage: "trash")
                                        }
                                        Button {
                                            onEdit(record)
                                        } label: {
                                            Label("编辑", systemImage: "pencil")
                                        }
                                        .tint(CinnaTheme.sky)
                                    }
                            }
                        } header: {
                            HStack {
                                Text(group.date.dayLabel)
                                Spacer()
                                Text("+¥\(group.summary.income.moneyText) / -¥\(group.summary.expense.moneyText)")
                            }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(CinnaTheme.background)
            .searchable(text: $query, prompt: "搜索分类、金额、备注")
            .toolbar {
                ShareLink(item: store.csv(for: records)) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
            .navigationTitle("账单")
        }
    }
}

struct StatsView: View {
    @EnvironmentObject private var store: BookkeepingStore
    @State private var kind: RecordKind = .expense

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    MonthStepper(month: $store.selectedMonth)

                    Picker("类型", selection: $kind) {
                        ForEach(RecordKind.allCases) { kind in
                            Text(kind.title).tag(kind)
                        }
                    }
                    .pickerStyle(.segmented)

                    let records = store.records(in: store.selectedMonth)
                    let summary = BookkeepingAnalytics.summary(for: records)
                    let breakdown = BookkeepingAnalytics.categoryBreakdown(records: records, kind: kind)
                    let trend = BookkeepingAnalytics.recentTrend(records: store.records, endingAt: store.selectedMonth)
                    let heat = BookkeepingAnalytics.dailyHeat(records: store.records, month: store.selectedMonth, kind: kind)

                    HStack(spacing: 14) {
                        MetricTile(title: "收入", amount: summary.income, kind: .income)
                        Divider()
                        MetricTile(title: "支出", amount: summary.expense, kind: .expense)
                    }
                    .cinnaCard()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("\(kind.title)构成")
                            .font(.headline)
                        if breakdown.isEmpty {
                            EmptyStateView(title: "暂无统计", subtitle: "记录后会自动生成分类占比。", systemImage: "chart.pie")
                        } else {
                            ForEach(breakdown) { item in
                                CategoryBar(item: item, kind: kind)
                            }
                        }
                    }
                    .cinnaCard()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("近 6 个月趋势")
                            .font(.headline)
                        if trend.allSatisfy({ $0.income == 0 && $0.expense == 0 }) {
                            EmptyStateView(title: "暂无趋势", subtitle: "连续记录几笔后，这里会展示收支变化。", systemImage: "chart.bar")
                        } else {
                            TrendChart(points: trend)
                                .frame(height: 180)
                        }
                    }
                    .cinnaCard()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("每日\(kind.title)热力")
                            .font(.headline)
                        HeatGrid(points: heat)
                    }
                    .cinnaCard()
                }
                .padding(16)
            }
            .background(CinnaTheme.background.ignoresSafeArea())
            .navigationTitle("统计")
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var store: BookkeepingStore
    @State private var budgetText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 12) {
                        MonthStepper(month: $store.selectedMonth)

                        Text("月度预算")
                            .font(.headline)
                        HStack {
                            TextField("输入预算金额", text: $budgetText)
                                .decimalInput()
                                .textFieldStyle(.roundedBorder)
                                .onChange(of: budgetText) { _, newValue in
                                    let sanitized = sanitizedMoneyText(newValue)
                                    if sanitized != newValue {
                                        budgetText = sanitized
                                    }
                                }
                            Button("保存") {
                                let amount = Decimal(string: budgetText.replacingOccurrences(of: ",", with: ".")) ?? 0
                                store.setBudget(amount, for: store.selectedMonth)
                                budgetText = amount > 0 ? amount.moneyText : ""
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        Text("当前：¥\(store.budget(for: store.selectedMonth).moneyText)")
                            .font(.caption)
                            .foregroundStyle(CinnaTheme.muted)
                    }
                    .cinnaCard()

                    let allSummary = BookkeepingAnalytics.summary(for: store.records)
                    VStack(alignment: .leading, spacing: 14) {
                        Text("数据概览")
                            .font(.headline)
                        HStack {
                            MetricTile(title: "总收入", amount: allSummary.income, kind: .income)
                            Divider()
                            MetricTile(title: "总支出", amount: allSummary.expense, kind: .expense)
                        }
                        Text("共 \(store.records.count) 笔记录，数据仅保存在本机。")
                            .font(.caption)
                            .foregroundStyle(CinnaTheme.muted)
                    }
                    .cinnaCard()

                    VStack(alignment: .leading, spacing: 10) {
                        Text("架构说明")
                            .font(.headline)
                        Text("iOS 与 Android 使用同一套领域概念：RecordKind、MonthKey、Category、Budget、Summary、Trend。展示可以保留原生差异，但统计口径和页面信息层级保持一致。")
                            .font(.subheadline)
                            .foregroundStyle(CinnaTheme.ink)
                    }
                    .cinnaCard()
                }
                .padding(16)
            }
            .background(CinnaTheme.background.ignoresSafeArea())
            .navigationTitle("设置")
            .onAppear {
                refreshBudgetText()
            }
            .onChange(of: store.selectedMonth) {
                refreshBudgetText()
            }
        }
    }

    private func refreshBudgetText() {
        let budget = store.budget(for: store.selectedMonth)
        budgetText = budget > 0 ? budget.moneyText : ""
    }
}

private func sanitizedMoneyText(_ value: String, integerLimit: Int = 8) -> String {
    let normalized = value.replacingOccurrences(of: ",", with: ".")
    var result = ""
    var hasDot = false
    var integerCount = 0
    var fractionCount = 0

    for character in normalized {
        if character.isWholeNumber {
            if hasDot {
                guard fractionCount < 2 else { continue }
                result.append(character)
                fractionCount += 1
            } else {
                guard integerCount < integerLimit else { continue }
                if result == "0", character != "0" {
                    result = String(character)
                } else if result != "0" || character != "0" {
                    result.append(character)
                } else if result.isEmpty {
                    result = "0"
                }
                integerCount = result.split(separator: ".").first?.count ?? result.count
            }
        } else if character == ".", !hasDot {
            if result.isEmpty {
                result = "0"
                integerCount = 1
            }
            result.append(".")
            hasDot = true
        }
    }

    return result
}

private struct CategoryBar: View {
    let item: CategoryBreakdown
    let kind: RecordKind

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text("\(item.emoji) \(item.category)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("¥\(item.amount.moneyText)")
                    .font(.subheadline.weight(.bold))
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(CinnaTheme.skySoft)
                    Capsule()
                        .fill(kind == .income ? CinnaTheme.mint : CinnaTheme.pink)
                        .frame(width: proxy.size.width * item.percent)
                }
            }
            .frame(height: 8)
            Text("\(Int(round(item.percent * 100)))% · \(item.count) 笔")
                .font(.caption)
                .foregroundStyle(CinnaTheme.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct TrendChart: View {
    let points: [TrendPoint]

    var body: some View {
        Canvas { context, size in
            let maxValue = max(points.map { max($0.income.doubleValue, $0.expense.doubleValue) }.max() ?? 1, 1)
            let slot = size.width / CGFloat(max(points.count, 1))
            for (index, point) in points.enumerated() {
                let center = CGFloat(index) * slot + slot / 2
                drawBar(context: context, size: size, x: center - 10, value: point.expense.doubleValue, maxValue: maxValue, color: CinnaTheme.pink)
                drawBar(context: context, size: size, x: center + 2, value: point.income.doubleValue, maxValue: maxValue, color: CinnaTheme.mint)
            }
        }
        .overlay(alignment: .bottom) {
            HStack {
                ForEach(points) { point in
                    Text("\(point.month.month)月")
                        .font(.caption2)
                        .foregroundStyle(CinnaTheme.muted)
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func drawBar(context: GraphicsContext, size: CGSize, x: CGFloat, value: Double, maxValue: Double, color: Color) {
        let height = CGFloat(value / maxValue) * (size.height - 24)
        let rect = CGRect(x: x, y: size.height - height - 20, width: 8, height: height)
        context.fill(Path(roundedRect: rect, cornerRadius: 4), with: .color(color))
    }
}

private struct HeatGrid: View {
    let points: [DailyHeatPoint]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)
    private let weekdays = ["日", "一", "二", "三", "四", "五", "六"]

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                ForEach(weekdays, id: \.self) { weekday in
                    Text(weekday)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(CinnaTheme.muted)
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(0..<leadingBlankCount, id: \.self) { _ in
                    Color.clear.frame(height: 30)
                }
                ForEach(points) { point in
                    Text(Calendar.current.component(.day, from: point.date), format: .number)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(point.level >= 3 ? .white : CinnaTheme.ink)
                        .frame(height: 30)
                        .frame(maxWidth: .infinity)
                        .background(color(for: point.level))
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .accessibilityLabel("\(point.date.ymdText) ¥\(point.amount.moneyText)")
                }
            }
        }
    }

    private var leadingBlankCount: Int {
        guard let first = points.first?.date else {
            return 0
        }
        return Calendar.current.component(.weekday, from: first) - 1
    }

    private func color(for level: Int) -> Color {
        switch level {
        case 1: CinnaTheme.skySoft
        case 2: Color(red: 0.62, green: 0.83, blue: 0.93)
        case 3: CinnaTheme.sky
        case 4: Color(red: 0.16, green: 0.48, blue: 0.62)
        default: Color(red: 0.94, green: 0.96, blue: 0.97)
        }
    }
}
