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
  参考 `references/login.md`
- 添加库存商品
  参考 `references/inventory-add-goods.md`
- 查看库存商品详情
  参考 `references/inventory-detail-goods.md`
- 库存商品盘亏
  参考 `references/inventory-loss-goods.md`
- 生成库存商品销售图
  参考 `references/inventory-sale-image-goods.md`
- 更改库存商品位置
  参考 `references/inventory-relocation-goods.md`
- 库存商品列表
  参考 `references/inventory-list-goods.md`
- 库存商品上架/下架
  参考 `references/inventory-online-goods.md`
- 库存商品删除
  参考 `references/inventory-delete-goods.md`
- 库存商品开单
  参考 `references/inventory-create-order-goods.md`

## 强制前置条件

除登录能力外，任何开放能力都必须先完成：

1. 扫码登录
2. 选店
3. 获取最终 `userToken`

如果未登录：

- 不能先读取除登录能力外的任何具体能力
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

- `references/login.md`

常用本地脚本：

```bash
./scripts/login.sh
./scripts/status.sh
./scripts/user-token.sh
```

### 2. 读取具体能力 reference

根据用户目标，从“能力边界”中选择对应的单个 reference 读取。

不要把其他能力 reference 一起读进上下文。
