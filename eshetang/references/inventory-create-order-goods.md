# 库存商品开单

## 作用

这个能力用于把“库存商品开单 / 在库商品开单 / 给这个商品开销售单 / 商品售出开单”统一还原成易奢堂后台真实的在库商品线下订单创建流程。

它只处理库存商品开单：`source=goods` 且 `inStock=1`。

不处理锁单开单、不在库开单、订单修改、取消、退货、删除、分享凭证、发货管理和页面路由跳转。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并补全参数
6. 确认开单摘要并提交订单创建请求
7. 返回执行结果

## flow

### Step 1: 收集用户输入

- 收集用户当前已提供的信息
- 这一步只做输入收集和标准化整理
- 不在这一步决定最终参数值
- 如果用户提供的是库存详情链接，只从链接中解析本能力需要的参数

### Step 2: 识别已知参数与必填缺口

- 根据“参数规则”逐项检查必填参数是否已经满足
- 库存商品开单的核心必填参数：
  - `stockNo`
  - `actualPrice`
  - `type` / `typeDesc`
  - `saleUserIds` / `saleUserName`
  - `goodsInfo.inStock=1`
  - `source=goods`
- `goodsInfo.inStock` 和 `source` 是本能力固定参数，不需要用户描述
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
  - 使用工具 `tool.stock_list_search` 搜索商品候选并确认 `stockNo`
  - 使用工具 `tool.stock_detail` 读取库存详情
  - 使用工具 `tool.stock_shop_combo_box` 读取订单类型、售后保障、成本类型等店铺配置
  - 使用工具 `tool.stock_enum_combo_box` 读取收款状态、收款方式、结款状态等系统枚举
  - 使用工具 `tool.stock_business_common_list` 获取销售人员候选
  - 让用户补充成交价、订单类型、销售人员等缺口
  - 上传收款凭证、结款凭证或附加成本图片
  - 展示开单摘要并等待用户确认
- 任务列表应尽量只保留必要动作

### Step 5: 执行任务并补全参数

- 按 Step 4 生成的任务逐个执行
- 每个任务的执行方式只参考对应参数的“获取方式”“路径选择规则”和“确认规则”
- 商品候选、订单类型候选、销售人员候选存在多个时，必须让用户确认
- 用户未确认候选时，不得继续组装最终开单请求
- 读取库存详情时使用工具 `tool.stock_detail`
- 读取枚举时：
  - 店铺配置使用工具 `tool.stock_shop_combo_box`
  - 系统枚举使用工具 `tool.stock_enum_combo_box`
- 员工候选使用工具 `tool.stock_business_common_list`

### Step 6: 确认开单摘要并提交订单创建请求

- 提交前必须展示开单摘要：
  - `stockNo`
  - 商品名称
  - 商品类型
  - 成交价
  - 订单类型
  - 销售人员
  - 销售时间
  - 收款状态和收款方式
  - 结款状态；仅寄售商品需要重点展示
  - 收货信息
  - 订单备注
  - 原始成本和附加成本
- 用户明确确认后，使用工具 `tool.offline_order_create`
- 创建库存商品开单请求时固定传：
  - `source`：`goods`
  - `goodsInfo.inStock`：`1`
  - `goodsInfo.stockNo`：已确认的库存编号
- 请求参数：
  - `actualPrice`：已确认成交价
  - `type`：已确认订单类型 ID，字符串
  - `typeDesc`：已确认订单类型名称
  - `saleUserIds`：已确认销售人员 ID，多个用英文逗号分隔
  - `saleUserName`：已确认销售人员名称，多个用英文分号分隔
  - `saleTime`：用户提供或确认的销售时间
  - `aftersale`：已确认售后保障 ID，多个用英文逗号分隔
  - `aftersaleDesc`：已确认售后保障名称，多个用英文分号分隔
  - `paidInfo`：已确认收款信息
  - `settleInfo`：已确认结款信息
  - `remark`：订单备注
  - `customerName`：收货姓名
  - `customerPhone`：收货手机号
  - `customerAddress`：收货地址
  - `originalCost`：已确认原始成本
  - `costList`：已确认附加成本列表
  - `goodsInfo`：已确认商品信息
- 接口服务会自动补充：
  - 顶层 `inStock`
  - `operatorId`
  - `operatorName`
  - `businessNo`
- 提交前必须先完成媒体上传：
  - 收款凭证、结款凭证、附加成本图片都必须先使用工具 `tool.upload_stock_file` 上传
  - 写入最终 payload 的文件地址必须是去掉 host 的相对路径
  - 不能把本地路径、第三方外链、完整 host 地址或未上传 URL 直接写入最终 payload
- 如果必填参数尚未补齐：
  - 不允许直接提交
  - 必须先继续补参数规则或让用户补充

### Step 7: 返回执行结果

- 返回开单是否成功
- 返回本次使用的 `stockNo`
- 返回订单创建接口返回的结果
- 返回本次实际执行过的任务
- 如果失败，返回失败原因

## 参数规则

### `stockNo`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - `goodsInfo.stockNo`
  - 用于读取库存详情
- 用户可能提供的形式：
  - 库存编号
  - 商品详情链接
  - 商品名称
  - 系统货号
  - 自定义货号
  - 独立编码
- 获取方式：
  - 用户明确提供库存编号时，直接作为候选 `stockNo`
  - 用户提供详情链接且链接中包含 `stockNo` 时，从链接中提取
  - 用户描述的是商品名称、系统货号、自定义货号或独立编码时，使用工具 `tool.stock_list_search` 搜索候选
- 确认规则：
  - 搜索命中 1 个候选时，可把该候选作为待确认商品；提交前摘要仍必须展示
  - 搜索命中多个候选时，必须让用户选择
  - 搜索无结果时，说明搜索条件和结果，不要反复重试
  - 未确认 `stockNo` 时，不得调用工具 `tool.offline_order_create`

### `stockDetail`

- 必填
- 数据类型：
  - 对象
- 用途：
  - 确认待开单商品
  - 判断是否寄售
  - 回填成本信息
  - 构造 `goodsInfo`
- 获取方式：
  - 确认 `stockNo` 后，使用工具 `tool.stock_detail` 读取
- 结果使用规则：
  - 从工具 `tool.stock_detail` 返回中读取：
    - `stockNo`
    - `goodsNo`
    - `name`
    - `listImage`
    - `goodsSource`
    - `categoryId`
    - `brandId`
    - `imageList`
    - `recycle.recycleOperatorId`
    - `recycle.recycleOperatorName`
    - `originalCost`
    - `costList`
    - `status`
    - `onlineStatus`
    - `isInRecycleBin`
  - 构造 `goodsInfo` 时优先写入：
    - `inStock: 1`
    - `stockNo`
    - `goodsNo`
    - `brandId`
    - `imageList`
    - `recycleOperatorId`
    - `recycleOperatorName`
- 校验规则：
  - `status` 必须是 `1`，表示在库
  - `onlineStatus` 不能是 `OFFLINE`
  - `goodsSource` 不能是 `PLEDGE`
  - `isInRecycleBin` 为真时，不得继续开单
  - 不满足以上任一条件时，不得调用工具 `tool.offline_order_create`
  - 如果用户坚持继续，必须说明当前能力只覆盖真实入口允许的库存商品开单，不能绕过该边界
  - 无权限或详情不存在时，不要猜测商品信息

### `actualPrice`

- 必填
- 数据类型：
  - 数字
- 用途：
  - `actualPrice`
- 获取方式：
  - 从用户明确提供的成交价、销售价、卖价中读取
  - 用户未提供时，必须询问用户补充
- 规则：
  - 必须是大于等于 0 的数字
  - 用户没有明确成交价时，不要从库存售价、公价、成本价中自动猜测
  - 提交时写入数字；为空不得提交

### `type` / `typeDesc`

- 必填
- 数据类型：
  - `type`：字符串
  - `typeDesc`：字符串
- 用途：
  - 订单类型
- 获取方式：
  - 使用工具 `tool.stock_shop_combo_box` 读取 `orderType`
  - 按用户描述匹配 `orderType[].name`
- 自定义规则：
  - 如果用户明确提到订单类型，但 `orderType` 中没有对应项，系统允许新增自定义订单类型
  - 新增时使用工具 `tool.stock_shop_setting_value_add`，`settingCode` 固定传 `orderType`
  - 新增成功后必须重新使用工具 `tool.stock_shop_combo_box` 读取候选，并从最新 `orderType` 中确认 `type` 和 `typeDesc`
- 确认规则：
  - 多个订单类型候选时必须让用户确认
  - 用户未提供订单类型且没有默认业务约定时，必须询问用户选择

### `saleUserIds` / `saleUserName`

- 必填
- 数据类型：
  - `saleUserIds`：字符串，多个 ID 用英文逗号分隔
  - `saleUserName`：字符串，多个名称用英文分号分隔
- 用途：
  - 销售人员
- 获取方式：
  - 使用工具 `tool.stock_business_common_list` 获取员工候选
  - 用户提供姓名、手机号或身份关键词时，把关键词传给工具
  - 用户没有提供销售人员时，也可以读取员工列表让用户选择
- 结果使用规则：
  - `saleUserIds` 读取员工候选的 `id`
  - `saleUserName` 读取员工候选的 `name`
- 确认规则：
  - 命中多个员工时必须让用户确认
  - 用户未确认销售人员时，不得提交

### `saleTime`

- 可选
- 数据类型：
  - 字符串，格式 `YYYY-MM-DD`
- 用途：
  - 销售时间
- 获取方式：
  - 用户明确提供销售日期时使用
  - 用户未提供时可以不传
- 校验规则：
  - 不允许未来日期
  - 用户使用“今天”时，按当前日期转换为 `YYYY-MM-DD`

### `aftersale` / `aftersaleDesc`

- 可选
- 数据类型：
  - `aftersale`：字符串，多个 ID 用英文逗号分隔
  - `aftersaleDesc`：字符串，多个名称用英文分号分隔
- 用途：
  - 售后保障
- 获取方式：
  - 使用工具 `tool.stock_shop_combo_box` 读取 `serviceType`
  - 按用户描述匹配 `serviceType[].name`
- 自定义规则：
  - 如果用户明确提到售后保障，但 `serviceType` 中没有对应项，系统允许新增自定义售后保障
  - 新增时使用工具 `tool.stock_shop_setting_value_add`，`settingCode` 固定传 `serviceType`
  - 新增成功后必须重新使用工具 `tool.stock_shop_combo_box` 读取候选，并从最新 `serviceType` 中确认
- 规则：
  - 用户未提及售后保障时可不传

### `paidInfo`

- 可选
- 数据类型：
  - 对象
- 用途：
  - 收款信息
- 获取方式：
  - 使用工具 `tool.stock_enum_combo_box` 读取 `paidStatus` 和 `paymentMethodList`
- 结构：
  - `paidStatus`：收款状态，`0` 未付款，`1` 已付款；未提供时默认 `0`
  - `paidMethod`：收款方式，已付款时可传
  - `paidVoucher`：收款凭证相对路径数组，已付款且用户提供凭证时传
- 文件规则：
  - 用户提供收款凭证时，必须先使用工具 `tool.upload_stock_file` 上传
  - `paidVoucher[]` 必须写入上传后的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host
- 规则：
  - `paidStatus=0` 时不要要求收款方式和收款凭证
  - `paidStatus=1` 且用户提供收款方式时，必须从 `paymentMethodList` 中确认 `paidMethod`

### `settleInfo`

- 可选
- 数据类型：
  - 对象
- 用途：
  - 结款信息
- 适用条件：
  - 重点用于寄售商品；是否寄售从工具 `tool.stock_detail` 返回的 `goodsSource=CONSIGN_SALE` 判断
- 获取方式：
  - 使用工具 `tool.stock_enum_combo_box` 读取 `settleStatus`
- 结构：
  - `settleStatus`：结款状态，`1` 已结款，`2` 未结款；未提供时默认 `2`
  - `settleVoucher`：结款凭证相对路径数组
  - `remark`：结款备注
- 文件规则：
  - 用户提供结款凭证时，必须先使用工具 `tool.upload_stock_file` 上传
  - `settleVoucher[]` 必须写入上传后的 `relativeUrl`
  - 如果只拿到工具 `tool.upload_stock_file` 返回的 `data.url`，必须先去掉 host
- 规则：
  - 非寄售商品通常不需要结款信息；用户明确提供时才传
  - 寄售商品未明确结款时，按未结款处理

### `originalCost`

- 可选
- 数据类型：
  - 数字
- 用途：
  - 原始成本
- 获取方式：
  - 默认从工具 `tool.stock_detail` 返回的 `originalCost` 读取
  - 用户明确要求调整时，以用户确认值为准
- 规则：
  - 未读取到且用户未提供时可传 `0`

### `costList`

- 可选
- 数据类型：
  - 数组
- 用途：
  - 附加成本列表
- 获取方式：
  - 默认从工具 `tool.stock_detail` 返回的 `costList` 读取
  - 用户要求新增、删除或调整附加成本时，使用工具 `tool.stock_shop_combo_box` 读取 `costType`
- 单项结构：
  - `id`：本次新增成本项可传临时数字 ID；保留详情原成本时使用原值
  - `settingValueId`：成本类型 ID
  - `settingValueName`：成本类型名称
  - `costPrice`：成本金额
  - `remark`：成本备注，最多 30 字
  - `imageList`：成本图片数组
  - `imageList[].fileUrl`：成本图片相对路径
  - `isPlatform`：从 `costType` 候选读取
- 自定义规则：
  - 如果用户明确提到附加成本类型，但 `costType` 中没有对应项，系统允许新增自定义成本类型
  - 新增时使用工具 `tool.stock_shop_setting_value_add`，`settingCode` 固定传 `costType`
  - 新增成功后必须重新使用工具 `tool.stock_shop_combo_box` 读取候选，并从最新 `costType` 中确认
- 文件规则：
  - 成本图片使用工具 `tool.upload_stock_file` 上传
  - `costList[].imageList[].fileUrl` 必须写入上传后的 `relativeUrl`
- 规则：
  - 用户没有要求调整成本时，使用详情回填的成本信息
  - 用户要求不带附加成本时，传空数组或不传

### `customerName` / `customerPhone` / `customerAddress`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 收货信息
- 获取方式：
  - 从用户描述中读取收货姓名、手机号、地址
  - 用户未提供时可不传
- 校验规则：
  - `customerName` 最多 11 字
  - `customerPhone` 最多 11 位数字
  - `customerAddress` 最多 100 字

### `remark`

- 可选
- 数据类型：
  - 字符串
- 用途：
  - 订单备注
- 获取方式：
  - 从用户明确提供的订单备注中读取
- 校验规则：
  - 最多 250 字

### `goodsInfo`

- 必填
- 数据类型：
  - 对象
- 用途：
  - 创建订单关联的库存商品
- 结构：
  - `inStock`：固定 `1`
  - `stockNo`：已确认库存编号
  - `goodsNo`：从工具 `tool.stock_detail` 返回中读取，可选
  - `brandId`：从工具 `tool.stock_detail` 返回中读取，可选
  - `imageList`：从工具 `tool.stock_detail` 返回中读取，可选；只传文件路径数组
  - `recycleOperatorId`：从工具 `tool.stock_detail` 返回的回收信息中读取，可选
  - `recycleOperatorName`：从工具 `tool.stock_detail` 返回的回收信息中读取，可选
- 规则：
  - 在库商品开单不需要用户重新填写商品名称、分类、商品来源
  - 不要把不在库开单字段作为本能力必填项

## 工具定义

### `tool.stock_detail`

- 用途：
  - 查看登录态库存商品详情
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/detail '{"stockNo":"<stockNo>"}'`
- 入参：
  - `stockNo`：库存编号，必填
- 出参：
  - `data.stockNo`
  - `data.goodsNo`
  - `data.name`
  - `data.listImage`
  - `data.goodsSource`
  - `data.categoryId`
  - `data.brandId`
  - `data.imageList`
  - `data.recycle.recycleOperatorId`
  - `data.recycle.recycleOperatorName`
  - `data.originalCost`
  - `data.costList`
  - `data.status`
  - `data.onlineStatus`
  - `data.isInRecycleBin`

### `tool.stock_list_search`

- 用途：
  - 按商品名称、系统货号、自定义货号、独立编码或其他搜索词搜索库存商品候选
  - 用于在用户没有直接给出 `stockNo` 时补齐 `stockNo`
- 命令：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"searchText":"<searchText>","isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
  - 如果已经确认用户输入的是库存编号，也可调用：
  - `./scripts/request-bff.sh POST /stock/inventory/stock/list '{"page":1,"pageSize":10,"stockNo":"<stockNo>","isInRecycleBin":0,"stockSort":"DT_UPDATED_DESC","displayPropertyList":"PRICE_LIST,TOTAL_COST,ANNEX,TAG"}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：建议传 `10`
  - `searchText`：用户提供的商品名称、系统货号、自定义货号、独立编码或其他搜索词
  - `stockNo`：库存编号，可选
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
  - `data.list[].skuName`
  - `data.list[].listImage`
  - `data.list[].status`
  - `data.list[].onlineStatus`
  - `data.list[].goodsSource`

### `tool.stock_shop_combo_box`

- 用途：
  - 读取当前店铺开单需要的店铺配置枚举
- 命令：
  - `./scripts/request-bff.sh GET /stock/enum/shop/combo-box`
- 入参：
  - 无
- 出参：
  - `data.orderType`
    - `id`：订单类型 ID
    - `name`：订单类型名称
    - `isPlatform`：是否平台配置项
  - `data.serviceType`
    - `id`：售后保障 ID
    - `name`：售后保障名称
    - `isPlatform`：是否平台配置项
  - `data.costType`
    - `id`：附加成本类型 ID
    - `name`：附加成本类型名称
    - `isPlatform`：是否平台配置项

### `tool.stock_enum_combo_box`

- 用途：
  - 读取收款、结款等系统枚举
- 命令：
  - `./scripts/request-bff.sh GET /stock/enum/combo-box`
- 入参：
  - 无
- 出参：
  - `data.paidStatus`
    - `id` 或 `value`：收款状态值
    - `name` 或 `label`：收款状态名称
  - `data.paymentMethodList`
    - `id` 或 `value`：收款方式值
    - `name` 或 `label`：收款方式名称
  - `data.settleStatus`
    - `id` 或 `value`：结款状态值
    - `name` 或 `label`：结款状态名称

### `tool.stock_business_common_list`

- 用途：
  - 获取可用于选择销售人员的员工候选
- 命令：
  - `./scripts/request-bff.sh GET /stock/business/common/list '{"page":1,"pageSize":500,"status":1,"keyword":"<keyword>"}'`
- 入参：
  - `page`：固定可传 `1`
  - `pageSize`：固定可传 `500`
  - `status`：固定传 `1`，表示正常员工
  - `keyword`：用户提供的员工姓名、手机号或身份关键词，可选；没有关键词时不传
- 出参：
  - `data.total`
  - `data.list[].id`
  - `data.list[].name`
  - `data.list[].phone`
  - `data.list[].wechat`
  - `data.list[].identityType`
  - `data.list[].identityTypeName`
  - `data.list[].isManager`

### `tool.stock_shop_setting_value_add`

- 用途：
  - 新增店铺配置项值；用于新增订单类型、售后保障、附加成本类型
- 命令：
  - `./scripts/request-bff.sh POST /stock/shop/setting/values/add '{"settingCode":"<settingCode>","name":"<name>"}'`
- 入参：
  - `settingCode`：配置项编码
    - 订单类型传 `orderType`
    - 售后保障传 `serviceType`
    - 附加成本类型传 `costType`
  - `name`：新增配置项值名称
- 出参：
  - `data`
  - 新增后必须重新使用工具 `tool.stock_shop_combo_box` 读取最新候选

### `tool.upload_stock_file`

- 用途：
  - 上传开单相关图片文件
- 命令：
  - `./scripts/request-bff.sh UPLOAD /common/upload/file '{"file":"<localFilePath>","type":"stock"}'`
- 入参：
  - `file`：本地文件绝对路径
  - `type`：固定传 `stock`
- 出参：
  - `data.url`：完整文件地址
  - `relativeUrl`：去掉 host 后的相对路径

### `tool.offline_order_create`

- 用途：
  - 创建库存商品线下订单
- 命令：
  - `./scripts/request-bff.sh POST /stock/order/offline/create '<payload>'`
- 入参：
  - `<payload>`：按“参数规则”组装后的开单请求体
- 请求示例：
  - `./scripts/request-bff.sh POST /stock/order/offline/create '{"actualPrice":16800,"type":"1","typeDesc":"销售","saleUserIds":"123","saleUserName":"张三","saleTime":"2026-04-10","paidInfo":{"paidStatus":0,"paidVoucher":[]},"goodsInfo":{"inStock":1,"stockNo":"STOCK123"},"source":"goods"}'`
- 出参：
  - `data`
  - `data.result`
  - `data.wmsOrderNo`：订单号；如果响应中存在该字段，优先返回给用户

## 候选搜索工具防重试规则

- 候选搜索工具用于获取候选，不是爬取任务或穷举任务
- 同一个参数、同一个用户输入、同一个工具、同一组入参，只允许调用一次
- 如果候选搜索工具返回空结果：
  - 立即停止该参数的自动搜索
  - 向用户说明已经用什么条件搜索、没有找到结果
  - 让用户补充更明确的信息
  - 不要自动换关键词、拆词、扩大范围或循环重试
- 如果候选搜索工具返回多个候选：
  - 必须让用户确认其中一个候选
  - 不要为了“更准确”继续追加搜索
- 只有用户提供了新的、更具体的信息后：
  - 才可以基于新的入参再次调用候选搜索工具
- 每次候选搜索任务都应记录：
  - 参数名
  - 工具名
  - 入参
  - 候选数量
  - 是否已让用户确认
- 本能力涉及的候选搜索工具：
  - `tool.stock_list_search`
  - `tool.stock_business_common_list`

## 关键校验

- `stockNo`、`actualPrice`、`type`、`saleUserIds` 必填
- 本能力固定 `source=goods`
- 本能力固定 `goodsInfo.inStock=1`
- 未读取库存详情时，不得提交开单请求
- 只有非回收站、非质押、在库、已上架的库存商品才进入本能力的提交流程
- 未完成开单摘要确认时，不得调用工具 `tool.offline_order_create`
- 不要使用锁单开单参数 `source=lockOrder` 和 `lockNo`
- 不要使用不在库开单必填字段作为本能力必填项
- 用户未明确成交价时，不要用公价、售价或成本价猜测成交价
- 用户未确认销售人员时，不得提交
- 用户未确认订单类型时，不得提交
- 收款凭证、结款凭证、附加成本图片必须先上传，再写入相对路径
- 工具返回无权限、非法访问或商品不存在时，直接说明失败原因，不要猜测或改走其他能力
