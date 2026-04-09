# eshetang skill

易奢堂本地 skill，负责：

- 扫码登录与选店，保存最终 `userToken`
- 同步远端聚合接口文档到本地缓存
- 基于本地索引与高频 recipe 加速库存、订单等场景
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

## 文件地址规则

任何业务 payload 中的外部文件地址都不能直接传给 BFF。

必须先走：

1. `upload_external_file`
2. 把返回的 `uploadedUrl` 写回 payload
3. 再执行 `invoke_api_operation`
