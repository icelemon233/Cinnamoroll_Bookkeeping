import SwiftUI

struct MonthStepper: View {
    @Binding var month: MonthKey

    private var isCurrentOrFuture: Bool {
        month >= MonthKey(date: Date())
    }

    var body: some View {
        HStack(spacing: 14) {
            Button {
                month = month.advanced(by: -1)
            } label: {
                Image(systemName: "chevron.left")
            }
            .buttonStyle(.borderless)

            Text(month.label)
                .font(.headline)
                .foregroundStyle(CinnaTheme.ink)
                .frame(minWidth: 128)

            Button {
                guard !isCurrentOrFuture else { return }
                month = month.advanced(by: 1)
            } label: {
                Image(systemName: "chevron.right")
            }
            .buttonStyle(.borderless)
            .disabled(isCurrentOrFuture)
        }
        .padding(.vertical, 8)
    }
}

struct MetricTile: View {
    let title: String
    let amount: Decimal
    let kind: RecordKind?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(CinnaTheme.muted)
            Text("\(kind?.signedPrefix ?? "")¥\(amount.moneyText)")
                .font(.title3.weight(.bold))
                .foregroundStyle(color)
                .minimumScaleFactor(0.75)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var color: Color {
        switch kind {
        case .income: CinnaTheme.mint
        case .expense: CinnaTheme.pink
        case nil: amount >= 0 ? CinnaTheme.sky : CinnaTheme.pink
        }
    }
}

struct BudgetProgressView: View {
    let expense: Decimal
    let budget: Decimal

    private var progress: Double {
        guard budget > 0 else { return 0 }
        return min(1.2, expense.doubleValue / max(budget.doubleValue, 0.01))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(budget > 0 ? "本月预算" : "未设置预算")
                    .font(.headline)
                Spacer()
                Text(budget > 0 ? "¥\(expense.moneyText) / ¥\(budget.moneyText)" : "设置后可跟踪剩余额度")
                    .font(.caption)
                    .foregroundStyle(CinnaTheme.muted)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(CinnaTheme.skySoft)
                    Capsule()
                        .fill(progress > 1 ? CinnaTheme.pink : CinnaTheme.sky)
                        .frame(width: max(8, proxy.size.width * min(progress, 1)))
                }
            }
            .frame(height: 10)
            if budget > 0 {
                let remain = (budget - expense).normalizedMoney
                Text(remain >= 0 ? "还剩 ¥\(remain.moneyText)" : "已超出 ¥\((-remain).moneyText)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(remain >= 0 ? CinnaTheme.sky : CinnaTheme.pink)
            }
        }
    }
}

struct RecordRow: View {
    let record: BookkeepingRecord

    var body: some View {
        HStack(spacing: 12) {
            Text(CategoryCatalog.emoji(for: record.category))
                .font(.title2)
                .frame(width: 44, height: 44)
                .background(record.kind == .income ? CinnaTheme.skySoft : CinnaTheme.pinkSoft)
                .clipShape(RoundedRectangle(cornerRadius: CinnaTheme.radius, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(record.category)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CinnaTheme.ink)
                Text(record.note.isEmpty ? record.date.ymdText : record.note)
                    .font(.caption)
                    .foregroundStyle(CinnaTheme.muted)
                    .lineLimit(1)
            }

            Spacer()

            Text("\(record.kind.signedPrefix)¥\(record.amount.moneyText)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(record.kind == .income ? CinnaTheme.mint : CinnaTheme.pink)
                .minimumScaleFactor(0.75)
                .lineLimit(1)
        }
        .contentShape(Rectangle())
    }
}

struct EmptyStateView: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundStyle(CinnaTheme.sky)
            Text(title)
                .font(.headline)
                .foregroundStyle(CinnaTheme.ink)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(CinnaTheme.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }
}
