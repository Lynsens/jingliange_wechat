const api = require('../../services/api')
const app = getApp()

const DEFAULT_ADMIN_USERNAME = 'admin'
const UNIT_OPTIONS = ['g', 'ml']
const MAX_METRIC_ROWS = 3
const IMAGE_COMPRESS_QUALITY = 72
const IMAGE_COMPRESS_WIDTH = 1280
const ARCHIVE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '上架中' },
  { key: 'archived', label: '已下架' }
]
const SUGGESTION_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未处理' },
  { key: 'handled', label: '已处理' }
]
let rowSeed = 0

function splitIngredientNames(value) {
  return String(value || '')
    .replace(/[{}"]/g, '')
    .split(/[,，、\n\s]+/)
    .map((item) => item.trim())
    .filter((item) => item && !/^\d+(?:\.\d+)?(?:g|ml)$/i.test(item))
    .slice(0, MAX_METRIC_ROWS)
}

function createMetricRow() {
  rowSeed += 1
  return {
    id: `row_${Date.now()}_${rowSeed}`,
    name: '',
    quantity: '',
    unit: '',
    unitIndex: 0
  }
}

function createEmptyForm() {
  return {
    name: '',
    desc: '',
    imageUrl: '',
    isRecommended: false,
    isArchived: false,
    ingredients: '',
    nutrition: [createMetricRow()]
  }
}

function createActivityForm() {
  return {
    title: '',
    eventTime: '',
    place: '',
    content: '',
    isTop: false
  }
}

function createComboForm() {
  return {
    title: '',
    description: '',
    isActive: false,
    menuIds: []
  }
}

function rowsToJsonObjectText(rows) {
  const result = {}
  rows.slice(0, MAX_METRIC_ROWS).forEach((row) => {
    const name = row.name.trim()
    const quantity = row.quantity.trim()
    const unit = row.unit.trim()
    if (name && quantity && unit) {
      result[name] = `${quantity}${unit}`
    }
  })

  return JSON.stringify(result)
}

function ingredientTextToJsonText(value) {
  return JSON.stringify(splitIngredientNames(value))
}

function parseIngredientText(value) {
  if (!value) {
    return ''
  }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_METRIC_ROWS).join('、')
    }
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).slice(0, MAX_METRIC_ROWS).join('、')
    }
  } catch (e) {
    // Keep plain text values as-is.
  }

  return splitIngredientNames(value).join('、')
}

function hasCompleteRows(rows) {
  return rows.some((row) => row.name.trim() && row.quantity.trim() && row.unit.trim())
}

function hasPartialRows(rows) {
  return rows.some((row) => {
    const values = [row.name.trim(), row.quantity.trim(), row.unit.trim()]
    return values.some(Boolean) && values.some((value) => !value)
  })
}

function hasAnyMetricValue(rows) {
  return rows.some((row) => row.name.trim() || row.quantity.trim() || row.unit.trim())
}

function parseMetricRows(value) {
  const rows = []

  try {
    const parsed = JSON.parse(value || '{}')
    if (parsed && typeof parsed === 'object') {
      Object.keys(parsed).forEach((name) => {
        const rawValue = String(parsed[name] || '')
        const match = rawValue.match(/^([\d.]+)\s*(g|ml)$/i)
        const row = createMetricRow()
        row.name = name
        row.quantity = match ? match[1] : rawValue.replace(/[^\d.]/g, '')
        row.unit = match ? match[2].toLowerCase() : 'g'
        row.unitIndex = UNIT_OPTIONS.indexOf(row.unit) >= 0 ? UNIT_OPTIONS.indexOf(row.unit) : 0
        rows.push(row)
      })
    }
  } catch (e) {
    // Keep a blank row for legacy malformed values.
  }

  return rows.length ? rows.slice(0, MAX_METRIC_ROWS) : [createMetricRow()]
}

function formatMenu(item) {
  return {
    id: item.id,
    name: item.name || '未命名素食',
    desc: item.desc || '暂无介绍',
    imageUrl: item.image_url || '',
    ingredients: item.ingredients || '',
    nutrition: item.nutrition || '',
    likeCount: item.like_count || 0,
    isRecommended: Number(item.is_recommended || 0) === 1,
    isArchived: Number(item.is_archived || 0) === 1
  }
}

function filterAdminMenus(menus, keyword) {
  const text = keyword.trim().toLowerCase()
  if (!text) {
    return menus
  }

  return menus.filter((item) => {
    return `${item.id} ${item.name} ${item.desc}`.toLowerCase().indexOf(text) !== -1
  })
}

function formatActivity(item) {
  return {
    id: item.id,
    title: item.title || '未命名活动',
    eventTime: item.event_time || '近期',
    place: item.place || '净莲阁',
    content: item.content || '暂无介绍',
    isTop: Number(item.is_top || 0) === 1
  }
}

function formatAdminDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16)
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}.${day} ${hour}:${minute}`
}

function filterActivities(activities, keyword) {
  const text = keyword.trim().toLowerCase()
  if (!text) {
    return activities
  }

  return activities.filter((item) => {
    return `${item.id} ${item.title} ${item.eventTime} ${item.place} ${item.content}`.toLowerCase().indexOf(text) !== -1
  })
}

function formatComment(item) {
  const userName = item.user_nickname || item.user_id || '匿名用户'
  return {
    id: item.id,
    menuId: item.menu_id,
    menuName: item.menu_name || `菜品 ${item.menu_id}`,
    userId: item.user_id || '匿名用户',
    userName,
    avatarUrl: item.user_avatar_url || '',
    comment: item.comment || '',
    date: formatAdminDate(item.update_time || item.create_time)
  }
}

function filterComments(comments, keyword) {
  const text = keyword.trim().toLowerCase()
  if (!text) {
    return comments
  }

  return comments.filter((item) => {
    return `${item.id} ${item.menuId} ${item.menuName} ${item.userId} ${item.userName} ${item.comment}`.toLowerCase().indexOf(text) !== -1
  })
}

function formatCombo(item) {
  const items = Array.isArray(item.items) ? item.items.map((menu) => ({
    id: menu.id,
    name: menu.name || '未命名素食'
  })) : []
  return {
    id: item.id,
    title: item.title || '未命名搭配',
    description: item.description || '暂无说明',
    isActive: Number(item.is_active || 0) === 1,
    items,
    menuIds: items.map((menu) => menu.id)
  }
}

function filterCombos(combos, keyword) {
  const text = keyword.trim().toLowerCase()
  if (!text) {
    return combos
  }

  return combos.filter((item) => {
    const menuText = item.items.map((menu) => menu.name).join(' ')
    return `${item.id} ${item.title} ${item.description} ${menuText}`.toLowerCase().indexOf(text) !== -1
  })
}

function buildComboMenuOptions(menus, selectedIds) {
  const selectedSet = {}
  selectedIds.forEach((id) => {
    selectedSet[id] = true
  })

  return menus
    .filter((item) => !item.isArchived)
    .map((item) => Object.assign({}, item, {
      selected: Boolean(selectedSet[item.id])
    }))
}

function formatSuggestion(item) {
  const userName = item.user_nickname || item.user_id || '匿名用户'
  const handled = Number(item.handle_status || 0) === 1
  return {
    id: item.id,
    userId: item.user_id || '',
    userName,
    content: item.content || '',
    contact: item.contact || '未留联系方式',
    handled,
    date: formatAdminDate(item.create_time)
  }
}

function filterSuggestions(suggestions, keyword) {
  const text = keyword.trim().toLowerCase()
  if (!text) {
    return suggestions
  }

  return suggestions.filter((item) => {
    return `${item.id} ${item.userId} ${item.userName} ${item.content} ${item.contact}`.toLowerCase().indexOf(text) !== -1
  })
}

function getFileInfo(filePath) {
  return new Promise((resolve) => {
    if (!wx.getFileInfo || !filePath) {
      resolve(null)
      return
    }

    wx.getFileInfo({
      filePath,
      success(res) {
        resolve(res)
      },
      fail() {
        resolve(null)
      }
    })
  })
}

function compressImage(filePath) {
  return new Promise((resolve) => {
    if (!wx.compressImage || !filePath) {
      resolve(filePath)
      return
    }

    wx.compressImage({
      src: filePath,
      quality: IMAGE_COMPRESS_QUALITY,
      compressedWidth: IMAGE_COMPRESS_WIDTH,
      success(res) {
        resolve(res.tempFilePath || filePath)
      },
      fail() {
        resolve(filePath)
      }
    })
  })
}

async function getSmallerImagePath(filePath) {
  const compressedPath = await compressImage(filePath)
  if (!compressedPath || compressedPath === filePath) {
    return filePath
  }

  const [originalInfo, compressedInfo] = await Promise.all([
    getFileInfo(filePath),
    getFileInfo(compressedPath)
  ])

  if (originalInfo && compressedInfo && compressedInfo.size > 0 && compressedInfo.size < originalInfo.size) {
    return compressedPath
  }

  return filePath
}

Page({
  data: {
    adminAuthed: false,
    adminUsername: DEFAULT_ADMIN_USERNAME,
    adminPassword: '',
    loading: false,
    saving: false,
    uploadingImage: false,
    adminSection: 'menu',
    menuKeyword: '',
    archiveFilter: 'all',
    archiveFilters: ARCHIVE_FILTERS,
    unitOptions: UNIT_OPTIONS,
    menus: [],
    displayMenus: [],
    showEditor: false,
    editingMenuId: 0,
    formReady: true,
    form: createEmptyForm(),
    activityKeyword: '',
    activities: [],
    displayActivities: [],
    showActivityEditor: false,
    editingActivityId: 0,
    activityForm: createActivityForm(),
    comboKeyword: '',
    combos: [],
    displayCombos: [],
    showComboEditor: false,
    editingComboId: 0,
    comboForm: createComboForm(),
    comboMenuOptions: [],
    commentKeyword: '',
    comments: [],
    displayComments: [],
    suggestionKeyword: '',
    suggestionFilter: 'all',
    suggestionFilters: SUGGESTION_FILTERS,
    suggestions: [],
    displaySuggestions: []
  },

  onLoad() {
    const adminToken = wx.getStorageSync('jingliange_admin_token')
    const adminUsername = wx.getStorageSync('jingliange_admin_username') || DEFAULT_ADMIN_USERNAME
    const adminAuthed = Boolean(adminToken)
    app.globalData.adminToken = adminToken || ''
    this.setData({
      adminAuthed,
      adminUsername
    })
    if (adminAuthed) {
      this.loadMenus()
    }
  },

  onAdminUsernameInput(e) {
    this.setData({ adminUsername: e.detail.value })
  },

  onAdminPasswordInput(e) {
    this.setData({ adminPassword: e.detail.value })
  },

  async loginAdmin() {
    const username = this.data.adminUsername.trim()
    const password = this.data.adminPassword.trim()

    if (!username || !password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '登录中' })
      const result = await api.adminLogin(username, password)
      wx.setStorageSync('jingliange_admin_token', result.token)
      wx.setStorageSync('jingliange_admin_username', result.username || username)
      app.globalData.adminToken = result.token
      this.setData({
        adminAuthed: true,
        adminUsername: result.username || username,
        adminPassword: '',
        adminSection: 'menu',
        showEditor: false,
        editingMenuId: 0,
        showActivityEditor: false,
        editingActivityId: 0,
        showComboEditor: false,
        editingComboId: 0,
        comboKeyword: '',
        commentKeyword: '',
        suggestionKeyword: ''
      })
      await this.loadMenus()
      wx.hideLoading()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({
        title: e.message || '登录失败',
        icon: 'none'
      })
    }
  },

  logoutAdmin() {
    wx.removeStorageSync('jingliange_admin_token')
    app.globalData.adminToken = ''
    this.setData({
      adminAuthed: false,
      adminPassword: '',
      adminSection: 'menu',
      menuKeyword: '',
      archiveFilter: 'all',
      menus: [],
      displayMenus: [],
      showEditor: false,
      editingMenuId: 0,
      form: createEmptyForm(),
      activityKeyword: '',
      activities: [],
      displayActivities: [],
      showActivityEditor: false,
      editingActivityId: 0,
      activityForm: createActivityForm(),
      comboKeyword: '',
      combos: [],
      displayCombos: [],
      showComboEditor: false,
      editingComboId: 0,
      comboForm: createComboForm(),
      comboMenuOptions: [],
      commentKeyword: '',
      comments: [],
      displayComments: [],
      suggestionKeyword: '',
      suggestionFilter: 'all',
      suggestions: [],
      displaySuggestions: []
    })
  },

  ensureAdminAuth() {
    const token = wx.getStorageSync('jingliange_admin_token')
    if (!token) {
      this.logoutAdmin()
      throw new Error('请先登录管理员账号')
    }

    app.globalData.adminToken = token
    return token
  },

  handleAdminRequestError(e, fallbackMessage) {
    if (e.statusCode === 401) {
      this.logoutAdmin()
      wx.showToast({
        title: '登录已失效',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: e.message || fallbackMessage,
      icon: 'none'
    })
  },

  async loadMenus() {
    this.setData({ loading: true })
    try {
      const list = await api.adminGetMenuList('', this.data.archiveFilter)
      const menus = Array.isArray(list) ? list.map(formatMenu) : []
      this.setData({
        menus,
        displayMenus: filterAdminMenus(menus, this.data.menuKeyword),
        comboMenuOptions: buildComboMenuOptions(menus, this.data.comboForm.menuIds),
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({
        title: '菜单加载失败',
        icon: 'none'
      })
    }
  },

  async loadActivities() {
    this.setData({ loading: true })
    try {
      const list = await api.adminGetActivityList('')
      const activities = Array.isArray(list) ? list.map(formatActivity) : []
      this.setData({
        activities,
        displayActivities: filterActivities(activities, this.data.activityKeyword),
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({
        title: '活动加载失败',
        icon: 'none'
      })
    }
  },

  async loadCombos() {
    this.setData({ loading: true })
    try {
      const list = await api.adminGetComboList('')
      const combos = Array.isArray(list) ? list.map(formatCombo) : []
      this.setData({
        combos,
        displayCombos: filterCombos(combos, this.data.comboKeyword),
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({
        title: '搭配加载失败',
        icon: 'none'
      })
    }
  },

  async loadComments() {
    this.setData({ loading: true })
    try {
      const list = await api.adminGetCommentList('')
      const comments = Array.isArray(list) ? list.map(formatComment) : []
      this.setData({
        comments,
        displayComments: filterComments(comments, this.data.commentKeyword),
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({
        title: '评论加载失败',
        icon: 'none'
      })
    }
  },

  async loadSuggestions() {
    this.setData({ loading: true })
    try {
      const list = await api.adminGetSuggestionList('', this.data.suggestionFilter)
      const suggestions = Array.isArray(list) ? list.map(formatSuggestion) : []
      this.setData({
        suggestions,
        displaySuggestions: filterSuggestions(suggestions, this.data.suggestionKeyword),
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({
        title: '建议加载失败',
        icon: 'none'
      })
    }
  },

  switchAdminSection(e) {
    const adminSection = e.currentTarget.dataset.section
    this.setData({
      adminSection,
      showEditor: false,
      showActivityEditor: false,
      showComboEditor: false,
      editingMenuId: 0,
      editingActivityId: 0,
      editingComboId: 0
    })

    if (adminSection === 'activity' && this.data.activities.length === 0) {
      this.loadActivities()
    }
    if (adminSection === 'combo' && this.data.combos.length === 0) {
      this.loadCombos()
    }
    if (adminSection === 'comment' && this.data.comments.length === 0) {
      this.loadComments()
    }
    if (adminSection === 'suggestion' && this.data.suggestions.length === 0) {
      this.loadSuggestions()
    }
  },

  onMenuKeywordInput(e) {
    const menuKeyword = e.detail.value
    this.setData({
      menuKeyword,
      displayMenus: filterAdminMenus(this.data.menus, menuKeyword)
    })
  },

  onArchiveFilterTap(e) {
    const archiveFilter = e.currentTarget.dataset.filter
    this.setData({
      archiveFilter
    })
    this.loadMenus()
  },

  clearMenuKeyword() {
    this.setData({
      menuKeyword: '',
      displayMenus: this.data.menus
    })
  },

  onActivityKeywordInput(e) {
    const activityKeyword = e.detail.value
    this.setData({
      activityKeyword,
      displayActivities: filterActivities(this.data.activities, activityKeyword)
    })
  },

  clearActivityKeyword() {
    this.setData({
      activityKeyword: '',
      displayActivities: this.data.activities
    })
  },

  onComboKeywordInput(e) {
    const comboKeyword = e.detail.value
    this.setData({
      comboKeyword,
      displayCombos: filterCombos(this.data.combos, comboKeyword)
    })
  },

  clearComboKeyword() {
    this.setData({
      comboKeyword: '',
      displayCombos: this.data.combos
    })
  },

  onCommentKeywordInput(e) {
    const commentKeyword = e.detail.value
    this.setData({
      commentKeyword,
      displayComments: filterComments(this.data.comments, commentKeyword)
    })
  },

  clearCommentKeyword() {
    this.setData({
      commentKeyword: '',
      displayComments: this.data.comments
    })
  },

  onSuggestionKeywordInput(e) {
    const suggestionKeyword = e.detail.value
    this.setData({
      suggestionKeyword,
      displaySuggestions: filterSuggestions(this.data.suggestions, suggestionKeyword)
    })
  },

  onSuggestionFilterTap(e) {
    this.setData({
      suggestionFilter: e.currentTarget.dataset.filter
    })
    this.loadSuggestions()
  },

  clearSuggestionKeyword() {
    this.setData({
      suggestionKeyword: '',
      displaySuggestions: this.data.suggestions
    })
  },

  startCreateMenu() {
    this.setData({
      formReady: false,
      saving: false,
      uploadingImage: false,
      editingMenuId: 0,
      showEditor: true
    })

    wx.nextTick(() => {
      this.setData({
        form: createEmptyForm(),
        formReady: true
      })
      if (wx.pageScrollTo) {
        wx.pageScrollTo({
          scrollTop: 0,
          duration: 200
        })
      }
    })
  },

  updateField(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  resetForm() {
    this.setData({
      formReady: false,
      saving: false,
      uploadingImage: false,
      editingMenuId: 0,
      showEditor: false
    })

    wx.nextTick(() => {
      this.setData({
        form: createEmptyForm(),
        formReady: true
      })
    })
  },

  editMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    const menu = this.data.menus.find((item) => item.id === id)
    if (!menu) {
      wx.showToast({
        title: '菜单不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      formReady: false,
      showEditor: true
    })

    wx.nextTick(() => {
      this.setData({
        editingMenuId: id,
        form: {
          name: menu.name,
          desc: menu.desc,
          imageUrl: menu.imageUrl,
          isRecommended: menu.isRecommended,
          isArchived: menu.isArchived,
          ingredients: parseIngredientText(menu.ingredients),
          nutrition: parseMetricRows(menu.nutrition)
        },
        formReady: true
      })
      if (wx.pageScrollTo) {
        wx.pageScrollTo({
          scrollTop: 0,
          duration: 200
        })
      }
    })
  },

  cancelEdit() {
    this.resetForm()
  },

  onMenuRecommendedChange(e) {
    this.setData({
      'form.isRecommended': e.detail.value
    })
  },

  onMenuArchivedChange(e) {
    const isArchived = e.detail.value
    this.setData({
      'form.isArchived': isArchived,
      'form.isRecommended': isArchived ? false : this.data.form.isRecommended
    })
  },

  updateMetricField(e) {
    const type = e.currentTarget.dataset.type
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${type}[${index}].${field}`]: e.detail.value
    })
  },

  addMetricRow(e) {
    const type = e.currentTarget.dataset.type
    if (this.data.form[type].length >= MAX_METRIC_ROWS) {
      wx.showToast({
        title: '最多添加三项',
        icon: 'none'
      })
      return
    }

    this.setData({
      [`form.${type}`]: this.data.form[type].concat(createMetricRow())
    })
  },

  updateMetricUnit(e) {
    const type = e.currentTarget.dataset.type
    const index = Number(e.currentTarget.dataset.index)
    const unitIndex = Number(e.detail.value)
    this.setData({
      [`form.${type}[${index}].unitIndex`]: unitIndex,
      [`form.${type}[${index}].unit`]: this.data.unitOptions[unitIndex]
    })
  },

  removeMetricRow(e) {
    const type = e.currentTarget.dataset.type
    const index = Number(e.currentTarget.dataset.index)
    const rows = this.data.form[type].filter((_, rowIndex) => rowIndex !== index)
    this.setData({
      [`form.${type}`]: rows.length ? rows : [createMetricRow()]
    })
  },

  chooseMenuImage() {
    this.ensureAdminAuth()

    const chooseSuccess = (filePath) => {
      this.uploadSelectedImage(filePath)
    }

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0]
          if (file && file.tempFilePath) {
            chooseSuccess(file.tempFilePath)
          }
        }
      })
      return
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths && res.tempFilePaths[0]
        if (filePath) {
          chooseSuccess(filePath)
        }
      }
    })
  },

  async uploadSelectedImage(filePath) {
    const imageDesc = this.data.form.name.trim()
      ? `菜单图片-${this.data.form.name.trim()}`
      : '菜单图片'

    this.setData({ uploadingImage: true })

    try {
      const uploadPath = await getSmallerImagePath(filePath)
      const result = await api.uploadMenuImage(uploadPath, imageDesc)
      this.setData({
        'form.imageUrl': result.image_url
      })
      wx.showToast({
        title: '图片已上传',
        icon: 'success'
      })
    } catch (e) {
      this.handleAdminRequestError(e, '图片上传失败')
    } finally {
      this.setData({ uploadingImage: false })
    }
  },

  async submitMenu() {
    const form = this.data.form
    const name = form.name.trim()
    const desc = form.desc.trim()
    const imageUrl = form.imageUrl.trim()

    if (!name || !desc) {
      wx.showToast({
        title: '请填写名称和介绍',
        icon: 'none'
      })
      return
    }

    if (hasAnyMetricValue(form.nutrition) && (!hasCompleteRows(form.nutrition) || hasPartialRows(form.nutrition))) {
      wx.showToast({
        title: '请完善营养',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      this.ensureAdminAuth()
      const payload = {
        name,
        desc,
        image_url: imageUrl,
        ingredients: ingredientTextToJsonText(form.ingredients),
        nutrition: rowsToJsonObjectText(form.nutrition),
        is_recommended: form.isRecommended && !form.isArchived ? 1 : 0,
        is_archived: form.isArchived ? 1 : 0
      }
      if (this.data.editingMenuId) {
        payload.id = this.data.editingMenuId
        await api.updateMenuItem(payload)
      } else {
        await api.uploadMenuItem(payload)
      }
      wx.showToast({
        title: this.data.editingMenuId ? '已更新' : '已保存',
        icon: 'success'
      })
      this.resetForm()
      await this.loadMenus()
    } catch (e) {
      this.handleAdminRequestError(e, '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  },

  setRecommendedMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    const name = e.currentTarget.dataset.name
    const isRecommended = Number(e.currentTarget.dataset.recommended) === 1
    const isArchived = Number(e.currentTarget.dataset.archived) === 1

    if (isArchived && !isRecommended) {
      wx.showToast({
        title: '已下架菜品不能推荐',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: isRecommended ? '取消推荐' : '今日推荐',
      content: isRecommended ? `取消「${name}」的今日推荐？` : `将「${name}」设为今日推荐？`,
      confirmColor: '#ad693e',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          this.ensureAdminAuth()
          await api.recommendMenuItem(id, !isRecommended)
          wx.showToast({
            title: isRecommended ? '已取消' : '已推荐',
            icon: 'success'
          })
          await this.loadMenus()
        } catch (err) {
          this.handleAdminRequestError(err, '设置失败')
        }
      }
    })
  },

  archiveMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    const name = e.currentTarget.dataset.name
    const isArchived = Number(e.currentTarget.dataset.archived) === 1

    wx.showModal({
      title: isArchived ? '重新上架' : '下架菜品',
      content: isArchived ? `确认重新上架「${name}」？` : `确认下架「${name}」？下架后用户端不会显示。`,
      confirmColor: '#ad693e',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          this.ensureAdminAuth()
          await api.archiveMenuItem(id, !isArchived)
          wx.showToast({
            title: isArchived ? '已上架' : '已下架',
            icon: 'success'
          })
          await this.loadMenus()
        } catch (err) {
          this.handleAdminRequestError(err, '操作失败')
        }
      }
    })
  },

  deleteMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    const name = e.currentTarget.dataset.name

    wx.showModal({
      title: '删除菜品',
      content: `确认删除「${name}」？`,
      confirmColor: '#ad693e',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          this.ensureAdminAuth()
          await api.deleteMenuItem(id)
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
          await this.loadMenus()
        } catch (err) {
          this.handleAdminRequestError(err, '删除失败')
        }
      }
    })
  },

  startCreateActivity() {
    this.setData({
      showActivityEditor: true,
      editingActivityId: 0,
      activityForm: createActivityForm()
    })
    if (wx.pageScrollTo) {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 200
      })
    }
  },

  editActivity(e) {
    const id = Number(e.currentTarget.dataset.id)
    const activity = this.data.activities.find((item) => item.id === id)
    if (!activity) {
      wx.showToast({
        title: '活动不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      showActivityEditor: true,
      editingActivityId: id,
      activityForm: {
        title: activity.title,
        eventTime: activity.eventTime,
        place: activity.place,
        content: activity.content,
        isTop: activity.isTop
      }
    })
    if (wx.pageScrollTo) {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 200
      })
    }
  },

  resetActivityForm() {
    this.setData({
      showActivityEditor: false,
      editingActivityId: 0,
      activityForm: createActivityForm()
    })
  },

  updateActivityField(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`activityForm.${field}`]: e.detail.value
    })
  },

  onActivityTopChange(e) {
    this.setData({
      'activityForm.isTop': e.detail.value
    })
  },

  async submitActivity() {
    const form = this.data.activityForm
    const title = form.title.trim()
    const eventTime = form.eventTime.trim()
    const place = form.place.trim()
    const content = form.content.trim()

    if (!title || !eventTime || !place || !content) {
      wx.showToast({
        title: '请填写完整活动',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      this.ensureAdminAuth()
      const payload = {
        title,
        event_time: eventTime,
        place,
        content,
        is_top: form.isTop ? 1 : 0
      }

      if (this.data.editingActivityId) {
        payload.id = this.data.editingActivityId
        await api.updateActivity(payload)
      } else {
        await api.createActivity(payload)
      }

      wx.showToast({
        title: this.data.editingActivityId ? '已更新' : '已保存',
        icon: 'success'
      })
      this.resetActivityForm()
      await this.loadActivities()
    } catch (e) {
      this.handleAdminRequestError(e, '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  },

  toggleActivityTop(e) {
    const id = Number(e.currentTarget.dataset.id)
    const isTop = Number(e.currentTarget.dataset.top) === 1

    this.runActivityAction(async () => {
      await api.topActivity(id, !isTop)
      wx.showToast({
        title: isTop ? '已取消置顶' : '已置顶',
        icon: 'success'
      })
    }, '设置失败')
  },

  deleteActivity(e) {
    const id = Number(e.currentTarget.dataset.id)
    const title = e.currentTarget.dataset.title

    wx.showModal({
      title: '删除活动',
      content: `确认删除「${title}」？`,
      confirmColor: '#ad693e',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        this.runActivityAction(async () => {
          await api.deleteActivity(id)
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
        }, '删除失败')
      }
    })
  },

  startCreateCombo() {
    this.setData({
      showComboEditor: true,
      editingComboId: 0,
      comboForm: createComboForm(),
      comboMenuOptions: buildComboMenuOptions(this.data.menus, [])
    })
    if (wx.pageScrollTo) {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 200
      })
    }
  },

  editCombo(e) {
    const id = Number(e.currentTarget.dataset.id)
    const combo = this.data.combos.find((item) => item.id === id)
    if (!combo) {
      wx.showToast({
        title: '搭配不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      showComboEditor: true,
      editingComboId: id,
      comboForm: {
        title: combo.title,
        description: combo.description,
        isActive: combo.isActive,
        menuIds: combo.menuIds.slice(0, 4)
      },
      comboMenuOptions: buildComboMenuOptions(this.data.menus, combo.menuIds)
    })
    if (wx.pageScrollTo) {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 200
      })
    }
  },

  resetComboForm() {
    this.setData({
      showComboEditor: false,
      editingComboId: 0,
      comboForm: createComboForm(),
      comboMenuOptions: buildComboMenuOptions(this.data.menus, [])
    })
  },

  updateComboField(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`comboForm.${field}`]: e.detail.value
    })
  },

  onComboActiveChange(e) {
    this.setData({
      'comboForm.isActive': e.detail.value
    })
  },

  toggleComboMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    const current = this.data.comboForm.menuIds.slice()
    const index = current.indexOf(id)

    if (index >= 0) {
      current.splice(index, 1)
    } else {
      if (current.length >= 4) {
        wx.showToast({
          title: '最多选择 4 道菜',
          icon: 'none'
        })
        return
      }
      current.push(id)
    }

    this.setData({
      'comboForm.menuIds': current,
      comboMenuOptions: buildComboMenuOptions(this.data.menus, current)
    })
  },

  async submitCombo() {
    const form = this.data.comboForm
    const title = form.title.trim()
    const description = form.description.trim()

    if (!title || !form.menuIds.length) {
      wx.showToast({
        title: '请填写搭配并选择菜品',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      this.ensureAdminAuth()
      const payload = {
        title,
        description,
        is_active: form.isActive ? 1 : 0,
        menu_ids: form.menuIds
      }

      if (this.data.editingComboId) {
        payload.id = this.data.editingComboId
        await api.updateCombo(payload)
      } else {
        await api.createCombo(payload)
      }

      wx.showToast({
        title: this.data.editingComboId ? '已更新' : '已保存',
        icon: 'success'
      })
      this.resetComboForm()
      await this.loadCombos()
    } catch (err) {
      this.handleAdminRequestError(err, '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  },

  toggleComboActive(e) {
    const id = Number(e.currentTarget.dataset.id)
    const isActive = Number(e.currentTarget.dataset.active) === 1

    this.runComboAction(async () => {
      await api.activateCombo(id, !isActive)
      wx.showToast({
        title: isActive ? '已取消启用' : '已启用',
        icon: 'success'
      })
    }, '设置失败')
  },

  deleteCombo(e) {
    const id = Number(e.currentTarget.dataset.id)
    const title = e.currentTarget.dataset.title

    wx.showModal({
      title: '删除搭配',
      content: `确认删除「${title}」？`,
      confirmColor: '#ad693e',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        this.runComboAction(async () => {
          await api.deleteCombo(id)
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
        }, '删除失败')
      }
    })
  },

  deleteComment(e) {
    const id = Number(e.currentTarget.dataset.id)
    const menuName = e.currentTarget.dataset.menuName

    wx.showModal({
      title: '删除评论',
      content: `确认删除「${menuName}」下的这条评论？`,
      confirmColor: '#ad693e',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          this.ensureAdminAuth()
          await api.deleteComment(id)
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
          await this.loadComments()
        } catch (err) {
          this.handleAdminRequestError(err, '删除失败')
        }
      }
    })
  },

  async toggleSuggestionStatus(e) {
    const id = Number(e.currentTarget.dataset.id)
    const handled = Number(e.currentTarget.dataset.handled) === 1

    try {
      this.ensureAdminAuth()
      await api.updateSuggestionStatus(id, handled ? 0 : 1)
      wx.showToast({
        title: handled ? '已标为未处理' : '已处理',
        icon: 'success'
      })
      await this.loadSuggestions()
    } catch (err) {
      this.handleAdminRequestError(err, '更新失败')
    }
  },

  async runActivityAction(action, fallbackMessage) {
    try {
      this.ensureAdminAuth()
      await action()
      await this.loadActivities()
    } catch (err) {
      this.handleAdminRequestError(err, fallbackMessage)
    }
  },

  async runComboAction(action, fallbackMessage) {
    try {
      this.ensureAdminAuth()
      await action()
      await this.loadCombos()
    } catch (err) {
      this.handleAdminRequestError(err, fallbackMessage)
    }
  }
})
