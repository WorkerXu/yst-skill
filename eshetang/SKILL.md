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
- 除登录相关工具外，任何 skill 工具都必须在扫码登录并完成选店后才能使用
- 未登录时，不要先跑 recipe、不要先同步文档、不要先查远端样例、不要先开始缺参分析

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

在执行任何业务编排前，都先确认已经登录，再做一次文档同步检查：

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

远端排错工具：
- `get_api_operation_latest_example`

## 文件地址硬规则

这条规则必须严格执行：

- 所有外部文件地址都不能直接传给业务接口
- 必须先调用 `upload_external_file`
- 让远端上传模块把外部 URL 转成平台服务器文件地址
- 再把新的服务器文件地址写回最终 payload
- 如果上传接口返回完整 URL，例如 `https://imgs.eshetang.com/stock/xxx.jpg?...`
  写入 payload 前必须转成相对路径：
  `stock/xxx.jpg?...`
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

## 调用样例排错规则

`get_api_operation_latest_example` 已恢复，但只能用于排错，不能作为常规流程依赖。

### 允许在以下情况调用

- `invoke_api_operation` 已经调用失败
- 或者当前已经能确定接口，但无法从上下文、recipe、接口文档唯一确定某个参数的具体格式
- 例如不确定 query/body/path 里该传字符串、数组、对象、嵌套层级、枚举格式或字段形状

### 明确禁止

- 不要在正常流程里预先调用它
- 不要把它当成接口发现工具
- 不要在还没进入具体接口组装阶段时就先查样例
- 不要因为“想更稳一点”就把它当成所有接口的默认前置步骤

### 调用后的使用方式

- 只把它当作“最近 3 次成功调用的脱敏参考结构”
- 重点看：
  - query 是否有这个字段
  - body 是对象还是数组
  - 某个字段是否在嵌套对象内
  - 枚举字段大致长什么样
  - 哪些字段通常根本不会传
- 不要把样例中的真实值原样复用
- 即使是样例返回的数据，也要继续遵守“关键参数不能猜”的规则

### 脱敏要求

- 样例返回的所有关键值都应视为脱敏后的结构参考
- 允许参考结构，不允许依赖真实业务值

## 缺参时的交互规则

这是强约束：

- 当关键参数暂时无法通过当前 recipe、本地文档、前置接口、用户上下文唯一获得时，不要反复让用户“稍等”并继续自己尝试
- 先停止自动重试
- 先把当前缺失项、失败原因、你原本打算继续尝试的路径、以及可选备选方案一次性告诉用户
- 再让用户回复一个极简答案继续

### 必须使用的回复结构

当卡住时，按这个顺序回复：

1. 当前缺少哪些关键参数
2. 每个参数为什么现在拿不到
3. 我已经尝试过或原计划尝试的路径
4. 接下来可选的 1-3 个方案
5. 请用户直接回复最短指令

### 推荐输出格式

- 先用一句话说明“当前还缺哪些信息”
- 然后用 `1. 2. 3.` 这种短编号列出缺项
- 每一项都直接写：
  - 这是什么业务信息
  - 当前为什么拿不到
  - 用户可直接选什么
- 如果有候选项，只列最相关的前 3 个
- 最后单独给一行“请直接回复，例如：...”

推荐直接按下面这种风格回复用户：

```md
还需要你确认这些信息：

1. 品牌：
   现在还没拿到你店铺里可用的品牌 ID。
   你可以直接回复：江诗丹顿 / 继续查品牌

2. 仓库：
   最终入库必须落到你店铺的实际仓库。
   你可以直接回复：主仓库 / 继续查仓库

请直接回复，例如：江诗丹顿 主仓库
```

### 输出风格优化要求

- 默认控制在 8-15 行内，尽量短
- 优先使用“短标题 + 编号列表 + 直接回复示例”的样式
- 如果某个字段有固定可选值，必须直接列出可选值，不要让用户自己猜
- 如果已拿到部分前置结果，只保留和当前决策直接相关的 2-4 项，不要把整段排查过程都贴出来
- 不要把内部排查细节、长接口路径、分数字段、低相关候选项默认全部展示给用户
- 如果用户只需要做一个选择，就只展示那个选择，不要顺带堆太多背景

### 当字段存在固定可选值时

必须这样展示：

```md
还需要你确认 2 项：

1. 商品来源：
   自有 / 寄售 / 质押

2. 上架状态：
   上架 / 不上架

请直接回复，例如：
`自有 不上架`
```

### 当存在候选匹配项时

用短编号列出，不要长段落，也不要表格：

```md
还需要你确认 1 项：

1. 标准型号：
   还没完全匹配上，当前最接近的是：
   1. 85180/000R-9248，银色盘 / 自动机械 / 40mm
   2. 85180/000J-9231，银白盘 / 自动机械 / 40mm
   可直接回复：选 1 / 继续查 H116 / 先不绑定
```

### 针对“还缺业务项 + 型号候选”的推荐版式

像“型号没完全命中，同时还缺成色/来源/上架状态”这种情况，优先用下面这种两段式：

```md
还需要你确认这些信息：

1. 标准型号：
   还没精确命中，当前最接近的是：
   1. 85180/000R-9248，银色盘 / 自动机械 / 40mm
   2. 85180/000J-9231，银白盘 / 自动机械 / 40mm
   可直接回复：选 1 / 继续查 / 先不绑定

2. 成色：
   新增库存必填。
   可直接回复：全新 / A / B / C

3. 商品来源：
   自有 / 寄售 / 质押

4. 上架状态：
   上架 / 不上架

请直接回复，例如：
`选 1 A 自有 不上架`
```

重点：
- 缺失项和候选项分开，不要混成大段说明
- 用户可选值直接写在每一项下面
- 最后一行一定给出可直接复制式回复示例

### 什么时候必须触发这条规则

- recipe 里 requiredUserInputs / conditionalRequiredUserInputs 缺失时
- 前置接口返回为空、字段缺失、分支不满足时
- 当前场景存在多个业务分支，但缺少决定分支的参数时
- 本地文档里能看到接口，但无法唯一确定应该调用哪一个时
- 当前代码只能部分还原流程，无法安全继续时

### 明确禁止

- 不要连续多轮只说“我继续试试”“请稍等”“我再检查一下”
- 不要在缺少关键参数时静默重试多个高风险写接口
- 不要把应该由用户确认的业务选择伪装成“自动推断结果”

## 写入前确认规则

这是所有写操作的强约束：

- 在执行任何新增、修改、创建、更新、提交、确认类写接口前，必须先向用户展示一份“即将写入的数据确认单”
- 用户明确确认前，不能真正调用写接口
- 这条规则适用于：
  - 创建库存
  - 修改库存
  - 开单
  - 编辑订单
  - 确认收款
  - 确认结款
  - 以及其他任何会修改服务端数据的接口

### 展示方式要求

- 不要直接使用 API 参数名
- 不要把 `categoryId`、`saleUserIds`、`paidInfo`、`settleInfo` 这类字段名直接展示给用户
- 必须翻译成自然语言业务表达

例如要写成：
- 商品分类：腕表
- 品牌：江诗丹顿
- 系列：纵横四海
- 型号：4500V/210A-B128
- 成交价：18500
- 销售人员：御顺堂
- 收款状态：未付款

不要写成：
- `categoryId: 102`
- `brandId: 1020`
- `saleUserIds: 8512`
- `paidInfo.paidStatus: 0`

### 确认单必须包含

1. 这次要执行的业务动作
2. 用户最关心的业务字段
3. 关键金额、状态、人员、商品信息
4. 如果有文件，也要说明会写入哪些图片/凭证
5. 一句明确的确认提示

### 推荐确认话术

可以按这种风格：

```text
请先确认这次要提交的数据：

- 操作：创建线下订单
- 商品：江诗丹顿 纵横四海 4500V/210A-B128
- 开单方式：在库商品开单
- 成交价：18500
- 订单类型：客户订单
- 销售人员：御顺堂
- 销售时间：2026-04-09
- 收款状态：未付款

确认无误请直接回复：`确认`
如果要改，直接回复你要修改的那一项即可。
```

### 例外

- 纯查询接口不需要确认
- 纯本地分析、本地文档同步、本地缓存更新不需要确认
- 只要会写服务端数据，就一定要先确认

## MCP / 本地工具

### 远端 MCP 工具

- `get_api_doc_version`
- `get_api_doc_document`
- `get_api_operation_latest_example`
- `upload_external_file`
- `invoke_api_operation`
- `call_remote_mcp_tool`

### 本地 skill 工具

- `install_mcp`
- `check_login_status`
- `get_login_qrcode`
- `login_flow`
- `list_shops`
- `select_shop`
- `get_user_token`
- `delete_session`
- `set_mcp_config`
- `get_mcp_config`
- `get_integration_status`
- `sync_api_doc`
- `get_cached_api_doc_summary`
- `get_cached_api_operation_details`
- `get_scenario_recipe`

## CLI 调用格式约定

`./scripts/tool-call.sh` 的用法固定是：

```bash
./scripts/tool-call.sh <tool_name> '<json_args>'
```

调用约定：

- 第二个参数就是当前工具自己的 JSON 参数
- 直接调用工具时，参数放在顶层
- 只有 `call_remote_mcp_tool` 这个通用代理，外层才使用 `tool_name` 和 `tool_args`
- 本地 CLI 约定优先使用下划线字段名，如 `scan_token`、`tool_name`、`tool_args`

## 工具使用方法

下面的示例都可以直接在 skill 根目录执行：

```bash
cd /Users/coderxu/Downloads/小红书/yst-skill/eshetang
```

### 登录与会话

#### `check_login_status`

用途：
- 检查当前本地登录态
- 查看是否已经拿到最终 `userToken`

参数：
- 无

示例：

```bash
./scripts/tool-call.sh check_login_status
```

#### `get_login_qrcode`

用途：
- 生成登录二维码
- 启动后台等待扫码 worker

参数：
- `timeout_seconds`
  可选，二维码等待超时秒数

示例：

```bash
./scripts/tool-call.sh get_login_qrcode
./scripts/tool-call.sh get_login_qrcode '{"timeout_seconds":180}'
```

#### `login_flow`

用途：
- 对话式登录入口
- 自动判断当前是待扫码、待选店还是已登录
- 也可以在同一入口里直接完成选店

参数：
- `scan_token`
  可选，显式指定扫码 token
- `shop_index`
  可选，按店铺列表编号选店
- `account_user_id`
  可选，按账号 ID 选店
- `enterprise_no`
  可选，按店铺号选店

示例：

```bash
./scripts/tool-call.sh login_flow
./scripts/tool-call.sh login_flow '{"shop_index":1}'
./scripts/tool-call.sh login_flow '{"account_user_id":123456}'
./scripts/tool-call.sh login_flow '{"enterprise_no":"E12345"}'
```

#### `list_shops`

用途：
- 扫码成功后列出可选店铺

参数：
- `scan_token`
  可选；不传时会自动从本地缓存和状态文件中读取

示例：

```bash
./scripts/tool-call.sh list_shops
./scripts/tool-call.sh list_shops '{"scan_token":"your-scan-token"}'
```

#### `select_shop`

用途：
- 选定店铺并换取最终 `userToken`

参数：
- `scan_token`
  可选；不传时自动读取
- `shop_index`
  可选，按店铺序号选
- `account_user_id`
  可选，按账号 ID 选
- `enterprise_no`
  可选，按店铺号选

示例：

```bash
./scripts/tool-call.sh select_shop '{"shop_index":1}'
./scripts/tool-call.sh select_shop '{"account_user_id":123456}'
./scripts/tool-call.sh select_shop '{"enterprise_no":"E12345"}'
```

#### `get_user_token`

用途：
- 读取并在线校验当前最终 `userToken`

参数：
- 无

示例：

```bash
./scripts/tool-call.sh get_user_token
```

#### `delete_session`

用途：
- 清理本地登录态、二维码缓存和状态文件

参数：
- 无

示例：

```bash
./scripts/tool-call.sh delete_session
```

### 环境与 MCP

#### `install_mcp`

用途：
- 检查依赖
- 自动为当前助理安装 MCP 配置

参数：
- `confirm`
  可选，传 `true` 表示确认安装
- `start_install`
  可选，等价于确认安装
- `assistant_type`
  可选，指定助理类型，如 `codex`、`workbuddy`、`cursor`、`cc-code`、`openclaw`
- `platform`
  可选，作为 `assistant_type` 的别名
- `assistantType`
  可选，作为 `assistant_type` 的兼容别名

示例：

```bash
./scripts/tool-call.sh install_mcp
./scripts/tool-call.sh install_mcp '{"confirm":true,"assistant_type":"codex"}'
```

#### `set_mcp_config`

用途：
- 查看当前 MCP 配置说明
- 提示通过 `install_mcp` 或环境变量配置地址

参数：
- 无

示例：

```bash
./scripts/tool-call.sh set_mcp_config
```

#### `get_mcp_config`

用途：
- 读取当前 MCP 配置

参数：
- 无

示例：

```bash
./scripts/tool-call.sh get_mcp_config
```

#### `get_integration_status`

用途：
- 联合查看登录态、本地 token、MCP 配置和远端文档连通性

参数：
- 无

示例：

```bash
./scripts/tool-call.sh get_integration_status
```

### 文档与本地索引

#### `sync_api_doc`

用途：
- 检查远端接口文档版本
- 如有变化则同步到本地缓存

参数：
- `force`
  可选，传 `true` 表示强制重新同步

示例：

```bash
./scripts/tool-call.sh sync_api_doc
./scripts/tool-call.sh sync_api_doc '{"force":true}'
```

#### `get_cached_api_doc_summary`

用途：
- 查看本地接口文档摘要
- 包括版本、模块数、接口数和 recipe 绑定情况

参数：
- `force`
  可选，传 `true` 时先检查远端版本再返回摘要

示例：

```bash
./scripts/tool-call.sh get_cached_api_doc_summary
./scripts/tool-call.sh get_cached_api_doc_summary '{"force":true}'
```

#### `get_cached_api_operation_details`

用途：
- 从本地缓存中查看某个接口的完整定义

参数：
- `operationId`
  可选，优先按接口 ID 定位
- `path`
  可选，按路径定位时使用
- `method`
  可选，按路径定位时使用
- `sourceKey`
  可选，建议与 `path + method` 一起传
- `force`
  可选，先强制同步文档再查

示例：

```bash
./scripts/tool-call.sh get_cached_api_operation_details '{"operationId":"InventoryStockController_create"}'
./scripts/tool-call.sh get_cached_api_operation_details '{"path":"/stock/order/offline/create","method":"POST","sourceKey":"stock"}'
```

#### `get_scenario_recipe`

用途：
- 查看已内置的高频业务 recipe

参数：
- `scenarioKey`
  可选，直接按场景键查询
- `intent`
  可选，按自然语言意图匹配

示例：

```bash
./scripts/tool-call.sh get_scenario_recipe '{"scenarioKey":"offline_order_create"}'
./scripts/tool-call.sh get_scenario_recipe '{"intent":"新增商品"}'
```

### 远端 MCP 工具

#### `get_api_doc_version`

用途：
- 直接查询远端接口文档版本

参数：
- 无

示例：

```bash
./scripts/tool-call.sh get_api_doc_version
```

#### `get_api_doc_document`

用途：
- 直接获取远端完整接口文档

参数：
- 无

示例：

```bash
./scripts/tool-call.sh get_api_doc_document
```

#### `get_api_operation_latest_example`

用途：
- 查看某个接口最近 3 条脱敏成功样例
- 仅用于参数结构排错

参数：
- `operationId`
  建议传
- `path`
  建议与 `method` 一起传
- `method`
  建议与 `path` 一起传
- `sourceKey`
  建议补齐
- `errorContext`
  可选，补充当前错误上下文

示例：

```bash
./scripts/tool-call.sh get_api_operation_latest_example '{
  "operationId":"StockOrderOfflineController_create",
  "path":"/stock/order/offline/create",
  "method":"POST",
  "sourceKey":"stock"
}'
```

#### `upload_external_file`

用途：
- 把外部文件地址上传成平台可用文件地址

参数：
- `url`
  必填，外部文件 URL
- `purpose`
  必填，上传用途，如 `stock`
- `sourceKey`
  可选，建议补齐模块来源
- `module`
  可选，建议补齐模块名
- `operationId`
  可选，建议补齐当前业务接口 ID

示例：

```bash
./scripts/tool-call.sh upload_external_file '{
  "url":"https://example.com/a.jpg",
  "purpose":"stock",
  "sourceKey":"stock",
  "operationId":"StockOrderOfflineController_create"
}'
```

#### `invoke_api_operation`

用途：
- 调用真实业务接口
- 调用前会先用本地缓存文档校验接口定位

参数：
- `operationId`
  建议传
- `path`
  建议与 `method` 一起传
- `method`
  建议与 `path` 一起传
- `sourceKey`
  建议补齐
- `query`
  可选，请求 query 参数对象
- `body`
  可选，请求 body 对象
- `pathParams`
  可选，路径参数对象

示例：

```bash
./scripts/tool-call.sh invoke_api_operation '{
  "operationId":"StockOrderOfflineController_create",
  "path":"/stock/order/offline/create",
  "method":"POST",
  "sourceKey":"stock",
  "body": {}
}'
```

#### `call_remote_mcp_tool`

用途：
- 通用远端 MCP 代理
- 仅在需要显式调用任意远端工具时使用

参数：
- `tool_name`
  必填，远端工具名
- `tool_args`
  可选，远端工具参数对象

示例：

```bash
./scripts/tool-call.sh call_remote_mcp_tool '{
  "tool_name":"get_api_operation_latest_example",
  "tool_args":{
    "operationId":"StockOrderOfflineController_create",
    "path":"/stock/order/offline/create",
    "method":"POST",
    "sourceKey":"stock"
  }
}'
```

### 什么时候用哪个

- 查登录状态、店铺、token、本地缓存、recipe，用本地工具
- 查远端文档版本和完整文档，用 `get_api_doc_version`、`get_api_doc_document`
- 查最近成功样例，优先直接用 `get_api_operation_latest_example`
- 调真实业务接口，用 `invoke_api_operation`
- 只有要显式代理任意远端工具时，才用 `call_remote_mcp_tool`

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
./tool-call.sh get_api_operation_latest_example '{"operationId":"StockOrderOfflineController_create","path":"/stock/order/offline/create","method":"POST","sourceKey":"stock"}'
./tool-call.sh invoke_api_operation '{"operationId":"StockOrderOfflineController_create","path":"/stock/order/offline/create","method":"POST","sourceKey":"stock","body":{}}'
./tool-call.sh call_remote_mcp_tool '{"tool_name":"get_api_operation_latest_example","tool_args":{"operationId":"StockOrderOfflineController_create","path":"/stock/order/offline/create","method":"POST","sourceKey":"stock"}}'
./tool-call.sh upload_external_file '{"url":"https://example.com/a.jpg","purpose":"stock"}'
```
