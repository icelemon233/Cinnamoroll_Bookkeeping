package com.icelemon233.cinnabookkeeping.domain

import java.time.LocalDate
import java.time.YearMonth
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max

object BookkeepingAnalytics {
    private val recordComparator = compareByDescending<BookkeepingRecord> { it.date }
        .thenByDescending { it.createdAt }

    fun recordsIn(month: MonthKey, records: List<BookkeepingRecord>): List<BookkeepingRecord> =
        records
            .filter { YearMonth.from(it.date) == month.yearMonth }
            .sortedWith(recordComparator)

    fun summary(records: List<BookkeepingRecord>): MonthlySummary {
        var income = 0.0
        var expense = 0.0
        records.forEach { record ->
            when (record.kind) {
                RecordKind.INCOME -> income += record.amount
                RecordKind.EXPENSE -> expense += record.amount
            }
        }
        income = income.moneyRound()
        expense = expense.moneyRound()
        return MonthlySummary(income, expense, (income - expense).moneyRound(), records.size)
    }

    fun groupedByDay(records: List<BookkeepingRecord>): List<DayGroup> =
        records
            .groupBy { it.date }
            .toSortedMap(compareByDescending { it })
            .map { (date, dayRecords) ->
                val sorted = dayRecords.sortedWith(recordComparator)
                DayGroup(date, sorted, summary(sorted))
            }

    fun categoryBreakdown(records: List<BookkeepingRecord>, kind: RecordKind): List<CategoryBreakdown> {
        val target = records.filter { it.kind == kind }
        val total = target.sumOf { it.amount }
        if (total <= 0.0) return emptyList()
        return target
            .groupBy { it.category }
            .map { (category, items) ->
                val amount = items.sumOf { it.amount }.moneyRound()
                CategoryBreakdown(
                    category = category,
                    emoji = CategoryCatalog.emoji(category),
                    amount = amount,
                    percent = amount / max(total, 0.01),
                    count = items.size
                )
            }
            .sortedWith(compareByDescending<CategoryBreakdown> { it.amount }.thenBy { it.category })
    }

    fun recentTrend(records: List<BookkeepingRecord>, endingAt: MonthKey, months: Int = 6): List<TrendPoint> {
        val targets = (months - 1 downTo 0).map { offset -> endingAt.plusMonths(-offset.toLong()) }
        val targetSet = targets.toSet()
        val buckets = targets.associateWith { mutableListOf<BookkeepingRecord>() }.toMutableMap()

        records.forEach { record ->
            val key = MonthKey.from(record.date)
            if (key in targetSet) {
                buckets.getValue(key).add(record)
            }
        }

        return targets.map { month ->
            val summary = summary(buckets[month].orEmpty())
            TrendPoint(month, summary.income, summary.expense, summary.net)
        }
    }

    fun dailyHeat(records: List<BookkeepingRecord>, month: MonthKey, kind: RecordKind): List<DailyHeatPoint> {
        val monthRecords = records.filter { it.kind == kind && YearMonth.from(it.date) == month.yearMonth }
        val grouped = monthRecords.groupBy { it.date }
        val maxAmount = grouped.values.maxOfOrNull { day -> day.sumOf { it.amount } } ?: 0.0
        val length = month.yearMonth.lengthOfMonth()
        return (1..length).map { day ->
            val date = LocalDate.of(month.year, month.month, day)
            val amount = (grouped[date]?.sumOf { it.amount } ?: 0.0).moneyRound()
            val ratio = if (maxAmount <= 0.0) 0.0 else amount / maxAmount
            val level = if (ratio == 0.0) 0 else ceil(ratio * 4).toInt().coerceIn(1, 4)
            DailyHeatPoint(date, amount, level)
        }
    }

    fun duplicateCandidates(
        kind: RecordKind,
        category: String,
        amount: Double,
        date: LocalDate,
        records: List<BookkeepingRecord>,
        excludingId: String? = null
    ): List<BookkeepingRecord> =
        records
            .filter {
                it.id != excludingId &&
                    it.kind == kind &&
                    it.category == category &&
                    it.date == date &&
                    abs(it.amount - amount) <= 1.0
            }
            .sortedWith(recordComparator)

    fun monthlyAdvice(summary: MonthlySummary, budget: Double, trend: List<TrendPoint>): String {
        if (summary.count == 0) return "本月还没有记录，先从今天的一笔小账开始。"
        if (budget > 0 && summary.expense > budget) return "本月预算已经超出，先看 TOP 分类，压住最容易失控的一项。"
        if (budget > 0 && summary.expense / max(budget, 1.0) > 0.85) return "预算使用超过 85%，接下来几天适合放慢非必要支出。"
        val previous = trend.dropLast(1).lastOrNull()
        if (previous != null && summary.expense > previous.expense) return "支出高于上月同期，建议检查餐饮、购物或交通是否有集中开销。"
        return if (summary.net >= 0) "本月结余为正，继续保持这个节奏。" else "本月暂时为负，优先记录固定支出，方便下月预算更准。"
    }
}
