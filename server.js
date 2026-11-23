import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { chromium } from "playwright";

dotenv.config();
const production = process.env.NODE_ENV === "production";
const required = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "SESSION_SECRET", "ALLOWED_ORIGIN"];
if (production) {
  const missing = required.filter((key) => !process.env[key] || process.env[key].length < (key === "SESSION_SECRET" ? 32 : 1));
  if (missing.length) throw new Error("Missing/weak production environment variables: " + missing.join(", "));
}
const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const user = process.env.ADMIN_USERNAME || "admin";
const pass = process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";
const secret = process.env.SESSION_SECRET || "dev-only-change-me";
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const allowedHosts = new Set((process.env.BROWSER_ALLOWED_HOSTS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
const sessions = new Map();
const loginAttempts = new Map();
const logs = [];
const SESSION_TTL = 8 * 60 * 60 * 1000;

const tools = [
  { id: "browser", name: "浏览器自动化", desc: "受域名白名单限制的网页访问与截图", status: "Playwright 已集成", enabled: true },
  { id: "terminal", name: "终端执行", desc: "隔离环境中的受控命令执行", status: "尚未接入", enabled: false },
  { id: "files", name: "文件处理", desc: "工作区文件读取、转换与打包", status: "待接入执行适配器", enabled: false },
  { id: "github", name: "GitHub 工作流", desc: "仓库检查、代码提交与 CI", status: "ChatGPT GitHub 连接器可用", enabled: true },
  { id: "image", name: "图像处理", desc: "图片生成、编辑与素材处理", status: "通过可用图像工具调用", enabled: true }
];

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Session-Id"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(dir, "public")));

const log = (action, detail = "") => {
  logs.unshift({ time: new Date().toISOString(), action, detail });
  logs.splice(100);
};
const tokenDigest = (id) => crypto.createHmac("sha256", secret).update(id).digest("hex");
const guard = (req, res, next) => {
  const id = req.headers["x-session-id"];
  const session = id && sessions.get(id);
  if (!session || session.digest !== tokenDigest(id) || session.expiresAt < Date.now()) {
    if (id) sessions.delete(id);
    return res.status(401).json({ error: "登录已失效，请重新登录" });
  }
  session.expiresAt = Date.now() + SESSION_TTL;
  next();
};
const blockedAddress = (address) => {
  try {
    const parsed = ipaddr.parse(address);
    return parsed.range() !== "unicast";
  } catch {
    return true;
  }
};
const hostnameAllowed = (hostname) => allowedHosts.has(hostname.toLowerCase());
async function validatePublicTarget(url) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
  if (!hostnameAllowed(url.hostname)) return false;
  if (ipaddr.isValid(url.hostname)) return !blockedAddress(url.hostname);
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  return records.length > 0 && records.every((record) => !blockedAddress(record.address));
};

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "AI-WORK-TOOLS", uptime: Math.round(process.uptime()) }));

app.post("/api/login", (req, res) => {
  const key = req.ip;
  const attempts = loginAttempts.get(key) || { count: 0, until: 0 };
  if (attempts.until > Date.now() && attempts.count >= 8) return res.status(429).json({ error: "尝试次数过多，请稍后再试" });
  if (req.body.username !== user || req.body.password !== pass) {
    attempts.count += 1;
    if (attempts.count >= 8) attempts.until = Date.now() + 15 * 60 * 1000;
    loginAttempts.set(key, attempts);
    log("登录失败");
    return res.status(401).json({ error: "账号或密码错误" });
  }
  loginAttempts.delete(key);
  const id = crypto.randomUUID();
  sessions.set(id, { digest: tokenDigest(id), expiresAt: Date.now() + SESSION_TTL });
  log("管理员登录", user);
  res.json({ ok: true, sessionId: id, user });
});

app.post("/api/logout", guard, (req, res) => {
  sessions.delete(req.headers["x-session-id"]);
  log("退出登录");
  res.json({ ok: true });
});
app.get("/api/admin/overview", guard, (_req, res) => res.json({
  uptime: Math.round(process.uptime()), toolCount: tools.length,
  enabledCount: tools.filter((item) => item.enabled).length, tools, logs: logs.slice(0, 8)
}));
app.get("/api/admin/tools", guard, (_req, res) => res.json({ tools }));
app.patch("/api/admin/tools/:id", guard, (req, res) => {
  const tool = tools.find((item) => item.id === req.params.id);
  if (!tool) return res.status(404).json({ error: "工具不存在" });
  if (typeof req.body.enabled !== "boolean") return res.status(400).json({ error: "enabled 必须为布尔值" });
  if (req.body.enabled && tool.status.includes("尚未接入")) return res.status(409).json({ error: "该工具尚未接入执行适配器" });
  tool.enabled = req.body.enabled;
  log("工具状态更新", tool.name);
  res.json({ ok: true, tool });
});
app.get("/api/admin/logs", guard, (_req, res) => res.json({ logs }));

app.post("/api/admin/browser/screenshot", guard, async (req, res) => {
  let target;
  try { target = new URL(req.body.url); } catch { return res.status(400).json({ error: "请输入有效网址" }); }
  try {
    if (!allowedHosts.size || !(await validatePublicTarget(target))) {
      return res.status(403).json({ error: "目标域名未加入 BROWSER_ALLOWED_HOSTS 白名单，或解析到非公网地址" });
    }
  } catch {
    return res.status(400).json({ error: "无法安全验证目标域名" });
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route("**/*", async (route) => {
      try {
        const requestUrl = new URL(route.request().url());
        if (!(await validatePublicTarget(requestUrl))) return route.abort("blockedbyclient");
        return route.continue();
      } catch {
        return route.abort("blockedbyclient");
      }
    });
    const page = await context.newPage();
    await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 20000 });
    const title = await page.title();
    const screenshot = await page.screenshot({ type: "jpeg", quality: 70 });
    log("浏览器截图", target.hostname);
    res.json({ ok: true, title, url: page.url(), screenshot: "data:image/jpeg;base64," + screenshot.toString("base64") });
  } catch (error) {
    log("浏览器任务失败", String(error.message).slice(0, 120));
    res.status(500).json({ error: "浏览器执行失败: " + String(error.message).slice(0, 160) });
  } finally {
    if (browser) await browser.close();
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(dir, "public/index.html")));
app.listen(port, () => {
  console.log("AI-WORK-TOOLS on " + port);
  if (!production && pass === "CHANGE_THIS_PASSWORD") console.warn("开发默认密码仍在使用；正式部署必须设置环境变量");
  log("服务启动");
});
