// app.js - 全局 App，初始化数据存储
App({
  onLaunch() {
    // 初始化本地存储，确保 records 字段存在
    const records = wx.getStorageSync('records');
    if (!records) {
      wx.setStorageSync('records', []);
    }
    console.log('Cinnamoroll 记账本启动 🐾');
  },

  globalData: {
    userInfo: null,
    // 支出分类配置
    expenseCategories: [
      { name: '餐饮', emoji: '🍜' },
      { name: '交通', emoji: '🚌' },
      { name: '购物', emoji: '🛍️' },
      { name: '娱乐', emoji: '🎮' },
      { name: '其他', emoji: '📦' }
    ],
    // 收入分类配置
    incomeCategories: [
      { name: '工资', emoji: '💼' },
      { name: '其他', emoji: '📦' }
    ],
    // 颜色配置（用于统计图表）
    categoryColors: {
      '餐饮': '#7EC8E3',
      '交通': '#A8D8EA',
      '购物': '#B8E0FF',
      '娱乐': '#9DC3E6',
      '工资': '#4FB8D4',
      '其他': '#C9E8F0'
    }
  }
});
