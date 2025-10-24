// 小米汽车无忧包可购买状态定时检查脚本

const STORAGE_KEYS = {
    LAST_STATUS: "xiaomi_order_last_status",
    DYNAMIC_HEADERS: "xiaomi_dynamic_request_headers",
    DYNAMIC_BODY: "xiaomi_dynamic_request_body"
};

// 固定的接口URL
const DYNAMIC_API_URL = "https://carshop-api.retail.xiaomiev.com/mtop/carlife/product/info";

// 读取动态接口信息
const dynamicHeaders = $persistentStore.read(STORAGE_KEYS.DYNAMIC_HEADERS);
const dynamicBody = $persistentStore.read(STORAGE_KEYS.DYNAMIC_BODY);

if (!dynamicHeaders || !dynamicBody) {
    console.log("❌ [初始化] 未找到无忧包接口信息，请先手动打开App访问一次");
    console.log("❌ [初始化] 动态Headers存在:", !!dynamicHeaders);
    console.log("❌ [初始化] 动态Body存在:", !!dynamicBody);
    $done();
    return;
}

console.log("✅ [初始化] 找到保存的接口信息");
console.log("📍 [请求URL] ", DYNAMIC_API_URL);

try {
    const headers = JSON.parse(dynamicHeaders);
    const requestParams = {
        url: DYNAMIC_API_URL,
        method: "POST",
        headers,
        body: dynamicBody,
        timeout: 15000
    };

    console.log("🚀 [发起请求] 开始发送定时检查请求");
    
    $httpClient.post(requestParams, (error, response, data) => {
        if (error) {
            console.log("❌ [请求失败] 网络请求出错:", error);
            console.log("❌ [请求失败] 请检查网络连接或接口URL是否有效");
            $done();
            return;
        }
        
        console.log("✅ [请求成功] HTTP状态码:", response?.status || "未知");
        console.log("📦 [响应长度] 数据长度:", data?.length || 0, "字符");

        try {
            const json = JSON.parse(data);
            const now = new Date().toLocaleString('zh-CN');
            
            console.log(`📊 [定时检查] 完整响应: ${JSON.stringify(json)}`);
            
            // 验证响应数据结构
            if (!json || !json.data || !json.data.product) {
                console.log("❌ [数据验证] 响应数据结构异常，缺少product字段");
                console.log(`❌ [数据验证] 响应内容: ${data}`);
                $done();
                return;
            }
            
            const notice = json.data.product.notice || "";
            console.log(`🔍 [定时检查] Notice字段: ${notice}`);

            // 判断下线状态：notice 为 "暂不符合购买条件" 时未下线，其他情况为已下线
            const isOffline = notice !== "暂不符合购买条件";
            
            console.log(`🎯 [状态判断] Notice内容: ${notice}`);
            console.log(`🎯 [状态判断] 车辆下线状态: ${isOffline ? "已下线" : "未下线"}`);

            // 保存当前状态
            const currentStatus = {
                isOffline,
                notice,
                updateTime: Date.now(),
                saveTime: new Date().toISOString(),
                source: "scheduled_check"
            };
            $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);

            // 读取上次状态，避免重复通知
            const lastStatusRaw = $persistentStore.read(STORAGE_KEYS.LAST_STATUS);
            let shouldNotify = true;
            
            if (lastStatusRaw) {
                try {
                    const lastStatus = JSON.parse(lastStatusRaw);
                    if (lastStatus.isOffline === isOffline && lastStatus.source === "scheduled_check") {
                        shouldNotify = false;
                        console.log(`📋 [通知过滤] 状态未变化，跳过通知 (${isOffline ? "已下线" : "未下线"})`);
                    } else {
                        console.log(`📋 [通知检查] 状态有变化或来源不同，发送通知`);
                        console.log(`📋 [通知检查] 上次状态: ${lastStatus.isOffline ? "已下线" : "未下线"} (${lastStatus.source})`);
                        console.log(`📋 [通知检查] 当前状态: ${isOffline ? "已下线" : "未下线"} (scheduled_check)`);
                    }
                } catch (e) {
                    console.log(`⚠️ [状态解析] 上次状态解析失败: ${e.message}`);
                }
            }
            
            if (shouldNotify) {
                if (isOffline) {
                    const title = "🎉🎉🎉 喜大普奔下线了 ！！！";
                    let message = `车辆已下线`;
                    message += `\n🔘 Notice: ${notice}`;
                    message += `\n⏰ ${now}`;
                    $notification.post(title, "", message);
                    console.log("✅ [通知发送] 已发送车辆下线通知");
                } else {
                    const title = "🚗 无忧包购买状态查询";
                    let message = `车辆未下线`;
                    message += `\n🔘 Notice: ${notice}`;
                    message += `\n⏰ ${now}`;
                    $notification.post(title, "", message);
                    console.log("✅ [通知发送] 状态更新通知已发送");
                }
            } else {
                console.log("🔕 [通知跳过] 状态无变化，跳过通知");
            }

            console.log("📊 [定时检查详情]");
            console.log(`     下线状态: ${isOffline ? "✅ 已下线" : "❌ 未下线"}`);
            console.log(`     Notice信息: ${notice}`);

        } catch (e) {
            console.log("❌ [响应解析] 解析失败:", e.message);
            console.log("❌ [响应解析] 原始响应内容:", data);
            console.log("❌ [响应解析] 请检查接口URL是否正确或响应格式是否变化");
        }

        $done();
    });

} catch (e) {
    console.log("❌ [请求构造] 构造请求失败:", e.message);
    console.log("❌ [请求构造] 检查保存的Headers格式是否正确");
    console.log("❌ [请求构造] 保存的Headers内容:", dynamicHeaders);
    console.log("❌ [请求构造] 保存的Body内容:", dynamicBody);
    $done();
}
