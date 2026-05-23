const api = require('../../services/api')
const app = getApp()

const DEFAULT_ADMIN_USERNAME = 'admin'

function toJsonObjectText(lines) {
  const result = {}
  lines
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/[:：]/)
      const key = (parts.shift() || '').trim()
      const value = parts.join(':').trim()
      if (key && value) {
        result[key] = value
      }
    })

  return JSON.stringify(result)
}

function formatMenu(item) {
  return {
    id: item.id,
    name: item.name || '未命名素食',
    desc: item.desc || '暂无介绍',
    likeCount: item.like_count || 0
  }
}

Page({
  data: {
    adminAuthed: false,
    adminUsername: DEFAULT_ADMIN_USERNAME,
    adminPassword: '',
    loading: false,
    saving: false,
    uploadingImage: false,
    menus: [],
    form: {
      name: '',
      desc: '',
      imageUrl: '',
      ingredients: '',
      nutrition: ''
    }
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
        adminPassword: ''
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
      menus: []
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
      this.setData({
        menus: Array.isArray(list) ? list.map(formatMenu) : [],
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

  updateField(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  resetForm() {
    this.setData({
      form: {
        name: '',
        desc: '',
        imageUrl: '',
        ingredients: '',
        nutrition: ''
      }
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
      const result = await api.uploadMenuImage(filePath, imageDesc)
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
    const ingredients = form.ingredients.trim()
    const nutrition = form.nutrition.trim()

    if (!name || !desc || !imageUrl || !ingredients || !nutrition) {
      wx.showToast({
        title: '请填写完整',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      this.ensureAdminAuth()
      await api.uploadMenuItem({
        name,
        desc,
        image_url: imageUrl,
        ingredients: toJsonObjectText(ingredients),
        nutrition: toJsonObjectText(nutrition)
      })
      wx.showToast({
        title: '已保存',
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
