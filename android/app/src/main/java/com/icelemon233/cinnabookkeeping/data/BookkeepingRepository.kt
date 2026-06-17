package com.icelemon233.cinnabookkeeping.data

import android.content.Context
import com.icelemon233.cinnabookkeeping.domain.BookkeepingRecord
import com.icelemon233.cinnabookkeeping.domain.BookkeepingState
import com.icelemon233.cinnabookkeeping.domain.MonthKey
import com.icelemon233.cinnabookkeeping.domain.RecordKind
import com.icelemon233.cinnabookkeeping.domain.moneyRound
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.util.UUID

class BookkeepingRepository(context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val file = File(context.applicationContext.filesDir, "cinna-bookkeeping/bookkeeping.json")
    private val _state = MutableStateFlow(BookkeepingState())
    private val mutationMutex = Mutex()

    val state: StateFlow<BookkeepingState> = _state.asStateFlow()

    init {
        load()
    }

    fun selectMonth(month: MonthKey) {
        _state.update { it.copy(selectedMonth = month) }
    }

    fun add(record: BookkeepingRecord) = mutate {
        it.copy(records = (it.records + record).sortedRecords())
    }

    fun update(record: BookkeepingRecord) = mutate {
        it.copy(records = it.records.map { current -> if (current.id == record.id) record else current }.sortedRecords())
    }

    fun delete(record: BookkeepingRecord) = mutate {
        it.copy(records = it.records.filterNot { current -> current.id == record.id })
    }

    fun setBudget(month: MonthKey, amount: Double) = mutate {
        val next = it.monthlyBudgets.toMutableMap()
        if (amount <= 0.0) next.remove(month.compact) else next[month.compact] = amount.moneyRound()
        it.copy(monthlyBudgets = next)
    }

    fun csv(records: List<BookkeepingRecord>): String {
        val header = "id,type,amount,category,note,date,createdAt"
        val lines = records.sortedRecords().map { record ->
            listOf(
                record.id,
                record.kind.wire,
                record.amount.toString(),
                record.category,
                record.note,
                record.date.toString(),
                record.createdAt.toString()
            ).joinToString(",") { csvEscape(it) }
        }
        return (listOf(header) + lines).joinToString("\n")
    }

    private fun mutate(transform: (BookkeepingState) -> BookkeepingState) {
        scope.launch {
            mutationMutex.withLock {
                val next = transform(_state.value)
                val published = next.copy(selectedMonth = _state.value.selectedMonth)
                _state.value = published
                save(published)
            }
        }
    }

    private fun load() {
        if (!file.exists()) return
        runCatching {
            val root = JSONObject(file.readText())
            val records = root.optJSONArray("records")?.toRecords().orEmpty().sortedRecords()
            val budgets = root.optJSONObject("monthlyBudgets").toBudgetMap()
            _state.value = BookkeepingState(records = records, monthlyBudgets = budgets, selectedMonth = _state.value.selectedMonth)
        }
    }

    private fun save(state: BookkeepingState) {
        runCatching {
            file.parentFile?.mkdirs()
            val root = JSONObject()
                .put("version", 1)
                .put("records", state.records.toJson())
                .put("monthlyBudgets", JSONObject(state.monthlyBudgets))
            file.writeText(root.toString(2))
        }
    }

    private fun List<BookkeepingRecord>.sortedRecords(): List<BookkeepingRecord> =
        sortedWith(compareByDescending<BookkeepingRecord> { it.date }.thenByDescending { it.createdAt })

    private fun JSONArray.toRecords(): List<BookkeepingRecord> =
        (0 until length()).mapNotNull { index ->
            runCatching {
                optJSONObject(index)?.let { json ->
                    BookkeepingRecord(
                        id = json.optString("id").takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString(),
                        kind = RecordKind.fromWire(json.optString("kind")),
                        amount = json.optDouble("amount").moneyRound(),
                        category = json.optString("category").ifBlank { "其他" },
                        note = json.optString("note"),
                        date = LocalDate.parse(json.optString("date")),
                        createdAt = json.optLong("createdAt").takeIf { it > 0 } ?: System.currentTimeMillis(),
                        updatedAt = json.optLong("updatedAt").takeIf { it > 0 } ?: System.currentTimeMillis()
                    )
                }
            }.getOrNull()
        }

    private fun List<BookkeepingRecord>.toJson(): JSONArray {
        val array = JSONArray()
        forEach { record ->
            array.put(
                JSONObject()
                    .put("id", record.id)
                    .put("kind", record.kind.wire)
                    .put("amount", record.amount.moneyRound())
                    .put("category", record.category)
                    .put("note", record.note)
                    .put("date", record.date.toString())
                    .put("createdAt", record.createdAt)
                    .put("updatedAt", record.updatedAt)
            )
        }
        return array
    }

    private fun JSONObject?.toBudgetMap(): Map<String, Double> {
        if (this == null) return emptyMap()
        val result = mutableMapOf<String, Double>()
        keys().forEach { key -> result[key] = optDouble(key).moneyRound() }
        return result
    }

    private fun csvEscape(value: String): String =
        "\"${value.replace("\"", "\"\"")}\""
}
