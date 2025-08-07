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

console.log("📱 监控到App订单查询请求，开始处理");

try {
    const currentTime = Date.now();
    
    // 始终保存完整的请求信息，供定时检查使用
    const requestHeaders = JSON.stringify($request.headers);
    const requestBody = $request.body || "";
    const requestUrl = $request.url || "";
    const requestMethod = $request.method || "POST";
    
    // 保存所有请求信息
    $persistentStore.write(requestHeaders, STORAGE_KEYS.REQUEST_HEADERS);
    $persistentStore.write(requestBody, STORAGE_KEYS.REQUEST_BODY);
    $persistentStore.write(requestUrl, STORAGE_KEYS.REQUEST_URL);
    $persistentStore.write(requestMethod, STORAGE_KEYS.REQUEST_METHOD);
    
    console.warn("⚠️ 订单查询信息已保存，可用于定时检查");
    console.warn(`⚠️ 保存详情: 请求地址已记录，请求数据大小${requestBody.length}字节`);
    
    // 解析订单状态响应
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
            console.log("📝 首次获取订单状态");
            hasStatusChanged = true;
        }
        
        console.log(`🔧 状态检查: ${hasStatusChanged ? '状态有变化' : '状态无变化'}, 上次:${lastStatus?.statusCode || '无'}, 当前:${statusCode}`);
        
        // 保存当前状态
        const currentStatus = {
            statusCode: statusCode,
            statusName: statusName,
            statusDesc: statusDesc,
            updateTime: currentTime,
            saveTime: new Date().toISOString(),
            source: "app_request"
        };
        $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
        console.warn("⚠️ 最新订单状态已保存");
        
        // 检查是否需要发送实时通知（App触发的通知总是发送）
        const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
        const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;
        
        if (!inCooldown) {
            // 构建通知内容
            let notificationTitle = "🚗 小米汽车订单状态";
            let notificationSubtitle = statusName;
            let notificationBody = `当前状态: ${statusDesc}`;
            
            if (hasStatusChanged && lastStatus) {
                notificationBody += `\n📈 状态变化: ${getStatusDescription(lastStatus.statusCode)} → ${statusDesc}`;
            }
            
            notificationBody += `\n⏰ 查询时间: ${new Date().toLocaleString('zh-CN')}`;
            notificationBody += `\n📱 来源: 手动查询`;
            
            // 发送通知
            $notification.post(notificationTitle, notificationSubtitle, notificationBody);
            
            // 更新通知时间
            $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);
            
            console.log("✅ 订单状态通知已发送");
            console.warn("⚠️ 通知发送记录已更新");
        } else {
            const remainingTime = Math.ceil((NOTIFY_COOLDOWN - (currentTime - lastNotifyTime)) / 1000);
            console.log(`⏰ 通知冷却中，还需等待${remainingTime}秒`);
        }
        
        // 日志输出
        console.log(`📊 订单状态: ${statusCode} - ${statusName}`);
        console.log(`📝 状态说明: ${statusDesc}`);
        
    } else {
        console.log("⚠️ 响应中未找到订单状态信息");
        console.warn("⚠️ 无法解析订单状态，但查询信息已保存");
    }
    
} catch (e) {
    console.log("❌ 处理订单状态时发生错误:", e.message);
    console.warn("⚠️ 处理出错但查询信息已保存");
}

// 状态码说明
function getStatusDescription(statusCode) {
    switch (statusCode) {
        case 2520:
            return "🏭 车辆生产中";
        case 2605:
            return "✅ 车辆已下线";
        case 3000:
            return "🚚 车辆运输中";
        default:
            return "❓ 状态未知";
    }
}

// 返回原始响应，不影响App正常使用
$done({});
