package com.icelemon233.cinnabookkeeping.domain

object CategoryCatalog {
    val expenses = listOf(
        BookkeepingCategory(RecordKind.EXPENSE, "餐饮", "🍜"),
        BookkeepingCategory(RecordKind.EXPENSE, "交通", "🚌"),
        BookkeepingCategory(RecordKind.EXPENSE, "购物", "🛍️"),
        BookkeepingCategory(RecordKind.EXPENSE, "娱乐", "🎮"),
        BookkeepingCategory(RecordKind.EXPENSE, "住房", "🏠"),
        BookkeepingCategory(RecordKind.EXPENSE, "医疗", "💊"),
        BookkeepingCategory(RecordKind.EXPENSE, "教育", "📚"),
        BookkeepingCategory(RecordKind.EXPENSE, "运动", "🏃"),
        BookkeepingCategory(RecordKind.EXPENSE, "旅行", "✈️"),
        BookkeepingCategory(RecordKind.EXPENSE, "日用", "🧴"),
        BookkeepingCategory(RecordKind.EXPENSE, "宠物", "🐾"),
        BookkeepingCategory(RecordKind.EXPENSE, "其他", "📦")
    )

    val incomes = listOf(
        BookkeepingCategory(RecordKind.INCOME, "工资", "💼"),
        BookkeepingCategory(RecordKind.INCOME, "奖金", "🎁"),
        BookkeepingCategory(RecordKind.INCOME, "副业", "💡"),
        BookkeepingCategory(RecordKind.INCOME, "理财", "📈"),
        BookkeepingCategory(RecordKind.INCOME, "红包", "🧧"),
        BookkeepingCategory(RecordKind.INCOME, "其他", "📦")
    )

    fun categories(kind: RecordKind): List<BookkeepingCategory> =
        if (kind == RecordKind.EXPENSE) expenses else incomes

    fun emoji(category: String): String =
        (expenses + incomes).firstOrNull { it.name == category }?.emoji ?: "📦"
}
