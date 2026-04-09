---
name: eshetang
description: "易奢堂后台管理工具。负责扫码登录、选店换 token、同步远端聚合接口文档到本地、命中高频 recipe 并执行远端业务接口。"
description_zh: "易奢堂扫码登录、本地文档缓存、库存与订单业务编排"
description_en: "Eshetang login, local API doc cache, stock/order orchestration"
---

# 易奢堂 Skill

这套 skill 现在分成三段能力：

1. 本地登录
   - 打开易奢堂后台登录页
   - 生成二维码
   - 等待扫码成功
   - 如有多店铺，列出店铺并完成选店
   - 保存最终 `userToken`

2. 文档同步与本地索引
   - 通过远端 MCP 的 `get_api_doc_version` 查询版本
   - 如果本地没有缓存或版本变化，则拉取 `get_api_doc_document`
   - 把文档写到本地 `data/`
   - 建立本地索引与高频场景 recipe

3. 业务执行
   - 优先命中高频 recipe
   - 未命中时，从本地缓存文档读取接口定义
   - 执行前统一扫描 payload 中的文件字段
   - 所有外部文件地址必须先经 `upload_external_file` 转成平台文件地址
   - 最终调用 `invoke_api_operation`

## 前置规则

环境检查仍然是所有实际操作的前置条件。

- 扫码登录、二维码截图、选店依赖本地 Playwright 与 Chromium
- 任何需要登录态的远端业务接口都依赖最终 `userToken`
- 远端文档同步与远端上传工具也通过同一个 MCP 会话完成

如果环境未准备好：
- 先返回安装计划
- 列出缺失工具与用途
- 询问用户是否开始安装
- 不继续后续流程

`install-check.sh` 是最终环境检查脚本：

```bash
./scripts/install-check.sh
```

## 业务语义约定

在当前业务里，用户口中的“商品”默认按“库存”理解。

也就是说：
- “查商品” 优先理解为 “查库存”
- “新增商品” 优先理解为 “创建库存”
- “修改商品” 优先理解为 “修改库存”

不要优先走 `product-json` 下的 `商品管理`、`商品管理 v3`、`商品管理 v4`、`管货商品管理` 接口；这些接口在远端 MCP 中已隐藏。优先走 `stock` 相关接口，尤其是 `库存模块`。

## 文档同步策略

在执行任何业务编排前，都先做一次文档同步检查：

1. 调 `get_api_doc_version`
2. 如果本地无缓存，或 `fingerprint/version` 变化，再调 `get_api_doc_document`
3. 将文档保存到本地：
   - `data/api-doc-version.json`
   - `data/api-doc-document.json`
   - `data/api-doc-index.json`
4. 后续接口查看优先从本地缓存读取，不再远端搜索接口

本地可用工具：
- `sync_api_doc`
- `get_cached_api_doc_summary`
- `get_cached_api_operation_details`
- `get_scenario_recipe`

## 文件地址硬规则

这条规则必须严格执行：

- 所有外部文件地址都不能直接传给业务接口
- 必须先调用 `upload_external_file`
- 让远端上传模块把外部 URL 转成平台服务器文件地址
- 再把新的服务器文件地址写回最终 payload
- 如果本地上传缓存命中，可以直接复用，不重复上传

重点扫描字段至少包括：
- `imageList[].fileUrl`
- `detailsImageList[].fileUrl`
- `annex.imageList[].fileUrl`
- `costList[].imageList[].fileUrl`
- `recycle.imageList[].fileUrl`
- `paidInfo.paidVoucher[]`
- `settleInfo.settleVoucher[]`

## 高频 recipe

### 1. 新增商品 / 新增库存

固定顺序：
- 品牌下拉
- 分类下拉
- 系列下拉
- 仓库列表
- 文件预处理
- 新建库存

核心接口：
- `BrandController_comboBox`
- `CategoryController_stockCategoryList`
- `SeriesController_comboBox`
- `InventoryWarehouseController_list`
- `InventoryStockController_create`

### 2. 商品卖出 / 开单

固定顺序：
- 员工枚举
- 店铺订单类型枚举
- 文件预处理
- 订单创建

核心接口：
- `BusinessController_comboBox`
- `StockEnumController_shopComboBox`
- `StockOrderOfflineController_create`

### 3. 查询库存订单详情

固定顺序：
- 订单列表
- 订单详情

核心接口：
- `StockOrderOfflineController_list`
- `StockOrderOfflineController_detail`

### 4. 任意带文件参数的写接口

固定顺序：
- 从本地文档解析接口
- 扫描 payload 文件字段
- 对外部 URL 逐个上传并回填
- 再执行最终接口

## 必填参数规则

- 如果接口参数是必填项，但你无法从当前上下文、用户历史回复、接口默认值、或前置接口返回结果中明确得到它，就必须先询问用户
- 不能为了继续流程自行猜测品牌、分类、仓库、店铺、日期、状态、分页条件、业务类型、销售员、订单类型等必填参数
- 只有非必填参数，在用户没有明确表达需要时，才可以先忽略

## MCP / 本地工具

### 远端 MCP 工具

- `get_api_doc_version`
- `get_api_doc_document`
- `upload_external_file`
- `invoke_api_operation`

### 本地 skill 工具

- `install_mcp`
- `check_login_status`
- `get_login_qrcode`
- `login_flow`
- `list_shops`
- `select_shop`
- `get_user_token`
- `delete_session`
- `get_mcp_config`
- `get_integration_status`
- `sync_api_doc`
- `get_cached_api_doc_summary`
- `get_cached_api_operation_details`
- `get_scenario_recipe`

## 显式引用 `$eshetang` 时的要求

- 如果需求在当前能力范围内，直接执行
- 如果做不到，明确告诉用户当前缺什么
- 不再默认先走远端搜索接口
- 优先走本地 recipe / 本地文档
- 真正调用前，必须确保文件字段已经完成上传替换

## 常用命令

```bash
cd scripts
./install-check.sh
./tool-call.sh get_integration_status
./tool-call.sh login_flow
./tool-call.sh login_flow '{"shop_index":1}'
./tool-call.sh sync_api_doc
./tool-call.sh get_cached_api_doc_summary
./tool-call.sh get_cached_api_operation_details '{"operationId":"InventoryStockController_create"}'
./tool-call.sh get_scenario_recipe '{"intent":"新增商品"}'
./tool-call.sh upload_external_file '{"url":"https://example.com/a.jpg","purpose":"stock"}'
```
