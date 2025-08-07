// 获取参数
const onlyNotifyOnChange = $argument.onlyNotifyOnChange === "true";
const replayInterval = $argument.replayInterval || "60";

// 存储键名
const STORAGE_KEYS = {
    LAST_NOTIFY_TIME: "xiaomi_order_last_notify_time",
    LAST_STATUS: "xiaomi_order_last_status",
    REQUEST_HEADERS: "xiaomi_order_request_headers", 
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_URL: "xiaomi_order_request_url",
    REQUEST_METHOD: "xiaomi_order_request_method"
};

// 缩短防重复通知间隔
const NOTIFY_COOLDOWN = 3 * 1000; // 3秒

console.log(`🔄 执行${replayInterval}分钟定时重放任务 (仅变化通知: ${onlyNotifyOnChange})`);

// 读取保存的完整请求信息
const savedHeaders = $persistentStore.read(STORAGE_KEYS.REQUEST_HEADERS);
const savedBody = $persistentStore.read(STORAGE_KEYS.REQUEST_BODY);
const savedUrl = $persistentStore.read(STORAGE_KEYS.REQUEST_URL);
const savedMethod = $persistentStore.read(STORAGE_KEYS.REQUEST_METHOD);

if (!savedHeaders || !savedUrl) {
    console.log("❌ 未找到完整的保存请求信息，请先通过App正常访问一次");
    console.warn("⚠️ 重放失败：缺少必要的请求信息");
    $done();
    return;
}

try {
    const headers = JSON.parse(savedHeaders);
    const url = savedUrl || "https://api.retail.xiaomiev.com/mtop/carlife/product/order";
    const method = savedMethod || "POST";
    
    // 构建完整请求参数
    const requestParams = {
        url: url,
        method: method,
        headers: headers,
        body: savedBody || "",
        timeout: 15000
    };
    
    console.log(`📡 使用保存的完整信息发起重放请求: ${method} ${url}`);
    console.warn("⚠️ 重放请求构建完成，开始发送");
    
    // 发起请求
    $httpClient.post(requestParams, function(error, response, data) {
        if (error) {
            console.log("❌ 重放请求失败:", error);
            console.warn("⚠️ 重放请求网络错误");
            $done();
            return;
        }
        
        console.log(`📨 重放请求成功，HTTP状态: ${response.status}`);
        console.warn("⚠️ 重放请求响应接收成功");
        
        try {
            // 解析响应
            let json = JSON.parse(data);
            let statusInfo = json?.data?.orderDetailDto?.statusInfo;
            
            if (statusInfo) {
                const currentTime = Date.now();
                let statusCode = statusInfo.orderStatus;
                let statusName = statusInfo.orderStatusName || "未知状态";
                let statusDesc = getStatusDescription(statusCode);
                
                console.log(`📊 重放获取状态: ${statusCode} - ${statusName}`);
                
                // 获取上次状态
                const lastStatusData = $persistentStore.read(STORAGE_KEYS.LAST_STATUS);
                let lastStatus = null;
                let hasStatusChanged = false;
                
                try {
                    lastStatus = lastStatusData ? JSON.parse(lastStatusData) : null;
                    hasStatusChanged = !lastStatus || (lastStatus.statusCode !== statusCode);
                } catch (e) {
                    console.log("📝 解析上次状态失败，视为首次获取");
                    hasStatusChanged = true;
                }
                
                // 保存当前状态
                const currentStatus = {
                    statusCode: statusCode,
                    statusName: statusName,
                    statusDesc: statusDesc,
                    updateTime: currentTime,
                    saveTime: new Date().toISOString(),
                    source: "replay"
                };
                $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
                console.warn("⚠️ 重放状态信息保存成功");
                
                // 决定是否发送通知
                let shouldNotify = false;
                let notifyReason = "";
                
                if (onlyNotifyOnChange) {
                    if (hasStatusChanged) {
                        shouldNotify = true;
                        notifyReason = lastStatus ? "状态发生变化" : "首次获取状态";
                    } else {
                        console.log("🔍 状态无变化，跳过通知");
                    }
                } else {
                    shouldNotify = true;
                    notifyReason = "定时检查通知";
                }
                
                // 检查通知冷却期
                const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
                const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;
                
                if (shouldNotify && !inCooldown) {
                    // 构建通知内容
                    let notificationTitle = `🔄 订单状态检查 (${replayInterval}分钟)`;
                    let notificationSubtitle = statusName;
                    let notificationBody = `状态码: ${statusCode}\n${statusDesc}`;
                    
                    if (hasStatusChanged && lastStatus) {
                        notificationBody += `\n📈 变化: ${lastStatus.statusCode} → ${statusCode}`;
                    }
                    
                    notificationBody += `\n⏰ 检查时间: ${new Date().toLocaleTimeString()}`;
                    
                    // 发送通知
                    $notification.post(notificationTitle, notificationSubtitle, notificationBody);
                    
                    // 更新通知时间
                    $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);
                    
                    console.log(`✅ 重放通知已发送: ${notifyReason}`);
                    console.warn("⚠️ 重放通知发送记录已保存");
                } else if (inCooldown) {
                    console.log(`⏰ 通知冷却期内(${NOTIFY_COOLDOWN/1000}秒)，跳过通知`);
                } else {
                    console.log("📋 重放完成，无需发送通知");
                }
                
            } else {
                console.log("⚠️ 重放响应中未找到订单状态信息");
                console.warn("⚠️ 重放响应解析失败：缺少statusInfo");
                if (data && data.length > 0) {
                    console.log("📄 响应预览:", data.substring(0, 200));
                }
            }
            
        } catch (e) {
            console.log("❌ 解析重放响应JSON失败:", e.message);
            console.warn("⚠️ 重放响应JSON解析错误");
            console.log("📄 原始响应:", data ? data.substring(0, 200) : "空响应");
        }
        
        $done();
    });
    
} catch (e) {
    console.log("❌ 构建重放请求失败:", e.message);
    console.warn("⚠️ 重放请求构建过程发生错误");
    $done();
}

// 状态码翻译函数
function getStatusDescription(statusCode) {
    switch (statusCode) {
        case 2520:
            return "🚧 车辆尚未下线";
        case 2605:
            return "✅ 车辆已下线";
        case 3000:
            return "🚚 车辆已运出";
        default:
            return "ℹ️ 状态未知或未记录，建议留意变化";
    }
}
