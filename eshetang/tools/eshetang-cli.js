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
const STATUS_FILE = path.join(DATA_DIR, "login-status.json");
const MCP_CONFIG_FILE = path.join(DATA_DIR, "mcp-config.json");
const PID_FILE = path.join(DATA_DIR, "login-worker.pid");
const QR_IMAGE_FILE = path.join(OUTPUT_DIR, "login-qrcode.png");
const QR_BASE64_FILE = path.join(DATA_DIR, "login-qrcode.txt");
const WORKER_LOG_FILE = path.join(DATA_DIR, "login-worker.log");
const LOGIN_URL = "https://pc.eshetang.com/account/login?redirect=%2F";
const HOME_URL = "https://pc.eshetang.com/";
const DEFAULT_TIMEOUT_SECONDS = 240;
const QR_SELECTOR = 'img[alt="qrcode"]';
const USER_TOKEN_COOKIE = "userToken";
const DEFAULT_MCP_BUSINESS = "saas_mcp";
const DEFAULT_MCP_BFF_BASE_URL = "https://bff.eshetang.com";
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
            "get_user_token",
            "delete_session",
            "set_mcp_config",
            "get_mcp_config",
            "get_integration_status",
            "refresh_api_catalog",
            "get_api_catalog_summary",
            "search_api_operations",
            "get_api_operation_details",
            "invoke_api_operation",
            "call_remote_mcp_tool"
          ]
        });
      case "check_login_status":
        return printJson(await checkLoginStatus(args));
      case "get_login_qrcode":
        return printJson(await getLoginQrcode(args));
      case "get_user_token":
        return printJson(await getUserToken(args));
      case "delete_session":
        return printJson(await deleteSession(args));
      case "set_mcp_config":
        return printJson(await setMcpConfig(args));
      case "get_mcp_config":
        return printJson(await getMcpConfig(args));
      case "get_integration_status":
        return printJson(await getIntegrationStatus(args));
      case "refresh_api_catalog":
      case "get_api_catalog_summary":
      case "search_api_operations":
      case "get_api_operation_details":
      case "invoke_api_operation":
        return printJson(await proxyRemoteTool(command, args));
      case "call_remote_mcp_tool":
        return printJson(await callRemoteMcpToolEntry(args));
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
    const isLoggedIn = Boolean(cookie && cookie.value) && !currentUrl.includes("/account/login");

    if (isLoggedIn) {
      await saveSessionArtifacts(context, { source: "check_login_status" });
    }

    return {
      ok: true,
      isLoggedIn,
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
  const workerArgs = [
    path.join(ROOT_DIR, "tools", "eshetang-cli.js"),
    "__qr_worker",
    JSON.stringify({ timeout_seconds: timeoutSeconds })
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
    headless: process.env.ESHETANG_HEADLESS !== "false",
    useStorageState: true
  });
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await delay(2000);

    let cookies = await context.cookies();
    let tokenCookie = extractUserTokenFromCookies(cookies);
    if (tokenCookie && tokenCookie.value && !page.url().includes("/account/login")) {
      await saveSessionArtifacts(context, { source: "worker_already_logged_in" });
      await writeJson(STATUS_FILE, {
        status: "logged_in",
        updatedAt: safeDateString(),
        timeoutSeconds
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
      const currentUrl = page.url();
      if (tokenCookie && tokenCookie.value && !currentUrl.includes("/account/login")) {
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

  const liveStatus = await checkLoginStatus();
  if (!liveStatus.isLoggedIn || !liveStatus.userToken) {
    return {
      ok: false,
      isLoggedIn: false,
      status: "logged_out",
      message: "本地存在旧 token，但在线校验未通过，请重新执行 get_login_qrcode。"
    };
  }

  return {
    ok: true,
    isLoggedIn: true,
    userToken: liveStatus.userToken,
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

async function setMcpConfig(args) {
  const mcpUrl = typeof args.mcp_url === "string" ? args.mcp_url.trim() : "";
  if (!mcpUrl) {
    fail("缺少 mcp_url，请传入远端 yst-mcp 的完整地址。");
  }

  const config = {
    mcpUrl,
    business: DEFAULT_MCP_BUSINESS,
    bffBaseUrl: DEFAULT_MCP_BFF_BASE_URL,
    updatedAt: safeDateString()
  };

  await writeJson(MCP_CONFIG_FILE, config);

  return {
    ok: true,
    configured: true,
    config: publicMcpConfig(config)
  };
}

async function getMcpConfig() {
  const config = await loadMcpConfig();
  return {
    ok: true,
    configured: Boolean(config),
    config: config ? publicMcpConfig(config) : null
  };
}

async function getIntegrationStatus() {
  const config = await loadMcpConfig();
  const token = await getSavedToken();
  const loginStatus = await readJson(STATUS_FILE, null);
  let remoteCatalog = null;
  let remoteError = null;

  if (config) {
    try {
      const remote = await callRemoteMcpTool("get_api_catalog_summary", {}, {
        requireLogin: false,
        mcpConfig: config
      });
      remoteCatalog = remote.result || null;
    } catch (error) {
      remoteError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: true,
    login: {
      hasUserToken: Boolean(token && token.userToken),
      userTokenPreview: token && token.userToken ? `${token.userToken.slice(0, 8)}...` : null,
      status: loginStatus ? loginStatus.status : "unknown",
      tokenFile: fileExists(TOKEN_FILE) ? TOKEN_FILE : null
    },
    mcp: {
      configured: Boolean(config),
      config: config ? publicMcpConfig(config) : null,
      remoteCatalog,
      remoteError
    }
  };
}

async function proxyRemoteTool(toolName, args) {
  const requireLogin = ![
    "refresh_api_catalog",
    "get_api_catalog_summary",
    "search_api_operations",
    "get_api_operation_details"
  ].includes(toolName);

  return callRemoteMcpTool(toolName, args, {
    requireLogin
  });
}

async function callRemoteMcpToolEntry(args) {
  const toolName = typeof args.tool_name === "string" ? args.tool_name.trim() : "";
  if (!toolName) {
    fail("缺少 tool_name。");
  }

  return callRemoteMcpTool(toolName, args.tool_args || {}, {
    requireLogin: args.require_login !== false
  });
}

async function callRemoteMcpTool(toolName, toolArgs, options = {}) {
  const mcpConfig = options.mcpConfig || await loadMcpConfig();
  if (!mcpConfig || !mcpConfig.mcpUrl) {
    fail("尚未配置 mcp_url，请先执行 set_mcp_config。");
  }

  const userTokenInfo = options.requireLogin === false ? await getSavedToken() : await getRequiredUserToken();
  const headers = buildRemoteHeaders(mcpConfig, userTokenInfo);
  const sessionId = await initializeRemoteMcp(mcpConfig.mcpUrl, headers);
  await notifyRemoteInitialized(mcpConfig.mcpUrl, sessionId, headers);
  const result = await invokeRemoteTool(mcpConfig.mcpUrl, sessionId, headers, toolName, toolArgs);

  return {
    ok: true,
    mcpUrl: mcpConfig.mcpUrl,
    toolName,
    usedUserToken: Boolean(userTokenInfo && userTokenInfo.userToken),
    result
  };
}

async function loadMcpConfig() {
  const fromFile = await readJson(MCP_CONFIG_FILE, null);
  if (fromFile && fromFile.mcpUrl) {
    return fromFile;
  }

  if (process.env.ESHETANG_MCP_URL) {
    return {
      mcpUrl: process.env.ESHETANG_MCP_URL,
      business: DEFAULT_MCP_BUSINESS,
      bffBaseUrl: DEFAULT_MCP_BFF_BASE_URL,
      updatedAt: null
    };
  }

  return null;
}

async function getRequiredUserToken() {
  const tokenInfo = await getUserToken();
  if (!tokenInfo.ok || !tokenInfo.userToken) {
    fail(tokenInfo.message || "当前没有可用的 userToken，请先扫码登录。");
  }
  return tokenInfo;
}

function buildRemoteHeaders(mcpConfig, userTokenInfo) {
  const headers = {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
    "x-yst-business": mcpConfig.business || DEFAULT_MCP_BUSINESS,
    "x-yst-bff-base-url": mcpConfig.bffBaseUrl || DEFAULT_MCP_BFF_BASE_URL
  };

  if (userTokenInfo && userTokenInfo.userToken) {
    headers["x-yst-user-token"] = userTokenInfo.userToken;
  }

  return headers;
}

function publicMcpConfig(config) {
  return {
    mcpUrl: config.mcpUrl,
    updatedAt: config.updatedAt || null
  };
}

async function initializeRemoteMcp(mcpUrl, headers) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "eshetang-skill",
          version: "0.2.0"
        }
      }
    })
  });

  const payload = await safeParseJson(response);
  if (!response.ok || payload.error) {
    fail(`初始化远端 MCP 失败: ${payload.error ? payload.error.message : response.statusText}`);
  }

  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) {
    fail("远端 MCP 未返回 Mcp-Session-Id。");
  }
  return sessionId;
}

async function notifyRemoteInitialized(mcpUrl, sessionId, headers) {
  await fetch(mcpUrl, {
    method: "POST",
    headers: {
      ...headers,
      "mcp-session-id": sessionId
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {}
    })
  });
}

async function invokeRemoteTool(mcpUrl, sessionId, headers, toolName, toolArgs) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      ...headers,
      "mcp-session-id": sessionId
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toolArgs || {}
      }
    })
  });

  const payload = await safeParseJson(response);
  if (!response.ok || payload.error) {
    fail(`调用远端工具失败: ${payload.error ? payload.error.message : response.statusText}`);
  }

  const text = payload.result?.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      return JSON.parse(text);
    } catch {
      return { rawText: text };
    }
  }

  return payload.result || payload;
}

async function safeParseJson(response) {
  const text = await response.text();
  const normalizedText = unwrapSsePayload(text);
  try {
    return normalizedText ? JSON.parse(normalizedText) : {};
  } catch {
    return { rawText: normalizedText || text };
  }
}

function unwrapSsePayload(text) {
  if (typeof text !== "string" || !text.trim().startsWith("event:")) {
    return text;
  }

  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  return dataLines.join("\n");
}

main();
