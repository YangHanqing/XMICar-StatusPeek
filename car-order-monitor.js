// 获取响应数据
let body = $response.body;

try {
    // 解析 JSON 响应
    let json = JSON.parse(body);
    let statusInfo = json?.data?.orderDetailDto?.statusInfo;
    
    if (statusInfo) {
        let statusCode = statusInfo.orderStatus;
        let statusName = statusInfo.orderStatusName;
        let statusDesc = "";
        
        // 状态码翻译表
        switch (statusCode) {
            case 2520:
                statusDesc = "🚧 车辆尚未下线";
                break;
            case 2605:
                statusDesc = "✅ 车辆已下线";
                break;
            case 3000:
                statusDesc = "🚚 车辆已运出";
                break;
            default:
                statusDesc = "ℹ️ 状态未知或未记录，建议留意变化";
                break;
        }
        
        // 发送系统通知
        $notification.post(
            "🚗 小米汽车订单状态", 
            statusName || "状态更新", 
            `状态码: ${statusCode}\n${statusDesc}`
        );
        
        // 控制台日志
        console.log("🚗 订单状态码: " + statusCode);
        console.log("📌 订单状态名: " + statusName);
        console.log("📝 状态说明: " + statusDesc);
        
    } else {
        console.log("⚠️ 未获取到订单状态信息");
    }
    
} catch (e) {
    console.log("❌ JSON 解析错误:", e);
}

// 返回原始响应，不影响 App 正常运行
$done({});
