# yst-skill

易奢堂统一 skill 仓库。

## 职责

- 易奢堂后台扫码登录
- 扫码后列出店铺并选店换取最终 `userToken`
- 按需读取 `eshetang/references/*.md` 中的能力规则
- 通过 BFF 脚本调用业务接口

## 使用方式

进入 `eshetang/` 目录后执行：

```bash
./scripts/login.sh
./scripts/status.sh
./scripts/request-bff.sh GET /stock/enum/shop/combo-box
```

更详细的使用说明见：

- [eshetang/README.md](./eshetang/README.md)

## 业务语义约定

在易奢堂当前业务里，用户口中的“商品”按“库存”理解：

- 查商品 = 查库存
- 新增商品 = 创建库存
- 修改商品 = 修改库存

## 重要规则

- 非必填参数，用户没有明确表达时可以先忽略
- 必填参数如果无法从上下文或前置接口结果唯一得到，必须先问用户，不能自行猜测
- 文件上传使用 BFF 单文件上传接口，业务 payload 中写去掉 host 的相对路径
