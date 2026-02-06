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

        // --- 核心逻辑开始 ---

        // 1. 针对您刚才抓到的 getVersion 接口 (数据直接在最外层)
        // 只要看到 versionCode，直接改为 "0"，这样 7.5.1 > 0，就不会弹窗
        if (obj.hasOwnProperty('versionCode')) {
            obj.versionCode = "0";
        }
        
        // 把展示用的版本号也改小
        if (obj.hasOwnProperty('version')) {
            obj.version = "0.0.0";
        }

        // 2. 针对可能存在的嵌套结构 (以防万一登录接口也带货)
        if (obj.data) {
            // 递归清理函数：把 data 里的版本号也全干掉
            var cleanData = function(data) {
                if (data.versionCode) data.versionCode = "0";
                if (data.version_code) data.version_code = "0";
                if (data.appVersion) data.appVersion = 0;
                if (data.promptMaxVersionCode) data.promptMaxVersionCode = "0";
                if (data.appUpdateURL) data.appUpdateURL = "";
            };
            
            cleanData(obj.data);
            
            // 如果 data 里还藏了一层 versionInfo
            if (obj.data.versionInfo) {
                cleanData(obj.data.versionInfo);
            }
        }

        // --- 核心逻辑结束 ---

        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("福田脚本执行异常: " + e);
        $done({});
    }
} else {
    $done({});
}
