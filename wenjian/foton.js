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

// 递归遍历修改函数
function antiUpdate(obj) {
    for (var key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            antiUpdate(obj[key]); // 往深处挖
        } else {
            var lowKey = key.toLowerCase();
            
            // 1. 遇到任何像“版本号”的字段 -> 改为 0 (越小越好)
            // 逻辑：如果本地是 7.5.1，服务器是 0，那么 7.5.1 > 0，App就不会提示更新
            if (lowKey.indexOf('version') !== -1 || lowKey.indexOf('code') !== -1) {
                if (typeof obj[key] === 'number') {
                    obj[key] = 0; 
                } else if (typeof obj[key] === 'string') {
                    // 排除掉可能是校验码的长字符串，只改短的数字字符串
                    if (obj[key].length < 10) { 
                        obj[key] = "0";
                    }
                }
            }
            
            // 2. 遇到“强制”或“需要”更新的开关 -> 关掉
            if (lowKey.indexOf('force') !== -1 || lowKey.indexOf('must') !== -1 || lowKey.indexOf('need') !== -1) {
                if (typeof obj[key] === 'number') obj[key] = 0;
                if (typeof obj[key] === 'boolean') obj[key] = false;
                if (typeof obj[key] === 'string') obj[key] = "0";
            }
            
            // 3. 破坏下载链接 -> 清空
            if (lowKey.indexOf('url') !== -1 || lowKey.indexOf('down') !== -1) {
                if (typeof obj[key] === 'string' && obj[key].includes('http')) {
                    obj[key] = "";
                }
            }
        }
    }
}

if (body) {
    try {
        var obj = JSON.parse(body);
        
        // 执行修改
        antiUpdate(obj);
        
        // 打印日志方便调试
        if (url.indexOf("getLoginMember") !== -1) {
            console.log("已处理福田登录接口，将版本号全部置为0");
        }

        $done({body: JSON.stringify(obj)});
    } catch (e) {
        console.log("福田脚本错误: " + e);
        $done({});
    }
} else {
    $done({});
}
