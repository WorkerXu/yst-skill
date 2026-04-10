# 库存商品上架/下架

## 作用

这个能力用于把“上架库存商品 / 下架库存商品 / 把这个商品上架 / 把这个商品下架”统一还原成易奢堂后台真实的库存上下架流程。

它是写操作，会改变商品的上下架状态。执行前必须确认目标商品和目标动作。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并补全参数
6. 确认并提交上下架请求
7. 返回执行结果

## flow

### Step 1: 收集用户输入

- 收集用户当前已提供的信息
- 这一步只做输入收集和标准化整理
- 不在这一步决定最终参数值

### Step 2: 识别已知参数与必填缺口

- 根据“参数规则”逐项检查必填参数是否已经满足
- `stockNo` 和 `action` 都是必填
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
  - 使用工具 `tool.stock_detail` 读取当前上下架状态
  - 让用户确认上架或下架动作
  - 调用 `tool.stock_online` 或 `tool.stock_offline`

### Step 5: 执行任务并补全参数

- 按 Step 4 生成的任务逐个执行
- 如果商品候选有多个，必须让用户确认目标商品
- 如果用户没有明确说上架还是下架，必须让用户补充
- 建议使用工具 `tool.stock_detail` 确认当前 `onlineStatus`

### Step 6: 确认并提交上下架请求

- 提交前必须向用户确认：
  - 库存编号 `stockNo`
  - 系统货号 `goodsNo`
  - 商品名称或描述
  - 当前上下架状态
  - 本次动作：上架或下架
- 用户确认后：
  - 上架使用工具 `tool.stock_online`
  - 下架使用工具 `tool.stock_offline`

### Step 7: 返回执行结果

- 返回上架或下架是否成功
- 返回本次操作的 `stockNo`
- 返回目标状态

## 参数规则

### `stockNo`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 上架或下架接口请求体中的 `stockNo`
- 用户可能提供的形式：
  - 库存编号
  - 商品详情链接中的 `stockNo`
  - 商品名称
  - 系统货号 `goodsNo`
  - 自定义货号 `identifier`
  - 独立编码 `seriesNumber`
- 获取方式：
  - 用户直接提供库存编号
  - 从用户提供的详情链接中解析 `stockNo`
  - 使用工具 `tool.stock_list_search` 按用户描述搜索候选商品，再从候选商品中获取 `stockNo`
- 路径选择规则：
  - 如果用户直接提供 `stockNo`，去掉首尾空白后使用
  - 如果用户提供链接，且链接 query 中存在 `stockNo`，解析 query 参数得到 `stockNo`
  - 如果用户提供的是商品名称、系统货号、自定义货号、独立编码或其他搜索词，使用工具 `tool.stock_list_search` 搜索，入参包含 `searchText`
  - 如果返回多个候选，必须让用户确认目标商品
  - 如果没有返回候选，不能调用上下架接口
- 归一化规则：
  - 保持字符串，不要转成数字
  - 不要把 `goodsNo`、`identifier`、`seriesNumber` 当作 `stockNo`

### `action`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 决定调用上架工具或下架工具
- 可选值：
  - `ONLINE`：上架
  - `OFFLINE`：下架
- 用户可能提供的形式：
  - 上架
  - 发布
  - 下架
  - 取消上架
- 路径选择规则：
  - 用户表达“上架 / 发布”时，归一化为 `ONLINE`
  - 用户表达“下架 / 取消上架”时，归一化为 `OFFLINE`
  - 用户只说“改上下架状态”但没有目标状态时，必须让用户补充

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
  - `data.list[].onlineStatus`
  - `data.list[].status`
  - `data.list[].isInRecycleBin`

### `tool.stock_detail`

- 用途：
  - 读取目标商品详情，用于确认当前上下架状态
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/detail '{"stockNo":"<stockNo>"}'`
- 入参：
  - `stockNo`：库存编号，必填
- 出参：
  - `data.stockNo`
  - `data.goodsNo`
  - `data.name`
  - `data.description`
  - `data.onlineStatus`
  - `data.status`
  - `data.isInRecycleBin`

### `tool.stock_online`

- 用途：
  - 上架库存商品
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/online '{"stockNo":"<stockNo>"}'`
- 入参：
  - `stockNo`：库存编号，必填
- 出参：
  - `data.result`
  - `result`

### `tool.stock_offline`

- 用途：
  - 下架库存商品
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/offline '{"stockNo":"<stockNo>"}'`
- 入参：
  - `stockNo`：库存编号，必填
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
- `action` 必填
- `action=ONLINE` 时只能调用 `tool.stock_online`
- `action=OFFLINE` 时只能调用 `tool.stock_offline`
- 如果当前 `onlineStatus=ONLINE` 且目标也是上架，不要重复调用上架接口
- 如果当前 `onlineStatus=OFFLINE` 且目标也是下架，不要重复调用下架接口
- 不要对回收站商品执行上下架
- 如果工具返回失败，必须返回失败原因，不要假装成功
