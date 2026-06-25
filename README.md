# ISCSI挂载

fnOS iSCSI 挂载工具 —— 在飞牛 NAS 上轻松管理 iSCSI 存储连接。

## 功能

- **仪表盘** — 活跃会话、已发现目标、挂载点、自动重连概览；实时 I/O 性能监控（读写速率/IOPS 图表）；已连接目标列表
- **目标发现** — 一键自动扫描局域网（端口 3260）发现 iSCSI 目标，也支持手动输入 Portal 地址
- **会话管理** — 登录/登出目标，支持 CHAP 认证，开机自动重连开关
- **挂载管理** — 格式化（ext4/xfs/btrfs）、挂载/卸载，自动识别 RAID/LVM 深层嵌套设备
- **fnOS 深度集成** — 自动检测 fnOS 已管理的存储空间，防止误操作；自定义卸载向导提示

## 安装

1. 从 [Releases](https://github.com/iStarCc/FNOS-ISCSI/releases) 下载最新 `.fpk` 文件
2. 在 fnOS 管理界面 → 应用管理 → 手动安装，上传 `.fpk` 文件
3. 安装完成后在桌面打开「ISCSI挂载」

## 从源码构建

```bash
git clone https://github.com/iStarCc/FNOS-ISCSI.git
cd FNOS-ISCSI
npm install
node scripts/build.js
```

构建产物：`fnnas.iscsi/fnnas.iscsi.fpk`

> 需要预先安装 [fnpack](https://developer.fnnas.com/docs/cli/fnpack/)。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite |
| 后端 | Node.js + Express |
| 系统 | iscsiadm、mount/umount、lsblk、/proc/diskstats |
| 打包 | fnpack → .fpk |

## 项目结构

```
├── backend/          # Express 后端服务
│   ├── routes/       # API 路由（discovery/session/mount/config）
│   └── services/     # 业务逻辑（iscsiadm/mounter/scanner/reconnect）
├── frontend/         # Vue 3 前端
│   └── src/views/    # 页面组件（Dashboard/Discovery/Sessions/Mounts）
├── fnnas.iscsi/      # fnOS 应用包目录
│   ├── cmd/          # 生命周期脚本
│   ├── config/       # 权限与资源配置
│   ├── wizard/       # 用户向导
│   └── manifest      # 应用清单
└── scripts/          # 构建脚本
```

## 风险提示

- 本工具需要 root 权限，涉及底层存储操作，操作不当可能导致数据丢失
- 格式化操作不可逆，执行前请确认设备上没有重要数据
- 若 iSCSI 设备已加入 fnOS 存储空间管理，请先在「空间管理」中移除后再操作

## 许可

Copyright (c) 2024 iStars
