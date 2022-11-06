const isRunkitEnv = process.env.RUNKIT_MOUNT_PATH && process.env.RUNKIT_ENDPOINT_URL;
const isDeta = process.env.DETA_PATH;

const express = require("express");
const express_runkit = isRunkitEnv && require("@runkit/runkit/express-endpoint/1.0.0");
require("express-async-errors");
const app = isRunkitEnv ? express_runkit(exports) : express();

app.set("x-powered-by", false);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const { GenshinKit, util: GK_Utils } = require("@genshin-kit/core");
const gk = new GenshinKit();

const AllowOriginMiddleWare = (req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    next();
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

const CacheMiddleWare = (req, res, next) => {
    res.set("Cache-Control", Boolean(req.body.noCache) ? "no-cache" : `max-age=${60 * 60}`); // 1h
    next();
};

const sendDocument =
    ({ title, head = "", content }) =>
    (req, res) => {
        res.set("Content-Type", "text/html; charset=utf-8");
        res.send(
            `<!DOCTYPE html><html><title>${
                title || req.path
            }</title><style>*{font-family:Consolas,monospace}pre{font-size:16px}</style>\n${head}<pre>\n${content}\n</pre></html>`
        );
    };

app.options("/*", AllowOriginMiddleWare, (req, res) => res.status(200).send());

app.use(AllowOriginMiddleWare, CacheMiddleWare);

app.get(
    "/",
    sendDocument({
        title: "Genshin API",
        head: `<div style="font-size:2rem;padding:0">API based on <mark>@genshin-kit/core</mark></div>`,
        content: `To keep cookie safe, only POST is allowed
Accept application/json & application/x-www-form-urlencoded
401 Unauthorized: Cookie is invalid
400 Bad Request: Uid is invalid

POST /getUserInfo
POST /getAllCharacters
POST /getActivities
POST /getSpiralAbyss
POST /getCurrentAbyss
POST /getPreviousAbyss

common params: {cookie: "xxxxx", uid: 10001001 ,server: "cn"/"os"(default "cn"), noCache: true(default false)}`,
    })
);

app.use("/get*", LoginMiddleware, UidCheckMiddleware);

app.post("/getDailyNote", async (req, res) => {
    const uid = req.uid;
    res.json(await gk.getDailyNote(uid, Boolean(req.body.noCache)));
});

app.post("/getUserInfo", async (req, res) => {
    const uid = req.uid;
    res.json(await gk.getUserInfo(uid, Boolean(req.body.noCache)));
});

app.post("/getAllCharacters", async (req, res) => {
    const uid = req.uid;
    res.json(await gk.getAllCharacters(uid, Boolean(req.body.noCache)));
});

app.post("/getActivities", async (req, res) => {
    const uid = req.uid;
    res.json(await gk.getActivities(uid, Boolean(req.body.noCache)));
});

app.post("/getSpiralAbyss", async (req, res) => {
    const uid = req.uid;
    const type = (() => {
        // type 1 代表当期，2 代表上一期
        if (req.body.type == "1") return 1;
        if (req.body.type == "2") return 2;
    })();
    res.json(await gk.getSpiralAbyss(uid, type, Boolean(req.body.noCache)));
});

// shortcut for SpiralAbyss
app.post("getCurrentAbyss", async (req, res) => {
    const uid = req.uid;
    res.json(await gk.getCurrentAbyss(uid, Boolean(req.body.noCache)));
});

app.post("getPreviousAbyss", async (req, res) => {
    const uid = req.uid;
    res.json(await gk.getPreviousAbyss(uid, Boolean(req.body.noCache)));
});

// error handler
app.use((err, req, res, next) => {
    console.error(new Date().toLocaleString(), err);
    res.status(500);
    res.json(err);
});

module.exports = app;
if (!isRunkitEnv && !isDeta) {
    const PORT = process.env.PORT || 8888;
    console.log(`App listen at http://localhost:${PORT}`);
    app.listen(PORT);
}
