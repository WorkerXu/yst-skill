# 生成库存商品销售图

## 作用

这个能力用于把“生成销售图 / 商品销售图 / 给这个库存商品做销售图”统一还原成易奢堂 App 商品详情页的销售图生成流程。

销售图不是 BFF 直接生成图片文件。真实页面逻辑是读取库存详情，准备商品图片、描述、价格选项和小程序码数据，然后由 Flutter 页面截图保存。

如果当前 agent 没有 Flutter UI 截图保存环境，只能生成销售图所需素材和小程序码数据，不能声称已经保存到相册。

## workflow

1. 收集用户输入
2. 识别已知参数与必填缺口
3. 为缺口参数选择可用获取路径
4. 生成本次任务列表
5. 执行任务并准备销售图素材
6. 选择展示价格并生成小程序码数据
7. 返回销售图素材或执行结果

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
  - 使用工具 `tool.stock_detail` 读取库存详情
  - 组装销售图价格选项
  - 让用户选择展示价格或输入自定义展示金额
  - 使用工具 `tool.wechat_mini_program_link` 生成小程序码数据

### Step 5: 执行任务并准备销售图素材

- 使用工具 `tool.stock_detail` 读取详情
- 从详情中提取：
  - 商品图片：`imageList[].type=1`
  - 商品描述：`description`
  - 原始成本：`originalCost`
  - 售价列表：`priceList`
- 只使用商品图片，不使用商品视频和细节图

### Step 6: 选择展示价格并生成小程序码数据

- 按页面逻辑生成可选展示价格：
  - 成本价：`originalCost`，`settingValueId=0`
  - 销售价：`settingValueId=1971`
  - 同行价：`settingValueId=1973`
  - 零售价：`settingValueId=174`
  - 代理价：`settingValueId=1972`
- 如果详情 `priceList` 中没有对应售价类型：
  - 仍展示该价格类型
  - `salePrice` 使用 `0`
- 用户必须选择一个展示价格，或输入自定义展示金额
- 使用工具 `tool.wechat_mini_program_link` 生成详情页小程序码或链接数据

### Step 7: 返回销售图素材或执行结果

- 如果当前环境只支持 BFF 调用：
  - 返回销售图素材、展示价格、小程序码数据
  - 明确说明未执行 Flutter 截图保存
- 如果当前环境支持 Flutter UI 截图保存：
  - 可在确认后执行保存
  - 返回保存结果

## 参数规则

### `stockNo`

- 必填
- 数据类型：
  - 字符串
- 用途：
  - 读取商品详情
  - 生成小程序码 query 参数
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
  - 使用工具 `tool.stock_list_search` 搜索候选商品，再从用户确认的候选中获取 `stockNo`
- 路径选择规则：
  - 如果用户直接提供 `stockNo`，去掉首尾空白后使用
  - 如果用户提供链接，且链接 query 中存在 `stockNo`，解析 query 参数得到 `stockNo`
  - 如果用户提供的是商品名称、系统货号、自定义货号、独立编码或其他搜索词，使用工具 `tool.stock_list_search` 搜索，入参包含 `searchText`
  - 如果返回多个候选，必须让用户确认目标商品
  - 如果没有返回候选，不能继续生成销售图素材
- 归一化规则：
  - 保持字符串，不要转成数字
  - 不要把 `goodsNo`、`identifier`、`seriesNumber` 当作 `stockNo`

### `displayPrice`

- 必填
- 数据类型：
  - 对象
- 用途：
  - 销售图中展示的价格
- 结构：
  - `settingValueId`：价格类型 ID；自定义输入时可传 `0`
  - `settingValueName`：价格类型名称；自定义输入时可为空或传 `自定义金额`
  - `salePrice`：展示金额
- 用户可能提供的形式：
  - 选择成本价
  - 选择销售价
  - 选择同行价
  - 选择零售价
  - 选择代理价
  - 直接输入金额
- 获取方式：
  - 从工具 `tool.stock_detail` 返回组装价格选项
  - 用户从价格选项中确认
  - 用户直接输入自定义展示金额
- 路径选择规则：
  - 如果用户明确指定展示价格类型，优先匹配价格选项
  - 如果用户直接输入金额，使用自定义展示金额
  - 如果用户没有选择价格也没有输入金额，必须让用户补充
- 归一化规则：
  - `salePrice` 必须是数字
  - 用户自定义输入金额最多 8 位数字
  - 不要把未选择的默认 `0` 价格当作用户已确认价格

## 工具定义

### `tool.stock_list_search`

- 用途：
  - 按商品名称、系统货号、自定义货号、独立编码或其他搜索词搜索库存商品候选
  - 用于在用户没有直接给出 `stockNo` 时补齐目标库存编号
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
  - `data.list[].listImage`
  - `data.list[].priceList`

### `tool.stock_detail`

- 用途：
  - 读取库存商品详情，用于准备销售图素材
- 命令：
  - `./scripts/request-bff.sh GET /stock/inventory/stock/detail '{"stockNo":"<stockNo>"}'`
- 入参：
  - `stockNo`：库存编号，必填
- 出参：
  - `data.stockNo`
  - `data.description`
  - `data.imageList`
  - `data.originalCost`
  - `data.priceList`
  - `data.priceList[].settingValueId`
  - `data.priceList[].settingValueName`
  - `data.priceList[].salePrice`

### `tool.wechat_mini_program_link`

- 用途：
  - 为销售图生成商品详情页小程序码或链接数据
- 命令：
  - `./scripts/request-bff.sh POST /wechat/getMiniProgramLink '{"url":"/pages/stock/inventory/stock/detail/index","queryParams":[{"key":"stockNo","value":"<stockNo>"},{"key":"scene","value":"share"}]}'`
- 入参：
  - `url`：固定传 `/pages/stock/inventory/stock/detail/index`
  - `queryParams`：固定包含 `stockNo` 和 `scene=share`
- 出参：
  - `data.wxCode`
  - `data.wxCodeBase64`
  - `data.miniLink`
  - `data.shortlink`

## 销售图素材规则

- 商品图片：
  - 只读取工具 `tool.stock_detail` 返回的 `imageList`
  - 只使用 `type=1` 的图片
  - 不使用视频
  - 不使用细节图
- 商品描述：
  - 使用工具 `tool.stock_detail` 返回的 `description`
- 价格选项：
  - 成本价：`settingValueName=成本价`，`settingValueId=0`，`salePrice=originalCost`
  - 销售价：`settingValueName=销售价`，`settingValueId=1971`
  - 同行价：`settingValueName=同行价`，`settingValueId=1973`
  - 零售价：`settingValueName=零售价`，`settingValueId=174`
  - 代理价：`settingValueName=代理价`，`settingValueId=1972`
- 小程序码：
  - 使用工具 `tool.wechat_mini_program_link`
  - query 必须包含 `stockNo`
  - query 必须包含 `scene=share`

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
- 商品详情必须能读取成功
- 至少需要 1 张商品图片；如果 `imageList` 中没有 `type=1` 图片，不能生成销售图素材
- 商品描述为空时，可以继续生成素材，但必须标记描述为空
- 必须有展示价格；用户未选择价格也未输入金额时，不能生成最终销售图
- 自定义展示金额必须是数字，最多 8 位
- BFF 不直接生成最终销售图图片
- 当前环境不能执行 Flutter 截图保存时，不要声称已经保存相册
