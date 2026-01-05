/*
脚本名称：劲酒 Authorization 获取 (BoxJs多账号版)
脚本作者：Gemini
适用平台：Quantumult X / Loon / Surge
存储 Key：jyj_data
分割符号：#

[rewrite_local]
# Quantumult X
^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin url script-request-header https://raw.githubusercontent.com/xxx/jyj.js

[Script]
# Loon
http-request ^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin script-path=https://raw.githubusercontent.com/xxx/jyj.js, tag=劲酒Token, enable=true

*/

const $ = new Env("劲酒Token获取");
// ⬇️ 这里已修改为您指定的 Key
const storeKey = "jyj_data"; 

// 获取并处理
grabToken();

function grabToken() {
    // 1. 寻找 Authorization 头
    const headers = $request.headers;
    const authKey = Object.keys(headers).find(
        (key) => key.toLowerCase() === "authorization"
    );

    if (authKey) {
        // 2. 提取并清洗数据 (去除 Authorization: 和空格)
        let rawVal = headers[authKey];
        let newToken = rawVal.replace(/^Authorization:\s*/i, "");

        if (!newToken) {
            console.log("提取 Authorization 失败，值为空");
            $.done();
            return;
        }

        // 3. 读取 BoxJs 中已存的数据 (从 jyj_data 读取)
        let history = $.getdata(storeKey) || "";
        
        // 4. 判断逻辑
        if (history.includes(newToken)) {
            // 场景 A: 账号已存在
            console.log("⚠️ 该账号 Token 已存在，跳过写入");
        } else {
            // 场景 B: 新账号 -> 拼接
            let newStorage = "";
            if (history === "") {
                newStorage = newToken; // 第一个账号
            } else {
                newStorage = history + "#" + newToken; // 后续账号用 # 隔开
            }

            // 5. 写入数据 (写入到 jyj_data)
            const save = $.setdata(newStorage, storeKey);
            
            if (save) {
                let count = newStorage.split("#").length;
                $.msg($.name, `获取第 ${count} 个账号成功 🎉`, "数据已存入 BoxJs (Key: jyj_data)");
                console.log(`✅ 新增 Token: ${newToken}`);
                console.log(`📊 当前总数据: ${newStorage}`);
            } else {
                $.msg($.name, "❌ 写入失败", "请检查 BoxJs 或 存储权限");
            }
        }
    } else {
        console.log("未在请求头中找到 Authorization");
    }
    $.done();
}

// --- Env 封装 ---
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isSurge=!1,this.isQuanX=!1,this.isLoon=!1,this.isNode=!1,"undefined"!=typeof $ti&&"undefined"!=typeof $kit?(this.isSurge=!0,this.isLoon=!0):"undefined"!=typeof $task?(this.isQuanX=!0,this.isLoon=!1):"undefined"!=typeof $loon&&(this.isLoon=!0,this.isQuanX=!1),"undefined"!=typeof process&&!0===process.silent&&(this.isNode=!0),this.default=e=Object.assign({},{debug:!1,openUrl:!1},e),this.logs=[],this.log=this.msg}msg(t,e,s,i){if(this.isSurge||this.isLoon)$notification.post(t,e,s,i);else if(this.isQuanX)$notify(t,e,s,i);this.logs.push(t,e,s)}done(){let t=(new Date).getTime(),e=(t-this.startTime)/1e3;this.log("",`🔔 ${this.name}, 结束! 🕛 ${e} 秒`),this.log(),(this.isSurge||this.isQuanX||this.isLoon)&&$done()}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.getval(i,t):null}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.setval(r,t,e),this.setval(i,JSON.stringify(e)),s=!0}catch(e){const o={};this.setval(r,t,o),this.setval(i,JSON.stringify(o),o),s=!0}}else s=this.setval(t,e);return s}getval(t){return this.isSurge||this.isLoon?$persistentStore.read(t):this.isQuanX?$prefs.valueForKey(t):this.isNode?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge||this.isLoon?$persistentStore.write(t,e):this.isQuanX?$prefs.setValueForKey(t,e):this.isNode?(this.data=this.loaddata(),this.data[t]=e,this.writedata(),!0):this.data&&this.data[t]||null}loaddata(){if(!this.isNode)return{};{const t=this.fs&&this.fs.readFileSync(this.dataFile,"utf8");return t?JSON.parse(t):{}}}writedata(){if(this.isNode){this.fs&&this.fs.writeFileSync(this.dataFile,JSON.stringify(this.data));}}}(t,e)}
