const { request, uploadFile, normalizeUploadImageUrl } = require('../utils/request')

function getCurrentYear() {
  return new Date().getFullYear()
}

function getMenuList(name) {
  return request({
    url: '/menu/getMenu',
    method: 'POST',
    data: {
      name: name || '',
      page_size: 20,
      page_number: 0
    }
  }).then((list) => {
    if (!Array.isArray(list)) {
      return list
    }

    return list.map((item) => ({
      ...item,
      image_url: normalizeUploadImageUrl(item.image_url)
    }))
  })
}

function likeMenu(menuId) {
  return request({
    url: '/menu/like',
    method: 'POST',
    data: {
      menu_id: menuId
    }
  })
}

function getMenuComments(menuId) {
  return request({
    url: '/menu/getComments',
    method: 'POST',
    data: {
      menu_id: menuId,
      page_size: 10,
      page_number: 0
    }
  })
}

function commentMenu(menuId, comment) {
  return request({
    url: '/menu/comment',
    method: 'POST',
    data: {
      menu_id: menuId,
      comment
    }
  })
}

function getDonationStats() {
  return request({
    url: '/donation/getDonationStats',
    method: 'POST',
    data: {
      year: getCurrentYear(),
      period: 'all'
    }
  })
}

function getDonationList() {
  return request({
    url: '/donation/getDonationList',
    method: 'POST',
    data: {
      year: getCurrentYear(),
      period: 'all',
      donor_name: '',
      sort_by: 'time',
      sort_order: 'desc',
      page_size: 10,
      page_number: 0
    }
  })
}

function createDonation(data) {
  return request({
    url: '/donation/createDonation',
    method: 'POST',
    data
  })
}

function getDescription() {
  return request({
    url: '/about/getDescription',
    method: 'GET'
  })
}

function getActivityList() {
  return request({
    url: '/about/getActivityList',
    method: 'POST',
    data: {
      timestamp: 0,
      page_number: 0
    }
  })
}

function login(userId) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: {
      user_id: userId
    }
  })
}

function adminLogin(username, password) {
  return request({
    admin: true,
    url: '/login',
    method: 'POST',
    data: {
      username,
      password
    }
  })
}

function uploadMenuImage(filePath, desc) {
  return uploadFile({
    url: '/uploadImage',
    filePath,
    name: 'image',
    formData: {
      desc: desc || '菜单图片',
      top_pic: 0,
      type: 0
    }
  }).then((data) => ({
    ...data,
    image_url: normalizeUploadImageUrl(data.image_url)
  }))
}

function uploadMenuItem(data) {
  return request({
    admin: true,
    url: '/uploadMenuItem',
    method: 'POST',
    data
  })
}

function updateMenuItem(data) {
  return request({
    admin: true,
    url: '/updateMenuItem',
    method: 'PUT',
    data
  })
}

function deleteMenuItem(id) {
  return request({
    admin: true,
    url: '/deleteMenuItem',
    method: 'DELETE',
    data: {
      id
    }
  })
}

module.exports = {
  getMenuList,
  likeMenu,
  getMenuComments,
  commentMenu,
  getDonationStats,
  getDonationList,
  createDonation,
  getDescription,
  getActivityList,
  login,
  adminLogin,
  uploadMenuImage,
  uploadMenuItem,
  updateMenuItem,
  deleteMenuItem
}
