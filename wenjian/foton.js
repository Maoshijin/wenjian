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

// 递归遍历函数：不管藏在第几层，都要揪出来
function deepClean(obj) {
    for (var key in obj) {
        // 如果是对象或数组，继续往深处挖
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            deepClean(obj[key]);
        } else {
            // === 核心打击列表 ===
            
            // 1. 修改版本号 (服务器版本改为0)
            if (key === "appVersion" || key === "version_code" || key === "serverVersion") {
                obj[key] = 0;
            }
            
            // 2. 修改提示阈值
            if (key === "promptMaxVersionCode" || key === "allowMinVersionCode") {
                obj[key] = "0";
            }
            
            // 3. 修改展示版本
            if (key === "version" || key === "versionName") {
                obj[key] = "1.0.0";
            }
            
            // 4. 去除强制标记 (常见字段 force, mustUpdate, needUpdate)
            if (key === "force" || key === "mustUpdate" || key === "needUpdate" || key === "isUpdate") {
                obj[key] = 0; // 或者 false
            }
            
            // 5. 破坏更新链接
            if (key === "appUpdateURL" || key === "downloadUrl" || key === "url") {
                // 只清空看起来像更新包的链接
                if (typeof obj[key] === 'string' && (obj[key].indexOf(".apk") !== -1 || obj[key].indexOf("itunes") !== -1)) {
                    obj[key] = "";
                }
            }
        }
    }
}

if (body) {
    try {
        var obj = JSON.parse(body);
        
        // 开始全盘清洗
        deepClean(obj);
        
        // 专门针对登录接口可能的特殊结构（如果它把数据放在 data 字符串里）
        if (url.indexOf("getLoginMember") !== -1) {
            console.log("正在处理福田登录接口...");
        }

        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("福田脚本执行错误: " + e);
        $done({});
    }
} else {
    $done({});
}
