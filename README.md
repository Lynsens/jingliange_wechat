# 净莲阁微信小程序前端

净莲阁微信小程序前端，当前包含首页、素食菜单、功德榜和关于页面的一体化 UI 原型。

## 当前状态

- 使用微信小程序原生 WXML / WXSS / JS
- 后端服务地址预留在 `miniprogram/app.js`
- 已接入 `jingliange_server` 的菜单、功德榜、活动、关于和登录接口
- 后端不可用时会自动显示本地预览数据

## 运行

使用微信开发者工具导入本项目，项目根目录选择 `jingliange_wechat`。

当前默认请求：

```text
https://jingliange.com/api/v1
```

当前开发配置已关闭 `urlCheck`，方便微信开发者工具模拟器直接请求 HTTPS 后端域名。如果要改回本地后端，把 `miniprogram/app.js` 里的 `apiBaseUrl` 改成 `http://localhost:8000/api/v1`。真机预览和正式发布需要在小程序后台配置合法 request 域名，建议配置 `https://jingliange.com`。
