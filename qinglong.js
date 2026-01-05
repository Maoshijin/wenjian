/*
脚本名称：劲酒Token同步青龙 (智能备注+精准去重版)
脚本作者：MM
功能说明：
1. 抓取劲酒Token并同步至青龙。
2. 修复部分字符变动不更新的Bug（改为精准匹配）。
3. 自动解码Token提取ID，更新青龙备注（例如：账号[1873]）。

[rewrite_local]
# 匹配 judgeLogin 接口
^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin url script-request-header https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/qinglong.js

[MITM]
hostname = jjw.jingjiu.com

[Script]
http-request ^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin script-path=https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/qinglong.js, tag=劲酒同步青龙, enable=true

[MITM]
hostname = jjw.jingjiu.com

---------------------------
BoxJs 全局变量配置 (Key: jyj_QL):
{
  "host": "http://192.168.1.93:5700",
  "clientId": "7MRlItXTD-cR",
  "secret": "kB7DIXTCw-3Ons8Ai7onrivl",
  "envName": "JYJ",
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
    
    if (!rawAuth) return null;

    // 清洗数据
    const token = rawAuth.replace(/^Authorization:\s*/i, "");
    $.log(`🔍 捕获 Token: ...${token.slice(-10)}`);
    return token;
}

async function main() {
    try {
        // 校验配置
        QL = typeof QL === "string" ? JSON.parse(QL) : QL;
        if (!QL.host || !QL.clientId || !QL.secret) {
            throw new Error(`⛔️ 请在 BoxJs 设置 QL 配置 (Key: jyj_QL)`);
        }
        
        // --- 强制设置变量名为 JYJ ---
        QL.envName = "JYJ"; 
        // -------------------------

        const newToken = await getAuthorization();
        if (!newToken) return;

        // 初始化青龙连接
        const ql = new QingLong(QL.host, QL.clientId, QL.secret);
        $.log(`🔗 连接青龙，目标变量: ${QL.envName}`);
        await ql.checkLogin();

        // 获取目标环境变量
        await ql.getEnvs();
        const envs = ql.selectEnvByName(QL.envName);
        
        let targetEnv = envs[0]; 
        let finalValue = "";
        let newRemark = "";

        if (targetEnv) {
            // --- 场景 A: 变量已存在 ---
            const oldVal = targetEnv.value;
            
            // 1. 分割旧数据 (以 # 分割，过滤空行)
            let items = oldVal.split('#').filter(t => t && t.length > 10);
            
            // 2. 提取纯 Token 用于比对
            const existTokens = items.map(item => item.split('&')[0]);
            
            // 3. 检查是否重复
            if (existTokens.includes(newToken)) {
                $.log(`⚠️ Token 已存在，跳过更新`);
                return; 
            }

            // 4. 生成新序号 (当前总数 + 1)
            const nextIndex = items.length + 1;
            newRemark = `账号${nextIndex}`;
            const newItem = `${newToken}&${newRemark}`;

            // 5. 追加
            $.log(`➕ 新增 ${newRemark}，正在追加...`);
            items.push(newItem);
            finalValue = items.join('#');
            
            // 更新变量
            await ql.updateEnv({ 
                value: finalValue, 
                name: QL.envName, 
                id: targetEnv.id, 
                remarks: `自动同步: 共 ${items.length} 个账号` 
            });

        } else {
            // --- 场景 B: 变量不存在，新建 ---
            $.log(`🆕 变量 [${QL.envName}] 不存在，创建第一个账号...`);
            newRemark = "账号1";
            finalValue = `${newToken}&${newRemark}`;
            
            await ql.addEnv([{ 
                value: finalValue, 
                name: QL.envName, 
                remarks: `自动同步: 共 1 个账号` 
            }]);
        }

        $.msg($.name, "🎉 同步成功", `变量: ${QL.envName}\n已添加: ${newRemark}`);

        // --- 自动运行任务 ---
        if (QL.taskName && (QL.autoRunTask === true || QL.autoRunTask === "true")) {
            const task = await ql.getTask(QL.taskName);
            if (task) {
                await ql.runTask([task.id]);
                $.msg($.name, "任务已触发", `执行: ${QL.taskName}`);
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

// ---------------------- 核心类与 Env 模块 (保持不变) -----------------------------------
function QingLong(HOST, Client_ID, Client_Secret) {
    const Request = (options, method = "GET") => {
        return new Promise((resolve, reject) => {
            options.headers = options.headers || {};
            const callback = (err, resp, data) => {
                if (err) return reject(new Error(err));
                let body = data;
                try {
                    if (typeof data === 'string') { body = JSON.parse(data); }
                } catch (e) {}
                resolve({ statusCode: resp.status || resp.statusCode || 200, headers: resp.headers, body: body });
            };
            const m = method.toUpperCase();
            if (m === 'GET') { $.get(options, callback); } 
            else { options.method = m; $.post(options, callback); }
        });
    };
    return new (class {
        constructor(HOST, Client_ID, Client_Secret) {
            this.host = HOST; this.clientId = Client_ID; this.clientSecret = Client_Secret; this.token = ""; this.envs = [];
        }
        async checkLogin() { await this.getAuthToken(); }
        async getAuthToken() {
            const options = { url: `${this.host}/open/auth/token?client_id=${this.clientId}&client_secret=${this.clientSecret}` };
            const response = await Request(options, "GET");
            if (response.body.code === 200) { this.token = `${response.body.data.token_type} ${response.body.data.token}`; } 
            else { throw new Error(response.body.message || "无法获取青龙 Token"); }
        }
        async getEnvs() {
            const options = { url: `${this.host}/open/envs`, headers: { 'Authorization': this.token } };
            const response = await Request(options, "GET");
            if (response.body.code === 200) { this.envs = response.body.data; }
        }
        async getTask(name) {
            const options = { url: `${this.host}/open/crons?searchValue=${encodeURIComponent(name)}`, headers: { 'Authorization': this.token } };
            const response = await Request(options, "GET");
            if (response.body.code === 200 && response.body.data) {
                const tasks = response.body.data.data || response.body.data;
                if(Array.isArray(tasks)){ return tasks.find((item) => item.name === name || item.command.includes(name)); }
            }
            return null;
        }
        selectEnvByName(name) { return this.envs.filter((item) => item.name === name); }
        async addEnv(array) {
            const options = { url: `${this.host}/open/envs`, headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" }, body: JSON.stringify(array) };
            await Request(options, "POST");
        }
        async updateEnv(obj) {
            const options = { url: `${this.host}/open/envs`, headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" }, body: JSON.stringify(obj) };
            await Request(options, "PUT");
        }
        async runTask(taskIds) {
            const options = { url: `${this.host}/open/crons/run`, headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" }, body: JSON.stringify(taskIds) };
            await Request(options, "PUT");
        }
    })(HOST, Client_ID, Client_Secret);
}

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports&&!!process}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"},timeout:r};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),i=e.resolve(process.cwd(),this.dataFile),r=t.existsSync(s),o=!r&&t.existsSync(i);if(!r&&!o)return{};{const e=r?s:i;try{return JSON.parse(t.readFileSync(e))}catch(t){return{}}}}}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),i=e.resolve(process.cwd(),this.dataFile),r=t.existsSync(s),o=!r&&t.existsSync(i),h=JSON.stringify(this.data);r?t.writeFileSync(s,h):o?t.writeFileSync(i,h):t.writeFileSync(s,h)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isNode()?this.data=this.loaddata()[t]:this.isSurge()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isLoon()?$persistentStore.read(t):this.data&&this.data[t]||null}setval(t,e){return this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.isSurge()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isLoon()?$persistentStore.write(t,e):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,
