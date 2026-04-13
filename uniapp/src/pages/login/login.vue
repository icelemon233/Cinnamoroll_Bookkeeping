<template>
  <view class="login-container">

    <!-- 顶部装饰 -->
    <view class="login-header">
      <view class="logo-circle">
        <text class="logo-emoji">🐾</text>
      </view>
      <text class="app-name">Cinnamoroll 记账本</text>
      <text class="app-slogan">轻松记录，把握每一分钱 ✨</text>
    </view>

    <!-- 切换标签：登录 / 注册 -->
    <view class="tab-switcher">
      <view
        :class="['tab-btn', mode === 'login' ? 'tab-active' : '']"
        @tap="switchMode('login')"
      >
        <text>登录</text>
      </view>
      <view
        :class="['tab-btn', mode === 'register' ? 'tab-active' : '']"
        @tap="switchMode('register')"
      >
        <text>注册</text>
      </view>
    </view>

    <!-- 表单卡片 -->
    <view class="form-card">
      <!-- 邮箱 -->
      <view class="input-group">
        <text class="input-label">📧 邮箱</text>
        <input
          class="input-field"
          type="text"
          placeholder="请输入邮箱地址"
          placeholder-class="input-placeholder"
          :value="email"
          @input="e => email = e.detail.value"
        />
      </view>

      <!-- 密码 -->
      <view class="input-group">
        <text class="input-label">🔒 密码</text>
        <input
          class="input-field"
          type="password"
          :placeholder="mode === 'register' ? '请设置密码（至少6位）' : '请输入密码'"
          placeholder-class="input-placeholder"
          :value="password"
          @input="e => password = e.detail.value"
        />
      </view>

      <!-- 错误提示 -->
      <view v-if="errorMsg" class="error-tip">
        <text class="error-text">⚠️ {{ errorMsg }}</text>
      </view>

      <!-- 提交按钮 -->
      <view
        :class="['submit-btn', loading ? 'submit-btn-disabled' : '']"
        @tap="handleSubmit"
      >
        <text class="submit-text">
          {{ loading ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}
        </text>
      </view>

      <!-- 注册成功提示 -->
      <view v-if="registerSuccess" class="success-tip">
        <text class="success-text">🎉 注册成功！请检查邮箱确认链接，然后登录。</text>
      </view>
    </view>

    <!-- 底部装饰 -->
    <view class="login-footer">
      <text class="footer-text">🌸 记录美好生活的每一笔</text>
    </view>

  </view>
</template>

<script>
import { supabase } from '../../utils/supabase.js'

export default {
  data() {
    return {
      mode: 'login',        // 'login' | 'register'
      email: '',
      password: '',
      loading: false,
      errorMsg: '',
      registerSuccess: false
    }
  },

  methods: {
    switchMode(mode) {
      this.mode = mode
      this.errorMsg = ''
      this.registerSuccess = false
    },

    async handleSubmit() {
      const { mode, email, password } = this
      this.errorMsg = ''
      this.registerSuccess = false

      if (!email.trim()) {
        this.errorMsg = '请输入邮箱地址'
        return
      }
      if (!password) {
        this.errorMsg = '请输入密码'
        return
      }
      if (mode === 'register' && password.length < 6) {
        this.errorMsg = '密码至少需要6位'
        return
      }

      this.loading = true
      try {
        if (mode === 'login') {
          await this.doLogin(email.trim(), password)
        } else {
          await this.doRegister(email.trim(), password)
        }
      } finally {
        this.loading = false
      }
    },

    async doLogin(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        this.errorMsg = this._translateError(error.message)
        return
      }
      if (data.session) {
        uni.showToast({ title: '登录成功 🐾', icon: 'success', duration: 1000 })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/index/index' })
        }, 800)
      }
    },

    async doRegister(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        this.errorMsg = this._translateError(error.message)
        return
      }
      // Supabase 默认需要邮箱验证
      this.registerSuccess = true
      this.password = ''
    },

    _translateError(msg) {
      if (msg.includes('Invalid login credentials')) return '邮箱或密码不正确'
      if (msg.includes('Email not confirmed')) return '邮箱尚未验证，请检查收件箱'
      if (msg.includes('User already registered')) return '该邮箱已注册，请直接登录'
      if (msg.includes('Password should be')) return '密码至少需要6位'
      if (msg.includes('Unable to validate')) return '邮箱格式不正确'
      return msg
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(160deg, #E8F6FB 0%, #F0F8FF 50%, #EAF4FF 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx 40rpx;
  box-sizing: border-box;
}

/* 顶部 Logo */
.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.logo-circle {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #A8D8EA, #7EC8E3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 40rpx rgba(79, 184, 212, 0.35);
}

.logo-emoji {
  font-size: 72rpx;
}

.app-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #3D5A6E;
  margin-bottom: 12rpx;
}

.app-slogan {
  font-size: 26rpx;
  color: #9BAAB8;
}

/* 标签切换 */
.tab-switcher {
  display: flex;
  background: #FFFFFF;
  border-radius: 100rpx;
  padding: 8rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 184, 212, 0.12);
  width: 100%;
  max-width: 600rpx;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  border-radius: 100rpx;
  font-size: 30rpx;
  color: #9BAAB8;
  transition: all 0.25s;
}

.tab-active {
  background: linear-gradient(135deg, #7EC8E3, #4FB8D4);
  color: #FFFFFF;
  font-weight: 600;
}

/* 表单卡片 */
.form-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  width: 100%;
  max-width: 600rpx;
  box-shadow: 0 8rpx 40rpx rgba(79, 184, 212, 0.15);
  box-sizing: border-box;
}

.input-group {
  margin-bottom: 36rpx;
}

.input-label {
  display: block;
  font-size: 26rpx;
  color: #9BAAB8;
  margin-bottom: 16rpx;
}

.input-field {
  width: 100%;
  height: 88rpx;
  background: #F5FBFD;
  border-radius: 20rpx;
  border: 2rpx solid #E8F4F8;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: #3D5A6E;
  box-sizing: border-box;
}

.input-field:focus {
  border-color: #4FB8D4;
  background: #EEF8FB;
}

.input-placeholder {
  color: #C8D8E4;
}

/* 错误提示 */
.error-tip {
  background: #FFF0F4;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 28rpx;
}

.error-text {
  font-size: 26rpx;
  color: #FF8BAB;
}

/* 注册成功 */
.success-tip {
  background: #E8F8F4;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-top: 20rpx;
}

.success-text {
  font-size: 26rpx;
  color: #4DBDA0;
  line-height: 1.6;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #7EC8E3, #4FB8D4);
  border-radius: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(79, 184, 212, 0.35);
  cursor: pointer;
}

.submit-btn:active {
  opacity: 0.85;
}

.submit-btn-disabled {
  opacity: 0.65;
}

.submit-text {
  font-size: 34rpx;
  font-weight: 700;
  color: #FFFFFF;
}

/* 底部 */
.login-footer {
  margin-top: auto;
  padding-top: 60rpx;
}

.footer-text {
  font-size: 24rpx;
  color: #B8CCD8;
}
</style>
