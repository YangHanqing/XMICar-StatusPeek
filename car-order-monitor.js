// 存储键名
const STORAGE_KEYS = {
    LAST_NOTIFY_TIME: "xiaomi_order_last_notify_time",
    LAST_STATUS: "xiaomi_order_last_status", 
    REQUEST_HEADERS: "xiaomi_order_request_headers",
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_METHOD: "xiaomi_order_request_method",
    DYNAMIC_HEADERS: "xiaomi_dynamic_request_headers",
    DYNAMIC_BODY: "xiaomi_dynamic_request_body"
};

// 防重复通知间隔（30秒）
const NOTIFY_COOLDOWN = 30 * 1000;

console.log("📱 [订单监控] 监控到App请求，开始处理...");

try {
    const currentTime = Date.now();

    // 保存请求信息
    const requestHeaders = JSON.stringify($request.headers || {});
    const requestBody = $request.body || "";
    const requestUrl = $request.url || "";
    const requestMethod = $request.method || "POST";

    console.log(`📦 请求地址：${requestUrl}`);

    // 检查是否是动态接口请求（无忧包可购买状态）
    if (requestUrl.includes('/mtop/carlife/product/dynamic')) {
        // 先检查请求 body 中是否包含无忧包的 goodsId
        try {
            const bodyData = JSON.parse(requestBody);
            const hasWorryFreePackage = Array.isArray(bodyData) && 
                bodyData.some(item => item && item.goodsId === 2230004385);
            
            if (!hasWorryFreePackage) {
                console.log("⚠️ [商品过滤] 未检测到无忧包商品(goodsId: 2230004385)，跳过处理");
                $done({});
                return;
            }
            
            console.log("✅ [商品验证] 检测到无忧包商品请求");
        } catch (e) {
            console.warn("⚠️ [Body解析] 请求体解析失败，跳过处理:", e.message);
            $done({});
            return;
        }
        
        // 解析响应检查按钮状态
        let body = $response.body;
        let json = JSON.parse(body);
        let buttons = json?.data?.buttons || [];
        
        // 检查是否有有效按钮（如果没有按钮说明不是检查无忧包的请求）
        if (!buttons || buttons.length === 0) {
            console.log("⚠️ [按钮检查] 未检测到按钮数据，跳过处理");
            $done({});
            return;
        }
        
        // 确认是无忧包接口后，保存请求信息
        $persistentStore.write(requestHeaders, STORAGE_KEYS.DYNAMIC_HEADERS);
        $persistentStore.write(requestBody, STORAGE_KEYS.DYNAMIC_BODY);
        console.log("🔄 [动态接口] 检测到无忧包可购买状态接口，已保存");
        
        const hasNoPermission = buttons.some(button => button.title === "暂无购买权限");
        const isOffline = !hasNoPermission;
        
        console.log(`🔍 [按钮状态] ${JSON.stringify(buttons)}`);
        console.log(`🎯 [下线判断] 车辆${isOffline ? "已下线" : "未下线"}`);
        
        // 获取上次状态
        const lastStatusRaw = $persistentStore.read(STORAGE_KEYS.LAST_STATUS);
        let lastStatus = null;
        let hasStatusChanged = false;

        if (lastStatusRaw) {
            try {
                lastStatus = JSON.parse(lastStatusRaw);
                hasStatusChanged = lastStatus.isOffline !== isOffline;
            } catch {
                console.warn("⚠️ [状态解析] 上次状态读取失败，可能是首次运行");
                hasStatusChanged = true;
            }
        } else {
            hasStatusChanged = true;
            console.warn("⚠️ [状态解析] 未找到上次状态，视为首次记录");
        }

        // 保存当前状态
        const currentStatus = {
            isOffline,
            buttons,
            updateTime: currentTime,
            saveTime: new Date().toISOString(),
            source: "app_request"
        };
        $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
        console.warn("💾 [状态保存] 当前下线状态已保存");

        // 判断是否冷却中
        const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
        const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;

        if (!inCooldown) {
            let notificationTitle = "🚗 无忧包可购买状态";
            let notificationSubtitle = isOffline ? "🎉 车辆已下线" : "⏳ 车辆未下线";
            let notificationBody = "";
            
            if (hasStatusChanged && lastStatus !== null) {
                const lastDesc = lastStatus.isOffline ? "已下线" : "未下线";
                const currentDesc = isOffline ? "已下线" : "未下线";
                notificationBody += `📈 状态变化: ${lastDesc} → ${currentDesc}\n`;
            }
            
            notificationBody += `🔘 按钮状态: ${buttons.map(b => b.title).join(', ')}\n`;
            notificationBody += `⏰ ${new Date().toLocaleString('zh-CN')}`;

            // 🎉 特殊处理：车辆下线
            if (isOffline) {
                notificationTitle = "🎉🎉🎉 喜大普奔下线了 ！！！";
                notificationSubtitle = "车辆已下线";
            }

            $notification.post(notificationTitle, notificationSubtitle, notificationBody);
            $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);

            console.warn("📢 [通知发送] 通知已发送");
        } else {
            const remainingTime = Math.ceil((NOTIFY_COOLDOWN - (currentTime - lastNotifyTime)) / 1000);
            console.log(`⏳ [通知冷却] 冷却中，剩余 ${remainingTime} 秒`);
        }

        console.log("📊 [状态详情]");
        console.log(`     下线状态: ${isOffline ? "✅ 已下线" : "❌ 未下线"}`);
        console.log(`     按钮信息: ${JSON.stringify(buttons)}`);
        
    } else {
        // 其他接口，仅保存基本信息
        $persistentStore.write(requestHeaders, STORAGE_KEYS.REQUEST_HEADERS);
        $persistentStore.write(requestBody, STORAGE_KEYS.REQUEST_BODY);
        $persistentStore.write(requestMethod, STORAGE_KEYS.REQUEST_METHOD);
        console.log("📥 [其他接口] 请求信息已保存");
    }

} catch (e) {
    console.warn("❌ [错误处理] 捕获异常:", e.message);
}

$done({});
