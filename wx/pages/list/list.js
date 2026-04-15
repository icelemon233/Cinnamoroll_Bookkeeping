// pages/list/list.js - 账单列表页
const { getRecords, deleteRecord, groupByDate, formatDate, exportToCSV, downloadCSV } = require('../../utils/storage');

// 分类 emoji 映射（与 add 页保持一致）
const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
};

Page({
  data: {
    allGroups: [],
    filterType: 'all',       // 'all' | 'expense' | 'income'
    totalIncome: 0,
    totalExpense: 0,
    isEmpty: false,
    filterMonth: '',          // 'YYYY-MM'
    currentMonthLabel: '',
    isLatestMonth: true,
    // 搜索
    searchKeyword: '',
    isSearchMode: false,
    searchResultCount: 0
  },

  onLoad() {
    this._initMonth();
    this.loadData();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadData();
  },

  // ─── 月份导航 ────────────────────────────────────────

  _initMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const m = now.getMonth() + 1;
    const filterMonth = `${year}-${m < 10 ? '0' + m : m}`;
    const currentMonthLabel = `${year}年${m < 10 ? '0' + m : m}月`;
    this.setData({ filterMonth, currentMonthLabel, isLatestMonth: true });
  },

  prevMonth() {
    if (this.data.isSearchMode) return;
    const { filterMonth } = this.data;
    const [year, m] = filterMonth.split('-').map(Number);
    let newYear = year, newMonth = m - 1;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    this._setMonth(newYear, newMonth);
  },

  nextMonth() {
    if (this.data.isSearchMode) return;
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (this.data.filterMonth >= nowYM) return;
    const [year, m] = this.data.filterMonth.split('-').map(Number);
    let newYear = year, newMonth = m + 1;
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    this._setMonth(newYear, newMonth);
  },

  _setMonth(year, month) {
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const filterMonth = `${year}-${month < 10 ? '0' + month : month}`;
    const currentMonthLabel = `${year}年${month < 10 ? '0' + month : month}月`;
    const isLatestMonth = filterMonth >= nowYM;
    this.setData({ filterMonth, currentMonthLabel, isLatestMonth }, () => this.loadData());
  },

  // ─── 搜索 ─────────────────────────────────────────────

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword, isSearchMode: keyword.length > 0 }, () => this.loadData());
  },

  clearSearch() {
    this.setData({ searchKeyword: '', isSearchMode: false }, () => this.loadData());
  },

  onSearchFocus() {
    // 聚焦时不切换搜索模式，等有输入才切
  },

  // ─── 数据加载 ─────────────────────────────────────────

  loadData() {
    const { filterType, filterMonth, searchKeyword, isSearchMode } = this.data;
    let records = getRecords();

    if (isSearchMode && searchKeyword) {
      // 搜索模式：跨月全局搜索，匹配备注/分类/金额
      const kw = searchKeyword.toLowerCase();
      records = records.filter(r =>
        (r.note && r.note.toLowerCase().includes(kw)) ||
        (r.category && r.category.toLowerCase().includes(kw)) ||
        (String(r.amount) && String(r.amount).includes(kw))
      );
      // 叠加类型筛选
      let filtered = records;
      if (filterType !== 'all') {
        filtered = records.filter(r => r.type === filterType);
      }
      const allGroups = this._buildGroups(filtered);
      this.setData({
        allGroups,
        totalIncome: 0,
        totalExpense: 0,
        isEmpty: allGroups.length === 0,
        searchResultCount: filtered.length
      });
    } else {
      // 月份模式
      if (filterMonth) {
        records = records.filter(r => r.date && r.date.startsWith(filterMonth));
      }
      let filtered = records;
      if (filterType !== 'all') {
        filtered = records.filter(r => r.type === filterType);
      }
      let totalIncome = 0, totalExpense = 0;
      records.forEach(r => {
        if (r.type === 'income') totalIncome += Number(r.amount) || 0;
        else totalExpense += Number(r.amount) || 0;
      });
      const allGroups = this._buildGroups(filtered);
      this.setData({
        allGroups,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        isEmpty: allGroups.length === 0,
        searchResultCount: filtered.length
      });
    }
  },

  _buildGroups(records) {
    return groupByDate(records).map(group => ({
      ...group,
      dateLabel: formatDate(group.date),
      groupIncome: group.records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0),
      groupExpense: group.records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0),
      records: group.records.map(r => ({
        ...r,
        emoji: CATEGORY_EMOJI[r.category] || '📦',
        amountDisplay: r.type === 'income' ? `+${r.amount}` : `-${r.amount}`
      }))
    }));
  },

  // ─── 筛选 ─────────────────────────────────────────────

  switchFilter(e) {
    const filterType = e.currentTarget.dataset.type;
    this.setData({ filterType }, () => this.loadData());
  },

  // ─── 长按操作 ─────────────────────────────────────────

  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['✏️ 编辑', '🗑️ 删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/add/add?recordId=${id}` });
        } else if (res.tapIndex === 1) {
          this._confirmDelete(id);
        }
      }
    });
  },

  _confirmDelete(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除这条账单记录？',
      confirmText: '删除',
      confirmColor: '#FF8BAB',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          deleteRecord(id);
          wx.showToast({ title: '已删除', icon: 'success', duration: 800 });
          this.loadData();
        }
      }
    });
  },

  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  },

  // ─── 导出功能 ─────────────────────────────────────────

  onExport() {
    wx.showActionSheet({
      itemList: ['📊 导出为 CSV'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._exportCSV();
        }
      }
    });
  },

  _exportCSV() {
    const { filterType, filterMonth, isSearchMode, searchKeyword } = this.data;
    let records = getRecords();

    // 应用筛选条件
    if (isSearchMode && searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      records = records.filter(r =>
        (r.note && r.note.toLowerCase().includes(kw)) ||
        (r.category && r.category.toLowerCase().includes(kw)) ||
        (String(r.amount) && String(r.amount).includes(kw))
      );
    } else if (filterMonth) {
      records = records.filter(r => r.date && r.date.startsWith(filterMonth));
    }

    if (filterType !== 'all') {
      records = records.filter(r => r.type === filterType);
    }

    if (!records || records.length === 0) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' });
      return;
    }

    const csvContent = exportToCSV(records);
    const filename = `账单_${filterMonth || '全部'}_${Date.now()}.csv`;
    downloadCSV(csvContent, filename);
  }
});
