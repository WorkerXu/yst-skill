#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const STATE_FILE = path.join(DATA_DIR, "browser-state.json");
const COOKIES_FILE = path.join(DATA_DIR, "cookies.json");
const TOKEN_FILE = path.join(DATA_DIR, "user-token.json");
const SCAN_TOKEN_FILE = path.join(DATA_DIR, "scan-token.json");
const STATUS_FILE = path.join(DATA_DIR, "login-status.json");
const MCP_CONFIG_FILE = path.join(DATA_DIR, "mcp-config.json");
const API_DOC_VERSION_FILE = path.join(DATA_DIR, "api-doc-version.json");
const API_DOC_DOCUMENT_FILE = path.join(DATA_DIR, "api-doc-document.json");
const API_DOC_INDEX_FILE = path.join(DATA_DIR, "api-doc-index.json");
const UPLOADED_FILE_CACHE_FILE = path.join(DATA_DIR, "uploaded-file-cache.json");
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
const DEFAULT_MCP_URL = "https://789.mcp.t.eshetang.com/yst/mcp";
const MCP_URL_ENV_KEYS = [
  "ESHETANG_MCP_URL",
  "YST_MCP_URL"
];
const SUPPORTED_ASSISTANT_TYPES = [
  "codex",
  "workbuddy",
  "cursor",
  "cc-code",
  "xiaolongxia"
];
const DEFAULT_MCP_BUSINESS = "saas_mcp";
const DEFAULT_MCP_BFF_BASE_URL = "https://bff.eshetang.com";
const DEFAULT_FILE_UPLOAD_PURPOSE = "stock";
const INTERNAL_FILE_HOSTS = [
  "eshetang.com",
  "imgs.eshetang.com"
];
const FILE_PATH_PURPOSE_RULES = [
  { pattern: /^imageList\[\d+\]\.fileUrl$/, purpose: "stock" },
  { pattern: /^detailsImageList\[\d+\]\.fileUrl$/, purpose: "stock" },
  { pattern: /^annex\.imageList\[\d+\]\.fileUrl$/, purpose: "stock" },
  { pattern: /^costList\[\d+\]\.imageList\[\d+\]\.fileUrl$/, purpose: "stock" },
  { pattern: /^recycle\.imageList\[\d+\]\.fileUrl$/, purpose: "recovery" },
  { pattern: /^paidInfo\.paidVoucher\[\d+\]$/, purpose: "receipt" },
  { pattern: /^settleInfo\.settleVoucher\[\d+\]$/, purpose: "receipt" }
];
const SCENARIO_RECIPES = [
  {
    scenarioKey: "create_stock",
    intentPatterns: ["新增商品", "添加商品", "新增库存", "创建库存"],
    steps: [
      "lookup_brand",
      "lookup_category",
      "lookup_series",
      "lookup_warehouse",
      "preprocess_files",
      "invoke_create_stock"
    ],
    requiredUserInputs: ["categoryId", "goodsSource", "onlineStatus", "status", "description"],
    operationBindings: [
      "BrandController_comboBox",
      "CategoryController_stockCategoryList",
      "SeriesController_comboBox",
      "InventoryWarehouseController_list",
      "InventoryStockController_create"
    ],
    payloadBuilders: ["buildCreateStockPayload"],
    fileFieldRules: ["stock_media"]
  },
  {
    scenarioKey: "create_order",
    intentPatterns: ["卖出", "开单", "创建订单", "客户订单", "销售订单"],
    steps: [
      "lookup_sale_user",
      "lookup_order_type",
      "preprocess_files",
      "invoke_create_order"
    ],
    requiredUserInputs: ["type", "saleUserIds", "saleUserName", "goodsInfo", "source"],
    operationBindings: [
      "BusinessController_comboBox",
      "StockEnumController_shopComboBox",
      "StockOrderOfflineController_create"
    ],
    payloadBuilders: ["buildCreateOrderPayload"],
    fileFieldRules: ["receipt_media"]
  },
  {
    scenarioKey: "query_order_detail",
    intentPatterns: ["查询订单详情", "订单详情", "库存订单详情"],
    steps: [
      "lookup_order_list",
      "invoke_order_detail"
    ],
    requiredUserInputs: ["wmsOrderNo"],
    operationBindings: [
      "StockOrderOfflineController_list",
      "StockOrderOfflineController_detail"
    ],
    payloadBuilders: ["buildOrderDetailPayload"],
    fileFieldRules: []
  },
  {
    scenarioKey: "write_with_files",
    intentPatterns: ["上传图片", "上传凭证", "文件地址", "外部图片"],
    steps: [
      "sync_api_doc",
      "inspect_payload_file_fields",
      "upload_external_files",
      "invoke_operation"
    ],
    requiredUserInputs: [],
    operationBindings: [],
    payloadBuilders: ["buildGenericPayload"],
    fileFieldRules: ["generic_external_file"]
  }
];
let shutdownRequested = false;
let playwrightChromium = null;

async function main() {
  try {
    await ensureDirs();

    const command = process.argv[2] || "help";
    const rawArgs = process.argv[3];
    const args = parseJsonArgs(rawArgs);
    const blockedByPrerequisites = await getPrerequisiteBlockingResponse(command);
    if (blockedByPrerequisites) {
      return printJson(blockedByPrerequisites);
    }

    switch (command) {
      case "help":
        return printJson({
          ok: true,
          tools: [
            "check_login_status",
            "get_login_qrcode",
            "login_flow",
            "list_shops",
            "select_shop",
            "get_user_token",
            "delete_session",
            "install_mcp",
            "set_mcp_config",
            "get_mcp_config",
            "get_integration_status",
            "sync_api_doc",
            "get_cached_api_doc_summary",
            "get_cached_api_operation_details",
            "get_scenario_recipe",
            "get_api_doc_version",
            "get_api_doc_document",
            "upload_external_file",
            "invoke_api_operation",
            "call_remote_mcp_tool"
          ]
        });
      case "check_login_status":
        return printJson(await checkLoginStatus(args));
      case "get_login_qrcode":
        return printJson(await getLoginQrcode(args));
      case "login_flow":
        return printJson(await loginFlow(args));
      case "list_shops":
        return printJson(await listShops(args));
      case "select_shop":
        return printJson(await selectShop(args));
      case "get_user_token":
        return printJson(await getUserToken(args));
      case "delete_session":
        return printJson(await deleteSession(args));
      case "install_mcp":
        return printJson(await installMcp(args));
      case "set_mcp_config":
        return printJson(await setMcpConfig(args));
      case "get_mcp_config":
        return printJson(await getMcpConfig(args));
      case "get_integration_status":
        return printJson(await getIntegrationStatus(args));
      case "sync_api_doc":
        return printJson(await syncApiDoc(args));
      case "get_cached_api_doc_summary":
        return printJson(await getCachedApiDocSummary(args));
      case "get_cached_api_operation_details":
        return printJson(await getCachedApiOperationDetails(args));
      case "get_scenario_recipe":
        return printJson(await getScenarioRecipe(args));
      case "get_api_doc_version":
      case "get_api_doc_document":
      case "upload_external_file":
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
  const url = new URL(pathname, DEFAULT_MCP_BFF_BASE_URL);
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

  const chromium = getPlaywrightChromium();
  const browser = await chromium.launch({ headless });
  const contextOptions = {};
  if (useStorageState && fileExists(STATE_FILE)) {
    contextOptions.storageState = STATE_FILE;
  }
  const context = await browser.newContext(contextOptions);
  return { browser, context };
}

function getPlaywrightChromium() {
  if (playwrightChromium) {
    return playwrightChromium;
  }

  try {
    ({ chromium: playwrightChromium } = require("playwright"));
  } catch (error) {
    fail("未找到 playwright 依赖。请先执行 npm install 或 ./scripts/install-check.sh。");
  }

  return playwrightChromium;
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

async function loginFlow(args = {}) {
  const selectedIndex = Number.isInteger(args.shop_index)
    ? args.shop_index
    : Number.isFinite(Number(args.shop_index))
      ? Number(args.shop_index)
      : null;
  const selectedAccountUserId = args.account_user_id ? Number(args.account_user_id) : null;
  const selectedEnterpriseNo = typeof args.enterprise_no === "string" ? args.enterprise_no.trim() : "";

  if (selectedIndex || selectedAccountUserId || selectedEnterpriseNo) {
    const result = await selectShop({
      scan_token: args.scan_token,
      shop_index: selectedIndex || undefined,
      account_user_id: selectedAccountUserId || undefined,
      enterprise_no: selectedEnterpriseNo || undefined
    });

    if (result.ok) {
      return {
        ok: true,
        phase: "logged_in",
        done: true,
        message: `已为你选中店铺并拿到 userToken。当前账号 ID: ${result.accountUserId}`,
        userToken: result.userToken
      };
    }

    return {
      ...result,
      phase: "shop_selection_failed",
      done: false
    };
  }

  const tokenInfo = await getSavedToken();
  if (tokenInfo && await validateFinalUserToken(tokenInfo.userToken)) {
    return {
      ok: true,
      phase: "logged_in",
      done: true,
      message: "当前已经登录完成，可以直接继续使用远端 yst-mcp。",
      userToken: tokenInfo.userToken
    };
  }

  const status = await readJson(STATUS_FILE, null);
  if (status && status.status === "waiting_for_shop_selection") {
    const shopsResult = await listShops({
      scan_token: args.scan_token
    });

    if (!shopsResult.ok) {
      return {
        ...shopsResult,
        phase: "waiting_for_shop_selection",
        done: false
      };
    }

    return {
      ok: true,
      phase: "waiting_for_shop_selection",
      done: false,
      message: "扫码已完成，还差最后一步选店。请让用户回复店铺编号、店铺号或 accountUserId，我会继续自动登录。",
      shops: shopsResult.shops
    };
  }

  const qrcodeResult = await getLoginQrcode(args);
  if (!qrcodeResult.ok) {
    return {
      ...qrcodeResult,
      phase: "qrcode_failed",
      done: false
    };
  }

  return {
    ok: true,
    phase: "waiting_for_scan",
    done: false,
    message: "请先扫码登录；扫码完成后我会继续帮你列出可选店铺。",
    qrcodePath: qrcodeResult.qrcodePath,
    img: qrcodeResult.img,
    timeout: qrcodeResult.timeout
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

  const userToken = loginResult.body && loginResult.body.data && loginResult.body.data.userToken;
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
      const phase = inferLoginPhase(currentUrl, tokenCookie);

      if (phase === "waiting_for_shop_selection") {
        const scanToken = getScanTokenFromUrl(currentUrl);
        if (scanToken) {
          await writeJson(SCAN_TOKEN_FILE, {
            scanToken,
            updatedAt: safeDateString()
          });
        }
        await writeJson(STATUS_FILE, {
          status: "waiting_for_shop_selection",
          updatedAt: safeDateString(),
          timeoutSeconds,
          currentUrl
        });
        return;
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
    const needsShopSelection = status && status.status === "waiting_for_shop_selection";
    return {
      ok: false,
      isLoggedIn: false,
      status: status ? status.status : "logged_out",
      message: needsShopSelection
        ? "扫码已完成，但还需要先选择店铺才能拿到最终 userToken。请执行 login_flow、list_shops 或 select_shop。"
        : "当前没有可用的 userToken，请先执行 get_login_qrcode 完成扫码登录。"
    };
  }

  if (await validateFinalUserToken(tokenInfo.userToken)) {
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

  const liveStatus = await checkLoginStatus();
  if (!liveStatus.isLoggedIn || !liveStatus.userToken) {
    const needsShopSelection = liveStatus.status === "waiting_for_shop_selection";
    return {
      ok: false,
      isLoggedIn: false,
      status: needsShopSelection ? "waiting_for_shop_selection" : "logged_out",
      message: needsShopSelection
        ? "扫码已完成，但还需要先选择店铺才能拿到最终 userToken。请执行 login_flow、list_shops 或 select_shop。"
        : "本地存在旧 token，但在线校验未通过，请重新执行 get_login_qrcode。"
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

async function installMcp(args = {}) {
  const prerequisites = await inspectInstallPrerequisites();
  const confirmed = args.confirm === true || args.confirm === "true" || args.start_install === true;

  if (!prerequisites.ready && !confirmed) {
    return {
      ok: false,
      needsUserConfirmation: true,
      status: "install_prerequisites_required",
      message: "开始安装前，还需要先准备本地环境。我已经整理好了需要安装的工具和安装步骤；如果你确认开始，我再继续执行安装。",
      prerequisites
    };
  }

  if (!prerequisites.ready && confirmed) {
    return {
      ok: false,
      status: "install_prerequisites_missing",
      message: "当前环境依赖还没准备好，请先按步骤安装缺失工具并执行 ./scripts/install-check.sh，完成后我再继续安装 MCP。",
      prerequisites
    };
  }

  const requestedType = normalizeAssistantType(args.assistant_type || args.platform || args.assistantType);
  const detected = detectAssistantTypes();
  const assistantType = requestedType || (detected.length === 1 ? detected[0] : null);

  if (!assistantType) {
    return {
      ok: false,
      needsUserInput: true,
      status: "assistant_type_required",
      message: detected.length > 1
        ? `检测到多个可能的平台：${detected.join("、")}。请先告诉我你当前使用的是哪种助理，我再自动安装 MCP。`
        : "暂时无法自动判断你当前使用的助理类型。请先告诉我你使用的是 codex、workbuddy、cursor、cc-code 还是 xiaolongxia。",
      supportedAssistantTypes: SUPPORTED_ASSISTANT_TYPES,
      detectedAssistantTypes: detected
    };
  }

  const result = await installMcpForAssistant(assistantType);
  return {
    ok: true,
    assistantType,
    mcpUrl: DEFAULT_MCP_URL,
    prerequisites,
    ...result
  };
}

async function getPrerequisiteBlockingResponse(command) {
  const bypassCommands = new Set([
    "help",
    "install_mcp",
    "set_mcp_config",
    "get_mcp_config",
    "delete_session",
    "__qr_worker"
  ]);

  if (bypassCommands.has(command)) {
    return null;
  }

  const prerequisites = await inspectInstallPrerequisites();
  if (prerequisites.ready) {
    return null;
  }

  return {
    ok: false,
    needsUserConfirmation: true,
    status: "install_prerequisites_required",
    blockingCommand: command,
    message: "当前任何登录或远端 MCP 操作前，都必须先完成环境检查。因为后续扫码登录、选店和 userToken 获取都依赖这些本地能力；请先确认是否开始安装缺失工具。",
    prerequisites
  };
}

async function inspectInstallPrerequisites() {
  const missing = [];
  const installed = [];
  const steps = [];
  const toolDescriptions = {
    node: "运行 skill CLI 与脚本工具所需的 Node.js 运行时",
    npm: "安装 skill 依赖包与 Playwright 浏览器依赖",
    jq: "让 shell 脚本安全解析和校验 JSON 参数",
    playwright: "用于扫码登录、二维码截图与浏览器自动化流程",
    chromium: "Playwright 登录流程依赖的浏览器内核",
  };

  if (!commandExists("node")) {
    missing.push("node");
    steps.push("安装 Node.js 18+，用于运行 skill CLI 与脚本");
  } else {
    installed.push("node");
  }
  if (!commandExists("npm")) {
    missing.push("npm");
    steps.push("安装 npm，或安装自带 npm 的 Node.js 发行版");
  } else {
    installed.push("npm");
  }
  if (!commandExists("jq")) {
    missing.push("jq");
    steps.push("安装 jq，用于 shell 脚本处理 JSON 参数");
  } else {
    installed.push("jq");
  }

  const playwrightPackage = fileExists(path.join(ROOT_DIR, "node_modules", "playwright", "package.json"));
  if (!playwrightPackage) {
    missing.push("playwright");
    steps.push("在 skill 目录执行 npm install，安装项目依赖与 Playwright");
  } else {
    installed.push("playwright");
  }

  const chromiumHint = fileExists(path.join(ROOT_DIR, "node_modules", "playwright", "package.json"))
    ? "执行 npx playwright install chromium，安装扫码登录需要的浏览器内核"
    : "完成 npm install 后执行 npx playwright install chromium，安装扫码登录需要的浏览器内核";
  const chromiumInstalled = getPlaywrightBrowserCachePaths().some((cachePath) => fileExists(cachePath));
  if (!chromiumInstalled) {
    missing.push("chromium");
    steps.push(chromiumHint);
  } else {
    installed.push("chromium");
  }

  steps.push("执行 ./scripts/install-check.sh，自动补齐依赖并做最终检查");

  return {
    ready: missing.length === 0,
    installed,
    missing,
    toolDescriptions,
    steps
  };
}

function getPlaywrightBrowserCachePaths() {
  const home = os.homedir();
  const paths = new Set();
  const customBrowserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;

  if (typeof customBrowserPath === "string" && customBrowserPath.trim()) {
    if (customBrowserPath.trim() === "0") {
      paths.add(path.join(ROOT_DIR, "node_modules", ".cache", "ms-playwright"));
    } else {
      paths.add(path.resolve(customBrowserPath.trim()));
    }
  }

  paths.add(path.join(ROOT_DIR, "node_modules", ".cache", "ms-playwright"));
  paths.add(path.join(home, ".cache", "ms-playwright"));
  paths.add(path.join(home, "Library", "Caches", "ms-playwright"));

  const localAppData = process.env.LOCALAPPDATA;
  if (typeof localAppData === "string" && localAppData.trim()) {
    paths.add(path.join(localAppData.trim(), "ms-playwright"));
  }

  const appData = process.env.APPDATA;
  if (typeof appData === "string" && appData.trim()) {
    paths.add(path.join(appData.trim(), "ms-playwright"));
  }

  return Array.from(paths);
}

async function setMcpConfig(args) {
  return {
    ok: true,
    configured: true,
    config: publicMcpConfig(await loadMcpConfig()),
    message: "当前版本不再通过对话写入 mcp_url。请优先使用 install_mcp 自动安装 MCP；如需覆盖地址，请修改环境变量 ESHETANG_MCP_URL，或修改工具文件中的默认值。"
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
  let remoteDocument = null;
  let remoteError = null;

  if (config) {
    try {
      const remote = await callRemoteMcpTool("get_api_doc_version", {}, {
        requireLogin: false,
        mcpConfig: config
      });
      remoteDocument = remote.document || null;
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
      remoteDocument,
      remoteError
    }
  };
}

async function syncApiDoc(args = {}) {
  const synced = await ensureApiDocSynced({
    force: args.force === true
  });

  return {
    ok: true,
    ...synced
  };
}

async function getCachedApiDocSummary(args = {}) {
  const synced = await ensureApiDocSynced({
    force: args.force === true
  });
  const document = await readJson(API_DOC_DOCUMENT_FILE, null);
  const index = await readJson(API_DOC_INDEX_FILE, null);

  if (!document || !index) {
    fail("本地接口文档缓存不存在，请先执行 sync_api_doc。");
  }

  return {
    ok: true,
    synced,
    summary: {
      title: document.title,
      version: document.version,
      fingerprint: document.fingerprint,
      fetchedAt: document.fetchedAt,
      operationCount: document.operations.length,
      sourceVersions: document.sourceVersions || [],
      moduleCount: Object.keys(index.operationsByModule || {}).length,
      scenarioRecipes: SCENARIO_RECIPES.map(recipe => ({
        scenarioKey: recipe.scenarioKey,
        steps: recipe.steps,
        operationBindings: recipe.operationBindings
      }))
    }
  };
}

async function getCachedApiOperationDetails(args = {}) {
  const synced = await ensureApiDocSynced({
    force: args.force === true
  });
  const cached = await loadCachedApiArtifacts();
  const operation = findCachedOperation(args, cached.document, cached.index);

  if (!operation) {
    fail("本地文档中未找到匹配接口，请提供 operationId，或同时提供 path + method。");
  }

  return {
    ok: true,
    synced,
    operation
  };
}

async function getScenarioRecipe(args = {}) {
  const intent = typeof args.intent === "string" ? args.intent.trim() : "";
  const scenarioKey = typeof args.scenarioKey === "string" ? args.scenarioKey.trim() : "";
  const recipe = scenarioKey
    ? SCENARIO_RECIPES.find(item => item.scenarioKey === scenarioKey)
    : matchScenarioRecipe(intent);

  if (!recipe) {
    return {
      ok: false,
      message: "未命中预置流程，请改用本地文档检索接口定义。",
      availableScenarioKeys: SCENARIO_RECIPES.map(item => item.scenarioKey)
    };
  }

  return {
    ok: true,
    recipe
  };
}

async function proxyRemoteTool(toolName, args) {
  const requireLogin = ![
    "get_api_doc_version",
    "get_api_doc_document"
  ].includes(toolName);

  if (toolName === "invoke_api_operation") {
    const synced = await ensureApiDocSynced();
    const cached = await loadCachedApiArtifacts();
    const operation = findCachedOperation(args, cached.document, cached.index);

    if (!operation) {
      fail("本地文档中未找到要调用的接口，请先同步文档并确认 operationId 或 path + method。");
    }

    const scenarioRecipe = matchScenarioRecipeByOperation(operation);
    const userTokenInfo = requireLogin ? await getRequiredUserToken() : await getSavedToken();
    const processedBody = await preprocessExternalFileFields(args.body, {
      operation,
      mcpConfig: await loadMcpConfig(),
      userTokenInfo
    });
    const remoteArgs = processedBody.changed ? {
      ...args,
      body: processedBody.body
    } : args;

    const result = await callRemoteMcpTool(toolName, remoteArgs, {
      requireLogin,
      userTokenInfo
    });

    return {
      ok: true,
      mcpUrl: (await loadMcpConfig()).mcpUrl,
      toolName,
      usedUserToken: Boolean(userTokenInfo && userTokenInfo.userToken),
      syncedDoc: synced,
      preflight: {
        operation,
        scenarioRecipe,
        uploadedFiles: processedBody.uploads
      },
      result
    };
  }

  const result = await callRemoteMcpTool(toolName, args, {
    requireLogin
  });

  return {
    ok: true,
    mcpUrl: (await loadMcpConfig()).mcpUrl,
    toolName,
    usedUserToken: false,
    result
  };
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
    fail("当前没有可用的 mcp_url。请先执行 install_mcp 完成 MCP 安装，或设置环境变量 ESHETANG_MCP_URL。");
  }

  const userTokenInfo = options.userTokenInfo || (options.requireLogin === false ? await getSavedToken() : await getRequiredUserToken());
  const headers = buildRemoteHeaders(mcpConfig, userTokenInfo);
  const sessionId = await initializeRemoteMcp(mcpConfig.mcpUrl, headers);
  await notifyRemoteInitialized(mcpConfig.mcpUrl, sessionId, headers);
  return invokeRemoteTool(mcpConfig.mcpUrl, sessionId, headers, toolName, toolArgs);
}

function pickOperationLocatorArgs(toolArgs = {}) {
  const args = {};
  for (const key of ["operationId", "path", "method", "sourceKey"]) {
    if (toolArgs[key] !== undefined) {
      args[key] = toolArgs[key];
    }
  }
  return args;
}

async function ensureApiDocSynced(options = {}) {
  const force = options.force === true;
  const versionResult = await callRemoteMcpTool("get_api_doc_version", {}, {
    requireLogin: false
  });
  const remoteVersion = versionResult.document || null;
  if (!remoteVersion) {
    fail("远端未返回接口文档版本信息。");
  }

  const localVersion = await readJson(API_DOC_VERSION_FILE, null);
  const cacheMissing = !fileExists(API_DOC_DOCUMENT_FILE) || !fileExists(API_DOC_INDEX_FILE);
  const changed = force || cacheMissing || !localVersion || localVersion.fingerprint !== remoteVersion.fingerprint;

  if (!changed) {
    return {
      changed: false,
      document: remoteVersion
    };
  }

  const documentResult = await callRemoteMcpTool("get_api_doc_document", {}, {
    requireLogin: false
  });
  const document = documentResult.document || null;
  if (!document) {
    fail("远端未返回完整接口文档。");
  }

  const index = buildApiDocIndex(document);
  await writeJson(API_DOC_VERSION_FILE, remoteVersion);
  await writeJson(API_DOC_DOCUMENT_FILE, document);
  await writeJson(API_DOC_INDEX_FILE, index);

  return {
    changed: true,
    document: remoteVersion
  };
}

async function loadCachedApiArtifacts() {
  const document = await readJson(API_DOC_DOCUMENT_FILE, null);
  const index = await readJson(API_DOC_INDEX_FILE, null);

  if (!document || !index) {
    fail("本地接口文档缓存不存在，请先执行 sync_api_doc。");
  }

  return { document, index };
}

function buildApiDocIndex(document) {
  const operationsById = {};
  const operationsByMethodPath = {};
  const operationsByModule = {};
  const keywordIndex = {};

  for (const operation of document.operations || []) {
    if (operation.operationId) {
      operationsById[operation.operationId] = operation.key;
    }
    operationsByMethodPath[buildMethodPathKey(operation)] = operation.key;
    if (!operationsByModule[operation.module]) {
      operationsByModule[operation.module] = [];
    }
    operationsByModule[operation.module].push(operation.key);

    for (const keyword of extractOperationKeywords(operation)) {
      if (!keywordIndex[keyword]) {
        keywordIndex[keyword] = [];
      }
      if (!keywordIndex[keyword].includes(operation.key)) {
        keywordIndex[keyword].push(operation.key);
      }
    }
  }

  return {
    generatedAt: safeDateString(),
    operationsById,
    operationsByMethodPath,
    operationsByModule,
    keywordIndex,
    scenarioRecipes: SCENARIO_RECIPES
  };
}

function extractOperationKeywords(operation) {
  const raw = [
    operation.operationId,
    operation.summary,
    operation.description,
    operation.module,
    operation.sourceKey,
    operation.path,
    ...(Array.isArray(operation.tags) ? operation.tags : [])
  ].filter(Boolean).join(" ");

  return Array.from(new Set(
    raw
      .split(/[\s/,_\-:()[\]{}|]+/)
      .map(item => item.trim().toLowerCase())
      .filter(item => item.length >= 2)
  ));
}

function buildMethodPathKey(operationOrLocator) {
  const method = String(operationOrLocator.method || "").toUpperCase();
  const pathValue = String(operationOrLocator.path || "");
  const sourceKey = operationOrLocator.sourceKey ? String(operationOrLocator.sourceKey) : "";
  return `${sourceKey}:${method} ${pathValue}`;
}

function findCachedOperation(locator, document, index) {
  const operations = Array.isArray(document.operations) ? document.operations : [];
  if (locator.operationId && index.operationsById && index.operationsById[locator.operationId]) {
    return operations.find(item => item.key === index.operationsById[locator.operationId]) || null;
  }

  if (locator.path && locator.method) {
    const key = buildMethodPathKey(locator);
    const operationKey = index.operationsByMethodPath ? index.operationsByMethodPath[key] : null;
    if (operationKey) {
      return operations.find(item => item.key === operationKey) || null;
    }
  }

  return null;
}

function matchScenarioRecipe(intent) {
  if (!intent) {
    return null;
  }

  return SCENARIO_RECIPES.find(recipe =>
    recipe.intentPatterns.some(pattern => intent.includes(pattern))
  ) || null;
}

function matchScenarioRecipeByOperation(operation) {
  return SCENARIO_RECIPES.find(recipe =>
    recipe.operationBindings.includes(operation.operationId)
  ) || null;
}

async function preprocessExternalFileFields(body, context) {
  if (!body || typeof body !== "object") {
    return {
      changed: false,
      body,
      uploads: []
    };
  }

  const clonedBody = JSON.parse(JSON.stringify(body));
  const uploadedCache = await readJson(UPLOADED_FILE_CACHE_FILE, {});
  const uploads = [];
  let changed = false;

  async function visit(node, pathParts, parent, key) {
    if (Array.isArray(node)) {
      for (let index = 0; index < node.length; index += 1) {
        await visit(node[index], [...pathParts, `[${index}]`], node, index);
      }
      return;
    }

    if (node && typeof node === "object") {
      for (const [childKey, childValue] of Object.entries(node)) {
        await visit(childValue, [...pathParts, childKey], node, childKey);
      }
      return;
    }

    if (typeof node !== "string") {
      return;
    }

    const normalizedPath = normalizeNodePath(pathParts);
    const purpose = inferUploadPurpose(normalizedPath);
    if (!purpose) {
      return;
    }

    if (!isExternalFileUrl(node)) {
      return;
    }

    const cacheKey = `${purpose}:${node}`;
    let cachedUpload = uploadedCache[cacheKey] || null;
    if (!cachedUpload) {
      const remoteUpload = await callRemoteMcpTool("upload_external_file", {
        url: node,
        purpose,
        sourceKey: context.operation.sourceKey,
        module: context.operation.module,
        operationId: context.operation.operationId
      }, {
        requireLogin: Boolean(context.userTokenInfo && context.userTokenInfo.userToken),
        userTokenInfo: context.userTokenInfo,
        mcpConfig: context.mcpConfig
      });

      cachedUpload = {
        originalUrl: node,
        uploadedUrl: remoteUpload.upload.uploadedUrl,
        cacheKey: remoteUpload.upload.cacheKey,
        purpose,
        createdAt: safeDateString(),
        lastUsedAt: safeDateString()
      };
      uploadedCache[cacheKey] = cachedUpload;
    } else {
      cachedUpload.lastUsedAt = safeDateString();
    }

    parent[key] = cachedUpload.uploadedUrl;
    uploads.push(cachedUpload);
    changed = true;
  }

  await visit(clonedBody, [], null, null);

  if (changed) {
    await writeJson(UPLOADED_FILE_CACHE_FILE, uploadedCache);
  }

  return {
    changed,
    body: clonedBody,
    uploads
  };
}

function normalizeNodePath(pathParts) {
  return pathParts
    .reduce((acc, part) => {
      if (String(part).startsWith("[")) {
        const last = acc.pop() || "";
        acc.push(`${last}${part}`);
        return acc;
      }
      acc.push(String(part));
      return acc;
    }, [])
    .join(".");
}

function inferUploadPurpose(normalizedPath) {
  const matchedRule = FILE_PATH_PURPOSE_RULES.find(rule => rule.pattern.test(normalizedPath));
  if (matchedRule) {
    return matchedRule.purpose;
  }

  if (/(image|file|media|voucher|annex)/i.test(normalizedPath)) {
    return DEFAULT_FILE_UPLOAD_PURPOSE;
  }

  return null;
}

function isExternalFileUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return !INTERNAL_FILE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function normalizeAssistantType(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const aliasMap = {
    codex: "codex",
    "openai-codex": "codex",
    workbuddy: "workbuddy",
    wb: "workbuddy",
    cursor: "cursor",
    "cc-code": "cc-code",
    claude: "cc-code",
    "claude-code": "cc-code",
    xiaolongxia: "xiaolongxia",
    "xiao-long-xia": "xiaolongxia",
    mcporter: "xiaolongxia",
    xlx: "xiaolongxia"
  };

  return aliasMap[normalized] || null;
}

function detectAssistantTypes() {
  const home = os.homedir();
  const detected = new Set();

  if (process.env.CODEX_HOME || fileExists(path.join(home, ".codex", "config.toml")) || fileExists(path.join(home, ".codex"))) {
    detected.add("codex");
  }
  if (fileExists(path.join(home, ".workbuddy")) || fileExists(path.join(home, ".workbuddy", "mcp.json"))) {
    detected.add("workbuddy");
  }
  if (fileExists(path.join(home, ".cursor")) || fileExists(path.join(home, ".cursor", "mcp.json"))) {
    detected.add("cursor");
  }
  if (commandExists("claude")) {
    detected.add("cc-code");
  }
  if (fileExists(path.join(home, ".mcporter")) || fileExists(path.join(home, ".mcporter", "mcporter.json"))) {
    detected.add("xiaolongxia");
  }

  return SUPPORTED_ASSISTANT_TYPES.filter((item) => detected.has(item));
}

async function installMcpForAssistant(assistantType) {
  const home = os.homedir();
  await ensureProfileExport(DEFAULT_MCP_URL);

  switch (assistantType) {
    case "codex":
      return installCodexMcp(home);
    case "workbuddy":
      return installWorkbuddyMcp(home);
    case "cursor":
      return installCursorMcp(home);
    case "cc-code":
      return installClaudeCodeMcp();
    case "xiaolongxia":
      return installXiaolongxiaMcp(home);
    default:
      fail(`暂不支持的 assistant_type: ${assistantType}`);
  }
}

async function ensureProfileExport(mcpUrl) {
  const profile = pickShellProfile();
  const line = `export ESHETANG_MCP_URL="${mcpUrl}"`;
  await fsp.mkdir(path.dirname(profile), { recursive: true });

  let text = "";
  try {
    text = await fsp.readFile(profile, "utf8");
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  if (!text.includes("export ESHETANG_MCP_URL=")) {
    const prefix = text && !text.endsWith("\n") ? "\n" : "";
    await fsp.writeFile(profile, `${text}${prefix}${line}\n`, "utf8");
  }

  return profile;
}

function pickShellProfile() {
  const home = os.homedir();
  const bashrc = path.join(home, ".bashrc");
  if (fileExists(bashrc)) {
    return bashrc;
  }
  return path.join(home, ".zshrc");
}

async function installCodexMcp(home) {
  const configFile = path.join(home, ".codex", "config.toml");
  await fsp.mkdir(path.dirname(configFile), { recursive: true });
  let text = "";
  try {
    text = await fsp.readFile(configFile, "utf8");
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  const block = `[mcp_servers.eshetang]\nurl = "${DEFAULT_MCP_URL}"\n`;
  const pattern = /\n?\[mcp_servers\.eshetang\][\s\S]*?(?=\n\[[^\]]+\]|$)/m;
  if (pattern.test(text)) {
    text = text.replace(pattern, `\n${block}`);
  } else {
    if (text.trim() && !text.endsWith("\n")) {
      text += "\n";
    }
    text += `\n${block}`;
  }

  await fsp.writeFile(configFile, text, "utf8");
  return {
    installed: true,
    installMethod: "config_file",
    configFile,
    message: `已为 Codex 写入 MCP 配置：${configFile}`
  };
}

async function installWorkbuddyMcp(home) {
  const configFile = path.join(home, ".workbuddy", "mcp.json");
  await fsp.mkdir(path.dirname(configFile), { recursive: true });
  const json = await readJson(configFile, { mcpServers: {} });
  json.mcpServers = json.mcpServers || {};
  json.mcpServers.eshetang = { url: DEFAULT_MCP_URL, timeout: 600 };
  await writeJson(configFile, json);
  return {
    installed: true,
    installMethod: "config_file",
    configFile,
    message: `已为 WorkBuddy 写入 MCP 配置：${configFile}`
  };
}

async function installCursorMcp(home) {
  const configFile = path.join(home, ".cursor", "mcp.json");
  await fsp.mkdir(path.dirname(configFile), { recursive: true });
  const json = await readJson(configFile, { mcpServers: {} });
  json.mcpServers = json.mcpServers || {};
  json.mcpServers.eshetang = { url: DEFAULT_MCP_URL };
  await writeJson(configFile, json);
  return {
    installed: true,
    installMethod: "config_file",
    configFile,
    message: `已为 Cursor 写入 MCP 配置：${configFile}`
  };
}

async function installClaudeCodeMcp() {
  if (!commandExists("claude")) {
    fail("未找到 claude 命令，请先安装 Claude Code。");
  }

  const result = spawnSync("claude", [
    "mcp",
    "add",
    "--scope",
    "user",
    "--transport",
    "http",
    "eshetang",
    DEFAULT_MCP_URL
  ], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    fail(`Claude Code MCP 安装失败: ${(result.stderr || result.stdout || "").trim()}`);
  }

  return {
    installed: true,
    installMethod: "command",
    command: `claude mcp add --scope user --transport http eshetang ${DEFAULT_MCP_URL}`,
    message: "已为 Claude Code 安装 eshetang MCP。"
  };
}

async function installXiaolongxiaMcp(home) {
  const configFile = path.join(home, ".mcporter", "mcporter.json");
  await fsp.mkdir(path.dirname(configFile), { recursive: true });
  const json = await readJson(configFile, { mcpServers: {} });
  json.mcpServers = json.mcpServers || {};
  json.mcpServers.eshetang = { url: DEFAULT_MCP_URL, transportType: "streamable-http" };
  await writeJson(configFile, json);
  return {
    installed: true,
    installMethod: "config_file",
    configFile,
    message: `已为小龙虾/mcporter 写入 MCP 配置：${configFile}`
  };
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0;
}

async function loadMcpConfig() {
  for (const key of MCP_URL_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return {
        mcpUrl: value.trim(),
        business: DEFAULT_MCP_BUSINESS,
        bffBaseUrl: DEFAULT_MCP_BFF_BASE_URL,
        updatedAt: null,
        source: "env",
        envKey: key
      };
    }
  }

  return {
    mcpUrl: DEFAULT_MCP_URL,
    business: DEFAULT_MCP_BUSINESS,
    bffBaseUrl: DEFAULT_MCP_BFF_BASE_URL,
    updatedAt: null,
    source: "default"
  };
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
    updatedAt: config.updatedAt || null,
    source: config.source || "unknown",
    envKey: config.envKey || null
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
