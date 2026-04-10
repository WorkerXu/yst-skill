---
name: eshetang
description: "易奢堂开放能力 skill。先完成登录并获取 token，再按需加载具体能力 Markdown reference 并通过 BFF 脚本执行。"
description_zh: "易奢堂开放能力、登录前置、按需加载能力流程"
description_en: "Eshetang open capabilities with login prerequisite and on-demand Markdown references"
---

# 易奢堂 Skill

主 `SKILL.md` 只负责触发规则、前置条件、能力入口和调用顺序。
具体能力规则放在 `references/`，按需读取。

## 什么时候使用

在下面这些场景使用 `eshetang`：

- 用户要登录易奢堂后台并拿到 `userToken`
- 用户要查看“添加库存、修改库存、删除库存、创建订单”等开放能力的完整 API 串联流程
- 用户要确认某个业务能力的前置条件、接口顺序、字段来源、关键校验
- 用户要通过 BFF 脚本执行业务接口

## 能力边界

- 登录前置能力
  参考 [references/login.md](/Users/coderxu/Downloads/小红书/yst-skill/eshetang/references/login.md)
- 添加库存商品
  参考 [references/inventory-add-goods.md](/Users/coderxu/Downloads/小红书/yst-skill/eshetang/references/inventory-add-goods.md)

## 强制前置条件

除登录能力外，任何开放能力都必须先完成：

1. 扫码登录
2. 选店
3. 获取最终 `userToken`

如果未登录：

- 不能先分析“添加库存商品”的业务参数
- 不能先执行任何开放 API
- 不能假定已有可用 token
- 只能先引导用户进入登录能力

## 交互规则

- 当某一步存在明确候选项时，优先还原成和用户页面一致的选择行为
- 如果当前 agent 支持弹出 UI 选择框：
  - 优先使用 UI 选择框让用户选择
- 如果当前 agent 不支持 UI 选择框：
  - 再退回为文本列举候选项让用户确认

## 默认执行顺序

### 1. 登录

先读：

- [references/login.md](/Users/coderxu/Downloads/小红书/yst-skill/eshetang/references/login.md)

常用本地脚本：

```bash
./scripts/login.sh
./scripts/status.sh
./scripts/user-token.sh
```

### 2. 读取具体能力 reference

例如用户要“添加库存商品”，只加载：

- [references/inventory-add-goods.md](/Users/coderxu/Downloads/小红书/yst-skill/eshetang/references/inventory-add-goods.md)

不要把其他能力 reference 一起读进上下文。

### 3. 用通用工具调用 BFF 接口

```bash
./scripts/request-bff.sh GET /stock/enum/shop/combo-box
./scripts/request-bff.sh GET /stock/inventory/stock/argument/list '{"categoryId":102}'
./scripts/request-bff.sh POST /stock/inventory/stock/create '{"categoryId":102}'
```

## Gotchas

- “商品”在当前业务默认按“库存”理解
- 登录是所有开放能力的前置条件，不满足就不能继续
- 添加库存不是单接口调用，而是一整段 API 串联流程
- `categoryId`、`brandId`、`seriesId`、`skuId`、`warehouseId`、`reservoirId`、`finenessValueId` 都有明确前置来源，不能猜
- 文件上传统一通过 BFF 单文件上传接口，最终业务 payload 使用去掉 host 的相对路径
