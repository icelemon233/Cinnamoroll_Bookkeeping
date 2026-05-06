<template>
  <view class="container">
    <!-- 月份切换栏 -->
    <view class="month-nav">
      <view class="month-arrow" @tap="prevMonth">
        <text class="arrow-text">‹</text>
      </view>
      <text class="month-title">{{ currentMonth }} 统计</text>
      <view :class="['month-arrow', isCurrentMonth ? 'arrow-disabled' : '']" @tap="nextMonth">
        <text class="arrow-text">›</text>
      </view>
    </view>

    <!-- 收支概览卡片（带渐变） -->
    <view class="overview-card">
      <view class="overview-bg"></view>
      <view class="overview-content">
        <view class="overview-row">
          <view class="overview-item" @tap="switchTo('expense')">
            <text class="overview-label">本月支出</text>
            <text class="overview-amount expense-amt">¥{{ monthExpense }}</text>
            <view :class="['overview-indicator', statsType === 'expense' ? 'indicator-active-expense' : '']"></view>
          </view>
          <view class="overview-divider"></view>
          <view class="overview-item" @tap="switchTo('income')">
            <text class="overview-label">本月收入</text>
            <text class="overview-amount income-amt">¥{{ monthIncome }}</text>
            <view :class="['overview-indicator', statsType === 'income' ? 'indicator-active-income' : '']"></view>
          </view>
        </view>
        <!-- 结余 -->
        <view class="balance-row">
          <text class="balance-label">结余</text>
          <text :class="['balance-amount', balanceAmount >= 0 ? 'income-amt' : 'expense-amt']">
            {{ balanceAmount >= 0 ? '+' : '' }}¥{{ Math.abs(balanceAmount) }}
          </text>
        </view>
      </view>
    </view>

    <!-- 收支切换 Tab -->
    <view :class="['type-switcher', switchLocked ? 'switcher-locked' : '']">
      <!-- 滑动果冻背景 -->
      <view class="switcher-bg" :class="statsType === 'income' ? 'bg-right bg-income' : 'bg-left bg-expense'"></view>
      <view :class="['type-btn', statsType === 'expense' ? 'active-expense' : '', switching && switchTarget === 'expense' ? 'jelly-pop' : '', switchLocked && statsType !== 'expense' ? 'btn-disabled' : '']"
        @tap="handleSwitch('expense')">
        <text class="type-icon">💸</text>
        <text class="type-label">支出</text>
      </view>
      <view :class="['type-btn', statsType === 'income' ? 'active-income' : '', switching && switchTarget === 'income' ? 'jelly-pop' : '', switchLocked && statsType !== 'income' ? 'btn-disabled' : '']"
        @tap="handleSwitch('income')">
        <text class="type-icon">💰</text>
        <text class="type-label">收入</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="isEmpty && !loading" class="empty-state">
      <view class="empty-illustration">
        <text class="empty-emoji">🌸</text>
        <view class="empty-circle c1"></view>
        <view class="empty-circle c2"></view>
        <view class="empty-circle c3"></view>
      </view>
      <text class="empty-text">{{ currentMonth }}暂无{{ statsType === 'expense' ? '支出' : '收入' }}记录</text>
      <text class="empty-sub">快去记一笔吧~</text>
    </view>

    <!-- 饼图 + 分类明细 -->
    <view v-if="!isEmpty">
      <!-- 饼图卡片 -->
      <view class="chart-card">
        <view class="chart-card-header">
          <text class="chart-card-title">{{ statsType === 'expense' ? '支出' : '收入' }}构成</text>
          <text class="chart-card-badge">{{ categoryList.length }}个分类</text>
        </view>
        <view class="pie-wrap">
          <!-- 纯 CSS 环形图，完全融入页面 DOM，零延迟 -->
          <view class="css-donut" :style="donutStyle">
            <view class="donut-hole">
              <text class="donut-amount" :style="{ color: statsType === 'expense' ? '#FF8BAB' : '#4FB8D4' }">¥{{ statsType === 'expense' ? monthExpense : monthIncome }}</text>
              <text class="donut-sub">总{{ statsType === 'expense' ? '支出' : '收入' }}</text>
            </view>
          </view>
          <!-- 图例 -->
          <view class="donut-legend">
            <view class="donut-legend-item" v-for="item in categoryList" :key="item.category">
              <view class="legend-dot-color" :style="{ background: item.color }"></view>
              <text class="legend-cat-name">{{ item.emoji }} {{ item.category }}</text>
              <text class="legend-cat-pct">{{ item.percent }}%</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 分类列表 -->
      <view class="category-card">
        <text class="section-title">分类明细</text>
        <view class="category-row" v-for="(item, idx) in categoryList" :key="item.category">
          <view class="cat-rank" :style="{ background: item.color }">
            <text class="cat-rank-num">{{ idx + 1 }}</text>
          </view>
          <view class="cat-main">
            <view class="cat-top">
              <text class="cat-name">{{ item.emoji }} {{ item.category }}</text>
              <text class="cat-amount">¥{{ item.amount }}</text>
            </view>
            <view class="cat-bottom">
              <view class="progress-track">
                <view class="progress-fill" :style="{ width: item.percent + '%', background: `linear-gradient(90deg, ${item.color}, ${item.colorLight})` }"></view>
              </view>
              <text class="cat-percent">{{ item.percent }}%</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 近6个月趋势 -->
    <view class="trend-card">
      <view class="trend-header">
        <text class="section-title">近6个月趋势</text>
        <view class="trend-legend">
          <view class="legend-item">
            <view class="legend-line expense-line"></view>
            <text class="legend-text">支出</text>
          </view>
          <view class="legend-item">
            <view class="legend-line income-line"></view>
            <text class="legend-text">收入</text>
          </view>
        </view>
      </view>
      <view v-if="trendLoading" class="chart-placeholder">
        <text class="placeholder-text">加载中...</text>
      </view>
      <view v-else-if="isTrendEmpty" class="chart-placeholder">
        <text class="placeholder-emoji">📈</text>
        <text class="placeholder-text">暂无历史数据</text>
      </view>
      <view v-else class="svg-trend-wrap">
        <!-- Y 轴标签 -->
        <view class="y-axis">
          <text class="y-label" v-for="label in trendYLabels" :key="label">{{ label }}</text>
        </view>
        <!-- SVG 图表区 -->
        <view class="svg-chart-area">
          <!-- 网格线 -->
          <svg class="svg-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line v-for="y in [0, 25, 50, 75, 100]" :key="'g'+y" x1="0" :y1="y" x2="100" :y2="y" stroke="rgba(79,184,212,0.08)" stroke-width="0.5" stroke-dasharray="2,2" vector-effect="non-scaling-stroke" />
          </svg>
          <!-- 面积 + 折线 -->
          <svg class="svg-lines" :viewBox="`0 0 ${trendSvgWidth} ${trendSvgHeight}`" preserveAspectRatio="none">
            <!-- 支出面积 -->
            <path :d="expenseAreaPath" fill="url(#expenseGrad)" />
            <!-- 收入面积 -->
            <path :d="incomeAreaPath" fill="url(#incomeGrad)" />
            <!-- 支出折线 -->
            <polyline :points="expensePolyline" fill="none" stroke="#FF8BAB" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            <!-- 收入折线 -->
            <polyline :points="incomePolyline" fill="none" stroke="#4FB8D4" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            <defs>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(255,139,171,0.25)" />
                <stop offset="100%" stop-color="rgba(255,139,171,0.02)" />
              </linearGradient>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(79,184,212,0.25)" />
                <stop offset="100%" stop-color="rgba(79,184,212,0.02)" />
              </linearGradient>
            </defs>
          </svg>
          <!-- 数据点 -->
          <view class="svg-dots">
            <view v-for="(pt, i) in expenseDots" :key="'e'+i" class="dot expense-dot" :style="{ left: pt.x + '%', top: pt.y + '%' }" @tap="onDotTap(trendData[i], 'expense')"></view>
            <view v-for="(pt, i) in incomeDots" :key="'i'+i" class="dot income-dot" :style="{ left: pt.x + '%', top: pt.y + '%' }" @tap="onDotTap(trendData[i], 'income')"></view>
          </view>
          <!-- X 轴标签 -->
          <view class="x-axis">
            <text class="x-label" v-for="d in trendData" :key="d.label">{{ d.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 每日消费热力图 -->
    <view class="heatmap-card">
      <view class="heatmap-header">
        <text class="section-title">每日{{ statsType === 'expense' ? '消费' : '收入' }}热力</text>
        <view class="heatmap-legend-row">
          <text class="legend-label-sm">少</text>
          <view class="legend-dot" v-for="lv in heatLevels" :key="lv.level" :style="{ background: lv.color }"></view>
          <text class="legend-label-sm">多</text>
        </view>
      </view>
      <!-- 星期标签 -->
      <view class="weekday-row">
        <text class="weekday-label" v-for="wd in weekdays" :key="wd">{{ wd }}</text>
      </view>
      <!-- 日历格子 -->
      <view class="heatmap-grid">
        <view class="heatmap-cell empty-cell" v-for="n in firstWeekdayOffset" :key="'empty-' + n"></view>
        <view v-for="day in dailyCells" :key="day.date"
          :class="['heatmap-cell', 'day-cell', day.isToday ? 'today-cell' : '', day.level > 0 ? 'has-data' : '']"
          :style="{ background: day.bg }"
          @tap="onDayCellTap(day)">
          <text class="day-num" :style="{ color: day.level >= 3 ? '#fff' : '#3D5A6E' }">{{ day.dayNum }}</text>
          <text v-if="day.amount > 0" class="day-amount"
            :style="{ color: day.level >= 3 ? 'rgba(255,255,255,0.85)' : '#9BAAB8' }">
            {{ day.amountShort }}
          </text>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
import { getMonthSummary, getRecentMonthsTrend } from '../../utils/storage.js'

const COLORS = [
  '#FF8BAB', '#4FB8D4', '#FFD166', '#A78BFA',
  '#34D399', '#F97316', '#60A5FA', '#F472B6'
]

const COLORS_LIGHT = [
  '#FFB8CC', '#7ED4E8', '#FFE299', '#C4B5FD',
  '#6EE7B7', '#FDBA74', '#93C5FD', '#F9A8D4'
]

const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
}

export default {
  name: 'StatsPage',
  data() {
    return {
      yearMonth: '',
      currentMonth: '',
      isCurrentMonth: true,
      monthIncome: 0,
      monthExpense: 0,
      statsType: 'expense',
      categoryList: [],
      isEmpty: true,
      loading: true,
      switching: false,
      switchTarget: '',
      switchLocked: false,
      // 每日热力图
      dailyCells: [],
      firstWeekdayOffset: 0,
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      heatLevels: [
        { level: 0, color: '#EEF8FB' },
        { level: 1, color: '#B8E0FF' },
        { level: 2, color: '#7EC8E3' },
        { level: 3, color: '#4FB8D4' },
        { level: 4, color: '#2A8FAD' }
      ],
      // 趋势图
      trendData: [],
      trendLoading: true,
      isTrendEmpty: false,
      // SVG 趋势图
      trendSvgWidth: 500,
      trendSvgHeight: 200
    }
  },

  computed: {
    balanceAmount() {
      return parseFloat((this.monthIncome - this.monthExpense).toFixed(2))
    },
    donutStyle() {
      if (!this.categoryList.length) return {}
      const total = this.categoryList.reduce((s, c) => s + c.amount, 0)
      if (total === 0) return {}
      let acc = 0
      const stops = []
      this.categoryList.forEach((item, i) => {
        const start = acc
        acc += (item.amount / total) * 360
        stops.push(`${item.color} ${start}deg ${acc}deg`)
      })
      return {
        background: `conic-gradient(${stops.join(', ')})`
      }
    },
    /* ─── SVG 趋势图计算 ─── */
    trendMax() {
      if (!this.trendData.length) return 1
      let mx = 0
      this.trendData.forEach(d => {
        if (d.expense > mx) mx = d.expense
        if (d.income > mx) mx = d.income
      })
      return mx || 1
    },
    trendYLabels() {
      const mx = this.trendMax
      const step = mx / 4
      const labels = []
      for (let i = 4; i >= 0; i--) {
        const v = step * i
        labels.push(v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))
      }
      return labels
    },
    // 百分比坐标点
    expensePts() {
      return this._trendToPct('expense')
    },
    incomePts() {
      return this._trendToPct('income')
    },
    // polyline points
    expensePolyline() {
      return this.expensePts.map(p => `${p.svgX},${p.svgY}`).join(' ')
    },
    incomePolyline() {
      return this.incomePts.map(p => `${p.svgX},${p.svgY}`).join(' ')
    },
    // area path
    expenseAreaPath() {
      return this._areaPath(this.expensePts)
    },
    incomeAreaPath() {
      return this._areaPath(this.incomePts)
    },
    // CSS dots
    expenseDots() {
      return this.expensePts.map(p => ({ x: p.pctX, y: p.pctY }))
    },
    incomeDots() {
      return this.incomePts.map(p => ({ x: p.pctX, y: p.pctY }))
    }
  },

  mounted() {
    this._initMonth()
    this.loadStats()
    this.loadTrend()
  },

  async onShow() {
    if (this.yearMonth) {
      await this.loadStats()
      if (!this.trendData.length || this.isCurrentMonth) {
        await this.loadTrend()
      }
    }
  },

  // 首次加载标记
  _statsLoadedOnce: false,

  methods: {
    _initMonth() {
      const now = new Date()
      const year = now.getFullYear()
      const m = now.getMonth() + 1
      this.yearMonth = `${year}-${m < 10 ? '0' + m : m}`
      this.currentMonth = `${year}年${m < 10 ? '0' + m : m}月`
      this.isCurrentMonth = true
    },


    prevMonth() {
      const [year, m] = this.yearMonth.split('-').map(Number)
      let newYear = year
      let newMonth = m - 1
      if (newMonth < 1) { newMonth = 12; newYear -= 1 }
      const yearMonth = `${newYear}-${newMonth < 10 ? '0' + newMonth : newMonth}`
      const currentMonth = `${newYear}年${newMonth < 10 ? '0' + newMonth : newMonth}月`
      const now = new Date()
      const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      this.yearMonth = yearMonth
      this.currentMonth = currentMonth
      this.isCurrentMonth = yearMonth === nowYM
      this.loadStats()
    },

    nextMonth() {
      const now = new Date()
      const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (this.yearMonth >= nowYM) return
      const [year, m] = this.yearMonth.split('-').map(Number)
      let newYear = year
      let newMonth = m + 1
      if (newMonth > 12) { newMonth = 1; newYear += 1 }
      const yearMonth = `${newYear}-${newMonth < 10 ? '0' + newMonth : newMonth}`
      const currentMonth = `${newYear}年${newMonth < 10 ? '0' + newMonth : newMonth}月`
      this.yearMonth = yearMonth
      this.currentMonth = currentMonth
      this.isCurrentMonth = yearMonth === nowYM
      this.loadStats()
    },

    handleSwitch(type) {
      // 防重复 + 节流锁
      if (this.statsType === type || this.switchLocked) return
      this.switchLocked = true
      this.switching = true
      this.switchTarget = type
      // 先触发果冻动画，再切换数据
      setTimeout(async () => {
        this.statsType = type
        await this.loadStats()
        // 数据加载完成后解锁
        this.switchLocked = false
      }, 80)
      // 动画状态清除
      setTimeout(() => {
        this.switching = false
        this.switchTarget = ''
      }, 500)
    },

    switchTo(type) {
      if (this.statsType === type) return
      this.handleSwitch(type)
    },

    async loadStats() {
      this.loading = true
      try {
        const { yearMonth, statsType } = this
        const summary = await getMonthSummary(yearMonth)
        const records = statsType === 'expense'
          ? summary.records.filter(r => r.type === 'expense')
          : summary.records.filter(r => r.type === 'income')

        const catList = this._buildCatList(records)
        const categoryList = catList.map((item, i) => ({
          ...item,
          color: COLORS[i % COLORS.length],
          colorLight: COLORS_LIGHT[i % COLORS_LIGHT.length],
          emoji: CATEGORY_EMOJI[item.category] || '📦'
        }))

        this.monthIncome = summary.income
        this.monthExpense = summary.expense
        this.categoryList = categoryList
        this.isEmpty = categoryList.length === 0
        // 保存当月全量记录供热力图点击详情使用
        this._dayDetailRecords = summary.records

        this._buildDailyHeatmap(summary.records)

        // 首次加载且数据完全为空，延迟重试一次
        if (!this._statsLoadedOnce && this.isEmpty && summary.records.length === 0) {
          console.warn('[stats] 首次加载返回空数据，延迟重试...')
          this._statsLoadedOnce = true
          this.loading = false
          setTimeout(() => { this.loadStats() }, 600)
          return
        }

        this._statsLoadedOnce = true

        // 饼图已改为纯 CSS conic-gradient，通过 computed donutStyle 自动响应
      } catch (e) {
        console.error('[stats] loadStats error:', e)
        this.monthIncome = 0
        this.monthExpense = 0
        this.categoryList = []
        this.isEmpty = true
      } finally {
        this.loading = false
      }
    },

    async loadTrend() {
      this.trendLoading = true
      this.isTrendEmpty = false
      try {
        const data = await getRecentMonthsTrend(6)
        this.trendData = data || []
        const hasAny = (data || []).some(d => d.income > 0 || d.expense > 0)
        this.isTrendEmpty = !hasAny
      } catch (e) {
        console.error('[stats] loadTrend error:', e)
        this.trendData = []
        this.isTrendEmpty = true
      }
      this.trendLoading = false
    },

    /* ─── SVG 趋势图辅助 ─── */
    _trendToPct(field) {
      const data = this.trendData
      if (!data.length) return []
      const mx = this.trendMax
      const W = this.trendSvgWidth
      const H = this.trendSvgHeight
      const n = data.length
      const pad = n <= 1 ? W / 2 : 0
      return data.map((d, i) => {
        const xRatio = n <= 1 ? 0.5 : i / (n - 1)
        const yRatio = 1 - (d[field] / mx)
        return {
          svgX: pad + xRatio * (n <= 1 ? 0 : W),
          svgY: yRatio * H,
          pctX: xRatio * 100,
          pctY: yRatio * 100
        }
      })
    },

    _areaPath(pts) {
      if (!pts.length) return ''
      const H = this.trendSvgHeight
      const W = this.trendSvgWidth
      let d = `M ${pts[0].svgX},${pts[0].svgY}`
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].svgX},${pts[i].svgY}`
      }
      d += ` L ${pts[pts.length - 1].svgX},${H} L ${pts[0].svgX},${H} Z`
      return d
    },

    onDotTap(item, type) {
      if (!item) return
      const label = type === 'expense' ? '支出' : '收入'
      const val = type === 'expense' ? item.expense : item.income
      uni.showToast({
        title: `${item.label} ${label} ¥${val}`,
        icon: 'none',
        duration: 1800
      })
    },

    _buildCatList(records) {
      const map = {}
      let total = 0
      records.forEach(r => {
        const cat = r.category || '其他'
        map[cat] = (map[cat] || 0) + (Number(r.amount) || 0)
        total += Number(r.amount) || 0
      })
      if (total === 0) return []
      return Object.keys(map)
        .map(category => ({
          category,
          amount: parseFloat(map[category].toFixed(2)),
          percent: parseFloat((map[category] / total * 100).toFixed(1))
        }))
        .sort((a, b) => b.amount - a.amount)
    },

    _buildDailyHeatmap(allRecords) {
      const { yearMonth, statsType } = this
      const [year, month] = yearMonth.split('-').map(Number)

      const filteredRecords = allRecords.filter(r => r.type === statsType)
      const dayMap = {}
      filteredRecords.forEach(r => {
        const day = r.date ? r.date.split('-')[2] : null
        if (!day) return
        const d = parseInt(day, 10)
        dayMap[d] = (dayMap[d] || 0) + (Number(r.amount) || 0)
      })

      const maxAmount = Math.max(...Object.values(dayMap), 1)
      const daysInMonth = new Date(year, month, 0).getDate()
      const firstDay = new Date(year, month - 1, 1).getDay()
      this.firstWeekdayOffset = firstDay

      const today = new Date()
      const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      const todayD = today.getDate()

      const HEAT_COLORS = ['#EEF8FB', '#B8E0FF', '#7EC8E3', '#4FB8D4', '#2A8FAD']
      const cells = []
      for (let d = 1; d <= daysInMonth; d++) {
        const amount = parseFloat((dayMap[d] || 0).toFixed(2))
        const ratio = amount / maxAmount

        let level = 0
        if (amount > 0) {
          if (ratio <= 0.2) level = 1
          else if (ratio <= 0.45) level = 2
          else if (ratio <= 0.75) level = 3
          else level = 4
        }

        const isToday = yearMonth === todayYM && d === todayD

        cells.push({
          date: `${yearMonth}-${String(d).padStart(2, '0')}`,
          dayNum: d,
          amount,
          amountShort: amount >= 1000
            ? `${(amount / 1000).toFixed(1)}k`
            : amount > 0 ? String(Math.round(amount)) : '',
          level,
          bg: isToday && amount === 0 ? '#FFE0E8' : HEAT_COLORS[level],
          isToday
        })
      }
      this.dailyCells = cells
    },

    onDayCellTap(day) {
      if (day.amount === 0) return
      const typeLabel = this.statsType === 'expense' ? '支出' : '收入'
      // 从当月记录中提取当天的分类明细
      const { yearMonth, statsType } = this
      const allMonthRecords = this._dayDetailRecords || []
      const dayRecords = allMonthRecords.filter(r => r.date === day.date && r.type === statsType)

      if (dayRecords.length === 0) {
        uni.showToast({ title: `${day.date} 暂无${typeLabel}记录`, icon: 'none', duration: 1800 })
        return
      }

      // 按分类聚合
      const CATEGORY_EMOJI_MAP = {
        '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
        '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
        '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
        '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
        '其他': '📦'
      }
      const catMap = {}
      dayRecords.forEach(r => {
        if (!catMap[r.category]) catMap[r.category] = 0
        catMap[r.category] += Number(r.amount) || 0
      })
      const catLines = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `${CATEGORY_EMOJI_MAP[cat] || '📦'} ${cat}  ¥${parseFloat(amt.toFixed(2))}`)
        .join('\n')

      const dateDisplay = day.date.slice(5).replace('-', '月') + '日'
      uni.showModal({
        title: `${dateDisplay} ${typeLabel}明细`,
        content: `共 ${dayRecords.length} 笔  合计 ¥${day.amount}\n\n${catLines}`,
        showCancel: false,
        confirmText: '知道了'
      })
    },

    switchStatsType(e) {
      this.statsType = e.currentTarget.dataset.type
      this.loadStats()
    }
  }
}
</script>

<style scoped>
/* ─── 月份导航 ─── */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0 28rpx;
}

.month-arrow {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(8px);
  box-shadow: 0 2rpx 12rpx rgba(79,184,212,0.1);
  transition: all 0.2s;
}

.month-arrow:active {
  transform: scale(0.92);
}

.arrow-text {
  font-size: 44rpx;
  color: #4FB8D4;
  font-weight: 700;
  line-height: 1;
  margin-top: -2rpx;
}

.arrow-disabled {
  opacity: 0.25;
  pointer-events: none;
}

.month-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #3D5A6E;
  letter-spacing: 1rpx;
}

/* ─── 概览卡片 ─── */
.overview-card {
  position: relative;
  border-radius: 28rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(79,184,212,0.15);
}

.overview-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 40%, #e8f7fc 100%);
}

.overview-content {
  position: relative;
  z-index: 1;
  padding: 32rpx 24rpx 24rpx;
}

.overview-row {
  display: flex;
  align-items: stretch;
}

.overview-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 0;
  position: relative;
}

.overview-divider {
  width: 1rpx;
  background: linear-gradient(to bottom, transparent, rgba(79,184,212,0.2), transparent);
  margin: 0 4rpx;
  align-self: stretch;
}

.overview-label {
  font-size: 24rpx;
  color: #9BAAB8;
  margin-bottom: 10rpx;
}

.overview-amount {
  font-size: 42rpx;
  font-weight: 800;
  letter-spacing: -1rpx;
}

.expense-amt {
  color: #FF8BAB;
}

.income-amt {
  color: #4FB8D4;
}

.overview-indicator {
  width: 40rpx;
  height: 6rpx;
  border-radius: 3rpx;
  margin-top: 12rpx;
  background: transparent;
  transition: all 0.3s ease;
}

.indicator-active-expense {
  background: linear-gradient(90deg, #FF8BAB, #FFB8CC);
}

.indicator-active-income {
  background: linear-gradient(90deg, #4FB8D4, #7ED4E8);
}

.balance-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(79,184,212,0.1);
}

.balance-label {
  font-size: 24rpx;
  color: #9BAAB8;
}

.balance-amount {
  font-size: 28rpx;
  font-weight: 700;
}

/* ─── 收支切换 ─── */
.type-switcher {
  display: flex;
  position: relative;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-radius: 20rpx;
  padding: 8rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(79,184,212,0.08);
  overflow: hidden;
}

/* 滑动果冻背景 */
.switcher-bg {
  position: absolute;
  top: 8rpx;
  bottom: 8rpx;
  width: calc(50% - 8rpx);
  border-radius: 16rpx;
  z-index: 1;
  transition: transform 0.45s cubic-bezier(0.68, -0.55, 0.265, 1.55),
              background 0.3s ease;
}

.bg-left {
  transform: translateX(0);
  left: 8rpx;
}

.bg-right {
  transform: translateX(100%);
  left: 8rpx;
}

.bg-expense {
  background: linear-gradient(135deg, rgba(255,224,232,0.85), rgba(255,184,204,0.5));
  box-shadow: 0 4rpx 16rpx rgba(255,139,171,0.2);
}

.bg-income {
  background: linear-gradient(135deg, rgba(224,245,250,0.85), rgba(126,212,232,0.5));
  box-shadow: 0 4rpx 16rpx rgba(79,184,212,0.2);
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 20rpx 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #9BAAB8;
  position: relative;
  z-index: 2;
  transition: color 0.3s ease, font-weight 0.3s ease;
  background: transparent;
}

.type-icon {
  font-size: 28rpx;
  transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.type-label {
  font-size: 28rpx;
  font-weight: 500;
}

.active-expense {
  color: #FF8BAB;
  font-weight: 600;
}

.active-expense .type-icon {
  transform: scale(1.2);
}

.active-income {
  color: #4FB8D4;
  font-weight: 600;
}

.active-income .type-icon {
  transform: scale(1.2);
}

/* 加载中禁用态 */
.switcher-locked {
  pointer-events: none;
}

.btn-disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* 果冻弹跳动画 */
.jelly-pop {
  animation: jellyBounce 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes jellyBounce {
  0% { transform: scale(1); }
  20% { transform: scale(0.92, 1.08); }
  40% { transform: scale(1.08, 0.92); }
  60% { transform: scale(0.97, 1.03); }
  80% { transform: scale(1.02, 0.98); }
  100% { transform: scale(1); }
}

/* ─── 空状态 ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 60rpx;
}

.empty-illustration {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.empty-emoji {
  font-size: 100rpx;
  position: relative;
  z-index: 2;
}

.empty-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.15;
}

.empty-circle.c1 {
  width: 180rpx; height: 180rpx;
  background: #4FB8D4;
  top: 10rpx; left: 10rpx;
}

.empty-circle.c2 {
  width: 120rpx; height: 120rpx;
  background: #FF8BAB;
  top: -10rpx; right: 10rpx;
}

.empty-circle.c3 {
  width: 80rpx; height: 80rpx;
  background: #FFD166;
  bottom: 0; left: 20rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #7A8FA0;
  font-weight: 500;
}

.empty-sub {
  font-size: 24rpx;
  color: #B8C8D4;
  margin-top: 8rpx;
}

/* ─── 饼图卡片 ─── */
.chart-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(79,184,212,0.1);
}

.chart-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.chart-card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.chart-card-badge {
  font-size: 22rpx;
  color: #9BAAB8;
  background: #F0F8FF;
  padding: 6rpx 18rpx;
  border-radius: 100rpx;
}

.pie-wrap {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
}

/* ─── 纯 CSS 环形图 ─── */
.css-donut {
  width: min(200px, 50vw);
  height: min(200px, 50vw);
  border-radius: 50%;
  position: relative;
  transition: background 0.4s ease;
  flex-shrink: 0;
}

.donut-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60%;
  height: 60%;
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 12px rgba(0,0,0,0.03);
  overflow: hidden;
  padding: 4px;
}

.donut-amount {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
}

.donut-sub {
  font-size: 11px;
  color: #B8C8D4;
  margin-top: 2px;
}

/* 图例 */
.donut-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12rpx 24rpx;
  margin-top: 20rpx;
  padding: 0 20rpx;
}

.donut-legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.legend-dot-color {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-cat-name {
  font-size: 22rpx;
  color: #3D5A6E;
}

.legend-cat-pct {
  font-size: 22rpx;
  color: #9BAAB8;
  font-weight: 600;
}

/* ─── 分类列表 ─── */
.category-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(79,184,212,0.1);
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #3D5A6E;
  display: block;
  margin-bottom: 20rpx;
}

.category-row {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  gap: 16rpx;
}

.category-row + .category-row {
  border-top: 1rpx solid rgba(79,184,212,0.06);
}

.cat-rank {
  width: 44rpx;
  height: 44rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cat-rank-num {
  font-size: 22rpx;
  font-weight: 700;
  color: #fff;
}

.cat-main {
  flex: 1;
  min-width: 0;
}

.cat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.cat-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #3D5A6E;
}

.cat-amount {
  font-size: 28rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.cat-bottom {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.progress-track {
  flex: 1;
  height: 10rpx;
  background: #F0F8FF;
  border-radius: 100rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 100rpx;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.cat-percent {
  font-size: 22rpx;
  color: #9BAAB8;
  font-weight: 600;
  min-width: 70rpx;
  text-align: right;
}

/* ─── 趋势图 ─── */
.trend-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(79,184,212,0.1);
  overflow: hidden;
}

.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.trend-header .section-title {
  margin-bottom: 0;
}

.trend-legend {
  display: flex;
  gap: 20rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.legend-line {
  width: 24rpx;
  height: 6rpx;
  border-radius: 3rpx;
}

.expense-line {
  background: #FF8BAB;
}

.income-line {
  background: #4FB8D4;
}

.legend-text {
  font-size: 20rpx;
  color: #9BAAB8;
}

/* ─── SVG 趋势图 ─── */
.svg-trend-wrap {
  display: flex;
  gap: 8rpx;
  padding-top: 8rpx;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0 4rpx 28px 0;
}

.y-label {
  font-size: 20rpx;
  color: #B8C8D4;
  text-align: right;
  line-height: 1;
  min-width: 48rpx;
}

.svg-chart-area {
  flex: 1;
  min-width: 0;
  position: relative;
  height: 220px;
  padding-bottom: 28px; /* x-axis 空间 */
}

.svg-grid {
  position: absolute;
  inset: 0;
  bottom: 28px;
  width: 100%;
  height: calc(100% - 28px);
}

.svg-lines {
  position: absolute;
  inset: 0;
  bottom: 28px;
  width: 100%;
  height: calc(100% - 28px);
}

.svg-dots {
  position: absolute;
  inset: 0;
  bottom: 28px;
  width: 100%;
  height: calc(100% - 28px);
}

.dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  z-index: 2;
  cursor: pointer;
  transition: transform 0.15s;
}

.dot:active {
  transform: translate(-50%, -50%) scale(1.3);
}

.expense-dot {
  background: #FF8BAB;
}

.income-dot {
  background: #4FB8D4;
}

.x-axis {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  height: 28px;
  align-items: center;
}

.x-label {
  font-size: 20rpx;
  color: #9BAAB8;
  text-align: center;
  flex: 1;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 0;
  gap: 12rpx;
}

.placeholder-emoji {
  font-size: 48rpx;
  opacity: 0.5;
}

.placeholder-text {
  font-size: 26rpx;
  color: #C8D8E4;
}

/* ─── 热力图 ─── */
.heatmap-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(79,184,212,0.1);
}

.heatmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.heatmap-header .section-title {
  margin-bottom: 0;
}

.heatmap-legend-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.legend-label-sm {
  font-size: 20rpx;
  color: #B8C8D4;
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 5rpx;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6rpx;
  margin-bottom: 8rpx;
}

.weekday-label {
  text-align: center;
  font-size: 22rpx;
  color: #9BAAB8;
  padding: 4rpx 0;
  font-weight: 500;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6rpx;
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  transition: transform 0.15s;
}

.empty-cell {
  background: transparent;
}

.day-cell {
  cursor: pointer;
}

.day-cell:active {
  transform: scale(0.92);
}

.today-cell {
  box-shadow: 0 0 0 3rpx rgba(255,139,171,0.4);
}

.day-num {
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.2;
}

.day-amount {
  font-size: 18rpx;
  line-height: 1.2;
  margin-top: 2rpx;
}
</style>
