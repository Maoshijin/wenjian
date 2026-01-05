/*
脚本名称：劲酒Token同步青龙
脚本作者：Gemini & 适配自阿里云社区同步脚本
适用平台：Quantumult X / Loon / Surge
功能说明：抓取劲酒Authorization并同步至青龙面板环境变量

[rewrite_local]
# 匹配 judgeLogin 接口
^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin url script-request-header https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/jingjiu_sync_ql.js

[MITM]
hostname = jjw.jingjiu.com

[Script]
http-request ^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin script-path=https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/jingjiu_sync_ql.js, tag=劲酒同步青龙, enable=true

[MITM]
hostname = jjw.jingjiu.com

---------------------------
BoxJs 全局变量配置 (Key: jyj_QL):
{
  "host": "http://192.168.1.93:5700",
  "clientId": "7MRlItXTD-cR",
  "secret": "kB7DIXTCw-3Ons8Ai7onrivl",
  "envName": "jyj_data",
  "taskName": "jyj.js",
  "autoRunTask": true
}
---------------------------

*/

const $ = new Env("劲酒Token同步青龙");

// 1. 获取 BoxJs 中的青龙配置
let QL = ($.isNode() ? process.env.jyj_QL : $.getjson("jyj_QL")) || {};

// ---------------------- 主逻辑区 -----------------------------------

async function getAuthorization() {
    if (typeof $request === "undefined") return null;
    
    const headers = ObjectKeys2LowerCase($request.headers);
    const rawAuth = headers['authorization'];
    
    if (!rawAuth) {
        // 静默退出，可能是其他请求触发
        return null;
    }

    // 清洗数据：去除 "Authorization: " 前缀
    const token = rawAuth.replace(/^Authorization:\s*/i, "");
    
    // 简单的去重/防抖日志
    $.log(`🔍 捕获到 Token: ${token.substring(0, 10)}...`);
    
    return token;
}

async function main() {
    try {
        // 校验配置
        QL = typeof QL === "string" ? JSON.parse(QL) : QL;
        if (!QL.host || !QL.clientId || !QL.secret) {
            throw new Error(`⛔️ 请先在 BoxJs 配置青龙应用信息 (Key: jyj_QL)`);
        }
        if (!QL.envName) {
            throw new Error(`⛔️ 请在配置中指定环境变量名称 (envName)`);
        }

        const newToken = await getAuthorization();
        if (!newToken) return;

        // 初始化青龙连接
        const ql = new QingLong(QL.host, QL.clientId, QL.secret);
        
        // 尝试登录
        $.log("正在连接青龙面板...");
        await ql.checkLogin();

        // 获取目标环境变量
        await ql.getEnvs();
        const envs = ql.selectEnvByName(QL.envName);
        
        let targetEnv = envs[0]; 
        let newEnvValue = "";

        if (targetEnv) {
            // --- 场景 A: 变量已存在，进行追加或去重 ---
            const oldVal = targetEnv.value;
            
            if (oldVal.includes(newToken)) {
                $.log(`⚠️ 当前 Token 已存在，无需更新`);
                // 只有第一次获取会弹窗，重复的不弹窗打扰
                return;
            } else {
                // 追加逻辑：使用 # 分割
                newEnvValue = oldVal + "#" + newToken;
                $.log(`➕ 追加新 Token...`);
                await ql.updateEnv({ value: newEnvValue, name: QL.envName, id: targetEnv.id, remarks: targetEnv.remarks });
            }
        } else {
            // --- 场景 B: 变量不存在，新建 ---
            $.log(`🆕 变量 [${QL.envName}] 不存在，正在创建...`);
            newEnvValue = newToken;
            await ql.addEnv([{ value: newEnvValue, name: QL.envName, remarks: "由脚本自动同步" }]);
        }

        $.msg($.name, "🎉 同步成功", `Token 已推送到青龙变量: ${QL.envName}`);

        // --- 自动运行任务逻辑 ---
        if (QL.taskName && (QL.autoRunTask === true || QL.autoRunTask === "true")) {
            const task = await ql.getTask(QL.taskName);
            if (task) {
                await ql.runTask([task.id]);
                $.msg($.name, "任务指令已发送", `开始执行: ${QL.taskName}`);
            } else {
                $.log(`⚠️ 未找到名称为 [${QL.taskName}] 的任务，跳过运行`);
            }
        }

    } catch (e) {
        $.logErr(e);
        $.msg($.name, "❌ 同步失败", e.message);
    }
}

function ObjectKeys2LowerCase(e) {
    return Object.fromEntries(Object.entries(e).map(([k, v]) => [k.toLowerCase(), v]));
}

!(async () => {
    await main();
})()
.catch((e) => $.logErr(e))
.finally(() => $.done());


// ---------------------- 核心修复：QingLong 类 -----------------------------------
function QingLong(HOST, Client_ID, Client_Secret) {
    // 修复：不使用 $.http，改用原生封装，兼容性更强
    const Request = (options, method = "GET") => {
        return new Promise((resolve, reject) => {
            // 确保 headers 存在
            options.headers = options.headers || {};
            
            // 定义通用回调
            const callback = (err, resp, data) => {
                if (err) {
                    // 某些环境 err 是字符串
                    return reject(new Error(err));
                }
                
                // 尝试解析 JSON body
                let body = data;
                try {
                    if (typeof data === 'string') {
                        body = JSON.parse(data);
                    }
                } catch (e) {
                    // 解析失败则保留原字符串
                }

                resolve({
                    statusCode: resp.status || resp.statusCode || 200,
                    headers: resp.headers,
                    body: body
                });
            };

            // 根据方法分发
            const m = method.toUpperCase();
            if (m === 'GET') {
                $.get(options, callback);
            } else {
                // POST, PUT 等
                options.method = m; 
                $.post(options, callback);
            }
        });
    };

    return new (class {
        constructor(HOST, Client_ID, Client_Secret) {
            this.host = HOST;
            this.clientId = Client_ID;
            this.clientSecret = Client_Secret;
            this.token = "";
            this.envs = [];
        }
        async checkLogin() {
            await this.getAuthToken(); 
        }
        async getAuthToken() {
            const options = {
                url: `${this.host}/open/auth/token`,
                // 注意：GET 请求参数通常需要拼接到 URL，或者由 Env 处理，为了保险这里拼接到 URL
                url: `${this.host}/open/auth/token?client_id=${this.clientId}&client_secret=${this.clientSecret}`
            };
            const response = await Request(options, "GET");
            const data = response.body.data;
            const code = response.body.code;
            
            if (code === 200) {
                this.token = `${data.token_type} ${data.token}`;
            } else {
                throw new Error(response.body.message || "无法获取青龙 Token，请检查 ClientID/Secret");
            }
        }
        async getEnvs() {
            const options = {
                url: `${this.host}/open/envs`,
                headers: { 'Authorization': this.token },
            };
            const response = await Request(options, "GET");
            if (response.body.code === 200) { 
                this.envs = response.body.data; 
            }
        }
        async getTask(name) {
            const options = {
                url: `${this.host}/open/crons?searchValue=${encodeURIComponent(name)}`,
                headers: { 'Authorization': this.token },
            };
            const response = await Request(options, "GET");
            if (response.body.code === 200 && response.body.data) {
                // 模糊匹配
                const tasks = response.body.data.data || response.body.data; // 兼容不同版本青龙返回结构
                if(Array.isArray(tasks)){
                     return tasks.find((item) => item.name === name || item.command.includes(name));
                }
            }
            return null;
        }
        selectEnvByName(name) {
            return this.envs.filter((item) => item.name === name);
        }
        async addEnv(array) {
            const options = {
                url: `${this.host}/open/envs`,
                headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" },
                body: JSON.stringify(array),
            };
            await Request(options, "POST");
        }
        async updateEnv(obj) {
            const options = {
                url: `${this.host}/open/envs`,
                headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" },
                body: JSON.stringify(obj),
            };
            await Request(options, "PUT");
        }
        async runTask(taskIds) {
            const options = {
                url: `${this.host}/open/crons/run`,
                headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" },
                body: JSON.stringify(taskIds),
            };
            await Request(options, "PUT");
        }
    })(HOST, Client_ID, Client_Secret);
}

// ---------------------- 基础 Env 模块 (无需修改) -----------------------------------
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isSurge=!1,this.isQuanX=!1,this.isLoon=!1,this.isNode=!1,"undefined"!=typeof $ti&&"undefined"!=typeof $kit?(this.isSurge=!0,this.isLoon=!0):"undefined"!=typeof $task?(this.isQuanX=!0,this.isLoon=!1):"undefined"!=typeof $loon&&(this.isLoon=!0,this.isQuanX=!1),"undefined"!=typeof process&&!0===process.silent&&(this.isNode=!0),this.default=e=Object.assign({},{debug:!1,openUrl:!1},e),this.logs=[],this.log=this.msg}msg(t,e,s,i){if(this.isSurge||this.isLoon)$notification.post(t,e,s,i);else if(this.isQuanX)$notify(t,e,s,i);this.logs.push(t,e,s)}done(){(this.isSurge||this.isQuanX||this.isLoon)&&$done()}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.getval(i,t):null}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.setval(r,t,e),this.setval(i,JSON.stringify(e)),s=!0}catch(e){const o={};this.setval(r,t,o),this.setval(i,JSON.stringify(o),o),s=!0}}else s=this.setval(t,e);return s}getval(t){return this.isSurge||this.isLoon?$persistentStore.read(t):this.isQuanX?$prefs.valueForKey(t):this.isNode?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge||this.isLoon?$persistentStore.write(t,e):this.isQuanX?$prefs.setValueForKey(t,e):this.isNode?(this.data=this.loaddata(),this.data[t]=e,this.writedata(),!0):this.data&&this.data[t]||null}loaddata(){if(!this.isNode)return{};{const t=this.fs&&this.fs.readFileSync(this.dataFile,"utf8");return t?JSON.parse(t):{}}}writedata(){if(this.isNode){this.fs&&this.fs.writeFileSync(this.dataFile,JSON.stringify(this.data));}}}(t,e)}
