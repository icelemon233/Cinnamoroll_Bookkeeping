// pages/list/list.js - 账单列表页
const { getRecords, deleteRecord, groupByDate, formatDate, exportToCSV, downloadCSV, getMonthSummary, getSearchHistory, saveSearchHistory, deleteSearchHistory, clearSearchHistory, generateMonthReport, getShareCardData } = require('../../utils/storage');

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
    // 搜索历史
    searchHistory: [],
    showSearchHistory: false,
    // 分类筛选
    filterCategory: '',       // '' = 不限，否则为分类名称
    categoryChips: [],        // [{ name, emoji, count }] 当月/搜索范围内有记录的分类
    // 排序方式
    sortMode: 'date',         // 'date'（按日期倒序）| 'amount'（按金额降序）
    // 本月 TOP 消费卡片
    topCategories: [],        // [{ category, emoji, amount, percent }] 最多3条，仅支出
    showTopCard: false,       // 当月有支出数据时显示
    // 详情弹窗
    showDetail: false,
    detailRecord: null,       // 当前查看的账单记录
    // 批量删除多选模式
    isSelectMode: false,
    selectedIds: [],          // 已选中的记录 id 列表（字符串）
    selectedCount: 0,
    // 筛选范围统计摘要
    statsSummary: null,       // { expenseCount, incomeCount, avgExpense, avgIncome, maxExpense, maxIncome, showExpense, showIncome }
    // 分享卡片
    shareCardData: null,      // getShareCardData 返回的数据
    shareCardGenerating: false // 是否正在生成卡片
  },

  onLoad() {
    this._initMonth();
    this.loadData();
    this._buildTopCategories(this.data.filterMonth);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }

    // 检查来自统计页的分类跳转筛选参数
    const app = getApp();
    const listFilter = app.globalData.listFilter;
    if (listFilter) {
      // 消费后立即清除，避免下次 onShow 重复触发
      app.globalData.listFilter = null;
      // 重置到当前月份，并应用分类+类型筛选
      this._initMonth();
      this.setData(
        { filterCategory: listFilter.category, filterType: listFilter.type || 'all' },
        () => {
          this.loadData();
          this._buildTopCategories(this.data.filterMonth);
          // 轻提示：正在筛选 xx 分类
          wx.showToast({
            title: `筛选：${listFilter.category}`,
            icon: 'none',
            duration: 1500
          });
        }
      );
      return;
    }

    this.loadData();
    this._buildTopCategories(this.data.filterMonth);
  },

  // ─── TOP 消费卡片 ─────────────────────────────────────

  /**
   * 构建当月支出 TOP 分类数据（最多3个）
   * @param {string} yearMonth - 'YYYY-MM'
   */
  _buildTopCategories(yearMonth) {
    const summary = getMonthSummary(yearMonth);
    const expenseRecords = summary.records.filter(r => r.type === 'expense');
    if (expenseRecords.length === 0) {
      this.setData({ topCategories: [], showTopCard: false });
      return;
    }

    const map = {};
    let totalExpense = 0;
    expenseRecords.forEach(r => {
      const cat = r.category || '其他';
      map[cat] = (map[cat] || 0) + (Number(r.amount) || 0);
      totalExpense += Number(r.amount) || 0;
    });

    const sorted = Object.keys(map)
      .map(category => ({
        category,
        emoji: CATEGORY_EMOJI[category] || '📦',
        amount: parseFloat(map[category].toFixed(2)),
        percent: totalExpense > 0 ? parseFloat((map[category] / totalExpense * 100).toFixed(0)) : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    // 给 TOP1 加皇冠标识
    if (sorted.length > 0) sorted[0].isTop1 = true;

    this.setData({ topCategories: sorted, showTopCard: sorted.length > 0 });
  },

  // 点击 TOP 分类卡片 → 直接触发该分类的筛选
  onTopCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    if (!category) return;
    // 切换为支出 + 对应分类
    this.setData({ filterType: 'expense', filterCategory: category }, () => this.loadData());
    // 轻触反馈
    wx.vibrateShort({ type: 'light' }).catch(() => {});
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
    this.setData({ filterMonth, currentMonthLabel, isLatestMonth, filterCategory: '' }, () => {
      this.loadData();
      this._buildTopCategories(filterMonth);
    });
  },

  // ─── 搜索 ─────────────────────────────────────────────

  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({
      searchKeyword: keyword,
      isSearchMode: keyword.length > 0,
      filterCategory: '',
      showSearchHistory: keyword.length === 0  // 输入清空时重新展示历史
    }, () => this.loadData());
  },

  clearSearch() {
    const history = getSearchHistory();
    this.setData({
      searchKeyword: '',
      isSearchMode: false,
      filterCategory: '',
      showSearchHistory: history.length > 0,
      searchHistory: history
    }, () => this.loadData());
  },

  onSearchFocus() {
    // 聚焦时展示搜索历史（若有）
    const history = getSearchHistory();
    if (history.length > 0) {
      this.setData({ showSearchHistory: true, searchHistory: history });
    }
  },

  onSearchBlur() {
    // 延迟隐藏，确保点击历史条目时事件能触发
    setTimeout(() => {
      this.setData({ showSearchHistory: false });
    }, 200);
  },

  // 点击历史搜索词：直接触发搜索
  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    if (!keyword) return;
    this.setData({
      searchKeyword: keyword,
      isSearchMode: true,
      filterCategory: '',
      showSearchHistory: false
    }, () => {
      // 将此词移到历史记录最前面
      saveSearchHistory(keyword);
      this.loadData();
    });
  },

  // 删除单条搜索历史
  onDeleteHistory(e) {
    e.stopPropagation && e.stopPropagation();
    const keyword = e.currentTarget.dataset.keyword;
    deleteSearchHistory(keyword);
    const history = getSearchHistory();
    this.setData({
      searchHistory: history,
      showSearchHistory: history.length > 0
    });
  },

  // 清空全部搜索历史
  onClearAllHistory() {
    clearSearchHistory();
    this.setData({ searchHistory: [], showSearchHistory: false });
  },

  // 搜索确认（按下键盘搜索键）
  onSearchConfirm(e) {
    const keyword = (e.detail.value || '').trim();
    if (keyword) {
      saveSearchHistory(keyword);
      this.setData({
        searchKeyword: keyword,
        isSearchMode: true,
        filterCategory: '',
        showSearchHistory: false
      }, () => this.loadData());
    }
  },

  // ─── 分类筛选 ─────────────────────────────────────────

  // 切换分类芯片（再次点击同一分类则取消选中）
  selectCategoryChip(e) {
    const name = e.currentTarget.dataset.name;
    const current = this.data.filterCategory;
    this.setData({ filterCategory: current === name ? '' : name }, () => this.loadData());
  },

  // 切换排序方式
  toggleSortMode() {
    const sortMode = this.data.sortMode === 'date' ? 'amount' : 'date';
    this.setData({ sortMode }, () => this.loadData());
    wx.vibrateShort({ type: 'light' }).catch(() => {});
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
    const { filterType, filterMonth, searchKeyword, isSearchMode, filterCategory, sortMode } = this.data;
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
      const allGroups = this._buildGroups(filtered, sortMode);
      // 计算搜索结果摘要
      let searchIncome = 0, searchExpense = 0;
      let searchMaxIncome = 0, searchMaxExpense = 0;
      let searchIncomeCount = 0, searchExpenseCount = 0;
      filtered.forEach(r => {
        const amt = Number(r.amount) || 0;
        if (r.type === 'income') {
          searchIncome += amt;
          searchIncomeCount++;
          if (amt > searchMaxIncome) searchMaxIncome = amt;
        } else {
          searchExpense += amt;
          searchExpenseCount++;
          if (amt > searchMaxExpense) searchMaxExpense = amt;
        }
      });
      const statsSummary = filtered.length > 0 ? {
        expenseCount: searchExpenseCount,
        incomeCount: searchIncomeCount,
        avgExpense: searchExpenseCount > 0 ? parseFloat((searchExpense / searchExpenseCount).toFixed(2)) : 0,
        avgIncome: searchIncomeCount > 0 ? parseFloat((searchIncome / searchIncomeCount).toFixed(2)) : 0,
        maxExpense: parseFloat(searchMaxExpense.toFixed(2)),
        maxIncome: parseFloat(searchMaxIncome.toFixed(2)),
        totalExpense: parseFloat(searchExpense.toFixed(2)),
        totalIncome: parseFloat(searchIncome.toFixed(2)),
        showExpense: searchExpenseCount > 0,
        showIncome: searchIncomeCount > 0
      } : null;
      this.setData({
        allGroups,
        totalIncome: 0,
        totalExpense: 0,
        isEmpty: allGroups.length === 0,
        searchResultCount: filtered.length,
        categoryChips,
        statsSummary
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
      const allGroups = this._buildGroups(filtered, sortMode);
      // 计算统计摘要（月份模式）
      let maxExpense = 0, maxIncome = 0, expenseCount = 0, incomeCount = 0;
      filtered.forEach(r => {
        const amt = Number(r.amount) || 0;
        if (r.type === 'income') {
          incomeCount++;
          if (amt > maxIncome) maxIncome = amt;
        } else {
          expenseCount++;
          if (amt > maxExpense) maxExpense = amt;
        }
      });
      const statsSummary = filtered.length > 0 ? {
        expenseCount,
        incomeCount,
        avgExpense: expenseCount > 0 ? parseFloat((totalExpense / expenseCount).toFixed(2)) : 0,
        avgIncome: incomeCount > 0 ? parseFloat((totalIncome / incomeCount).toFixed(2)) : 0,
        maxExpense: parseFloat(maxExpense.toFixed(2)),
        maxIncome: parseFloat(maxIncome.toFixed(2)),
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        showExpense: expenseCount > 0,
        showIncome: incomeCount > 0
      } : null;
      this.setData({
        allGroups,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        isEmpty: allGroups.length === 0,
        searchResultCount: filtered.length,
        categoryChips,
        statsSummary
      });
    }
  },

  _buildGroups(records, sortMode) {
    if (sortMode === 'amount') {
      // 按金额降序排列，不分组，以单条展示
      const sorted = records
        .slice()
        .sort((a, b) => Number(b.amount) - Number(a.amount));
      return groupByDate(sorted).map(group => ({
        ...group,
        dateLabel: formatDate(group.date),
        groupIncome: group.records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0),
        groupExpense: group.records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0),
        records: group.records
          .slice()
          .sort((a, b) => Number(b.amount) - Number(a.amount))
          .map(r => ({
            ...r,
            emoji: CATEGORY_EMOJI[r.category] || '📦',
            amountDisplay: r.type === 'income' ? `+${r.amount}` : `-${r.amount}`
          }))
      })).sort((a, b) => {
        // 按组内最大金额对日期组进行排序
        const maxA = Math.max(...a.records.map(r => Number(r.amount)));
        const maxB = Math.max(...b.records.map(r => Number(r.amount)));
        return maxB - maxA;
      });
    }
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
    // 多选模式下点击 = 切换选中
    if (this.data.isSelectMode) {
      this.onSelectToggle(e);
      return;
    }
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

  // ─── 长按操作：进入多选模式 ───────────────────────────

  onLongPress(e) {
    const id = String(e.currentTarget.dataset.id);
    if (this.data.isSelectMode) return; // 已在多选模式，忽略
    // 进入多选模式并默认选中当前条目
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
    this.setData({
      isSelectMode: true,
      selectedIds: [id],
      selectedCount: 1,
      showDetail: false,
      detailRecord: null
    });
  },

  // 多选模式下点击条目：切换选中状态
  onSelectToggle(e) {
    const id = String(e.currentTarget.dataset.id);
    let { selectedIds } = this.data;
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter(sid => sid !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    this.setData({ selectedIds, selectedCount: selectedIds.length });
  },

  // 退出多选模式
  exitSelectMode() {
    this.setData({ isSelectMode: false, selectedIds: [], selectedCount: 0 });
  },

  // 全选/取消全选
  toggleSelectAll() {
    const { allGroups, selectedIds } = this.data;
    const allIds = [];
    allGroups.forEach(g => g.records.forEach(r => allIds.push(String(r.id))));
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
    if (isAllSelected) {
      this.setData({ selectedIds: [], selectedCount: 0 });
    } else {
      this.setData({ selectedIds: allIds, selectedCount: allIds.length });
    }
  },

  // 删除选中的记录
  deleteSelected() {
    const { selectedIds } = this.data;
    if (selectedIds.length === 0) {
      wx.showToast({ title: '请先选择账单', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: `确认删除选中的 ${selectedIds.length} 条账单？`,
      confirmText: '删除',
      confirmColor: '#FF8BAB',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const { deleteRecord } = require('../../utils/storage');
          selectedIds.forEach(id => deleteRecord(id));
          wx.showToast({ title: `已删除 ${selectedIds.length} 条`, icon: 'success', duration: 1000 });
          this.setData({ isSelectMode: false, selectedIds: [], selectedCount: 0 });
          this.loadData();
          this._buildTopCategories(this.data.filterMonth);
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
      itemList: ['📊 导出为 CSV', '📒 生成月度复盘报告', '🖼️ 生成分享卡片'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._exportCSV();
        } else if (res.tapIndex === 1) {
          this._showMonthReport();
        } else if (res.tapIndex === 2) {
          this._generateShareCard();
        }
      }
    });
  },

  // ─── 分享卡片生成 ─────────────────────────────────────────────────────────

  /**
   * 生成月度账单分享卡片，保存到相册
   */
  _generateShareCard() {
    const { filterMonth, isSearchMode } = this.data;
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetYM = (!isSearchMode && filterMonth) ? filterMonth : nowYM;
    const cardData = getShareCardData(targetYM);

    if (cardData.recordCount === 0) {
      wx.showToast({ title: '本月暂无账单数据', icon: 'none' });
      return;
    }

    this.setData({ shareCardData: cardData, shareCardGenerating: true });

    wx.showLoading({ title: '生成卡片...' });

    // 延迟一帧确保 canvas 已渲染
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('#shareCardCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            wx.hideLoading();
            wx.showToast({ title: '卡片生成失败', icon: 'none' });
            this.setData({ shareCardGenerating: false });
            return;
          }
          const canvas = res[0].node;
          const W = res[0].width;
          const H = res[0].height;
          const dpr = wx.getWindowInfo
            ? wx.getWindowInfo().pixelRatio
            : (wx.getSystemInfoSync().pixelRatio || 2);
          canvas.width = W * dpr;
          canvas.height = H * dpr;
          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);

          this._drawShareCard(ctx, W, H, cardData);

          // 导出图片
          wx.canvasToTempFilePath({
            canvas,
            success: (imgRes) => {
              wx.hideLoading();
              this.setData({ shareCardGenerating: false });
              this._previewAndSaveCard(imgRes.tempFilePath);
            },
            fail: () => {
              wx.hideLoading();
              this.setData({ shareCardGenerating: false });
              wx.showToast({ title: '导出图片失败', icon: 'none' });
            }
          }, this);
        });
    });
  },

  /**
   * 预览并提示保存
   */
  _previewAndSaveCard(tempFilePath) {
    wx.showActionSheet({
      itemList: ['💾 保存到相册', '📱 预览图片'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._saveCardToAlbum(tempFilePath);
        } else if (res.tapIndex === 1) {
          wx.previewImage({ urls: [tempFilePath], current: tempFilePath });
        }
      }
    });
  },

  /**
   * 保存卡片到相册
   */
  _saveCardToAlbum(tempFilePath) {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: () => {
        wx.showToast({ title: '已保存到相册 ✨', icon: 'success', duration: 2000 });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中开启相册权限',
            confirmText: '去开启',
            success: (r) => {
              if (r.confirm) wx.openSetting();
            }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * Canvas 绘制分享卡片（Cinnamoroll 风格）
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W - 画布实际宽度(px)
   * @param {number} H - 画布实际高度(px)
   * @param {object} data - getShareCardData 返回的数据
   */
  _drawShareCard(ctx, W, H, data) {
    const { monthLabel, totalExpense, totalIncome, topCategories, recordCount, tipText } = data;

    // ─── 背景渐变 ───
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#E8F5FC');
    bg.addColorStop(0.5, '#D6EEF8');
    bg.addColorStop(1, '#C8E6F5');
    ctx.fillStyle = bg;
    this._roundRect(ctx, 0, 0, W, H, 24);
    ctx.fill();

    // ─── 顶部装饰带 ───
    const topBar = ctx.createLinearGradient(0, 0, W, 0);
    topBar.addColorStop(0, '#4FB8D4');
    topBar.addColorStop(0.5, '#7EC8E3');
    topBar.addColorStop(1, '#9DC3E6');
    ctx.fillStyle = topBar;
    this._roundRect(ctx, 0, 0, W, 72, 24, 24, 0, 0);
    ctx.fill();

    // App 名称 + Cinnamoroll
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🐾 Cinnamoroll 记账', 24, 42);
    // 子标题
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('财务小卡片', W - 80, 42);

    // ─── 月份标题 ───
    ctx.fillStyle = '#2A7A9A';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(monthLabel, W / 2, 116);

    // 小点装饰
    ctx.fillStyle = '#7EC8E3';
    ctx.beginPath();
    ctx.arc(W / 2 - 68, 116, 3, 0, Math.PI * 2);
    ctx.arc(W / 2 + 68, 116, 3, 0, Math.PI * 2);
    ctx.fill();

    // ─── 支出 / 收入卡片区域 ───
    const cardY = 134;
    const cardH = 88;
    const halfW = (W - 48 - 12) / 2;

    // 支出卡
    this._drawAmountCard(ctx, 16, cardY, halfW, cardH, '支出', `¥${totalExpense}`, '#FF8BAB', '#FFF0F4');
    // 收入卡
    this._drawAmountCard(ctx, 16 + halfW + 12, cardY, halfW, cardH, '收入', `¥${totalIncome}`, '#4FB8D4', '#EFF9FD');

    // ─── TOP 分类标题 ───
    const secY = cardY + cardH + 20;
    ctx.fillStyle = '#2A7A9A';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📊 Top 支出分类', 20, secY);

    ctx.strokeStyle = '#B8E0F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, secY + 8);
    ctx.lineTo(W - 20, secY + 8);
    ctx.stroke();

    // 分类条目
    const barX = 20;
    const barW = W - 40;
    topCategories.forEach((cat, i) => {
      const rowY = secY + 22 + i * 42;

      // 分类名 + emoji
      ctx.fillStyle = '#3A6A80';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cat.emoji} ${cat.name}`, barX, rowY + 14);

      // 金额
      ctx.fillStyle = '#2A7A9A';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`¥${cat.amount}`, W - 20, rowY + 14);

      // 进度条背景
      ctx.fillStyle = '#E0EFF5';
      this._roundRect(ctx, barX, rowY + 20, barW, 8, 4);
      ctx.fill();

      // 进度条充展
      const fillW = Math.max(barW * (cat.percent / 100), 8);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      barGrad.addColorStop(0, '#4FB8D4');
      barGrad.addColorStop(1, '#7EC8E3');
      ctx.fillStyle = barGrad;
      this._roundRect(ctx, barX, rowY + 20, fillW, 8, 4);
      ctx.fill();

      // 百分比标注
      ctx.fillStyle = '#4FB8D4';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cat.percent}%`, barX + fillW + 4, rowY + 29);
    });

    // ─── 底部小尾巴区域 ───
    const footerY = H - 56;
    const footerGrad = ctx.createLinearGradient(0, footerY, 0, H);
    footerGrad.addColorStop(0, 'rgba(79,184,212,0.10)');
    footerGrad.addColorStop(1, 'rgba(79,184,212,0.22)');
    ctx.fillStyle = footerGrad;
    this._roundRect(ctx, 16, footerY, W - 32, 40, 12);
    ctx.fill();

    // 条数提示 + tip
    ctx.fillStyle = '#3A7A96';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tipText, W / 2, footerY + 26);

    // 共 N 笔记录
    ctx.fillStyle = 'rgba(79,184,212,0.7)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`共 ${recordCount} 笔`, W - 20, footerY - 6);
  },

  /**
   * 绘制单个金额卡片（支出或收入）
   */
  _drawAmountCard(ctx, x, y, w, h, label, amountText, accentColor, bgColor) {
    // 卡片背景
    ctx.fillStyle = bgColor;
    this._roundRect(ctx, x, y, w, h, 14);
    ctx.fill();

    // 左侧彩色条
    ctx.fillStyle = accentColor;
    this._roundRect(ctx, x, y + 12, 4, h - 24, 2);
    ctx.fill();

    // 标题
    ctx.fillStyle = '#7A9AAA';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 14, y + 30);

    // 金额
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${amountText.length > 8 ? '18' : '22'}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(amountText, x + 14, y + 62);
  },

  /**
   * 带圆角矩形路径（支持单独设置四角）
   */
  _roundRect(ctx, x, y, w, h, r, rTR, rBR, rBL) {
    const tl = r, tr = rTR !== undefined ? rTR : r;
    const br = rBR !== undefined ? rBR : r, bl = rBL !== undefined ? rBL : r;
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  },

  /**
   * 生成月度复盘报告并弹窗展示，支持一键复制
   */
  _showMonthReport() {
    const { filterMonth, isSearchMode } = this.data;
    // 搜索模式下使用当前月；否则用列表正在浏览的月份
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetYM = (!isSearchMode && filterMonth) ? filterMonth : nowYM;

    const reportText = generateMonthReport(targetYM);

    // 先展示复制确认弹窗
    wx.showModal({
      title: '📒 月度复盘报告',
      content: reportText,
      confirmText: '复制报告',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: reportText,
            success: () => {
              wx.showToast({ title: '已复制到剪贴板 ✨', icon: 'none', duration: 1800 });
            },
            fail: () => {
              wx.showToast({ title: '复制失败，请重试', icon: 'none' });
            }
          });
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
