<template>
  <view class="container">
    <!-- 顶部月份收支卡片 -->
    <view class="summary-card">
      <view class="summary-header">
        <view class="month-nav-row">
          <view class="month-arrow-btn" @tap="prevMonth">
            <text class="month-arrow-text">‹</text>
          </view>
          <text class="month-label">{{ currentMonth }}</text>
          <view :class="['month-arrow-btn', isCurrentMonth ? 'month-arrow-disabled' : '']" @tap="nextMonth">
            <text class="month-arrow-text">›</text>
          </view>
        </view>
        <text class="summary-subtitle">收支概览 🐾</text>
      </view>

      <view class="net-amount">
        <text class="net-label">结余</text>
        <text :class="['net-value', monthNet >= 0 ? 'positive' : 'negative']">
          {{ monthNet >= 0 ? "+" : "" }}{{ monthNet }}
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
    <view class="quick-add-row">
      <view class="quick-add" @tap="goToAdd">
        <text class="quick-add-icon">✏️</text>
        <text class="quick-add-text">记一笔</text>
      </view>
      <view class="quick-add quick-add-income" @tap="goToAddIncome">
        <text class="quick-add-icon">💰</text>
        <text class="quick-add-text-income">记收入</text>
      </view>
    </view>

    <!-- 今日消费速览 -->
    <view v-if="todayExpense > 0 || todayCount > 0" class="today-streak-card">
      <view class="today-streak-left">
        <text class="today-streak-emoji">☀️</text>
        <view class="today-streak-info">
          <text class="today-streak-title">今日已记账</text>
          <text class="today-streak-sub">共 {{ todayCount }} 笔支出</text>
        </view>
      </view>
      <view class="today-streak-right">
        <text class="today-streak-amount">-¥{{ todayExpense }}</text>
        <text v-if="todayIncome > 0" class="today-streak-income">+¥{{ todayIncome }} 收入</text>
      </view>
    </view>

    <!-- 月度预算卡片 -->
    <view class="card budget-card">
      <view class="budget-header">
        <view class="budget-title-row">
          <text class="budget-icon">🎯</text>
          <text class="budget-title">本月预算</text>
        </view>
        <view class="budget-set-btn" @tap="onSetBudget">
          <text class="budget-set-text">{{ hasBudget ? "修改" : "设置" }}</text>
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
            <text :class="[
              'budget-val',
              budgetOver ? 'budget-over-text' : 'budget-normal-text',
            ]">¥{{ monthExpense }}</text>
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
          <view :class="[
            'budget-bar-fill',
            budgetOver ? 'budget-bar-over' : 'budget-bar-ok',
          ]" :style="'width: ' + budgetPercent + '%;'"></view>
        </view>
        <view class="budget-percent-row">
          <text :class="[
            'budget-percent-text',
            budgetOver ? 'budget-over-text' : '',
          ]">已用 {{ budgetPercent }}%</text>
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
        <view class="hint-bar">
          <text class="hint-text">点击查看详情，长按可编辑或删除 ✨</text>
        </view>
        <view v-for="item in recentGroups" :key="item.date" class="date-group">
          <text class="date-label">{{ item.dateLabel }}</text>
          <view class="record-item" v-for="record in item.records" :key="record.id"
            :data-id="record.id" @tap="onRecordTap" @longpress="onRecordLongPress">
            <view class="record-left">
              <view class="record-category-icon">
                <text>{{ record.emoji }}</text>
              </view>
              <view class="record-info">
                <text class="record-category">{{ record.category }}</text>
                <text class="record-note" v-if="record.note">{{
                  record.note
                  }}</text>
              </view>
            </view>
            <view class="record-right">
              <text :class="[
                'record-amount',
                record.type === 'income' ? 'amount-income' : 'amount-expense',
              ]">
                {{ record.amountDisplay }}
              </text>
              <text class="record-edit-hint">点击查看</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!-- ─── 账单详情弹窗 ─────────────────────────────────────── -->
  <view v-if="detailVisible" class="detail-overlay" @tap="closeDetail">
    <view class="detail-sheet" @tap.stop>
      <!-- 拖拽指示条 -->
      <view class="detail-drag-bar"></view>

      <!-- 头部：emoji + 分类 + 金额 -->
      <view class="detail-header">
        <view :class="['detail-icon-wrap', detailRecord.type === 'income' ? 'detail-icon-income' : 'detail-icon-expense']">
          <text class="detail-icon-emoji">{{ detailRecord.emoji }}</text>
        </view>
        <view class="detail-title-block">
          <text class="detail-category">{{ detailRecord.category }}</text>
          <text :class="['detail-amount', detailRecord.type === 'income' ? 'detail-amount-income' : 'detail-amount-expense']">
            {{ detailRecord.amountDisplay }}
          </text>
        </view>
        <view :class="['detail-type-tag', detailRecord.type === 'income' ? 'tag-income' : 'tag-expense']">
          <text class="tag-text">{{ detailRecord.type === 'income' ? '收入' : '支出' }}</text>
        </view>
      </view>

      <!-- 信息列表 -->
      <view class="detail-info-list">
        <view class="detail-info-row">
          <text class="detail-info-label">📅 日期</text>
          <text class="detail-info-value">{{ detailRecord.date }}</text>
        </view>
        <view class="detail-info-row" v-if="detailRecord.note">
          <text class="detail-info-label">📝 备注</text>
          <text class="detail-info-value detail-note">{{ detailRecord.note }}</text>
        </view>
        <view class="detail-info-row" v-else>
          <text class="detail-info-label">📝 备注</text>
          <text class="detail-info-value detail-empty-note">暂无备注</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="detail-actions">
        <view class="detail-action-btn detail-edit-btn" @tap="onDetailEdit">
          <text class="detail-action-icon">✏️</text>
          <text class="detail-action-text">编辑</text>
        </view>
        <view class="detail-action-btn detail-delete-btn" @tap="onDetailDelete">
          <text class="detail-action-icon">🗑️</text>
          <text class="detail-action-text">删除</text>
        </view>
      </view>
    </view>
  </view>

</template>

<script>
import {
  getMonthSummary,
  groupByDate,
  formatDate,
  getMonthBudget,
  setMonthBudget,
  deleteRecord,
} from "../../utils/storage.js";

// 分类 emoji 映射
const CATEGORY_EMOJI = {
  餐饮: "🍜",
  交通: "🚌",
  购物: "🛍️",
  娱乐: "🎮",
  住房: "🏠",
  医疗: "💊",
  教育: "📚",
  运动: "🏃",
  旅行: "✈️",
  宠物: "🐾",
  日用: "🧴",
  工资: "💼",
  奖金: "🎁",
  副业: "💡",
  理财: "📈",
  红包: "🧧",
  其他: "📦",
};

export default {
  name: 'IndexPage',
  data() {
    return {
      currentMonth: "",
      yearMonth: "",
      isCurrentMonth: true,
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
      hasBudget: false,
      // 今日速览
      todayExpense: 0,
      todayIncome: 0,
      todayCount: 0,
      // 详情弹窗
      detailVisible: false,
      detailRecord: {},
    };
  },

  async onShow() {
    // 每次显示时若当前浏览月非今月，重置回今月
    if (!this.yearMonth) {
      await this.loadData();
    } else {
      await this.loadData(this.yearMonth);
    }
  },

  methods: {
    // ─── 月份导航 ───────────────────────────────────────────────

    prevMonth() {
      const [year, month] = this.yearMonth.split('-').map(Number);
      let newYear = year, newMonth = month - 1;
      if (newMonth < 1) { newMonth = 12; newYear -= 1; }
      const ym = `${newYear}-${String(newMonth).padStart(2, '0')}`;
      this.loadData(ym);
    },

    nextMonth() {
      if (this.isCurrentMonth) return;
      const [year, month] = this.yearMonth.split('-').map(Number);
      let newYear = year, newMonth = month + 1;
      if (newMonth > 12) { newMonth = 1; newYear += 1; }
      const ym = `${newYear}-${String(newMonth).padStart(2, '0')}`;
      this.loadData(ym);
    },

    async loadData(targetYearMonth) {
      this.loading = true;
      uni.showLoading({ title: "加载中", mask: false });
      try {
        const now = new Date();
        const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let yearMonth, year, month;
        if (targetYearMonth) {
          yearMonth = targetYearMonth;
          [year, month] = targetYearMonth.split('-').map(Number);
        } else {
          year = now.getFullYear();
          month = now.getMonth() + 1;
          yearMonth = nowYM;
        }

        const monthLabel = `${year}年${String(month).padStart(2, '0')}月`;
        const isCurrentMonth = yearMonth >= nowYM;

        const summary = await getMonthSummary(yearMonth);

        // 最近8条账单，按日期分组
        const allRecentRecords = summary.records.slice(0, 8);

        const recentGroups = groupByDate(allRecentRecords).map((group) => ({
          ...group,
          dateLabel: formatDate(group.date),
          records: group.records.map((r) => ({
            ...r,
            emoji: CATEGORY_EMOJI[r.category] || "📦",
            amountDisplay:
              r.type === "income" ? `+${r.amount}` : `-${r.amount}`,
          })),
        }));

        // 预算计算（本地存储）
        const budget = getMonthBudget(yearMonth);
        const hasBudget = budget > 0;
        let budgetPercent = 0;
        let budgetOver = false;
        let budgetRemain = 0;
        if (hasBudget) {
          budgetPercent = Math.min(
            100,
            parseFloat(((summary.expense / budget) * 100).toFixed(1))
          );
          budgetOver = summary.expense > budget;
          budgetRemain = parseFloat((budget - summary.expense).toFixed(2));
        }

        // 今日速览统计（仅当月才显示）
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let todayExpense = 0, todayIncome = 0, todayCount = 0;
        if (isCurrentMonth) {
          summary.records.forEach(r => {
            if (r.date === todayStr) {
              if (r.type === 'expense') {
                todayExpense += Number(r.amount) || 0;
                todayCount++;
              } else if (r.type === 'income') {
                todayIncome += Number(r.amount) || 0;
              }
            }
          });
        }

        this.currentMonth = monthLabel;
        this.yearMonth = yearMonth;
        this.isCurrentMonth = isCurrentMonth;
        this.monthIncome = summary.income;
        this.monthExpense = summary.expense;
        this.monthNet = summary.net;
        this.recentGroups = recentGroups;
        this.isEmpty = summary.records.length === 0;
        this.budget = budget;
        this.hasBudget = hasBudget;
        this.budgetPercent = budgetPercent;
        this.budgetOver = budgetOver;
        this.budgetRemain = budgetRemain;
        this.todayExpense = parseFloat(todayExpense.toFixed(2));
        this.todayIncome = parseFloat(todayIncome.toFixed(2));
        this.todayCount = todayCount;
      } catch (e) {
        console.error("[index] loadData error:", e);
        uni.showToast({ title: "加载失败，请重试", icon: "none" });
      } finally {
        this.loading = false;
        uni.hideLoading();
      }
    },

    // 设置/修改预算
    onSetBudget() {
      const { yearMonth, budget, currentMonth } = this;
      uni.showModal({
        title: `设置 ${currentMonth} 预算`,
        editable: true,
        placeholderText: budget > 0 ? String(budget) : "请输入本月支出预算",
        content: "",
        confirmText: "确定",
        cancelText: "取消",
        success: (res) => {
          if (!res.confirm) return;
          const input = res.content ? res.content.trim() : "";
          if (input === "") {
            setMonthBudget(yearMonth, 0);
            uni.showToast({ title: "预算已清除", icon: "none" });
            this.loadData();
            return;
          }
          const amount = parseFloat(input);
          if (isNaN(amount) || amount <= 0) {
            uni.showToast({ title: "请输入有效金额 🐾", icon: "none" });
            return;
          }
          setMonthBudget(yearMonth, amount);
          uni.showToast({
            title: "预算已设置 ✨",
            icon: "success",
            duration: 1200,
          });
          this.loadData();
        },
      });
    },

    // ─── 点击查看详情 ────────────────────────────────────────

    onRecordTap(e) {
      const id = e.currentTarget.dataset.id
      let found = null
      for (const group of this.recentGroups) {
        const record = group.records.find(r => r.id === id)
        if (record) { found = record; break }
      }
      if (!found) return
      this.detailRecord = found
      this.detailVisible = true
    },

    closeDetail() {
      this.detailVisible = false
      this.detailRecord = {}
    },

    onDetailEdit() {
      const id = this.detailRecord.id
      this.closeDetail()
      uni.navigateTo({ url: `/pages/add/add?recordId=${id}` })
    },

    onDetailDelete() {
      const id = this.detailRecord.id
      this.closeDetail()
      this._confirmDelete(id)
    },

    // ─── 长按操作（编辑 / 删除）────────────────────────────────

    onRecordLongPress(e) {
      const id = e.currentTarget.dataset.id
      const self = this
      uni.showActionSheet({
        itemList: ['✏️ 编辑', '🗑️ 删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            uni.navigateTo({ url: `/pages/add/add?recordId=${id}` })
          } else if (res.tapIndex === 1) {
            self._confirmDelete(id)
          }
        }
      })
    },

    _confirmDelete(id) {
      uni.showModal({
        title: '确认删除',
        content: '删除这条账单记录？',
        confirmText: '删除',
        confirmColor: '#FF8BAB',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            try {
              await deleteRecord(id)
              uni.showToast({ title: '已删除', icon: 'success', duration: 800 })
              await this.loadData()
            } catch (e) {
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },

    goToAdd() {
      this.$emit('switch-tab', 1);
    },

    goToAddIncome() {
      this.$emit('switch-tab', 1, { type: 'income' });
    },

    goToList() {
      this.$emit('switch-tab', 2);
    },
  },
};
</script>

<style scoped>
/* 月度汇总卡片 */
.summary-card {
  background: linear-gradient(145deg, #7ec8e3, #4fb8d4);
  border-radius: 32rpx;
  padding: 40rpx 36rpx;
  margin-bottom: 24rpx;
  color: #ffffff;
  box-shadow: 0 8rpx 32rpx rgba(79, 184, 212, 0.35);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28rpx;
}

/* 月份导航行 */
.month-nav-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.month-arrow-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}

.month-arrow-btn:active {
  background: rgba(255, 255, 255, 0.4);
}

.month-arrow-disabled {
  opacity: 0.3;
}

.month-arrow-text {
  font-size: 44rpx;
  color: #ffffff;
  font-weight: 700;
  line-height: 1;
  margin-top: -4rpx;
}

.month-label {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
  min-width: 180rpx;
  text-align: center;
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
  color: #ffffff;
  line-height: 1.1;
}

.net-value.negative {
  color: #ffe0e8;
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
  color: #ffffff;
}

.summary-divider {
  width: 1rpx;
  height: 56rpx;
  background: rgba(255, 255, 255, 0.3);
  margin: 0 24rpx;
}

/* 快速记账 */
.quick-add-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.quick-add {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  background: #ffffff;
  border-radius: 100rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(79, 184, 212, 0.15);
  border: 2rpx solid #e8f4f8;
  cursor: pointer;
}

.quick-add:active {
  opacity: 0.85;
  transform: scale(0.99);
}

.quick-add-income {
  background: #fff5f7;
  border-color: #ffd6e4;
  box-shadow: 0 4rpx 20rpx rgba(255, 139, 171, 0.12);
}

.quick-add-icon {
  font-size: 36rpx;
}

.quick-add-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #4fb8d4;
}

.quick-add-text-income {
  font-size: 32rpx;
  font-weight: 600;
  color: #ff8bab;
}

/* 今日速览卡片 */
.today-streak-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #fffaf0, #fff3e0);
  border-radius: 24rpx;
  padding: 24rpx 32rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #ffe0b2;
  box-shadow: 0 2rpx 12rpx rgba(255, 167, 38, 0.1);
}

.today-streak-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.today-streak-emoji {
  font-size: 44rpx;
}

.today-streak-info {
  display: flex;
  flex-direction: column;
}

.today-streak-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #e65100;
}

.today-streak-sub {
  font-size: 22rpx;
  color: #bf6e00;
  margin-top: 4rpx;
}

.today-streak-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.today-streak-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #ff8bab;
}

.today-streak-income {
  font-size: 22rpx;
  color: #4fb8d4;
  margin-top: 4rpx;
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
  color: #3d5a6e;
}

.view-all {
  font-size: 26rpx;
  color: #4fb8d4;
}

/* 日期分组 */
.date-group {
  margin-bottom: 16rpx;
}

.date-label {
  font-size: 24rpx;
  color: #9baab8;
  padding: 8rpx 0;
  display: block;
}

/* 操作提示栏 */
.hint-bar {
  text-align: center;
  margin-bottom: 12rpx;
}

.hint-text {
  font-size: 24rpx;
  color: #b8d8e4;
}

/* 账单条目 */
.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f8ff;
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
  background: #eef8fb;
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
  color: #3d5a6e;
}

.record-note {
  font-size: 24rpx;
  color: #9baab8;
  margin-top: 4rpx;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.record-amount {
  font-size: 32rpx;
  font-weight: 600;
}

.record-edit-hint {
  font-size: 20rpx;
  color: #c8d8e4;
  margin-top: 4rpx;
}

.amount-income {
  color: #4fb8d4;
}

.amount-expense {
  color: #ff8bab;
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
  color: #9baab8;
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
  color: #3d5a6e;
}

.budget-set-btn {
  background: #eef8fb;
  border-radius: 100rpx;
  padding: 8rpx 28rpx;
}

.budget-set-text {
  font-size: 26rpx;
  color: #4fb8d4;
  font-weight: 500;
}

/* 未设置预算 */
.budget-empty {
  padding: 16rpx 0 8rpx;
}

.budget-empty-text {
  font-size: 26rpx;
  color: #b8ccd8;
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
  color: #9baab8;
  margin-bottom: 4rpx;
}

.budget-val {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.1;
}

.budget-normal-text {
  color: #3d5a6e;
}

.budget-over-text {
  color: #ff8bab;
}

.budget-total-text {
  color: #9baab8;
}

.budget-slash {
  font-size: 36rpx;
  color: #c8d8e4;
  padding-bottom: 4rpx;
}

.budget-remain-wrap {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.budget-remain-ok {
  font-size: 26rpx;
  color: #4fb8d4;
  background: #eef8fb;
  border-radius: 100rpx;
  padding: 6rpx 20rpx;
}

.budget-remain-over {
  font-size: 26rpx;
  color: #ff8bab;
  background: #fff0f4;
  border-radius: 100rpx;
  padding: 6rpx 20rpx;
}

/* 进度条 */
.budget-bar-bg {
  width: 100%;
  height: 16rpx;
  background: #eef8fb;
  border-radius: 100rpx;
  overflow: hidden;
}

.budget-bar-fill {
  height: 100%;
  border-radius: 100rpx;
  transition: width 0.4s ease;
}

.budget-bar-ok {
  background: linear-gradient(90deg, #7ec8e3, #4fb8d4);
}

.budget-bar-over {
  background: linear-gradient(90deg, #ffb3c6, #ff8bab);
}

.budget-percent-row {
  display: flex;
  justify-content: flex-end;
}

.budget-percent-text {
  font-size: 22rpx;
  color: #9baab8;
}

/* ─── 账单详情弹窗 ───────────────────────────────────────── */
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(61, 90, 110, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.detail-sheet {
  width: 100%;
  background: #ffffff;
  border-radius: 40rpx 40rpx 0 0;
  padding: 0 36rpx 60rpx;
  box-shadow: 0 -8rpx 40rpx rgba(79, 184, 212, 0.15);
}

.detail-drag-bar {
  width: 80rpx;
  height: 8rpx;
  border-radius: 100rpx;
  background: #dff0f7;
  margin: 24rpx auto 32rpx;
}

.detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 32rpx;
  gap: 24rpx;
}

.detail-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-icon-expense {
  background: #ffe8ef;
}

.detail-icon-income {
  background: #e0f5fa;
}

.detail-icon-emoji {
  font-size: 48rpx;
}

.detail-title-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.detail-category {
  font-size: 34rpx;
  font-weight: 700;
  color: #3d5a6e;
}

.detail-amount {
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.detail-amount-income {
  color: #4fb8d4;
}

.detail-amount-expense {
  color: #ff8bab;
}

.detail-type-tag {
  padding: 10rpx 20rpx;
  border-radius: 100rpx;
  flex-shrink: 0;
}

.tag-expense {
  background: #ffe8ef;
}

.tag-income {
  background: #e0f5fa;
}

.tag-text {
  font-size: 24rpx;
  font-weight: 600;
}

.tag-expense .tag-text {
  color: #ff8bab;
}

.tag-income .tag-text {
  color: #4fb8d4;
}

.detail-info-list {
  background: #f5fbfd;
  border-radius: 24rpx;
  padding: 8rpx 28rpx;
  margin-bottom: 32rpx;
}

.detail-info-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #e8f4f8;
}

.detail-info-row:last-child {
  border-bottom: none;
}

.detail-info-label {
  font-size: 28rpx;
  color: #9baab8;
  width: 160rpx;
  flex-shrink: 0;
}

.detail-info-value {
  flex: 1;
  font-size: 28rpx;
  color: #3d5a6e;
  font-weight: 500;
  text-align: right;
}

.detail-note {
  color: #5a7a8e;
}

.detail-empty-note {
  color: #c8d8e4;
  font-weight: 400;
}

.detail-actions {
  display: flex;
  gap: 24rpx;
}

.detail-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx 0;
  border-radius: 24rpx;
}

.detail-edit-btn {
  background: #e0f5fa;
}

.detail-edit-btn:active {
  opacity: 0.8;
}

.detail-delete-btn {
  background: #ffe8ef;
}

.detail-delete-btn:active {
  opacity: 0.8;
}

.detail-action-icon {
  font-size: 36rpx;
}

.detail-action-text {
  font-size: 30rpx;
  font-weight: 600;
}

.detail-edit-btn .detail-action-text {
  color: #4fb8d4;
}

.detail-delete-btn .detail-action-text {
  color: #ff8bab;
}
</style>
