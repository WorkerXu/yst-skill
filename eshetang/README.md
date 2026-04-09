# eshetang skill

易奢堂本地 skill，负责：

- 扫码登录与选店，保存最终 `userToken`
- 同步远端聚合接口文档到本地缓存
- 基于本地索引与已确认的接口数据流 recipe 加速库存场景
- 在执行写接口前，先把外部文件地址上传为平台文件地址

## 当前工具

- `check_login_status`
- `get_login_qrcode`
- `login_flow`
- `list_shops`
- `select_shop`
- `get_user_token`
- `delete_session`
- `install_mcp`
- `get_mcp_config`
- `get_integration_status`
- `sync_api_doc`
- `get_cached_api_doc_summary`
- `get_cached_api_operation_details`
- `get_scenario_recipe`
- `get_api_doc_version`
- `get_api_doc_document`
- `get_api_operation_latest_example`
- `upload_external_file`
- `invoke_api_operation`

## 本地缓存

缓存文件位于 `data/`：

- `api-doc-version.json`
- `api-doc-document.json`
- `api-doc-index.json`
- `uploaded-file-cache.json`

## 工作流

1. 环境检查
2. 登录与选店，拿到 `userToken`
3. 同步远端接口文档到本地
4. 命中高频 recipe 或从本地文档读取接口
5. 预处理文件字段
6. 调用最终业务接口

## 缺参交互

当 agent 在某个场景里拿不到关键参数时，不能一直自己重试并让用户等待。

必须改成：
- 先列出缺失参数
- 说明为什么当前拿不到
- 说明已经尝试过或准备尝试的路径
- 给用户 1-3 个可选方案
- 让用户直接回复一行短指令继续

## 写入前确认

所有写操作在真正调用接口前，都必须先让用户确认一次最终数据。

要求：
- 用自然语言展示
- 不要直接展示 API 参数名
- 把关键商品信息、金额、状态、人员、图片/凭证整理给用户看
- 用户明确回复确认后，才能真正写入

## 样例排错

`get_api_operation_latest_example` 已恢复，但它是排错工具，不是常规工具。

只应在下面两种情况下使用：
- 真实调用已经失败，且暂时无法从上下文排除错误
- 高度怀疑是 payload/query/path 参数组装错了

它返回的是脱敏后的最近一次成功调用样例，只能拿来参考结构，不能直接复用里面的值。

## 当前 recipe

- `inventory_add_goods`
  已确认的库存新增完整数据流：
  `shop combo box -> category argument -> optional image recognize -> tag list -> brand -> series -> sku -> warehouse/reservoir -> optional analysis content -> media upload -> create`
  关键点：`categoryId`、`brandId`、`seriesId`、`skuId`、`warehouseId`、`reservoirId`、`finenessValueId` 都必须来自前置接口，不是只记一个 `create`。
- `inventory_edit_goods`
  已确认的库存编辑完整数据流：
  `shop combo box -> stock detail -> category/tag/brand/series/sku/warehouse conditional reselection -> media upload -> update`
  关键点：编辑以 `detail` 回填为基线；一旦用户修改上游字段，必须重跑依赖接口。
- `inventory_view_goods`
  已确认的库存详情接口链：
  `detail/detailShare -> buttonList + routeInfo + full detail payload`
  关键点：详情不仅决定展示内容，也决定后续动作。`buttonList` 负责“当前有哪些动作可见”，`routeInfo` 负责部分动作的真实跳转地址，`lockInfo / warehouseId / reservoirId / goodsNo / smuId` 负责补足动作执行上下文。
- `offline_order_create`
  已确认的线下开单完整数据流：
  `stock enum -> shop combo box -> staff list -> branch detail preload(stock detail/lock detail/offline detail) -> optional add setting value -> file upload -> create/update`
  关键点：开单场景在 `saas-mini` 中已经能完整还原，不再是简单 H5 跳转。真实分支由 `source + inStock + mode` 决定。

## 文件地址规则

任何业务 payload 中的外部文件地址都不能直接传给 BFF。

必须先走：

1. `upload_external_file`
2. 把返回的 `uploadedUrl` 先转成相对路径再写回 payload
   例如：
   `https://imgs.eshetang.com/stock/a.jpg?...` -> `stock/a.jpg?...`
3. 再执行 `invoke_api_operation`
