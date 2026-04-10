# 添加库存商品

## 作用

这个能力用于把“新增商品 / 添加商品 / 新增库存 / 创建库存 / 入库商品”统一还原成易奢堂后台真实的库存创建流程。

它不是单接口写入，而是一段完整的开放 API 串联。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并补全参数
6. 组装并提交创建库存请求
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
- 这一步的输出不是最终参数，而是“本次准备执行哪些任务”

### Step 4: 生成本次任务列表

- 根据 Step 3 选出来的路径，生成本次实际要执行的任务
- 任务列表示例：
  - 补齐某个缺失参数
  - 调用某个参数规则中定义的查询接口
  - 让用户确认某个候选结果
  - 执行某个参数确定后的衍生动作
- 任务列表应尽量只保留必要动作
- 如果 agent 支持 UI：
  - 可以把候选任务或候选结果用 UI 形式展示给用户
- 如果用户通过自然语言要求调整任务：
  - 允许用户重新指定
  - 然后重新生成任务列表

### Step 5: 执行任务并补全参数

- 按 Step 4 生成的任务逐个执行
- 每个任务的执行方式只参考对应参数的“工具调用”“路径选择规则”和“确认规则”
- 如果任务产生多个候选结果：
  - 优先使用 UI 让用户确认
  - 否则使用文本确认
- 如果任务执行后触发衍生动作：
  - 继续按参数规则中的衍生动作执行
- 每完成一个任务，都要更新当前参数状态

### Step 6: 组装并提交创建库存请求

- 先根据“参数规则”检查所有已实现必填参数是否满足
- 创建库存时使用工具：
  - `tool.stock_create`
- 请求参数：
  - `goodsSource`：已确认并归一化后的商品来源
  - `categoryId`：已确认的分类 ID
  - `finenessValueId`：已确认的成色 ID
  - `description`：用户提供的商品描述
  - `name`：用户提供的商品名称；未提供时使用已确认 `description` 的前 50 字
  - `imageList`：商品图片和商品视频列表；图片 `type=1`，视频 `type=2`
  - `detailsImageList`：细节图列表；固定按图片 `type=1`
  - `brandId`：已确认品牌时传入
  - `seriesId`：已确认系列时传入
  - `skuId` / `skuName`：已确认型号时成对传入
  - `officialPrice`：已确认公价时传入数字
  - `goodsContact`：`goodsSource` 为 `CONSIGN_SALE` 或 `PLEDGE` 时传入；`OWN` 时传空字符串或不传非空值
  - `pledge`：仅 `goodsSource=PLEDGE` 时传入，结构为 `{"pledgeExpireTime":"<质押到期时间>"}`
  - `originalCost`：用户提供的原始成本；未提供时可传 `0`
  - `costList`：用户已添加附加成本时传入
  - `priceList`：用户已填写销售价格时传入
  - `recycle`：用户已填写任一回收信息时传入
  - `count`：库存数量；未提供时传 `1`
  - `identifier`：用户提供的自定义货号
  - `seriesNumber`：用户提供的独立编码
  - `warehouseId` / `reservoirId`：用户已确认商品位置时传入；未选位置时传 `0`
  - `tagList`：用户已选择或新增标签时传入
  - `annex`：用户已填写附件、保卡信息或保卡照片留底时传入
  - `argumentList`：用户已填写分类参数时传入
  - `remarkList`：备注列表；没有备注时可不传
- 提交前必须先完成媒体上传：
  - 商品图片、商品视频、细节图都必须先使用工具 `tool.upload_stock_file` 上传
  - 写入最终 payload 的 `fileUrl` 必须是去掉 host 的相对路径
  - 不能把本地路径、第三方外链、完整 host 地址或未上传 URL 直接写入最终 payload
- 如果创建接口要求的其他必填参数尚未补齐：
  - 不允许直接提交
  - 必须先继续补参数规则或让用户补充
- 成功后从返回中读取：
  - `stockNo`

### Step 7: 返回执行结果

- 返回本次创建结果
- 返回本次实际执行过的任务
- 返回哪些参数来自：
  - 用户直接输入
  - 识款结果
  - 用户确认
  - 接口查询

## 参数规则

### `goodsSource`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中的 `goodsSource`
- 用户可能提供的形式：
  - 中文名称
    - `自有商品`
    - `寄售商品`
    - `质押商品`
  - 简写名称
    - `自有`
    - `寄售`
    - `寄卖`
    - `质押`
  - 标准代码
    - `OWN`
    - `CONSIGN_SALE`
    - `PLEDGE`
- 获取方式：
  - 用户直接指定商品类型
  - 如果用户未指定，则将该参数标记为缺失，加入待执行任务
- 归一化规则：
  - `OWN` / `自有` / `自有商品` -> `OWN`
  - `CONSIGN_SALE` / `寄售` / `寄售商品` / `寄卖` -> `CONSIGN_SALE`
  - `PLEDGE` / `质押` / `质押商品` -> `PLEDGE`
- 条件约束：
  - `OWN` 不要求 `goodsContact`
  - `CONSIGN_SALE` 必须要求 `goodsContact`
  - `PLEDGE` 必须要求 `goodsContact`
  - `PLEDGE` 必须要求 `pledge.pledgeExpireTime`
  - 当 `goodsSource` 从 `CONSIGN_SALE` 或 `PLEDGE` 改为 `OWN` 时，必须清空 `goodsContact`
  - 当 `goodsSource` 从 `PLEDGE` 改为其他类型时，必须清空 `pledge`

### `goodsContact`

- 条件必填
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中的 `goodsContact`
- 用户可能提供的形式：
  - 委托联系方式
  - 寄售人联系方式
  - 质押人联系方式
  - 姓名、手机号、地址组合文本
- 获取方式：
  - 用户直接提供
  - 如果 `goodsSource=CONSIGN_SALE` 或 `goodsSource=PLEDGE` 且用户未提供，则将该参数标记为缺失，加入待执行任务
- 路径选择规则：
  - `goodsSource=OWN` 时不要求该参数
  - `goodsSource=CONSIGN_SALE` 时必须要求用户提供 `goodsContact`
  - `goodsSource=PLEDGE` 时必须要求用户提供 `goodsContact`
  - 该参数不通过工具获取，不要编造联系方式
- 归一化规则：
  - 去掉首尾空白后写入 `goodsContact`
  - 最长 300 字
  - `goodsSource=OWN` 时，最终创建请求中 `goodsContact` 传空字符串或不传非空值

### `pledge.pledgeExpireTime`

- 条件必填
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中 `pledge` 对象的 `pledgeExpireTime`
- 用户可能提供的形式：
  - 质押到期时间
  - 到期日期
  - 赎回截止日期
- 获取方式：
  - 用户直接提供
  - 如果 `goodsSource=PLEDGE` 且用户未提供，则将该参数标记为缺失，加入待执行任务
- 路径选择规则：
  - 只有 `goodsSource=PLEDGE` 时才要求该参数
  - `goodsSource` 不是 `PLEDGE` 时不传 `pledge`
  - 该参数不通过工具获取，不要编造到期时间
- 归一化规则：
  - 写入最终请求时必须放在 `pledge.pledgeExpireTime`
  - 不要把 `pledgeExpireTime` 写成顶层字段
  - 不要传 `pledgeOperatorId` 或 `pledgeOperatorName`，这些字段由服务端按当前操作人补齐

### `categoryId`

- 必填
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `categoryId`
  - 分类特有参数接口中的 `categoryId`
  - 品牌、系列、型号查询的前置条件
- 用户可能提供的形式：
  - 分类 ID
  - 分类名称
  - 图片识款结果
- 获取方式：
  - 用户输入分类名称或分类 ID
  - 使用工具 `tool.shop_combo_box` 读取 `shopCategory`
  - 使用工具 `tool.image_recognize_spu_sku` 从图片识款结果中获取
- 路径选择规则：
  - 如果用户已明确给出 `categoryId`，优先校验后直接使用
  - 如果用户给出的是分类名称，使用工具 `tool.shop_combo_box` 读取 `shopCategory` 后匹配
  - 如果用户没有给分类，但提供了图片，可使用工具 `tool.image_recognize_spu_sku` 获取候选分类
  - 执行工具 `tool.image_recognize_spu_sku` 前必须先确定用于识款的图片
  - 如果有多张候选图片且用户未明确指定，不允许默认选择，必须先让用户确认 1 张
  - 如果识款返回了 `categoryId` 和 `categoryName`，可作为默认候选，但仍允许用户改选
- 确认规则：
  - 如果只有一个明确候选，可直接作为当前值
  - 如果有多个候选，优先使用 UI 选择框让用户确认
  - 如果没有命中结果，则保留缺失状态，继续等待用户补充
- 衍生动作：
  - 一旦 `categoryId` 确定，必须使用工具 `tool.category_argument_list` 加载分类特有参数
  - 需要把用户填写后的分类参数整理成 `argumentList`
  - 如果工具 `tool.image_recognize_spu_sku` 的结果同时返回品牌、系列、型号、公价：
    - 写入对应参数的候选状态
    - 不要跳过对应参数的确认规则
  - 如果 `categoryId` 发生变化：
    - 必须清空已有 `brandId`、`seriesId`、`skuId`、`skuName`、`officialPrice`
    - 必须使用工具 `tool.category_argument_list` 重新加载分类特有参数
    - 必须重新规划品牌、系列、型号、公价相关任务

### `finenessValueId`

- 必填
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `finenessValueId`
- 用户可能提供的形式：
  - 成色 ID
  - 成色名称
  - 成色等级简称
- 获取方式：
  - 用户直接指定成色
  - 使用工具 `tool.shop_combo_box` 读取 `finenessType`
- 路径选择规则：
  - 如果用户已明确给出成色 ID，优先校验后直接使用
  - 如果用户给出的是成色名称或等级简称，使用工具 `tool.shop_combo_box` 读取 `finenessType` 后匹配
  - 如果用户未提供成色，则将该参数标记为缺失，加入待执行任务
- 确认规则：
  - 如果只有一个明确候选，可直接作为当前值
  - 如果有多个候选，必须让用户确认
  - 如果没有命中结果，则保留缺失状态，继续等待用户补充
- 归一化规则：
  - 最终只写入 `finenessValueId`
  - 不要把 `finenessDesc` 写入创建库存请求

### `description`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中的 `description`
- 用户可能提供的形式：
  - 商品描述
  - 商品文案
  - 商品详情文本
- 获取方式：
  - 用户直接提供商品描述
  - 如果用户未提供，则将该参数标记为缺失，加入待执行任务
- 路径选择规则：
  - `description` 必须来自用户提供或用户确认的商品描述
  - 不要用商品名称、备注、图片识款结果替代商品描述
  - 只有在 `description` 已确认后，才可以使用工具 `tool.analysis_content` 智能填充基础信息
- 归一化规则：
  - 去掉首尾空白后写入 `description`
  - 最长 300 字
  - 如果用户描述超过 300 字，必须先让用户确认精简内容
- 衍生动作：
  - 如果用户没有明确提供 `name`，在 `description` 确认后，使用 `description` 前 50 字生成 `name`
  - 如果需要补全品牌、系列、型号，可用已确认的 `description` 执行工具 `tool.analysis_content`
  - 工具 `tool.analysis_content` 返回的品牌、系列、型号只作为候选：
    - 如果和已确认的 `categoryId`、`brandId`、`seriesId` 冲突，必须让用户确认
    - 如果只返回部分字段，继续按缺失参数生成任务
    - 如果返回了 `skuId`，仍需按型号参数规则补齐或确认型号详情，以便获取公价候选
    - 不要用智能填充结果静默覆盖用户已确认的字段

### `name`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中的 `name`
- 用户可能提供的形式：
  - 商品名称
  - 库存名称
  - 标题
- 获取方式：
  - 用户直接提供商品名称
  - 用户未提供时，由已确认的 `description` 派生
- 路径选择规则：
  - 如果用户已明确提供商品名称，优先使用用户提供的值
  - 如果用户未提供商品名称，必须等 `description` 确认后，使用 `description` 前 50 字作为 `name`
  - `name` 不通过工具获取，不要用品牌、系列、型号自动拼接替代用户命名
- 归一化规则：
  - 去掉首尾空白后写入 `name`
  - 最长 50 字
  - 如果用户提供的 `name` 超过 50 字，必须先让用户确认截断或改写
  - 不要用 `name` 替代 `description`

### `brandId`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `brandId`
  - 系列、型号查询的前置条件
- 用户可能提供的形式：
  - 品牌 ID
  - 品牌名称
  - 图片识款结果
  - 智能填充基础信息结果
- 获取方式：
  - 用户直接指定品牌 ID 或品牌名称
  - 使用工具 `tool.brand_group` 按分类查询或按名称搜索
  - 使用工具 `tool.brand_combo_box` 按分类查询或按名称搜索
  - 使用工具 `tool.image_recognize_spu_sku` 从图片识款候选结果中获取
  - 使用工具 `tool.analysis_content` 从描述中获取
- 路径选择规则：
  - 如果用户已明确给出 `brandId`，优先校验后直接使用
  - 如果用户给出品牌名称：
    - 已有 `categoryId` 时，优先使用工具 `tool.brand_group`，入参包含 `categoryId` 和 `brandName`
    - 如果工具 `tool.brand_group` 无法返回可用候选，可使用工具 `tool.brand_combo_box`，入参包含 `categoryId` 和 `brandName`
    - 没有 `categoryId` 时，先补齐 `categoryId`
  - 如果工具 `tool.image_recognize_spu_sku` 返回 `brandId` 和 `brandName`，可作为品牌候选
  - 如果工具 `tool.analysis_content` 返回 `brandId` 和 `brandName`，可作为品牌候选
  - 如果多个路径返回不同品牌，必须让用户确认
- 确认规则：
  - 如果只有一个明确候选，且不与已确认 `categoryId` 冲突，可直接作为当前值
  - 如果有多个候选，优先使用 UI 选择框让用户确认
  - 如果没有命中结果，则保留缺失状态，继续等待用户补充
- 衍生动作：
  - 一旦 `brandId` 发生变化：
    - 必须清空已有 `seriesId`、`skuId`、`skuName`、`officialPrice`
    - 必须重新规划系列、型号、公价相关任务

### `seriesId`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `seriesId`
  - 型号查询的前置条件
- 用户可能提供的形式：
  - 系列 ID
  - 系列名称
  - 图片识款结果
  - 智能填充基础信息结果
- 获取方式：
  - 用户直接指定系列 ID 或系列名称
  - 使用工具 `tool.series_list` 按分类、品牌查询
  - 使用工具 `tool.series_list` 按系列名称搜索
  - 使用工具 `tool.image_recognize_spu_sku` 从图片识款候选结果中获取
  - 使用工具 `tool.analysis_content` 从描述中获取
- 路径选择规则：
  - 如果用户已明确给出 `seriesId`，优先校验后直接使用
  - 如果用户给出系列名称：
    - 必须先确保 `categoryId` 和 `brandId` 已确认
    - 使用工具 `tool.series_list` 搜索，入参包含 `categoryId`、`brandId`、`seriesName`
  - 如果用户未给系列名称，但 `categoryId` 和 `brandId` 已确认：
    - 使用工具 `tool.series_list` 获取候选列表，入参包含 `categoryId`、`brandId`，不传 `seriesName`
  - 如果工具 `tool.image_recognize_spu_sku` 返回 `seriesId` 和 `seriesName`，可作为系列候选
  - 如果工具 `tool.analysis_content` 返回 `seriesId` 和 `seriesName`，可作为系列候选
  - 工具 `tool.series_list` 返回的 `generalSeries` 是合法候选
  - 如果多个路径返回不同系列，必须让用户确认
- 确认规则：
  - 如果只有一个明确候选，且不与已确认 `categoryId`、`brandId` 冲突，可直接作为当前值
  - 如果有多个候选，优先使用 UI 选择框让用户确认
  - 如果没有命中结果，则保留缺失状态，继续等待用户补充
- 衍生动作：
  - 一旦 `seriesId` 发生变化：
    - 必须清空已有 `skuId`、`skuName`、`officialPrice`
    - 必须重新规划型号、公价相关任务

### `skuId` / `skuName`

- 可选
- 数据类型：
  - `skuId`：数字
  - `skuName`：字符串
- 用途：
  - 创建库存接口请求体中的 `skuId`
  - 创建库存接口请求体中的 `skuName`
  - 公价候选来源
- 用户可能提供的形式：
  - 型号 ID
  - 型号名称
  - 图片识款结果
  - 智能填充基础信息结果
- 获取方式：
  - 用户直接指定型号 ID 或型号名称
  - 使用工具 `tool.sku_list_v2` 按分类、品牌、系列查询
  - 使用工具 `tool.sku_list_v2` 按型号名称搜索
  - 使用工具 `tool.image_recognize_spu_sku` 从图片识款候选结果中获取
  - 使用工具 `tool.analysis_content` 从描述中获取
- 路径选择规则：
  - 如果用户已明确给出 `skuId`，优先校验后直接使用，并尽量补齐 `skuName`
  - 如果用户给出型号名称：
    - 必须先确保 `categoryId` 和 `brandId` 已确认
    - 已有 `seriesId` 时，使用工具 `tool.sku_list_v2` 搜索，入参包含 `categoryId`、`brandId`、`seriesId`、`skuName`
    - 没有 `seriesId` 时，使用工具 `tool.sku_list_v2` 搜索，入参包含 `categoryId`、`brandId`、`skuName`，不传 `seriesId`；再根据返回候选补齐或确认系列
  - 如果工具 `tool.image_recognize_spu_sku` 返回 `skuId` 和 `skuName`，可作为型号候选
  - 如果工具 `tool.analysis_content` 返回 `skuId` 和 `skuName`，可作为型号候选
  - 工具 `tool.analysis_content` 返回型号后，如果还没有 `officialPrice` 候选，应使用工具 `tool.sku_list_v2` 补齐型号详情，或让用户输入公价
  - 如果多个路径返回不同型号，必须让用户确认
- 确认规则：
  - 如果只有一个明确候选，且不与已确认 `categoryId`、`brandId`、`seriesId` 冲突，可直接作为当前值
  - 如果有多个候选，优先使用 UI 选择框让用户确认
  - 如果没有命中结果，则保留缺失状态，继续等待用户补充
- 归一化规则：
  - 选中型号后必须同时写入 `skuId` 和 `skuName`
  - 不要只写 `skuName` 而缺少已确认的 `skuId`
- 衍生动作：
  - 如果选中的型号返回 `salePrice`：
    - 写入 `officialPrice` 候选
  - 如果型号返回的 `categoryId`、`brandId`、`seriesId` 与已确认字段冲突：
    - 必须让用户确认采用哪条链路

### `officialPrice`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `officialPrice`
- 用户可能提供的形式：
  - 公价
  - 官方指导价
  - 型号查询结果
  - 图片识款结果
- 获取方式：
  - 用户直接输入
  - 选中型号后从工具 `tool.sku_list_v2` 返回的 `salePrice` 获取
  - 选中图片识款候选后从工具 `tool.image_recognize_spu_sku` 返回的 `salePrice` 获取
- 路径选择规则：
  - 用户明确输入公价时，以用户输入为准
  - 用户未输入公价，且已确认型号候选带 `salePrice` 时，可将 `salePrice` 作为默认候选
  - 如果用户修改型号，必须重新计算公价候选
- 归一化规则：
  - 最终提交字段名为 `officialPrice`
  - 提交前必须转成数字
  - 空值、`-`、无法转成数字的值不能写入 `officialPrice`

### `argumentList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `argumentList`
- 每个参数项结构：
  - `argName`：参数名
  - `argNameId`：参数名 ID
  - `argValue`：用户填写或选择的参数值
  - `argValueId`：参数值 ID；自由输入时可传 `0`
- 获取方式：
  - `categoryId` 确定后，使用工具 `tool.category_argument_list` 加载分类参数池
  - 用户填写或选择分类参数值后，组装为 `argumentList`
- 路径选择规则：
  - 只有 `categoryId` 已确认后，才允许使用工具 `tool.category_argument_list` 加载分类参数池
  - 加载到 `categorySpecificList` 只代表可填写参数池，不代表已形成 `argumentList`
  - 只有用户已提供某个参数值，才写入 `argumentList`
  - 如果用户没有提供分类参数值，可不传 `argumentList`
- 归一化规则：
  - 按用户填写的参数逐项写入 `argumentList[]`
  - 自由输入参数值时，`argValueId` 传 `0`
- 衍生动作：
  - 如果 `categoryId` 发生变化：
    - 必须清空旧 `argumentList`
    - 必须使用工具 `tool.category_argument_list` 重新加载分类参数池

### `originalCost`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `originalCost`
- 用户可能提供的形式：
  - 原始成本
  - 本金
  - 入库成本
- 获取方式：
  - 用户直接提供
  - 用户未提供时可按 `0` 处理
- 路径选择规则：
  - 该参数不通过工具获取
  - 不要把附加成本金额合并进 `originalCost`
- 归一化规则：
  - 写入数字
  - 空值按 `0`
  - 不要传 `totalCost`，总成本只由 `originalCost + costList[].costPrice` 计算展示

### `costList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `costList`
- 每个附加成本项结构：
  - `id`：新增时传 `0`
  - `settingValueId`：成本类型 ID
  - `settingValueName`：成本类型名称
  - `isPlatform`：是否平台配置项
  - `costPrice`：成本金额
  - `remark`：成本备注
  - `imageList`：成本图片列表
- 每个成本图片项结构：
  - `fileUrl`：上传后的平台文件地址
  - `type`：固定按图片传 `1`
  - `id`：新增时传 `0`
  - `sort`：排序值，从 `0` 开始
- 用户可能提供的形式：
  - 附加成本
  - 成本类型和金额
  - 成本凭证图
  - 成本备注
- 获取方式：
  - 用户直接提供附加成本类型、金额、图片、备注
  - 使用工具 `tool.shop_setting_values` 读取 `costType`
  - 成本图片使用工具 `tool.upload_stock_file` 上传
- 路径选择规则：
  - 如果用户未提供附加成本，可不传 `costList`
  - 如果用户提供的是成本类型名称，使用工具 `tool.shop_setting_values` 读取 `costType` 后匹配
  - 如果用户明确提供了成本类型名称，但工具 `tool.shop_setting_values` 返回的 `costType` 没有匹配项：
    - 必须先让用户确认是否新增该自定义成本类型
    - 用户确认新增后，先使用工具 `tool.shop_setting_values` 读取 `costType` 当前完整配置项值
    - 再使用工具 `tool.shop_setting_values_update` 追加新增项
    - 新增后必须重新使用工具 `tool.shop_setting_values` 读取 `costType`，用真实返回的 `id`、`name`、`isPlatform` 组装 `costList[]`
  - 如果用户提供附加成本但未提供成本类型，必须要求用户选择或补充成本类型
  - 如果用户提供附加成本但未提供成本金额，必须要求用户补充 `costPrice`
  - 成本图片只属于对应的 `costList[].imageList`
- 归一化规则：
  - 每个附加成本项必须有 `settingValueId`、`settingValueName`、`costPrice`
  - `costPrice` 写入数字
  - `remark` 最长 30 字；超过时必须先让用户确认精简内容
  - 成本图片最多 3 张
  - `costList[].imageList[].fileUrl` 必须使用工具 `tool.upload_stock_file` 返回的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host
  - 不要把成本图片写入商品 `imageList` 或 `detailsImageList`
  - 不要把 `costList[].costPrice` 加总后写入 `totalCost`

### `priceList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `priceList`
- 每个销售价格项结构：
  - `id`：新增时传 `0`
  - `settingValueId`：售价类型 ID
  - `settingValueName`：售价类型名称
  - `isPlatform`：是否平台配置项
  - `salePrice`：销售价
- 用户可能提供的形式：
  - 销售价
  - 零售价
  - 同行价
  - 代理价
  - 自定义售价
- 获取方式：
  - 用户直接提供某个售价类型的价格
  - 使用工具 `tool.shop_combo_box` 读取 `priceType`
- 路径选择规则：
  - 如果用户未提供任何销售价格，可不传 `priceList`
  - 如果用户提供售价类型名称，使用工具 `tool.shop_combo_box` 读取 `priceType` 后匹配
  - 如果用户明确提供了售价类型名称，但工具 `tool.shop_combo_box` 返回的 `priceType` 没有匹配项：
    - 必须先让用户确认是否新增该自定义售价类型
    - 用户确认新增后，先使用工具 `tool.shop_setting_values` 读取 `priceType` 当前完整配置项值
    - 再使用工具 `tool.shop_setting_values_update` 追加新增项
    - 新增后必须重新使用工具 `tool.shop_combo_box` 读取 `priceType`，用真实返回的 `id`、`name`、`isPlatform` 组装 `priceList[]`
  - 如果用户只提供价格但未说明售价类型，必须先让用户确认对应的售价类型
  - 不要把 `officialPrice` 当作销售价格写入 `priceList`
- 归一化规则：
  - `salePrice` 写入数字
  - 每个传入项必须有 `settingValueId` 和 `settingValueName`
  - 用户未填写的售价类型不要强行写入非零价格
  - 未填写价格的售价类型可不传；如果必须保留该售价类型，`salePrice` 只能传 `0`

### `recycle`

- 可选
- 数据类型：
  - 对象
- 用途：
  - 创建库存接口请求体中的 `recycle`
- 对象结构：
  - `settingValueId`：回收类型 ID
  - `settingValueName`：回收类型名称
  - `recycleDate`：回收时间
  - `recycleOperatorId`：回收人员 ID
  - `recycleOperatorName`：回收人员姓名
  - `imageList`：回收备注图列表
- 每个回收备注图片项结构：
  - `fileUrl`：上传后的平台文件地址
  - `type`：固定按图片传 `1`
  - `id`：新增时传 `0`
  - `sort`：排序值，从 `0` 开始
- 用户可能提供的形式：
  - 回收类型
  - 回收时间
  - 回收人员
  - 回收备注图
- 获取方式：
  - 用户直接提供回收信息
  - 使用工具 `tool.shop_combo_box` 读取 `recycleType`
  - 使用工具 `tool.staff_common_list` 获取回收人员候选
  - 回收备注图使用工具 `tool.upload_stock_file` 上传
- 路径选择规则：
  - 用户没有提供任何回收信息时，不传 `recycle`
  - 如果用户提供回收类型名称，使用工具 `tool.shop_combo_box` 读取 `recycleType` 后匹配
  - 如果用户明确提供了回收类型名称，但工具 `tool.shop_combo_box` 返回的 `recycleType` 没有匹配项：
    - 必须先让用户确认是否新增该自定义回收类型
    - 用户确认新增后，先使用工具 `tool.shop_setting_values` 读取 `recycleType` 当前完整配置项值
    - 再使用工具 `tool.shop_setting_values_update` 追加新增项
    - 新增后必须重新使用工具 `tool.shop_combo_box` 读取 `recycleType`，用真实返回的 `id`、`name`、`isPlatform` 组装 `recycle`
  - 如果用户提供回收人员姓名、手机号或身份关键词，使用工具 `tool.staff_common_list` 搜索候选，入参包含 `keyword`
  - 如果用户要求选择回收人员但未提供关键词，使用工具 `tool.staff_common_list` 获取可用员工候选，入参包含 `status=1`
  - 如果工具 `tool.staff_common_list` 返回多个候选，必须让用户确认
  - 不要编造 `recycleOperatorId` 或 `recycleOperatorName`
  - 回收备注图只属于 `recycle.imageList`
- 归一化规则：
  - 只有至少一个回收字段有值时才传 `recycle`
  - `recycleDate` 写入用户确认的日期字符串
  - `recycle.imageList[].fileUrl` 必须使用工具 `tool.upload_stock_file` 返回的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host
  - 不要把回收备注图写入商品 `imageList`、`detailsImageList` 或 `costList[].imageList`

### `count`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `count`
- 用户可能提供的形式：
  - 商品数量
  - 库存数量
  - 件数
- 获取方式：
  - 用户直接提供
  - 用户未提供时使用默认值
- 路径选择规则：
  - 用户未明确提供时传 `1`
  - 该参数不通过工具获取
- 归一化规则：
  - 写入整数
  - 当前创建库存只按单件商品处理；不要主动要求用户补商品数量

### `identifier`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中的 `identifier`
- 用户可能提供的形式：
  - 自定义货号
  - 货号
  - 店铺货号
  - rfid
- 获取方式：
  - 用户直接提供
  - 用户未提供时可不传或传空字符串
- 路径选择规则：
  - 该参数不通过工具获取
  - 如果用户说“自定义货号”或“货号”，写入 `identifier`
- 归一化规则：
  - 去掉首尾空白后写入 `identifier`
  - 不要把自定义货号写入 `goodsNo`

### `seriesNumber`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 创建库存接口请求体中的 `seriesNumber`
- 用户可能提供的形式：
  - 独立编码
  - 编码
  - 唯一码
- 获取方式：
  - 用户直接提供
  - 用户未提供时可不传或传空字符串
- 路径选择规则：
  - 该参数不通过工具获取
  - 如果用户说“独立编码”，写入 `seriesNumber`
- 归一化规则：
  - 去掉首尾空白后写入 `seriesNumber`
  - 不要把独立编码写入 `seriesId`、`seriesName` 或 `skuName`

### `warehouseId` / `reservoirId`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 创建库存接口请求体中的 `warehouseId`
  - 创建库存接口请求体中的 `reservoirId`
- 用户可能提供的形式：
  - 商品位置
  - 仓库名称
  - 库区名称
  - 仓库 ID 和库区 ID
- 获取方式：
  - 用户直接提供仓库或库区
  - 使用工具 `tool.warehouse_reservoir_list` 获取仓库库区候选
- 路径选择规则：
  - 如果用户未提供商品位置，最终传 `warehouseId=0`、`reservoirId=0`
  - 如果用户提供仓库名称或库区名称，使用工具 `tool.warehouse_reservoir_list` 获取候选后匹配
  - 如果用户只确认仓库，没有确认库区，传确认仓库的 `warehouseId`，`reservoirId` 传 `0`
  - 如果用户确认了具体库区，必须同时写入对应仓库的 `warehouseId` 和该库区的 `reservoirId`
  - 如果工具 `tool.warehouse_reservoir_list` 返回多个候选，必须让用户确认
  - 不要编造 `warehouseId` 或 `reservoirId`
- 归一化规则：
  - 未选位置时两个字段都传 `0`
  - 仓库和库区必须来自同一个候选链路

### `tagList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `tagList`
- 每个标签项结构：
  - `tagId`：标签 ID
  - `tagName`：标签名称
- 用户可能提供的形式：
  - 标签
  - 商品标签
  - 筛选标签
- 获取方式：
  - 用户直接提供标签名称
  - 使用工具 `tool.inventory_tag_list` 获取标签候选
  - 使用工具 `tool.inventory_tag_create` 新建标签
- 路径选择规则：
  - 用户未提供标签时，可不传 `tagList`
  - 如果用户提供标签名称，使用工具 `tool.inventory_tag_list` 获取候选后匹配
  - 如果用户明确提供的标签名称不存在：
    - 必须先让用户确认是否新增该标签
    - 用户确认新增后，使用工具 `tool.inventory_tag_create` 创建标签
    - 新增后必须重新使用工具 `tool.inventory_tag_list` 读取标签候选，用真实返回的 `id` 和 `tagName` 组装 `tagList[]`
  - 如果工具 `tool.inventory_tag_list` 返回多个相近候选，必须让用户确认
- 归一化规则：
  - 每个传入项必须有 `tagId` 和 `tagName`
  - 标签名称最长 6 个字；超过时必须先让用户确认精简内容
  - 不要用用户输入的标签名伪造 `tagId`

### `annex`

- 可选
- 数据类型：
  - 对象
- 用途：
  - 创建库存接口请求体中的 `annex`
- 对象结构：
  - `annexList`：附件列表
  - `hasGuaranteeCard`：是否有保卡；`1` 表示有保卡，`2` 表示无保卡，`0` 表示默认值
  - `guaranteeCardTime`：保卡年份
  - `imageList`：保卡、独立编码照片留底列表
- 每个附件项结构：
  - `settingValueId`：附件类型 ID
  - `settingValueName`：附件类型名称
  - `isPlatform`：是否平台配置项
- 每个保卡照片留底项结构：
  - `fileUrl`：上传后的平台文件地址
  - `type`：固定按图片传 `1`
  - `id`：新增时传 `0`
  - `sort`：排序值，从 `0` 开始
- 用户可能提供的形式：
  - 附件
  - 配件
  - 是否有保卡
  - 保卡年份
  - 保卡照片
  - 独立编码照片留底
- 获取方式：
  - 用户直接提供附件、保卡状态、保卡年份或照片
  - 使用工具 `tool.shop_combo_box` 读取 `attachment`
  - 保卡、独立编码照片留底使用工具 `tool.upload_stock_file` 上传
- 路径选择规则：
  - 用户没有提供任何附件或保卡信息时，可不传 `annex`
  - 如果用户提供附件名称，使用工具 `tool.shop_combo_box` 读取 `attachment` 后匹配
  - 如果用户提供附件名称但工具 `tool.shop_combo_box` 返回的 `attachment` 没有匹配项，必须让用户重新确认附件名称，不要直接新增附件类型
  - 如果用户明确表示有保卡，写 `hasGuaranteeCard=1`
  - 如果用户明确表示无保卡，写 `hasGuaranteeCard=2`，并清空 `guaranteeCardTime`
  - 只有 `hasGuaranteeCard=1` 时才写入 `guaranteeCardTime`
  - 保卡、独立编码照片留底只属于 `annex.imageList`
- 归一化规则：
  - `annexList[]` 的每个附件项必须来自工具 `tool.shop_combo_box` 返回的 `attachment`
  - `annex.imageList[].fileUrl` 必须使用工具 `tool.upload_stock_file` 返回的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host
  - 不要把保卡、独立编码照片留底写入商品 `imageList`、`detailsImageList`、`costList[].imageList` 或 `recycle.imageList`

### `remarkList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `remarkList`
- 每个备注项结构：
  - `id`：新增时传 `0`
  - `remark`：备注内容
- 用户可能提供的形式：
  - 单条备注
  - 多条备注
- 获取方式：
  - 用户直接提供备注
  - 用户未提供时可不传
- 归一化规则：
  - 单条备注写成 `{"id":0,"remark":"<remarkText>"}`
  - 多条备注按用户提供顺序写入 `remarkList[]`
  - 单条备注最长 30 字
  - 如果某条备注超过 30 字，必须先让用户确认精简内容
  - 不要把备注合并进 `description`
  - 不要使用顶层 `remark` 作为创建库存参数

### `imageList`

- 必填
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `imageList`
  - 同时承载商品图片和商品视频
- 每个媒体项结构：
  - `fileUrl`：上传后的平台文件地址
  - `type`：媒体类型，`1` 表示图片，`2` 表示视频
  - `id`：新增时传 `0`
  - `sort`：排序值，从 `0` 开始
- 用户可能提供的形式：
  - 本地商品图片
  - 外部商品图片 URL
  - 本地商品视频
  - 外部商品视频 URL
- 获取方式：
  - 用户上传或提供文件地址
  - 本地文件必须先使用工具 `tool.upload_stock_file` 上传
  - 外部文件地址不能直接写入 payload；需要先下载到本地，再使用工具 `tool.upload_stock_file` 上传
- 归一化规则：
  - 商品图片写入 `imageList[]`，每项 `type=1`
  - 商品视频也写入 `imageList[]`，每项 `type=2`
  - `imageList[].fileUrl` 必须使用工具 `tool.upload_stock_file` 返回的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host，例如 `https://imgs.eshetang.com/stock/a.jpg` -> `stock/a.jpg`
  - 不存在单独的 `videoList`、`goodsVideo`、`videoUrl` 创建库存参数
  - 商品视频最多 1 个；如果用户提供多个视频，必须先让用户选择 1 个
- 确认规则：
  - 至少需要 1 张商品图片
  - 商品视频可选
  - 如果只有 1 张商品图片，可直接作为识款图片
  - 如果有多张商品图片，必须先让用户选择 1 张作为识款图片，不能默认选择
  - 如果用户明确指定某张图片用于识款，按用户指定执行
  - 细节图默认不参与识款；如果需要使用细节图识款，必须先得到用户明确确认
  - 确认单里要按业务语义展示“商品图片”和“商品视频”，不要让用户误以为视频是另一个接口字段

### `detailsImageList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 创建库存接口请求体中的 `detailsImageList`
  - 承载细节图
- 每个媒体项结构：
  - `fileUrl`：上传后的平台文件地址
  - `type`：媒体类型，细节图固定按图片传 `1`
  - `id`：新增时传 `0`
  - `sort`：排序值，从 `0` 开始
- 用户可能提供的形式：
  - 保卡图
  - 配件图
  - 瑕疵图
  - 其他细节图
- 获取方式：
  - 用户上传或提供文件地址
  - 本地文件必须先使用工具 `tool.upload_stock_file` 上传
  - 外部文件地址不能直接写入 payload；需要先下载到本地，再使用工具 `tool.upload_stock_file` 上传
- 归一化规则：
  - 细节图只写入 `detailsImageList[]`
  - 不要把细节图混入 `imageList[]`
  - `detailsImageList[].fileUrl` 必须使用工具 `tool.upload_stock_file` 返回的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host，例如 `https://imgs.eshetang.com/stock/detail.jpg` -> `stock/detail.jpg`

## 工具定义

### `tool.stock_create`

- 用途：
  - 创建库存商品
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/create '<payload>'`
- 入参：
  - `<payload>`：按“参数规则”组装后的创建库存请求体
- 出参：
  - `data.stockNo`：库存编号
  - `stockNo`：库存编号；如果响应顶层直接返回该字段，也可读取

### `tool.upload_stock_file`

- 用途：
  - 上传库存相关图片或视频文件
- 命令：
  - `./scripts/request-bff.sh UPLOAD /common/upload/file '{"file":"<localFilePath>","type":"stock"}'`
- 入参：
  - `file`：本地文件绝对路径
  - `type`：固定传 `stock`
- 出参：
  - `data.url`：完整文件地址
  - `relativeUrl`：去掉 host 后的相对路径

### `tool.shop_combo_box`

- 用途：
  - 读取当前店铺创建库存需要的店铺枚举
- 命令：
  - `./scripts/request-bff.sh GET /stock/enum/shop/combo-box`
- 入参：
  - 无
- 出参：
  - `data.shopCategory`
    - `id`：分类 ID
    - `name`：分类名称
  - `data.finenessType`
    - `id`：成色 ID
    - `name`：成色名称
  - `data.priceType`
    - `id`：售价类型 ID
    - `name`：售价类型名称
    - `isPlatform`：是否平台配置项
  - `data.recycleType`
    - `id`：回收类型 ID
    - `name`：回收类型名称
    - `isPlatform`：是否平台配置项
  - `data.attachment`
    - `id`：附件类型 ID
    - `name`：附件类型名称
    - `isPlatform`：是否平台配置项

### `tool.category_argument_list`

- 用途：
  - 读取某个分类的分类特有参数池
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/argument/list '{"categoryId":<categoryId>}'`
- 入参：
  - `categoryId`：已确认的分类 ID，必填
- 出参：
  - `data.categorySpecificList`
    - `id`：参数名 ID
    - `name`：参数名

### `tool.shop_setting_values`

- 用途：
  - 按配置项编码读取店铺配置项值
- 命令：
  - `./scripts/request-bff.sh GET /stock/shop/setting/values '{"settingCode":"<settingCode>"}'`
- 入参：
  - `settingCode`：配置项编码，成本类型传 `costType`，售价类型传 `priceType`，回收类型传 `recycleType`
- 出参：
  - `data.code`
  - `data.name`
  - `data.values[].id`
  - `data.values[].name`
  - `data.values[].isEnable`
  - `data.values[].isPlatform`

### `tool.shop_setting_values_update`

- 用途：
  - 更新店铺配置项值；用于新增自定义成本类型、售价类型、回收类型
- 命令：
  - `./scripts/request-bff.sh POST /stock/shop/setting/values/update '{"settingCode":"<settingCode>","values":[{"id":<id>,"name":"<name>","isEnable":<isEnable>,"isPlatform":<isPlatform>}]}'`
- 入参：
  - `settingCode`：配置项编码，成本类型传 `costType`，售价类型传 `priceType`，回收类型传 `recycleType`
  - `values`：该配置项当前完整值列表，追加新增项后整体提交
  - `values[].id`：已有项使用原 ID；新增项传 `0`
  - `values[].name`：配置项值名称
  - `values[].isEnable`：已有项使用原值；新增项传 `0`
  - `values[].isPlatform`：已有项使用原值；新增项传 `0`
- 出参：
  - `data.result`

### `tool.staff_common_list`

- 用途：
  - 获取可用于选择回收人员的员工候选
- 命令：
  - `./scripts/request-bff.sh GET /stock/business/common/list '{"page":1,"pageSize":800,"status":1,"keyword":"<keyword>"}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `800`
  - `status`：固定传 `1`，表示正常员工
  - `keyword`：用户提供的员工姓名、手机号或身份关键词，可选；没有关键词时不传
- 出参：
  - `data.list[].id`
  - `data.list[].name`
  - `data.list[].phone`
  - `data.list[].identityType`
  - `data.list[].identityTypeName`
  - `data.list[].isManager`

### `tool.warehouse_reservoir_list`

- 用途：
  - 获取商品位置可用的仓库和库区候选
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/warehouse-reservoir/list '{"page":1,"pageSize":60,"warehouseStatus":1,"reservoirStatus":1}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `60`
  - `warehouseStatus`：可传 `1`，表示启用仓库
  - `reservoirStatus`：可传 `1`，表示启用库区
  - `warehouseIdList`：仓库 ID 列表，可选；按指定仓库过滤时传入
  - `isCommonUse`：是否主仓库，可选
- 出参：
  - `data.list[].id`
  - `data.list[].name`
  - `data.list[].status`
  - `data.list[].isCommonUse`
  - `data.list[].reservoirList[].id`
  - `data.list[].reservoirList[].name`
  - `data.list[].reservoirList[].status`

### `tool.inventory_tag_list`

- 用途：
  - 获取库存商品标签候选
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/tag/list '{"page":1,"pageSize":100}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `100`
- 出参：
  - `data.total`
  - `data.list[].id`
  - `data.list[].tagName`

### `tool.inventory_tag_create`

- 用途：
  - 新建库存商品标签
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/tag/create '{"tagName":"<tagName>"}'`
- 入参：
  - `tagName`：用户确认新增的标签名称，必填
- 出参：
  - `data.tagId`

### `tool.image_recognize_spu_sku`

- 用途：
  - 通过图片识款获取分类、品牌、系列、型号、公价候选
- 命令：
  - `./scripts/request-bff.sh GET /product/image/recognize/spuSku '{"image":"<recognizedImageRelativeUrl>"}'`
- 入参：
  - `image`：用户确认用于识款的图片通过工具 `tool.upload_stock_file` 上传后得到的相对路径，必填
- 出参：
  - `data.list[].categoryId`
  - `data.list[].categoryName`
  - `data.list[].brandId`
  - `data.list[].brandName`
  - `data.list[].seriesId`
  - `data.list[].seriesName`
  - `data.list[].skuId`
  - `data.list[].skuName`
  - `data.list[].salePrice`

### `tool.analysis_content`

- 用途：
  - 通过商品描述智能填充基础信息候选
- 命令：
  - `./scripts/request-bff.sh GET /post/analysis/content '{"content":"<description>"}'`
- 入参：
  - `content`：已确认的商品描述，必填
- 出参：
  - `data.brandId`
  - `data.brandName`
  - `data.seriesId`
  - `data.seriesName`
  - `data.skuId`
  - `data.skuName`

### `tool.brand_group`

- 用途：
  - 按分类读取品牌分组；可按品牌名称搜索
- 命令：
  - `./scripts/request-bff.sh GET /product/brand/group '{"categoryId":<categoryId>,"brandName":"<brandName>"}'`
- 入参：
  - `categoryId`：已确认的分类 ID，建议传入
  - `brandName`：用户提供的品牌名称，可选；没有品牌名称时可不传
- 出参：
  - `data.list[].items[].id`
  - `data.list[].items[].name`
  - `data.hotList.items[].id`
  - `data.hotList.items[].name`

### `tool.brand_combo_box`

- 用途：
  - 按分类读取品牌下拉列表；可按品牌名称搜索
- 命令：
  - `./scripts/request-bff.sh GET /product/brand/combo-box '{"categoryId":<categoryId>,"brandName":"<brandName>"}'`
- 入参：
  - `categoryId`：已确认的分类 ID，建议传入
  - `brandName`：用户提供的品牌名称，可选；没有品牌名称时可不传
- 出参：
  - `data.list[].id`
  - `data.list[].name`

### `tool.series_list`

- 用途：
  - 按分类和品牌读取系列候选；可按系列名称搜索
- 命令：
  - `./scripts/request-bff.sh GET /product/series '{"categoryId":<categoryId>,"brandId":<brandId>,"seriesName":"<seriesName>","page":1,"pageSize":500}'`
- 入参：
  - `categoryId`：已确认的分类 ID，必填
  - `brandId`：已确认的品牌 ID，必填
  - `seriesName`：用户提供的系列名称，可选；没有系列名称时不传
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `500`
- 出参：
  - `data.generalSeries[].series_name`
  - `data.generalSeries[].brandId`
  - `data.list[].id`
  - `data.list[].series_name`
  - `data.list[].brand_id`

### `tool.sku_list_v2`

- 用途：
  - 按分类、品牌、系列读取型号候选；可按型号名称搜索
- 命令：
  - `./scripts/request-bff.sh GET /product/sku/v2 '{"categoryId":<categoryId>,"brandId":<brandId>,"seriesId":<seriesId>,"skuName":"<skuName>","page":1,"pageSize":60}'`
- 入参：
  - `categoryId`：已确认的分类 ID，必填
  - `brandId`：已确认的品牌 ID，必填
  - `seriesId`：已确认的系列 ID，可选；没有系列时不传
  - `skuName`：用户提供的型号名称，可选；没有型号名称时不传
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `60`
- 出参：
  - `data.list[].skuId`
  - `data.list[].skuName`
  - `data.list[].categoryId`
  - `data.list[].categoryName`
  - `data.list[].brandId`
  - `data.list[].brandName`
  - `data.list[].seriesId`
  - `data.list[].seriesName`
  - `data.list[].salePrice`

## 关键校验

- `goodsSource` 必填
- `categoryId` 必填
- `finenessValueId` 必填
- `description` 必填
- `name` 可选；未提供时必须由已确认的 `description` 前 50 字派生
- `goodsSource=PLEDGE` 时必须有 `pledge.pledgeExpireTime`
- `goodsSource=PLEDGE` 时必须把 `pledge.pledgeExpireTime` 写入 `pledge` 对象，不要写成顶层字段
- `goodsSource!=OWN` 时必须要求 `goodsContact`
- `goodsSource=OWN` 时不得传非空 `goodsContact`，且不得传 `pledge`
- 不要传 `pledgeOperatorId` 或 `pledgeOperatorName`
- 当 `categoryId` 已确定时，必须同步加载对应的 `categorySpecificList`
- `categoryId` 变化后，必须重新规划品牌、系列、型号、分类参数、公价
- `brandId` 变化后，必须重新规划系列、型号、公价
- `seriesId` 变化后，必须重新规划型号、公价
- `skuId` 与 `skuName` 必须来自同一个已确认型号候选
- `brandId`、`seriesId`、`skuId` 如果来自不同获取路径，必须检查链路一致性；不一致时让用户确认
- `officialPrice` 如果传入，必须是数字
- `originalCost` 如果传入，必须是数字；未提供时可按 `0`
- 不要把 `totalCost` 作为创建库存参数传入
- `costList` 可选；传入时每项必须有 `settingValueId`、`settingValueName`、`costPrice`
- `costList[].costPrice` 必须是数字
- `costList[].imageList` 的图片必须先使用工具 `tool.upload_stock_file` 上传
- `priceList` 可选；传入时每项必须有 `settingValueId`、`settingValueName`，`salePrice` 必须是数字
- `priceList` 的售价类型必须来自用户确认或工具 `tool.shop_combo_box` 返回的 `priceType`
- `recycle` 可选；只有至少一个回收字段有值时才传
- `recycle.settingValueId` 和 `recycle.settingValueName` 必须来自用户确认或工具 `tool.shop_combo_box` 返回的 `recycleType`
- `recycle.recycleOperatorId` 和 `recycle.recycleOperatorName` 必须来自用户确认或工具 `tool.staff_common_list` 返回的同一个员工候选
- `recycle.imageList` 的图片必须先使用工具 `tool.upload_stock_file` 上传
- 如果用户明确提供的成本类型、售价类型或回收类型不在现有候选中，必须先用工具 `tool.shop_setting_values_update` 新增，再重新读取候选并使用真实 `id` 和 `name`
- 不要直接用用户输入的类型名称伪造 `settingValueId` 或跳过自定义类型新增步骤
- `count` 未提供时传 `1`；如果传入，必须是整数
- 自定义货号必须写入 `identifier`，不要写入 `goodsNo`
- 独立编码必须写入 `seriesNumber`，不要写入系列或型号相关字段
- `warehouseId` 和 `reservoirId` 必须来自用户确认或工具 `tool.warehouse_reservoir_list` 返回的同一仓库库区链路；未选位置时都传 `0`
- `tagList` 可选；传入时每项必须有 `tagId` 和 `tagName`
- 如果用户明确提供的标签不在现有候选中，必须先用工具 `tool.inventory_tag_create` 新增，再重新读取候选并使用真实 `tagId` 和 `tagName`
- `annex` 可选；传入附件时 `annex.annexList[]` 必须来自工具 `tool.shop_combo_box` 返回的 `attachment`
- `annex.hasGuaranteeCard=1` 时可传 `annex.guaranteeCardTime`；`annex.hasGuaranteeCard=2` 时必须清空 `annex.guaranteeCardTime`
- `annex.imageList` 的图片必须先使用工具 `tool.upload_stock_file` 上传
- 保卡、独立编码照片留底必须写入 `annex.imageList`，不能写入其他图片字段
- 成本图片、回收备注图、商品图、细节图必须写入各自字段，不能互相混用
- `imageList` 至少包含 1 个 `type=1` 的商品图片
- 商品视频属于 `imageList`，并且必须传 `type=2`
- 细节图属于 `detailsImageList`，并且必须传 `type=1`
- `imageList` 和 `detailsImageList` 的每个媒体项都必须有 `fileUrl`
- `remarkList` 可选；传入时每项使用 `id` 和 `remark`
