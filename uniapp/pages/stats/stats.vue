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
      <view
        :class="['type-btn', statsType === 'expense' ? 'active-expense' : '']"
        :data-type="'expense'"
        @tap="switchStatsType"
      >💸 支出</view>
      <view
        :class="['type-btn', statsType === 'income' ? 'active-income' : '']"
        :data-type="'income'"
        @tap="switchStatsType"
      >💰 收入</view>
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
        <canvas
          id="pieCanvas"
          type="2d"
          class="pie-canvas"
          style="width: 300px; height: 300px;"
        ></canvas>
      </view>

      <!-- 分类列表 -->
      <view class="card category-list">
        <text class="list-title">分类明细</text>
        <view
          class="category-row"
          v-for="item in categoryList"
          :key="item.category"
        >
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
    </view>

  </view>
</template>

<script>
import { getMonthSummary } from '../../utils/storage.js'

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
      isEmpty: false
    }
  },

  onLoad() {
    this._initMonth()
  },

  onShow() {
    this.loadStats()
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

    loadStats() {
      const { yearMonth, statsType } = this
      const summary = getMonthSummary(yearMonth)
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

      if (!this.isEmpty) {
        this.$nextTick(() => { this.drawPieChart(categoryList) })
      }
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

    switchStatsType(e) {
      this.statsType = e.currentTarget.dataset.type
      this.loadStats()
    },

    drawPieChart(categoryList) {
      const query = uni.createSelectorQuery().in(this)
      query.select('#pieCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = uni.getWindowInfo ? uni.getWindowInfo().pixelRatio : (uni.getSystemInfoSync().pixelRatio || 2)
          const w = res[0].width
          const h = res[0].height
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.scale(dpr, dpr)
          this._renderPie(ctx, w, h, categoryList)
        })
    },

    _renderPie(ctx, w, h, categoryList) {
      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) / 2 - 20
      ctx.clearRect(0, 0, w, h)
      let startAngle = -Math.PI / 2
      const total = categoryList.reduce((s, i) => s + i.amount, 0)

      categoryList.forEach((item, i) => {
        const sweep = (item.amount / total) * 2 * Math.PI
        const endAngle = startAngle + sweep
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.closePath()
        ctx.fillStyle = COLORS[i % COLORS.length]
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.closePath()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 3
        ctx.stroke()
        startAngle = endAngle
      })

      // 甜甜圈挖空
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 0.48, 0, 2 * Math.PI)
      ctx.fillStyle = '#F0F8FF'
      ctx.fill()

      // 中心文字
      ctx.fillStyle = '#3D5A6E'
      ctx.font = `bold ${Math.floor(radius * 0.22)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐾', cx, cy - radius * 0.08)
      ctx.font = `${Math.floor(radius * 0.14)}px sans-serif`
      ctx.fillStyle = '#9BAAB8'
      ctx.fillText(`${categoryList.length} 分类`, cx, cy + radius * 0.15)
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

.income-text { color: #4FB8D4; }
.expense-text { color: #FF8BAB; }

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
  border-radius: 50%;
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
</style>
