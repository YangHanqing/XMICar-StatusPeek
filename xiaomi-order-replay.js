// 小米汽车订单状态定时检查脚本（xiaomi-order-replay.js）

// ✅ 本地存储键
const STORAGE_KEYS = {
    LAST_STATUS: "xiaomi_order_last_status",
    REQUEST_HEADERS: "xiaomi_order_request_headers",
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_URL: "xiaomi_order_request_url",
    REQUEST_METHOD: "xiaomi_order_request_method"
};

// ✅ 加载请求信息
const savedHeaders = $persistentStore.read(STORAGE_KEYS.REQUEST_HEADERS);
const savedBody = $persistentStore.read(STORAGE_KEYS.REQUEST_BODY);
const savedUrl = $persistentStore.read(STORAGE_KEYS.REQUEST_URL);
const savedMethod = $persistentStore.read(STORAGE_KEYS.REQUEST_METHOD);

// 🚫 请求信息缺失，提示用户打开App
if (!savedHeaders || !savedUrl) {
    console.log("❌ 未找到请求信息，请先手动打开App查询一次订单");
    $done();
    return;
}

try {
    const headers = JSON.parse(savedHeaders);
    const requestParams = {
        url: savedUrl,
        method: savedMethod || "POST",
        headers,
        body: savedBody || "",
        timeout: 15000
    };

    // 📡 发起请求
    $httpClient.post(requestParams, (error, response, data) => {
        if (error) {
            console.log("❌ 请求失败:", error);
            $done();
            return;
        }

        try {
            const json = JSON.parse(data);
            const statusInfo = json?.data?.orderDetailDto?.statusInfo;

            if (!statusInfo) {
                console.log("⚠️ 响应中无订单状态信息");
                $done();
                return;
            }

            const statusCode = statusInfo.orderStatus;
            const statusName = statusInfo.orderStatusName || "未知状态";
            const statusDesc = getStatusDescription(statusCode);

            // 保存最新状态
            const currentStatus = {
                statusCode,
                statusName,
                statusDesc,
                updateTime: Date.now(),
                saveTime: new Date().toISOString(),
                source: "scheduled_check"
            };
            $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);

            // 🎉 特殊处理：已下线时加点仪式感
            const isOffline = statusCode === 2605;
            const subtitle = `状态代码：${statusCode}`;
            const message = isOffline
                ? `🎉🎉🎉喜大普奔，下线了🎉🎉🎉\n时间：${new Date().toLocaleString('zh-CN')}`
                : `当前状态：${statusDesc}\n时间：${new Date().toLocaleString('zh-CN')}`;

            // 🔔 推送通知
            $notification.post(
                "🚗 订单状态定时查询",
                subtitle,
                message
            );

        } catch (e) {
            console.log("❌ 响应解析失败:", e.message);
        }

        $done();
    });

} catch (e) {
    console.log("❌ 构造请求失败:", e.message);
    $done();
}

// ✅ 状态码对应描述
function getStatusDescription(statusCode) {
    switch (statusCode) {
        case 2520: return "🏭 车辆生产中";
        case 2605: return "✅ 车辆已下线";
        case 3000: return "🚚 车辆运输中";
        default:   return "❓ 状态未知";
    }
}
