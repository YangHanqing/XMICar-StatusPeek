// 存储键名
const STORAGE_KEYS = {
    LAST_NOTIFY_TIME: "xiaomi_order_last_notify_time",
    LAST_STATUS: "xiaomi_order_last_status", 
    REQUEST_HEADERS: "xiaomi_order_request_headers",
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_METHOD: "xiaomi_order_request_method",
    DYNAMIC_HEADERS: "xiaomi_dynamic_request_headers",
    DYNAMIC_BODY: "xiaomi_dynamic_request_body",
    ORDER_DATA: "xiaomi_order_data",
    ORDER_NOTIFY_TIME: "xiaomi_order_notify_time"
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

    // 检查是否是产品信息接口请求（无忧包购买状态）
    if (requestUrl.includes('/mtop/carlife/product/info')) {
        // 先检查请求 body 中是否包含无忧包的 productId
        try {
            const bodyData = JSON.parse(requestBody);
            const hasWorryFreePackage = Array.isArray(bodyData) && 
                bodyData.some(item => item && item.productId === "21452");
            
            if (!hasWorryFreePackage) {
                console.log("⚠️ [商品过滤] 未检测到无忧包商品(productId: 21452)，跳过处理");
                $done({});
                return;
            }
            
            console.log("✅ [商品验证] 检测到无忧包商品请求");
        } catch (e) {
            console.warn("⚠️ [Body解析] 请求体解析失败，跳过处理:", e.message);
            $done({});
            return;
        }
        
        // 解析响应检查 notice 字段
        let body = $response.body;
        let json = JSON.parse(body);
        let notice = json?.data?.product?.notice || "";
        
        // 确认是无忧包接口后，保存请求信息
        $persistentStore.write(requestHeaders, STORAGE_KEYS.DYNAMIC_HEADERS);
        $persistentStore.write(requestBody, STORAGE_KEYS.DYNAMIC_BODY);
        console.log("🔄 [动态接口] 检测到无忧包购买状态接口，已保存");
        
        // 判断下线状态：notice 为 "暂不符合购买条件" 时未下线，其他情况为已下线
        const isOffline = notice !== "暂不符合购买条件";
        
        console.log(`🔍 [Notice状态] ${notice}`);
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
            notice,
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
            let notificationTitle = "🚗 无忧包购买状态";
            let notificationSubtitle = isOffline ? "🎉 车辆已下线" : "⏳ 车辆未下线";
            let notificationBody = "";
            
            if (hasStatusChanged && lastStatus !== null) {
                const lastDesc = lastStatus.isOffline ? "已下线" : "未下线";
                const currentDesc = isOffline ? "已下线" : "未下线";
                notificationBody += `📈 状态变化: ${lastDesc} → ${currentDesc}\n`;
            }
            
            notificationBody += `🔘 Notice: ${notice}\n`;
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
        console.log(`     Notice信息: ${notice}`);
        
    } 
    // 检查是否是订单接口请求
    else if (requestUrl.includes('/mtop/carlife/product/order') && requestMethod === 'POST') {
        console.log("🛒 [订单接口] 检测到订单接口请求");
        
        let body = $response.body;
        let json = JSON.parse(body);
        let currentData = json?.data || null;
        
        if (!currentData) {
            console.log("⚠️ [订单数据] 响应中无 data 字段，跳过处理");
            $done({});
            return;
        }
        
        // 获取上次订单数据
        const lastOrderDataRaw = $persistentStore.read(STORAGE_KEYS.ORDER_DATA);
        
        if (!lastOrderDataRaw) {
            // 首次记录，保存数据但不通知
            $persistentStore.write(JSON.stringify(currentData), STORAGE_KEYS.ORDER_DATA);
            console.log("📝 [首次记录] 订单数据已保存，不发送通知");
        } else {
            // 对比数据变化
            let lastData = JSON.parse(lastOrderDataRaw);
            let changes = findDataChanges(lastData, currentData);
            
            if (changes.length > 0) {
                // 判断是否冷却中
                const lastOrderNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.ORDER_NOTIFY_TIME) || "0");
                const inCooldown = (currentTime - lastOrderNotifyTime) < NOTIFY_COOLDOWN;
                
                if (!inCooldown) {
                    let notificationBody = "📦 订单数据发生变化：\n\n";
                    changes.forEach(change => {
                        notificationBody += `🔹 ${change.path}\n`;
                        notificationBody += `   旧值: ${change.oldValue}\n`;
                        notificationBody += `   新值: ${change.newValue}\n\n`;
                    });
                    notificationBody += `⏰ ${new Date().toLocaleString('zh-CN')}`;
                    
                    $notification.post("🛒 订单数据变化提醒", `检测到 ${changes.length} 处变化`, notificationBody);
                    $persistentStore.write(currentTime.toString(), STORAGE_KEYS.ORDER_NOTIFY_TIME);
                    console.warn("📢 [订单通知] 数据变化通知已发送");
                } else {
                    const remainingTime = Math.ceil((NOTIFY_COOLDOWN - (currentTime - lastOrderNotifyTime)) / 1000);
                    console.log(`⏳ [订单通知冷却] 冷却中，剩余 ${remainingTime} 秒`);
                }
                
                // 保存新数据
                $persistentStore.write(JSON.stringify(currentData), STORAGE_KEYS.ORDER_DATA);
                console.log("💾 [订单数据] 已更新保存");
            } else {
                console.log("✅ [订单数据] 无变化");
            }
        }
        
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

// 深度对比数据变化的辅助函数
function findDataChanges(oldObj, newObj, path = 'data') {
    let changes = [];
    
    // 处理 null/undefined
    if (oldObj === null || oldObj === undefined) {
        if (newObj !== null && newObj !== undefined) {
            changes.push({
                path: path,
                oldValue: String(oldObj),
                newValue: JSON.stringify(newObj).substring(0, 100)
            });
        }
        return changes;
    }
    
    if (newObj === null || newObj === undefined) {
        changes.push({
            path: path,
            oldValue: JSON.stringify(oldObj).substring(0, 100),
            newValue: String(newObj)
        });
        return changes;
    }
    
    // 基本类型对比
    if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
        if (oldObj !== newObj) {
            changes.push({
                path: path,
                oldValue: String(oldObj),
                newValue: String(newObj)
            });
        }
        return changes;
    }
    
    // 数组对比
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
        if (oldObj.length !== newObj.length) {
            changes.push({
                path: `${path}.length`,
                oldValue: String(oldObj.length),
                newValue: String(newObj.length)
            });
        }
        const maxLen = Math.max(oldObj.length, newObj.length);
        for (let i = 0; i < maxLen && changes.length < 10; i++) {
            changes = changes.concat(findDataChanges(oldObj[i], newObj[i], `${path}[${i}]`));
        }
        return changes;
    }
    
    // 对象对比
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (let key of allKeys) {
        if (changes.length >= 10) break; // 限制最多显示10处变化
        
        if (!(key in oldObj)) {
            changes.push({
                path: `${path}.${key}`,
                oldValue: '(不存在)',
                newValue: JSON.stringify(newObj[key]).substring(0, 100)
            });
        } else if (!(key in newObj)) {
            changes.push({
                path: `${path}.${key}`,
                oldValue: JSON.stringify(oldObj[key]).substring(0, 100),
                newValue: '(已删除)'
            });
        } else {
            changes = changes.concat(findDataChanges(oldObj[key], newObj[key], `${path}.${key}`));
        }
    }
    
    return changes;
}

$done({});
