# 库存商品删除

## 作用

这个能力用于把“删除库存商品 / 删除商品 / 移到回收站 / 永久删除商品”统一还原成易奢堂后台真实的库存删除流程。

这是危险写操作。软删除会把商品移动到回收站；永久删除是高危操作，不能默认执行，必须完成明确确认流程。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并补全参数
6. 危险操作确认并提交删除请求
7. 返回执行结果

## flow

### Step 1: 收集用户输入

- 收集用户当前已提供的信息
- 这一步只做输入收集和标准化整理
- 不在这一步决定最终参数值

### Step 2: 识别已知参数与必填缺口

- 根据“参数规则”逐项检查必填参数是否已经满足
- `deleteType` 和 `stockNoList` 都是必填
- 如果用户没有明确说“永久删除”，默认 `deleteType=SOFT_DELETE`

### Step 3: 为缺口参数选择可用获取路径

- 根据“参数规则”给缺失参数挑选最合适的获取方式
- 每个参数的具体路径选择规则必须只从“参数规则”中读取
- 不在 Step 中重复写具体参数的分支细节

### Step 4: 生成本次任务列表

- 根据 Step 3 选出来的路径，生成本次实际要执行的任务
- 任务列表示例：
  - 识别删除类型
  - 从用户输入或详情链接中提取 `stockNo`
  - 使用工具 `tool.stock_list_search` 搜索商品候选并确认 `stockNoList`
  - 使用工具 `tool.stock_detail` 读取待删除商品详情
  - 展示删除确认清单
  - 用户明确确认后调用删除工具

### Step 5: 执行任务并补全参数

- 按 Step 4 生成的任务逐个执行
- 商品候选有多个时必须让用户确认目标商品
- 多商品删除时必须列出每一个待删除商品
- 候选未确认时不得进入删除确认

### Step 6: 危险操作确认并提交删除请求

- 删除前必须展示确认清单：
  - `stockNo`
  - `goodsNo`
  - `name` 或 `description`
  - `status`
  - `onlineStatus`
  - `isInRecycleBin`
- 软删除确认：
  - 必须明确告诉用户“删除商品，可在回收站查看”
  - 用户明确确认后，使用工具 `tool.stock_soft_delete`
- 永久删除确认：
  - 必须明确告诉用户“永久删除商品”
  - 必须明确告诉用户“该操作高危，不应假设可恢复”
  - 必须要求用户明确回复确认永久删除
  - 用户未明确确认永久删除时，不得调用工具 `tool.stock_hard_delete`
- 批量删除确认：
  - 必须逐项列出每个待删除商品
  - 不得只展示“共 N 个商品”就执行删除

### Step 7: 返回执行结果

- 返回删除是否成功
- 返回删除类型
- 返回本次删除的 `stockNoList`
- 如果失败，返回失败原因

## 参数规则

### `deleteType`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 决定调用软删除或永久删除工具
- 可选值：
  - `SOFT_DELETE`：删除到回收站
  - `HARD_DELETE`：永久删除
- 用户可能提供的形式：
  - 删除
  - 移到回收站
  - 永久删除
  - 彻底删除
- 路径选择规则：
  - 用户说“删除”但没有明确“永久删除”时，默认 `SOFT_DELETE`
  - 用户明确说“永久删除 / 彻底删除”时，归一化为 `HARD_DELETE`
  - 不要把普通删除升级为永久删除

### `stockNoList`

- 必填
- 数据类型：
  - 字符串数组
- 用途：
  - 删除接口请求体中的 `stockNoList`
- 用户可能提供的形式：
  - 一个库存编号
  - 多个库存编号
  - 商品详情链接中的 `stockNo`
  - 商品名称、系统货号、自定义货号、独立编码
- 获取方式：
  - 用户直接提供一个或多个库存编号
  - 从用户提供的详情链接中解析 `stockNo`
  - 使用工具 `tool.stock_list_search` 搜索候选商品，再从用户确认的候选中获取 `stockNo`
- 路径选择规则：
  - 如果用户直接提供一个 `stockNo`，归一化为数组
  - 如果用户直接提供多个 `stockNo`，逐个去空后归一化为数组
  - 如果用户提供的是商品名称、系统货号、自定义货号、独立编码或其他搜索词，使用工具 `tool.stock_list_search` 搜索，入参包含 `searchText`
  - 如果返回多个候选，必须让用户确认一个或多个目标商品
  - 如果没有返回候选，不能调用删除接口
- 归一化规则：
  - 每一项保持字符串，不要转成数字
  - 去重
  - 不要把 `goodsNo`、`identifier`、`seriesNumber` 当作 `stockNo`

## 工具定义

### `tool.stock_list_search`

- 用途：
  - 按商品名称、系统货号、自定义货号、独立编码或其他搜索词搜索库存商品候选
  - 用于在用户没有直接给出 `stockNoList` 时补齐目标库存编号
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"searchText":"<searchText>","isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：建议传 `10`
  - `searchText`：用户提供的商品名称、系统货号、自定义货号、独立编码或其他搜索词
  - `isInRecycleBin`：固定传 `0`
  - `stockSort`：固定可传 `DT_UPDATED_DESC`
  - `displayPropertyList`：固定可传 `PRICE_LIST,TOTAL_COST,ANNEX,TAG`
- 出参：
  - `data.total`
  - `data.list[].stockNo`
  - `data.list[].goodsNo`
  - `data.list[].name`
  - `data.list[].description`
  - `data.list[].identifier`
  - `data.list[].seriesNumber`
  - `data.list[].status`
  - `data.list[].onlineStatus`
  - `data.list[].isInRecycleBin`

### `tool.stock_detail`

- 用途：
  - 读取待删除商品详情，用于删除前确认清单
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/detail '{"stockNo":"<stockNo>"}'`
- 入参：
  - `stockNo`：库存编号，必填
- 出参：
  - `data.stockNo`
  - `data.goodsNo`
  - `data.name`
  - `data.description`
  - `data.status`
  - `data.onlineStatus`
  - `data.isInRecycleBin`

### `tool.stock_soft_delete`

- 用途：
  - 删除库存商品到回收站
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/soft-delete '{"stockNoList":["<stockNo>"]}'`
- 入参：
  - `stockNoList`：库存编号数组，必填
- 出参：
  - `data.result`
  - `result`

### `tool.stock_hard_delete`

- 用途：
  - 永久删除库存商品
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/hard-delete '{"stockNoList":["<stockNo>"]}'`
- 入参：
  - `stockNoList`：库存编号数组，必填
- 出参：
  - `data.result`
  - `result`

## 候选搜索工具防重试规则

- 候选搜索工具用于获取候选，不是爬取任务或穷举任务
- 同一参数、同一用户输入、同一工具、同一入参组合，最多调用一次
- 如果候选搜索工具返回空结果：
  - 该参数保持缺失或未确认状态
  - 必须说明已经使用哪个工具、哪个关键词或入参查询过
  - 必须向用户索要更准确的信息
  - 不得自行拆词、换关键词、扩大范围、翻页穷举或循环重试
- 如果候选搜索工具返回多个候选：
  - 必须让用户确认目标候选
  - 不得默认选择第一个候选
  - 不得自动继续翻页扫全量候选
  - 只有用户明确要求继续查找、扩大范围或更换关键词时，才允许再次调用
- 本能力涉及的候选搜索工具：
  - `tool.stock_list_search`

## 危险操作规则

- 删除属于危险操作
- 永久删除属于高危操作
- 没有用户明确确认时，不得调用删除工具
- 删除前必须展示待删除商品清单
- 批量删除必须逐项展示商品，不得只展示数量
- 普通“删除”默认是 `SOFT_DELETE`
- 不得把普通删除自动升级为永久删除
- 永久删除必须要求用户明确确认“永久删除”

## 关键校验

- `deleteType` 必填
- `stockNoList` 必填且不能为空数组
- `deleteType=SOFT_DELETE` 时只能调用 `tool.stock_soft_delete`
- `deleteType=HARD_DELETE` 时只能调用 `tool.stock_hard_delete`
- 软删除前必须提示“删除商品，可在回收站查看”
- 永久删除前必须提示“永久删除商品”，并明确该操作高危
- 候选未确认时不能删除
- 如果工具返回失败，必须返回失败原因，不要假装成功
