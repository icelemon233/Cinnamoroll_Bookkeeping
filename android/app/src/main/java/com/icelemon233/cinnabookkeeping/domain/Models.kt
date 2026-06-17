package com.icelemon233.cinnabookkeeping.domain

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale
import java.util.UUID

enum class RecordKind(val wire: String, val title: String, val sign: String) {
    EXPENSE("expense", "支出", "-"),
    INCOME("income", "收入", "+");

    companion object {
        fun fromWire(value: String): RecordKind = entries.firstOrNull { it.wire == value } ?: EXPENSE
    }
}

data class BookkeepingRecord(
    val id: String = UUID.randomUUID().toString(),
    val kind: RecordKind,
    val amount: Double,
    val category: String,
    val note: String = "",
    val date: LocalDate = LocalDate.now(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = createdAt
) {
    val searchableText: String
        get() = listOf(category, note, amount.moneyText(), date.toString()).joinToString(" ").lowercase()
}

data class BookkeepingCategory(
    val kind: RecordKind,
    val name: String,
    val emoji: String
)

data class MonthKey(val year: Int, val month: Int) : Comparable<MonthKey> {
    val compact: String get() = String.format(Locale.CHINA, "%04d-%02d", year, month)
    val label: String get() = String.format(Locale.CHINA, "%04d年%02d月", year, month)
    val yearMonth: YearMonth get() = YearMonth.of(year, month)

    fun plusMonths(offset: Long): MonthKey {
        val next = yearMonth.plusMonths(offset)
        return MonthKey(next.year, next.monthValue)
    }

    override fun compareTo(other: MonthKey): Int = yearMonth.compareTo(other.yearMonth)

    companion object {
        fun now(): MonthKey = from(LocalDate.now())
        fun from(date: LocalDate): MonthKey {
            val ym = YearMonth.from(date)
            return MonthKey(ym.year, ym.monthValue)
        }
    }
}

data class MonthlySummary(
    val income: Double = 0.0,
    val expense: Double = 0.0,
    val net: Double = 0.0,
    val count: Int = 0
)

data class CategoryBreakdown(
    val category: String,
    val emoji: String,
    val amount: Double,
    val percent: Double,
    val count: Int
)

data class TrendPoint(
    val month: MonthKey,
    val income: Double,
    val expense: Double,
    val net: Double
)

data class DailyHeatPoint(
    val date: LocalDate,
    val amount: Double,
    val level: Int
)

data class DayGroup(
    val date: LocalDate,
    val records: List<BookkeepingRecord>,
    val summary: MonthlySummary
)

data class BookkeepingState(
    val records: List<BookkeepingRecord> = emptyList(),
    val monthlyBudgets: Map<String, Double> = emptyMap(),
    val selectedMonth: MonthKey = MonthKey.now()
)

fun Double.moneyRound(): Double =
    BigDecimal.valueOf(this).setScale(2, RoundingMode.HALF_EVEN).toDouble()

fun Double.moneyText(): String = String.format(Locale.CHINA, "%.2f", moneyRound())
