// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', emoji: '🏠' },
      { pagePath: '/pages/add/add', text: '记账', emoji: '✏️' },
      { pagePath: '/pages/list/list', text: '账单', emoji: '📋' },
      { pagePath: '/pages/stats/stats', text: '统计', emoji: '📊' }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
      this.setData({ selected: data.index });
    }
  }
});
