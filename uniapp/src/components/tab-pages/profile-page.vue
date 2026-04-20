<template>
  <view class="container">
    <!-- 顶部头像区域 -->
    <view class="profile-header">
      <view class="avatar-circle">
        <text class="avatar-emoji">🐾</text>
      </view>
      <text class="user-email">{{ email || '加载中...' }}</text>
      <text class="user-tag">Cinnamoroll 用户</text>
    </view>

    <!-- 记账统计摘要卡片 -->
    <view class="card stats-card">
      <view class="stats-card-header">
        <text class="stats-card-title">📈 我的记账总览</text>
        <text v-if="statsLoading" class="stats-card-sub">加载中...</text>
        <text v-else-if="allStats.firstDate" class="stats-card-sub">
          自 {{ allStats.firstDate }} 起
        </text>
      </view>
      <view v-if="!statsLoading" class="stats-grid">
        <view class="stats-cell">
          <text class="stats-num">{{ allStats.totalCount }}</text>
          <text class="stats-label">总笔数</text>
        </view>
        <view class="stats-divider-v"></view>
        <view class="stats-cell">
          <text class="stats-num">{{ allStats.recordDays }}</text>
          <text class="stats-label">记账天数</text>
        </view>
        <view class="stats-divider-v"></view>
        <view class="stats-cell">
          <text class="stats-num income-num">+{{ allStats.totalIncome }}</text>
          <text class="stats-label">总收入</text>
        </view>
        <view class="stats-divider-v"></view>
        <view class="stats-cell">
          <text class="stats-num expense-num">-{{ allStats.totalExpense }}</text>
          <text class="stats-label">总支出</text>
        </view>
      </view>
      <view v-if="!statsLoading" class="stats-net-row">
        <text class="stats-net-label">净结余</text>
        <text :class="['stats-net-val', allStats.net >= 0 ? 'income-num' : 'expense-num']">
          {{ allStats.net >= 0 ? '+' : '' }}{{ allStats.net }}
        </text>
      </view>
    </view>

    <!-- 信息卡片 -->
    <view class="card info-card">
      <view class="info-row">
        <text class="info-icon">📧</text>
        <text class="info-label">邮箱</text>
        <text class="info-value">{{ email || '—' }}</text>
      </view>
      <view class="divider-line"></view>
      <view class="info-row">
        <text class="info-icon">📅</text>
        <text class="info-label">注册时间</text>
        <text class="info-value">{{ createdAt || '—' }}</text>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="card menu-card">
      <view class="menu-item" @tap="goToIndex">
        <view class="menu-left">
          <text class="menu-icon">🏠</text>
          <text class="menu-text">返回首页</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="divider-line"></view>
      <view class="menu-item" @tap="goToStats">
        <view class="menu-left">
          <text class="menu-icon">📊</text>
          <text class="menu-text">查看统计</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-btn" @tap="handleLogout">
      <text class="logout-text">退出登录</text>
    </view>

    <!-- 底部装饰 -->
    <view class="footer">
      <text class="footer-text">🌸 Cinnamoroll 记账本 · 用爱记录生活</text>
    </view>

  </view>
</template>

<script>
import { supabase } from '../../utils/supabase.js'
import { getAllTimeSummary } from '../../utils/storage.js'

export default {
  name: 'ProfilePage',
  data() {
    return {
      email: '',
      createdAt: '',
      statsLoading: true,
      allStats: {
        totalCount: 0,
        totalIncome: 0,
        totalExpense: 0,
        recordDays: 0,
        firstDate: null,
        net: 0
      }
    }
  },

  async onShow() {
    await this.loadUser()
  },

  mounted() {
    this.loadUser()
  },

  methods: {
    async loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        uni.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.email = user.email || ''
      if (user.created_at) {
        const d = new Date(user.created_at)
        this.createdAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      // 同步加载全量统计
      this.loadAllStats()
    },

    async loadAllStats() {
      this.statsLoading = true
      try {
        const stats = await getAllTimeSummary()
        this.allStats = {
          ...stats,
          net: parseFloat((stats.totalIncome - stats.totalExpense).toFixed(2))
        }
      } catch (e) {
        console.error('[profile] loadAllStats error:', e)
      } finally {
        this.statsLoading = false
      }
    },

    async handleLogout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        confirmText: '退出',
        confirmColor: '#FF8BAB',
        cancelText: '取消',
        success: async (res) => {
          if (!res.confirm) return
          await supabase.auth.signOut()
          uni.showToast({ title: '已退出 👋', icon: 'none', duration: 800 })
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/login/login' })
          }, 600)
        }
      })
    },

    goToIndex() {
      this.$emit('switch-tab', 0);
    },

    goToStats() {
      this.$emit('switch-tab', 3);
    }
  }
}
</script>

<style scoped>
/* ─── 记账统计摘要卡片 ─── */
.stats-card {
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}

.stats-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.stats-card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #3D5A6E;
}

.stats-card-sub {
  font-size: 22rpx;
  color: #9BAAB8;
}

.stats-grid {
  display: flex;
  align-items: stretch;
  background: #F5FBFD;
  border-radius: 20rpx;
  padding: 24rpx 0;
  margin-bottom: 20rpx;
}

.stats-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stats-divider-v {
  width: 1rpx;
  background: #D8EFF5;
  margin: 4rpx 0;
  flex-shrink: 0;
}

.stats-num {
  font-size: 34rpx;
  font-weight: 700;
  color: #3D5A6E;
  line-height: 1.2;
}

.income-num {
  color: #4FB8D4;
}

.expense-num {
  color: #FF8BAB;
}

.stats-label {
  font-size: 22rpx;
  color: #9BAAB8;
}

.stats-net-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  background: #F5FBFD;
  border-radius: 16rpx;
}

.stats-net-label {
  font-size: 26rpx;
  color: #9BAAB8;
}

.stats-net-val {
  font-size: 36rpx;
  font-weight: 700;
}

/* 顶部头像 */
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 40rpx;
}

.avatar-circle {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #A8D8EA, #7EC8E3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 40rpx rgba(79, 184, 212, 0.3);
}

.avatar-emoji {
  font-size: 72rpx;
}

.user-email {
  font-size: 32rpx;
  font-weight: 600;
  color: #3D5A6E;
  margin-bottom: 10rpx;
  max-width: 580rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: 24rpx;
  color: #9BAAB8;
  background: #EEF8FB;
  border-radius: 100rpx;
  padding: 6rpx 24rpx;
}

/* 信息卡片 */
.info-card {
  margin-bottom: 20rpx;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  gap: 16rpx;
}

.info-icon {
  font-size: 32rpx;
  width: 40rpx;
  text-align: center;
}

.info-label {
  font-size: 28rpx;
  color: #9BAAB8;
  width: 120rpx;
  flex-shrink: 0;
}

.info-value {
  font-size: 28rpx;
  color: #3D5A6E;
  flex: 1;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.divider-line {
  height: 1rpx;
  background: #F0F8FF;
}

/* 菜单卡片 */
.menu-card {
  margin-bottom: 32rpx;
  padding: 8rpx 32rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  cursor: pointer;
}

.menu-item:active {
  opacity: 0.7;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.menu-icon {
  font-size: 36rpx;
}

.menu-text {
  font-size: 30rpx;
  color: #3D5A6E;
  font-weight: 500;
}

.menu-arrow {
  font-size: 40rpx;
  color: #C8D8E4;
  font-weight: 700;
}

/* 退出按钮 */
.logout-btn {
  width: 100%;
  height: 96rpx;
  background: #FFF0F4;
  border-radius: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #FFB3C8;
  cursor: pointer;
  margin-bottom: 48rpx;
}

.logout-btn:active {
  opacity: 0.8;
}

.logout-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #FF8BAB;
}

/* 底部 */
.footer {
  display: flex;
  justify-content: center;
  padding: 20rpx 0 40rpx;
}

.footer-text {
  font-size: 24rpx;
  color: #C8D8E4;
}
</style>
