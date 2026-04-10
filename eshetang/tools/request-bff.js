#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://bff.eshetang.com";
const rootDir = path.resolve(__dirname, "..");
const tokenPath = path.join(rootDir, "data", "user-token.json");
const INTERNAL_FILE_HOSTS = [
  "eshetang.com",
  "imgs.eshetang.com"
];

function fail(message, extra) {
  const payload = { ok: false, message };
  if (extra !== undefined) payload.extra = extra;
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

function loadToken() {
  if (!fs.existsSync(tokenPath)) {
    fail("缺少 user token 文件", { tokenPath });
  }

  try {
    const raw = fs.readFileSync(tokenPath, "utf8");
    const json = JSON.parse(raw);
    const userToken =
      json.userToken ||
      json.token ||
      json.data?.userToken ||
      json.data?.token;

    if (!userToken) {
      fail("user token 文件中未找到 userToken", { tokenPath });
    }

    return userToken;
  } catch (error) {
    fail("读取 user token 文件失败", { tokenPath, error: error.message });
  }
}

function parsePayload(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail("请求参数不是合法 JSON", { raw, error: error.message });
  }
}

async function main() {
  const [, , methodArg, routeArg, payloadArg] = process.argv;

  if (!methodArg || !routeArg) {
    fail("用法错误", {
      usage: [
        "node tools/request-bff.js GET /stock/enum/shop/combo-box",
        "node tools/request-bff.js GET /product/series '{\"categoryId\":1,\"brandId\":2}'",
        "node tools/request-bff.js POST /stock/inventory/stock/create '{\"categoryId\":1}'",
        "node tools/request-bff.js UPLOAD /common/upload/file '{\"file\":\"/path/to/a.jpg\",\"type\":\"stock\"}'",
      ],
    });
  }

  const method = methodArg.toUpperCase();
  const payload = parsePayload(payloadArg);
  const userToken = loadToken();
  const business = process.env.ESHETANG_BUSINESS || "saas_merchant";

  const url = new URL(routeArg, BASE_URL);

  const headers = {
    usertoken: userToken,
    business,
    accept: "application/json",
  };

  const requestInit = {
    method,
    headers,
  };

  if (method === "UPLOAD") {
    const filePath = payload.file || payload.filePath;
    if (!filePath || typeof filePath !== "string") {
      fail("UPLOAD 需要传 file 或 filePath", { payload });
    }
    if (!fs.existsSync(filePath)) {
      fail("上传文件不存在", { filePath });
    }

    const form = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    form.append("file", new Blob([fileBuffer]), fileName);
    form.append("type", payload.type || "stock");
    if (payload.rename !== undefined) {
      form.append("rename", String(payload.rename));
    }

    requestInit.method = "POST";
    requestInit.body = form;
  } else if (method === "GET") {
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  } else {
    headers["content-type"] = "application/json";
    requestInit.body = JSON.stringify(payload);
  }

  let response;
  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    fail("请求 BFF 失败", {
      method,
      url: url.toString(),
      error: error.message,
    });
  }

  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}

  const output = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    method,
    route: routeArg,
    url: url.toString(),
    data,
  };

  if (data && typeof data === "object" && typeof data.url === "string") {
    output.relativeUrl = toRelativeFilePath(data.url);
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!response.ok) {
    process.exit(1);
  }
}

function toRelativeFilePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return value;
  }

  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  try {
    const url = new URL(trimmed);
    if (INTERNAL_FILE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return url.pathname.replace(/^\/+/, "");
    }
  } catch (_) {}

  return trimmed;
}

main();
