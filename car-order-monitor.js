// car-order-monitor.js
// 小米汽车订单状态监控脚本

// 获取插件参数
let enableNotification = $argument.enableNotification === "true";
let notificationSound = $argument.notificationSound || "default";
let monitorAllStatus = $argument.monitorAllStatus === "true";

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
            let isImportantStatus = false;
            
            // 状态码翻译表和通知设置
            switch (statusCode) {
                case 2520:
                    statusDesc = "🚧 车辆尚未下线";
                    notificationTitle = "车辆生产状态";
                    break;
                case 2605:
                    statusDesc = "✅ 车辆已下线";
                    notificationTitle = "🎉 好消息！车辆已下线";
                    isImportantStatus = true;
                    break;
                case 3000:
                    statusDesc = "🚚 车辆已运出";
                    notificationTitle = "🚚 车辆运输中";
                    isImportantStatus = true;
                    break;
                default:
                    statusDesc = "ℹ️ 状态更新";
                    notificationTitle = "车辆状态变化";
                    break;
            }
            
            // 检查状态是否发生变化
            let storageKey = `car_order_status_${orderNumber}`;
            let lastStatus = $persistentStore.read(storageKey);
            
            if (lastStatus !== String(statusCode)) {
                // 状态发生变化，保存新状态
                $persistentStore.write(String(statusCode), storageKey);
                
                // 决定是否发送通知
                let shouldNotify = enableNotification && (monitorAllStatus || isImportantStatus);
                
                if (shouldNotify) {
                    // 发送系统通知
                    $notification.post(
                        notificationTitle,
                        `订单: ${orderNumber}`,
                        `${statusName}\n${statusDesc}`,
                        {
                            "url": "xiaomiev://", 
                            "sound": notificationSound
                        }
                    );
                    
                    console.log("🔔 已发送通知 - 订单状态变化");
                } else if (!enableNotification) {
                    console.log("🔕 通知已禁用 - 状态变化但未发送通知");
                } else {
                    console.log("📋 非重要状态变化 - 跳过通知");
                }
                
                console.log(`📱 订单号: ${orderNumber}`);
                console.log(`🚗 状态码: ${statusCode} (从 ${lastStatus || '未知'} 变更)`);
                console.log(`📌 状态名: ${statusName}`);
                console.log(`📝 状态说明: ${statusDesc}`);
                console.log(`⚙️ 插件配置: 通知=${enableNotification}, 声音=${notificationSound}, 全监控=${monitorAllStatus}`);
            } else {
                console.log("📋 订单状态无变化，跳过处理");
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
