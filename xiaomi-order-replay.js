// 小米汽车无忧包可购买状态定时检查脚本

const STORAGE_KEYS = {
    LAST_STATUS: "xiaomi_order_last_status",
    DYNAMIC_HEADERS: "xiaomi_dynamic_request_headers",
    DYNAMIC_BODY: "xiaomi_dynamic_request_body"
};

// 固定的接口URL
const DYNAMIC_API_URL = "https://carshop-api.retail.xiaomiev.com/mtop/carlife/product/dynamic";

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
            $notification.post("❌ 请求失败", "网络请求出错", `错误信息: ${error}`);
            $done();
            return;
        }
        
        console.log("✅ [请求成功] HTTP状态码:", response?.status || "未知");
        console.log("📦 [响应长度] 数据长度:", data?.length || 0, "字符");

        try {
            const json = JSON.parse(data);
            const now = new Date().toLocaleString('zh-CN');
            
            console.log(`📊 [完整响应] ${JSON.stringify(json, null, 2)}`);
            
            // 验证响应数据结构
            if (!json || !json.data || !json.data.servicePackagePurchaseInfo) {
                console.log("❌ [数据验证] 响应数据结构异常，缺少 servicePackagePurchaseInfo 字段");
                console.log(`❌ [数据验证] 响应内容: ${data}`);
                $notification.post("⚠️ 数据异常", "接口响应缺少关键字段", `时间: ${now}\n请检查接口是否正常`);
                $done();
                return;
            }
            
            const purchaseCode = json.data.servicePackagePurchaseInfo.code;
            console.log(`🔍 [定时检查] Purchase Code: ${purchaseCode}`);

            // 判断下线状态：code 为 4 时未下线，其他值为已下线
            const isOffline = purchaseCode !== 4;
            
            console.log(`🎯 [状态判断] Purchase Code: ${purchaseCode}`);
            console.log(`🎯 [状态判断] 车辆下线状态: ${isOffline ? "已下线" : "未下线"}`);

            // 记录本次检查结果
            const checkRecord = {
                isOffline,
                purchaseCode,
                checkTime: Date.now(),
                checkTimeStr: new Date().toISOString(),
                source: "scheduled_check"
            };
            $persistentStore.write(JSON.stringify(checkRecord), STORAGE_KEYS.LAST_STATUS);

            // 只要检测到已下线就发送通知
            if (isOffline) {
                const title = "🎉🎉🎉 喜大普奔下线了 ！！！";
                let message = `车辆已下线`;
                message += `\n🔘 Purchase Code: ${purchaseCode}`;
                message += `\n⏰ ${now}`;
                $notification.post(title, "", message);
                console.log("✅ [通知发送] 检测到车辆已下线，发送通知");
            } else {
                console.log("📋 [状态检查] 车辆未下线，不发送通知");
            }

            console.log("📊 [定时检查详情]");
            console.log(`     下线状态: ${isOffline ? "✅ 已下线" : "❌ 未下线"}`);
            console.log(`     Purchase Code: ${purchaseCode}`);

        } catch (e) {
            console.log("❌ [响应解析] 解析失败:", e.message);
            console.log("❌ [响应解析] 原始响应内容:", data);
            console.log("❌ [响应解析] 请检查接口URL是否正确或响应格式是否变化");
            $notification.post("❌ 响应解析失败", "无法解析接口返回数据", `错误: ${e.message}`);
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
