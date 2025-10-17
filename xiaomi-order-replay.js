// 小米汽车无忧包可购买状态定时检查脚本

const STORAGE_KEYS = {
    LAST_STATUS: "xiaomi_order_last_status",
    DYNAMIC_HEADERS: "xiaomi_dynamic_request_headers",
    DYNAMIC_URL: "xiaomi_dynamic_request_url"
};

// 读取动态接口信息
const dynamicHeaders = $persistentStore.read(STORAGE_KEYS.DYNAMIC_HEADERS);
const dynamicUrl = $persistentStore.read(STORAGE_KEYS.DYNAMIC_URL);

if (!dynamicHeaders || !dynamicUrl) {
    console.log("❌ 未找到无忧包接口信息，请先手动打开App访问一次");
    $done();
    return;
}

try {
    const headers = JSON.parse(dynamicHeaders);
    const requestParams = {
        url: dynamicUrl,
        method: "POST",
        headers,
        timeout: 15000
    };

    $httpClient.post(requestParams, (error, response, data) => {
        if (error) {
            console.log("❌ 请求失败:", error);
            $done();
            return;
        }

        try {
            const json = JSON.parse(data);
            const buttons = json?.data?.buttons || [];
            const now = new Date().toLocaleString('zh-CN');
            
            console.log(`🔍 [定时检查] 按钮状态: ${JSON.stringify(buttons)}`);

            // 检查是否有"暂无购买权限"的按钮
            const hasNoPermission = buttons.some(button => button.title === "暂无购买权限");
            const isOffline = !hasNoPermission;

            // 保存当前状态
            const currentStatus = {
                isOffline,
                buttons,
                updateTime: Date.now(),
                saveTime: new Date().toISOString(),
                source: "scheduled_check"
            };
            $persistentStore.write(JSON.stringify(currentStatus), STORAGE_KEYS.LAST_STATUS);

            if (isOffline) {
                const title = "🎉🎉🎉 喜大普奔下线了 ！！！";
                let message = `车辆已下线`;
                message += `\n🔘 按钮状态: ${buttons.map(b => b.title).join(', ')}`;
                message += `\n⏰ ${now}`;
                $notification.post(title, "", message);
                console.log("✅ 已发送车辆下线通知");
            } else {
                const title = "🚗 无忧包可购买状态查询";
                let message = `车辆未下线`;
                message += `\n🔘 按钮状态: ${buttons.map(b => b.title).join(', ')}`;
                message += `\n⏰ ${now}`;
                $notification.post(title, "", message);
                console.log("✅ 状态更新通知已发送");
            }

            console.log("📊 [定时检查详情]");
            console.log(`     下线状态: ${isOffline ? "✅ 已下线" : "❌ 未下线"}`);
            console.log(`     按钮信息: ${JSON.stringify(buttons)}`);

        } catch (e) {
            console.log("❌ 响应解析失败:", e.message);
        }

        $done();
    });

} catch (e) {
    console.log("❌ 构造请求失败:", e.message);
    $done();
}
