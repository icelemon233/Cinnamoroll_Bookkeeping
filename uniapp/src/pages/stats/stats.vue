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

    <!-- 收支切换 -->
    <view class="type-switcher">
      <view :class="['type-btn', statsType === 'expense' ? 'active-expense' : '']" :data-type="'expense'"
        @tap="switchStatsType">💸 支出</view>
      <view :class="['type-btn', statsType === 'income' ? 'active-income' : '']" :data-type="'income'"
        @tap="switchStatsType">💰 收入</view>
    </view>

    <!-- 本月收支概览 -->
    <view class="summary-row">
      <view class="summary-item">
        <text class="summary-label">本月支出</text>
        <text class="summary-amount expense-text">¥{{ monthExpense }}</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-label">本月收入</text>
        <text class="summary-amount income-text">¥{{ monthIncome }}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="isEmpty" class="empty-state">
      <text class="empty-emoji">🌸</text>
      <text class="empty-text">{{ currentMonth }}暂无{{ statsType === 'expense' ? '支出' : '收入' }}记录</text>
    </view>

    <!-- 图表区域 -->
    <view v-else>
      <!-- Canvas 饼图 -->
      <view class="chart-card">
        <canvas canvas-id="pieCanvas" id="pieCanvas" class="pie-canvas"
          :style="{ width: pieSize + 'px', height: pieSize + 'px' }"></canvas>
      </view>

      <!-- 分类列表 -->
      <view class="card category-list">
        <text class="list-title">分类明细</text>
        <view class="category-row" v-for="item in categoryList" :key="item.category">
          <view class="cat-color-dot" :style="{ background: item.color }"></view>
          <view class="cat-info">
            <text class="cat-name">{{ item.emoji }} {{ item.category }}</text>
            <view class="progress-bar-wrap">
              <view class="progress-bar" :style="{ width: item.percent + '%', background: item.color }"></view>
            </view>
          </view>
          <view class="cat-right">
            <text class="cat-amount">¥{{ item.amount }}</text>
            <text class="cat-percent">{{ item.percent }}%</text>
          </view>
        </view>
      </view>

      <!-- 近6个月趋势折线图 -->
      <view class="card trend-card">
        <view class="trend-header">
          <text class="list-title">近6个月趋势</text>
          <view class="trend-legend">
            <view class="legend-item">
              <view class="legend-line income-line"></view>
              <text class="legend-text">收入</text>
            </view>
            <view class="legend-item">
              <view class="legend-line expense-line"></view>
              <text class="legend-text">支出</text>
            </view>
          </view>
        </view>
        <view v-if="trendLoading" class="trend-loading">
          <text class="trend-loading-text">加载中...</text>
        </view>
        <view v-else-if="isTrendEmpty" class="trend-empty">
          <text class="trend-empty-text">暂无历史数据</text>
        </view>
        <view v-else>
          <canvas canvas-id="trendCanvas" id="trendCanvas" class="trend-canvas" style="width: 100%; height: 220px;"></canvas>
        </view>
      </view>

      <!-- 每日消费热力图 -->
      <view class="card daily-heatmap">
        <view class="heatmap-header">
          <text class="list-title">每日消费热力</text>
          <text class="heatmap-sub">颜色越深消费越高</text>
        </view>
        <!-- 星期标签 -->
        <view class="weekday-row">
          <text class="weekday-label" v-for="wd in weekdays" :key="wd">{{ wd }}</text>
        </view>
        <!-- 日历格子 -->
        <view class="heatmap-grid">
          <!-- 月首空格补位 -->
          <view class="heatmap-cell empty-cell" v-for="n in firstWeekdayOffset" :key="'empty-' + n"></view>
          <!-- 每天格子 -->
          <view v-for="day in dailyCells" :key="day.date"
            :class="['heatmap-cell', 'day-cell', day.level > 0 ? 'has-data' : '']" :style="{ background: day.bg }"
            @tap="onDayCellTap(day)">
            <text class="day-num" :style="{ color: day.level >= 3 ? '#fff' : '#3D5A6E' }">{{ day.dayNum }}</text>
            <text v-if="day.amount > 0" class="day-amount"
              :style="{ color: day.level >= 3 ? 'rgba(255,255,255,0.85)' : '#9BAAB8' }">
              {{ day.amountShort }}
            </text>
          </view>
        </view>
        <!-- 图例 -->
        <view class="heatmap-legend">
          <text class="legend-label">少</text>
          <view class="legend-dot" v-for="lv in heatLevels" :key="lv.level" :style="{ background: lv.color }"></view>
          <text class="legend-label">多</text>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
import { getMonthSummary, getRecentMonthsTrend } from '../../utils/storage.js'

const COLORS = [
  '#4FB8D4', '#7EC8E3', '#A8D8EA', '#9DC3E6',
  '#B8E0FF', '#C9E8F0', '#5BA3C9', '#88C8D8'
]

const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
}

export default {
  data() {
    return {
      yearMonth: '',
      currentMonth: '',
      isCurrentMonth: true,
      monthIncome: 0,
      monthExpense: 0,
      statsType: 'expense',
      categoryList: [],
      isEmpty: false,
      pieSize: 260,
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
      isTrendEmpty: false
    }
  },

  onLoad() {
    this._initMonth()
  },

  onShow() {
    uni.$emit('tab-selected', 3)
    this.loadStats()
    // 趋势图只在初次加载或月份为当前月时刷新（避免重复请求）
    if (!this.trendData.length || this.isCurrentMonth) {
      this.loadTrend()
    }
  },

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
      this.loadStats()  // intentionally not awaited here (UI triggered)
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

    async loadStats() {
      uni.showLoading({ title: '加载中...', mask: true })
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
          emoji: CATEGORY_EMOJI[item.category] || '📦'
        }))

        this.monthIncome = summary.income
        this.monthExpense = summary.expense
        this.categoryList = categoryList
        this.isEmpty = categoryList.length === 0

        // 构建每日热力图（始终基于全部记录，按 statsType 筛选）
        this._buildDailyHeatmap(summary.records)

        if (!this.isEmpty) {
          this.$nextTick(() => { this.drawPieChart(categoryList) })
        }
      } finally {
        uni.hideLoading()
      }
    },

    async loadTrend() {
      this.trendLoading = true
      try {
        const data = await getRecentMonthsTrend(6)
        this.trendData = data
        const hasAny = data.some(d => d.income > 0 || d.expense > 0)
        this.isTrendEmpty = !hasAny
        if (hasAny) {
          // 先将 trendLoading 置为 false，等 v-else 块渲染到 DOM 后再绘制
          this.trendLoading = false
          this.$nextTick(() => {
            setTimeout(() => { this.drawTrendChart(data) }, 50)
          })
          return
        }
      } catch (e) {
        console.error('[stats] loadTrend error:', e)
        this.isTrendEmpty = true
      }
      this.trendLoading = false
    },

    drawTrendChart(data) {
      // 使用旧式 Canvas API（兼容 H5 和小程序）
      const sysInfo = uni.getSystemInfoSync()
      // trend-card padding 28rpx*2，card 本身有 margin，约减去 56rpx
      // rpx -> px：sysInfo.windowWidth / 750
      const rpxRatio = sysInfo.windowWidth / 750
      const padding = Math.round(28 * 2 * rpxRatio)
      const w = sysInfo.windowWidth - padding
      const h = 220

      const ctx = uni.createCanvasContext('trendCanvas', this)
      this._renderTrendLine(ctx, w, h, data)
      ctx.draw()
    },

    _renderTrendLine(ctx, w, h, data) {
      const padL = 52, padR = 16, padT = 20, padB = 24
      const chartW = w - padL - padR
      const chartH = h - padT - padB
      const n = data.length

      // 找最大值（income/expense）
      let maxVal = 1
      data.forEach(d => {
        if (d.income > maxVal) maxVal = d.income
        if (d.expense > maxVal) maxVal = d.expense
      })

      // 计算每个点的 x/y 坐标
      const xs = data.map((_, i) => padL + (i / (n - 1)) * chartW)
      const incomeYs = data.map(d => padT + (1 - d.income / maxVal) * chartH)
      const expenseYs = data.map(d => padT + (1 - d.expense / maxVal) * chartH)

      // 绘制网格线（3条）
      for (let i = 0; i <= 3; i++) {
        const y = padT + (i / 3) * chartH
        ctx.beginPath()
        ctx.setStrokeStyle('#EEF8FB')
        ctx.setLineWidth(1)
        ctx.moveTo(padL, y)
        ctx.lineTo(w - padR, y)
        ctx.stroke()
        // Y轴标签
        const val = Math.round(maxVal * (1 - i / 3))
        ctx.setFillStyle('#9BAAB8')
        ctx.setFontSize(10)
        ctx.setTextAlign('right')
        ctx.setTextBaseline('middle')
        ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padL - 4, y)
      }

      // 绘制收入区域填充
      ctx.beginPath()
      ctx.moveTo(xs[0], incomeYs[0])
      for (let i = 1; i < n; i++) {
        const cpX = (xs[i - 1] + xs[i]) / 2
        ctx.bezierCurveTo(cpX, incomeYs[i - 1], cpX, incomeYs[i], xs[i], incomeYs[i])
      }
      ctx.lineTo(xs[n - 1], padT + chartH)
      ctx.lineTo(xs[0], padT + chartH)
      ctx.closePath()
      ctx.setFillStyle('rgba(79, 184, 212, 0.12)')
      ctx.fill()

      // 绘制收入折线（蓝色）
      ctx.beginPath()
      ctx.moveTo(xs[0], incomeYs[0])
      for (let i = 1; i < n; i++) {
        const cpX = (xs[i - 1] + xs[i]) / 2
        ctx.bezierCurveTo(cpX, incomeYs[i - 1], cpX, incomeYs[i], xs[i], incomeYs[i])
      }
      ctx.setStrokeStyle('#4FB8D4')
      ctx.setLineWidth(2.5)
      ctx.stroke()

      // 绘制支出区域填充
      ctx.beginPath()
      ctx.moveTo(xs[0], expenseYs[0])
      for (let i = 1; i < n; i++) {
        const cpX = (xs[i - 1] + xs[i]) / 2
        ctx.bezierCurveTo(cpX, expenseYs[i - 1], cpX, expenseYs[i], xs[i], expenseYs[i])
      }
      ctx.lineTo(xs[n - 1], padT + chartH)
      ctx.lineTo(xs[0], padT + chartH)
      ctx.closePath()
      ctx.setFillStyle('rgba(255, 139, 171, 0.1)')
      ctx.fill()

      // 绘制支出折线（粉色）
      ctx.beginPath()
      ctx.moveTo(xs[0], expenseYs[0])
      for (let i = 1; i < n; i++) {
        const cpX = (xs[i - 1] + xs[i]) / 2
        ctx.bezierCurveTo(cpX, expenseYs[i - 1], cpX, expenseYs[i], xs[i], expenseYs[i])
      }
      ctx.setStrokeStyle('#FF8BAB')
      ctx.setLineWidth(2.5)
      ctx.stroke()

      // 绘制 X 轴月份标签（直接在 canvas 内，与数据点 x 坐标精确对齐）
      ctx.setFillStyle('#9BAAB8')
      ctx.setFontSize(10)
      ctx.setTextAlign('center')
      ctx.setTextBaseline('top')
      data.forEach((d, i) => {
        ctx.fillText(d.label, xs[i], padT + chartH + 6)
      })

      // 绘制数据点
      data.forEach((d, i) => {
        // 收入点
        ctx.beginPath()
        ctx.arc(xs[i], incomeYs[i], 4, 0, Math.PI * 2)
        ctx.setFillStyle('#4FB8D4')
        ctx.fill()
        ctx.setStrokeStyle('#FFFFFF')
        ctx.setLineWidth(1.5)
        ctx.stroke()

        // 支出点
        ctx.beginPath()
        ctx.arc(xs[i], expenseYs[i], 4, 0, Math.PI * 2)
        ctx.setFillStyle('#FF8BAB')
        ctx.fill()
        ctx.setStrokeStyle('#FFFFFF')
        ctx.setLineWidth(1.5)
        ctx.stroke()
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

    /**
     * 构建当月每日热力图数据
     * @param {Array} allRecords - 当月所有记录
     */
    _buildDailyHeatmap(allRecords) {
      const { yearMonth, statsType } = this
      const [year, month] = yearMonth.split('-').map(Number)

      // 统计每天的支出/收入金额
      const filteredRecords = allRecords.filter(r => r.type === statsType)
      const dayMap = {}
      filteredRecords.forEach(r => {
        const day = r.date ? r.date.split('-')[2] : null
        if (!day) return
        const d = parseInt(day, 10)
        dayMap[d] = (dayMap[d] || 0) + (Number(r.amount) || 0)
      })

      // 找最大值用于归一化热度
      const maxAmount = Math.max(...Object.values(dayMap), 1)

      // 当月天数
      const daysInMonth = new Date(year, month, 0).getDate()
      // 该月1日是星期几（0=日 6=六）
      const firstDay = new Date(year, month - 1, 1).getDay()
      this.firstWeekdayOffset = firstDay

      // 今天日期（用于标记）
      const today = new Date()
      const todayYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      const todayD = today.getDate()

      const cells = []
      for (let d = 1; d <= daysInMonth; d++) {
        const amount = parseFloat((dayMap[d] || 0).toFixed(2))
        const ratio = amount / maxAmount  // 0~1

        // 热度等级 0~4
        let level = 0
        if (amount > 0) {
          if (ratio <= 0.2) level = 1
          else if (ratio <= 0.45) level = 2
          else if (ratio <= 0.75) level = 3
          else level = 4
        }

        const HEAT_COLORS = ['#EEF8FB', '#B8E0FF', '#7EC8E3', '#4FB8D4', '#2A8FAD']
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
      uni.showToast({
        title: `${day.date} ${typeLabel} ¥${day.amount}`,
        icon: 'none',
        duration: 1800
      })
    },

    switchStatsType(e) {
      this.statsType = e.currentTarget.dataset.type
      this.loadStats()  // intentionally not awaited (UI triggered)
    },

    drawPieChart(categoryList) {
      const size = this.pieSize
      const ctx = uni.createCanvasContext('pieCanvas', this)
      this._renderPieCompat(ctx, size, size, categoryList)
      ctx.draw()
    },

    _renderPieCompat(ctx, w, h, categoryList) {
      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) / 2 - 16
      let startAngle = -Math.PI / 2
      const total = categoryList.reduce((s, i) => s + i.amount, 0)

      categoryList.forEach((item, i) => {
        const sweep = (item.amount / total) * 2 * Math.PI
        const endAngle = startAngle + sweep
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.closePath()
        ctx.setFillStyle(COLORS[i % COLORS.length])
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.closePath()
        ctx.setStrokeStyle('#FFFFFF')
        ctx.setLineWidth(3)
        ctx.stroke()
        startAngle = endAngle
      })

      // 甜甜圈挖空
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 0.48, 0, 2 * Math.PI)
      ctx.setFillStyle('#F0F8FF')
      ctx.fill()

      // 中心爪印文字
      ctx.setFontSize(Math.floor(radius * 0.22))
      ctx.setFillStyle('#3D5A6E')
      ctx.setTextAlign('center')
      ctx.setTextBaseline('middle')
      ctx.fillText('🐾', cx, cy - radius * 0.08)
      ctx.setFontSize(Math.floor(radius * 0.14))
      ctx.setFillStyle('#9BAAB8')
      ctx.fillText(`${categoryList.length} 分类`, cx, cy + radius * 0.18)
    }
  }
}
</script>

<style scoped>
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 24rpx;
}

.month-arrow {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #EBF7FB;
}

.arrow-text {
  font-size: 48rpx;
  color: #4FB8D4;
  font-weight: 700;
  line-height: 1;
  margin-top: -4rpx;
}

.arrow-disabled {
  opacity: 0.3;
}

.month-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.summary-row {
  display: flex;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx 0;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 184, 212, 0.1);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-divider {
  width: 1rpx;
  background: #EBF7FB;
  margin: 8rpx 0;
}

.summary-label {
  font-size: 24rpx;
  color: #9BAAB8;
  margin-bottom: 8rpx;
}

.summary-amount {
  font-size: 36rpx;
  font-weight: 700;
}

.income-text {
  color: #4FB8D4;
}

.expense-text {
  color: #FF8BAB;
}

.type-switcher {
  display: flex;
  background: #FFFFFF;
  border-radius: 100rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 184, 212, 0.1);
}

.type-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 100rpx;
  font-size: 30rpx;
  color: #9BAAB8;
}

.active-expense {
  background: #FFE0E8;
  color: #FF8BAB;
  font-weight: 600;
}

.active-income {
  background: #E0F5FA;
  color: #4FB8D4;
  font-weight: 600;
}

.chart-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(79, 184, 212, 0.12);
}

.pie-canvas {
  display: block;
}

.category-list {
  padding: 28rpx;
}

.list-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #3D5A6E;
  display: block;
  margin-bottom: 24rpx;
}

.category-row {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #F0F8FF;
}

.category-row:last-child {
  border-bottom: none;
}

.cat-color-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.cat-info {
  flex: 1;
  margin-right: 20rpx;
}

.cat-name {
  font-size: 28rpx;
  color: #3D5A6E;
  display: block;
  margin-bottom: 8rpx;
}

.progress-bar-wrap {
  height: 8rpx;
  background: #F0F8FF;
  border-radius: 100rpx;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 100rpx;
}

.cat-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.cat-amount {
  font-size: 30rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.cat-percent {
  font-size: 22rpx;
  color: #9BAAB8;
  margin-top: 4rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
}

.empty-emoji {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #9BAAB8;
}

/* ─── 近6个月趋势图 ─── */
.trend-card {
  padding: 28rpx;
  margin-bottom: 24rpx;
}

.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.trend-legend {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.legend-line {
  width: 28rpx;
  height: 4rpx;
  border-radius: 2rpx;
}

.income-line {
  background: #4FB8D4;
}

.expense-line {
  background: #FF8BAB;
}

.legend-text {
  font-size: 22rpx;
  color: #9BAAB8;
}

.trend-canvas {
  display: block;
  width: 100%;
}


.trend-loading,
.trend-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx 0;
}

.trend-loading-text,
.trend-empty-text {
  font-size: 26rpx;
  color: #C8D8E4;
}

/* ─── 每日热力图 ─── */
.daily-heatmap {
  padding: 28rpx;
  margin-top: 0;
}

.heatmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.heatmap-sub {
  font-size: 22rpx;
  color: #9BAAB8;
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
}

.empty-cell {
  background: transparent;
}

.day-cell {
  cursor: pointer;
}

.day-cell:active {
  opacity: 0.75;
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

/* 图例 */
.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  margin-top: 20rpx;
}

.legend-label {
  font-size: 22rpx;
  color: #9BAAB8;
}

.legend-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 6rpx;
}
</style>
