/*
 * 老百姓大药房多账号自动签到脚本 - 最终修复版
 * 解决了 Task 模式下因异步作用域问题导致的 'A JavaScript exception occurred' 报错。
 * 所有执行逻辑已被包装在立即执行的 async 函数中。
[rewrite_local]
^https:\/\/mall\.lbxcn\.com\/mall\/scc-point-member\/crm-api\/bonus\/sign-in url script-request-body https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/Plugin/lbxdyf.js

[task_local]
1 0 * * * https://raw.githubusercontent.com/Maoshijin/wenjian/refs/heads/main/Plugin/lbxdyf.js, tag=老百姓大药房签到, enabled=true

[MITM]
hostname = mall.lbxcn.com


 */

const OLD_KEY = "lbx_signin_data";      // 旧的单账号存储键
const ACCOUNTS_KEY = "lbx_signin_accounts"; // 新的多账号存储键
const SIGN_URL = "https://mall.lbxcn.com/mall/scc-point-member/crm-api/bonus/sign-in";

// 固定的修正参数
const FIXED_STORE_ID = "10679";
const FIXED_TEMPLATE_ID = "dkCMsRonTC05TJlIPlvIv7bPgqq9CDBzYMqF2Jof9jY";

/**
 * 迁移旧的单账号数据到多账号数组中
 */
function migrateOldData(accounts) {
    const oldData = $prefs.valueForKey(OLD_KEY);
    if (oldData) {
        // 尝试移除旧键，不管迁移是否成功，确保只迁移一次
        $prefs.removeValueForKey(OLD_KEY); 
        try {
            const info = JSON.parse(oldData);
            
            let memberId = "Unknown ID (Migrated)";
            try {
                const bodyObj = JSON.parse(info.body);
                memberId = bodyObj.memberId || memberId;
            } catch (e) {
                // Ignore body parse error for migration notification
            }

            // 检查是否已存在
            const isExist = accounts.some(acc => {
                try {
                    const accBodyObj = JSON.parse(acc.body);
                    return accBodyObj.memberId === memberId && memberId !== "Unknown ID (Migrated)";
                } catch (e) { return false; }
            });

            if (!isExist) {
                accounts.push(info);
                $notify("老百姓大药房 - 数据迁移", "✅ 成功迁移旧账户参数", `会员ID: ${memberId}`);
            }
        } catch (e) {
            $notify("老百姓大药房 - 数据迁移失败", "❌ 无法解析旧数据", e.toString());
        }
    }
    return accounts;
}


if ($request) {
    // --- 模式 1: 捕获模式 (数据保存和更新) ---
    let accounts = JSON.parse($prefs.valueForKey(ACCOUNTS_KEY) || "[]");
    accounts = migrateOldData(accounts);
    
    const newAccount = {
        url: $request.url,
        method: $request.method,
        headers: $request.headers,
        body: $request.body || ""
    };
    
    let memberId = "Unknown ID";
    try {
        const bodyObj = JSON.parse(newAccount.body);
        memberId = bodyObj.memberId || "Unknown ID";
    } catch (e) {
        // ...
    }

    const index = accounts.findIndex(acc => {
        try {
            if (typeof acc.body !== 'string' || acc.body === "") return false;
            const accBodyObj = JSON.parse(acc.body);
            return accBodyObj.memberId === memberId && memberId !== "Unknown ID";
        } catch (e) { return false; }
    });

    let action = "新增";
    if (index !== -1) {
        accounts[index] = newAccount;
        action = "更新";
    } else if (memberId !== "Unknown ID") {
        accounts.push(newAccount);
    } else {
        $notify("老百姓大药房 - 参数捕获失败", `⚠️ 无法识别会员ID`, `请确保已登录并重试。`);
        $done({});
        return;
    }

    $prefs.setValueForKey(JSON.stringify(accounts), ACCOUNTS_KEY);
    
    const headersString = JSON.stringify(newAccount.headers, null, 2).slice(0, 150) + "...";
    $notify(
        `老百姓大药房 - 账户 ${action}`, 
        `Member ID: ${memberId} (共 ${accounts.length} 个)`, 
        `Body: ${newAccount.body}`
    );
    $done({});

} else {
    // --- 模式 2: 执行模式 (Task/Cron) ---
    // 强制包装在 async IIFE 中，解决异步作用域问题
    (async function() { 
        let accounts = JSON.parse($prefs.valueForKey(ACCOUNTS_KEY) || "[]");
        accounts = migrateOldData(accounts); 
        
        if (accounts.length === 0) {
            $notify("老百姓大药房", "❌ 任务终止", "没有捕获到任何账户信息。");
            $done();
            return;
        }

        let results = [];
        
        for (const [index, info] of accounts.entries()) {
            let memberIdDisplay = `[${index + 1}]`;

            // 1. 解析和修补 Body
            let bodyObj = {};
            try {
                if (typeof info.body !== 'string' || info.body === "") {
                    throw new Error("Body is empty.");
                }
                bodyObj = JSON.parse(info.body);
                memberIdDisplay = bodyObj.memberId || memberIdDisplay;
            } catch (e) {
                results.push(`❌ 账户 ${memberIdDisplay}: Body 解析失败。`);
                continue;
            }

            // 2. 注入固定参数并构造请求
            bodyObj.storeId = FIXED_STORE_ID;
            bodyObj.templateId = FIXED_TEMPLATE_ID;

            const request = {
                url: SIGN_URL,
                method: "POST",
                headers: info.headers,
                body: JSON.stringify(bodyObj)
            };
            
            // 3. 执行签到请求
            try {
                const response = await $task.fetch(request);
                const obj = JSON.parse(response.body);

                if (obj.code === 0) {
                    const days = obj.data?.consecutiveDay ?? "?";
                    const bonus = obj.data?.bonus ?? "?";
                    results.push(`✅ 账户 ${memberIdDisplay}: 签到成功, 连签${days}天, 积分+${bonus}`);
                } else if (obj.code === 1048) {
                    results.push(`🟡 账户 ${memberIdDisplay}: 当日已签到。`);
                } else if (obj.message) {
                    results.push(`❌ 账户 ${memberIdDisplay}: 签到失败, ${obj.message}`);
                } else {
                    results.push(`⚠️ 账户 ${memberIdDisplay}: 返回未知结果 (Code: ${obj.code}).`);
                }
            } catch (err) {
                results.push(`❌ 账户 ${memberIdDisplay}: 网络请求失败。`);
            }
        }

        // 4. 汇总通知
        const summary = results.join("\n");
        $notify(
            `老百姓大药房 - 多账号签到 (${accounts.length}个)`,
            `共执行 ${accounts.length} 次任务。`,
            summary
        );
        
        $done();
    })().catch(e => {
        // 捕获脚本运行中发生的任何未预期错误
        $notify("老百姓大药房 - 致命错误", "脚本执行失败", `请检查日志: ${e.message}`);
        $done();
    });
}
