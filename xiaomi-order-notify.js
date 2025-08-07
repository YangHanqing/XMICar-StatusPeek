// 获取参数
const enableAutoReplay = $argument.enableAutoReplay === "true";
const onlyNotifyOnChange = $argument.onlyNotifyOnChange === "true";

// 存储键名
const STORAGE_KEYS = {
    LAST_NOTIFY_TIME: "xiaomi_order_last_notify_time",
    LAST_STATUS: "xiaomi_order_last_status", 
    REQUEST_HEADERS: "xiaomi_order_request_headers",
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_URL: "xiaomi_order_request_url",
    REQUEST_METHOD: "xiaomi_order_request_method"
};

// 防重复通知间隔（30秒）
const NOTIFY_COOLDOWN = 30 * 1000;

console.log(`📱 处理App真实请求 (定时重放: ${enableAutoReplay ? "已启用" : "已关闭"})`);

try {
    const currentTime = Date.now();
    
    // 始终保存完整的POST请求信息
    const requestHeaders = JSON.stringify($request.headers);
    const requestBody = $request.body || "";
    const requestUrl = $request.url || "";
    const requestMethod = $request.method || "POST";
    
    // 保存所有请求信息
    $persistentStore.write(requestHeaders, STORAGE_KEYS.REQUEST_HEADERS);
    $persistentStore.write(requestBody, STORAGE_KEYS.REQUEST_BODY);
    $persistentStore.write(requestUrl, STORAGE_KEYS.REQUEST_URL);
    $persistentStore.write(requestMethod, STORAGE_KEYS.REQUEST_METHOD);
    
    // 使用warning级别打印保存成功信息
    console.warn("⚠️ 完整POST请求信息保存成功");
    console.warn(`⚠️ 保存详情: URL=${requestUrl}, Method=${requestMethod}, Headers数量=${Object.keys($request.headers || {}).length}, Body大小=${requestBody.length}字节`);
    
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
            saveTime: new Date().toISOString()
        };
        $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
        console.warn("⚠️ 订单状态信息保存成功");
        
        // 检查是否需要发送实时通知
        const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
        const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;
        
        let shouldNotify = false;
        let notifyReason = "";
        
        if (inCooldown) {
            console.log("⏰ 实时通知冷却期内，跳过通知");
        } else {
            if (onlyNotifyOnChange) {
                if (hasStatusChanged) {
                    shouldNotify = true;
                    notifyReason = lastStatus ? "状态发生变化" : "首次获取状态";
                } else {
                    console.log("🔍 状态无变化，跳过实时通知");
                }
            } else {
                shouldNotify = true;
                notifyReason = "实时状态更新";
            }
        }
        
        if (shouldNotify) {
            // 构建通知内容
            let notificationTitle = "📱 小米汽车订单状态";
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
            
            console.log(`✅ 实时通知已发送: ${notifyReason}`);
            console.warn("⚠️ 通知发送记录已保存");
        }
        
        // 日志输出
        console.log("📊 当前状态: " + statusCode + " - " + statusName);
        console.log("📝 状态说明: " + statusDesc);
        console.log(`🔄 定时重放功能: ${enableAutoReplay ? "已启用" : "已关闭"}`);
        
    } else {
        console.log("⚠️ 未获取到订单状态信息");
        console.warn("⚠️ 响应中缺少statusInfo字段，但POST信息已保存");
    }
    
} catch (e) {
    console.log("❌ 处理过程中发生错误:", e.message);
    console.warn("⚠️ 发生错误但POST请求信息已保存");
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
