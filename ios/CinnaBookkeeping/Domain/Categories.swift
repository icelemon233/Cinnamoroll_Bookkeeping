import Foundation

enum CategoryCatalog {
    static let expenses: [BookkeepingCategory] = [
        .init(kind: .expense, name: "餐饮", emoji: "🍜"),
        .init(kind: .expense, name: "交通", emoji: "🚌"),
        .init(kind: .expense, name: "购物", emoji: "🛍️"),
        .init(kind: .expense, name: "娱乐", emoji: "🎮"),
        .init(kind: .expense, name: "住房", emoji: "🏠"),
        .init(kind: .expense, name: "医疗", emoji: "💊"),
        .init(kind: .expense, name: "教育", emoji: "📚"),
        .init(kind: .expense, name: "运动", emoji: "🏃"),
        .init(kind: .expense, name: "旅行", emoji: "✈️"),
        .init(kind: .expense, name: "日用", emoji: "🧴"),
        .init(kind: .expense, name: "宠物", emoji: "🐾"),
        .init(kind: .expense, name: "其他", emoji: "📦")
    ]

    static let incomes: [BookkeepingCategory] = [
        .init(kind: .income, name: "工资", emoji: "💼"),
        .init(kind: .income, name: "奖金", emoji: "🎁"),
        .init(kind: .income, name: "副业", emoji: "💡"),
        .init(kind: .income, name: "理财", emoji: "📈"),
        .init(kind: .income, name: "红包", emoji: "🧧"),
        .init(kind: .income, name: "其他", emoji: "📦")
    ]

    static func categories(for kind: RecordKind) -> [BookkeepingCategory] {
        kind == .expense ? expenses : incomes
    }

    static func emoji(for category: String) -> String {
        (expenses + incomes).first(where: { $0.name == category })?.emoji ?? "📦"
    }
}
