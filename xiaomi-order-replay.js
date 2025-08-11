// 小米汽车订单状态定时检查脚本（xiaomi-order-replay.js）

const STORAGE_KEYS = {
    LAST_STATUS: "xiaomi_order_last_status",
    REQUEST_HEADERS: "xiaomi_order_request_headers",
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_URL: "xiaomi_order_request_url",
    REQUEST_METHOD: "xiaomi_order_request_method"
};

// 读取请求信息
const savedHeaders = $persistentStore.read(STORAGE_KEYS.REQUEST_HEADERS);
const savedBody = $persistentStore.read(STORAGE_KEYS.REQUEST_BODY);
const savedUrl = $persistentStore.read(STORAGE_KEYS.REQUEST_URL);
const savedMethod = $persistentStore.read(STORAGE_KEYS.REQUEST_METHOD);

// 如果请求信息缺失，提醒用户
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

    $httpClient.post(requestParams, (error, response, data) => {
        if (error) {
            console.log("❌ 请求失败:", error);
            $done();
            return;
        }

        try {
            const json = JSON.parse(data);
            const statusInfo = json?.data?.orderDetailDto?.statusInfo;
            
            // 获取车架号
            const vid = json?.data?.orderDetailDto?.buyCarInfo?.vid;
            console.log(`🔍 [定时检查] VID: ${vid || "未获取到"}`);

            if (!statusInfo) {
                console.log("⚠️ 响应中无订单状态信息");
                $done();
                return;
            }

            const statusCode = statusInfo.orderStatus;
            const statusName = statusInfo.orderStatusName || "未知状态";
            const statusDesc = getStatusDescription(statusCode, vid);
            const now = new Date().toLocaleString('zh-CN');

            // 保存当前状态
            const currentStatus = {
                statusCode,
                statusName,
                statusDesc,
                vid: vid || null,
                updateTime: Date.now(),
                saveTime: new Date().toISOString(),
                source: "scheduled_check"
            };
            $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);

            // 判断车辆是否下线（车架号以HXM开头）
            const isOffline = vid && vid.startsWith("HXM");

            // 🎉 特殊处理：车辆下线
            if (isOffline || statusCode === 2605) {
                const title = "🎉🎉🎉 喜大普奔下线了 ！！！";
                let message = `${statusDesc}（${statusCode}）`;
                if (vid) {
                    message += `\n🏷️ 车架号: ${vid}`;
                }
                message += `\n⏰ ${now}`;
                $notification.post(title, "", message);
                console.log("✅ 已发送车辆下线通知");
            } else {
                // 其他状态
                const title = "🚗 订单状态定时查询";
                let message = `${statusDesc}（${statusCode}）`;
                if (vid) {
                    message += `\n🏷️ 车架号: ${vid}`;
                }
                message += `\n⏰ ${now}`;
                $notification.post(title, "", message);
                console.log("✅ 状态更新通知已发送");
            }

            // 详细日志
            console.log("📊 [定时检查详情]");
            console.log(`     状态码: ${statusCode}`);
            console.log(`     状态名: ${statusName}`);
            console.log(`     描 述: ${statusDesc}`);
            console.log(`     车架号: ${vid || "未获取到"}`);
            console.log(`     下线判断: ${isOffline ? "✅ 已下线" : "❌ 未下线"}`);

        } catch (e) {
            console.log("❌ 响应解析失败:", e.message);
        }

        $done();
    });

} catch (e) {
    console.log("❌ 构造请求失败:", e.message);
    $done();
}

// 状态码解释 - 修改为根据车架号判断下线状态
function getStatusDescription(statusCode, vid) {
    // 首先判断车架号是否以HXM开头来确定下线状态
    const isOffline = vid && vid.startsWith("HXM");
    
    switch (statusCode) {
        case 2520:
            return isOffline ? "🎉 车辆已下线" : "🔨 车辆生产中";
        case 2605:
            return "🎉 车辆已下线"; // 原本就是下线状态
        case 3000:
            return "🚚 车辆运输中";
        default:
            // 对于其他状态码，也根据车架号判断
            if (isOffline) {
                return "🎉 车辆已下线";
            }
            return "❓ 状态未知";
    }
}
