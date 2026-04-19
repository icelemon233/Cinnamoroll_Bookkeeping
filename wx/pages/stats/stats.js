// pages/stats/stats.js - 统计页（饼图 + 趋势柱状图）
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

// 分类 emoji 映射（与 add 页保持一致，覆盖全部 18 种分类）
const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
};

// 近 N 个月的 YYYY-MM 列表（包含当月）
function getRecentMonths(n) {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    result.push(`${y}-${m < 10 ? '0' + m : m}`);
  }
  return result;
}

Page({
  data: {
    // 当前浏览月份（YYYY-MM 格式，用于数据查询）
    yearMonth: '',
    // 展示用标签，如 "2026年04月"
    currentMonth: '',
    // 是否已到当月（不能再往后翻）
    isCurrentMonth: true,
    monthIncome: 0,
    monthExpense: 0,
    statsType: 'expense',     // 'expense' | 'income'
    categoryList: [],         // [{ category, amount, percent, color, emoji }]
    isEmpty: false,
    canvasSize: 600,          // canvas 边长（rpx 转 px 需乘 dpr）
    // 视图模式：'pie'（分类饼图）| 'trend'（趋势柱状图）
    viewMode: 'pie',
    // 趋势数据 [{ label, income, expense, net }]
    trendData: [],
    // 趋势图：当前高亮月份索引（-1 = 无）
    trendHighlight: -1
  },

  onLoad() {
    this._initMonth();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.loadStats();
  },

  // 初始化为当前月份
  _initMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const m = now.getMonth() + 1;
    const yearMonth = `${year}-${m < 10 ? '0' + m : m}`;
    const currentMonth = `${year}年${m < 10 ? '0' + m : m}月`;
    this.setData({ yearMonth, currentMonth, isCurrentMonth: true });
  },

  // 上一月
  prevMonth() {
    const [year, m] = this.data.yearMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = m - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const yearMonth = `${newYear}-${newMonth < 10 ? '0' + newMonth : newMonth}`;
    const currentMonth = `${newYear}年${newMonth < 10 ? '0' + newMonth : newMonth}月`;

    // 与真实当月比较，确定是否还能往后翻
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = yearMonth === nowYM;

    this.setData({ yearMonth, currentMonth, isCurrentMonth }, () => this.loadStats());
  },

  // 下一月（不能超过当前月）
  nextMonth() {
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (this.data.yearMonth >= nowYM) return; // 已是当月，不再往后翻

    const [year, m] = this.data.yearMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = m + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const yearMonth = `${newYear}-${newMonth < 10 ? '0' + newMonth : newMonth}`;
    const currentMonth = `${newYear}年${newMonth < 10 ? '0' + newMonth : newMonth}月`;
    const isCurrentMonth = yearMonth === nowYM;

    this.setData({ yearMonth, currentMonth, isCurrentMonth }, () => this.loadStats());
  },

  loadStats() {
    const { yearMonth, statsType, viewMode } = this.data;

    const summary = getMonthSummary(yearMonth);

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
      color: COLORS[i % COLORS.length],
      emoji: CATEGORY_EMOJI[item.category] || '📦'
    }));

    this.setData({
      monthIncome: summary.income,
      monthExpense: summary.expense,
      categoryList,
      isEmpty: categoryList.length === 0
    }, () => {
      if (viewMode === 'pie' && !this.data.isEmpty) {
        this.drawPieChart(categoryList);
      } else if (viewMode === 'trend') {
        this._loadTrendData();
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

  // ─── 视图模式切换 ─────────────────────────────────────

  switchViewMode(e) {
    const viewMode = e.currentTarget.dataset.mode;
    if (viewMode === this.data.viewMode) return;
    this.setData({ viewMode }, () => {
      if (viewMode === 'trend') {
        this._loadTrendData();
      } else {
        // 切回饼图，重新绘制
        if (!this.data.isEmpty) {
          this.drawPieChart(this.data.categoryList);
        }
      }
    });
  },

  // ─── 趋势数据加载 ─────────────────────────────────────

  _loadTrendData() {
    const months = getRecentMonths(6);
    const trendData = months.map(ym => {
      const summary = getMonthSummary(ym);
      const parts = ym.split('-');
      return {
        ym,
        label: `${parseInt(parts[1])}月`,
        income: summary.income,
        expense: summary.expense,
        net: summary.net
      };
    });

    this.setData({ trendData }, () => {
      this.drawTrendChart(trendData);
    });
  },

  // ─── 趋势柱状图 ───────────────────────────────────────

  drawTrendChart(trendData) {
    const query = wx.createSelectorQuery();
    query.select('#trendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          this.drawTrendChartLegacy(trendData);
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo
          ? wx.getWindowInfo().pixelRatio
          : (wx.getSystemInfoSync().pixelRatio || 2);
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._renderTrend(ctx, w, h, trendData);
      });
  },

  drawTrendChartLegacy(trendData) {
    const ctx = wx.createCanvasContext('trendCanvasLegacy', this);
    this._renderTrendLegacy(ctx, 340, 220, trendData);
    ctx.draw();
  },

  _renderTrend(ctx, w, h, trendData) {
    ctx.clearRect(0, 0, w, h);

    const padLeft = 52;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 40;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const n = trendData.length;
    if (n === 0) return;

    // 计算最大值（收入/支出取大者）
    const maxVal = trendData.reduce((max, d) => Math.max(max, d.income, d.expense), 1);

    // 每组宽度
    const groupW = chartW / n;
    const barW = Math.min(groupW * 0.28, 22);
    const barGap = Math.min(groupW * 0.06, 6);

    // 背景网格线
    ctx.strokeStyle = '#EBF7FB';
    ctx.lineWidth = 1;
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const y = padTop + chartH - (chartH * i / gridCount);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      // Y 轴标签
      const val = Math.round(maxVal * i / gridCount);
      ctx.fillStyle = '#B0C4D0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padLeft - 6, y);
    }

    // Y 轴线
    ctx.strokeStyle = '#D8EEF5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.stroke();

    // 绘制柱子
    trendData.forEach((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;

      // 支出柱（左）
      const expenseH = chartH * (d.expense / maxVal);
      const expenseX = groupX - barGap / 2 - barW;
      const expenseY = padTop + chartH - expenseH;

      // 收入柱（右）
      const incomeH = chartH * (d.income / maxVal);
      const incomeX = groupX + barGap / 2;
      const incomeY = padTop + chartH - incomeH;

      // 绘制支出柱（粉色渐变）
      if (d.expense > 0) {
        const gradExp = ctx.createLinearGradient(0, expenseY, 0, padTop + chartH);
        gradExp.addColorStop(0, '#FF8BAB');
        gradExp.addColorStop(1, '#FFCCD8');
        ctx.fillStyle = gradExp;
        this._roundRect(ctx, expenseX, expenseY, barW, expenseH, Math.min(barW / 2, 5), true, false);
      }

      // 绘制收入柱（蓝色渐变）
      if (d.income > 0) {
        const gradInc = ctx.createLinearGradient(0, incomeY, 0, padTop + chartH);
        gradInc.addColorStop(0, '#4FB8D4');
        gradInc.addColorStop(1, '#A8E0EF');
        ctx.fillStyle = gradInc;
        this._roundRect(ctx, incomeX, incomeY, barW, incomeH, Math.min(barW / 2, 5), true, false);
      }

      // X 轴月份标签
      ctx.fillStyle = '#7A9AAB';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, groupX, padTop + chartH + 8);
    });

    // 图例
    const legendY = padTop + 2;
    const legendX = padLeft + chartW - 120;
    // 支出图例
    ctx.fillStyle = '#FF8BAB';
    ctx.fillRect(legendX, legendY, 14, 10);
    ctx.fillStyle = '#7A9AAB';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('支出', legendX + 18, legendY + 5);
    // 收入图例
    ctx.fillStyle = '#4FB8D4';
    ctx.fillRect(legendX + 56, legendY, 14, 10);
    ctx.fillStyle = '#7A9AAB';
    ctx.fillText('收入', legendX + 74, legendY + 5);
  },

  // 绘制顶部圆角矩形
  _roundRect(ctx, x, y, w, h, r, fill) {
    if (h <= 0) return;
    if (h < r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  },

  _renderTrendLegacy(ctx, w, h, trendData) {
    // 旧版 canvas API 降级实现（简化版，无渐变）
    const padLeft = 48;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 36;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const n = trendData.length;
    if (n === 0) return;

    const maxVal = trendData.reduce((max, d) => Math.max(max, d.income, d.expense), 1);
    const groupW = chartW / n;
    const barW = Math.min(groupW * 0.28, 18);
    const barGap = 4;

    // 网格线
    for (let i = 0; i <= 4; i++) {
      const y = padTop + chartH - (chartH * i / 4);
      ctx.setStrokeStyle('#EBF7FB');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      const val = Math.round(maxVal * i / 4);
      ctx.setFontSize(10);
      ctx.setFillStyle('#B0C4D0');
      ctx.setTextAlign('right');
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padLeft - 4, y + 4);
    }

    trendData.forEach((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;

      if (d.expense > 0) {
        const expH = chartH * (d.expense / maxVal);
        ctx.setFillStyle('#FF8BAB');
        ctx.fillRect(groupX - barGap / 2 - barW, padTop + chartH - expH, barW, expH);
      }

      if (d.income > 0) {
        const incH = chartH * (d.income / maxVal);
        ctx.setFillStyle('#4FB8D4');
        ctx.fillRect(groupX + barGap / 2, padTop + chartH - incH, barW, incH);
      }

      ctx.setFontSize(11);
      ctx.setFillStyle('#7A9AAB');
      ctx.setTextAlign('center');
      ctx.fillText(d.label, groupX, padTop + chartH + 14);
    });
  },

  // ─── 饼图相关 ─────────────────────────────────────────

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
