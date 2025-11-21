# XMICar-StatusPeek

小米汽车下线状态监控脚本

## 🔍 判断逻辑

### 根据无忧包 Purchase Code 判断

> 截止 2025-11-21 当前方法已被作者实际验证有效。后续不会再更新判断逻辑，如有变化请自行适配 ~

- 监听接口：`/mtop/carlife/product/dynamic`
- 识别无忧包：`goodsId: 2230004385`
- 判断逻辑：
  - `servicePackagePurchaseInfo.code === 4` → 车辆未下线
  - `servicePackagePurchaseInfo.code !== 4` → 车辆已下线

### 根据车架号判断（2025-08-12 已失效）
- 获取车架号（VID）信息
- 如果车架号以 `HXM` 开头，则判断为车辆已下线

### 根据状态码判断（2025-08-10 已失效）
- 🚧 车辆尚未下线 (2520)
- ✅ 车辆已下线 (2605)
- 🚚 车辆已运出 (3000)

## 🚀 使用教程

### 前置条件
- 安装 iOS Loon App
- 开启 Loon 的 脚本 功能
- 开启 Loon 的 MITM 功能

### 使用步骤

1. 打开 Loon App
2. 进入「配置」→「插件」
3. 点击右上角「+」添加插件
4. 输入插件地址：
```
https://raw.githubusercontent.com/YangHanqing/XMICar-StatusPeek/refs/heads/main/XMICar-StatusPeek.plugin
```

### 测试效果

1. 打开小米汽车 App
2. 进入**无忧包购买页面**（重要：必须访问此页面才能触发监控）
3. 即可收到下线状态通知
4. 插件设置中可以开启【自动获取最新状态】，每隔 10 分钟自动检查

## 🔧 脚本说明

- `car-worry-free-monitor.js` - 实时监控脚本，拦截App请求并分析响应
- `car-order-data-monitor.js` - 订单数据监控脚本
- `xiaomi-order-replay.js` - 定时检查脚本，主动请求接口检查状态

## 📝 更新日志

- **2025-11-18** - 更新为基于 Purchase Code 的判断方法，监听 `/dynamic` 接口
- **2025-10-17** - 更新为基于无忧包可购买状态的判断方法
- **2025-08-12** - 车架号判断方法失效
- **2025-08-10** - 状态码判断方法失效
