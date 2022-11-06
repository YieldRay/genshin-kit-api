//! This ships a single node:http createServer requrestListener
//! which can run on Vercel

const { GenshinKit, util: GK_Utils } = require("@genshin-kit/core");
const gk = new GenshinKit();

const AllowOriginMiddleWare = (req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") res.sendStatus(200).end();
    else next();
};

const LoginMiddleware = (req, res, next) => {
    const cookie = req.body.cookie || process.env.COOKIE;
    const server = req.body.server === "os" ? "os" : "cn";
    const locate = req.body.locate;
    if (!cookie) {
        res.sendStatus(401);
        res.send();
    } else {
        gk.loginWithCookie(cookie);
        gk.setServerType(server);
        if (
            [
                "zh-cn",
                "zh-tw",
                "de-de",
                "en-us",
                "es-es",
                "fr-fr",
                "id-id",
                "ja-jp",
                "ko-kr",
                "pt-pt",
                "ru-ru",
                "th-th",
                "vi-vn",
            ].includes(locate)
        )
            gk.setServerLocale(locate);
        next();
    }
};

const UidCheckMiddleware = (req, res, next) => {
    const uid = Number(req.body.uid);
    if (GK_Utils.isValidCnUid(uid)) {
        req.uid = uid;
        next();
    } else {
        res.sendStatus(400);
        res.send();
    }
};

const middlewares = [AllowOriginMiddleWare, LoginMiddleware, UidCheckMiddleware];

const handlers = {
    async getUserInfo(req, res) {
        const uid = req.uid;
        res.json(await gk.getUserInfo(uid, Boolean(req.body.noCache)));
    },

    async getAllCharacters(req, res) {
        const uid = req.uid;
        res.json(await gk.getAllCharacters(uid, Boolean(req.body.noCache)));
    },

    async getActivities(req, res) {
        const uid = req.uid;
        res.json(await gk.getActivities(uid, Boolean(req.body.noCache)));
    },
    async getSpiralAbyss(req, res) {
        const uid = req.uid;
        const type = (() => {
            // type 1 代表当期，2 代表上一期
            if (req.body.type == "1") return 1;
            if (req.body.type == "2") return 2;
        })();
        res.json(await gk.getSpiralAbyss(uid, type, Boolean(req.body.noCache)));
    },
    async getCurrentAbyss(req, res) {
        const uid = req.uid;
        res.json(await gk.getCurrentAbyss(uid, Boolean(req.body.noCache)));
    },

    async getPreviousAbyss(req, res) {
        const uid = req.uid;
        res.json(await gk.getPreviousAbyss(uid, Boolean(req.body.noCache)));
    },
};

function toStringTag(data) {
    return Object.prototype.toString.call(data).slice(8, -1);
}
const isPromise = (data) => toStringTag(data) === "Promise";

module.exports = async function (req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams;
    let q = params.get("q") ?? "";
    if (q.startsWith("/")) q = q.slice(1);

    // 补丁一下使用到的express方法
    res.sendStatus = function (code) {
        res.statusCode = code;
        return res;
    };
    res.send = function (...args) {
        res.end(...args);
    };
    res.json = function (json) {
        res.end(JSON.stringify(json));
    };
    res.set = res.setHeader;
    res.get = res.getHeader;

    if (req.method === "POST") {
        await new Promise((rs, rj) => {
            let post = "";
            req.on("data", (chunk) => (post += chunk));
            req.on("end", () => {
                try {
                    req.body = JSON.parse(post);
                } catch (e) {
                    rj(e);
                }
                rs();
            });
            req.on("error", rj);
        });
    } else {
        req.body = {};
    }

    try {
        for (const f of middlewares) {
            let breakLabel = true;
            const result = f(
                req,
                res,
                () => (breakLabel = false) // call next(), will exit all other middlewares
            );
            if (isPromise(result)) await result; // wait Promise
            if (breakLabel) break;
        }

        if (Reflect.has(handlers, q)) {
            const f = Reflect.get(handlers, q);
            const result = f(req, res);
            if (isPromise(result)) await result;
        }
    } catch (e) {
        console.error(new Date().toLocaleString(), url.toString(), e);
    }
};
