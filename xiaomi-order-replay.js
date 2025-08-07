// 获取参数
const onlyNotifyOnChange = $argument.onlyNotifyOnChange === "true";

// 存储键名
const STORAGE_KEYS = {
    LAST_NOTIFY_TIME: "xiaomi_order_last_notify_time",
    LAST_STATUS: "xiaomi_order_last_status",
    REQUEST_HEADERS: "xiaomi_order_request_headers", 
    REQUEST_BODY: "xiaomi_order_request_body"
};

// 防重复通知间隔（10秒）
const NOTIFY_COOLDOWN = 10 * 1000;

console.log("🔄 开始执行定时重放任务");

// 读取保存的请求信息
const savedHeaders = $persistentStore.read(STORAGE_KEYS.REQUEST_HEADERS);
const savedBody = $persistentStore.read(STORAGE_KEYS.REQUEST_BODY);

if (!savedHeaders) {
    console.log("❌ 未找到保存的请求头信息，请先通过App正常访问一次");
    $done();
    return;
}

try {
    const headers = JSON.parse(savedHeaders);
    
    // 构建请求参数
    const requestParams = {
        url: "https://api.retail.xiaomiev.com/mtop/carlife/product/order",
        method: "POST",
        headers: headers,
        body: savedBody || "",
        timeout: 10000
    };
    
    // 发起请求
    $httpClient.post(requestParams, function(error, response, data) {
        if (error) {
            console.log("❌ 重放请求失败:", error);
            $done();
            return;
        }
        
        try {
            // 解析响应
            let json = JSON.parse(data);
            let statusInfo = json?.data?.orderDetailDto?.statusInfo;
            
            if (statusInfo) {
                let statusCode = statusInfo.orderStatus;
                let statusName = statusInfo.orderStatusName || "未知状态";
                let statusDesc = getStatusDescription(statusCode);
                
                // 获取上次状态
                const lastStatusData = $persistentStore.read(STORAGE_KEYS.LAST_STATUS);
                let lastStatus = null;
                try {
                    lastStatus = lastStatusData ? JSON.parse(lastStatusData) : null;
                } catch (e) {
                    console.log("解析上次状态数据失败:", e);
                }
                
                // 保存当前状态
                const currentTime = Date.now();
                const currentStatus = {
                    statusCode: statusCode,
                    statusName: statusName,
                    statusDesc: statusDesc,
                    updateTime: currentTime
                };
                $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
                
                // 判断是否需要通知
                let shouldNotify = false;
                let notifyReason = "";
                
                if (onlyNotifyOnChange) {
                    if (!lastStatus) {
                        shouldNotify = true;
                        notifyReason = "首次重放获取状态";
                    } else if (lastStatus.statusCode !== statusCode) {
                        shouldNotify = true;
                        notifyReason = "重放检测到状态变化";
                    } else {
                        console.log("🔍 重放检测：状态无变化，跳过通知");
                    }
                } else {
                    shouldNotify = true;
                    notifyReason = "定时重放通知";
                }
                
                // 检查通知冷却期
                const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
                const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;
                
                if (shouldNotify && !inCooldown) {
                    // 构建通知内容
                    let notificationTitle = "🔄 订单状态定时检查";
                    let notificationSubtitle = statusName;
                    let notificationBody = `状态码: ${statusCode}\n${statusDesc}`;
                    
                    if (lastStatus && lastStatus.statusCode !== statusCode) {
                        notificationBody += `\n📈 变化: ${lastStatus.statusCode} → ${statusCode}`;
                    }
                    
                    // 发送通知
                    $notification.post(notificationTitle, notificationSubtitle, notificationBody);
                    
                    // 更新通知时间
                    $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);
                    
                    console.log(`✅ 重放通知已发送 (${notifyReason})`);
                } else if (inCooldown) {
                    console.log("⏰ 重放通知冷却期内，跳过通知");
                }
                
                // 日志输出
                console.log("🔄 重放结果 - 状态码: " + statusCode);
                console.log("📌 重放结果 - 状态名: " + statusName);
                console.log("📝 重放结果 - 状态说明: " + statusDesc);
                
            } else {
                console.log("⚠️ 重放请求未获取到订单状态信息");
            }
            
        } catch (e) {
            console.log("❌ 重放响应解析错误:", e);
        }
        
        $done();
    });
    
} catch (e) {
    console.log("❌ 重放请求构建失败:", e);
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
