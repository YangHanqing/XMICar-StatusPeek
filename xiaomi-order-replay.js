// 获取配置参数 - 使用对象属性方式
const replayInterval = parseInt($argument.replayInterval) || 60;
const notifyMode = $argument.notifyMode || "仅状态发生变化时通知";

console.log(`🔧 定时检查配置: 间隔${replayInterval}分钟, 通知方式=${notifyMode}`);

// 基于当前时间判断是否应该执行检查
const now = new Date();
const currentMinutes = now.getMinutes();

// 检查当前分钟数是否符合间隔要求
let shouldRun = false;

if (replayInterval === 1) {
    // 每分钟都执行
    shouldRun = true;
} else if (replayInterval === 5) {
    // 每5分钟执行一次：0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
    shouldRun = (currentMinutes % 5 === 0);
} else if (replayInterval === 10) {
    // 每10分钟执行一次：0, 10, 20, 30, 40, 50
    shouldRun = (currentMinutes % 10 === 0);
} else if (replayInterval === 30) {
    // 每30分钟执行一次：0, 30
    shouldRun = (currentMinutes % 30 === 0);
} else if (replayInterval === 60) {
    // 每60分钟执行一次：仅在0分执行
    shouldRun = (currentMinutes === 0);
} else if (replayInterval === 120) {
    // 每120分钟执行一次：仅在0分且小时为偶数时执行
    shouldRun = (currentMinutes === 0 && now.getHours() % 2 === 0);
} else if (replayInterval === 180) {
    // 每180分钟执行一次：仅在0分且小时能被3整除时执行
    shouldRun = (currentMinutes === 0 && now.getHours() % 3 === 0);
}

if (!shouldRun) {
    console.log(`⏭️ 当前时间${now.getHours()}:${currentMinutes.toString().padStart(2, '0')}不符合${replayInterval}分钟间隔要求，跳过检查`);
    $done();
    return;
}

console.log(`🔄 开始执行定时检查 (${replayInterval}分钟间隔, 通知方式: ${notifyMode})`);

// 存储键名
const STORAGE_KEYS = {
    LAST_NOTIFY_TIME: "xiaomi_order_last_notify_time",
    LAST_STATUS: "xiaomi_order_last_status",
    REQUEST_HEADERS: "xiaomi_order_request_headers", 
    REQUEST_BODY: "xiaomi_order_request_body",
    REQUEST_URL: "xiaomi_order_request_url",
    REQUEST_METHOD: "xiaomi_order_request_method"
};

// 通知冷却时间（3秒）
const NOTIFY_COOLDOWN = 3 * 1000;

// 读取保存的请求信息
const savedHeaders = $persistentStore.read(STORAGE_KEYS.REQUEST_HEADERS);
const savedBody = $persistentStore.read(STORAGE_KEYS.REQUEST_BODY);
const savedUrl = $persistentStore.read(STORAGE_KEYS.REQUEST_URL);
const savedMethod = $persistentStore.read(STORAGE_KEYS.REQUEST_METHOD);

if (!savedHeaders || !savedUrl) {
    console.log("❌ 未找到保存的查询信息，请先打开小米汽车App查看订单");
    console.warn("⚠️ 定时检查失败：缺少必要信息");
    $done();
    return;
}

try {
    const headers = JSON.parse(savedHeaders);
    const url = savedUrl;
    const method = savedMethod || "POST";
    
    // 构建请求参数
    const requestParams = {
        url: url,
        method: method,
        headers: headers,
        body: savedBody || "",
        timeout: 15000
    };
    
    console.log(`📡 发起定时检查请求`);
    console.warn("⚠️ 正在检查订单最新状态");
    
    // 发起请求
    $httpClient.post(requestParams, function(error, response, data) {
        if (error) {
            console.log("❌ 定时检查请求失败:", error);
            console.warn("⚠️ 网络请求失败");
            $done();
            return;
        }
        
        console.log(`📨 定时检查请求成功，响应状态: ${response.status}`);
        console.warn("⚠️ 订单状态获取成功");
        
        try {
            // 解析响应
            let json = JSON.parse(data);
            let statusInfo = json?.data?.orderDetailDto?.statusInfo;
            
            if (statusInfo) {
                const currentTime = Date.now();
                let statusCode = statusInfo.orderStatus;
                let statusName = statusInfo.orderStatusName || "未知状态";
                let statusDesc = getStatusDescription(statusCode);
                
                console.log(`📊 检查到订单状态: ${statusCode} - ${statusName}`);
                
                // 获取上次状态
                const lastStatusData = $persistentStore.read(STORAGE_KEYS.LAST_STATUS);
                let lastStatus = null;
                let hasStatusChanged = false;
                
                try {
                    lastStatus = lastStatusData ? JSON.parse(lastStatusData) : null;
                    hasStatusChanged = !lastStatus || (lastStatus.statusCode !== statusCode);
                } catch (e) {
                    console.log("📝 首次定时检查，视为状态变化");
                    hasStatusChanged = true;
                }
                
                console.log(`🔧 状态变化检查: ${hasStatusChanged ? '有变化' : '无变化'}, 上次:${lastStatus?.statusCode || '无'}, 当前:${statusCode}`);
                
                // 保存当前状态
                const currentStatus = {
                    statusCode: statusCode,
                    statusName: statusName,
                    statusDesc: statusDesc,
                    updateTime: currentTime,
                    saveTime: new Date().toISOString(),
                    source: "scheduled_check"
                };
                $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);
                console.warn("⚠️ 最新状态已保存");
                
                // 根据通知方式决定是否发送通知
                let shouldNotify = false;
                let notifyReason = "";
                
                console.log(`🔧 通知逻辑判断: 通知方式=${notifyMode}`);
                
                if (notifyMode === "仅状态发生变化时通知") {
                    console.log("🔧 使用'仅变化通知'模式");
                    if (hasStatusChanged) {
                        shouldNotify = true;
                        notifyReason = lastStatus ? "检测到状态变化" : "首次定时检查";
                        console.log("🔧 检测到变化，准备发送通知");
                    } else {
                        console.log("🔍 状态无变化，不发送通知");
                    }
                } else {
                    console.log("🔧 使用'每次均通知'模式");
                    shouldNotify = true;
                    notifyReason = "定时状态检查";
                }
                
                console.log(`🔧 通知决策结果: ${shouldNotify ? '发送通知' : '不发送'}, 原因=${notifyReason}`);
                
                // 检查通知冷却
                const lastNotifyTime = parseInt($persistentStore.read(STORAGE_KEYS.LAST_NOTIFY_TIME) || "0");
                const inCooldown = (currentTime - lastNotifyTime) < NOTIFY_COOLDOWN;
                
                if (shouldNotify && !inCooldown) {
                    // 构建通知内容
                    let notificationTitle = `🔄 订单状态检查 (${replayInterval}分钟)`;
                    let notificationSubtitle = statusName;
                    let notificationBody = `当前状态: ${statusDesc}`;
                    
                    if (hasStatusChanged && lastStatus) {
                        notificationBody += `\n📈 状态变化: ${getStatusDescription(lastStatus.statusCode)} → ${statusDesc}`;
                    }
                    
                    notificationBody += `\n⏰ 检查时间: ${new Date().toLocaleString('zh-CN')}`;
                    notificationBody += `\n🤖 来源: 自动检查`;
                    notificationBody += `\n🔔 通知模式: ${notifyMode}`;
                    
                    // 发送通知
                    $notification.post(notificationTitle, notificationSubtitle, notificationBody);
                    
                    // 更新通知时间
                    $persistentStore.write(currentTime.toString(), STORAGE_KEYS.LAST_NOTIFY_TIME);
                    
                    console.log(`✅ 通知已发送: ${notifyReason}`);
                    console.warn("⚠️ 通知发送完成");
                } else if (inCooldown) {
                    console.log(`⏰ 通知冷却中，跳过发送`);
                } else {
                    console.log("📋 定时检查完成，无需发送通知");
                }
                
            } else {
                console.log("⚠️ 定时检查响应中未找到订单状态");
                console.warn("⚠️ 无法解析订单状态信息");
                if (data && data.length > 0) {
                    console.log("📄 响应数据预览:", data.substring(0, 200));
                }
            }
            
        } catch (e) {
            console.log("❌ 解析定时检查响应失败:", e.message);
            console.warn("⚠️ 响应数据解析出错");
            console.log("📄 原始响应:", data ? data.substring(0, 200) : "空响应");
        }
        
        $done();
    });
    
} catch (e) {
    console.log("❌ 构建定时检查请求失败:", e.message);
    console.warn("⚠️ 请求构建失败");
    $done();
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
