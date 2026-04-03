#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const STATE_FILE = path.join(DATA_DIR, "browser-state.json");
const COOKIES_FILE = path.join(DATA_DIR, "cookies.json");
const TOKEN_FILE = path.join(DATA_DIR, "user-token.json");
const SCAN_TOKEN_FILE = path.join(DATA_DIR, "scan-token.json");
const STATUS_FILE = path.join(DATA_DIR, "login-status.json");
const FEEDBACK_QUEUE_FILE = path.join(DATA_DIR, "feedback-queue.jsonl");
const PID_FILE = path.join(DATA_DIR, "login-worker.pid");
const QR_IMAGE_FILE = path.join(OUTPUT_DIR, "login-qrcode.png");
const QR_BASE64_FILE = path.join(DATA_DIR, "login-qrcode.txt");
const WORKER_LOG_FILE = path.join(DATA_DIR, "login-worker.log");
const LOGIN_URL = "https://pc.eshetang.com/account/login?redirect=%2F";
const HOME_URL = "https://pc.eshetang.com/";
const ACCOUNT_LIST_PATH = "/account/list";
const DEFAULT_TIMEOUT_SECONDS = 240;
const QR_SELECTOR = 'img[alt="qrcode"]';
const USER_TOKEN_COOKIE = "userToken";
let shutdownRequested = false;

async function main() {
  try {
    await ensureDirs();

    const command = process.argv[2] || "help";
    const rawArgs = process.argv[3];
    const args = parseJsonArgs(rawArgs);

    switch (command) {
      case "help":
        return printJson({
          ok: true,
          tools: [
            "check_login_status",
            "get_login_qrcode",
            "list_shops",
            "select_shop",
            "get_user_token",
            "delete_session",
            "report_unsatisfied_request"
          ]
        });
      case "check_login_status":
        return printJson(await checkLoginStatus(args));
      case "get_login_qrcode":
        return printJson(await getLoginQrcode(args));
      case "list_shops":
        return printJson(await listShops(args));
      case "select_shop":
        return printJson(await selectShop(args));
      case "get_user_token":
        return printJson(await getUserToken(args));
      case "delete_session":
        return printJson(await deleteSession(args));
      case "report_unsatisfied_request":
        return printJson(await reportUnsatisfiedRequest(args));
      case "__qr_worker":
        await runQrWorker(args);
        return;
      default:
        fail(`unknown command: ${command}`);
    }
  } catch (error) {
    printJson({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  }
}

function parseJsonArgs(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`invalid JSON args: ${error.message}`);
  }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  throw new Error(message);
}

async function ensureDirs() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const content = await fsp.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, text) {
  await fsp.writeFile(filePath, text, "utf8");
}

async function appendText(filePath, text) {
  await fsp.appendFile(filePath, text, "utf8");
}

function getScanTokenFromUrl(urlString) {
  if (!urlString) {
    return null;
  }
  try {
    const url = new URL(urlString);
    return url.searchParams.get("token") || url.searchParams.get("userToken");
  } catch {
    return null;
  }
}

async function resolveScanToken(args = {}) {
  if (typeof args.scan_token === "string" && args.scan_token.trim()) {
    return args.scan_token.trim();
  }

  const savedScanToken = await readJson(SCAN_TOKEN_FILE, null);
  if (savedScanToken && typeof savedScanToken.scanToken === "string" && savedScanToken.scanToken.trim()) {
    return savedScanToken.scanToken.trim();
  }

  const status = await readJson(STATUS_FILE, null);
  const fromStatus = getScanTokenFromUrl(status && status.currentUrl);
  if (fromStatus) {
    return fromStatus;
  }

  return null;
}

async function apiGetJson(pathname, query = {}) {
  const url = new URL(pathname, "https://bff.eshetang.com");
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "accept": "application/json, text/plain, */*",
      "origin": "https://pc.eshetang.com",
      "referer": "https://pc.eshetang.com/"
    }
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`unexpected non-json response from ${url.pathname}`);
  }

  return {
    ok: response.ok,
    status: response.status,
    body: data
  };
}

async function validateFinalUserToken(userToken) {
  if (!userToken) {
    return false;
  }

  const result = await apiGetJson("/account/v3/multiple/account/list", {
    userToken
  });

  return result.ok && result.body && result.body.code === 200;
}

async function removeFile(filePath) {
  try {
    await fsp.rm(filePath, { force: true });
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function safeDateString(date = new Date()) {
  return date.toISOString();
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isWorkerRunning() {
  const pid = await readPid();
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    await removeFile(PID_FILE);
    return false;
  }
}

async function readPid() {
  try {
    const raw = await fsp.readFile(PID_FILE, "utf8");
    const pid = Number(raw.trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writePid(pid) {
  await writeText(PID_FILE, `${pid}\n`);
}

async function getSavedCookies() {
  const cookies = await readJson(COOKIES_FILE, []);
  return Array.isArray(cookies) ? cookies : [];
}

function extractUserTokenFromCookies(cookies) {
  return cookies.find((cookie) => cookie && cookie.name === USER_TOKEN_COOKIE) || null;
}

async function getSavedToken() {
  const tokenInfo = await readJson(TOKEN_FILE, null);
  if (tokenInfo && tokenInfo.userToken) {
    return tokenInfo;
  }

  const cookie = extractUserTokenFromCookies(await getSavedCookies());
  if (!cookie || !cookie.value) {
    return null;
  }

  return {
    userToken: cookie.value,
    domain: cookie.domain || null,
    expires: cookie.expires || null,
    source: "cookies.json",
    updatedAt: safeDateString()
  };
}

async function saveSessionArtifacts(context, extra = {}) {
  const state = await context.storageState();
  const cookies = state.cookies || [];
  const tokenCookie = extractUserTokenFromCookies(cookies);

  await writeJson(STATE_FILE, state);
  await writeJson(COOKIES_FILE, cookies);

  if (tokenCookie && tokenCookie.value) {
    await writeJson(TOKEN_FILE, {
      userToken: tokenCookie.value,
      domain: tokenCookie.domain || null,
      expires: tokenCookie.expires || null,
      updatedAt: safeDateString(),
      ...extra
    });
  }

  return tokenCookie;
}

async function launchContext(options = {}) {
  const {
    headless = true,
    useStorageState = true
  } = options;

  const browser = await chromium.launch({ headless });
  const contextOptions = {};
  if (useStorageState && fileExists(STATE_FILE)) {
    contextOptions.storageState = STATE_FILE;
  }
  const context = await browser.newContext(contextOptions);
  return { browser, context };
}

function inferLoginPhase(currentUrl, tokenCookie) {
  if (tokenCookie && tokenCookie.value) {
    return "logged_in";
  }
  if (currentUrl.includes(ACCOUNT_LIST_PATH)) {
    return "waiting_for_shop_selection";
  }
  if (currentUrl.includes("/account/login")) {
    return "waiting_for_scan";
  }
  return "unknown";
}

async function checkLoginStatus() {
  const savedToken = await getSavedToken();
  if (!savedToken) {
    const workerRunning = await isWorkerRunning();
    const status = await readJson(STATUS_FILE, null);
    return {
      ok: true,
      isLoggedIn: false,
      status: workerRunning ? "waiting_for_scan" : "logged_out",
      qrcodePath: fileExists(QR_IMAGE_FILE) ? QR_IMAGE_FILE : null,
      lastStatus: status
    };
  }

  const { browser, context } = await launchContext({ headless: true, useStorageState: true });
  const page = await context.newPage();
  try {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await delay(1500);
    const cookies = await context.cookies();
    const cookie = extractUserTokenFromCookies(cookies);
    const currentUrl = page.url();
    const phase = inferLoginPhase(currentUrl, cookie);
    const isLoggedIn = phase === "logged_in";

    if (isLoggedIn) {
      await saveSessionArtifacts(context, { source: "check_login_status" });
    }

    return {
      ok: true,
      isLoggedIn,
      status: phase,
      currentUrl,
      userToken: isLoggedIn ? cookie.value : null,
      qrcodePath: fileExists(QR_IMAGE_FILE) ? QR_IMAGE_FILE : null
    };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

async function getLoginQrcode(args) {
  const status = await checkLoginStatus();
  if (status.isLoggedIn) {
    return {
      ok: true,
      isLoggedIn: true,
      userToken: status.userToken,
      message: "当前已登录，可直接使用 get_user_token。"
    };
  }

  if (!(await isWorkerRunning())) {
    await spawnQrWorker(args);
  }

  const ready = await waitForQrMaterial(20000);
  if (!ready) {
    fail("二维码尚未生成，请稍后重试。");
  }

  const qrBase64 = await fsp.readFile(QR_BASE64_FILE, "utf8");
  const latestStatus = await readJson(STATUS_FILE, null);

  return {
    ok: true,
    isLoggedIn: false,
    status: latestStatus ? latestStatus.status : "waiting_for_scan",
    timeout: latestStatus && latestStatus.timeoutSeconds ? `${latestStatus.timeoutSeconds}s` : `${DEFAULT_TIMEOUT_SECONDS}s`,
    qrcodePath: QR_IMAGE_FILE,
    img: qrBase64.trim(),
    message: "请使用易奢堂 APP 扫码登录，扫描成功后再调用 check_login_status 或 get_user_token。"
  };
}

async function listShops(args = {}) {
  const scanToken = await resolveScanToken(args);
  if (!scanToken) {
    return {
      ok: false,
      status: "missing_scan_token",
      message: "当前没有可用的扫码 token，请先执行 get_login_qrcode 并完成扫码。"
    };
  }

  const result = await apiGetJson("/account/v3/multiple/account/list", {
    userToken: scanToken
  });

  if (!result.ok || result.body.code !== 200) {
    return {
      ok: false,
      status: "list_shops_failed",
      scanToken,
      response: result.body
    };
  }

  const list = Array.isArray(result.body.data && result.body.data.list)
    ? result.body.data.list
    : [];

  await writeJson(SCAN_TOKEN_FILE, {
    scanToken,
    updatedAt: safeDateString()
  });

  await writeJson(STATUS_FILE, {
    ...(await readJson(STATUS_FILE, {})),
    status: list.length > 0 ? "waiting_for_shop_selection" : "no_shop_available",
    updatedAt: safeDateString(),
    currentUrl: `https://pc.eshetang.com/account/list?token=${scanToken}&redirect=%2F`,
    shops: list
  });

  return {
    ok: true,
    status: "waiting_for_shop_selection",
    scanToken,
    total: list.length,
    shops: list.map((shop, index) => ({
      index: index + 1,
      accountUserId: shop.accountUserId,
      enterpriseNo: shop.enterpriseNo,
      name: shop.name,
      provinceName: shop.provinceName || "",
      accountIsManager: shop.accountIsManager,
      accountUserIdentityTypeName: shop.accountUserIdentityTypeName || ""
    }))
  };
}

async function selectShop(args = {}) {
  const scanToken = await resolveScanToken(args);
  if (!scanToken) {
    return {
      ok: false,
      status: "missing_scan_token",
      message: "当前没有可用的扫码 token，请先执行 get_login_qrcode 并完成扫码。"
    };
  }

  let accountUserId = args.account_user_id;
  if (!accountUserId && Number.isInteger(args.shop_index)) {
    const shopsResult = await listShops({ scan_token: scanToken });
    if (!shopsResult.ok) {
      return shopsResult;
    }
    const matched = shopsResult.shops.find((shop) => shop.index === args.shop_index);
    if (!matched) {
      return {
        ok: false,
        status: "shop_not_found",
        message: `未找到编号为 ${args.shop_index} 的店铺。`
      };
    }
    accountUserId = matched.accountUserId;
  }

  if (!accountUserId && typeof args.enterprise_no === "string") {
    const shopsResult = await listShops({ scan_token: scanToken });
    if (!shopsResult.ok) {
      return shopsResult;
    }
    const matched = shopsResult.shops.find((shop) => shop.enterpriseNo === args.enterprise_no);
    if (!matched) {
      return {
        ok: false,
        status: "shop_not_found",
        message: `未找到店铺号为 ${args.enterprise_no} 的店铺。`
      };
    }
    accountUserId = matched.accountUserId;
  }

  if (!accountUserId) {
    return {
      ok: false,
      status: "missing_shop_selector",
      message: "请选择店铺后再继续，需要提供 account_user_id、shop_index 或 enterprise_no。"
    };
  }

  const loginResult = await apiGetJson("/account/v3/login/enterprise", {
    accountUserId,
    userToken: scanToken
  });

  if (!loginResult.ok || loginResult.body.code !== 200) {
    return {
      ok: false,
      status: "select_shop_failed",
      response: loginResult.body
    };
  }

  const userToken =
    loginResult.body &&
    loginResult.body.data &&
    loginResult.body.data.userToken;

  if (!userToken) {
    return {
      ok: false,
      status: "missing_user_token",
      response: loginResult.body
    };
  }

  const tokenInfo = {
    userToken,
    domain: ".pc.eshetang.com",
    source: "select_shop_api",
    updatedAt: safeDateString(),
    accountUserId,
    scanToken
  };
  await writeJson(TOKEN_FILE, tokenInfo);
  await writeJson(SCAN_TOKEN_FILE, {
    scanToken,
    updatedAt: safeDateString()
  });
  await writeJson(COOKIES_FILE, [
    {
      name: USER_TOKEN_COOKIE,
      value: userToken,
      domain: ".pc.eshetang.com",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      httpOnly: false,
      secure: false,
      sameSite: "Lax"
    }
  ]);
  await writeJson(STATUS_FILE, {
    ...(await readJson(STATUS_FILE, {})),
    status: "logged_in",
    updatedAt: safeDateString(),
    accountUserId,
    currentUrl: HOME_URL
  });

  return {
    ok: true,
    status: "logged_in",
    accountUserId,
    userToken
  };
}

async function waitForQrMaterial(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fileExists(QR_BASE64_FILE) && fileExists(STATUS_FILE)) {
      return true;
    }
    await delay(300);
  }
  return false;
}

async function spawnQrWorker(args) {
  const timeoutSeconds = Number(args.timeout_seconds) > 0 ? Number(args.timeout_seconds) : DEFAULT_TIMEOUT_SECONDS;
  const showBrowser = Boolean(args.show_browser);
  const workerArgs = [
    path.join(ROOT_DIR, "tools", "eshetang-cli.js"),
    "__qr_worker",
    JSON.stringify({ timeout_seconds: timeoutSeconds, show_browser: showBrowser })
  ];

  const logFd = fs.openSync(WORKER_LOG_FILE, "a");
  const child = spawn(process.execPath, workerArgs, {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();
  fs.closeSync(logFd);
  await writePid(child.pid);
}

async function runQrWorker(args) {
  const timeoutSeconds = Number(args.timeout_seconds) > 0 ? Number(args.timeout_seconds) : DEFAULT_TIMEOUT_SECONDS;
  const timeoutMs = timeoutSeconds * 1000;
  const workerStartedAt = new Date();
  process.once("SIGTERM", () => {
    shutdownRequested = true;
  });
  process.once("SIGINT", () => {
    shutdownRequested = true;
  });
  const { browser, context } = await launchContext({
    headless: !(Boolean(args.show_browser) || process.env.ESHETANG_HEADLESS === "false"),
    useStorageState: true
  });
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await delay(2000);

    let cookies = await context.cookies();
    let tokenCookie = extractUserTokenFromCookies(cookies);
    let currentUrl = page.url();
    let phase = inferLoginPhase(currentUrl, tokenCookie);
    if (phase === "logged_in") {
      await saveSessionArtifacts(context, { source: "worker_already_logged_in" });
      await writeJson(STATUS_FILE, {
        status: "logged_in",
        updatedAt: safeDateString(),
        timeoutSeconds,
        currentUrl
      });
      return;
    }

    const qrLocator = page.locator(QR_SELECTOR).first();
    await qrLocator.waitFor({ state: "visible", timeout: 45000 });

    const qrBuffer = await qrLocator.screenshot({ type: "png" });
    const qrBase64 = `data:image/png;base64,${qrBuffer.toString("base64")}`;
    await fsp.writeFile(QR_IMAGE_FILE, qrBuffer);
    await writeText(QR_BASE64_FILE, `${qrBase64}\n`);
    await writeJson(STATUS_FILE, {
      status: "waiting_for_scan",
      createdAt: safeDateString(workerStartedAt),
      updatedAt: safeDateString(),
      timeoutSeconds,
      showBrowser: Boolean(args.show_browser),
      expiresAt: new Date(workerStartedAt.getTime() + timeoutMs).toISOString(),
      qrcodePath: QR_IMAGE_FILE
    });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (shutdownRequested) {
        return;
      }
      await delay(1000);
      cookies = await context.cookies();
      tokenCookie = extractUserTokenFromCookies(cookies);
      currentUrl = page.url();
      phase = inferLoginPhase(currentUrl, tokenCookie);

      if (phase === "waiting_for_shop_selection") {
        await writeJson(STATUS_FILE, {
          status: "waiting_for_shop_selection",
          updatedAt: safeDateString(),
          timeoutSeconds,
          currentUrl,
          qrcodePath: fileExists(QR_IMAGE_FILE) ? QR_IMAGE_FILE : null,
          showBrowser: Boolean(args.show_browser),
          message: "扫码已通过，但还需要在 PC 页面完成店铺选择后才能拿到 userToken。"
        });
      }

      if (phase === "logged_in") {
        await saveSessionArtifacts(context, { source: "qr_scan_login" });
        await writeJson(STATUS_FILE, {
          status: "logged_in",
          updatedAt: safeDateString(),
          timeoutSeconds,
          currentUrl
        });
        return;
      }
    }

    await writeJson(STATUS_FILE, {
      status: "timed_out",
      updatedAt: safeDateString(),
      timeoutSeconds,
      qrcodePath: fileExists(QR_IMAGE_FILE) ? QR_IMAGE_FILE : null
    });
  } catch (error) {
    if (shutdownRequested) {
      return;
    }
    await writeJson(STATUS_FILE, {
      status: "error",
      updatedAt: safeDateString(),
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    await removeFile(PID_FILE);
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function getUserToken() {
  const tokenInfo = await getSavedToken();
  if (!tokenInfo || !tokenInfo.userToken) {
    const status = await readJson(STATUS_FILE, null);
    return {
      ok: false,
      isLoggedIn: false,
      status: status ? status.status : "logged_out",
      message: "当前没有可用的 userToken，请先执行 get_login_qrcode 完成扫码登录。"
    };
  }

  const isValid = await validateFinalUserToken(tokenInfo.userToken);
  if (!isValid) {
    const liveStatus = await checkLoginStatus();
    return {
      ok: false,
      isLoggedIn: false,
      status: liveStatus.status || "logged_out",
      message: liveStatus.status === "waiting_for_shop_selection"
        ? "扫码已完成，但还需要先完成店铺选择，完成后再重新获取 userToken。"
        : "本地存在旧 token，但在线校验未通过，请重新执行 get_login_qrcode。"
    };
  }

  return {
    ok: true,
    isLoggedIn: true,
    userToken: tokenInfo.userToken,
    domain: tokenInfo.domain || null,
    expires: tokenInfo.expires || null,
    updatedAt: tokenInfo.updatedAt || null,
    tokenFile: TOKEN_FILE
  };
}

async function deleteSession() {
  const pid = await readPid();
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    await delay(500);
  }

  for (const filePath of [
    STATE_FILE,
    COOKIES_FILE,
    TOKEN_FILE,
    SCAN_TOKEN_FILE,
    STATUS_FILE,
    PID_FILE,
    QR_IMAGE_FILE,
    QR_BASE64_FILE
  ]) {
    await removeFile(filePath);
  }

  return {
    ok: true,
    deleted: true,
    message: "本地登录态与二维码缓存已清理。"
  };
}

async function reportUnsatisfiedRequest(args) {
  const taskSummary = typeof args.task_summary === "string" ? args.task_summary.trim() : "";
  const reason = typeof args.reason === "string" ? args.reason.trim() : "";
  const explicitSkill = args.explicit_skill_invocation !== false;

  if (!taskSummary) {
    fail("task_summary is required");
  }

  const payload = {
    source: "eshetang-skill",
    explicitSkillInvocation: explicitSkill,
    taskSummary,
    reason: reason || "skill_unable_to_complete",
    createdAt: safeDateString()
  };

  await appendText(FEEDBACK_QUEUE_FILE, `${JSON.stringify(payload)}\n`);

  return {
    ok: true,
    reported: false,
    queued: true,
    message: "已写入本地反馈队列，后续可由 yst-mcp 反馈接口统一上报。",
    queueFile: FEEDBACK_QUEUE_FILE,
    payload
  };
}

main();
