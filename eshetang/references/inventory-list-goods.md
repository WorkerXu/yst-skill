# 库存商品列表

## 作用

这个能力用于把“查看库存列表 / 搜索库存商品 / 查我的商品 / 找库存商品”统一还原成易奢堂后台真实的库存列表查询流程。

它是只读能力，只负责按条件查询库存商品列表，不创建、不编辑、不删除、不上下架商品。

## workflow

1. 收集用户输入
2. 识别已知参数与查询条件
3. 为查询条件选择可用获取路径
4. 生成本次任务列表
5. 执行库存列表查询
6. 按列表语义整理结果
7. 返回查询结果

## flow

### Step 1: 收集用户输入

- 收集用户当前已提供的信息
- 这一步只做输入收集和标准化整理
- 不在这一步决定最终参数值

### Step 2: 识别已知参数与查询条件

- 根据“参数规则”逐项识别用户已经给出的查询条件
- 未提供的查询条件不需要主动追问
- 如果用户只是说“库存商品列表”，按默认查询条件执行

### Step 3: 为查询条件选择可用获取路径

- 根据“参数规则”给查询条件选择可用来源
- 每个参数的具体路径选择规则必须只从“参数规则”中读取
- 不在 Step 中重复写具体参数的分支细节

### Step 4: 生成本次任务列表

- 根据 Step 3 选出来的路径，生成本次实际要执行的任务
- 任务列表示例：
  - 组装分页参数
  - 组装搜索关键词
  - 组装状态、上下架、商品类型、回收站、标签、位置、时间、价格或成本筛选
  - 调用工具 `tool.stock_list`
  - 按库存列表语义整理返回结果

### Step 5: 执行库存列表查询

- 查询库存列表时使用工具：
  - `tool.stock_list`
- 如果用户没有指定分页：
  - `page` 默认传 `1`
  - `pageSize` 默认传 `10`
- 如果用户没有指定排序：
  - `stockSort` 默认传 `DT_UPDATED_DESC`
- 如果用户没有指定是否查询回收站：
  - `isInRecycleBin` 默认传 `0`

### Step 6: 按列表语义整理结果

- 返回时不要把接口 JSON 原样丢给用户
- 按“结果整理规则”把库存列表整理成用户能理解的摘要
- 列表数据不是完整详情；不要把列表结果当成详情结果

### Step 7: 返回查询结果

- 返回本次查询条件
- 返回总数 `total`
- 返回当前页商品列表
- 如果无结果，说明本次查询条件下没有找到商品，并引导用户换条件

## 参数规则

### `page`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 库存列表请求体中的 `page`
- 默认值：
  - `1`
- 归一化规则：
  - 必须是正整数

### `pageSize`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 库存列表请求体中的 `pageSize`
- 默认值：
  - `10`
- 归一化规则：
  - 必须是正整数
  - 用户未指定时不要一次查太多

### `searchText`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 库存列表请求体中的 `searchText`
  - 对齐页面库存列表搜索框
- 用户可能提供的形式：
  - 商品名称
  - 系统货号
  - 库存编号
  - 自定义货号
  - 独立编码
  - 描述关键词
- 获取方式：
  - 用户直接提供搜索词
- 路径选择规则：
  - 用户表达“搜索 / 查找 / 找一下”后面的关键词，可写入 `searchText`
  - 用户提供的是完整筛选条件时，不要把整句话都写入 `searchText`
- 归一化规则：
  - 去掉首尾空白
  - 空字符串不传

### `displayPropertyList`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 库存列表请求体中的 `displayPropertyList`
  - 控制列表额外返回字段
- 默认值：
  - `PRICE_LIST,TOTAL_COST,ANNEX,TAG`
- 可选值：
  - `PRICE_LIST`：价格信息
  - `LOSS`：盘亏信息
  - `PLEDGE_REDEEM`：质押赎回信息
  - `TOTAL_COST`：总成本
  - `ANNEX`：附件
  - `TAG`：标签
  - `SYNC`：同步
- 路径选择规则：
  - 普通库存列表默认使用 `PRICE_LIST,TOTAL_COST,ANNEX,TAG`
  - 用户明确要看盘亏信息时，可追加 `LOSS`
  - 用户明确要看同步信息时，可追加 `SYNC`

### `isInRecycleBin`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 库存列表请求体中的 `isInRecycleBin`
- 用户可能提供的形式：
  - 回收站
  - 已删除商品
  - 正常库存
- 默认值：
  - `0`
- 归一化规则：
  - 查询回收站传 `1`
  - 查询正常库存传 `0`

### `stockSort`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 库存列表请求体中的 `stockSort`
- 默认值：
  - `DT_UPDATED_DESC`
- 可选值：
  - `DT_UPDATED_DESC`：更新时间从近到远
  - `DT_UPDATED_ASC`：更新时间从远到近
  - `ID_DESC`：入库时间从近到远
  - `ID_ASC`：入库时间从远到近
  - `SALE_PRICE_ASC`：最低销售价
  - `SALE_PRICE_DESC`：最高销售价
  - `TOTAL_COST_ASC`：总成本从低到高
  - `TOTAL_COST_DESC`：总成本从高到低
  - `LOSS_TIME_ASC`：最早盘亏
  - `LOSS_TIME_DESC`：最近盘亏
  - `IN_RECYCLE_BIN_TIME_ASC`：最早删除
  - `IN_RECYCLE_BIN_TIME_DESC`：最近删除

### 其他筛选参数

- 可选
- 用途：
  - 根据用户明确筛选条件写入库存列表请求体
- 支持字段：
  - `categoryIdList`：商品分类 ID 列表
  - `brandIdList`：品牌 ID 列表
  - `goodsSourceList`：商品类型列表，`OWN`、`CONSIGN_SALE`、`PLEDGE`
  - `onlineStatusList`：上下架状态，`ONLINE`、`OFFLINE`
  - `statusList`：库存状态，`1` 在库、`2` 占用、`3` 出库、`4` 盘亏
  - `stockNoList`：库存编号列表
  - `stockIdList`：库存 ID 列表
  - `tagIdList`：商品标签列表
  - `positionList`：仓库库区列表
  - `startDtCreated` / `endDtCreated`：创建时间范围
  - `startDtUpdated` / `endDtUpdated`：更新时间范围
  - `minSalePrice` / `maxSalePrice`：销售价范围
  - `minTotalCostPrice` / `maxTotalCostPrice`：总成本范围
  - `recycleSettingValueIdList`：回收类型列表
  - `recycleOperatorIdList`：回收人员列表
  - `recycleStartDate` / `recycleEndDate`：回收时间范围
  - `lossOperatorIdList`：盘亏人员列表
  - `lossType`：盘亏类型
  - `startLossDate` / `endLossDate`：盘亏时间范围
  - `pledgeStatus`：质押状态
- 路径选择规则：
  - 只有用户明确表达的筛选条件才写入
  - 不要根据用户没有表达的信息自行补筛选

## 工具定义

### `tool.stock_list`

- 用途：
  - 查询登录态库存商品列表
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '<payload>'`
- 入参：
  - `<payload>`：按“参数规则”组装后的库存列表请求体
- 常用请求示例：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"searchText":"<searchText>","isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
- 出参：
  - `data.total`
  - `data.totalCost`
  - `data.btnOptions`
  - `data.list[].stockNo`
  - `data.list[].goodsNo`
  - `data.list[].name`
  - `data.list[].description`
  - `data.list[].listImage`
  - `data.list[].goodsSource`
  - `data.list[].onlineStatus`
  - `data.list[].status`
  - `data.list[].isInRecycleBin`
  - `data.list[].categoryId`
  - `data.list[].brandId`
  - `data.list[].seriesId`
  - `data.list[].skuId`
  - `data.list[].skuName`
  - `data.list[].officialPrice`
  - `data.list[].originalCost`
  - `data.list[].totalCost`
  - `data.list[].priceList`
  - `data.list[].identifier`
  - `data.list[].seriesNumber`
  - `data.list[].warehouseId`
  - `data.list[].reservoirId`
  - `data.list[].positionInfo`
  - `data.list[].tagList`
  - `data.list[].annex`
  - `data.list[].loss`
  - `data.list[].dtCreated`
  - `data.list[].dtUpdated`

## 候选搜索工具防重试规则

- 列表搜索用于获取候选，不是爬取任务或穷举任务
- 同一用户输入、同一工具、同一入参组合，最多调用一次
- 如果列表搜索返回空结果：
  - 必须说明已经使用哪个关键词或入参查询过
  - 必须向用户索要更准确的信息
  - 不得自行拆词、换关键词、扩大范围、翻页穷举或循环重试
- 如果列表搜索返回多个候选：
  - 返回当前页候选让用户选择或继续指定条件
  - 不得默认选择第一个候选作为后续写操作目标

## 结果整理规则

- 每个列表项优先展示：
  - `stockNo`
  - `goodsNo`
  - `name` 或 `description`
  - `goodsSource`
  - `status`
  - `onlineStatus`
  - `totalCost`
  - `priceList`
  - `positionInfo`
  - `tagList`
- `goodsSource` 展示：
  - `OWN` -> `自有商品`
  - `CONSIGN_SALE` -> `寄售商品`
  - `PLEDGE` -> `质押商品`
- `status` 展示：
  - `1` -> `在库`
  - `2` -> `占用`
  - `3` -> `出库`
  - `4` -> `盘亏`
- `onlineStatus` 展示：
  - `ONLINE` -> `已上架`
  - `OFFLINE` -> `未上架`

## 关键校验

- 该能力只读，不调用创建、编辑、删除、上下架、盘亏、更改位置接口
- `page` 和 `pageSize` 必须是正整数
- 没有查询条件时允许按默认列表查询
- 列表结果不是完整详情；用户要看单个商品详情时，应切换到查看库存商品详情能力
