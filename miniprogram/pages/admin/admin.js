const api = require('../../services/api')
const app = getApp()

const DEFAULT_ADMIN_USERNAME = 'admin'
const UNIT_OPTIONS = ['g', 'ml']
const MAX_METRIC_ROWS = 3
const IMAGE_COMPRESS_QUALITY = 72
const IMAGE_COMPRESS_WIDTH = 1280
let rowSeed = 0

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
    ingredients: [createMetricRow()],
    nutrition: [createMetricRow()]
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

function hasCompleteRows(rows) {
  return rows.some((row) => row.name.trim() && row.quantity.trim() && row.unit.trim())
}

function hasPartialRows(rows) {
  return rows.some((row) => {
    const values = [row.name.trim(), row.quantity.trim(), row.unit.trim()]
    return values.some(Boolean) && values.some((value) => !value)
  })
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
    likeCount: item.like_count || 0
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
    menuKeyword: '',
    unitOptions: UNIT_OPTIONS,
    menus: [],
    displayMenus: [],
    showEditor: false,
    editingMenuId: 0,
    formReady: true,
    form: createEmptyForm()
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
        showEditor: false,
        editingMenuId: 0
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
      menuKeyword: '',
      menus: [],
      displayMenus: [],
      showEditor: false,
      editingMenuId: 0,
      form: createEmptyForm()
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
      const list = await api.getMenuList('')
      const menus = Array.isArray(list) ? list.map(formatMenu) : []
      this.setData({
        menus,
        displayMenus: filterAdminMenus(menus, this.data.menuKeyword),
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

  onMenuKeywordInput(e) {
    const menuKeyword = e.detail.value
    this.setData({
      menuKeyword,
      displayMenus: filterAdminMenus(this.data.menus, menuKeyword)
    })
  },

  clearMenuKeyword() {
    this.setData({
      menuKeyword: '',
      displayMenus: this.data.menus
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
          ingredients: parseMetricRows(menu.ingredients),
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

    if (!name || !desc || !imageUrl) {
      wx.showToast({
        title: '请填写完整',
        icon: 'none'
      })
      return
    }

    if (!hasCompleteRows(form.ingredients) || hasPartialRows(form.ingredients)) {
      wx.showToast({
        title: '请完善食材',
        icon: 'none'
      })
      return
    }

    if (!hasCompleteRows(form.nutrition) || hasPartialRows(form.nutrition)) {
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
        ingredients: rowsToJsonObjectText(form.ingredients),
        nutrition: rowsToJsonObjectText(form.nutrition)
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
  }
})
