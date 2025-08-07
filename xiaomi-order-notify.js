// 获取参数
const enableAutoReplay = $argument.enableAutoReplay === "true";
const replayInterval = parseInt($argument.replayInterval) || 60;
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

// 获取当前时间戳
const currentTime = Date.now();

// 获取上次通知时间
const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");

// 检查是否在冷却期内
const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;

try {
    // 保存请求头信息用于重放
    const requestHeaders = JSON.stringify($request.headers);
    const requestBody = $request.body || "";
    
    $persistentStore.write(requestHeaders, STORAGE_KEYS.REQUEST_HEADERS);
    $persistentStore.write(requestBody, STORAGE_KEYS.REQUEST_BODY);
    
    // 解析响应数据
    let body = $response.body;
    let json = JSON.parse(body);
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
        
        if (inCooldown) {
            console.log("⏰ 通知冷却期内，跳过通知");
        } else {
            if (!lastStatus) {
                shouldNotify = true;
                notifyReason = "首次获取状态";
            } else if (lastStatus.statusCode !== statusCode) {
                shouldNotify = true;
                notifyReason = "状态发生变化";
            } else {
                shouldNotify = true;
                notifyReason = "常规状态更新";
            }
        }
        
        if (shouldNotify) {
            // 构建通知内容
            let notificationTitle = "🚗 小米汽车订单状态";
            let notificationSubtitle = statusName;
            let notificationBody = `状态码: ${statusCode}\n${statusDesc}`;
            
            if (lastStatus && lastStatus.statusCode !== statusCode) {
                notificationBody += `\n📈 变化: ${lastStatus.statusCode} → ${statusCode}`;
            }
            
            // 发送通知
            $notification.post(notificationTitle, notificationSubtitle, notificationBody);
            
            // 更新通知时间
            $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);
            
            console.log(`✅ 已发送通知 (${notifyReason})`);
        }
        
        // 日志输出
        console.log("🚗 订单状态码: " + statusCode);
        console.log("📌 订单状态名: " + statusName);
        console.log("📝 状态说明: " + statusDesc);
        console.log("🔄 定时重放: " + (enableAutoReplay ? `已启用(${replayInterval}分钟)` : "已关闭"));
        
    } else {
        console.log("⚠️ 未获取到订单状态信息");
    }
    
} catch (e) {
    console.log("❌ 处理过程中发生错误:", e);
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

// 返回原始响应，不影响 App 正常运行
$done({});
