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

function nukeUpdate(obj) {
    for (var key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            nukeUpdate(obj[key]); // 递归挖掘下一层
        } else {
            // 把键名转成小写，方便匹配
            var lowKey = key.toLowerCase();
            
            // 1. 任何包含 'version' 的字段 -> 改为本地版本号 '1.0.0' 或 0
            if (lowKey.indexOf('version') !== -1) {
                // 如果原值是数字，改 0；如果是字符串，改 '1.0.0'
                if (typeof obj[key] === 'number') {
                    obj[key] = 99999; // 改成超级大，骗它是未来版本
                } else {
                    obj[key] = "99.9.9"; // 改成超级大
                }
            }
            
            // 2. 任何包含 'update' 的字段 -> 改为空或 false
            if (lowKey.indexOf('update') !== -1) {
                if (typeof obj[key] === 'boolean') obj[key] = false;
                else obj[key] = "";
            }

            // 3. 特殊关键词打击
            if (lowKey === 'force' || lowKey === 'must') {
                obj[key] = 0;
            }
        }
    }
}

if (body) {
    try {
        var obj = JSON.parse(body);
        nukeUpdate(obj);
        $done({body: JSON.stringify(obj)});
    } catch (e) {
        $done({});
    }
} else {
    $done({});
}
