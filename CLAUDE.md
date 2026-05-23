# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

This is the WeChat Mini Program frontend for Jingliange. The backend service lives in the sibling `jingliange_server` repository and exposes menu, donation, activity, image, auth, and about APIs.

## Development

Import the repository root into WeChat Developer Tools. The mini program root is `miniprogram/`.

There are currently no required npm dependencies. The UI is implemented with native WXML, WXSS, and JavaScript.

## Architecture

- `miniprogram/app.js`: global app configuration and backend API base URL
- `miniprogram/app.json`: page registration and custom navigation style
- `miniprogram/utils/request.js`: shared `wx.request` wrapper
- `miniprogram/services/api.js`: backend API functions
- `miniprogram/pages/index/`: single-page UI shell with tabs for home, menu, donation, and about
- `miniprogram/components/`: reusable components from the original scaffold; currently unused by the main page

## Backend API Notes

The backend base URL is configured in `miniprogram/app.js` as `globalData.apiBaseUrl`. It currently points to the deployed HTTPS backend at `https://jingliange.com/api/v1`.

Relevant backend routes include:

- `POST /api/v1/menu/getMenu`
- `POST /api/v1/menu/getMenuByID`
- `POST /api/v1/menu/like`
- `POST /api/v1/donation/getDonationList`
- `POST /api/v1/donation/getDonationStats`
- `POST /api/v1/donation/createDonation`
- `POST /api/v1/auth/login`
- `GET /api/v1/about/getDescription`
- `GET /api/v1/about/getTopImage`
- `POST /api/v1/about/getActivityList`

The index page calls these APIs through `miniprogram/services/api.js`. Local mock data remains as a fallback when the backend is offline.
