<template>
  <view class="tab-bar">
    <view
      v-for="(item, index) in tabs"
      :key="index"
      class="tab-item"
      @tap="onTabTap(index)"
    >
      <text class="tab-emoji" style="font-size:36rpx;line-height:1.2;min-height:44rpx;display:flex;align-items:center;">{{ item.emoji }}</text>
      <text :class="['tab-text', selected === index ? 'tab-text-active' : '']" style="font-size:24rpx;line-height:1.2;min-height:30rpx;">
        {{ item.text }}
      </text>
      <!-- 选中指示条 -->
      <view v-if="selected === index" class="tab-indicator"></view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CustomTabBar',
  props: {
    selected: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      tabs: [
        { text: '首页',  emoji: '🏠', path: '/pages/index/index'   },
        { text: '记账',  emoji: '✏️', path: '/pages/add/add'       },
        { text: '账单',  emoji: '📋', path: '/pages/list/list'     },
        { text: '统计',  emoji: '📊', path: '/pages/stats/stats'   },
        { text: '我的',  emoji: '🐾', path: '/pages/profile/profile'}
      ]
    }
  },
  methods: {
    onTabTap(index) {
      if (index === this.selected) return
      uni.switchTab({ url: this.tabs[index].path })
    }
  }
}
</script>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  min-height: 110rpx;
  background: #FFFFFF;
  display: flex;
  align-items: stretch;
  box-shadow: 0 -2rpx 16rpx rgba(79, 184, 212, 0.10);
  /* 安全区适配 */
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 999;
  /* 触发合成层，避免首帧闪烁 */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 12rpx 0 8rpx;
  min-height: 110rpx;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active {
  opacity: 0.7;
}

.tab-emoji {
  font-size: 36rpx;
  line-height: 1.2;
  min-height: 44rpx;
  display: flex;
  align-items: center;
  margin-bottom: 4rpx;
}

.tab-text {
  font-size: 24rpx;
  min-height: 30rpx;
  color: #9BAAB8;
  line-height: 1.2;
  font-weight: 500;
}

/* PC/H5 端字体稍大 */
@media screen and (min-width: 600px) {
  .tab-bar {
    height: 64px;
    min-height: 64px;
  }

  .tab-item {
    min-height: 64px;
  }

  .tab-emoji {
    font-size: 20px;
    min-height: 26px;
    margin-bottom: 3px;
  }

  .tab-text {
    font-size: 14px;
    min-height: 18px;
  }
}

.tab-text-active {
  color: #4FB8D4;
  font-weight: 700;
}

/* 选中指示条 */
.tab-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #7EC8E3, #4FB8D4);
  border-radius: 0 0 6rpx 6rpx;
}
</style>
