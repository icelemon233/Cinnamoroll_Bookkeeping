import Foundation

@MainActor
final class BookkeepingStore: ObservableObject {
    @Published private(set) var records: [BookkeepingRecord] = []
    @Published private(set) var monthlyBudgets: [String: Decimal] = [:]
    @Published var selectedMonth = MonthKey(date: Date())

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let ioQueue = DispatchQueue(label: "cinna.bookkeeping.store", qos: .utility)
    private let fileURL: URL

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? Self.defaultStoreURL()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        load()
    }

    func add(_ record: BookkeepingRecord) {
        records.append(record)
        records.sort(by: Self.recordSort)
        persist()
    }

    func update(_ record: BookkeepingRecord) {
        guard let index = records.firstIndex(where: { $0.id == record.id }) else { return }
        records[index] = record
        records.sort(by: Self.recordSort)
        persist()
    }

    func delete(_ record: BookkeepingRecord) {
        records.removeAll { $0.id == record.id }
        persist()
    }

    func budget(for month: MonthKey) -> Decimal {
        monthlyBudgets[month.compact] ?? 0
    }

    func setBudget(_ amount: Decimal, for month: MonthKey) {
        if amount <= 0 {
            monthlyBudgets.removeValue(forKey: month.compact)
        } else {
            monthlyBudgets[month.compact] = amount.normalizedMoney
        }
        persist()
    }

    func records(in month: MonthKey) -> [BookkeepingRecord] {
        BookkeepingAnalytics.records(in: month, from: records)
    }

    func summary(for month: MonthKey) -> MonthlySummary {
        BookkeepingAnalytics.summary(for: records(in: month))
    }

    func filteredRecords(month: MonthKey, query: String, kind: RecordKind?) -> [BookkeepingRecord] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return records(in: month).filter { record in
            (kind == nil || record.kind == kind)
            && (normalized.isEmpty || record.searchableText.contains(normalized))
        }
    }

    func duplicateCandidates(kind: RecordKind, category: String, amount: Decimal, date: Date, excluding id: UUID? = nil) -> [BookkeepingRecord] {
        BookkeepingAnalytics.duplicateCandidates(
            kind: kind,
            category: category,
            amount: amount,
            date: date,
            records: records,
            excluding: id
        )
    }

    func csv(for exportRecords: [BookkeepingRecord]) -> String {
        let header = "id,type,amount,category,note,date,createdAt"
        let lines = exportRecords.sorted(by: Self.recordSort).map { record in
            [
                record.id.uuidString,
                record.kind.rawValue,
                record.amount.moneyText,
                record.category,
                record.note,
                record.date.ymdText,
                ISO8601DateFormatter().string(from: record.createdAt)
            ]
            .map(Self.csvEscape)
            .joined(separator: ",")
        }
        return ([header] + lines).joined(separator: "\n")
    }

    private func load() {
        do {
            guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
            let data = try Data(contentsOf: fileURL)
            let snapshot = try decoder.decode(BookkeepingSnapshot.self, from: data)
            records = snapshot.records.sorted(by: Self.recordSort)
            monthlyBudgets = snapshot.monthlyBudgets
        } catch {
            records = []
            monthlyBudgets = [:]
        }
    }

    private func persist() {
        let snapshot = BookkeepingSnapshot(records: records, monthlyBudgets: monthlyBudgets)
        let url = fileURL
        let encoder = encoder
        ioQueue.async {
            do {
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                let data = try encoder.encode(snapshot)
                try data.write(to: url, options: [.atomic])
            } catch {
                assertionFailure("Failed to persist bookkeeping data: \(error)")
            }
        }
    }

    private static func defaultStoreURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("cinna-bookkeeping/bookkeeping.json")
    }

    private static func recordSort(_ lhs: BookkeepingRecord, _ rhs: BookkeepingRecord) -> Bool {
        if lhs.date == rhs.date { return lhs.createdAt > rhs.createdAt }
        return lhs.date > rhs.date
    }

    private static func csvEscape(_ value: String) -> String {
        let escaped = value.replacingOccurrences(of: "\"", with: "\"\"")
        return "\"\(escaped)\""
    }
}
