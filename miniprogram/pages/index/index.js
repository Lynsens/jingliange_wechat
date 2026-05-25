const api = require('../../services/api')
const app = getApp()

let allMenus = [
  {
    id: 1,
    initial: '莲',
    name: '莲香素斋饭',
    desc: '糙米、时蔬、菌菇与清香酱汁搭配，入口温和饱足。',
    ingredients: ['糙米', '香菇', '荷兰豆', '胡萝卜'],
    nutrition: '低油少盐 / 膳食纤维',
    likeCount: 128,
    liked: true,
    color: 'green'
  },
  {
    id: 2,
    initial: '莲',
    name: '山药百合汤',
    desc: '山药、百合与莲子慢煮，汤色清亮，适合作为午后轻食。',
    ingredients: ['山药', '百合', '莲子'],
    nutrition: '清润 / 植物蛋白',
    likeCount: 96,
    liked: false,
    color: 'pink'
  },
  {
    id: 3,
    initial: '莲',
    name: '桂花莲藕羹',
    desc: '莲藕细磨成羹，以少量桂花提香，甜度克制。',
    ingredients: ['莲藕', '桂花', '红枣'],
    nutrition: '温润 / 少糖',
    likeCount: 74,
    liked: false,
    color: 'gold'
  }
]

const fallbackActivities = [
  { id: 1, title: '周末素食共修', time: '周六 10:30', place: '净莲阁斋堂' },
  { id: 2, title: '莲花茶会', time: '周日 14:00', place: '二楼茶室' }
]

const colors = ['green', 'pink', 'gold']
const MAX_DETAIL_ITEMS = 3
const RECOMMENDATION_SLOTS = ['前菜/小菜', '主食', '热食', '甜品/饮品']

function splitIngredientNames(value) {
  return String(value || '')
    .replace(/[{}"]/g, '')
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter((item) => item && !/^\d+(?:\.\d+)?(?:g|ml)$/i.test(item))
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).map((key) => `${key} ${parsed[key]}`)
    }
  } catch (e) {
    // Fall through to split common plain-text formats.
  }

  return String(value)
    .replace(/[{}"]/g, '')
    .split(/[,，、\s]+/)
    .filter(Boolean)
}

function toDisplayList(value, fallback) {
  const items = toArray(value)
  return (items.length ? items : fallback).slice(0, MAX_DETAIL_ITEMS)
}

function toIngredientList(value, fallback) {
  if (!value) {
    return fallback.slice(0, MAX_DETAIL_ITEMS)
  }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return (parsed.length ? parsed : fallback).slice(0, MAX_DETAIL_ITEMS)
    }
    if (parsed && typeof parsed === 'object') {
      const names = Object.keys(parsed)
      return (names.length ? names : fallback).slice(0, MAX_DETAIL_ITEMS)
    }
  } catch (e) {
    // Fall through to split common plain-text formats.
  }

  const items = splitIngredientNames(value)
  return (items.length ? items : fallback).slice(0, MAX_DETAIL_ITEMS)
}

function formatNutrition(value) {
  if (!value) {
    return '清淡素食'
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed)
        .map((key) => `${key} ${parsed[key]}`)
        .join(' / ')
    }
  } catch (e) {
    // Keep plain text values as-is.
  }

  return value
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function getApiOrigin() {
  return app.globalData.apiBaseUrl.replace(/\/api\/v1\/?$/, '')
}

function normalizeImageUrl(url) {
  if (!url) {
    return ''
  }

  if (url.indexOf('/images/') === 0) {
    return ''
  }

  if (url.indexOf('http://49.234.22.169:8000/') === 0) {
    return url.replace('http://49.234.22.169:8000', getApiOrigin())
  }

  if (url.indexOf('/uploads/') === 0) {
    return `${getApiOrigin()}${url}`
  }

  if (/^https:\/\//.test(url)) {
    return url
  }

  if (/^http:\/\//.test(url)) {
    return ''
  }

  return `${getApiOrigin()}${url.startsWith('/') ? url : `/${url}`}`
}

function normalizeMenu(item, index) {
  const name = item.name || '未命名素食'
  const ingredients = toIngredientList(item.ingredients, ['素食'])
  const nutritionItems = toDisplayList(item.nutrition, ['清淡素食'])
  return {
    id: item.id,
    initial: '莲',
    name,
    category: item.category || '热食',
    desc: item.desc || '暂无介绍',
    imageUrl: normalizeImageUrl(item.image_url),
    ingredients,
    nutritionItems,
    nutrition: nutritionItems.join(' / ') || formatNutrition(item.nutrition),
    likeCount: item.like_count || item.likeCount || 0,
    isRecommended: Number(item.is_recommended || 0) === 1,
    liked: Boolean(item.liked),
    color: colors[index % colors.length]
  }
}

function sortMenusByLikeCount(menus) {
  return menus
    .slice()
    .sort((a, b) => {
      const likeDiff = Number(b.likeCount || 0) - Number(a.likeCount || 0)
      if (likeDiff !== 0) {
        return likeDiff
      }

      return Number(a.id || 0) - Number(b.id || 0)
    })
    .map((item, index) => Object.assign({}, item, {
      color: colors[index % colors.length]
    }))
}

function normalizeActivity(item) {
  return {
    id: item.id,
    title: item.title || '净莲阁活动',
    time: item.event_time || formatDate(item.create_time) || '近期',
    place: item.place || item.content || '净莲阁',
    isTop: Number(item.is_top || 0) === 1
  }
}

function getFeaturedMenu(menus) {
  return menus.find((item) => item.isRecommended) || menus[0] || null
}

function normalizeCombo(combo) {
  if (!combo || !Array.isArray(combo.items) || !combo.items.length) {
    return null
  }

  const items = combo.items.slice(0, 4).map((item, index) => normalizeMenu(item, index))
  const title = combo.title && combo.title.indexOf('搭配') === -1 ? combo.title : '今日推荐'
  return {
    id: combo.id,
    title,
    description: combo.description || '按今日菜品推荐更健康、更饱足的取餐方式。',
    items,
    slots: RECOMMENDATION_SLOTS.map((label, index) => ({
      label,
      order: index + 1,
      menu: items[index] || null
    }))
  }
}

function normalizeComment(item) {
  const userName = item.user_nickname || '莲友'
  return {
    id: item.id,
    userName,
    avatar: '莲',
    avatarUrl: normalizeImageUrl(item.user_avatar_url),
    comment: item.comment || '随喜赞叹',
    date: formatDate(item.create_time),
    isMine: Boolean(item.is_mine)
  }
}

function getWechatCommentProfile() {
  return new Promise((resolve, reject) => {
    if (!wx.getUserProfile) {
      reject(new Error('当前微信版本不支持获取用户信息'))
      return
    }

    wx.getUserProfile({
      desc: '用于展示评论头像和昵称',
      lang: 'zh_CN',
      success(res) {
        const userInfo = res.userInfo || {}
        const nickName = String(userInfo.nickName || '').trim()
        const avatarUrl = normalizeImageUrl(userInfo.avatarUrl || '')
        if (!nickName || !avatarUrl) {
          reject(new Error('未获取到微信头像昵称'))
          return
        }

        resolve({
          nickName,
          avatarUrl
        })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

Page({
  data: {
    menuPosition: wx.getMenuButtonBoundingClientRect(),
    activeTab: 'home',
    keyword: '',
    loading: false,
    offlineMode: false,
    backendError: '',
    aboutDescription: '净莲阁以素食、茶会与公益活动连接同修善友。小程序将承载菜单展示、活动发布和餐厅信息。',
    featuredMenu: allMenus[0],
    comboRecommendation: null,
    selectedMenu: null,
    detailLoading: false,
    detailDragStartY: 0,
    detailSheetTranslateY: 0,
    detailSheetTransition: 'none',
    menuComments: [],
    menuCommentText: '',
    suggestionText: '',
    suggestionContact: '',
    submittingSuggestion: false,
    navItems: [
      { key: 'home', title: '首页' },
      { key: 'menu', title: '素食' },
      { key: 'donation', title: '功德榜' },
      { key: 'suggestion', title: '建议箱' },
      { key: 'about', title: '关于' }
    ],
    quickStats: [
      { label: '素食', value: '8' },
      { label: '功德榜', value: '开发中', isText: true },
      { label: '活动', value: '5' }
    ],
    menus: allMenus,
    activities: fallbackActivities,
    homeActivities: fallbackActivities.slice(0, 3)
  },

  onLoad() {
    this.loadPageData()
  },

  async loadPageData() {
    this.setData({ loading: true })

    const results = await Promise.all([
      this.loadMenus(),
      this.loadCombo(),
      this.loadAbout(),
      this.loadActivities()
    ])

    const failed = results.filter((result) => !result.success)
    const backendError = failed.length ? failed[0].message : ''

    this.setData({
      loading: false,
      offlineMode: failed.length > 0,
      backendError
    })
  },

  async loadMenus() {
    try {
      const list = await api.getMenuList('')
      if (Array.isArray(list) && list.length) {
        allMenus = sortMenusByLikeCount(list.map(normalizeMenu))
        this.setData({
          menus: this.filterMenus(this.data.keyword),
          featuredMenu: getFeaturedMenu(allMenus),
          'quickStats[0].value': String(allMenus.length)
        })
      } else if (Array.isArray(list)) {
        allMenus = []
        this.setData({
          menus: [],
          featuredMenu: null,
          'quickStats[0].value': '0'
        })
      }
      return { success: true }
    } catch (e) {
      return { success: false, message: this.getErrorMessage(e) }
    }
  },

  async loadCombo() {
    try {
      const combo = normalizeCombo(await api.getActiveCombo())
      this.setData({
        comboRecommendation: combo
      })
      return { success: true }
    } catch (e) {
      this.setData({ comboRecommendation: null })
      return { success: false, message: this.getErrorMessage(e) }
    }
  },

  async loadAbout() {
    try {
      const aboutDescription = await api.getDescription()
      if (aboutDescription) {
        this.setData({ aboutDescription })
      }
      return { success: true }
    } catch (e) {
      return { success: false, message: this.getErrorMessage(e) }
    }
  },

  async loadActivities() {
    try {
      const list = await api.getActivityList()
      if (Array.isArray(list) && list.length) {
        const activities = list.map(normalizeActivity)
        this.setData({
          activities,
          homeActivities: activities.slice(0, 3),
          'quickStats[2].value': String(list.length)
        })
      } else if (Array.isArray(list)) {
        this.setData({
          activities: [],
          homeActivities: [],
          'quickStats[2].value': '0'
        })
      }
      return { success: true }
    } catch (e) {
      return { success: false, message: this.getErrorMessage(e) }
    }
  },

  getErrorMessage(err) {
    if (!err) {
      return '后端请求失败'
    }

    return err.errMsg || err.message || String(err)
  },

  switchTab(e) {
    this.setData({
      activeTab: e.currentTarget.dataset.key
    })
  },

  openAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim()
    this.setData({
      keyword,
      menus: this.filterMenus(keyword)
    })
  },

  clearSearch() {
    this.setData({
      keyword: '',
      menus: allMenus
    })
  },

  filterMenus(keyword) {
    if (!keyword) {
      return allMenus
    }

    return allMenus.filter((item) => {
      const text = `${item.name}${item.category}${item.desc}${item.ingredients.join('')}`
      return text.indexOf(keyword) > -1
    })
  },

  async toggleLike(e) {
    const menuId = Number(e.currentTarget.dataset.id)

    try {
      await this.ensureAuth()
      await api.likeMenu(menuId)
      this.updateMenuLike(menuId)
    } catch (err) {
      this.updateMenuLike(menuId)
      wx.showToast({
        title: '离线预览点赞',
        icon: 'none'
      })
    }
  },

  updateMenuLike(menuId) {
    const menus = this.data.menus.map((item) => {
      if (item.id !== menuId) {
        return item
      }

      const liked = !item.liked
      return Object.assign({}, item, {
        liked,
        likeCount: item.likeCount + (liked ? 1 : -1)
      })
    })

    allMenus = sortMenusByLikeCount(allMenus.map((item) => {
      const updated = menus.find((menu) => menu.id === item.id)
      return updated || item
    }))

    const combo = this.data.comboRecommendation
    let updatedComboItems = []
    const comboRecommendation = combo ? Object.assign({}, combo, {
      items: combo.items.map((item) => {
        if (item.id !== menuId) {
          return item
        }

        const liked = !item.liked
        return Object.assign({}, item, {
          liked,
          likeCount: item.likeCount + (liked ? 1 : -1)
        })
      })
    }) : null
    if (comboRecommendation) {
      updatedComboItems = comboRecommendation.items
      comboRecommendation.slots = RECOMMENDATION_SLOTS.map((label, index) => ({
        label,
        order: index + 1,
        menu: updatedComboItems[index] || null
      }))
    }

    this.setData({
      menus: this.filterMenus(this.data.keyword),
      featuredMenu: getFeaturedMenu(allMenus),
      comboRecommendation
    })
  },

  async openMenuDetail(e) {
    const menuId = Number(e.currentTarget.dataset.id)
    const comboItems = this.data.comboRecommendation ? this.data.comboRecommendation.items : []
    const selectedMenu = allMenus.find((item) => item.id === menuId) || comboItems.find((item) => item.id === menuId)
    if (!selectedMenu) {
      return
    }
    this.setData({
      selectedMenu,
      detailLoading: true,
      detailDragStartY: 0,
      detailSheetTranslateY: 0,
      detailSheetTransition: 'none',
      menuComments: [],
      menuCommentText: ''
    })

    try {
      const comments = await api.getMenuComments(menuId)
      this.setData({
        menuComments: Array.isArray(comments) ? comments.map(normalizeComment) : [],
        detailLoading: false
      })
    } catch (e) {
      this.setData({ detailLoading: false })
    }
  },

  closeMenuDetail() {
    this.setData({
      selectedMenu: null,
      menuComments: [],
      menuCommentText: '',
      detailDragStartY: 0,
      detailSheetTranslateY: 0,
      detailSheetTransition: 'none'
    })
  },

  noop() {},

  onSheetDragStart(e) {
    const touch = e.touches && e.touches[0]
    if (!touch) {
      return
    }

    this.setData({
      detailDragStartY: touch.clientY,
      detailSheetTransition: 'none'
    })
  },

  onSheetDragMove(e) {
    const touch = e.touches && e.touches[0]
    if (!touch || !this.data.detailDragStartY) {
      return
    }

    const distance = Math.max(0, touch.clientY - this.data.detailDragStartY)
    this.setData({
      detailSheetTranslateY: Math.min(distance, 220)
    })
  },

  onSheetDragEnd() {
    if (this.data.detailSheetTranslateY >= 72) {
      this.closeMenuDetail()
      return
    }

    this.setData({
      detailDragStartY: 0,
      detailSheetTranslateY: 0,
      detailSheetTransition: 'transform 180ms ease'
    })
  },

  onMenuCommentInput(e) {
    this.setData({ menuCommentText: e.detail.value })
  },

  onSuggestionInput(e) {
    this.setData({ suggestionText: e.detail.value })
  },

  onSuggestionContactInput(e) {
    this.setData({ suggestionContact: e.detail.value })
  },

  async submitSuggestion() {
    const content = this.data.suggestionText.trim()
    const contact = this.data.suggestionContact.trim()

    if (!content) {
      wx.showToast({ title: '请输入建议内容', icon: 'none' })
      return
    }

    if (content.length > 500) {
      wx.showToast({ title: '建议内容太长', icon: 'none' })
      return
    }

    try {
      this.setData({ submittingSuggestion: true })
      await this.ensureAuth()
      await api.createSuggestion(content, contact)
      this.setData({
        suggestionText: '',
        suggestionContact: '',
        submittingSuggestion: false
      })
      wx.showToast({ title: '已收到建议', icon: 'success' })
    } catch (e) {
      this.setData({ submittingSuggestion: false })
      wx.showToast({
        title: e.message || '提交失败',
        icon: 'none'
      })
    }
  },

  async submitMenuComment() {
    const selectedMenu = this.data.selectedMenu
    const comment = this.data.menuCommentText.trim()

    if (!selectedMenu) {
      return
    }

    if (!comment) {
      wx.showToast({ title: '请输入评论', icon: 'none' })
      return
    }

    try {
      const profile = await getWechatCommentProfile()
      await this.ensureAuth()
      wx.showLoading({ title: '提交中' })
      await api.commentMenu(selectedMenu.id, comment, profile)
      const comments = await api.getMenuComments(selectedMenu.id)
      wx.hideLoading()
      this.setData({
        menuCommentText: '',
        menuComments: Array.isArray(comments) ? comments.map(normalizeComment) : []
      })
      wx.showToast({ title: '已评论', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({
        title: e.message || '评论失败',
        icon: 'none'
      })
    }
  },

  deleteOwnComment(e) {
    const commentId = Number(e.currentTarget.dataset.id)
    const selectedMenu = this.data.selectedMenu
    if (!commentId || !selectedMenu) {
      return
    }

    wx.showModal({
      title: '删除评论',
      content: '确认删除你的这条评论？',
      confirmText: '删除',
      confirmColor: '#a04438',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          await this.ensureAuth()
          wx.showLoading({ title: '删除中' })
          await api.deleteMenuComment(commentId)
          const comments = await api.getMenuComments(selectedMenu.id)
          wx.hideLoading()
          this.setData({
            menuComments: Array.isArray(comments) ? comments.map(normalizeComment) : []
          })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          wx.hideLoading()
          wx.showToast({
            title: err.message || '删除失败',
            icon: 'none'
          })
        }
      }
    })
  },

  async ensureAuth() {
    const token = wx.getStorageSync('jingliange_token')
    if (token) {
      app.globalData.token = token
      return token
    }

    let userId = wx.getStorageSync('jingliange_user_id')
    if (!userId) {
      userId = `dev_${Date.now()}_${Math.floor(Math.random() * 100000)}`
      wx.setStorageSync('jingliange_user_id', userId)
    }

    const result = await api.login(userId)
    wx.setStorageSync('jingliange_token', result.token)
    app.globalData.token = result.token
    return result.token
  }
})
