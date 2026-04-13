<script lang="ts">
import { supabase } from './utils/supabase'

export default {
  async onLaunch() {
    console.log('Cinnamoroll 记账本启动 🐾')

    // 检查登录状态
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }

    // 监听 auth 状态变化
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        uni.reLaunch({ url: '/pages/login/login' })
      }
    })
  },
  globalData: {
    expenseCategories: [
      { name: '餐饮', emoji: '🍜' },
      { name: '交通', emoji: '🚌' },
      { name: '购物', emoji: '🛍️' },
      { name: '娱乐', emoji: '🎮' },
      { name: '其他', emoji: '📦' }
    ],
    incomeCategories: [
      { name: '工资', emoji: '💼' },
      { name: '其他', emoji: '📦' }
    ],
    categoryColors: {
      '餐饮': '#7EC8E3',
      '交通': '#A8D8EA',
      '购物': '#B8E0FF',
      '娱乐': '#9DC3E6',
      '工资': '#4FB8D4',
      '其他': '#C9E8F0'
    }
  }
}
</script>

<style>
/* 全局样式 Cinnamoroll 蓝白风格 */

/* 全局重置 */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  background-color: #F0F8FF;
  color: #3D5A6E;
  font-size: 28rpx;
  line-height: 1.6;
  padding-bottom: 120rpx;
}

.color-primary { color: #4FB8D4; }
.color-income { color: #4FB8D4; }
.color-expense { color: #FF8BAB; }
.color-text { color: #3D5A6E; }
.color-muted { color: #9BAAB8; }

/* 通用容器 */
.container {
  padding: 24rpx;
  min-height: 100vh;
  background-color: #F0F8FF;
}

/* 卡片 */
.card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(79, 184, 212, 0.12);
}

/* 按钮通用 */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 48rpx;
  font-size: 30rpx;
  font-weight: 500;
  padding: 20rpx 48rpx;
  border: none;
  transition: opacity 0.2s;
}

.btn::after {
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #7EC8E3, #4FB8D4);
  color: #FFFFFF;
}

.btn-outline {
  background: transparent;
  border: 2rpx solid #4FB8D4;
  color: #4FB8D4;
}

.btn:active {
  opacity: 0.8;
}

/* 标题 */
.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #3D5A6E;
  margin-bottom: 20rpx;
}

/* 分隔线 */
.divider {
  height: 1rpx;
  background: #E8F4F8;
  margin: 16rpx 0;
}

/* 金额文字 */
.amount-income {
  color: #4FB8D4;
  font-weight: 600;
}

.amount-expense {
  color: #FF8BAB;
  font-weight: 600;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
  color: #9BAAB8;
}

.empty-emoji {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #9BAAB8;
}

/* Tag/badge */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  font-size: 24rpx;
  background: #E8F4F8;
  color: #4FB8D4;
}

/* flex 工具类 */
.flex { display: flex; }
.flex-col { display: flex; flex-direction: column; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-1 { flex: 1; }

/* 圆角图片占位 */
.avatar-placeholder {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #A8D8EA, #7EC8E3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}
</style>
