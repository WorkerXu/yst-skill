# 库存商品盘亏

## 作用

这个能力用于把“盘亏商品 / 盘亏出库 / 商品盘亏 / 把这个库存做盘亏”统一还原成易奢堂后台真实的库存盘亏流程。

它是写操作，会改变库存状态。执行前必须确认目标商品和盘亏理由。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并补全参数
6. 确认并提交盘亏请求
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
  - 使用工具 `tool.stock_list_search` 搜索商品候选并确认 `stockNo`
  - 使用工具 `tool.stock_detail` 读取商品详情用于确认
  - 让用户补充盘亏理由
  - 调用工具 `tool.stock_loss`

### Step 5: 执行任务并补全参数

- 按 Step 4 生成的任务逐个执行
- 如果商品候选有多个，必须让用户确认目标商品
- 如果盘亏理由缺失，必须让用户补充
- 如果使用工具 `tool.stock_detail` 发现商品不适合盘亏，必须停止并说明原因

### Step 6: 确认并提交盘亏请求

- 提交前必须向用户确认：
  - 库存编号 `stockNo`
  - 系统货号 `goodsNo`
  - 商品名称或描述
  - 当前库存状态
  - 盘亏理由 `lossRemark`
- 用户确认后使用工具：
  - `tool.stock_loss`
- BFF 会固定补充 `lossType=LOSS_TYPE_MANUAL`
- 不要让用户填写 `lossType`
- 不要把 `lossType` 作为 BFF 请求参数传入

### Step 7: 返回执行结果

- 返回盘亏是否成功
- 返回本次实际盘亏的 `stockNo`
- 返回盘亏理由

## 参数规则

### `stockNo`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 盘亏接口请求体中的 `stockNo`
- 用户可能提供的形式：
  - 库存编号
  - 商品详情链接中的 `stockNo`
  - 商品名称
  - 系统货号 `goodsNo`
  - 自定义货号 `identifier`
  - 独立编码 `seriesNumber`
- 获取方式：
  - 用户直接提供库存编号
  - 从用户提供的库存详情链接中解析 `stockNo`
  - 使用工具 `tool.stock_list_search` 按用户描述的名称、货号或编码搜索候选商品，再从候选商品中获取 `stockNo`
- 路径选择规则：
  - 如果用户直接提供 `stockNo`，去掉首尾空白后使用
  - 如果用户提供链接，且链接 query 中存在 `stockNo`，解析 query 参数得到 `stockNo`
  - 如果用户提供的是商品名称、系统货号、自定义货号、独立编码或其他搜索词，使用工具 `tool.stock_list_search` 搜索，入参包含 `searchText`
  - 如果只返回 1 个明确候选，可使用该候选的 `stockNo`
  - 如果返回多个候选，必须让用户确认要盘亏哪一个
  - 如果没有返回候选，不能调用盘亏接口，必须告知未找到并让用户补充更准确的信息
- 归一化规则：
  - 保持字符串，不要转成数字
  - 不要把 `goodsNo`、`identifier`、`seriesNumber` 当作 `stockNo`

### `lossRemark`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 盘亏接口请求体中的 `lossRemark`
- 用户可能提供的形式：
  - 盘亏原因
  - 盘亏备注
  - 盘亏出库理由
- 获取方式：
  - 用户直接提供
  - 用户未提供时必须追问
- 路径选择规则：
  - 如果用户已经明确说明盘亏原因，去掉首尾空白后使用
  - 如果用户只说“盘亏这个商品”但没有原因，必须让用户填写盘亏理由
- 归一化规则：
  - 不能为空
  - 最长 30 字，超过 30 字必须让用户改写或确认截断
  - 不要使用默认理由

## 工具定义

### `tool.stock_list_search`

- 用途：
  - 按商品名称、系统货号、自定义货号、独立编码或其他搜索词搜索库存商品候选
  - 用于在用户没有直接给出 `stockNo` 时补齐 `stockNo`
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
  - `data.list[].goodsSource`

### `tool.stock_detail`

- 用途：
  - 读取目标商品详情，用于盘亏前确认商品状态和展示确认信息
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
  - `data.goodsSource`
  - `data.isInRecycleBin`

### `tool.stock_loss`

- 用途：
  - 将库存商品盘亏出库
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/loss '{"stockNo":"<stockNo>","lossRemark":"<lossRemark>"}'`
- 入参：
  - `stockNo`：库存编号，必填
  - `lossRemark`：盘亏理由，必填
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

## 关键校验

- `stockNo` 必填
- `lossRemark` 必填
- `lossRemark` 最长 30 字
- 不要传 `lossType`，BFF 会固定补 `LOSS_TYPE_MANUAL`
- 执行前必须让用户确认盘亏操作
- 不要对回收站商品执行盘亏
- 如果详情中 `status=3` 出库或 `status=4` 盘亏，不要再次执行盘亏
- 如果工具 `tool.stock_loss` 返回失败，必须返回失败原因，不要假装成功
