/*
脚本名称：福田E家去更新 (全能版)
脚本作者：Custom
更新时间：2026-02-06
说明：屏蔽首页及登录后的强制更新弹窗
匹配URL：
1. ^https:\/\/czyl\.foton\.com\.cn\/ehomes-new\/homeManager\/api\/User\/getVersion
2. ^https:\/\/czyl\.foton\.com\.cn\/ehomes-new\/homeManager\/getLoginMember

[rewrite_local]
# QX 引用地址
^https:\/\/czyl\.foton\.com\.cn\/ehomes-new\/homeManager\/(api\/User\/getVersion|getLoginMember) url script-response-body https://raw.githubusercontent.com/Maoshijin/wenjian/main/wenjian/foton.js

[Script]
# Loon/Surge 脚本配置
http-response ^https:\/\/czyl\.foton\.com\.cn\/ehomes-new\/homeManager\/(api\/User\/getVersion|getLoginMember) script-path=https://raw.githubusercontent.com/Maoshijin/wenjian/main/wenjian/foton.js, requires-body=true, tag=福田E家去更新

[MITM]
hostname = czyl.foton.com.cn
*/

var body = $response.body;
var url = $request.url;

if (body) {
    try {
        var obj = JSON.parse(body);
        
        // 核心处理函数：专门清洗更新字段
        var cleanUpdateData = function(data) {
            if (!data) return;
            // 暴力修改所有可能的更新字段
            if (data.appVersion) data.appVersion = 0;
            if (data.promptMaxVersionCode) data.promptMaxVersionCode = "0";
            if (data.allowMinVersionCode) data.allowMinVersionCode = "0";
            if (data.version) data.version = "1.0.0";
            if (data.appUpdateURL) data.appUpdateURL = "";
        };

        // 情况1：getVersion 接口（数据直接在 data 里）
        if (url.indexOf("getVersion") !== -1 && obj.data) {
            cleanUpdateData(obj.data);
        }
        
        // 情况2：getLoginMember 登录接口
        // 登录接口的更新数据通常藏在 data 或者是 data.versionInfo 里
        if (url.indexOf("getLoginMember") !== -1 && obj.data) {
            // 策略A：如果更新数据直接混在 data 第一层
            cleanUpdateData(obj.data);
            
            // 策略B：如果更新数据在 data.versionInfo (常见套路)
            if (obj.data.versionInfo) {
                cleanUpdateData(obj.data.versionInfo);
            }
        }

        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("福田脚本错误: " + e);
        $done({});
    }
} else {
    $done({});
}
