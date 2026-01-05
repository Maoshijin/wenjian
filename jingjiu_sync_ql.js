/*
脚本名称：劲酒Token同步青龙
脚本作者：Gemini & 适配自阿里云社区同步脚本
适用平台：Quantumult X / Loon / Surge
功能说明：抓取劲酒Authorization并同步至青龙面板环境变量

[rewrite_local]
# 匹配 judgeLogin 接口
^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin url script-request-header https://raw.githubusercontent.com/xxx/jingjiu_sync_ql.js

[Script]
http-request ^https:\/\/jjw\.jingjiu\.com\/app-jingyoujia\/judgeLogin script-path=https://raw.githubusercontent.com/xxx/jingjiu_sync_ql.js, tag=劲酒同步青龙, enable=true

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
        throw new Error(`⛔️ 未在请求头中发现 Authorization`);
    }

    // 清洗数据：去除 "Authorization: " 前缀
    const token = rawAuth.replace(/^Authorization:\s*/i, "");
    
    $.log(`🔍 抓取到的 Token (摘要): ${token.substring(0, 15)}...`);
    
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
        await ql.checkLogin();

        // 获取目标环境变量
        await ql.getEnvs();
        const envs = ql.selectEnvByName(QL.envName);
        
        let targetEnv = envs[0]; // 默认取第一个匹配的变量
        let newEnvValue = "";

        if (targetEnv) {
            // --- 场景 A: 变量已存在，进行追加或去重 ---
            const oldVal = targetEnv.value;
            
            if (oldVal.includes(newToken)) {
                $.log(`⚠️ 当前 Token 已存在于青龙变量 [${QL.envName}] 中，无需更新`);
                $.msg($.name, "无需更新", "Token 已存在于青龙面板");
                return;
            } else {
                // 追加逻辑：使用 # 分割
                newEnvValue = oldVal + "#" + newToken;
                $.log(`➕ 追加新 Token，正在更新变量...`);
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
                if (task.status === 0) { // 0 通常表示空闲/启用，视版本而定，这里直接运行
                    await ql.runTask([task.id]);
                    $.msg($.name, "任务指令已发送", `开始执行: ${QL.taskName}`);
                } else {
                     // 尝试强制运行
                    await ql.runTask([task.id]);
                    $.msg($.name, "任务指令已发送", `开始执行: ${QL.taskName}`);
                }
            } else {
                $.log(`⚠️ 未找到名称为 [${QL.taskName}] 的任务，跳过运行`);
            }
        }

    } catch (e) {
        $.logErr(e);
        $.msg($.name, "❌ 同步失败", e.message);
    }
}

// 辅助：Header 转小写
function ObjectKeys2LowerCase(e) {
    return Object.fromEntries(Object.entries(e).map(([k, v]) => [k.toLowerCase(), v]));
}

// 执行入口
!(async () => {
    await main();
})()
.catch((e) => $.logErr(e))
.finally(() => $.done());


// ---------------------- 青龙 API 类 (保持原样) -----------------------------------
function QingLong(HOST, Client_ID, Client_Secret) {
    const Request = (t, m = "GET") => {
        return new Promise((resolve, reject) => {
            $.http[m.toLowerCase()](t).then((response) => {
                var resp = response.body;
                try { resp = $.toObj(resp) || resp; } catch (e) { }
                resolve(resp);
            }).catch((err) => reject(err));
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
            // 简化版：每次都获取 Token，防止缓存失效问题
            await this.getAuthToken(); 
        }
        async getAuthToken() {
            const options = {
                url: `${this.host}/open/auth/token`,
                params: { client_id: this.clientId, client_secret: this.clientSecret },
            };
            const { code, data, message } = await Request(options);
            if (code === 200) {
                this.token = `${data.token_type} ${data.token}`;
            } else {
                throw message || "无法获取青龙 Token";
            }
        }
        async getEnvs() {
            const options = {
                url: `${this.host}/open/envs`,
                headers: { 'Authorization': this.token },
            };
            const { code, data } = await Request(options);
            if (code === 200) { this.envs = data; }
        }
        async getTask(name) {
            const options = {
                url: `${this.host}/open/crons?searchValue=${encodeURIComponent(name)}`, // 使用搜索参数更准
                headers: { 'Authorization': this.token },
            };
            const { code, data } = await Request(options);
            if (code === 200 && data.data) {
                return data.data.find((item) => item.name === name || item.command.includes(name));
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
            await Request(options, "post");
        }
        async updateEnv(obj) {
            const options = {
                url: `${this.host}/open/envs`,
                method: "put",
                headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" },
                body: JSON.stringify(obj),
            };
            await Request(options, "put"); // 注意 QL 新版通常是 PUT
        }
        async runTask(taskIds) {
            const options = {
                url: `${this.host}/open/crons/run`,
                method: "put",
                headers: { Authorization: this.token, "Content-Type": "application/json;charset=UTF-8" },
                body: JSON.stringify(taskIds),
            };
            await Request(options, "put");
        }
    })(HOST, Client_ID, Client_Secret);
}

// ---------------------- 固定 Env 模块 -----------------------------------
// (此处省略 Env 源码，请直接使用您提供的脚本中最下方的 Env 代码，或者让脚本运行环境自带)
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, a) => { s.call(this, t, (t, s, r) => { t ? a(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const a = this.getdata(t); if (a) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, a) => e(a)) }) } runScript(t, e) { return new Promise(s => { let a = this.getdata("@chavy_boxjs_userCfgs.httpapi"); a = a ? a.replace(/\n/g, "").trim() : a; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [i, o] = a.split("@"), n = { url: `http://${o}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": i, Accept: "*/*" }, timeout: r }; this.post(n, (t, e, a) => s(a)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e); if (!s && !a) return {}; { const a = s ? t : e; try { return JSON.parse(this.fs.readFileSync(a)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : a ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const a = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of a) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, a) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[a + 1]) >> 0 == +e[a + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, a] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, a, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, a, r] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(a), o = a ? "null" === i ? null : i || "{}" : "{}"; try { const e = JSON.parse(o); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), a) } catch (e) { const i = {}; this.lodash_set(i, r, t), s = this.setval(JSON.stringify(i), a) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, a) => { !t && s && (s.body = a, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, a) }); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o }, i, o) }, t => e(t && t.error || "UndefinedError")); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: a, statusCode: r, headers: i, rawBody: o } = t, n = s.decode(o, this.encoding); e(null, { status: a, statusCode: r, headers: i, rawBody: o, body: n }, n) }, t => { const { message: a, response: r } = t; e(a, r, r && s.decode(r.rawBody, this.encoding)) }) } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, a) => { !t && s && (s.body = a, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, a) }); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o }, i, o) }, t => e(t && t.error || "UndefinedError")); break; case "Node.js": let a = require("iconv-lite"); this.initGotEnv(t); const { url: r, ...i } = t; this.got[s](r, i).then(t => { const { statusCode: s, statusCode: r, headers: i, rawBody: o } = t, n = a.decode(o, this.encoding); e(null, { status: s, statusCode: r, headers: i, rawBody: o, body: n }, n) }, t => { const { message: s, response: r } = t; e(s, r, r && a.decode(r.rawBody, this.encoding)) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let a = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in a) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? a[e] : ("00" + a[e]).substr(("" + a[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let a = t[s]; null != a && "" !== a && ("object" == typeof a && (a = JSON.stringify(a)), e += `${s}=${a}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", a = "", r) { const i = t => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } case "Loon": { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } case "Quantumult X": { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, a = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": a } } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, a, i(r)); break; case "Quantumult X": $notify(e, s, a, i(r)); break; case "Node.js": }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), a && t.push(a), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, t.stack) } } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }
