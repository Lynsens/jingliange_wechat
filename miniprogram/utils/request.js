const app = getApp()

function getApiBaseUrl() {
  return app.globalData.apiBaseUrl.replace(/\/$/, '')
}

function getApiRootUrl() {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, '')
}

function normalizeUploadImageUrl(imageUrl) {
  if (!imageUrl) {
    return ''
  }

  if (imageUrl.indexOf('/images/') === 0) {
    return ''
  }

  if (imageUrl.indexOf('http://49.234.22.169:8000/') === 0) {
    return imageUrl.replace('http://49.234.22.169:8000', getApiRootUrl())
  }

  if (imageUrl.indexOf('/uploads/') === 0) {
    return `${getApiRootUrl()}${imageUrl}`
  }

  return imageUrl
}

function request(options) {
  const method = options.method || 'GET'
  const data = options.data || {}
  const token = options.admin
    ? wx.getStorageSync('jingliange_admin_token') || app.globalData.adminToken
    : wx.getStorageSync('jingliange_token') || app.globalData.token
  const header = {
    'content-type': 'application/json'
  }

  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    const baseUrl = options.admin ? `${getApiRootUrl()}/api/admin` : getApiBaseUrl()

    wx.request({
      url: `${baseUrl}${options.url}`,
      method,
      data,
      header,
      success(res) {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 200) {
          resolve(body.data)
          return
        }

        reject({
          statusCode: res.statusCode,
          code: body.code,
          message: typeof body.data === 'string' ? body.data : body.msg || '请求失败',
          data: body.data
        })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

function uploadFile(options) {
  const token = options.admin
    ? wx.getStorageSync('jingliange_admin_token') || app.globalData.adminToken
    : wx.getStorageSync('jingliange_token') || app.globalData.token
  const header = {}

  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    const baseUrl = options.admin ? `${getApiRootUrl()}/api/admin` : getApiBaseUrl()

    wx.uploadFile({
      url: `${baseUrl}${options.url}`,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header,
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data || '{}')
        } catch (e) {
          reject({
            statusCode: res.statusCode,
            message: '上传响应格式错误'
          })
          return
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 200) {
          resolve(body.data)
          return
        }

        reject({
          statusCode: res.statusCode,
          code: body.code,
          message: typeof body.data === 'string' ? body.data : body.msg || '上传失败',
          data: body.data
        })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  request,
  uploadFile,
  normalizeUploadImageUrl
}
