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
    searchResultCount: 0,
    // 分类筛选
    filterCategory: '',       // '' = 不限，否则为分类名称
    categoryChips: [],        // [{ name, emoji, count }] 当月/搜索范围内有记录的分类
    // 详情弹窗
    showDetail: false,
    detailRecord: null        // 当前查看的账单记录
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
    // 切换月份时重置分类筛选
    this.setData({ filterMonth, currentMonthLabel, isLatestMonth, filterCategory: '' }, () => this.loadData());
  },

  // ─── 搜索 ─────────────────────────────────────────────

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword, isSearchMode: keyword.length > 0, filterCategory: '' }, () => this.loadData());
  },

  clearSearch() {
    this.setData({ searchKeyword: '', isSearchMode: false, filterCategory: '' }, () => this.loadData());
  },

  onSearchFocus() {
    // 聚焦时不切换搜索模式，等有输入才切
  },

  // ─── 分类筛选 ─────────────────────────────────────────

  // 切换分类芯片（再次点击同一分类则取消选中）
  selectCategoryChip(e) {
    const name = e.currentTarget.dataset.name;
    const current = this.data.filterCategory;
    this.setData({ filterCategory: current === name ? '' : name }, () => this.loadData());
  },

  // 根据当前月份/搜索范围构建分类芯片列表
  _buildCategoryChips(records) {
    const map = {};
    records.forEach(r => {
      const cat = r.category || '其他';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.keys(map)
      .map(name => ({ name, emoji: CATEGORY_EMOJI[name] || '📦', count: map[name] }))
      .sort((a, b) => b.count - a.count);
  },

  // ─── 数据加载 ─────────────────────────────────────────

  loadData() {
    const { filterType, filterMonth, searchKeyword, isSearchMode, filterCategory } = this.data;
    let records = getRecords();

    if (isSearchMode && searchKeyword) {
      // 搜索模式：跨月全局搜索，匹配备注/分类/金额
      const kw = searchKeyword.toLowerCase();
      records = records.filter(r =>
        (r.note && r.note.toLowerCase().includes(kw)) ||
        (r.category && r.category.toLowerCase().includes(kw)) ||
        (String(r.amount) && String(r.amount).includes(kw))
      );
      // 构建分类芯片（基于搜索结果）
      const categoryChips = this._buildCategoryChips(records);
      // 叠加类型筛选
      let filtered = records;
      if (filterType !== 'all') {
        filtered = filtered.filter(r => r.type === filterType);
      }
      // 叠加分类筛选
      if (filterCategory) {
        filtered = filtered.filter(r => r.category === filterCategory);
      }
      const allGroups = this._buildGroups(filtered);
      this.setData({
        allGroups,
        totalIncome: 0,
        totalExpense: 0,
        isEmpty: allGroups.length === 0,
        searchResultCount: filtered.length,
        categoryChips
      });
    } else {
      // 月份模式
      if (filterMonth) {
        records = records.filter(r => r.date && r.date.startsWith(filterMonth));
      }
      // 构建分类芯片（基于当月全量数据，不受类型/分类筛选影响）
      const categoryChips = this._buildCategoryChips(records);
      let filtered = records;
      if (filterType !== 'all') {
        filtered = filtered.filter(r => r.type === filterType);
      }
      // 叠加分类筛选
      if (filterCategory) {
        filtered = filtered.filter(r => r.category === filterCategory);
      }
      let totalIncome = 0, totalExpense = 0;
      filtered.forEach(r => {
        if (r.type === 'income') totalIncome += Number(r.amount) || 0;
        else totalExpense += Number(r.amount) || 0;
      });
      const allGroups = this._buildGroups(filtered);
      this.setData({
        allGroups,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        isEmpty: allGroups.length === 0,
        searchResultCount: filtered.length,
        categoryChips
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
    // 切换收入/支出类型时重置分类筛选
    this.setData({ filterType, filterCategory: '' }, () => this.loadData());
  },

  // ─── 详情弹窗 ─────────────────────────────────────────

  onRecordTap(e) {
    const { id } = e.currentTarget.dataset;
    let targetRecord = null;
    for (const group of this.data.allGroups) {
      const found = group.records.find(r => String(r.id) === String(id));
      if (found) { targetRecord = found; break; }
    }
    if (!targetRecord) return;
    this.setData({ showDetail: true, detailRecord: targetRecord });
  },

  closeDetail() {
    this.setData({ showDetail: false, detailRecord: null });
  },

  onDetailEdit() {
    const { detailRecord } = this.data;
    if (!detailRecord) return;
    this.setData({ showDetail: false, detailRecord: null });
    wx.navigateTo({ url: `/pages/add/add?recordId=${detailRecord.id}` });
  },

  onDetailDelete() {
    const { detailRecord } = this.data;
    if (!detailRecord) return;
    wx.showModal({
      title: '确认删除',
      content: '删除这条账单记录？',
      confirmText: '删除',
      confirmColor: '#FF8BAB',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          deleteRecord(detailRecord.id);
          this.setData({ showDetail: false, detailRecord: null });
          wx.showToast({ title: '已删除', icon: 'success', duration: 800 });
          this.loadData();
        }
      }
    });
  },

  onMaskTap() {
    this.setData({ showDetail: false, detailRecord: null });
  },

  onCardTap() {},

  // ─── 长按操作（兼容保留） ─────────────────────────────

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
    const { filterType, filterMonth, isSearchMode, searchKeyword, filterCategory } = this.data;
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

    // 应用分类筛选
    if (filterCategory) {
      records = records.filter(r => r.category === filterCategory);
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
