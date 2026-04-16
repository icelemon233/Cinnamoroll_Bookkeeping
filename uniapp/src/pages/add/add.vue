<template>
  <view class="container">
    <!-- 收入/支出切换（编辑模式下仍可切换） -->
    <view class="type-switcher">
      <view :class="[
        'type-btn',
        type === 'expense' ? 'type-btn-active-expense' : '',
      ]" :data-type="'expense'" @tap="switchType">
        <text>💸 支出</text>
      </view>
      <view :class="['type-btn', type === 'income' ? 'type-btn-active-income' : '']" :data-type="'income'"
        @tap="switchType">
        <text>💰 收入</text>
      </view>
    </view>

    <!-- 金额显示 -->
    <view class="amount-display-card">
      <text class="amount-unit">¥</text>
      <text :class="[
        'amount-display',
        type === 'income' ? 'income-text' : 'expense-text',
      ]">
        {{ amountStr || "0.00" }}
      </text>
    </view>

    <!-- 分类选择 -->
    <view class="card category-section">
      <text class="form-label">分类</text>
      <view class="category-grid">
        <view v-for="item in categories" :key="item.name" :class="[
          'category-item',
          selectedCategory === item.name ? 'category-selected' : '',
        ]" :data-category="item.name" @tap="selectCategory">
          <text class="category-emoji">{{ item.emoji }}</text>
          <text class="category-name">{{ item.name }}</text>
        </view>
      </view>
    </view>

    <!-- 备注和日期 -->
    <view class="card form-section">
      <view class="form-row">
        <text class="form-label-inline">📅 日期</text>
        <picker mode="date" :value="date" @change="onDateChange">
          <text class="form-value">{{ date }}</text>
        </picker>
      </view>
      <view class="divider-light"></view>
      <view class="form-row">
        <text class="form-label-inline">📝 备注</text>
        <input class="form-input" :value="note" placeholder="点击添加备注..." placeholder-class="input-placeholder"
          @input="onNoteInput" :maxlength="30" />
      </view>
    </view>

    <!-- 数字键盘 -->
    <view class="keyboard">
      <view class="keyboard-row">
        <view class="key-btn" :data-key="'7'" @tap="pressKey"><text>7</text></view>
        <view class="key-btn" :data-key="'8'" @tap="pressKey"><text>8</text></view>
        <view class="key-btn" :data-key="'9'" @tap="pressKey"><text>9</text></view>
        <view class="key-btn key-del" :data-key="'del'" @tap="pressKey"><text>⌫</text></view>
      </view>
      <view class="keyboard-row">
        <view class="key-btn" :data-key="'4'" @tap="pressKey"><text>4</text></view>
        <view class="key-btn" :data-key="'5'" @tap="pressKey"><text>5</text></view>
        <view class="key-btn" :data-key="'6'" @tap="pressKey"><text>6</text></view>
        <view class="key-btn key-clear" :data-key="'0'" @tap="pressKey"><text>0</text></view>
      </view>
      <view class="keyboard-row">
        <view class="key-btn" :data-key="'1'" @tap="pressKey"><text>1</text></view>
        <view class="key-btn" :data-key="'2'" @tap="pressKey"><text>2</text></view>
        <view class="key-btn" :data-key="'3'" @tap="pressKey"><text>3</text></view>
        <view class="key-btn key-dot" :data-key="'.'" @tap="pressKey"><text>.</text></view>
      </view>
      <view class="keyboard-row">
        <view :class="[
          'key-btn key-save',
          type === 'income' ? 'key-save-income' : 'key-save-expense',
          saving ? 'key-saving' : '',
        ]" @tap="handleSave">
          <text>{{
            saving ? "保存中..." : isEditMode ? "保存修改 ✨" : "保存 🐾"
          }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { addRecord, updateRecord, getRecordById } from "../../utils/storage.js";

const EXPENSE_CATEGORIES = [
  { name: "餐饮", emoji: "🍜" },
  { name: "交通", emoji: "🚌" },
  { name: "购物", emoji: "🛍️" },
  { name: "娱乐", emoji: "🎮" },
  { name: "住房", emoji: "🏠" },
  { name: "医疗", emoji: "💊" },
  { name: "教育", emoji: "📚" },
  { name: "运动", emoji: "🏃" },
  { name: "旅行", emoji: "✈️" },
  { name: "宠物", emoji: "🐾" },
  { name: "日用", emoji: "🧴" },
  { name: "其他", emoji: "📦" },
];

const INCOME_CATEGORIES = [
  { name: "工资", emoji: "💼" },
  { name: "奖金", emoji: "🎁" },
  { name: "副业", emoji: "💡" },
  { name: "理财", emoji: "📈" },
  { name: "红包", emoji: "🧧" },
  { name: "其他", emoji: "📦" },
];

export default {
  data() {
    return {
      isEditMode: false,
      editRecordId: null,
      type: "expense",
      categories: EXPENSE_CATEGORIES,
      selectedCategory: "餐饮",
      amountStr: "",
      note: "",
      date: "",
      saving: false,
    };
  },

  onShow() {
    uni.$emit('tab-selected', 1)
  },

  async onLoad(options) {
    // 支持从外部携带 type 参数
    if (options.type === "income") {
      this.type = "income";
      this.categories = INCOME_CATEGORIES;
      this.selectedCategory = "工资";
    }

    // 编辑模式：从 options 中读取 recordId
    if (options.recordId) {
      uni.showLoading({ title: "加载中" });
      try {
        const record = await getRecordById(options.recordId);
        if (record) {
          const cats =
            record.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
          this.isEditMode = true;
          this.editRecordId = record.id;
          this.type = record.type;
          this.categories = cats;
          this.selectedCategory = record.category;
          this.amountStr = String(record.amount);
          this.note = record.note || "";
          this.date = record.date;
          uni.setNavigationBarTitle({ title: "编辑记录" });
          return;
        }
      } finally {
        uni.hideLoading();
      }
    }

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
    this.date = date;
  },

  methods: {
    switchType(e) {
      const type = e.currentTarget.dataset.type;
      const categories =
        type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      const selectedCategory = categories[0].name;
      this.type = type;
      this.categories = categories;
      this.selectedCategory = selectedCategory;
    },

    selectCategory(e) {
      const category = e.currentTarget.dataset.category;
      this.selectedCategory = category;
    },

    pressKey(e) {
      const key = e.currentTarget.dataset.key;
      let amountStr = this.amountStr;

      if (key === "del") {
        amountStr = amountStr.slice(0, -1);
      } else if (key === ".") {
        if (amountStr.includes(".")) return;
        if (amountStr === "") amountStr = "0";
        amountStr += ".";
      } else {
        if (amountStr.includes(".")) {
          const parts = amountStr.split(".");
          if (parts[1].length >= 2) return;
        } else {
          if (amountStr.length >= 7) return;
        }
        if (amountStr === "0") {
          amountStr = key;
        } else {
          amountStr += key;
        }
      }
      this.amountStr = amountStr;
    },

    onNoteInput(e) {
      this.note = e.detail.value;
    },

    onDateChange(e) {
      this.date = e.detail.value;
    },

    async handleSave() {
      if (this.saving) return;
      const {
        isEditMode,
        editRecordId,
        type,
        selectedCategory,
        amountStr,
        note,
        date,
      } = this;
      const amount = parseFloat(amountStr);

      if (!amountStr || isNaN(amount) || amount <= 0) {
        uni.showToast({ title: "请输入有效金额 🐾", icon: "none" });
        return;
      }

      this.saving = true;
      uni.showLoading({ title: "保存中" });

      try {
        if (isEditMode && editRecordId) {
          // 编辑模式
          const patch = {
            type,
            category: selectedCategory,
            amount,
            note: note.trim(),
            date,
          };
          await updateRecord(editRecordId, patch);
          uni.showToast({
            title: "修改成功 ✨",
            icon: "success",
            duration: 1200,
          });
          setTimeout(() => {
            uni.navigateBack({ delta: 1 });
          }, 800);
        } else {
          // 新增模式
          await addRecord({
            type,
            category: selectedCategory,
            amount,
            note: note.trim(),
            date,
          });
          uni.showToast({
            title: "记录成功 🎉",
            icon: "success",
            duration: 1200,
          });
          // 重置表单
          setTimeout(() => {
            this.amountStr = "";
            this.note = "";
            this.type = "expense";
            this.categories = EXPENSE_CATEGORIES;
            this.selectedCategory = "餐饮";
          }, 500);
        }
      } catch (e) {
        console.error("[add] save error:", e);
        uni.showToast({ title: "保存失败，请重试", icon: "none" });
      } finally {
        this.saving = false;
        uni.hideLoading();
      }
    },
  },
};
</script>

<style scoped>
/* 收支切换 */
.type-switcher {
  display: flex;
  background: #ffffff;
  border-radius: 100rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 184, 212, 0.12);
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  border-radius: 100rpx;
  font-size: 30rpx;
  color: #9baab8;
  transition: all 0.25s;
}

.type-btn-active-expense {
  background: #ffe0e8;
  color: #ff8bab;
  font-weight: 600;
}

.type-btn-active-income {
  background: #e0f5fa;
  color: #4fb8d4;
  font-weight: 600;
}

/* 金额显示 */
.amount-display-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx 36rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 184, 212, 0.1);
  min-height: 120rpx;
}

.amount-unit {
  font-size: 44rpx;
  color: #9baab8;
  font-weight: 500;
}

.amount-display {
  font-size: 72rpx;
  font-weight: 700;
  flex: 1;
  letter-spacing: -2rpx;
}

.income-text {
  color: #4fb8d4;
}

.expense-text {
  color: #ff8bab;
}

/* 分类区域 */
.category-section {
  margin-bottom: 20rpx;
  padding: 24rpx 28rpx;
}

.form-label {
  font-size: 26rpx;
  color: #9baab8;
  margin-bottom: 20rpx;
  display: block;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: #f5fbfd;
  border: 2rpx solid transparent;
  transition: all 0.2s;
}

.category-item:active {
  opacity: 0.8;
}

.category-selected {
  background: #e0f5fa;
  border-color: #4fb8d4;
}

.category-emoji {
  font-size: 40rpx;
  margin-bottom: 6rpx;
}

.category-name {
  font-size: 22rpx;
  color: #3d5a6e;
}

.category-selected .category-name {
  color: #4fb8d4;
  font-weight: 600;
}

/* 表单区域 */
.form-section {
  padding: 12rpx 28rpx;
  margin-bottom: 24rpx;
}

.form-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
}

.form-label-inline {
  font-size: 28rpx;
  color: #3d5a6e;
  width: 120rpx;
  flex-shrink: 0;
}

.form-value {
  font-size: 28rpx;
  color: #4fb8d4;
  flex: 1;
}

.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #3d5a6e;
  height: 56rpx;
  line-height: 56rpx;
}

.input-placeholder {
  color: #c8d8e4;
}

.divider-light {
  height: 1rpx;
  background: #f0f8ff;
}

/* 数字键盘 */
.keyboard {
  background: #ffffff;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 24rpx rgba(79, 184, 212, 0.12);
  margin-bottom: 40rpx;
}

.keyboard-row {
  display: flex;
}

.key-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 112rpx;
  font-size: 40rpx;
  color: #3d5a6e;
  font-weight: 500;
  background: #ffffff;
  border: 1rpx solid #f0f8ff;
  cursor: pointer;
  transition: background 0.1s;
}

.key-btn:active {
  background: #eef8fb;
}

.key-del {
  background: #fff5f7;
  color: #ff8bab;
}

.key-del:active {
  background: #ffe0e8;
}

.key-dot {
  color: #9baab8;
}

.key-save {
  flex: 4;
  height: 112rpx;
  font-size: 34rpx;
  font-weight: 700;
  border-radius: 0;
}

.key-save-expense {
  background: linear-gradient(135deg, #ffb3c8, #ff8bab);
  color: #ffffff;
}

.key-save-income {
  background: linear-gradient(135deg, #7ec8e3, #4fb8d4);
  color: #ffffff;
}

.key-save:active {
  opacity: 0.88;
}

.key-saving {
  opacity: 0.65;
}
</style>
