/*
脚本名称：福田E家去更新
脚本作者：Custom
更新时间：2026-01-19
使用说明：屏蔽福田E家强制更新弹窗
匹配URL：https://czyl.foton.com.cn/ehomes-new/homeManager/api/User/getVersion
*/

var body = $response.body;
// 防止解析失败导致断网，加个简单的容错
if (body) {
    try {
        var obj = JSON.parse(body);
        if (obj && obj.data) {
            obj.data.appVersion = 0;
            obj.data.promptMaxVersionCode = "0";
            obj.data.allowMinVersionCode = "0";
            obj.data.version = "1.0.0";
            obj.data.content = "已屏蔽更新";
            obj.data.appUpdateURL = "";
        }
        $done({body: JSON.stringify(obj)});
    } catch (e) {
        // 如果 JSON 解析失败，原样返回，不影响 App 使用
        console.log("福田E家脚本解析错误: " + e);
        $done({});
    }
} else {
    $done({});
}
