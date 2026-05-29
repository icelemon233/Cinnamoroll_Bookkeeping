// pages/add/add.js - 记账页（支持新增和编辑两种模式）
const { saveRecord, updateRecord, getRecordById, getTodaySummary, getRecentCategoryRecords, getTopAmounts, getNoteAutoComplete, getTemplates, saveTemplate, deleteTemplate, getCategoryHistory } = require('../../utils/storage');

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
    hasTodayRecords: false,
    // 常用金额快捷（当前分类/类型的高频金额，最多5个）
    topAmounts: [],
    hasTopAmounts: false,
    // 备注智能联想
    noteSuggestions: [],      // 当前联想建议列表
    showNoteSuggestions: false, // 是否展示联想下拉
    // 快捷记账模板
    templates: [],            // 所有模板列表
    hasTemplates: false,      // 是否有模板（控制区块显隐）
    // 分类历史弹窗
    showCategoryHistory: false,
    categoryHistoryTitle: '',  // 弹窗标题，如「餐饮 最近消费」
    categoryHistoryList: [],   // [{ amount, note, date, id }]
    categoryHistoryEmpty: false, // 是否暂无记录
    // AA 分摊计算器
    showSplitModal: false,      // 是否显示分摊弹窗
    splitPeople: 2,             // 分摊人数
    splitTotal: 0,              // 分摊总金额
    splitPerPerson: '0.00',     // 每人金额（字符串，保留2位小数）
    splitRemainder: '0.00'      // 最后一人补差（字符串）
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
      this._loadTopAmounts('工资', 'income');
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
        // 编辑模式也加载最近记录和常用金额（供参考，但不会主动覆盖当前值）
        this._loadRecentRecords(record.category, record.type);
        this._loadTopAmounts(record.category, record.type);
        return;
      }
    }

    const { todayStr, yesterdayStr, dayBeforeStr } = quickDates;
    this.setData({ date: todayStr, todayStr, yesterdayStr, dayBeforeStr });
    // 加载默认分类（餐饮/支出）的最近记录和常用金额
    this._loadRecentRecords('餐饮', 'expense');
    this._loadTopAmounts('餐饮', 'expense');
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
    this._loadTemplates();
  },

  // 加载快捷记账模板列表
  _loadTemplates() {
    const templates = getTemplates();
    this.setData({ templates, hasTemplates: templates.length > 0 });
  },

  // 点击模板 → 一键填入类型/分类/金额/备注
  tapTemplate(e) {
    const { id } = e.currentTarget.dataset;
    const tpl = this.data.templates.find(t => String(t.id) === String(id));
    if (!tpl) return;

    const EXPENSE_CATEGORIES = [
      { name: '餐饮', emoji: '🍜' }, { name: '交通', emoji: '🚌' },
      { name: '购物', emoji: '🛍️' }, { name: '娱乐', emoji: '🎮' },
      { name: '住房', emoji: '🏠' }, { name: '医疗', emoji: '💊' },
      { name: '教育', emoji: '📚' }, { name: '运动', emoji: '🏃' },
      { name: '旅行', emoji: '✈️' }, { name: '宠物', emoji: '🐾' },
      { name: '日用', emoji: '🧴' }, { name: '其他', emoji: '📦' }
    ];
    const INCOME_CATEGORIES = [
      { name: '工资', emoji: '💼' }, { name: '奖金', emoji: '🎁' },
      { name: '副业', emoji: '💡' }, { name: '理财', emoji: '📈' },
      { name: '红包', emoji: '🧧' }, { name: '其他', emoji: '📦' }
    ];

    const categories = tpl.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const QUICK_NOTES_LOCAL = {
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
      '工资': ['月薪', '绩效', '年终奖', '补贴'],
      '奖金': ['季度奖', '项目奖金', '优秀员工奖'],
      '副业': ['接单', '兼职', '稿费', '讲课费'],
      '理财': ['基金收益', '股票', '利息', '分红'],
      '红包': ['春节红包', '生日红包', '微信红包']
    };
    const quickNotes = QUICK_NOTES_LOCAL[tpl.category] || [];

    this.setData({
      type: tpl.type,
      categories,
      selectedCategory: tpl.category,
      amountStr: String(tpl.amount),
      amountResult: '',
      hasOperator: false,
      note: tpl.note || '',
      quickNotes,
      noteSuggestions: [],
      showNoteSuggestions: false
    });
    this._loadRecentRecords(tpl.category, tpl.type);
    this._loadTopAmounts(tpl.category, tpl.type);
    wx.vibrateShort({ type: 'light' }).catch(() => {});
    wx.showToast({ title: '已填入模板 ✨', icon: 'none', duration: 800 });
  },

  // 长按模板 → 弹出操作菜单（删除）
  longPressTemplate(e) {
    const { id, name, amount } = e.currentTarget.dataset;
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
    wx.showActionSheet({
      itemList: [`🗑️ 删除「${name || '¥' + amount}」`],
      success: (res) => {
        if (res.tapIndex === 0) {
          deleteTemplate(id);
          this._loadTemplates();
          wx.showToast({ title: '已删除模板', icon: 'success', duration: 800 });
        }
      }
    });
  },

  // 保存当前记录为模板（在 saveRecord 成功后可选触发）
  saveAsTemplate() {
    const { type, selectedCategory, amountStr, note } = this.data;
    const amount = this._evalExpr(amountStr) || parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请先填写有效金额', icon: 'none' });
      return;
    }

    // 模板命名：默认用「分类+备注」或「分类+金额」
    const defaultName = note
      ? `${selectedCategory} · ${note}`
      : `${selectedCategory} ¥${amount}`;

    wx.showModal({
      title: '保存为模板',
      editable: true,
      placeholderText: defaultName,
      content: '',
      confirmText: '保存',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        const name = (res.content || '').trim() || defaultName;
        const { success } = saveTemplate({ type, category: selectedCategory, amount, note, name });
        if (success) {
          this._loadTemplates();
          wx.showToast({ title: '模板已保存 🐾', icon: 'success', duration: 1200 });
        }
      }
    });
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
    this.setData({ type, categories, selectedCategory, quickNotes, noteSuggestions: [], showNoteSuggestions: false });
    this._loadRecentRecords(selectedCategory, type);
    this._loadTopAmounts(selectedCategory, type);
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

  // 加载当前分类/类型的高频常用金额（最多5个）
  _loadTopAmounts(category, type) {
    const amounts = getTopAmounts(category, type, 5);
    this.setData({
      topAmounts: amounts,
      hasTopAmounts: amounts.length > 0
    });
  },

  // 点击常用金额快捷按钮 → 直接填入金额
  tapTopAmount(e) {
    const amount = e.currentTarget.dataset.amount;
    const amountStr = String(amount);
    this._updateExprState(amountStr);
    wx.vibrateShort({ type: 'light' }).catch(() => {});
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
    this.setData({ selectedCategory: category, quickNotes, noteSuggestions: [], showNoteSuggestions: false });
    this._loadRecentRecords(category, this.data.type);
    this._loadTopAmounts(category, this.data.type);
  },

  // 长按分类 → 弹出历史记录预览
  longPressCategory(e) {
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
    const category = e.currentTarget.dataset.category;
    const { type } = this.data;
    const emoji = CATEGORY_EMOJI[category] || '📦';
    const typeLabel = type === 'expense' ? '消费' : '收入';
    const list = getCategoryHistory(category, type, 5);
    this.setData({
      showCategoryHistory: true,
      categoryHistoryTitle: `${emoji} ${category} · 近期${typeLabel}`,
      categoryHistoryList: list,
      categoryHistoryEmpty: list.length === 0
    });
  },

  // 关闭分类历史弹窗
  closeCategoryHistory() {
    this.setData({ showCategoryHistory: false });
  },

  // 点击分类历史记录中某条 → 自动填入金额+备注
  tapCategoryHistoryItem(e) {
    const { amount, note } = e.currentTarget.dataset;
    this.setData({
      amountStr: String(amount),
      amountResult: '',
      hasOperator: false,
      note: note || '',
      showCategoryHistory: false
    });
    wx.vibrateShort({ type: 'light' }).catch(() => {});
  },

  // 空操作（阻止冒泡用）
  noop() {},

  // 点击常用备注标签快速填入
  tapQuickNote(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ note: tag, noteSuggestions: [], showNoteSuggestions: false });
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

  // 备注输入（实时触发联想）
  onNoteInput(e) {
    const note = e.detail.value;
    this.setData({ note });
    this._updateNoteSuggestions(note);
  },

  // 更新备注联想列表
  _updateNoteSuggestions(keyword) {
    const { selectedCategory, type } = this.data;
    if (!keyword || !keyword.trim()) {
      this.setData({ noteSuggestions: [], showNoteSuggestions: false });
      return;
    }
    const suggestions = getNoteAutoComplete(keyword.trim(), selectedCategory, type, 6);
    this.setData({
      noteSuggestions: suggestions,
      showNoteSuggestions: suggestions.length > 0
    });
  },

  // 点击联想建议 → 填入备注
  tapNoteSuggestion(e) {
    const suggestion = e.currentTarget.dataset.suggestion;
    this.setData({
      note: suggestion,
      noteSuggestions: [],
      showNoteSuggestions: false
    });
    wx.vibrateShort({ type: 'light' }).catch(() => {});
  },

  // 关闭联想列表（点击其他区域时）
  closeNoteSuggestions() {
    this.setData({ noteSuggestions: [], showNoteSuggestions: false });
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
        quickNotes: QUICK_NOTES['餐饮'] || [],
        noteSuggestions: [],
        showNoteSuggestions: false
      });
      // 刷新今日速览（保存后立即更新数据），同时刷新常用金额（新记录可能影响频率）
      this._loadTodaySummary();
      this._loadTopAmounts('餐饮', 'expense');
    }, 500);
  },

  // ======== AA 分摊计算器 ========

  // 计算分摊金额（内部方法）
  _calcSplit(total, people) {
    if (!total || !people || people < 2) return { perPerson: '0.00', remainder: '0.00' };
    // 每人应付（小数点后两位，下取整）
    const perCents = Math.floor((total * 100) / people);
    const perPerson = (perCents / 100).toFixed(2);
    // 最后一人补差
    const remainder = (total - (perCents / 100) * people).toFixed(2);
    return { perPerson, remainder };
  },

  // 点击 AA 按钒（在金额显示卡旁）
  openSplitModal() {
    const { amountStr } = this.data;
    const total = this._evalExpr(amountStr) || parseFloat(amountStr);
    if (!total || isNaN(total) || total <= 0) {
      wx.showToast({ title: '请先输入金额 🐾', icon: 'none' });
      return;
    }
    const { perPerson, remainder } = this._calcSplit(total, 2);
    this.setData({
      showSplitModal: true,
      splitPeople: 2,
      splitTotal: total,
      splitPerPerson: perPerson,
      splitRemainder: remainder
    });
  },

  // 关闭分摊弹窗
  closeSplitModal() {
    this.setData({ showSplitModal: false });
  },

  // 修改分摊人数（+1 / -1）
  changeSplitPeople(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    let people = this.data.splitPeople + delta;
    if (people < 2) people = 2;
    if (people > 20) people = 20;
    const { perPerson, remainder } = this._calcSplit(this.data.splitTotal, people);
    this.setData({ splitPeople: people, splitPerPerson: perPerson, splitRemainder: remainder });
  },

  // 直接输入人数
  onSplitPeopleInput(e) {
    let people = parseInt(e.detail.value);
    if (isNaN(people) || people < 2) people = 2;
    if (people > 20) people = 20;
    const { perPerson, remainder } = this._calcSplit(this.data.splitTotal, people);
    this.setData({ splitPeople: people, splitPerPerson: perPerson, splitRemainder: remainder });
  },

  // 确认分摊：将每人金额填入金额栏，并追加备注
  confirmSplit() {
    const { splitPeople, splitPerPerson, splitTotal } = this.data;
    const perAmt = parseFloat(splitPerPerson);
    if (isNaN(perAmt) || perAmt <= 0) return;

    // 将每人金额填入输入框
    const newAmountStr = perAmt % 1 === 0 ? String(perAmt | 0) : perAmt.toFixed(2);
    this._updateExprState(newAmountStr);

    // 备注追加 AA 信息（如果备注为空则直接写，否则追加）
    const { note } = this.data;
    const aaTag = `AA分摊 ${splitPeople}人（合计¥${splitTotal}）`;
    const newNote = note ? `${note} / ${aaTag}` : aaTag;
    const truncated = newNote.length > 30 ? newNote.slice(0, 30) : newNote;

    this.setData({ note: truncated, showSplitModal: false });
    wx.showToast({ title: `已分为每人 ¥${splitPerPerson} 🎉`, icon: 'none', duration: 1500 });
  }
});
