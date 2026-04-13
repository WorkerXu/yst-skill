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
- 用户要查看"添加库存、修改库存、删除库存、创建订单"等开放能力的完整 API 串联流程
- 用户要确认某个业务能力的前置条件、接口顺序、字段来源、关键校验
- 用户要通过 BFF 脚本执行业务接口

## 意图路由规则

当用户表达的意图涉及以下关键词或语义时，必须路由到对应能力：

| 用户表达 / 关键词 | 路由到的能力 | 对应 reference |
|---|---|---|
| 添加库存、新增商品、录入商品、添加商品 | 添加库存商品 | `references/inventory-add-goods.md` |
| 查看商品详情、商品信息 | 查看库存商品详情 | `references/inventory-detail-goods.md` |
| 盘亏、报损 | 库存商品盘亏 | `references/inventory-loss-goods.md` |
| 销售图、销售图片 | 生成库存商品销售图 | `references/inventory-sale-image-goods.md` |
| 更改位置、移动、换仓库、换库区、移到、搬到、放到、创建新仓库放商品、新仓库放商品、放到新仓库、移到新仓库、商品搬家 | 更改库存商品位置 | `references/inventory-relocation-goods.md` |
| 商品列表、库存列表 | 库存商品列表 | `references/inventory-list-goods.md` |
| 上架、下架 | 库存商品上架/下架 | `references/inventory-online-goods.md` |
| 删除商品、移除商品 | 库存商品删除 | `references/inventory-delete-goods.md` |
| 开单、创建订单 | 库存商品开单 | `references/inventory-create-order-goods.md` |

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

除安装、环境检查、登录能力外，只要本 skill 被引用或命中，任何后续动作都必须先完成：

1. 扫码登录
2. 选店
3. 获取最终 `userToken`

这里的"后续动作"包括但不限于：

- 读取具体业务 reference
- 分析用户给出的商品链接
- 抓取或打开用户给出的外部网页
- 调用图片识款、智能填充、网页解析、搜索候选等参数获取工具
- 规划添加库存、查看库存、删除库存、开单等业务任务
- 执行任何 BFF 业务接口

如果未登录：

- 不能先读取除登录能力外的任何具体能力
- 不能先执行任何开放 API
- 不能先访问、抓取、解析用户提供的外部 URL
- 不能先根据外部 URL 生成商品参数
- 不能先做缺参分析或任务规划
- 不能假定已有可用 token
- 只能先引导用户进入登录能力


## 交互规则

### 候选项选择规则

- 只要当前任务需要用户在多个可选项中选择一个或多个目标，agent 都必须优先还原成选择行为
- 如果当前 agent 支持 UI 选择框，必须优先使用 UI 选择框让用户选择
- 只有在当前 agent 明确不支持 UI 选择框时，才允许退回为文本列举候选项让用户确认
- 不得因为文本实现更方便而跳过 UI 选择框
- 这条规则适用于所有能力中的候选选择场景，包括但不限于：
  - 店铺选择
  - 品牌、系列、型号选择
  - 分类、成色、仓库、库区选择
  - 商品搜索结果选择
  - 员工、标签、类型、配置项选择

### 缺参必问规则

- 任何接口的必填参数，如果无法从以下来源唯一确定其值，**必须先询问用户**，不能自行猜测或编造：
  - 用户当前对话中明确提供的信息
  - 前置接口返回的结果
  - 该能力的 reference 文档中明确写死的默认值或固定规则
- 如果必填参数的值存在多个合理候选，也必须让用户确认，不能默认选第一个
- 即使参数有业务上的常见默认值，只要 reference 中没有写死该默认值，就不能自行填充

### 写操作确认规则

- 任何**写操作**（包括但不限于：添加库存、更改位置、删除、盘亏、开单、上架/下架）在真正调用接口之前，**必须**先向用户展示一份**自然语言的数据确认单**
- 确认单必须包含：
  - 本次操作的业务含义（如"添加库存商品""更改商品位置"等）
  - 即将提交的所有必填参数和关键可选参数的值，用自然语言描述（不要只贴 JSON）
  - 任何从上下文推断的参数值，必须明确标注来源
- 只有用户**明确确认**（如"确认""没问题""执行"等肯定回复）后，才能调用写接口
- 如果用户修改了确认单中的任何参数，必须重新更新确认单后再确认
- 用户未确认时，不得以任何理由跳过确认步骤直接调用写接口

## 可视化任务编排协议

- 当读取某个具体能力 reference 后，agent 必须按照该能力的 `workflow` 自动拆解本次需要执行的任务
- 任务列表是给用户看的执行待办，不是把 `workflow` 原文机械改写成任务
- agent 可以自行决定任务字段和展示形式
- 如果当前 agent 支持可视化任务列表：
  - 优先使用可视化任务列表展示和更新
- 如果当前 agent 不支持可视化任务列表：
  - 使用 Markdown checklist 展示和更新
- 任务应来自当前用户目标、已读取能力的 `workflow`、参数规则、工具定义和当前已知参数状态
- 只生成本次确实需要执行的任务；已经满足的参数不要生成无意义任务
- 如果任务需要用户确认候选、补充参数或确认写操作，必须把该任务标记为待用户处理
- 如果执行过程中读取了新的能力，或用户追加了新的目标：
  - 不要丢弃已有任务列表
  - 将新能力拆解出的必要任务动态追加到当前任务列表
  - 如果新任务依赖已有任务产出，必须体现依赖关系
  - 已完成任务保持完成状态，不要重新生成一份全新的列表覆盖用户已看到的进度
- 如果用户补充信息使某些任务不再需要：
  - 将这些任务标记为已跳过或已满足
  - 不要静默删除导致用户看不懂进度变化
- 每次工具调用、候选确认、用户补参、写操作确认后，都要更新当前任务列表状态
- 写接口前的确认任务必须保留在任务列表中，用户明确确认后才能执行写入工具

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

根据用户目标，从"能力边界"中选择对应的单个 reference 读取。

不要把其他能力 reference 一起读进上下文。
