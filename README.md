# XMICar-StatusPeek

订单状态辅助判断

## 🔍 判断逻辑

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

- 打开 Loon App
- 进入「配置」→「插件」
- 点击右上角「+」添加插件
- 输入插件地址
```
https://raw.githubusercontent.com/YangHanqing/XMICar-StatusPeek/refs/heads/main/XMICar-StatusPeek.plugin
```

### 测试效果

- 打开小米汽车 App
- 进入订单详情页面
- 即可收到状态通知
- 插件设置中可以开启【自动获取最新状态】，每隔 30 分钟自动通知
