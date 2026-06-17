import Foundation

enum BookkeepingAnalytics {
    static func records(in month: MonthKey, from records: [BookkeepingRecord]) -> [BookkeepingRecord] {
        records
            .filter { $0.date >= month.startDate && $0.date < month.endDateExclusive }
            .sorted(by: recordSort)
    }

    static func summary(for records: [BookkeepingRecord]) -> MonthlySummary {
        var income: Decimal = 0
        var expense: Decimal = 0
        for record in records {
            switch record.kind {
            case .income: income += record.amount
            case .expense: expense += record.amount
            }
        }
        return MonthlySummary(
            income: income.normalizedMoney,
            expense: expense.normalizedMoney,
            net: (income - expense).normalizedMoney,
            count: records.count
        )
    }

    static func groupedByDay(_ records: [BookkeepingRecord]) -> [(date: Date, records: [BookkeepingRecord], summary: MonthlySummary)] {
        let grouped = Dictionary(grouping: records) { Calendar.current.startOfDay(for: $0.date) }
        return grouped.keys.sorted(by: >).map { date in
            let dayRecords = (grouped[date] ?? []).sorted(by: recordSort)
            return (date, dayRecords, summary(for: dayRecords))
        }
    }

    static func categoryBreakdown(records: [BookkeepingRecord], kind: RecordKind) -> [CategoryBreakdown] {
        let target = records.filter { $0.kind == kind }
        let total = target.reduce(Decimal(0)) { $0 + $1.amount }
        guard total > 0 else { return [] }

        let grouped = Dictionary(grouping: target, by: \.category)
        return grouped.map { category, items in
            let amount = items.reduce(Decimal(0)) { $0 + $1.amount }.normalizedMoney
            return CategoryBreakdown(
                category: category,
                emoji: CategoryCatalog.emoji(for: category),
                amount: amount,
                percent: amount.doubleValue / max(total.doubleValue, 0.01),
                count: items.count
            )
        }
        .sorted {
            if $0.amount == $1.amount { return $0.category < $1.category }
            return $0.amount > $1.amount
        }
    }

    static func recentTrend(records allRecords: [BookkeepingRecord], endingAt month: MonthKey, months: Int = 6) -> [TrendPoint] {
        let targets = (0..<months).reversed().map { month.advanced(by: -$0) }
        let targetSet = Set(targets)
        var buckets = Dictionary(uniqueKeysWithValues: targets.map { ($0, [BookkeepingRecord]()) })

        for record in allRecords {
            let key = MonthKey(date: record.date)
            if targetSet.contains(key) {
                buckets[key, default: []].append(record)
            }
        }

        return targets.map { target in
            let monthSummary = summary(for: buckets[target] ?? [])
            return TrendPoint(month: target, income: monthSummary.income, expense: monthSummary.expense, net: monthSummary.net)
        }
    }

    static func dailyHeat(records allRecords: [BookkeepingRecord], month: MonthKey, kind: RecordKind) -> [DailyHeatPoint] {
        let monthRecords = allRecords.filter {
            $0.kind == kind
            && $0.date >= month.startDate
            && $0.date < month.endDateExclusive
        }
        let grouped = Dictionary(grouping: monthRecords) { Calendar.current.startOfDay(for: $0.date) }
        let maxAmount = grouped.values
            .map { $0.reduce(Decimal(0)) { $0 + $1.amount }.doubleValue }
            .max() ?? 0
        let days = Calendar.current.range(of: .day, in: .month, for: month.startDate) ?? 1..<1

        return days.compactMap { day -> DailyHeatPoint? in
            guard let date = Calendar.current.date(from: DateComponents(year: month.year, month: month.month, day: day)) else {
                return nil
            }
            let amount = (grouped[date] ?? []).reduce(Decimal(0)) { $0 + $1.amount }.normalizedMoney
            let ratio = maxAmount <= 0 ? 0 : amount.doubleValue / maxAmount
            let level = ratio == 0 ? 0 : min(4, max(1, Int(ceil(ratio * 4))))
            return DailyHeatPoint(date: date, amount: amount, level: level)
        }
    }

    static func duplicateCandidates(
        kind: RecordKind,
        category: String,
        amount: Decimal,
        date: Date,
        records: [BookkeepingRecord],
        excluding id: UUID? = nil
    ) -> [BookkeepingRecord] {
        let targetDate = Calendar.current.startOfDay(for: date)
        let amountValue = amount.doubleValue
        return records.filter { record in
            record.id != id
            && record.kind == kind
            && record.category == category
            && Calendar.current.isDate(record.date, inSameDayAs: targetDate)
            && abs(record.amount.doubleValue - amountValue) <= 1.0
        }
        .sorted(by: recordSort)
    }

    static func monthlyAdvice(summary: MonthlySummary, budget: Decimal, trend: [TrendPoint]) -> String {
        if summary.count == 0 { return "本月还没有记录，先从今天的一笔小账开始。" }
        if budget > 0, summary.expense > budget { return "本月预算已经超出，先看 TOP 分类，压住最容易失控的一项。" }
        if budget > 0, summary.expense.doubleValue / max(budget.doubleValue, 1) > 0.85 { return "预算使用超过 85%，接下来几天适合放慢非必要支出。" }
        if let last = trend.dropLast().last, summary.expense > last.expense { return "支出高于上月同期，建议检查餐饮、购物或交通是否有集中开销。" }
        return summary.net >= 0 ? "本月结余为正，继续保持这个节奏。" : "本月暂时为负，优先记录固定支出，方便下月预算更准。"
    }

    private static func recordSort(_ lhs: BookkeepingRecord, _ rhs: BookkeepingRecord) -> Bool {
        if lhs.date == rhs.date { return lhs.createdAt > rhs.createdAt }
        return lhs.date > rhs.date
    }
}
