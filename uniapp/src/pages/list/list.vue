<template>
  <view class="container">

    <!-- 搜索框 -->
    <view class="search-bar">
      <view class="search-inner">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          placeholder="搜索备注、分类、金额"
          placeholder-class="search-placeholder"
          :value="searchKeyword"
          @input="onSearchInput"
          @focus="onSearchFocus"
          confirm-type="search"
        />
        <view v-if="searchKeyword" class="search-clear" @tap="clearSearch">
          <text class="clear-icon">✕</text>
        </view>
      </view>
    </view>

    <!-- 搜索模式：结果数提示 -->
    <view v-if="isSearchMode" class="search-result-hint">
      <text class="hint-text">找到 {{ searchResultCount }} 条结果</text>
    </view>

    <!-- 月份切换导航（搜索模式下隐藏） -->
    <view v-if="!isSearchMode" class="month-nav">
      <view class="month-arrow" @tap="prevMonth">
        <text class="arrow-text">‹</text>
      </view>
      <text class="month-nav-title">{{ currentMonthLabel }}</text>
      <view :class="['month-arrow', isLatestMonth ? 'arrow-disabled' : '']" @tap="nextMonth">
        <text class="arrow-text">›</text>
      </view>
    </view>

    <!-- 顶部汇总（搜索模式下隐藏） -->
    <view v-if="!isSearchMode" class="summary-bar">
      <view class="summary-bar-item">
        <text class="bar-label">收入</text>
        <text class="bar-amount income-text">+{{ totalIncome }}</text>
      </view>
      <view class="bar-divider"></view>
      <view class="summary-bar-item">
        <text class="bar-label">支出</text>
        <text class="bar-amount expense-text">-{{ totalExpense }}</text>
      </view>
    </view>

    <!-- 类型筛选 -->
    <view class="filter-row">
      <view
        :class="['filter-btn', filterType === 'all' ? 'filter-active' : '']"
        :data-type="'all'"
        @tap="switchFilter"
      >全部</view>
      <view
        :class="['filter-btn', filterType === 'expense' ? 'filter-active filter-expense' : '']"
        :data-type="'expense'"
        @tap="switchFilter"
      >支出</view>
      <view
        :class="['filter-btn', filterType === 'income' ? 'filter-active filter-income' : '']"
        :data-type="'income'"
        @tap="switchFilter"
      >收入</view>
      <view class="export-btn" @tap="onExport">
        <text class="export-icon">📤</text>
      </view>
    </view>

    <!-- 操作提示 -->
    <view v-if="!isEmpty && !isSearchMode" class="hint-bar">
      <text class="hint-text">长按账单可编辑或删除 ✨</text>
    </view>

    <!-- 空状态 -->
    <view v-if="isEmpty" class="empty-state">
      <text class="empty-emoji">{{ isSearchMode ? '🔍' : '🌸' }}</text>
      <text class="empty-text">{{ isSearchMode ? '没找到相关账单' : currentMonthLabel + '暂无账单' }}</text>
      <view v-if="!isSearchMode" class="add-btn" @tap="goToAdd">
        <text>去记账 ✏️</text>
      </view>
    </view>

    <!-- 账单列表（按日期分组） -->
    <view v-else>
      <view class="date-group card" v-for="item in allGroups" :key="item.date">
        <view class="group-header">
          <text class="group-date">{{ item.dateLabel }} ({{ item.date }})</text>
          <view class="group-subtotal">
            <text v-if="item.groupIncome > 0" class="subtotal-income">+{{ item.groupIncome }}</text>
            <text v-if="item.groupExpense > 0" class="subtotal-expense"> -{{ item.groupExpense }}</text>
          </view>
        </view>
        <view
          class="record-item"
          v-for="record in item.records"
          :key="record.id"
          :data-id="record.id"
          @longpress="onLongPress"
        >
          <view class="record-icon"><text>{{ record.emoji }}</text></view>
          <view class="record-body">
            <text class="record-category">{{ record.category }}</text>
            <text class="record-note" v-if="record.note">{{ record.note }}</text>
          </view>
          <view class="record-right">
            <text :class="['record-amount', record.type === 'income' ? 'income-text' : 'expense-text']">
              {{ record.amountDisplay }}
            </text>
            <text class="record-edit-hint">长按</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
import { getRecords, deleteRecord, groupByDate, formatDate, exportToCSV, downloadCSV } from '../../utils/storage.js'
import { supabase } from '../../utils/supabase.js'

const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
}

export default {
  data() {
    return {
      allGroups: [],
      filterType: 'all',
      totalIncome: 0,
      totalExpense: 0,
      isEmpty: false,
      filterMonth: '',
      currentMonthLabel: '',
      isLatestMonth: true,
      // 搜索
      searchKeyword: '',
      isSearchMode: false,
      searchResultCount: 0
    }
  },

  onLoad() {
    this._initMonth()
    this.loadData()
  },

  async onShow() {
    await this.loadData()
  },

  methods: {
    // ─── 月份导航 ──────────────────────────────────────────

    _initMonth() {
      const now = new Date()
      const year = now.getFullYear()
      const m = now.getMonth() + 1
      const filterMonth = `${year}-${m < 10 ? '0' + m : m}`
      const currentMonthLabel = `${year}年${m < 10 ? '0' + m : m}月`
      this.filterMonth = filterMonth
      this.currentMonthLabel = currentMonthLabel
      this.isLatestMonth = true
    },

    prevMonth() {
      if (this.isSearchMode) return
      const { filterMonth } = this
      const [year, m] = filterMonth.split('-').map(Number)
      let newYear = year, newMonth = m - 1
      if (newMonth < 1) { newMonth = 12; newYear -= 1 }
      this._setMonth(newYear, newMonth)
    },

    nextMonth() {
      if (this.isSearchMode) return
      const now = new Date()
      const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (this.filterMonth >= nowYM) return
      const [year, m] = this.filterMonth.split('-').map(Number)
      let newYear = year, newMonth = m + 1
      if (newMonth > 12) { newMonth = 1; newYear += 1 }
      this._setMonth(newYear, newMonth)
    },

    _setMonth(year, month) {
      const now = new Date()
      const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const filterMonth = `${year}-${month < 10 ? '0' + month : month}`
      const currentMonthLabel = `${year}年${month < 10 ? '0' + month : month}月`
      const isLatestMonth = filterMonth >= nowYM
      this.filterMonth = filterMonth
      this.currentMonthLabel = currentMonthLabel
      this.isLatestMonth = isLatestMonth
      this.loadData()
    },

    // ─── 搜索（Supabase ilike 查询）────────────────────────

    onSearchInput(e) {
      const keyword = e.detail.value.trim()
      this.searchKeyword = keyword
      this.isSearchMode = keyword.length > 0
      this.loadData()
    },

    clearSearch() {
      this.searchKeyword = ''
      this.isSearchMode = false
      this.loadData()
    },

    onSearchFocus() {
      // 聚焦时等待输入
    },

    // ─── 数据加载 ───────────────────────────────────────────

    async loadData() {
      uni.showLoading({ title: '加载中...', mask: true })
      try {
        const { isSearchMode, searchKeyword, filterType, filterMonth } = this

        if (isSearchMode && searchKeyword) {
          // 搜索模式：Supabase 跨月模糊查询（备注、分类）+ 客户端金额过滤
          let query = supabase
            .from('records')
            .select('*')
            .or(`note.ilike.%${searchKeyword}%,category.ilike.%${searchKeyword}%`)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })

          if (filterType !== 'all') {
            query = query.eq('type', filterType)
          }

          const { data, error } = await query
          if (error) {
            console.error('[list] search error:', error.message)
            uni.showToast({ title: '搜索失败', icon: 'none' })
            return
          }

          // 金额关键词客户端过滤（补充 Supabase or 查询）
          let records = data || []
          const isNumericKw = /^\d+(\.\d+)?$/.test(searchKeyword)
          if (isNumericKw) {
            const numRecords = (data || []).filter(r => String(r.amount).includes(searchKeyword))
            // 合并去重
            const merged = [...records]
            numRecords.forEach(r => {
              if (!merged.find(m => m.id === r.id)) merged.push(r)
            })
            records = merged
          }

          const allGroups = this._buildGroups(records)
          this.allGroups = allGroups
          this.totalIncome = 0
          this.totalExpense = 0
          this.isEmpty = allGroups.length === 0
          this.searchResultCount = records.length

        } else {
          // 月份模式：Supabase 按月查询
          let query = supabase
            .from('records')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })

          if (filterMonth) {
            query = query.like('date', `${filterMonth}%`)
          }

          const { data: allData, error } = await query
          if (error) {
            console.error('[list] loadData error:', error.message)
            return
          }

          const allRecords = allData || []
          let filtered = allRecords
          if (filterType !== 'all') {
            filtered = allRecords.filter(r => r.type === filterType)
          }

          let totalIncome = 0, totalExpense = 0
          allRecords.forEach(r => {
            if (r.type === 'income') totalIncome += Number(r.amount) || 0
            else totalExpense += Number(r.amount) || 0
          })

          const allGroups = this._buildGroups(filtered)
          this.allGroups = allGroups
          this.totalIncome = parseFloat(totalIncome.toFixed(2))
          this.totalExpense = parseFloat(totalExpense.toFixed(2))
          this.isEmpty = allGroups.length === 0
          this.searchResultCount = filtered.length
        }
      } finally {
        uni.hideLoading()
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
      }))
    },

    // ─── 筛选 ───────────────────────────────────────────────

    switchFilter(e) {
      const filterType = e.currentTarget.dataset.type
      this.filterType = filterType
      this.loadData()
    },

    // ─── 长按操作 ───────────────────────────────────────────

    onLongPress(e) {
      const id = e.currentTarget.dataset.id
      uni.showActionSheet({
        itemList: ['✏️ 编辑', '🗑️ 删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            uni.navigateTo({ url: `/pages/add/add?recordId=${id}` })
          } else if (res.tapIndex === 1) {
            this._confirmDelete(id)
          }
        }
      })
    },

    _confirmDelete(id) {
      uni.showModal({
        title: '确认删除',
        content: '删除这条账单记录？',
        confirmText: '删除',
        confirmColor: '#FF8BAB',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            try {
              await deleteRecord(id)
              uni.showToast({ title: '已删除', icon: 'success', duration: 800 })
              await this.loadData()
            } catch (e) {
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },

    goToAdd() {
      uni.switchTab({ url: '/pages/add/add' })
    },

    // ─── 导出功能 ──────────────────────────────────────────

    onExport() {
      uni.showActionSheet({
        itemList: ['📊 导出为 CSV'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this._exportCSV()
          }
        }
      })
    },

    async _exportCSV() {
      uni.showLoading({ title: '导出中...', mask: true })
      try {
        // 获取当前筛选条件下的所有记录
        const { isSearchMode, searchKeyword, filterType, filterMonth } = this

        let query = supabase
          .from('records')
          .select('*')
          .order('date', { ascending: false })

        if (isSearchMode && searchKeyword) {
          query = query.or(`note.ilike.%${searchKeyword}%,category.ilike.%${searchKeyword}%`)
        } else if (filterMonth) {
          query = query.like('date', `${filterMonth}%`)
        }

        const { data, error } = await query

        if (error || !data || data.length === 0) {
          uni.showToast({ title: '没有可导出的数据', icon: 'none' })
          return
        }

        // 应用类型筛选
        let records = data
        if (filterType !== 'all') {
          records = records.filter(r => r.type === filterType)
        }

        // 生成 CSV
        const csvContent = exportToCSV(records)
        const filename = `账单_${filterMonth || '全部'}_${Date.now()}.csv`
        
        // #ifdef H5
        downloadCSV(csvContent, filename)
        uni.showToast({ title: '导出成功', icon: 'success' })
        // #endif

        // #ifndef H5
        // 小程序环境：保存到本地文件
        const fs = uni.getFileSystemManager()
        const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
        fs.writeFile({
          filePath,
          data: csvContent,
          encoding: 'utf8',
          success: () => {
            uni.showModal({
              title: '导出成功',
              content: `文件已保存到: ${filename}`,
              showCancel: false,
              confirmText: '知道啦'
            })
          },
          fail: (err) => {
            console.error('_exportCSV writeFile error:', err)
            uni.showToast({ title: '导出失败', icon: 'none' })
          }
        })
        // #endif

      } finally {
        uni.hideLoading()
      }
    }
  }
}
</script>

<style scoped>
/* ─── 搜索框 ─────────────────────────────────────────────── */
.search-bar {
  margin-bottom: 16rpx;
}

.search-inner {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 100rpx;
  padding: 18rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(79, 184, 212, 0.08);
}

.search-icon {
  font-size: 30rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #3D5A6E;
  height: 48rpx;
  line-height: 48rpx;
}

.search-placeholder {
  color: #C8D8E4;
}

.search-clear {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #E8F4F8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.clear-icon {
  font-size: 22rpx;
  color: #9BAAB8;
}

.search-result-hint {
  text-align: center;
  margin-bottom: 16rpx;
}

/* ─── 月份切换导航栏 ──────────────────────────────────────── */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 20rpx;
}

.month-arrow {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #EBF7FB;
}

.arrow-text {
  font-size: 48rpx;
  color: #4FB8D4;
  font-weight: 700;
  line-height: 1;
  margin-top: -4rpx;
}

.arrow-disabled {
  opacity: 0.3;
}

.month-nav-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #3D5A6E;
}

/* ─── 顶部汇总 ───────────────────────────────────────────── */
.summary-bar {
  display: flex;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx 36rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 184, 212, 0.1);
  align-items: center;
  justify-content: center;
}

.summary-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-label {
  font-size: 24rpx;
  color: #9BAAB8;
  margin-bottom: 8rpx;
}

.bar-amount {
  font-size: 40rpx;
  font-weight: 700;
}

.bar-divider {
  width: 1rpx;
  height: 60rpx;
  background: #E8F4F8;
  margin: 0 20rpx;
}

.income-text { color: #4FB8D4; }
.expense-text { color: #FF8BAB; }

/* ─── 筛选行 ─────────────────────────────────────────────── */
.filter-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
  align-items: center;
}

.filter-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 100rpx;
  font-size: 28rpx;
  color: #9BAAB8;
  background: #FFFFFF;
  border: 2rpx solid transparent;
  font-weight: 400;
}

.filter-active {
  background: #E0F5FA;
  color: #4FB8D4;
  border-color: #A8D8EA;
  font-weight: 600;
}

.filter-expense.filter-active {
  background: #FFE0E8;
  color: #FF8BAB;
  border-color: #FFB3C8;
}

.filter-income.filter-active {
  background: #E0F5FA;
  color: #4FB8D4;
  border-color: #A8D8EA;
}

.export-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #FFFFFF;
  border: 2rpx solid #E8F4F8;
  flex-shrink: 0;
}

.export-icon {
  font-size: 32rpx;
}

/* ─── 日期分组卡片 ────────────────────────────────────────── */
.date-group {
  padding: 20rpx 28rpx;
  margin-bottom: 20rpx;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F0F8FF;
  margin-bottom: 8rpx;
}

.group-date {
  font-size: 26rpx;
  color: #9BAAB8;
  font-weight: 500;
}

.group-subtotal {
  display: flex;
  gap: 8rpx;
}

.subtotal-income {
  font-size: 26rpx;
  color: #4FB8D4;
}

.subtotal-expense {
  font-size: 26rpx;
  color: #FF8BAB;
}

/* ─── 账单条目 ───────────────────────────────────────────── */
.record-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F8FCFE;
}

.record-item:last-child {
  border-bottom: none;
  padding-bottom: 4rpx;
}

.record-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #EEF8FB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.record-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.record-category {
  font-size: 30rpx;
  font-weight: 500;
  color: #3D5A6E;
}

.record-note {
  font-size: 24rpx;
  color: #9BAAB8;
  margin-top: 4rpx;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.record-amount {
  font-size: 34rpx;
  font-weight: 700;
}

.record-edit-hint {
  font-size: 20rpx;
  color: #C8D8E4;
  margin-top: 4rpx;
}

/* ─── 空状态 ─────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
}

.empty-emoji {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #9BAAB8;
  margin-bottom: 40rpx;
}

.add-btn {
  background: linear-gradient(135deg, #7EC8E3, #4FB8D4);
  color: #FFFFFF;
  padding: 24rpx 60rpx;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
}

/* ─── 提示栏 ─────────────────────────────────────────────── */
.hint-bar {
  text-align: center;
  margin-bottom: 16rpx;
}

.hint-text {
  font-size: 24rpx;
  color: #B8D8E4;
}
</style>
