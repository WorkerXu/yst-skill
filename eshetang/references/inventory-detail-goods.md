# 查看库存商品详情

## 作用

这个能力用于把“查看库存商品详情 / 查看商品详情 / 看一下这个库存商品 / 查库存详情”统一还原成易奢堂后台真实的库存详情读取流程。

它是只读能力，只负责根据库存编号读取并整理商品详情，不创建、不编辑、不上传、不删除商品。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并读取库存详情
6. 按商品详情语义整理结果
7. 返回查看结果

## flow

### Step 1: 收集用户输入

- 收集用户当前已提供的信息
- 这一步只做输入收集和标准化整理
- 不在这一步决定最终参数值
- 如果用户提供的是商品详情链接，只从链接中解析本能力需要的参数，不访问分享详情接口

### Step 2: 识别已知参数与必填缺口

- 根据“参数规则”逐项检查必填参数是否已经满足
- 标记哪些参数已经满足
- 标记哪些参数仍然缺失
- 只有缺失参数才需要继续生成任务

### Step 3: 为缺口参数选择可用获取路径

- 根据“参数规则”给缺失参数挑选最合适的获取方式
- 每个参数的具体路径选择规则必须只从“参数规则”中读取
- 不在 Step 中重复写具体参数的分支细节
- 这一步的输出不是最终参数，而是“本次准备执行哪些任务”

### Step 4: 生成本次任务列表

- 根据 Step 3 选出来的路径，生成本次实际要执行的任务
- 任务列表示例：
  - 从用户输入或详情链接中提取 `stockNo`
  - 使用商品搜索工具按名称、编号或编码搜索候选商品
  - 让用户补充库存编号
  - 调用库存详情接口
  - 按商品详情语义整理返回结果
- 任务列表应尽量只保留必要动作

### Step 5: 执行任务并读取库存详情

- 按 Step 4 生成的任务逐个执行
- 每个任务的执行方式只参考对应参数的“获取方式”“路径选择规则”和“确认规则”
- 读取库存详情时使用工具：
  - `tool.stock_detail`
- 如果用户描述的是商品名称、系统货号、自定义货号或独立编码，而不是明确 `stockNo`：
  - 先使用工具 `tool.stock_list_search` 搜索候选商品
  - 再从用户确认的候选商品中读取 `stockNo`
  - 最后使用工具 `tool.stock_detail` 查看详情
- 如果工具返回无权限、非法访问或不存在：
  - 不要改用分享详情接口
  - 不要猜测商品数据
  - 直接向用户说明无法读取该库存商品详情

### Step 6: 按商品详情语义整理结果

- 返回时不要直接把接口 JSON 原样丢给用户
- 按“结果整理规则”把详情归类为用户能理解的信息块
- BFF 返回中属于页面操作的数据不要作为本能力的详情结果展示重点

### Step 7: 返回查看结果

- 返回本次查看到的商品详情
- 返回本次实际使用的查询条件
- 如果字段为空，使用“未填写”或“无”表达，不要编造内容

## 参数规则

### `stockNo`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 库存详情接口请求参数中的 `stockNo`
- 用户可能提供的形式：
  - 库存编号
  - 商品详情链接中的 `stockNo`
  - 扫码得到的详情链接
  - 用户口头描述“这个库存编号是 xxx”
  - 商品名称
  - 系统货号 `goodsNo`
  - 自定义货号 `identifier`
  - 独立编码 `seriesNumber`
- 获取方式：
  - 用户直接提供库存编号
  - 从用户提供的库存详情链接中解析 `stockNo`
  - 使用工具 `tool.stock_list_search` 按用户描述的名称、货号或编码搜索候选商品，再从候选商品中获取 `stockNo`
  - 如果用户未提供，则向用户追问库存编号
- 路径选择规则：
  - 如果用户直接提供 `stockNo`，去掉首尾空白后使用
  - 如果用户提供链接，且链接 query 中存在 `stockNo`，解析 query 参数得到 `stockNo`
  - 如果链接中不存在 `stockNo`，不能调用详情接口，必须让用户补充库存编号
  - 如果用户提供的是商品名称、系统货号、自定义货号、独立编码或其他搜索词：
    - 使用工具 `tool.stock_list_search` 搜索，入参包含 `searchText`
    - 如果只返回 1 个明确候选，可使用该候选的 `stockNo`
    - 如果返回多个候选，必须让用户确认要查看哪一个
    - 如果没有返回候选，不能调用详情接口，必须告知未找到并让用户补充更准确的信息
  - 如果用户明确提供的是 `goodsNo`、`identifier` 或 `seriesNumber`，也优先使用工具 `tool.stock_list_search` 搜索，不要直接当作 `stockNo`
  - 如果用户同时提供多个库存编号，只能查看用户确认的那一个；不要默认批量查询
- 归一化规则：
  - 保持字符串，不要转成数字
  - 不要把 `goodsNo`、`identifier`、`seriesNumber` 当作 `stockNo`
  - 不要把盘点任务里的自增 `stockNo` 当作真实库存编号
- 确认规则：
  - 单个明确 `stockNo` 可直接查询
  - 多个候选必须让用户确认

### `categoryId`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 库存详情接口请求参数中的 `categoryId`
  - 用于让 BFF 额外返回该分类的参数池 `categorySpecificList`
- 用户可能提供的形式：
  - 分类 ID
  - 详情页上下文中已知的分类 ID
- 获取方式：
  - 用户直接提供
  - 当前上下文已有已确认分类 ID
- 路径选择规则：
  - 查看详情不要求 `categoryId`
  - 如果用户未提供 `categoryId`，不要为了查看详情额外补问
  - 如果用户已提供 `categoryId`，可随 `tool.stock_detail` 一起传入
- 归一化规则：
  - 提交前必须转成数字
  - 无法转成数字时不传

## 工具定义

### `tool.stock_detail`

- 用途：
  - 查看登录态库存商品详情
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/detail '{"stockNo":"<stockNo>"}'`
  - 如果已确认 `categoryId`，可调用：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/detail '{"stockNo":"<stockNo>","categoryId":<categoryId>}'`
- 入参：
  - `stockNo`：库存编号，必填
  - `categoryId`：分类 ID，可选
- 出参：
  - `data.stockNo`：库存编号
  - `data.goodsNo`：系统货号
  - `data.name`：商品名称
  - `data.description`：商品描述
  - `data.goodsSource`：商品类型
  - `data.goodsContact`：委托联系方式
  - `data.pledge.pledgeExpireTime`：质押到期时间
  - `data.categoryId`：分类 ID
  - `data.brandId`：品牌 ID
  - `data.seriesId`：系列 ID
  - `data.skuId`：型号 ID
  - `data.skuName`：型号名称
  - `data.skuInfo.categoryName`：分类名称
  - `data.skuInfo.brandName`：品牌名称
  - `data.skuInfo.seriesName`：系列名称
  - `data.skuInfo.skuName`：型号名称
  - `data.skuInfo.model`：型号编码
  - `data.skuInfo.skuKeywords`：型号关键词
  - `data.officialPrice`：公价
  - `data.argumentList`：分类参数
  - `data.finenessValueId`：成色 ID
  - `data.finenessDesc`：成色名称
  - `data.imageList`：商品图片和商品视频列表
  - `data.detailsImageList`：细节图列表
  - `data.originalCost`：原始成本
  - `data.additionalCost`：附加成本
  - `data.totalCost`：总成本
  - `data.costList`：成本明细
  - `data.priceList`：售价列表
  - `data.recycle`：回收信息
  - `data.count`：库存数量
  - `data.identifier`：自定义货号
  - `data.seriesNumber`：独立编码
  - `data.warehouseId`：仓库 ID
  - `data.reservoirId`：库区 ID
  - `data.positionInfo.warehouseName`：仓库名称
  - `data.positionInfo.reservoirName`：库区名称
  - `data.tagList`：标签列表
  - `data.annex`：附件和保卡信息
  - `data.remarkList`：备注列表
  - `data.onlineStatus`：上架状态
  - `data.status`：库存状态
  - `data.isInRecycleBin`：是否在回收站
  - `data.dtCreated`：创建时间
  - `data.dtUpdated`：更新时间
  - `data.logList`：变更记录

### `tool.stock_list_search`

- 用途：
  - 按商品名称、系统货号、自定义货号、独立编码或其他搜索词搜索库存商品候选
  - 用于在用户没有直接给出 `stockNo` 时补齐 `stockNo`
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"searchText":"<searchText>","isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
  - 如果已经确认用户输入的是库存编号，也可按该逻辑调用：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"stockNo":"<stockNo>","isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：建议传 `10`，用于返回少量候选让用户确认
  - `searchText`：用户提供的商品名称、系统货号、自定义货号、独立编码或其他搜索词
  - `stockNo`：库存编号，可选；仅当用户明确给出库存编号且需要按列表搜索确认时使用
  - `isInRecycleBin`：固定传 `0`，默认只搜索未在回收站的商品
  - `stockSort`：固定可传 `DT_UPDATED_DESC`
  - `displayPropertyList`：固定可传 `PRICE_LIST,TOTAL_COST,ANNEX,TAG`
- 出参：
  - `data.total`：候选总数
  - `data.list[].stockNo`：库存编号
  - `data.list[].goodsNo`：系统货号
  - `data.list[].name`：商品名称
  - `data.list[].description`：商品描述
  - `data.list[].identifier`：自定义货号
  - `data.list[].seriesNumber`：独立编码
  - `data.list[].skuName`：型号名称
  - `data.list[].brandId`：品牌 ID
  - `data.list[].seriesId`：系列 ID
  - `data.list[].skuId`：型号 ID
  - `data.list[].listImage`：列表图
  - `data.list[].status`：库存状态
  - `data.list[].onlineStatus`：上架状态
  - `data.list[].goodsSource`：商品类型
  - `data.list[].totalCost`：总成本
  - `data.list[].priceList`：售价列表
- 结果使用规则：
  - 该工具只用于确定要查看哪个库存商品
  - 最终详情必须继续使用工具 `tool.stock_detail` 按 `stockNo` 读取
  - 不要把列表候选数据当作完整详情返回
  - 每次搜索后必须记录本次使用的 `searchText` 或 `stockNo` 以及候选数量
  - 同一个用户输入、同一个搜索条件、同一个工具只允许调用一次
  - 搜索无结果时，不能自动拆词、换词、扩大范围或循环重试，必须转为用户澄清任务

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
- 如果用户补充了新的有效信息：
  - 可以基于新的入参再次调用候选搜索工具
  - 新旧搜索条件必须能区分，不能把同一条件伪装成新查询
- 每次候选搜索任务都应记录：
  - `toolName`
  - 查询入参
  - `resultCount`
  - 当前参数状态
- 本能力涉及的候选搜索工具：
  - `tool.stock_list_search`
- 对 `tool.stock_list_search` 的额外要求：
  - 使用同一个 `searchText` 没有命中时，不要把搜索词自动拆成商品名称、品牌词、颜色词或型号词分别重试
  - 使用 `goodsNo`、`identifier`、`seriesNumber` 作为搜索词没有命中时，不要直接把它们当作 `stockNo`
  - 搜索命中多个商品时，必须展示 `stockNo`、`goodsNo`、`name`、`identifier`、`seriesNumber` 等可区分信息让用户选择

## 结果整理规则

### 基础信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `stockNo`
  - `goodsNo`
  - `name`
  - `description`
  - `goodsSource`
  - `finenessDesc`
  - `status`
  - `onlineStatus`
  - `isInRecycleBin`
- 归一化规则：
  - `goodsSource=OWN` 展示为 `自有商品`
  - `goodsSource=CONSIGN_SALE` 展示为 `寄售商品`
  - `goodsSource=PLEDGE` 展示为 `质押商品`
  - `status=1` 展示为 `在库`
  - `status=2` 展示为 `占用`
  - `status=3` 展示为 `出库`
  - `status=4` 展示为 `盘亏`
  - `onlineStatus=ONLINE` 展示为 `已上架`
  - `onlineStatus=OFFLINE` 展示为 `未上架`

### 品牌、系列、型号、参数、公价

- 从工具 `tool.stock_detail` 返回中读取：
  - `skuInfo.brandName`
  - `skuInfo.seriesName`
  - `skuInfo.skuName`
  - `skuInfo.model`
  - `skuInfo.skuKeywords`
  - `officialPrice`
  - `argumentList`
- 归一化规则：
  - 品牌、系列、型号优先展示 `skuInfo` 中的名称
  - `officialPrice` 为 `null`、`0` 或不存在时展示为未填写
  - `argumentList` 按 `argName: argValue` 展示

### 媒体信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `imageList`
  - `detailsImageList`
- 归一化规则：
  - `imageList[].type=1` 展示为商品图片
  - `imageList[].type=2` 展示为商品视频
  - `detailsImageList` 展示为细节图
  - 不要把商品视频单独整理为不存在的 `videoList` 字段

### 成本和售价

- 从工具 `tool.stock_detail` 返回中读取：
  - `originalCost`
  - `additionalCost`
  - `totalCost`
  - `costList`
  - `priceList`
- 归一化规则：
  - 原始成本展示 `originalCost`
  - 附加成本展示 `additionalCost`
  - 总成本展示 `totalCost`
  - `costList` 按 `settingValueName`、`costPrice`、`remark`、`imageList` 展示
  - `priceList` 按 `settingValueName`、`salePrice` 展示

### 回收信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `recycle.settingValueName`
  - `recycle.recycleDate`
  - `recycle.recycleOperatorName`
  - `recycle.imageList`
  - `relateOrderNo`
- 归一化规则：
  - 没有 `recycle` 时展示为无回收信息
  - 回收备注图读取 `recycle.imageList`

### 委托和质押信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `goodsContact`
  - `pledge.pledgeExpireTime`
- 归一化规则：
  - `goodsSource=OWN` 时，不展示空的委托联系方式
  - `goodsSource=CONSIGN_SALE` 时，展示委托联系方式
  - `goodsSource=PLEDGE` 时，展示委托联系方式和质押到期时间

### 库存管理信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `count`
  - `identifier`
  - `seriesNumber`
  - `positionInfo.warehouseName`
  - `positionInfo.reservoirName`
  - `tagList`
- 归一化规则：
  - 商品位置有仓库和库区时展示为 `<warehouseName>-<reservoirName>`
  - 只有仓库时展示仓库名称
  - 没有位置时展示无位置
  - 标签读取 `tagList[].tagName`

### 附件和保卡信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `annex.annexList`
  - `annex.hasGuaranteeCard`
  - `annex.guaranteeCardTime`
  - `annex.imageList`
- 归一化规则：
  - 附件读取 `annex.annexList[].settingValueName`
  - `hasGuaranteeCard=1` 展示为有保卡
  - `hasGuaranteeCard=2` 展示为无保卡
  - `hasGuaranteeCard` 为空或 `0` 展示为未填写
  - 保卡、独立编码照片留底读取 `annex.imageList`

### 备注和变更信息

- 从工具 `tool.stock_detail` 返回中读取：
  - `remarkList`
  - `logList`
  - `dtCreated`
  - `dtUpdated`
- 归一化规则：
  - 备注读取 `remarkList[].remark`
  - 变更信息可展示最近一次更新记录和入库记录
  - 最近一次更新优先读取 `logList[0]`
  - 入库记录优先读取 `logList` 最后一项
  - 不要为了查看变更日志而读取或展示页面路由

## 不处理的数据

- 本能力不展示、不规划、不执行以下页面操作相关数据：
  - `buttonList`
  - `buttonTips`
  - `routeInfo`
  - `lockInfo`
  - `syncProduct`
  - `stockSyncConfigList`
  - `noPaiPaiPermissionUrl`
  - `similarImage`
  - `skuIds`
- 如果接口返回这些字段，可以忽略
- 不要把这些字段作为用户查看库存商品详情的核心结果

## 关键校验

- `stockNo` 必填
- 没有 `stockNo` 时不能调用工具 `tool.stock_detail`
- 查看详情默认只使用工具 `tool.stock_detail`
- 不使用分享详情接口
- 不调用创建、编辑、上传、删除、上下架、改位置、开单、锁单、同步类工具
- 如果工具 `tool.stock_detail` 返回无权限或非法访问，不要猜测详情内容
- 如果字段不存在或为空，展示为未填写或无
- 商品图片、商品视频、细节图只读取接口返回，不重新上传
- 该能力是只读能力，不需要提交前确认单
