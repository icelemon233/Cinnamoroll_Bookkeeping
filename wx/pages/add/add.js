// pages/add/add.js - 记账页（支持新增和编辑两种模式）
const { saveRecord, updateRecord, getRecordById, getTodaySummary, getRecentCategoryRecords } = require('../../utils/storage');

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

// 各分类对应的常用备注快捷标签
const QUICK_NOTES = {
  // 支出分类
  '餐饮': ['午餐', '早餐', '晚餐', '聚餐', '外卖', '下午茶', '夜宵'],
  '交通': ['打车', '地铁', '公交', '加油', '高铁', '停车费', '共享单车'],
  '购物': ['日常购物', '网购', '超市', '服装', '数码', '书籍'],
  '娱乐': ['电影', 'KTV', '游戏', '演唱会', '展览', '桌游'],
  '住房': ['房租', '水费', '电费', '燃气费', '物业费', '宽带'],
  '医疗': ['看病', '买药', '体检', '口腔', '眼科'],
  '教育': ['课程', '培训', '书本', '文具', '考试报名'],
  '运动': ['健身房', '游泳', '羽毛球', '跑步装备', '瑜伽'],
  '旅行': ['机票', '酒店', '景区门票', '餐饮', '纪念品'],
  '宠物': ['猫粮', '狗粮', '零食', '玩具', '宠物医院', '洗澡美容'],
  '日用': ['洗护用品', '纸巾', '清洁用品', '厨房用品', '收纳'],
  '其他': ['零花钱', '转账', '礼金', '捐款'],
  // 收入分类
  '工资': ['月薪', '绩效', '年终奖', '补贴'],
  '奖金': ['季度奖', '项目奖金', '优秀员工奖'],
  '副业': ['接单', '兼职', '稿费', '讲课费'],
  '理财': ['基金收益', '股票', '利息', '分红'],
  '红包': ['春节红包', '生日红包', '微信红包'],
};

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
    amountStr: '',               // 金额字符串（支持加减表达式，如 15+8+12）
    amountResult: '',            // 表达式实时求值结果（有运算符时显示）
    hasOperator: false,          // 当前输入是否包含运算符
    note: '',
    date: '',                    // YYYY-MM-DD
    showKeyboard: true,
    quickNotes: QUICK_NOTES['餐饮'] || [],  // 当前分类的常用备注标签
    // 最近相似记录（同分类同类型，最近3条去重）
    recentRecords: [],
    hasRecentRecords: false,
    // 快捷日期：今天 / 昨天 / 前天（用于高亮对应按钮）
    todayStr: '',
    yesterdayStr: '',
    dayBeforeStr: '',
    // 今日速览
    todayExpense: 0,
    todayIncome: 0,
    todayCount: 0,
    hasTodayRecords: false
  },

  onLoad(options) {
    // 预先计算快捷日期（所有分支都需要）
    const quickDates = this._getQuickDates();

    // 支持从外部携带 type 参数
    if (options.type === 'income') {
      this.setData({
        type: 'income',
        categories: INCOME_CATEGORIES,
        selectedCategory: '工资',
        quickNotes: QUICK_NOTES['工资'] || []
      });
      this._loadRecentRecords('工资', 'income');
    }

    // 编辑模式：从 options 中读取 recordId
    if (options.recordId) {
      const record = getRecordById(options.recordId);
      if (record) {
        const cats = record.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        const quickNotes = QUICK_NOTES[record.category] || [];
        this.setData({
          isEditMode: true,
          editRecordId: record.id,
          type: record.type,
          categories: cats,
          selectedCategory: record.category,
          amountStr: String(record.amount),
          amountResult: '',
          hasOperator: false,
          note: record.note || '',
          date: record.date,
          quickNotes,
          ...quickDates
        });
        wx.setNavigationBarTitle({ title: '编辑记录' });
        // 编辑模式也加载最近记录（供参考，但不会主动覆盖当前值）
        this._loadRecentRecords(record.category, record.type);
        return;
      }
    }

    const { todayStr, yesterdayStr, dayBeforeStr } = quickDates;
    this.setData({ date: todayStr, todayStr, yesterdayStr, dayBeforeStr });
    // 加载默认分类（餐饮/支出）的最近记录
    this._loadRecentRecords('餐饮', 'expense');
  },

  // ─── 快捷日期 ──────────────────────────────────────────

  /**
   * 计算今天、昨天、前天的 YYYY-MM-DD 字符串
   */
  _getQuickDates() {
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    const dbef = new Date(now); dbef.setDate(now.getDate() - 2);
    return {
      todayStr: toStr(now),
      yesterdayStr: toStr(yest),
      dayBeforeStr: toStr(dbef)
    };
  },

  /**
   * 点击快捷日期按钮（今天/昨天/前天）
   * @param {object} e - 事件对象，e.currentTarget.dataset.offset 为距今天数
   */
  onQuickDate(e) {
    const offset = parseInt(e.currentTarget.dataset.offset) || 0;
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.setData({ date });
    wx.vibrateShort({ type: 'light' }).catch(() => {});
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this._loadTodaySummary();
  },

  // 加载今日消费概览
  _loadTodaySummary() {
    const { todayExpense, todayIncome, todayCount } = getTodaySummary();
    this.setData({
      todayExpense,
      todayIncome,
      todayCount,
      hasTodayRecords: todayCount > 0
    });
  },

  // 切换收入/支出
  switchType(e) {
    const type = e.currentTarget.dataset.type;
    const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const selectedCategory = categories[0].name;
    const quickNotes = QUICK_NOTES[selectedCategory] || [];
    this.setData({ type, categories, selectedCategory, quickNotes });
    this._loadRecentRecords(selectedCategory, type);
  },

  // 对加减表达式求值（安全实现，仅处理正数加减）
  _evalExpr(expr) {
    if (!expr) return 0;
    // 仅允许数字、小数点、加号、减号
    if (!/^[\d.+\-]+$/.test(expr)) return NaN;
    // 分割为加减项（保留符号）
    const tokens = expr.match(/[+\-]?[\d.]+/g);
    if (!tokens) return NaN;
    let sum = 0;
    for (const t of tokens) {
      const v = parseFloat(t);
      if (isNaN(v)) return NaN;
      sum += v;
    }
    return parseFloat(sum.toFixed(2));
  },

  // 更新表达式求值状态
  _updateExprState(amountStr) {
    const hasOperator = /[+\-]/.test(amountStr.replace(/^-/, '')); // 排除开头的负号
    let amountResult = '';
    if (hasOperator) {
      const val = this._evalExpr(amountStr);
      amountResult = isNaN(val) ? '' : (val > 0 ? String(val) : '');
    }
    this.setData({ amountStr, hasOperator, amountResult });
  },

  // 加载最近相似记录（同分类同类型，最多3条去重）
  _loadRecentRecords(category, type) {
    const records = getRecentCategoryRecords(category, type, 3);
    this.setData({
      recentRecords: records,
      hasRecentRecords: records.length > 0
    });
  },

  // 点击最近相似记录 → 一键填入金额 + 备注
  tapRecentRecord(e) {
    const { amount, note } = e.currentTarget.dataset;
    const amountStr = String(amount);
    this._updateExprState(amountStr);
    this.setData({ note: note || '' });
    wx.vibrateShort({ type: 'light' }).catch(() => {});
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    const quickNotes = QUICK_NOTES[category] || [];
    this.setData({ selectedCategory: category, quickNotes });
    this._loadRecentRecords(category, this.data.type);
  },

  // 点击常用备注标签快速填入
  tapQuickNote(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ note: tag });
  },

  // 数字键盘点击（支持加减运算符）
  pressKey(e) {
    const key = e.currentTarget.dataset.key;
    let { amountStr } = this.data;

    if (key === 'del') {
      amountStr = amountStr.slice(0, -1);
      this._updateExprState(amountStr);
      return;
    }

    if (key === '+' || key === '-') {
      // 空串或已有运算符结尾时不允许追加运算符
      if (amountStr === '') return;
      const lastChar = amountStr.slice(-1);
      if (lastChar === '+' || lastChar === '-' || lastChar === '.') return;
      // 追加运算符
      amountStr += key;
      this._updateExprState(amountStr);
      return;
    }

    if (key === '.') {
      if (amountStr === '') { amountStr = '0'; }
      // 找最后一个数字段（运算符分割后的最后段）
      const segments = amountStr.split(/[+\-]/);
      const lastSeg = segments[segments.length - 1];
      // 最后一段已有小数点则不允许再加
      if (lastSeg.includes('.')) return;
      amountStr += '.';
      this._updateExprState(amountStr);
      return;
    }

    // 数字键
    const segments = amountStr.split(/[+\-]/);
    const lastSeg = segments[segments.length - 1];
    // 对最后一段做长度校验
    if (lastSeg.includes('.')) {
      const parts = lastSeg.split('.');
      if (parts[1].length >= 2) return;
    } else {
      if (lastSeg.length >= 7) return;
    }
    // 防止最后一段有多个前导零
    if (lastSeg === '0') {
      // 替换最后的 '0' 为新数字
      amountStr = amountStr.slice(0, -1) + key;
    } else {
      amountStr += key;
    }
    this._updateExprState(amountStr);
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
    // 支持表达式求值（如 15+8+12），纯数字退化为 parseFloat
    const amount = this._evalExpr(amountStr) || parseFloat(amountStr);

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
        amountResult: '',
        hasOperator: false,
        note: '',
        type: 'expense',
        categories: EXPENSE_CATEGORIES,
        selectedCategory: '餐饮',
        quickNotes: QUICK_NOTES['餐饮'] || []
      });
      // 刷新今日速览（保存后立即更新数据）
      this._loadTodaySummary();
    }, 500);
  }
});
