/*
脚本名称：劲酒 Authorization 获取 (BoxJs多账号版)
脚本作者：Gemini
适用平台：Quantumult X / Loon / Surge
存储 Key：jyj_data
分割符号：#

[rewrite_local]
# Quantumult X
^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin url script-request-header https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/jyj.js

[MITM]
hostname = jjw.jingjiu.com

[Script]
# Loon
http-request ^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin script-path=https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/jyj.js, tag=劲酒Token, enable=true

[MITM]
hostname = jjw.jingjiu.com

*/

const $ = new Env("劲酒Token获取");
const storeKey = "jyj_data"; 

grabToken();

function grabToken() {
    const headers = $request.headers;
    // 兼容 Authorization 或 authorization
    const authKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === "authorization"
    );

    if (authKey) {
        let rawVal = headers[authKey];
        // 清洗数据
        let newToken = rawVal.replace(/^Authorization:\s*/i, "");

        if (!newToken) {
            console.log("⚠️ 提取失败：Authorization 为空");
            $.done();
            return;
        }

        // 读取旧数据
        let history = $.getdata(storeKey) || "";
        
        // --- 核心修改：完全去重逻辑 ---
        
        // 1. 如果历史数据里已经包含了这个 Token
        if (history.includes(newToken)) {
            // 仅仅在日志里打印一下，不做任何弹窗，也不修改数据
            console.log("✅ Token 已存在，静默跳过 (避免弹窗打扰)");
            $.done(); 
            return; 
        }

        // 2. 如果是新数据，才执行写入和弹窗
        let newStorage = "";
        if (history === "") {
            newStorage = newToken;
        } else {
            newStorage = history + "#" + newToken;
        }

        const save = $.setdata(newStorage, storeKey);
        
        if (save) {
            let count = newStorage.split("#").length;
            // 只有新 Token 才会弹窗
            $.msg($.name, `🎉 获取第 ${count} 个新账号`, "Token 已保存到 BoxJs");
            console.log(`✅ 新增 Token: ${newToken}`);
        } else {
            console.log("❌ 写入失败，请检查存储权限");
        }
    } else {
        console.log("未找到 Authorization 请求头");
    }
    $.done();
}

// --- 优化后的 Env 模块 (去除了烦人的结束日志) ---
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isSurge=!1,this.isQuanX=!1,this.isLoon=!1,this.isNode=!1,"undefined"!=typeof $ti&&"undefined"!=typeof $kit?(this.isSurge=!0,this.isLoon=!0):"undefined"!=typeof $task?(this.isQuanX=!0,this.isLoon=!1):"undefined"!=typeof $loon&&(this.isLoon=!0,this.isQuanX=!1),"undefined"!=typeof process&&!0===process.silent&&(this.isNode=!0),this.default=e=Object.assign({},{debug:!1,openUrl:!1},e),this.logs=[],this.log=this.msg}msg(t,e,s,i){if(this.isSurge||this.isLoon)$notification.post(t,e,s,i);else if(this.isQuanX)$notify(t,e,s,i);this.logs.push(t,e,s)}done(){
    // 这里删除了原本的 this.log(...)，解决 Loon 的 "结束! NaN 秒" 弹窗问题
    (this.isSurge||this.isQuanX||this.isLoon)&&$done()
}}(t,e)}
