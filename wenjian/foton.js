/*
脚本名称：福田E家去更新
脚本作者：Custom
更新时间：2026-01-19
使用说明：屏蔽福田E家强制更新弹窗
匹配URL：https://czyl.foton.com.cn/ehomes-new/homeManager/api/User/getVersion
*/

var body = $response.body;
var obj = JSON.parse(body);

// 检查是否存在 data 字段
if (obj && obj.data) {
    // 1. 将服务器返回的最新版本号改为 0 (任何安装版本都会比 0 大，所以不更新)
    obj.data.appVersion = 0;
    
    // 2. 将强制提示的阈值改为 0
    obj.data.promptMaxVersionCode = "0";
    
    // 3. 将最低允许版本改为 0
    obj.data.allowMinVersionCode = "0";
    
    // 4. (可选) 修改展示用的版本号和内容，避免视觉干扰
    obj.data.version = "1.0.0";
    obj.data.content = "已屏蔽更新";
    obj.data.appUpdateURL = "";
}

// 重新打包返回数据
$done({body: JSON.stringify(obj)});

[rewrite_local]
# 福田E家去更新
^https:\/\/czyl\.foton\.com\.cn\/ehomes-new\/homeManager\/api\/User\/getVersion url script-response-body https://raw.githubusercontent.com/Maoshijin/wenjian/main/wenjian/foton.js

[Script]
# 福田E家去更新
http-response ^https:\/\/czyl\.foton\.com\.cn\/ehomes-new\/homeManager\/api\/User\/getVersion script-path=https://raw.githubusercontent.com/Maoshijin/wenjian/main/wenjian/foton.js, requires-body=true, tag=福田E家去更新

[MITM]
hostname = czyl.foton.com.cn
