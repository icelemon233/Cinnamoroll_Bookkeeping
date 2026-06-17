package com.icelemon233.cinnabookkeeping.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.icelemon233.cinnabookkeeping.data.BookkeepingRepository
import com.icelemon233.cinnabookkeeping.domain.BookkeepingAnalytics
import com.icelemon233.cinnabookkeeping.domain.BookkeepingRecord
import com.icelemon233.cinnabookkeeping.domain.BookkeepingState
import com.icelemon233.cinnabookkeeping.domain.CategoryBreakdown
import com.icelemon233.cinnabookkeeping.domain.CategoryCatalog
import com.icelemon233.cinnabookkeeping.domain.DailyHeatPoint
import com.icelemon233.cinnabookkeeping.domain.MonthKey
import com.icelemon233.cinnabookkeeping.domain.RecordKind
import com.icelemon233.cinnabookkeeping.domain.TrendPoint
import com.icelemon233.cinnabookkeeping.domain.moneyRound
import com.icelemon233.cinnabookkeeping.domain.moneyText
import com.icelemon233.cinnabookkeeping.ui.theme.CinnaPalette
import java.time.LocalDate
import kotlin.math.max

private enum class CinnaTab(val label: String, val icon: String) {
    HOME("首页", "⌂"),
    EDITOR("记一笔", "+"),
    RECORDS("账单", "≡"),
    STATS("统计", "◔"),
    PROFILE("设置", "⚙")
}

@Composable
fun CinnaBookkeepingApp(repository: BookkeepingRepository = rememberRepository()) {
    val state by repository.state.collectAsState()
    var selectedTab by rememberSaveable { mutableStateOf(CinnaTab.HOME) }
    var editorKind by rememberSaveable { mutableStateOf(RecordKind.EXPENSE) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    val editingRecord = state.records.firstOrNull { it.id == editingId }

    Scaffold(
        containerColor = CinnaPalette.Background,
        bottomBar = {
            NavigationBar(containerColor = CinnaPalette.Card) {
                CinnaTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = {
                            selectedTab = tab
                            if (tab != CinnaTab.EDITOR) editingId = null
                        },
                        icon = { Text(tab.icon, fontSize = 20.sp) },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CinnaPalette.Background)
        ) {
            when (selectedTab) {
                CinnaTab.HOME -> HomeScreen(
                    state = state,
                    repository = repository,
                    onAdd = {
                        editorKind = it
                        editingId = null
                        selectedTab = CinnaTab.EDITOR
                    },
                    onRecords = { selectedTab = CinnaTab.RECORDS }
                )

                CinnaTab.EDITOR -> RecordEditorScreen(
                    state = state,
                    repository = repository,
                    record = editingRecord,
                    initialKind = editingRecord?.kind ?: editorKind,
                    onSaved = {
                        editingId = null
                        selectedTab = CinnaTab.HOME
                    }
                )

                CinnaTab.RECORDS -> RecordsScreen(
                    state = state,
                    repository = repository,
                    onEdit = {
                        editingId = it.id
                        selectedTab = CinnaTab.EDITOR
                    }
                )

                CinnaTab.STATS -> StatsScreen(state = state, repository = repository)
                CinnaTab.PROFILE -> ProfileScreen(state = state, repository = repository)
            }
        }
    }
}

@Composable
private fun rememberRepository(): BookkeepingRepository {
    val context = LocalContext.current
    return remember { BookkeepingRepository(context) }
}

@Composable
private fun HomeScreen(
    state: BookkeepingState,
    repository: BookkeepingRepository,
    onAdd: (RecordKind) -> Unit,
    onRecords: () -> Unit
) {
    val monthRecords = remember(state.records, state.selectedMonth) {
        BookkeepingAnalytics.recordsIn(state.selectedMonth, state.records)
    }
    val summary = remember(monthRecords) { BookkeepingAnalytics.summary(monthRecords) }
    val budget = state.monthlyBudgets[state.selectedMonth.compact] ?: 0.0
    val trend = remember(state.records, state.selectedMonth) {
        BookkeepingAnalytics.recentTrend(state.records, state.selectedMonth)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { ScreenTitle("肉桂卷记账") }
        item { MonthStepper(state.selectedMonth, repository::selectMonth) }
        item {
            CinnaCard {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    MetricTile("收入", summary.income, RecordKind.INCOME, Modifier.weight(1f))
                    MetricTile("支出", summary.expense, RecordKind.EXPENSE, Modifier.weight(1f))
                }
                Spacer(Modifier.height(14.dp))
                MetricTile("结余", summary.net, null, Modifier.fillMaxWidth())
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = { onAdd(RecordKind.EXPENSE) }, modifier = Modifier.weight(1f)) {
                    Text("记支出")
                }
                OutlinedButton(onClick = { onAdd(RecordKind.INCOME) }, modifier = Modifier.weight(1f)) {
                    Text("记收入")
                }
            }
        }
        item {
            CinnaCard {
                BudgetProgress(expense = summary.expense, budget = budget)
            }
        }
        item {
            CinnaCard {
                Text(
                    BookkeepingAnalytics.monthlyAdvice(summary, budget, trend),
                    color = CinnaPalette.Ink,
                    lineHeight = 20.sp
                )
            }
        }
        item {
            CinnaCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("最近账单", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = onRecords) { Text("全部") }
                }
                val recent = monthRecords.take(5)
                if (recent.isEmpty()) {
                    EmptyState("还没有账单", "点击上方按钮开始记录第一笔。")
                } else {
                    recent.forEach { RecordRow(it) }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecordEditorScreen(
    state: BookkeepingState,
    repository: BookkeepingRepository,
    record: BookkeepingRecord?,
    initialKind: RecordKind,
    onSaved: () -> Unit
) {
    var kind by remember(record?.id, initialKind) { mutableStateOf(record?.kind ?: initialKind) }
    var amountText by remember(record?.id) { mutableStateOf(record?.amount?.moneyText().orEmpty()) }
    var category by remember(record?.id, kind) { mutableStateOf(record?.category ?: CategoryCatalog.categories(kind).first().name) }
    var note by remember(record?.id) { mutableStateOf(record?.note.orEmpty()) }
    var dateText by remember(record?.id) { mutableStateOf(record?.date?.toString() ?: LocalDate.now().toString()) }
    val amount = amountText.toDoubleOrNull()?.moneyRound() ?: 0.0
    val parsedDate = runCatching { LocalDate.parse(dateText) }.getOrNull()
    val duplicates = if (amount > 0 && parsedDate != null) {
        BookkeepingAnalytics.duplicateCandidates(kind, category, amount, parsedDate, state.records, record?.id)
    } else {
        emptyList()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { ScreenTitle(if (record == null) "记一笔" else "编辑账单") }
        item {
            CinnaCard {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KindChip(RecordKind.EXPENSE, kind == RecordKind.EXPENSE) {
                        kind = RecordKind.EXPENSE
                        category = CategoryCatalog.expenses.first().name
                    }
                    KindChip(RecordKind.INCOME, kind == RecordKind.INCOME) {
                        kind = RecordKind.INCOME
                        category = CategoryCatalog.incomes.first().name
                    }
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = sanitizeMoneyText(it) },
                    label = { Text("金额") },
                    prefix = { Text("¥") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
        item {
            CinnaCard {
                Text("分类", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CategoryCatalog.categories(kind).forEach { item ->
                        FilterChip(
                            selected = category == item.name,
                            onClick = { category = item.name },
                            label = { Text("${item.emoji} ${item.name}") }
                        )
                    }
                }
            }
        }
        item {
            CinnaCard {
                OutlinedTextField(
                    value = dateText,
                    onValueChange = { dateText = it.take(10) },
                    label = { Text("日期 yyyy-MM-dd") },
                    isError = parsedDate == null,
                    supportingText = {
                        if (parsedDate == null) {
                            Text("请输入有效日期，例如 2026-06-15")
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(value = note, onValueChange = { note = it.take(40) }, label = { Text("备注") }, modifier = Modifier.fillMaxWidth())
            }
        }
        if (duplicates.isNotEmpty()) {
            item {
                CinnaCard {
                    Text("可能重复", fontWeight = FontWeight.Bold)
                    duplicates.take(3).forEach { RecordRow(it) }
                }
            }
        }
        item {
            Button(
                enabled = amount > 0 && parsedDate != null,
                onClick = {
                    val next = BookkeepingRecord(
                        id = record?.id ?: java.util.UUID.randomUUID().toString(),
                        kind = kind,
                        amount = amount,
                        category = category,
                        note = note.trim(),
                        date = parsedDate ?: LocalDate.now(),
                        createdAt = record?.createdAt ?: System.currentTimeMillis(),
                        updatedAt = System.currentTimeMillis()
                    )
                    if (record == null) repository.add(next) else repository.update(next)
                    onSaved()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (record == null) "保存" else "保存修改")
            }
        }
    }
}

@Composable
private fun RecordsScreen(
    state: BookkeepingState,
    repository: BookkeepingRepository,
    onEdit: (BookkeepingRecord) -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf<RecordKind?>(null) }
    val records = remember(state.records, state.selectedMonth, query, filter) {
        BookkeepingAnalytics.recordsIn(state.selectedMonth, state.records)
            .filter { filter == null || it.kind == filter }
            .filter { query.isBlank() || it.searchableText.contains(query.trim().lowercase()) }
    }
    val groups = remember(records) { BookkeepingAnalytics.groupedByDay(records) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { ScreenTitle("账单") }
        item { MonthStepper(state.selectedMonth, repository::selectMonth) }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("搜索分类、金额、备注") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = filter == null, onClick = { filter = null }, label = { Text("全部") })
                FilterChip(selected = filter == RecordKind.EXPENSE, onClick = { filter = RecordKind.EXPENSE }, label = { Text("支出") })
                FilterChip(selected = filter == RecordKind.INCOME, onClick = { filter = RecordKind.INCOME }, label = { Text("收入") })
            }
        }
        if (groups.isEmpty()) {
            item { CinnaCard { EmptyState("没有匹配账单", "换一个月份、类型或关键词试试。") } }
        } else {
            items(groups, key = { it.date.toString() }) { group ->
                CinnaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(group.date.toString(), fontWeight = FontWeight.Bold)
                        Spacer(Modifier.weight(1f))
                        Text("+¥${group.summary.income.moneyText()} / -¥${group.summary.expense.moneyText()}", color = CinnaPalette.Muted, fontSize = 12.sp)
                    }
                    group.records.forEach { record ->
                        RecordRow(
                            record = record,
                            trailing = {
                                TextButton(onClick = { onEdit(record) }) { Text("编辑") }
                                TextButton(onClick = { repository.delete(record) }) { Text("删除", color = CinnaPalette.Pink) }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatsScreen(state: BookkeepingState, repository: BookkeepingRepository) {
    var kind by rememberSaveable { mutableStateOf(RecordKind.EXPENSE) }
    val monthRecords = remember(state.records, state.selectedMonth) {
        BookkeepingAnalytics.recordsIn(state.selectedMonth, state.records)
    }
    val summary = remember(monthRecords) { BookkeepingAnalytics.summary(monthRecords) }
    val breakdown = remember(monthRecords, kind) { BookkeepingAnalytics.categoryBreakdown(monthRecords, kind) }
    val trend = remember(state.records, state.selectedMonth) {
        BookkeepingAnalytics.recentTrend(state.records, state.selectedMonth)
    }
    val heat = remember(state.records, state.selectedMonth, kind) {
        BookkeepingAnalytics.dailyHeat(state.records, state.selectedMonth, kind)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { ScreenTitle("统计") }
        item { MonthStepper(state.selectedMonth, repository::selectMonth) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KindChip(RecordKind.EXPENSE, kind == RecordKind.EXPENSE) { kind = RecordKind.EXPENSE }
                KindChip(RecordKind.INCOME, kind == RecordKind.INCOME) { kind = RecordKind.INCOME }
            }
        }
        item {
            CinnaCard {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    MetricTile("收入", summary.income, RecordKind.INCOME, Modifier.weight(1f))
                    MetricTile("支出", summary.expense, RecordKind.EXPENSE, Modifier.weight(1f))
                }
            }
        }
        item {
            CinnaCard {
                Text("${kind.title}构成", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                if (breakdown.isEmpty()) EmptyState("暂无统计", "记录后会自动生成分类占比。")
                breakdown.forEach { CategoryBar(it, kind) }
            }
        }
        item {
            CinnaCard {
                Text("近 6 个月趋势", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(12.dp))
                if (trend.all { it.income == 0.0 && it.expense == 0.0 }) {
                    EmptyState("暂无趋势", "连续记录几笔后，这里会展示收支变化。")
                } else {
                    TrendChart(trend)
                }
            }
        }
        item {
            CinnaCard {
                Text("每日${kind.title}热力", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(12.dp))
                HeatGrid(heat)
            }
        }
    }
}

@Composable
private fun ProfileScreen(state: BookkeepingState, repository: BookkeepingRepository) {
    var budgetText by remember(state.selectedMonth) { mutableStateOf(state.monthlyBudgets[state.selectedMonth.compact]?.moneyText().orEmpty()) }
    val summary = remember(state.records) { BookkeepingAnalytics.summary(state.records) }
    val clipboard = LocalClipboardManager.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { ScreenTitle("设置") }
        item { MonthStepper(state.selectedMonth, repository::selectMonth) }
        item {
            CinnaCard {
                Text("月度预算", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = budgetText,
                        onValueChange = { budgetText = sanitizeMoneyText(it) },
                        label = { Text("预算金额") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f)
                    )
                    Button(onClick = { repository.setBudget(state.selectedMonth, budgetText.toDoubleOrNull() ?: 0.0) }) {
                        Text("保存")
                    }
                }
            }
        }
        item {
            CinnaCard {
                Text("数据概览", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    MetricTile("总收入", summary.income, RecordKind.INCOME, Modifier.weight(1f))
                    MetricTile("总支出", summary.expense, RecordKind.EXPENSE, Modifier.weight(1f))
                }
                Spacer(Modifier.height(8.dp))
                Text("共 ${state.records.size} 笔记录，数据仅保存在本机。", color = CinnaPalette.Muted, fontSize = 13.sp)
            }
        }
        item {
            OutlinedButton(
                onClick = { clipboard.setText(AnnotatedString(repository.csv(state.records))) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("复制 CSV")
            }
        }
        item {
            CinnaCard {
                Text("架构说明", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    "iOS 与 Android 使用同一套领域概念：RecordKind、MonthKey、Category、Budget、Summary、Trend。展示可以保留原生差异，但统计口径和页面信息层级保持一致。",
                    color = CinnaPalette.Ink,
                    lineHeight = 20.sp
                )
            }
        }
    }
}

@Composable
private fun ScreenTitle(title: String) {
    Text(title, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = CinnaPalette.Ink)
}

@Composable
private fun MonthStepper(month: MonthKey, onMonthChange: (MonthKey) -> Unit) {
    val current = MonthKey.now()
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        TextButton(onClick = { onMonthChange(month.plusMonths(-1)) }) { Text("‹", fontSize = 28.sp) }
        Text(month.label, fontWeight = FontWeight.Bold, color = CinnaPalette.Ink, modifier = Modifier.width(132.dp))
        TextButton(enabled = month < current, onClick = { onMonthChange(month.plusMonths(1)) }) { Text("›", fontSize = 28.sp) }
    }
}

@Composable
private fun CinnaCard(content: @Composable Column.() -> Unit) {
    ElevatedCard(
        colors = CardDefaults.elevatedCardColors(containerColor = CinnaPalette.Card),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
private fun MetricTile(title: String, amount: Double, kind: RecordKind?, modifier: Modifier = Modifier) {
    val color = when (kind) {
        RecordKind.INCOME -> CinnaPalette.Mint
        RecordKind.EXPENSE -> CinnaPalette.Pink
        null -> if (amount >= 0) CinnaPalette.Sky else CinnaPalette.Pink
    }
    Column(modifier = modifier) {
        Text(title, color = CinnaPalette.Muted, fontSize = 12.sp)
        Text(
            "${kind?.sign.orEmpty()}¥${amount.moneyText()}",
            color = color,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun BudgetProgress(expense: Double, budget: Double) {
    Text(if (budget > 0) "本月预算" else "未设置预算", fontWeight = FontWeight.Bold, fontSize = 18.sp)
    Spacer(Modifier.height(8.dp))
    Text(if (budget > 0) "¥${expense.moneyText()} / ¥${budget.moneyText()}" else "设置后可跟踪剩余额度", color = CinnaPalette.Muted, fontSize = 13.sp)
    Spacer(Modifier.height(10.dp))
    LinearProgressIndicator(
        progress = { if (budget > 0) (expense / max(budget, 1.0)).toFloat().coerceIn(0f, 1f) else 0f },
        modifier = Modifier
            .fillMaxWidth()
            .height(10.dp)
            .clip(RoundedCornerShape(8.dp)),
        color = if (budget > 0 && expense > budget) CinnaPalette.Pink else CinnaPalette.Sky,
        trackColor = CinnaPalette.SkySoft
    )
    if (budget > 0) {
        val remain = (budget - expense).moneyRound()
        Spacer(Modifier.height(8.dp))
        Text(
            if (remain >= 0) "还剩 ¥${remain.moneyText()}" else "已超出 ¥${(-remain).moneyText()}",
            color = if (remain >= 0) CinnaPalette.Sky else CinnaPalette.Pink,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun KindChip(kind: RecordKind, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(kind.title) }
    )
}

@Composable
private fun RecordRow(record: BookkeepingRecord, trailing: @Composable Row.() -> Unit = {}) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (record.kind == RecordKind.INCOME) CinnaPalette.SkySoft else CinnaPalette.PinkSoft),
            contentAlignment = Alignment.Center
        ) {
            Text(CategoryCatalog.emoji(record.category), fontSize = 22.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(record.category, fontWeight = FontWeight.SemiBold, color = CinnaPalette.Ink)
            Text(record.note.ifBlank { record.date.toString() }, color = CinnaPalette.Muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(
            "${record.kind.sign}¥${record.amount.moneyText()}",
            color = if (record.kind == RecordKind.INCOME) CinnaPalette.Mint else CinnaPalette.Pink,
            fontWeight = FontWeight.Bold
        )
        Row(content = trailing)
    }
}

@Composable
private fun EmptyState(title: String, subtitle: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, fontWeight = FontWeight.Bold, color = CinnaPalette.Ink)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, color = CinnaPalette.Muted, fontSize = 13.sp)
    }
}

private fun sanitizeMoneyText(value: String, integerLimit: Int = 8): String {
    val normalized = value.replace(',', '.')
    val result = StringBuilder()
    var hasDot = false
    var integerCount = 0
    var fractionCount = 0

    normalized.forEach { char ->
        when {
            char.isDigit() && hasDot && fractionCount < 2 -> {
                result.append(char)
                fractionCount += 1
            }
            char.isDigit() && !hasDot && integerCount < integerLimit -> {
                if (result.toString() == "0" && char != '0') {
                    result.clear()
                    result.append(char)
                    integerCount = 1
                } else if (result.toString() != "0" || char != '0') {
                    result.append(char)
                    integerCount = result.length
                } else if (result.isEmpty()) {
                    result.append('0')
                    integerCount = 1
                }
            }
            char == '.' && !hasDot -> {
                if (result.isEmpty()) {
                    result.append('0')
                    integerCount = 1
                }
                result.append('.')
                hasDot = true
            }
        }
    }

    return result.toString()
}

@Composable
private fun CategoryBar(item: CategoryBreakdown, kind: RecordKind) {
    Column(modifier = Modifier.padding(vertical = 8.dp)) {
        Row {
            Text("${item.emoji} ${item.category}", fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Text("¥${item.amount.moneyText()}", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(6.dp))
        LinearProgressIndicator(
            progress = { item.percent.toFloat().coerceIn(0f, 1f) },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(8.dp)),
            color = if (kind == RecordKind.INCOME) CinnaPalette.Mint else CinnaPalette.Pink,
            trackColor = CinnaPalette.SkySoft
        )
        Spacer(Modifier.height(4.dp))
        Text("${(item.percent * 100).toInt()}% · ${item.count} 笔", color = CinnaPalette.Muted, fontSize = 12.sp)
    }
}

@Composable
private fun TrendChart(points: List<TrendPoint>) {
    val maxValue = max(1.0, points.maxOfOrNull { max(it.income, it.expense) } ?: 1.0)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(170.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        points.forEach { point ->
            Column(
                modifier = Modifier.weight(1f).fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom
            ) {
                Row(
                    modifier = Modifier.height(128.dp),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(8.dp)
                            .height((120 * point.expense / maxValue).dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(CinnaPalette.Pink)
                    )
                    Box(
                        modifier = Modifier
                            .width(8.dp)
                            .height((120 * point.income / maxValue).dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(CinnaPalette.Mint)
                    )
                }
                Text("${point.month.month}月", color = CinnaPalette.Muted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun HeatGrid(points: List<DailyHeatPoint>) {
    val weekdays = listOf("日", "一", "二", "三", "四", "五", "六")
    val leadingBlankCount = points.firstOrNull()?.date?.dayOfWeek?.value?.rem(7) ?: 0

    Column {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            weekdays.forEach { weekday ->
                Text(
                    weekday,
                    color = CinnaPalette.Muted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            modifier = Modifier.height(204.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            userScrollEnabled = false
        ) {
            items(leadingBlankCount) {
                Spacer(Modifier.height(28.dp))
            }
            items(points, key = { it.date.toString() }) { point ->
                Box(
                    modifier = Modifier
                        .height(28.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(heatColor(point.level)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(point.date.dayOfMonth.toString(), fontSize = 11.sp, color = if (point.level >= 3) Color.White else CinnaPalette.Ink)
                }
            }
        }
    }
}

private fun heatColor(level: Int): Color =
    when (level) {
        1 -> CinnaPalette.SkySoft
        2 -> Color(0xFF9ED4EA)
        3 -> CinnaPalette.Sky
        4 -> Color(0xFF267B99)
        else -> Color(0xFFF0F5F8)
    }
