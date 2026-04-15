<template>
  <view class="verify-container">
    <view class="card">

      <!-- 成功状态 -->
      <view v-if="status === 'success'" class="content">
        <view class="icon-circle icon-success">
          <text class="icon-emoji">✅</text>
        </view>
        <text class="title">邮箱验证成功！</text>
        <text class="subtitle">欢迎加入 Cinnamoroll 记账本 🎉</text>
        <view class="countdown-bar">
          <view class="countdown-fill" :style="{ width: countdownWidth + '%' }"></view>
        </view>
        <text class="tip">{{ countdown }} 秒后自动跳转到登录页…</text>
      </view>

      <!-- 处理中状态 -->
      <view v-else-if="status === 'loading'" class="content">
        <view class="icon-circle icon-loading">
          <text class="icon-emoji">⏳</text>
        </view>
        <text class="title">正在验证中…</text>
        <text class="subtitle">请稍候</text>
      </view>

      <!-- 失败状态 -->
      <view v-else-if="status === 'error'" class="content">
        <view class="icon-circle icon-error">
          <text class="icon-emoji">❌</text>
        </view>
        <text class="title">验证失败</text>
        <text class="subtitle">{{ errorMsg }}</text>
        <view class="retry-btn" @tap="goLogin">
          <text class="retry-text">返回登录页</text>
        </view>
      </view>

    </view>

    <!-- 底部装饰 -->
    <view class="footer">
      <text class="footer-text">🌸 Cinnamoroll 记账本</text>
    </view>
  </view>
</template>

<script>
import { supabase } from '../../utils/supabase.js'

export default {
  data() {
    return {
      status: 'loading',   // 'loading' | 'success' | 'error'
      errorMsg: '',
      countdown: 3,
      countdownWidth: 100,
      timer: null
    }
  },

  async onLoad() {
    // Supabase 邮件链接会把 token 带在 URL hash 里
    // detectSessionInUrl: true 会自动处理，我们监听 onAuthStateChange 即可
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      this.status = 'error'
      this.errorMsg = '链接已失效或验证出错，请重新注册'
      return
    }

    if (data.session) {
      // 已有 session，说明验证成功（或已登录）
      this.status = 'success'
      this.startCountdown()
      return
    }

    // 没有 session，监听 Supabase 处理 URL token 后的回调
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      subscription.unsubscribe()
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        this.status = 'success'
        this.startCountdown()
      } else if (event === 'TOKEN_REFRESHED') {
        this.status = 'success'
        this.startCountdown()
      } else {
        this.status = 'error'
        this.errorMsg = '链接已失效，请重新注册或联系支持'
      }
    })

    // 5 秒内没有回调则超时
    setTimeout(() => {
      if (this.status === 'loading') {
        this.status = 'error'
        this.errorMsg = '验证超时，链接可能已失效'
      }
    }, 5000)
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },

  methods: {
    startCountdown() {
      this.countdown = 3
      this.countdownWidth = 100
      this.timer = setInterval(() => {
        this.countdown -= 1
        this.countdownWidth = (this.countdown / 3) * 100
        if (this.countdown <= 0) {
          clearInterval(this.timer)
          this.goLogin()
        }
      }, 1000)
    },

    goLogin() {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
}
</script>

<style scoped>
.verify-container {
  min-height: 100vh;
  background: linear-gradient(160deg, #E8F6FB 0%, #F0F8FF 50%, #EAF4FF 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 40rpx;
  box-sizing: border-box;
}

.card {
  background: #FFFFFF;
  border-radius: 40rpx;
  padding: 80rpx 60rpx;
  width: 100%;
  max-width: 620rpx;
  box-shadow: 0 8rpx 48rpx rgba(79, 184, 212, 0.16);
  box-sizing: border-box;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 图标圆圈 */
.icon-circle {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.icon-success {
  background: linear-gradient(135deg, #A8E6CF, #4DBDA0);
  box-shadow: 0 12rpx 40rpx rgba(77, 189, 160, 0.35);
}

.icon-loading {
  background: linear-gradient(135deg, #A8D8EA, #7EC8E3);
  box-shadow: 0 12rpx 40rpx rgba(79, 184, 212, 0.35);
}

.icon-error {
  background: linear-gradient(135deg, #FFB5C8, #FF8BAB);
  box-shadow: 0 12rpx 40rpx rgba(255, 139, 171, 0.35);
}

.icon-emoji {
  font-size: 72rpx;
}

/* 文字 */
.title {
  font-size: 44rpx;
  font-weight: 700;
  color: #3D5A6E;
  margin-bottom: 16rpx;
  text-align: center;
}

.subtitle {
  font-size: 28rpx;
  color: #9BAAB8;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 48rpx;
}

/* 倒计时进度条 */
.countdown-bar {
  width: 100%;
  height: 8rpx;
  background: #E8F4F8;
  border-radius: 100rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.countdown-fill {
  height: 100%;
  background: linear-gradient(90deg, #7EC8E3, #4FB8D4);
  border-radius: 100rpx;
  transition: width 0.9s linear;
}

.tip {
  font-size: 24rpx;
  color: #B8CCD8;
}

/* 返回按钮 */
.retry-btn {
  margin-top: 8rpx;
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #7EC8E3, #4FB8D4);
  border-radius: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(79, 184, 212, 0.35);
  cursor: pointer;
}

.retry-btn:active {
  opacity: 0.85;
}

.retry-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #FFFFFF;
}

/* 底部 */
.footer {
  margin-top: 60rpx;
}

.footer-text {
  font-size: 24rpx;
  color: #B8CCD8;
}
</style>
