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
    initial: '汤',
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
    initial: '藕',
    name: '桂花莲藕羹',
    desc: '莲藕细磨成羹，以少量桂花提香，甜度克制。',
    ingredients: ['莲藕', '桂花', '红枣'],
    nutrition: '温润 / 少糖',
    likeCount: 74,
    liked: false,
    color: 'gold'
  }
]

const fallbackDonations = [
  { id: 1, donorName: '善心人士', amount: '1,000', message: '愿大众安康', date: '2026.05.18' },
  { id: 2, donorName: '明心', amount: '500', message: '随喜供养', date: '2026.05.15' },
  { id: 3, donorName: '莲友', amount: '300', message: '护持素食推广', date: '2026.05.12' }
]

const fallbackActivities = [
  { id: 1, title: '周末素食共修', time: '周六 10:30', place: '净莲阁斋堂' },
  { id: 2, title: '莲花茶会', time: '周日 14:00', place: '二楼茶室' }
]

const colors = ['green', 'pink', 'gold']

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
  return items.length ? items : fallback
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

function formatAmount(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })
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

  if (/^https?:\/\//.test(url)) {
    return url
  }

  return `${getApiOrigin()}${url.startsWith('/') ? url : `/${url}`}`
}

function normalizeMenu(item, index) {
  const name = item.name || '未命名素食'
  const ingredients = toDisplayList(item.ingredients, ['素食'])
  const nutritionItems = toDisplayList(item.nutrition, ['清淡素食'])
  return {
    id: item.id,
    initial: name.slice(0, 1),
    name,
    desc: item.desc || '暂无介绍',
    imageUrl: normalizeImageUrl(item.image_url),
    ingredients,
    nutritionItems,
    nutrition: nutritionItems.join(' / ') || formatNutrition(item.nutrition),
    likeCount: item.like_count || item.likeCount || 0,
    liked: Boolean(item.liked),
    color: colors[index % colors.length]
  }
}

function normalizeDonation(item) {
  return {
    id: item.id,
    donorName: item.donor_name || item.donorName || '善心人士',
    amount: formatAmount(item.amount),
    message: item.message || '随喜护持',
    date: formatDate(item.donate_time || item.date || item.create_time)
  }
}

function normalizeActivity(item) {
  return {
    id: item.id,
    title: item.title || '净莲阁活动',
    time: formatDate(item.create_time) || '近期',
    place: item.content || '净莲阁'
  }
}

function normalizeComment(item) {
  const userId = item.user_id || '莲友'
  return {
    id: item.id,
    userId,
    avatar: userId.slice(0, 1),
    comment: item.comment || '随喜赞叹',
    date: formatDate(item.create_time)
  }
}

Page({
  data: {
    menuPosition: wx.getMenuButtonBoundingClientRect(),
    activeTab: 'home',
    keyword: '',
    loading: false,
    offlineMode: false,
    backendError: '',
    aboutDescription: '净莲阁以素食、茶会与公益活动连接同修善友。小程序将承载菜单展示、活动发布、功德榜与随喜登记。',
    featuredMenu: allMenus[0],
    selectedMenu: null,
    detailLoading: false,
    menuComments: [],
    menuCommentText: '',
    donationName: '',
    donationAmount: '',
    donationMessage: '',
    navItems: [
      { key: 'home', title: '首页' },
      { key: 'menu', title: '素食' },
      { key: 'donation', title: '功德榜' },
      { key: 'about', title: '关于' }
    ],
    quickStats: [
      { label: '素食', value: '8' },
      { label: '随喜人次', value: '236' },
      { label: '活动', value: '5' }
    ],
    menus: allMenus,
    donationStats: {
      totalAmount: '36,820',
      totalCount: '236'
    },
    donations: fallbackDonations,
    activities: fallbackActivities
  },

  onLoad() {
    this.loadPageData()
  },

  async loadPageData() {
    this.setData({ loading: true })

    const results = await Promise.all([
      this.loadMenus(),
      this.loadDonationStats(),
      this.loadDonations(),
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
        allMenus = list.map(normalizeMenu)
        this.setData({
          menus: this.filterMenus(this.data.keyword),
          featuredMenu: allMenus[0],
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

  async loadDonationStats() {
    try {
      const stats = await api.getDonationStats()
      this.setData({
        donationStats: {
          totalAmount: formatAmount(stats.total_amount),
          totalCount: formatAmount(stats.total_count)
        },
        'quickStats[1].value': formatAmount(stats.total_count)
      })
      return { success: true }
    } catch (e) {
      return { success: false, message: this.getErrorMessage(e) }
    }
  },

  async loadDonations() {
    try {
      const list = await api.getDonationList()
      if (Array.isArray(list)) {
        this.setData({
          donations: list.map(normalizeDonation)
        })
      }
      return { success: true }
    } catch (e) {
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
        this.setData({
          activities: list.map(normalizeActivity),
          'quickStats[2].value': String(list.length)
        })
      } else if (Array.isArray(list)) {
        this.setData({
          activities: [],
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
      const text = `${item.name}${item.desc}${item.ingredients.join('')}`
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

    allMenus = allMenus.map((item) => {
      const updated = menus.find((menu) => menu.id === item.id)
      return updated || item
    })

    this.setData({
      menus,
      featuredMenu: allMenus[0]
    })
  },

  async openMenuDetail(e) {
    const menuId = Number(e.currentTarget.dataset.id)
    const selectedMenu = allMenus.find((item) => item.id === menuId)
    this.setData({
      selectedMenu,
      detailLoading: true,
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
      menuCommentText: ''
    })
  },

  noop() {},

  onMenuCommentInput(e) {
    this.setData({ menuCommentText: e.detail.value })
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
      wx.showLoading({ title: '提交中' })
      await this.ensureAuth()
      await api.commentMenu(selectedMenu.id, comment)
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
        title: '评论失败',
        icon: 'none'
      })
    }
  },

  onDonationNameInput(e) {
    this.setData({ donationName: e.detail.value })
  },

  onDonationAmountInput(e) {
    this.setData({ donationAmount: e.detail.value })
  },

  onDonationMessageInput(e) {
    this.setData({ donationMessage: e.detail.value })
  },

  async submitDonationPreview() {
    const donorName = this.data.donationName.trim()
    const amount = Number(this.data.donationAmount)
    const message = this.data.donationMessage.trim()

    if (!donorName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }

    if (!amount || amount <= 0) {
      wx.showToast({ title: '请填写金额', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '提交中' })
      await this.ensureAuth()
      await api.createDonation({
        donor_name: donorName,
        amount,
        message
      })
      wx.hideLoading()
      wx.showToast({ title: '已提交', icon: 'success' })
      this.setData({
        donationName: '',
        donationAmount: '',
        donationMessage: ''
      })
      await Promise.all([this.loadDonationStats(), this.loadDonations()])
    } catch (e) {
      wx.hideLoading()
      wx.showToast({
        title: '提交失败，请确认后端已启动',
        icon: 'none'
      })
    }
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
