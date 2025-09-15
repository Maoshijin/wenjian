/*
------------------------------------------
@Author: Sliverkiss
@Date: 2023.10.21 19:01:56
@Description:王者营地 每日签到、浏览战绩、点赞、启动游戏、分享等
------------------------------------------
2024.04.01 修复一键领取奖励不全的问题，重构代码，优化通知样式，支持多账号.

重写：打开应用->游戏->每日福利。支持多账号

loon:
[Script]
http-request ^https:\/\/kohcamp\.qq\.com\/operation\/action\/signin script-path=https://gist.githubusercontent.com/Sliverkiss/041df92d35c35038fa2940c9a5a38ff5/raw/wzyd.js, timeout=10, tag=王者营地获取ck

[MITM]
hostname=kohcamp.qq.com

脚本兼容：Surge、QuantumultX、Loon、Shadowrocket、Node.js
只测试过loon、QuantumultX，其它环境请自行尝试

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。
*/
const $ = new Env("王者营地");
const ckName = "wzyd_data";
const userCookie = $.toObj($.isNode() ? process.env[ckName] : $.getdata(ckName)) || [];
//notify
const notify = $.isNode() ? require('./sendNotify') : '';
$.notifyMsg = []
//debug
$.is_debug = ($.isNode() ? process.env.IS_DEDUG : $.getdata('is_debug')) || 'false';
$.doFlag = { "true": "✅", "false": "⛔️" };

//------------------------------------------
const baseUrl = "https://kohcamp.qq.com"
let _headers = {};
const fetch = async (o) => {
    try {
        if (typeof o === 'string') o = { url: o };
        if (o?.url?.startsWith("/") || o?.url?.startsWith(":")) o.url = baseUrl + o.url
        const res = await Request({ ...o, headers: o.headers || _headers, url: o.url })
        debug(res, o?.url?.replace(/\/+$/, '').substring(o?.url?.lastIndexOf('/') + 1));
        //if (!(res?.code == 0 || res?.code == 5020||res?.)) throw new Error(res?.msg || `用户需要去登录`);
        return res;
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 请求发起失败！${e}`);
    }
}
//------------------------------------------
async function main() {
    try {
        //check accounts
        if (!userCookie?.length) throw new Error("no available accounts found");
        $.log(`\n检测到 ${userCookie?.length ?? 0} 个账号\n`);
        let index = 0;
        //doTask of userList
        for (let user of userCookie) {
            //init of user
            $.log(`账号[${user?.userName || ++index}] 开始执行任务...`),
                $.notifyMsg = [], $.ckStatus = true, $.title = "", $.avatar = "";
            _headers = { ...user.token };
            //task 
            await signin();
            if ($.ckStatus) {
                let taskList = [
                    { name: "启动游戏", body: { gameId: '20001', token: _headers.token, type: 2, userId: _headers.userid } },
                    { name: "分享任务", body: { gameId: '20001', token: _headers.token, type: 1, userId: _headers.userid, shareType: "%E5%BE%AE%E4%BF%A1%E5%A5%BD%E5%8F%8B" } },
                    { name: "浏览战绩", body: { gameId: '20001', token: _headers.token, type: 6, userId: _headers.userid, tabName: "%E6%88%98%E7%BB%A9", viewOtherBattle: "1" } },
                ]
                //启动游戏、分享任务、浏览战绩
                for (let item of taskList) {
                    await doTask(item);
                }
                //点赞
                let infoId = await getNews() ?? '';
                if (infoId) {
                    await taskNews(infoId);
                    await taskLike(infoId, 1);
                }
                await getRewardList();
                //let userInfo = await getUserInfo() ?? {};
                $.title = `「${user.userid}」已完成每日任务`;
                $.avatar = userInfo?.avatar;
            } else {
                DoubleLog(`⛔️ 「${user.userName ?? `账号${index}`}」check ck error!`)
            }
            //notify
            await sendMsg($.notifyMsg.join("\n"));
        }
    } catch (e) {
        throw e
    }
}
//签到
async function signin() {
    try {
        const options = {
            url: `/operation/action/signin`,
            type: 'post',
            dataType: "json",
            body: { "cSystem": "ios", "h5Get": 1, "roleId": _headers.camproleid }
        };
        //post方法
        let res = await fetch(options);
        if (!(res?.returnCode == 0 || res?.returnCode == '-105203')) throw new Error(res?.returnMsg);
        $.log(`签到:${res?.returnMsg || `成功！已连续签到${res?.data?.userTotalSign}天`}`);
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 签到:${e}`);
    }
}
//查询任务完成情况
async function getRewardList() {
    let body = { "serverId": _headers.serverid, "cSystem": "ios", "h5Get": 1, "roleId": _headers.camproleid };
    let dailyTaskList = await getTaskList(body);
    let gameTaskList = await getTaskList({ ...body, gameId: "20001" });
    dailyTaskList.push(...gameTaskList);
    $.log(`️☑️ 任务列表查询成功！完成情况如下:`);
    for (let item of dailyTaskList) {
        DoubleLog(`${item.title}:${item.userScore}/${item.taskScore}`);
    }
    //一键领取奖励
    let taskIds = dailyTaskList.map(e => e.taskId);
    debug(taskIds);
    await rewardTask(taskIds);
}

//获取任务列表
async function getTaskList(o) {
    try {
        const options = {
            url: `/operation/action/tasklist`,
            type: 'post',
            dataType: "json",
            headers: { ..._headers, timestamp: Date.now() },
            body: o
        };
        //post方法
        let res = await fetch(options);
        if (!(res?.returnCode == 0 || res?.returnCode == '-105203')) throw new Error(res?.returnMsg);
        return res?.data?.taskList;
    } catch (e) {
        $.ckStatus = false;
        $.log(`⛔️ 签到:${e}`);
    }
}
//查询用户信息
async function getUserInfo() {
    try {
        const opts = {
            url: `/userprofile/managementprofile`,
            type: 'post',
            dataType: "json",
            body: { userId: _headers.userid }
        };
        //post方法
        let res = await fetch(opts);
        if (res?.returnCode != 0) throw new Error(res?.returnMsg || `调用失败`);
        return res?.data?.profile;
    } catch (e) {
        $.log(`⛔️ 获取资讯:${e}`);
    }
}
//获取资讯
async function getNews() {
    try {
        const opts = {
            url: `/info/listinfov2`,
            type: 'post',
            dataType: "json",
            body: { "page": 0, "channelId": 25818 }
        };
        //post方法
        let res = await fetch(opts);
        if (res?.returnCode != 0) throw new Error(res?.returnMsg || `调用失败`);
        let newItem = res?.data?.list.find(newItem => newItem.infoContent);
        return newItem.infoContent.infoId;
    } catch (e) {
        $.log(`⛔️ 获取资讯:${e}`);
    }
}
//浏览资讯
async function taskNews(infoId) {
    try {
        const opts = {
            url: `https://ssl.kohsocialapp.qq.com:10001/game/detailinfov3`,
            type: 'post',
            headers: {
                'User-Agent': `SmobaHelper/7.91.0925 (iPhone; iOS 14.8; Scale/2.00)`,
                'Content-Type': `application/x-www-form-urlencoded`,
            },
            body: { gameId: "20001", iInfoId: infoId, token: _headers.token, userId: _headers.userid }
        };
        //post方法
        let res = await fetch(opts);
        if (res?.returnCode != 0) throw new Error(res?.returnMsg || `调用失败`);
        $.log(`️☑️ 浏览资讯:调用成功！`);
    } catch (e) {
        $.log(`⛔️ 浏览资讯资讯:${e}`);
    }
}
//点赞/取消点赞
async function taskLike(infoId, _type) {
    try {
        const opts = {
            url: `https://ssl.kohsocialapp.qq.com:10001/user/addlike`,
            type: 'post',
            headers: {
                'User-Agent': `SmobaHelper/7.91.0925 (iPhone; iOS 14.8; Scale/2.00)`,
                'Content-Type': `application/x-www-form-urlencoded`,
            },
            body: { gameId: "20001", iInfoId: infoId, like: _type, token: _headers.token, userId: _headers.userid }
        };
        //post方法
        let res = await fetch(opts);
        if (res?.returnCode != 0) throw new Error(res?.returnMsg || `调用失败`);
        $.log(`️☑️ 点赞/取消点赞:调用成功！`);
    } catch (e) {
        $.log(`⛔️ 点赞/取消点赞:${e}`);
    }
}
//领取奖励
async function rewardTask(ids) {
    try {
        const opts = {
            url: `/operation/action/rewardtask`,
            type: 'post',
            dataType: "json",
            headers: { ..._headers, timestamp: Date.now() },
            body: { "taskIds": ids, "cSystem": "ios", "h5Get": 1, "roleId": _headers.camproleid }
        };
        //post方法
        let res = await fetch(opts);
        if (res?.returnCode != 0) throw new Error(res?.returnMsg || `调用失败`);
        $.log(`️☑️ 一键领取奖励:调用成功！`);
    } catch (e) {
        $.log(`⛔️ 一键领取奖励:${e}`);
    }
}
//执行任务
async function doTask(obj) {
    try {
        const opts = {
            url: `https://ssl.kohsocialapp.qq.com:10001/play/gettaskconditiondata`,
            type: 'post',
            headers: {
                'User-Agent': `SmobaHelper/7.91.0925 (iPhone; iOS 14.8; Scale/2.00)`,
                'Content-Type': `application/x-www-form-urlencoded`,
            },
            body: obj.body
        };
        //post方法
        let res = await fetch(opts);
        if (res?.returnCode != 0) throw new Error(res?.returnMsg || `调用失败`);
        $.log(`️☑️ ${obj.name}:调用成功`);
    } catch (e) {
        $.log(`⛔️ ${obj.name}:${e}`);
    }
}

//获取Cookie
async function getCookie() {
    try {
        if ($request && $request.method === 'OPTIONS') return;

        const header = ObjectKeys2LowerCase($request.headers) ?? $.msg($.name, `⛔️ script run error!`, `错误的运行方式，请切换到cron环境`);
        const userId = header?.userid;
        if (!(header && userId)) throw new Error("获取token失败！请检查配置是否正确");

        const newData = {
            "userId": userId,
            "token": header,
            "userName": userId,
        }

        const index = userCookie.findIndex(e => e.userId == newData.userId);
        userCookie[index] ? userCookie[index] = newData : userCookie.push(newData);

        $.setjson(userCookie, ckName);
        $.msg($.name, `🎉${newData.userName}更新token成功!`, ``);

    } catch (e) {
        throw e;
    }
}
//主程序执行入口
!(async () => {
    try {
        if (typeof $request != "undefined") {
            await getCookie();
        } else {
            await main();
        }
    } catch (e) {
        throw e;
    }
})()
    .catch((e) => { $.logErr(e), $.msg($.name, `⛔️ script run error!`, e.message || e) })
    .finally(async () => {
        $.done({ ok: 1 });
    });

/** ---------------------------------固定不动区域----------------------------------------- */
//prettier-ignore
async function sendMsg(a) { a && ($.isNode() ? await notify.sendNotify($.name, a) : $.msg($.name, $.title || "", a, { "media-url": $.avatar })) }
function DoubleLog(o) { o && ($.log(`${o}`), $.notifyMsg.push(`${o}`)) };
function debug(g, e = "debug") { "true" === $.is_debug && ($.log(`\n-----------${e}------------\n`), $.log("string" == typeof g ? g : $.toStr(g) || `debug error => t=${g}`), $.log(`\n-----------${e}------------\n`)) }
//From xream's ObjectKeys2LowerCase
function ObjectKeys2LowerCase(obj) { return !obj ? {} : Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])) };
//From sliverkiss's Request
async function Request(t) { "string" == typeof t && (t = { url: t }); try { if (!t?.url) throw new Error("[发送请求] 缺少 url 参数"); let { url: o, type: e, headers: r = {}, body: s, params: a, dataType: n = "form", resultType: u = "data" } = t; const p = e ? e?.toLowerCase() : "body" in t ? "post" : "get", c = o.concat("post" === p ? "?" + $.queryStr(a) : ""), i = t.timeout ? $.isSurge() ? t.timeout / 1e3 : t.timeout : 1e4; "json" === n && (r["Content-Type"] = "application/json;charset=UTF-8"); const y = s && "form" == n ? $.queryStr(s) : $.toStr(s), l = { ...t, ...t?.opts ? t.opts : {}, url: c, headers: r, ..."post" === p && { body: y }, ..."get" === p && a && { params: a }, timeout: i }, m = $.http[p.toLowerCase()](l).then((t => "data" == u ? $.toObj(t.body) || t.body : $.toObj(t) || t)).catch((t => $.log(`❌请求发起失败！原因为：${t}`))); return Promise.race([new Promise(((t, o) => setTimeout((() => o("当前请求已超时")), i))), m]) } catch (t) { console.log(`❌请求发起失败！原因为：${t}`) } }
//From chavyleung's Env.js
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise(((e, r) => { s.call(this, t, ((t, s, a) => { t ? r(t) : e(s) })) })) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; if (this.getdata(t)) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e => { this.get({ url: t }, ((t, s, r) => e(r))) })) } runScript(t, e) { return new Promise((s => { let r = this.getdata("@chavy_boxjs_userCfgs.httpapi"); r = r ? r.replace(/\n/g, "").trim() : r; let a = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); a = a ? 1 * a : 20, a = e && e.timeout ? e.timeout : a; const [i, o] = r.split("@"), n = { url: `http://${o}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: a }, headers: { "X-Key": i, Accept: "*/*" }, timeout: a }; this.post(n, ((t, e, r) => s(r))) })).catch((t => this.logErr(t))) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), r = !s && this.fs.existsSync(e); if (!s && !r) return {}; { const r = s ? t : e; try { return JSON.parse(this.fs.readFileSync(r)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), r = !s && this.fs.existsSync(e), a = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, a) : r ? this.fs.writeFileSync(e, a) : this.fs.writeFileSync(t, a) } } lodash_get(t, e, s = void 0) { const r = e.replace(/\[(\d+)\]/g, ".$1").split("."); let a = t; for (const t of r) if (a = Object(a)[t], void 0 === a) return s; return a } lodash_set(t, e, s) { return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce(((t, s, r) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[r + 1]) >> 0 == +e[r + 1] ? [] : {}), t)[e[e.length - 1]] = s), t } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, r] = /^@(.*?)\.(.*?)$/.exec(t), a = s ? this.getval(s) : ""; if (a) try { const t = JSON.parse(a); e = t ? this.lodash_get(t, r, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, r, a] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(r), o = r ? "null" === i ? null : i || "{}" : "{}"; try { const e = JSON.parse(o); this.lodash_set(e, a, t), s = this.setval(JSON.stringify(e), r) } catch (e) { const i = {}; this.lodash_set(i, a, t), s = this.setval(JSON.stringify(i), r) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, ((t, s, r) => { !t && s && (s.body = r, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, r) })); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: r, headers: a, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: r, headers: a, body: i, bodyBytes: o }, i, o) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", ((t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } })).then((t => { const { statusCode: r, statusCode: a, headers: i, rawBody: o } = t, n = s.decode(o, this.encoding); e(null, { status: r, statusCode: a, headers: i, rawBody: o, body: n }, n) }), (t => { const { message: r, response: a } = t; e(r, a, a && s.decode(a.rawBody, this.encoding)) })) } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, ((t, s, r) => { !t && s && (s.body = r, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, r) })); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: r, headers: a, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: r, headers: a, body: i, bodyBytes: o }, i, o) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let r = require("iconv-lite"); this.initGotEnv(t); const { url: a, ...i } = t; this.got[s](a, i).then((t => { const { statusCode: s, statusCode: a, headers: i, rawBody: o } = t, n = r.decode(o, this.encoding); e(null, { status: s, statusCode: a, headers: i, rawBody: o, body: n }, n) }), (t => { const { message: s, response: a } = t; e(s, a, a && r.decode(a.rawBody, this.encoding)) })) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let r = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in r) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? r[e] : ("00" + r[e]).substr(("" + r[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let r = t[s]; null != r && "" !== r && ("object" == typeof r && (r = JSON.stringify(r)), e += `${s}=${r}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", r = "", a) { const i = t => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: return { url: t.url || t.openUrl || t["open-url"] }; case "Loon": return { openUrl: t.openUrl || t.url || t["open-url"], mediaUrl: t.mediaUrl || t["media-url"] }; case "Quantumult X": return { "open-url": t["open-url"] || t.url || t.openUrl, "media-url": t["media-url"] || t.mediaUrl, "update-pasteboard": t["update-pasteboard"] || t.updatePasteboard }; case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, r, i(a)); break; case "Quantumult X": $notify(e, s, r, i(a)); case "Node.js": }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), r && t.push(r), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, t.stack) } } wait(t) { return new Promise((e => setTimeout(e, t))) } done(t = {}) { const e = ((new Date).getTime() - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }