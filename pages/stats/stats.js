// pages/stats/stats.js - 统计页（canvas 饼图）
const { getCategoryStats, getMonthSummary } = require('../../utils/storage');

// 饼图颜色（Cinnamoroll 蓝色系列）
const COLORS = [
  '#4FB8D4', // 主蓝
  '#7EC8E3', // 浅蓝
  '#A8D8EA', // 更浅蓝
  '#9DC3E6', // 蓝灰
  '#B8E0FF', // 天蓝
  '#C9E8F0', // 淡蓝
  '#5BA3C9', // 深蓝
  '#88C8D8'  // 中蓝
];

Page({
  data: {
    currentMonth: '',
    monthIncome: 0,
    monthExpense: 0,
    statsType: 'expense',     // 'expense' | 'income'
    categoryList: [],         // [{ category, amount, percent, color }]
    isEmpty: false,
    canvasSize: 600           // canvas 边长（rpx 转 px 需乘 dpr）
  },

  onLoad() {
    const now = new Date();
    const year = now.getFullYear();
    const m = now.getMonth() + 1;
    const monthLabel = `${year}年${m < 10 ? '0' + m : m}月`;
    this.setData({ currentMonth: monthLabel });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.loadStats();
  },

  loadStats() {
    const now = new Date();
    const year = now.getFullYear();
    const m = now.getMonth() + 1;
    const yearMonth = `${year}-${m < 10 ? '0' + m : m}`;

    const summary = getMonthSummary(yearMonth);
    const { statsType } = this.data;

    // 获取各分类统计
    let catList = [];
    if (statsType === 'expense') {
      const expenseRecords = summary.records.filter(r => r.type === 'expense');
      catList = this._buildCatList(expenseRecords);
    } else {
      const incomeRecords = summary.records.filter(r => r.type === 'income');
      catList = this._buildCatList(incomeRecords);
    }

    const categoryList = catList.map((item, i) => ({
      ...item,
      color: COLORS[i % COLORS.length]
    }));

    this.setData({
      monthIncome: summary.income,
      monthExpense: summary.expense,
      categoryList,
      isEmpty: categoryList.length === 0
    }, () => {
      if (!this.data.isEmpty) {
        this.drawPieChart(categoryList);
      }
    });
  },

  _buildCatList(records) {
    const map = {};
    let total = 0;
    records.forEach(r => {
      const cat = r.category || '其他';
      map[cat] = (map[cat] || 0) + (Number(r.amount) || 0);
      total += Number(r.amount) || 0;
    });
    if (total === 0) return [];
    return Object.keys(map)
      .map(category => ({
        category,
        amount: parseFloat(map[category].toFixed(2)),
        percent: parseFloat((map[category] / total * 100).toFixed(1))
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  // 切换支出/收入
  switchStatsType(e) {
    const statsType = e.currentTarget.dataset.type;
    this.setData({ statsType }, () => this.loadStats());
  },

  // 绘制 Canvas 饼图
  drawPieChart(categoryList) {
    const query = wx.createSelectorQuery();
    query.select('#pieCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          // 降级使用旧 canvas API
          this.drawPieChartLegacy(categoryList);
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : (wx.getSystemInfoSync().pixelRatio || 2);
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._renderPie(ctx, w, h, categoryList);
      });
  },

  drawPieChartLegacy(categoryList) {
    const ctx = wx.createCanvasContext('pieCanvasLegacy', this);
    const size = 300; // 逻辑像素
    this._renderPieLegacy(ctx, size, size, categoryList);
    ctx.draw();
  },

  _renderPie(ctx, w, h, categoryList) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 20;

    ctx.clearRect(0, 0, w, h);

    let startAngle = -Math.PI / 2;
    const total = categoryList.reduce((s, i) => s + i.amount, 0);

    categoryList.forEach((item, i) => {
      const sweep = (item.amount / total) * 2 * Math.PI;
      const endAngle = startAngle + sweep;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();

      // 扇区之间绘制白色分隔线
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      startAngle = endAngle;
    });

    // 中间挖空（甜甜圈效果）
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.48, 0, 2 * Math.PI);
    ctx.fillStyle = '#F0F8FF';
    ctx.fill();

    // 中心文字
    ctx.fillStyle = '#3D5A6E';
    ctx.font = `bold ${Math.floor(radius * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐾', cx, cy - radius * 0.08);
    ctx.font = `${Math.floor(radius * 0.14)}px sans-serif`;
    ctx.fillStyle = '#9BAAB8';
    ctx.fillText(`${categoryList.length} 分类`, cx, cy + radius * 0.15);
  },

  _renderPieLegacy(ctx, w, h, categoryList) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 12;
    let startAngle = -Math.PI / 2;
    const total = categoryList.reduce((s, i) => s + i.amount, 0);

    categoryList.forEach((item, i) => {
      const sweep = (item.amount / total) * 2 * Math.PI;
      const endAngle = startAngle + sweep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.setFillStyle(COLORS[i % COLORS.length]);
      ctx.fill();
      ctx.setStrokeStyle('#FFFFFF');
      ctx.setLineWidth(2);
      ctx.stroke();
      startAngle = endAngle;
    });

    // 中心圆（挖空）
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, 2 * Math.PI);
    ctx.setFillStyle('#F0F8FF');
    ctx.fill();

    ctx.setFontSize(24);
    ctx.setFillStyle('#9BAAB8');
    ctx.setTextAlign('center');
    ctx.fillText('🐾', cx, cy + 8);
  }
});
