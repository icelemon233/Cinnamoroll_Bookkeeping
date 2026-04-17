/**
 * utils/storage.js - Supabase 云端数据操作
 *
 * ══════════════════════════════════════════════
 *  用户需要在 Supabase 控制台执行以下 SQL 建表：
 * ══════════════════════════════════════════════
 *
 * create table records (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users(id) on delete cascade not null,
 *   type text not null check (type in ('income', 'expense')),
 *   amount numeric(10,2) not null,
 *   category text not null,
 *   note text default '',
 *   date text not null,
 *   created_at timestamptz default now()
 * );
 *
 * -- 开启 RLS（行级安全）
 * alter table records enable row level security;
 *
 * -- 用户只能访问自己的记录
 * create policy "Users can only access their own records"
 *   on records for all
 *   using (auth.uid() = user_id)
 *   with check (auth.uid() = user_id);
 */

import { supabase } from './supabase.js'

// ─── 记录 CRUD ────────────────────────────────────────────────

/**
 * 获取当前用户所有记录（按日期倒序）
 * @returns {Promise<Array>}
 */
export async function getRecords() {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[storage] getRecords error:', error.message)
    return []
  }
  return data || []
}

/**
 * 添加一条记录
 * @param {{ type: string, amount: number, category: string, note: string, date: string }} record
 * @returns {Promise<Object|null>} 新增的记录（含 id）
 */
export async function addRecord(record) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  const { data, error } = await supabase
    .from('records')
    .insert({
      user_id: user.id,
      type: record.type,
      amount: record.amount,
      category: record.category,
      note: record.note || '',
      date: record.date
    })
    .select()
    .single()

  if (error) {
    console.error('[storage] addRecord error:', error.message)
    throw error
  }
  return data
}

/**
 * 更新一条记录
 * @param {string} id - record uuid
 * @param {Object} data - 要更新的字段
 * @returns {Promise<Object|null>}
 */
export async function updateRecord(id, data) {
  const { data: updated, error } = await supabase
    .from('records')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[storage] updateRecord error:', error.message)
    throw error
  }
  return updated
}

/**
 * 根据 id 获取单条记录（兼容旧版 getRecordById 调用）
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getRecordById(id) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

/**
 * 删除一条记录
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteRecord(id) {
  const { error } = await supabase
    .from('records')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[storage] deleteRecord error:', error.message)
    throw error
  }
}

// ─── 汇总 / 工具函数 ──────────────────────────────────────────

/**
 * 获取某月汇总
 * @param {string} yearMonth - 'YYYY-MM'，默认当前月
 * @returns {Promise<{ income: number, expense: number, net: number, records: Array }>}
 */
export async function getMonthSummary(yearMonth) {
  if (!yearMonth) {
    const now = new Date()
    const m = now.getMonth() + 1
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`
  }

  const { data, error } = await supabase
    .from('records')
    .select('*')
    .like('date', `${yearMonth}%`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[storage] getMonthSummary error:', error.message)
    return { income: 0, expense: 0, net: 0, records: [] }
  }

  const monthRecords = data || []
  let income = 0
  let expense = 0
  monthRecords.forEach(r => {
    if (r.type === 'income') income += Number(r.amount) || 0
    else expense += Number(r.amount) || 0
  })

  return {
    income: parseFloat(income.toFixed(2)),
    expense: parseFloat(expense.toFixed(2)),
    net: parseFloat((income - expense).toFixed(2)),
    records: monthRecords
  }
}

// ─── 预算（本地 storage，不需要云端）────────────────────────────

const BUDGET_KEY = 'monthly_budgets'

/**
 * 获取指定月份的预算金额
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {number}
 */
export function getMonthBudget(yearMonth) {
  if (!yearMonth) {
    const now = new Date()
    const m = now.getMonth() + 1
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`
  }
  try {
    const budgets = uni.getStorageSync(BUDGET_KEY) || {}
    return Number(budgets[yearMonth]) || 0
  } catch (e) {
    return 0
  }
}

/**
 * 设置指定月份的预算金额
 * @param {string} yearMonth - 'YYYY-MM'
 * @param {number} amount
 */
export function setMonthBudget(yearMonth, amount) {
  try {
    const budgets = uni.getStorageSync(BUDGET_KEY) || {}
    if (!amount || amount <= 0) {
      delete budgets[yearMonth]
    } else {
      budgets[yearMonth] = parseFloat(Number(amount).toFixed(2))
    }
    uni.setStorageSync(BUDGET_KEY, budgets)
  } catch (e) {
    console.error('[storage] setMonthBudget error:', e)
  }
}

// ─── 多月趋势数据 ─────────────────────────────────────────────

/**
 * 获取最近 N 个月的收支汇总（用于趋势图）
 * @param {number} months - 月份数，默认 6
 * @returns {Promise<Array<{ yearMonth: string, label: string, income: number, expense: number }>>}
 */
export async function getRecentMonthsTrend(months = 6) {
  const now = new Date()
  const result = []

  // 生成最近 N 个月的 yearMonth 列表（从远到近）
  const targets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getMonth() + 1}月`
    targets.push({ yearMonth: ym, label })
  }

  // 构造日期范围：最早月份的1日 到 当前月末
  const startYM = targets[0].yearMonth
  const startDate = `${startYM}-01`
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1
  const endDay = new Date(endYear, endMonth, 0).getDate()
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('records')
    .select('type, amount, date')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('[storage] getRecentMonthsTrend error:', error.message)
    // 返回全零数据
    return targets.map(t => ({ ...t, income: 0, expense: 0 }))
  }

  // 按月聚合
  const monthMap = {}
  targets.forEach(t => { monthMap[t.yearMonth] = { income: 0, expense: 0 } })
  ;(data || []).forEach(r => {
    const ym = r.date ? r.date.slice(0, 7) : null
    if (!ym || !monthMap[ym]) return
    if (r.type === 'income') monthMap[ym].income += Number(r.amount) || 0
    else monthMap[ym].expense += Number(r.amount) || 0
  })

  return targets.map(t => ({
    yearMonth: t.yearMonth,
    label: t.label,
    income: parseFloat((monthMap[t.yearMonth].income).toFixed(2)),
    expense: parseFloat((monthMap[t.yearMonth].expense).toFixed(2))
  }))
}

// ─── 纯工具函数（同步） ───────────────────────────────────────

/**
 * 按日期分组账单
 * @param {Array} records
 * @returns {Array} [{ date, records }, ...]
 */
export function groupByDate(records) {
  const map = {}
  records.forEach(r => {
    const key = r.date || '未知日期'
    if (!map[key]) map[key] = []
    map[key].push(r)
  })
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({ date, records: map[date] }))
}

/**
 * 格式化日期显示
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} '今天' | '昨天' | '04月10日'
 */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (dateStr === todayStr) return '今天'
  if (dateStr === yesterdayStr) return '昨天'
  const parts = dateStr.split('-')
  return `${parts[1]}月${parts[2]}日`
}

// ─── 兼容旧版（saveRecord -> addRecord 别名）────────────────────

/**
 * @deprecated 使用 addRecord / updateRecord 代替
 */
export async function saveRecord(record) {
  // 若有 id 则为更新，否则为新增
  if (record.id) {
    const { id, ...data } = record
    return updateRecord(id, data)
  }
  return addRecord(record)
}

// ─── 全量统计 ────────────────────────────────────────────────

/**
 * 获取当前用户的全量记账统计（用于个人中心展示）
 * @returns {Promise<{ totalCount: number, totalIncome: number, totalExpense: number, recordDays: number, firstDate: string|null }>}
 */
export async function getAllTimeSummary() {
  const { data, error } = await supabase
    .from('records')
    .select('type, amount, date')
    .order('date', { ascending: true })

  if (error) {
    console.error('[storage] getAllTimeSummary error:', error.message)
    return { totalCount: 0, totalIncome: 0, totalExpense: 0, recordDays: 0, firstDate: null }
  }

  const records = data || []
  let totalIncome = 0
  let totalExpense = 0
  const dateSet = new Set()

  records.forEach(r => {
    if (r.type === 'income') totalIncome += Number(r.amount) || 0
    else totalExpense += Number(r.amount) || 0
    if (r.date) dateSet.add(r.date)
  })

  return {
    totalCount: records.length,
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    totalExpense: parseFloat(totalExpense.toFixed(2)),
    recordDays: dateSet.size,
    firstDate: records.length > 0 ? records[0].date : null
  }
}

// ─── 导出功能 ───────────────────────────────────────────────

/**
 * 导出账单为 CSV 格式
 * @param {Array} records - 账单记录数组
 * @returns {string} CSV 字符串
 */
export function exportToCSV(records) {
  const headers = ['日期', '类型', '分类', '金额', '备注']
  const rows = records.map(r => [
    r.date || '',
    r.type === 'income' ? '收入' : '支出',
    r.category || '',
    r.amount || '0',
    r.note || ''
  ])
  
  // 处理备注中的特殊字符
  const escapeCSV = (str) => {
    if (!str) return ''
    const s = String(str)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')
  
  return '\uFEFF' + csvContent // BOM for Excel
}

/**
 * 下载 CSV 文件
 * @param {string} csvContent
 * @param {string} filename
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
