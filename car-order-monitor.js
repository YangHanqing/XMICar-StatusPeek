// car-order-monitor.js
// 车辆订单状态监控脚本

// 获取响应数据
let body = $response.body;
let url = $request.url;

// 确保是我们要监控的接口
if (url.includes("api.retail.xiaomiev.com/mtop/carlife/product/order")) {
    try {
        let json = JSON.parse(body);
        let statusInfo = json?.data?.orderDetailDto?.statusInfo;
        
        if (statusInfo) {
            let statusCode = statusInfo.orderStatus;
            let statusName = statusInfo.orderStatusName;
            let orderNumber = json?.data?.orderDetailDto?.orderNumber || "未知订单";
            let statusDesc = "";
            let notificationTitle = "";
            
            // 状态码翻译表和通知设置
            switch (statusCode) {
                case 2520:
                    statusDesc = "🚧 车辆尚未下线";
                    notificationTitle = "车辆状态更新";
                    break;
                case 2605:
                    statusDesc = "✅ 车辆已下线";
                    notificationTitle = "🎉 好消息！车辆已下线";
                    break;
                case 3000:
                    statusDesc = "🚚 车辆已运出";
                    notificationTitle = "🚚 车辆运输中";
                    break;
                default:
                    statusDesc = "ℹ️ 状态未知或未记录，建议留意变化";
                    notificationTitle = "车辆状态变化";
                    break;
            }
            
            // 检查状态是否发生变化（使用持久化存储）
            let storageKey = `car_order_status_${orderNumber}`;
            let lastStatus = $persistentStore.read(storageKey);
            
            if (lastStatus !== String(statusCode)) {
                // 状态发生变化，保存新状态
                $persistentStore.write(String(statusCode), storageKey);
                
                // 发送系统通知
                $notification.post(
                    notificationTitle,
                    `订单: ${orderNumber}`,
                    `${statusName}\n${statusDesc}`,
                    {
                        "url": "xiaomiev://", // 可选：点击通知打开小米汽车App
                        "sound": "default"
                    }
                );
                
                console.log("🔔 已发送通知 - 订单状态变化");
                console.log(`📱 订单号: ${orderNumber}`);
                console.log(`🚗 状态码: ${statusCode} (从 ${lastStatus || '未知'} 变更)`);
                console.log(`📌 状态名: ${statusName}`);
                console.log(`📝 状态说明: ${statusDesc}`);
            } else {
                console.log("📋 订单状态无变化，跳过通知");
                console.log(`🚗 当前状态: ${statusCode} - ${statusName}`);
            }
            
        } else {
            console.log("⚠️ 未获取到订单状态信息");
        }
        
    } catch (e) {
        console.log("❌ JSON 解析错误:", e);
        console.log("📄 响应内容:", body);
    }
}

// 重要：不修改响应体，确保不影响App正常运行
$done({});
