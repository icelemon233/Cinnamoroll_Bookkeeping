// pages/add/add.js - 记账页（支持新增和编辑两种模式）
const { saveRecord, updateRecord, getRecordById } = require('../../utils/storage');

const EXPENSE_CATEGORIES = [
  { name: '餐饮', emoji: '🍜' },
  { name: '交通', emoji: '🚌' },
  { name: '购物', emoji: '🛍️' },
  { name: '娱乐', emoji: '🎮' },
  { name: '住房', emoji: '🏠' },
  { name: '医疗', emoji: '💊' },
  { name: '教育', emoji: '📚' },
  { name: '运动', emoji: '🏃' },
  { name: '旅行', emoji: '✈️' },
  { name: '宠物', emoji: '🐾' },
  { name: '日用', emoji: '🧴' },
  { name: '其他', emoji: '📦' }
];

const INCOME_CATEGORIES = [
  { name: '工资', emoji: '💼' },
  { name: '奖金', emoji: '🎁' },
  { name: '副业', emoji: '💡' },
  { name: '理财', emoji: '📈' },
  { name: '红包', emoji: '🧧' },
  { name: '其他', emoji: '📦' }
];

// emoji 映射表（供 wxml 等外部使用）
const CATEGORY_EMOJI = {};
[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].forEach(c => {
  CATEGORY_EMOJI[c.name] = c.emoji;
});

Page({
  data: {
    isEditMode: false,           // 是否为编辑模式
    editRecordId: null,          // 编辑时的记录 id
    type: 'expense',             // 'expense' | 'income'
    categories: EXPENSE_CATEGORIES,
    selectedCategory: '餐饮',
    amountStr: '',               // 金额字符串（数字键盘输入）
    note: '',
    date: '',                    // YYYY-MM-DD
    showKeyboard: true
  },

  onLoad(options) {
    // 支持从外部携带 type 参数
    if (options.type === 'income') {
      this.setData({
        type: 'income',
        categories: INCOME_CATEGORIES,
        selectedCategory: '工资'
      });
    }

    // 编辑模式：从 options 中读取 recordId
    if (options.recordId) {
      const record = getRecordById(options.recordId);
      if (record) {
        const cats = record.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        this.setData({
          isEditMode: true,
          editRecordId: record.id,
          type: record.type,
          categories: cats,
          selectedCategory: record.category,
          amountStr: String(record.amount),
          note: record.note || '',
          date: record.date
        });
        wx.setNavigationBarTitle({ title: '编辑记录' });
        return;
      }
    }

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({ date });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  // 切换收入/支出
  switchType(e) {
    const type = e.currentTarget.dataset.type;
    const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const selectedCategory = categories[0].name;
    this.setData({ type, categories, selectedCategory });
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ selectedCategory: category });
  },

  // 数字键盘点击
  pressKey(e) {
    const key = e.currentTarget.dataset.key;
    let { amountStr } = this.data;

    if (key === 'del') {
      amountStr = amountStr.slice(0, -1);
    } else if (key === '.') {
      // 只允许一个小数点，且小数位最多2位
      if (amountStr.includes('.')) return;
      if (amountStr === '') amountStr = '0';
      amountStr += '.';
    } else {
      // 限制整数部分最多7位，小数部分最多2位
      if (amountStr.includes('.')) {
        const parts = amountStr.split('.');
        if (parts[1].length >= 2) return;
      } else {
        if (amountStr.length >= 7) return;
      }
      // 防止多个前导零
      if (amountStr === '0') {
        amountStr = key;
      } else {
        amountStr += key;
      }
    }
    this.setData({ amountStr });
  },

  // 备注输入
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  // 保存/更新记录
  saveRecord() {
    const { isEditMode, editRecordId, type, selectedCategory, amountStr, note, date } = this.data;
    const amount = parseFloat(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效金额 🐾', icon: 'none' });
      return;
    }

    if (isEditMode && editRecordId) {
      // 编辑模式：更新已有记录
      const patch = { type, category: selectedCategory, amount, note: note.trim(), date };
      const { success } = updateRecord(editRecordId, patch);
      if (success) {
        wx.showToast({ title: '修改成功 ✨', icon: 'success', duration: 1200 });
        setTimeout(() => {
          wx.navigateBack({ delta: 1 });
        }, 800);
      } else {
        wx.showToast({ title: '修改失败，记录不存在', icon: 'none' });
      }
      return;
    }

    // 新增模式
    const record = {
      id: Date.now(),
      type,
      category: selectedCategory,
      amount,
      note: note.trim(),
      date
    };

    saveRecord(record);

    wx.showToast({
      title: '记录成功 🎉',
      icon: 'success',
      duration: 1200
    });

    // 重置表单
    setTimeout(() => {
      this.setData({
        amountStr: '',
        note: '',
        type: 'expense',
        categories: EXPENSE_CATEGORIES,
        selectedCategory: '餐饮'
      });
    }, 500);
  }
});
