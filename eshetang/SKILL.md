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

这些 recipe 不是“记住一个最终写接口”这么简单，而是把页面操作里的整段数据流还原出来：
- 先调哪些枚举和选择器接口
- 哪些 ID 来自前置接口，而不是用户自然语言
- 哪些字段是详情回填
- 哪些字段变化后必须重跑上游接口
- 最终 payload 如何拼出来

### 1. `inventory_add_goods`

固定顺序：
- 读取店铺枚举
- 按分类加载分类特有参数
- 可选图片识款
- 读取标签列表
- 按分类选择品牌
- 按品牌选择系列
- 按分类/品牌/系列选择型号
- 选择仓库和库位
- 可选智能填充基础信息
- 预处理并上传所有媒体
- 创建库存

核心接口：
- `StockEnumController_shopComboBox`
- `InventoryStockController_argumentList`
- `InventoryTagController_list`
- `InventoryTagController_create`
- `SkuController_imageRecognizeSpuSku`
- `BrandController_group`
- `SeriesController_list`
- `SkuController_listV2`
- `InventoryWarehouseController_reservoirList`
- `PostController_analysisContent`
- `InventoryStockController_create`

关键字段来源必须完整还原：
- `categoryId`
  来自店铺枚举 `GET /stock/enum/shop/combo-box`
- `argumentList`
  来自 `GET /stock/inventory/stock/argument/list?categoryId=...`
- `brandId`
  来自 `GET /product/brand/group?categoryId=...`
- `seriesId`
  来自 `GET /product/series?categoryId=...&brandId=...`
- `skuId` / `skuName` / `officialPrice`
  来自 `GET /product/sku/v2`
- `warehouseId` / `reservoirId`
  来自 `GET /stock/inventory/warehouse-reservoir/list`
- `finenessValueId` / `priceList` / `recycle` / `annex`
  来自店铺枚举 `GET /stock/enum/shop/combo-box`
- `tagList`
  来自 `GET /stock/inventory/tag/list`，若页面新建标签则先 `POST /stock/inventory/tag/create`
- `imageList` / `detailsImageList` / `costList[].imageList` / `recycle.imageList` / `annex.imageList`
  先走上传，再写回最终 payload

提交体组装必须覆盖：
- 基础字段：`categoryId`、`imageList`、`detailsImageList`、`description`、`finenessValueId`
- SKU 字段：`brandId`、`seriesId`、`skuId`、`skuName`、`officialPrice`
- 分类参数：`argumentList`
- 成本和售价：`originalCost`、`costList`、`priceList`
- 库存位置：`warehouseId`、`reservoirId`
- 扩展字段：`remarkList`、`tagList`、`annex`、`recycle`、`count`、`identifier`、`seriesNumber`、`syncRangList`
- 条件字段：`pledge`、`goodsContact`

关键校验：
- `imageList` 至少 1 张
- `finenessValueId` 必填
- `description` 必填
- `goodsSource` 必填
- `goodsSource=PLEDGE` 时必须有 `pledge.pledgeExpireTime`
- 同步同行圈时，`priceList` 中同行价字段必填

### 2. `inventory_edit_goods`

固定顺序：
- 读取店铺枚举
- 读取库存详情并回填
- 如果用户修改分类，重新加载分类特有参数
- 如果用户修改标签，重新读取标签列表或先创建新标签
- 如果用户修改品牌/系列/型号，重新走对应选择接口
- 如果用户修改仓库位置，重新走仓库-库位选择接口
- 预处理并上传所有媒体
- 更新库存

核心接口：
- `StockEnumController_shopComboBox`
- `InventoryStockController_detail`
- `InventoryStockController_argumentList`
- `BrandController_group`
- `SeriesController_list`
- `SkuController_listV2`
- `InventoryTagController_list`
- `InventoryTagController_create`
- `InventoryWarehouseController_reservoirList`
- `InventoryStockController_update`

编辑场景的核心规则：
- 先 `GET /stock/inventory/stock/detail`，把详情作为初始表单状态
- 用户没改的字段沿用详情值
- 用户一旦改了 `categoryId`，必须重跑：
  - `GET /stock/inventory/stock/argument/list`
  - `GET /product/brand/group`
  - `GET /product/series`
  - `GET /product/sku/v2`
- 用户改了 `brandId`，必须重跑：
  - `GET /product/series`
  - `GET /product/sku/v2`
- 用户改了 `seriesId`，必须重跑：
  - `GET /product/sku/v2`
- 用户改了仓库位置，必须重跑：
  - `GET /stock/inventory/warehouse-reservoir/list`
- 所有新增外部文件地址仍然必须先上传再提交

### 3. `inventory_view_goods`

固定顺序：
- 读取库存详情
- 拆分可见按钮
- 解析 `buttonList`
- 解析 `routeInfo`
- 推导后续可执行动作

核心接口：
- `InventoryStockController_detail`
- `InventoryStockController_detailShare`

注意：
- 如果普通详情返回 `subCode=403`，说明当前只能走分享态，改用 `GET /stock/inventory/stock/detail/share`
- 后续可执行动作不是静态假定，而是由库存详情返回的 `buttonList` 和 `routeInfo` 决定
- 详情里需要重点读取：
  - `subCode`
  - `status`
  - `buttonList`
  - `routeInfo`
  - `lockInfo`
  - `onlineStatus`
  - `goodsSource`
  - `skuInfo`
  - `argumentList`
  - `positionInfo`
  - `imageList`
  - `detailsImageList`
  - `priceList`
  - `costList`
  - `annex`
  - `recycle`
  - `buttonTips`
  - `logList`
  - `stockSyncConfigList`
  - `syncProduct`
  - `shopInfo`
  - `goodsNo`
  - `warehouseId`
  - `reservoirId`
  - `noPaiPaiPermissionUrl`
  - `relateOrderNo`
  - `sheetSn`

详情字段如何驱动后续动作：
- `buttonList`
  只处理 `status=show` 的按钮；这决定某个动作当前是否真的可执行
- `buttonList.code + level`
  页面会把按钮拆成左右两组：
  - `code=relocation` 或 `level in [primary, secondary]` 进入主操作区
  - 其余可见按钮进入次操作区
- `routeInfo.inStock.redirectType.params.skipUrl`
  驱动 `createOrder`
- `routeInfo.lock.redirectType.params.skipUrl`
  驱动普通锁单
- `routeInfo.deliveryLock.redirectType.params.skipUrl`
  驱动“需要发货”的锁单链路
- `routeInfo.log.redirectType.params.skipUrl`
  驱动“查看变更日志”
- `lockInfo.lockOrderNo`
  驱动 `unlock`
- `warehouseId / reservoirId / positionInfo`
  驱动 `relocation`
- `stockNo`
  驱动 `edit`、`copyInWarehouse`、`print`、`online`、`offline`、删除/恢复/盘亏等库存动作
- `goodsNo / smuId`
  驱动部分拍卖或跨语义动作
- `syncProduct.list`
  驱动同步平台开关与后续同步动作
- `noPaiPaiPermissionUrl`
  会拦截部分同步平台动作，要求先跳转处理权限

顶部状态提示也来自详情，不要自己猜：
- `status=2` 且 `lockInfo.operatorName + lockInfo.dtCreated` 存在时，展示锁单/开单提示
- `pledge.pledgeExpireTime` 存在时，展示质押到期提示
- `buttonTips` 存在时，展示按钮上方提示文案

### 4. `offline_order_create`

固定顺序：
- 读取通用枚举
- 读取店铺枚举
- 读取员工列表
- 按 query 分支加载预填详情
- 如需新增订单类型/售后保障，先新增店铺配置值
- 预处理商品图、收款凭证、结款凭证
- 创建或更新订单

核心接口：
- `StockEnumController_comboBox`
- `StockEnumController_shopComboBox`
- `StockBusinessController_commonList`
- `InventoryStockController_detail`
- `StockOrderLockController_detail`
- `StockOrderOfflineController_detail`
- `StockShopController_settingValuesAdd`
- `StockOrderOfflineController_create`
- `StockOrderOfflineController_update`

必须先理解 4 个真实分支：
- `source=goods && inStock=1 && mode!=edit`
  在库商品开单
  先 `GET /stock/inventory/stock/detail`
- `source=lockOrder`
  锁单转开单
  先 `GET /stock/order/lock/detail`
- `source=goods && mode=edit`
  编辑已有订单
  先 `GET /stock/order/offline/detail`
- `source=goods && inStock=0 && mode!=edit`
  不在库商品开单
  没有商品详情预填，商品信息来自用户输入

字段来源必须完整还原：
- `type` / `typeDesc`
  来自 `GET /stock/enum/shop/combo-box`
- `aftersale` / `aftersaleDesc`
  来自 `GET /stock/enum/shop/combo-box`
- `saleUserIds` / `saleUserName`
  来自 `GET /stock/business/common/list`
- `paidInfo.paidStatus` / `paidInfo.paidMethod`
  来自 `GET /stock/enum/combo-box`
- `settleInfo.settleStatus`
  来自 `GET /stock/enum/combo-box`
- 在库开单的 `goodsInfo`
  来自 `GET /stock/inventory/stock/detail`
- 锁单转开单的 `deposit` / `actualPrice` / `customer*` / `saleUserIds`
  来自 `GET /stock/order/lock/detail`
- 编辑订单的整表单基线
  来自 `GET /stock/order/offline/detail`
- 不在库开单的 `goodsInfo.name` / `goodsInfo.goodsSource` / `goodsInfo.categoryId`
  来自用户输入
- 不在库开单的 `goodsInfo.brandId`
  来自品牌选择接口 `GET /product/brand/group`

提交规则：
- 创建走 `POST /stock/order/offline/create`
- 编辑走 `POST /stock/order/offline/update`
- `source=lockOrder` 且不是编辑时，create payload 必须带 `lockNo`
- 编辑时 payload 必须带 `wmsOrderNo`
- 编辑订单时不再提交 `goodsInfo`

文件字段规则：
- `goodsInfo.imageList[].url`
- `paidInfo.paidVoucher[]`
- `settleInfo.settleVoucher[]`

这些外部地址都必须先上传，再写回 payload。

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
- 如果某个场景在源码中无法完整还原出接口数据流，就不要把它固化成 recipe
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
