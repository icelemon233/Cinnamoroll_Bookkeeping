<template>
  <view class="main-container">
    <!-- 导航栏（只渲染一次，永不销毁） -->
    <view class="ctb-bar">
      <view
        v-for="(item, index) in tabs"
        :key="index"
        class="ctb-item"
        @tap="switchTab(index)"
      >
        <text class="ctb-emoji">{{ item.emoji }}</text>
        <text :class="['ctb-text', currentTab === index ? 'ctb-text-active' : '']">
          {{ item.text }}
        </text>
        <view v-if="currentTab === index" class="ctb-indicator"></view>
      </view>
    </view>

    <!-- 内容区（v-show 切换，组件不销毁） -->
    <view class="content-area">
      <index-page v-show="currentTab === 0" ref="indexPage" @switch-tab="switchTab" />
      <add-page v-show="currentTab === 1" ref="addPage" />
      <list-page v-show="currentTab === 2" ref="listPage" @switch-tab="switchTab" />
      <stats-page v-show="currentTab === 3" ref="statsPage" />
      <profile-page v-show="currentTab === 4" ref="profilePage" @switch-tab="switchTab" />
    </view>
  </view>
</template>

<script>
import IndexPage from '@/components/tab-pages/index-page.vue'
import AddPage from '@/components/tab-pages/add-page.vue'
import ListPage from '@/components/tab-pages/list-page.vue'
import StatsPage from '@/components/tab-pages/stats-page.vue'
import ProfilePage from '@/components/tab-pages/profile-page.vue'

export default {
  components: {
    IndexPage,
    AddPage,
    ListPage,
    StatsPage,
    ProfilePage
  },
  data() {
    return {
      currentTab: 0,
      tabs: [
        { text: '首页', emoji: '🏠' },
        { text: '记账', emoji: '✏️' },
        { text: '账单', emoji: '📋' },
        { text: '统计', emoji: '📊' },
        { text: '我的', emoji: '🐾' }
      ]
    }
  },
  onShow() {
    // 切换到对应 tab 时触发子组件的数据刷新
    this.$nextTick(() => {
      const refs = ['indexPage', 'addPage', 'listPage', 'statsPage', 'profilePage']
      const ref = refs[this.currentTab]
      if (this.$refs[ref] && typeof this.$refs[ref].onShow === 'function') {
        this.$refs[ref].onShow()
      }
    })
  },
  methods: {
    switchTab(index, options) {
      if (index === this.currentTab && !options) return
      this.currentTab = index
      // 触发子组件的 onShow 生命周期，并传递可选参数（如快速记收入）
      this.$nextTick(() => {
        const refs = ['indexPage', 'addPage', 'listPage', 'statsPage', 'profilePage']
        const ref = refs[index]
        if (this.$refs[ref]) {
          // 如果传了 options（如 { type: 'income' }），调用 onLoad 初始化状态
          if (options && index === 1 && typeof this.$refs[ref].onLoad === 'function') {
            this.$refs[ref].onLoad(options)
          } else if (typeof this.$refs[ref].onShow === 'function') {
            this.$refs[ref].onShow()
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.main-container {
  min-height: 100vh;
  background: #F0F8FF;
}

.content-area {
  padding-bottom: 120rpx; /* 为导航栏留出空间 */
}

/* 导航栏样式（直接写在 main.vue 中，确保只加载一次） */
.ctb-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  box-sizing: border-box;
  height: 110rpx;
  background: #FFFFFF;
  display: flex;
  align-items: stretch;
  box-shadow: 0 -2rpx 16rpx rgba(79, 184, 212, 0.10);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 999;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.ctb-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 12rpx 0 8rpx;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ctb-item:active {
  opacity: 0.7;
}

.ctb-emoji {
  font-size: 36rpx;
  line-height: 1.2;
  margin-bottom: 4rpx;
}

.ctb-text {
  font-size: 24rpx;
  color: #9BAAB8;
  line-height: 1.2;
  font-weight: 500;
}

.ctb-text-active {
  color: #4FB8D4;
  font-weight: 700;
}

.ctb-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #7EC8E3, #4FB8D4);
  border-radius: 0 0 6rpx 6rpx;
}

@media screen and (min-width: 600px) {
  .ctb-bar {
    height: 64px;
  }
  .ctb-emoji {
    font-size: 20px;
    margin-bottom: 3px;
  }
  .ctb-text {
    font-size: 14px;
  }
}
</style>
