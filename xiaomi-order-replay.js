// 存储键名
const STORAGE_KEYS = {
    LAST_STATUS: "xiaomi_order_last_status",
    REQUEST_HEADERS: "xiaomi_order_request_headers", 
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_URL: "xiaomi_order_request_url",
    REQUEST_METHOD: "xiaomi_order_request_method"
};

// 获取保存的请求信息
const savedHeaders = $persistentStore.read(STORAGE_KEYS.REQUEST_HEADERS);
const savedBody = $persistentStore.read(STORAGE_KEYS.REQUEST_BODY);
const savedUrl = $persistentStore.read(STORAGE_KEYS.REQUEST_URL);
const savedMethod = $persistentStore.read(STORAGE_KEYS.REQUEST_METHOD);

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
        headers: headers,
        body: savedBody || "",
        timeout: 15000
    };

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

            // 保存当前状态
            const currentStatus = {
                statusCode,
                statusName,
                statusDesc,
                updateTime: Date.now(),
                saveTime: new Date().toISOString(),
                source: "scheduled_check"
            };
            $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);

            // 通知
            $notification.post(
                "🚗 小米汽车订单状态",
                `${statusName}（${statusCode}）`,
                `当前状态: ${statusDesc}\n状态代码: ${statusCode}\n时间: ${new Date().toLocaleString('zh-CN')}`
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

// 状态码描述
function getStatusDescription(statusCode) {
    switch (statusCode) {
        case 2520: return "🏭 车辆生产中";
        case 2605: return "✅ 车辆已下线";
        case 3000: return "🚚 车辆运输中";
        default:   return "❓ 状态未知";
    }
}
