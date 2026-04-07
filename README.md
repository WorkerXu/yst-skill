# yst-skill

易奢堂统一 skill 仓库。

现在仓库只推荐安装一个目录：

- `eshetang/`

这个统一 skill 会同时负责：

1. 易奢堂后台扫码登录
2. 扫码后列出店铺并选店换取最终 `userToken`
3. 在安装时自动识别或询问当前助理类型，并选择正确的 MCP 安装方式
4. 通过远端 `yst-mcp` 搜索、查看、调用业务接口

## 默认 MCP 地址

统一使用：

`https://789.mcp.t.eshetang.com/yst/mcp`

## 统一安装方式

进入 `eshetang/` 目录后执行：

```bash
./scripts/install-mcp.sh
```

安装脚本会：

1. 询问你当前使用的助理类型
2. 自动写入 `ESHETANG_MCP_URL`
3. 按不同助理写入对应的 MCP 配置

当前支持：

- `codex`
- `workbuddy`
- `cursor`
- `cc-code`
- `xiaolongxia`

更详细的安装说明见：

- [eshetang/README.md](./eshetang/README.md)

## 业务语义约定

在易奢堂当前业务里，用户口中的“商品”按“库存”理解：

- 查商品 = 查库存
- 新增商品 = 创建库存
- 修改商品 = 修改库存

## 重要规则

当模型通过远端 `yst-mcp` 编排接口时：

- 非必填参数，用户没有明确表达时可以先忽略
- 必填参数如果无法从上下文或前置接口结果唯一得到，必须先问用户，不能自行猜测
