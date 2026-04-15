<template>
  <view class="container">
    <custom-tab-bar :selected="0"></custom-tab-bar>

    <!-- 顶部月份收支卡片 -->
    <view class="summary-card">
      <view class="summary-header">
        <text class="month-label">{{ currentMonth }}</text>
        <text class="summary-subtitle">收支概览 🐾</text>
      </view>

      <view class="net-amount">
        <text class="net-label">结余</text>
        <text :class="['net-value', monthNet >= 0 ? 'positive' : 'negative']">
          {{ monthNet >= 0 ? '+' : '' }}{{ monthNet }}
        </text>
      </view>

      <view class="summary-row">
        <view class="summary-item">
          <view class="summary-icon income-icon">💰</view>
          <view class="summary-detail">
            <text class="summary-type">收入</text>
            <text class="summary-amount income-amount">+{{ monthIncome }}</text>
          </view>
        </view>
        <view class="summary-divider"></view>
        <view class="summary-item">
          <view class="summary-icon expense-icon">💸</view>
          <view class="summary-detail">
            <text class="summary-type">支出</text>
            <text class="summary-amount expense-amount">-{{ monthExpense }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 快速记账按钮 -->
    <view class="quick-add" @tap="goToAdd">
      <text class="quick-add-icon">✏️</text>
      <text class="quick-add-text">记一笔</text>
    </view>

    <!-- 月度预算卡片 -->
    <view class="card budget-card">
      <view class="budget-header">
        <view class="budget-title-row">
          <text class="budget-icon">🎯</text>
          <text class="budget-title">本月预算</text>
        </view>
        <view class="budget-set-btn" @tap="onSetBudget">
          <text class="budget-set-text">{{ hasBudget ? '修改' : '设置' }}</text>
        </view>
      </view>

      <!-- 未设置预算 -->
      <view v-if="!hasBudget" class="budget-empty">
        <text class="budget-empty-text">还没有设置预算，点击右上角设置～</text>
      </view>

      <!-- 已设置预算 -->
      <view v-else class="budget-content">
        <view class="budget-amounts">
          <view class="budget-used">
            <text class="budget-label-small">已支出</text>
            <text :class="['budget-val', budgetOver ? 'budget-over-text' : 'budget-normal-text']">¥{{ monthExpense }}</text>
          </view>
          <view class="budget-slash">/</view>
          <view class="budget-total">
            <text class="budget-label-small">预算</text>
            <text class="budget-val budget-total-text">¥{{ budget }}</text>
          </view>
          <view class="budget-remain-wrap">
            <text v-if="!budgetOver" class="budget-remain-ok">还剩 ¥{{ budgetRemain }}</text>
            <text v-else class="budget-remain-over">超出 ¥{{ -budgetRemain }}</text>
          </view>
        </view>

        <!-- 进度条 -->
        <view class="budget-bar-bg">
          <view
            :class="['budget-bar-fill', budgetOver ? 'budget-bar-over' : 'budget-bar-ok']"
            :style="'width: ' + budgetPercent + '%;'"
          ></view>
        </view>
        <view class="budget-percent-row">
          <text :class="['budget-percent-text', budgetOver ? 'budget-over-text' : '']">已用 {{ budgetPercent }}%</text>
        </view>
      </view>
    </view>

    <!-- 最近账单 -->
    <view class="card recent-section">
      <view class="flex-between section-header">
        <text class="section-title">最近账单</text>
        <view @tap="goToList">
          <text class="view-all">全部 →</text>
        </view>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="empty-state">
        <text class="empty-emoji">⏳</text>
        <text class="empty-text">加载中...</text>
      </view>

      <!-- 空状态 -->
      <view v-else-if="isEmpty" class="empty-state">
        <text class="empty-emoji">🌸</text>
        <text class="empty-text">还没有账单，快来记一笔吧～</text>
      </view>

      <!-- 账单列表 -->
      <view v-else>
        <template v-for="item in recentGroups" :key="item.date">
          <view class="date-group">
            <text class="date-label">{{ item.dateLabel }}</text>
            <view
              class="record-item"
              v-for="record in item.records"
              :key="record.id"
            >
              <view class="record-left">
                <view class="record-category-icon">
                  <text>{{ record.emoji }}</text>
                </view>
                <view class="record-info">
                  <text class="record-category">{{ record.category }}</text>
                  <text class="record-note" v-if="record.note">{{ record.note }}</text>
                </view>
              </view>
              <text :class="['record-amount', record.type === 'income' ? 'amount-income' : 'amount-expense']">
                {{ record.amountDisplay }}
              </text>
            </view>
          </view>
        </template>
      </view>
    </view>

  </view>
</template>

<script>
import { getMonthSummary, groupByDate, formatDate, getMonthBudget, setMonthBudget } from '../../utils/storage.js'

// 分类 emoji 映射
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
      currentMonth: '',
      yearMonth: '',
      monthIncome: 0,
      monthExpense: 0,
      monthNet: 0,
      recentGroups: [],
      isEmpty: false,
      loading: false,
      // 预算相关
      budget: 0,
      budgetPercent: 0,
      budgetOver: false,
      budgetRemain: 0,
      hasBudget: false
    }
  },

  async onShow() {
    await this.loadData()
  },

  methods: {
    async loadData() {
      this.loading = true
      uni.showLoading({ title: '加载中', mask: false })
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const yearMonth = `${year}-${month < 10 ? '0' + month : month}`
        const monthLabel = `${year}年${month < 10 ? '0' + month : month}月`

        const summary = await getMonthSummary(yearMonth)

        // 最近5条账单，按日期分组
        const allRecentRecords = summary.records
          .slice(0, 5)

        const recentGroups = groupByDate(allRecentRecords).map(group => ({
          ...group,
          dateLabel: formatDate(group.date),
          records: group.records.map(r => ({
            ...r,
            emoji: CATEGORY_EMOJI[r.category] || '📦',
            amountDisplay: r.type === 'income' ? `+${r.amount}` : `-${r.amount}`
          }))
        }))

        // 预算计算（本地存储）
        const budget = getMonthBudget(yearMonth)
        const hasBudget = budget > 0
        let budgetPercent = 0
        let budgetOver = false
        let budgetRemain = 0
        if (hasBudget) {
          budgetPercent = Math.min(100, parseFloat((summary.expense / budget * 100).toFixed(1)))
          budgetOver = summary.expense > budget
          budgetRemain = parseFloat((budget - summary.expense).toFixed(2))
        }

        this.currentMonth = monthLabel
        this.yearMonth = yearMonth
        this.monthIncome = summary.income
        this.monthExpense = summary.expense
        this.monthNet = summary.net
        this.recentGroups = recentGroups
        this.isEmpty = summary.records.length === 0
        this.budget = budget
        this.hasBudget = hasBudget
        this.budgetPercent = budgetPercent
        this.budgetOver = budgetOver
        this.budgetRemain = budgetRemain
      } catch (e) {
        console.error('[index] loadData error:', e)
        uni.showToast({ title: '加载失败，请重试', icon: 'none' })
      } finally {
        this.loading = false
        uni.hideLoading()
      }
    },

    // 设置/修改预算
    onSetBudget() {
      const { yearMonth, budget, currentMonth } = this
      uni.showModal({
        title: `设置 ${currentMonth} 预算`,
        editable: true,
        placeholderText: budget > 0 ? String(budget) : '请输入本月支出预算',
        content: '',
        confirmText: '确定',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) return
          const input = res.content ? res.content.trim() : ''
          if (input === '') {
            setMonthBudget(yearMonth, 0)
            uni.showToast({ title: '预算已清除', icon: 'none' })
            this.loadData()
            return
          }
          const amount = parseFloat(input)
          if (isNaN(amount) || amount <= 0) {
            uni.showToast({ title: '请输入有效金额 🐾', icon: 'none' })
            return
          }
          setMonthBudget(yearMonth, amount)
          uni.showToast({ title: '预算已设置 ✨', icon: 'success', duration: 1200 })
          this.loadData()
        }
      })
    },

    goToAdd() {
      uni.switchTab({ url: '/pages/add/add' })
    },

    goToList() {
      uni.switchTab({ url: '/pages/list/list' })
    }
  }
}
</script>

<style scoped>
/* 月度汇总卡片 */
.summary-card {
  background: linear-gradient(145deg, #7EC8E3, #4FB8D4);
  border-radius: 32rpx;
  padding: 40rpx 36rpx;
  margin-bottom: 24rpx;
  color: #FFFFFF;
  box-shadow: 0 8rpx 32rpx rgba(79, 184, 212, 0.35);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28rpx;
}

.month-label {
  font-size: 34rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.summary-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.net-amount {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32rpx;
}

.net-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 8rpx;
}

.net-value {
  font-size: 72rpx;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1.1;
}

.net-value.negative {
  color: #FFE0E8;
}

.summary-row {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
}

.summary-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.summary-icon {
  font-size: 44rpx;
  width: 56rpx;
  text-align: center;
}

.summary-detail {
  display: flex;
  flex-direction: column;
}

.summary-type {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 4rpx;
}

.summary-amount {
  font-size: 34rpx;
  font-weight: 600;
  color: #FFFFFF;
}

.summary-divider {
  width: 1rpx;
  height: 56rpx;
  background: rgba(255, 255, 255, 0.3);
  margin: 0 24rpx;
}

/* 快速记账 */
.quick-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  background: #FFFFFF;
  border-radius: 100rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(79, 184, 212, 0.15);
  border: 2rpx solid #E8F4F8;
  cursor: pointer;
}

.quick-add:active {
  opacity: 0.85;
  transform: scale(0.99);
}

.quick-add-icon {
  font-size: 36rpx;
}

.quick-add-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #4FB8D4;
}

/* 最近账单区域 */
.recent-section {
  padding: 28rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.view-all {
  font-size: 26rpx;
  color: #4FB8D4;
}

/* 日期分组 */
.date-group {
  margin-bottom: 16rpx;
}

.date-label {
  font-size: 24rpx;
  color: #9BAAB8;
  padding: 8rpx 0;
  display: block;
}

/* 账单条目 */
.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F0F8FF;
}

.record-item:last-child {
  border-bottom: none;
}

.record-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.record-category-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #EEF8FB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}

.record-info {
  display: flex;
  flex-direction: column;
}

.record-category {
  font-size: 30rpx;
  font-weight: 500;
  color: #3D5A6E;
}

.record-note {
  font-size: 24rpx;
  color: #9BAAB8;
  margin-top: 4rpx;
}

.record-amount {
  font-size: 32rpx;
  font-weight: 600;
}

.amount-income {
  color: #4FB8D4;
}

.amount-expense {
  color: #FF8BAB;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}

.empty-emoji {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #9BAAB8;
}

/* ─── 月度预算卡片 ─── */
.budget-card {
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}

.budget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.budget-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.budget-icon {
  font-size: 36rpx;
}

.budget-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.budget-set-btn {
  background: #EEF8FB;
  border-radius: 100rpx;
  padding: 8rpx 28rpx;
}

.budget-set-text {
  font-size: 26rpx;
  color: #4FB8D4;
  font-weight: 500;
}

/* 未设置预算 */
.budget-empty {
  padding: 16rpx 0 8rpx;
}

.budget-empty-text {
  font-size: 26rpx;
  color: #B8CCD8;
}

/* 已设置预算 */
.budget-content {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.budget-amounts {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
}

.budget-used,
.budget-total {
  display: flex;
  flex-direction: column;
}

.budget-label-small {
  font-size: 22rpx;
  color: #9BAAB8;
  margin-bottom: 4rpx;
}

.budget-val {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.1;
}

.budget-normal-text {
  color: #3D5A6E;
}

.budget-over-text {
  color: #FF8BAB;
}

.budget-total-text {
  color: #9BAAB8;
}

.budget-slash {
  font-size: 36rpx;
  color: #C8D8E4;
  padding-bottom: 4rpx;
}

.budget-remain-wrap {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.budget-remain-ok {
  font-size: 26rpx;
  color: #4FB8D4;
  background: #EEF8FB;
  border-radius: 100rpx;
  padding: 6rpx 20rpx;
}

.budget-remain-over {
  font-size: 26rpx;
  color: #FF8BAB;
  background: #FFF0F4;
  border-radius: 100rpx;
  padding: 6rpx 20rpx;
}

/* 进度条 */
.budget-bar-bg {
  width: 100%;
  height: 16rpx;
  background: #EEF8FB;
  border-radius: 100rpx;
  overflow: hidden;
}

.budget-bar-fill {
  height: 100%;
  border-radius: 100rpx;
  transition: width 0.4s ease;
}

.budget-bar-ok {
  background: linear-gradient(90deg, #7EC8E3, #4FB8D4);
}

.budget-bar-over {
  background: linear-gradient(90deg, #FFB3C6, #FF8BAB);
}

.budget-percent-row {
  display: flex;
  justify-content: flex-end;
}

.budget-percent-text {
  font-size: 22rpx;
  color: #9BAAB8;
}
</style>
