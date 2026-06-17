import Foundation

enum RecordKind: String, CaseIterable, Codable, Identifiable {
    case expense
    case income

    var id: String { rawValue }

    var title: String {
        switch self {
        case .expense: "支出"
        case .income: "收入"
        }
    }

    var signedPrefix: String {
        switch self {
        case .expense: "-"
        case .income: "+"
        }
    }
}

struct BookkeepingRecord: Identifiable, Codable, Equatable {
    var id: UUID
    var kind: RecordKind
    var amount: Decimal
    var category: String
    var note: String
    var date: Date
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        kind: RecordKind,
        amount: Decimal,
        category: String,
        note: String = "",
        date: Date = Date(),
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.kind = kind
        self.amount = amount.normalizedMoney
        self.category = category
        self.note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        self.date = Calendar.current.startOfDay(for: date)
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var searchableText: String {
        [category, note, amount.moneyText, date.ymdText]
            .joined(separator: " ")
            .lowercased()
    }
}

struct BookkeepingCategory: Identifiable, Codable, Hashable {
    var id: String { "\(kind.rawValue)-\(name)" }
    let kind: RecordKind
    let name: String
    let emoji: String
}

struct MonthKey: Hashable, Codable, Comparable, Identifiable {
    let year: Int
    let month: Int

    var id: String { compact }
    var compact: String { String(format: "%04d-%02d", year, month) }
    var label: String { "\(year)年\(String(format: "%02d", month))月" }

    init(year: Int, month: Int) {
        self.year = year
        self.month = month
    }

    init(date: Date, calendar: Calendar = .current) {
        let components = calendar.dateComponents([.year, .month], from: date)
        self.year = components.year ?? 1970
        self.month = components.month ?? 1
    }

    var startDate: Date {
        Calendar.current.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
    }

    var endDateExclusive: Date {
        Calendar.current.date(byAdding: .month, value: 1, to: startDate) ?? Date()
    }

    func advanced(by months: Int) -> MonthKey {
        let next = Calendar.current.date(byAdding: .month, value: months, to: startDate) ?? startDate
        return MonthKey(date: next)
    }

    static func < (lhs: MonthKey, rhs: MonthKey) -> Bool {
        lhs.year == rhs.year ? lhs.month < rhs.month : lhs.year < rhs.year
    }
}

struct MonthlySummary: Equatable {
    let income: Decimal
    let expense: Decimal
    let net: Decimal
    let count: Int

    static let empty = MonthlySummary(income: 0, expense: 0, net: 0, count: 0)
}

struct CategoryBreakdown: Identifiable, Equatable {
    var id: String { category }
    let category: String
    let emoji: String
    let amount: Decimal
    let percent: Double
    let count: Int
}

struct TrendPoint: Identifiable, Equatable {
    var id: String { month.compact }
    let month: MonthKey
    let income: Decimal
    let expense: Decimal
    let net: Decimal
}

struct DailyHeatPoint: Identifiable, Equatable {
    var id: String { date.ymdText }
    let date: Date
    let amount: Decimal
    let level: Int
}

struct BookkeepingSnapshot: Codable {
    var version: Int = 1
    var records: [BookkeepingRecord] = []
    var monthlyBudgets: [String: Decimal] = [:]
}

extension Decimal {
    var doubleValue: Double {
        NSDecimalNumber(decimal: self).doubleValue
    }

    var normalizedMoney: Decimal {
        var value = self
        var rounded = Decimal()
        NSDecimalRound(&rounded, &value, 2, .bankers)
        return rounded
    }

    var moneyText: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSDecimalNumber(decimal: self)) ?? "0.00"
    }
}

extension Date {
    var ymdText: String {
        DateFormatters.ymd.string(from: self)
    }

    var dayLabel: String {
        if Calendar.current.isDateInToday(self) { return "今天" }
        if Calendar.current.isDateInYesterday(self) { return "昨天" }
        return DateFormatters.dayLabel.string(from: self)
    }
}

enum DateFormatters {
    static let ymd: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = .current
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let dayLabel: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = .current
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日 EEEE"
        return formatter
    }()
}
