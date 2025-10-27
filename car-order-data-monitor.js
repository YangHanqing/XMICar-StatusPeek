// 存储键名
const STORAGE_KEYS = {
    ORDER_DATA: "xiaomi_order_data",
    ORDER_NOTIFY_TIME: "xiaomi_order_notify_time"
};

// 防重复通知间隔（30秒）
const NOTIFY_COOLDOWN = 30 * 1000;

console.log("📱 [订单监控] 监控到订单接口请求，开始处理...");

try {
    const currentTime = Date.now();
    const requestUrl = $request.url || "";
    const requestMethod = $request.method || "POST";

    console.log(`📦 请求地址：${requestUrl}`);
    console.log(`🛒 [订单接口] 检测到订单接口请求`);
    
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
                // 简化通知内容
                let notificationBody = `⏰ ${new Date().toLocaleString('zh-CN')}`;
                
                $notification.post("🛒 订单数据变化提醒", `检测到 ${changes.length} 处变化`, notificationBody);
                $persistentStore.write(currentTime.toString(), STORAGE_KEYS.ORDER_NOTIFY_TIME);
                console.warn("📢 [订单通知] 数据变化通知已发送");
                
                // 详细变化记录到日志
                console.log("📦 订单数据变化详情：");
                changes.forEach(change => {
                    console.log(`🔹 ${change.path}`);
                    console.log(`   旧值: ${change.oldValue}`);
                    console.log(`   新值: ${change.newValue}`);
                });
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
