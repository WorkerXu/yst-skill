# 更改库存商品位置

## 作用

这个能力用于把“更改商品位置 / 移动库存 / 批量更改位置 / 换仓库库区”统一还原成易奢堂后台真实的库存移动流程。

它是写操作，会改变库存商品的仓库或库区。执行前必须确认目标商品和目标位置。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并补全参数
6. 确认并提交更改位置请求
7. 返回执行结果

## flow

### Step 1: 收集用户输入

- 收集用户当前已提供的信息
- 这一步只做输入收集和标准化整理
- 不在这一步决定最终参数值

### Step 2: 识别已知参数与必填缺口

- 根据“参数规则”逐项检查必填参数是否已经满足
- 标记哪些参数已经满足
- 标记哪些参数仍然缺失
- 只有缺失参数才需要继续生成任务

### Step 3: 为缺口参数选择可用获取路径

- 根据“参数规则”给缺失参数挑选最合适的获取方式
- 每个参数的具体路径选择规则必须只从“参数规则”中读取
- 不在 Step 中重复写具体参数的分支细节

### Step 4: 生成本次任务列表

- 根据 Step 3 选出来的路径，生成本次实际要执行的任务
- 任务列表示例：
  - 从用户输入或详情链接中提取 `stockNo`
  - 使用工具 `tool.stock_list_search` 搜索商品候选并确认 `stockNoList`
  - 使用工具 `tool.warehouse_reservoir_list` 读取仓库库区候选
  - 让用户确认目标仓库和库区
  - 调用工具 `tool.stock_relocation`

### Step 5: 执行任务并补全参数

- 按 Step 4 生成的任务逐个执行
- 商品候选有多个时必须让用户确认
- 仓库库区候选有多个时必须让用户确认
- 位置必须来自工具 `tool.warehouse_reservoir_list` 返回的真实候选

### Step 6: 确认并提交更改位置请求

- 提交前必须向用户确认：
  - 本次要移动的库存编号列表 `stockNoList`
  - 商品名称或描述
  - 目标仓库
  - 目标库区
- 用户确认后使用工具：
  - `tool.stock_relocation`

### Step 7: 返回执行结果

- 返回更改位置是否成功
- 返回移动的 `stockNoList`
- 返回目标仓库和库区

## 参数规则

### `stockNoList`

- 必填
- 数据类型：
  - 字符串数组
- 用途：
  - 更改位置接口请求体中的 `stockNoList`
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
  - 如果没有返回候选，不能调用更改位置接口
- 归一化规则：
  - 每一项保持字符串，不要转成数字
  - 去重
  - 不要把 `goodsNo`、`identifier`、`seriesNumber` 当作 `stockNo`

### `warehouseId`

- 必填
- 数据类型：
  - 数字
- 用途：
  - 更改位置接口请求体中的 `warehouseId`
- 用户可能提供的形式：
  - 仓库名称
  - 仓库 ID
  - 商品位置描述
- 获取方式：
  - 使用工具 `tool.warehouse_reservoir_list` 获取仓库库区候选
  - 用户从候选中确认仓库
- 路径选择规则：
  - 如果用户提供仓库名称，使用工具 `tool.warehouse_reservoir_list` 获取候选后匹配
  - 如果只有一个明确候选，可使用该候选
  - 如果多个仓库名称相近，必须让用户确认
  - 如果用户未提供仓库，必须读取候选并让用户选择
- 归一化规则：
  - 必须使用工具返回的真实仓库 ID
  - 不要用仓库名称伪造 ID

### `reservoirId`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 更改位置接口请求体中的 `reservoirId`
- 用户可能提供的形式：
  - 库区名称
  - 库区 ID
  - 商品位置描述
- 获取方式：
  - 使用工具 `tool.warehouse_reservoir_list` 获取仓库库区候选
  - 用户从候选中确认库区
- 路径选择规则：
  - 如果用户提供库区名称，必须先确认所属 `warehouseId`
  - 如果目标仓库下有多个库区，必须让用户确认库区
  - 如果用户选择仓库但不选择库区，可不传 `reservoirId`
- 归一化规则：
  - `reservoirId` 必须属于已确认的 `warehouseId`
  - 不要把其他仓库下的库区 ID 写入请求

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
  - `data.list[].warehouseId`
  - `data.list[].reservoirId`
  - `data.list[].status`

### `tool.warehouse_reservoir_list`

- 用途：
  - 获取商品位置可用的仓库和库区候选
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/warehouse-reservoir/list '{"page":1,"pageSize":60,"warehouseStatus":1,"reservoirStatus":1}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `60`
  - `warehouseStatus`：可传 `1`
  - `reservoirStatus`：可传 `1`
  - `warehouseIdList`：仓库 ID 列表，可选
  - `isCommonUse`：是否主仓库，可选
- 出参：
  - `data.list[].id`
  - `data.list[].name`
  - `data.list[].status`
  - `data.list[].isCommonUse`
  - `data.list[].reservoirList[].id`
  - `data.list[].reservoirList[].name`
  - `data.list[].reservoirList[].status`

### `tool.stock_relocation`

- 用途：
  - 更改库存商品位置
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/relocation '{"stockNoList":["<stockNo>"],"warehouseId":<warehouseId>,"reservoirId":<reservoirId>}'`
  - 如果不选择库区，可调用：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/relocation '{"stockNoList":["<stockNo>"],"warehouseId":<warehouseId>}'`
- 入参：
  - `stockNoList`：库存编号数组，必填
  - `warehouseId`：仓库 ID，必填
  - `reservoirId`：库区 ID，可选
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
  - `tool.warehouse_reservoir_list`

## 关键校验

- `stockNoList` 必填且不能为空数组
- `warehouseId` 必填
- `reservoirId` 可选，但如果传入，必须属于已确认的 `warehouseId`
- 目标位置必须来自工具 `tool.warehouse_reservoir_list` 返回的真实候选
- 执行前必须让用户确认更改位置操作
- 不要对回收站商品执行更改位置
- 如果工具 `tool.stock_relocation` 返回失败，必须返回失败原因，不要假装成功
