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

console.log("📱 [订单监控] 监控到App订单查询请求，开始处理...");

try {
    const currentTime = Date.now();

    // 始终保存完整请求信息，供定时检查使用
    const requestHeaders = JSON.stringify($request.headers || {});
    const requestBody = $request.body || "";
    const requestUrl = $request.url || "";
    const requestMethod = $request.method || "POST";

    $persistentStore.write(requestHeaders, STORAGE_KEYS.REQUEST_HEADERS);
    $persistentStore.write(requestBody, STORAGE_KEYS.REQUEST_BODY);
    $persistentStore.write(requestUrl, STORAGE_KEYS.REQUEST_URL);
    $persistentStore.write(requestMethod, STORAGE_KEYS.REQUEST_METHOD);

    console.log("📥 [请求保存] 请求信息已保存");
    console.log(`📦 请求地址：${requestUrl}`);
    console.log(`📄 请求体大小：${requestBody.length} 字节`);

    // 解析响应
    let body = $response.body;
    let json = JSON.parse(body);
    let statusInfo = json?.data?.orderDetailDto?.statusInfo;

    if (statusInfo) {
        const statusCode = statusInfo.orderStatus;
        const statusName = statusInfo.orderStatusName || "未知状态";
        const statusDesc = getStatusDescription(statusCode);

        // 获取上次状态
        const lastStatusRaw = $persistentStore.read(STORAGE_KEYS.LAST_STATUS);
        let lastStatus = null;
        let hasStatusChanged = false;

        if (lastStatusRaw) {
            try {
                lastStatus = JSON.parse(lastStatusRaw);
                hasStatusChanged = lastStatus.statusCode !== statusCode;
            } catch {
                console.warn("⚠️ [状态解析] 上次状态读取失败，可能是首次运行");
                hasStatusChanged = true;
            }
        } else {
            hasStatusChanged = true;
            console.warn("⚠️ [状态解析] 未找到上次状态，视为首次记录");
        }

        console.log("🔍 [状态检查] " +
            `当前: ${statusCode} - ${statusName}，` +
            `上次: ${lastStatus?.statusCode || "无记录"}，` +
            `变化: ${hasStatusChanged ? "✅ 是" : "❌ 否"}`);

        // 保存当前状态
        const currentStatus = {
            statusCode,
            statusName,
            statusDesc,
            updateTime: currentTime,
            saveTime: new Date().toISOString(),
            source: "app_request"
        };
        $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
        console.warn("💾 [状态保存] 当前订单状态已保存");

        // 判断是否冷却中
        const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
        const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;

        if (!inCooldown) {
            // 构建通知
            let notificationTitle = "🚗 小米汽车订单状态更新";
            let notificationSubtitle = `${statusName}（${statusCode}）`;
            let notificationBody = `当前状态: ${statusDesc}（代码: ${statusCode}）`;

            if (hasStatusChanged && lastStatus) {
                notificationBody += `\n📈 状态变化: ${getStatusDescription(lastStatus.statusCode)} → ${statusDesc}`;
            }

            notificationBody += `\n⏰ 查询时间: ${new Date().toLocaleString('zh-CN')}`;
            notificationBody += `\n📱 来源: 手动查询`;

            // 发送通知
            $notification.post(notificationTitle, notificationSubtitle, notificationBody);
            $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);

            console.warn("📢 [通知发送] 通知已发送");
        } else {
            const remainingTime = Math.ceil((NOTIFY_COOLDOWN - (currentTime - lastNotifyTime)) / 1000);
            console.log(`⏳ [通知冷却] 冷却中，剩余 ${remainingTime} 秒`);
        }

        // 日志总结
        console.log("📊 [状态详情]");
        console.log(`     状态码: ${statusCode}`);
        console.log(`     状态名: ${statusName}`);
        console.log(`     描 述: ${statusDesc}`);

    } else {
        console.warn("⚠️ [状态缺失] 响应中未找到订单状态信息");
    }

} catch (e) {
    console.warn("❌ [错误处理] 捕获异常:", e.message);
}

// 状态码说明函数
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
