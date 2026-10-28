# 天枢资产管理系统 V2 RESTful API 接口文档

## 1. 全局约定

### 1.1 基本信息

| 项目 | 值 |
|---|---|
| 管理端基础路径 | `/api` |
| OA 开放接口基础路径 | `/open-api/v1/oa` |
| 默认服务端口 | `19080` |
| 数据格式 | JSON，文件上传除外 |
| 字符集 | UTF-8 |
| 时间格式 | `yyyy-MM-dd'T'HH:mm:ss` 或带时区的 ISO-8601 |
| 认证方式 | `Authorization: Bearer <token>` |

除登录和 OA 开放接口外，管理端接口均要求登录。首次使用初始密码登录的用户只能调用修改密码和退出接口。

### 1.2 通用请求头

管理端 JSON 请求：

| Header | 必填 | 示例 | 说明 |
|---|---:|---|---|
| `Content-Type` | 是 | `application/json` | GET 无请求体时可省略 |
| `Authorization` | 是 | `Bearer 8b52...` | 登录接口除外 |

OA 开放接口必须包含：

| Header | 必填 | 说明 |
|---|---:|---|
| `X-App-Id` | 是 | OA 应用标识 |
| `X-Timestamp` | 是 | 13 位毫秒时间戳，默认容忍偏差 300 秒 |
| `X-Nonce` | 是 | 单次请求随机串，不允许重复 |
| `X-Signature` | 是 | HMAC 签名，小写十六进制 |
| `Content-Type` | POST 必填 | `application/json` |

签名覆盖 HTTP 方法、原始 Path 与 Query、时间戳、Nonce 和原始 Body 的 SHA-256。Query 顺序或 Body 字节变化都会导致验签失败。

### 1.3 通用响应结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | String | `success` 或 `failure` |
| `code` | String | 成功为 `0`，失败为业务错误码 |
| `message` | String | 响应说明 |
| `data` | Object/Array/null | 业务数据 |
| `error` | Object/null | 错误详情，含 `code`、`message` |
| `time` | String | 服务端响应时间，ISO-8601 |

分页 `data`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `records` | Array | 当前页记录 |
| `total` | Long | 总记录数 |
| `page` | Long | 当前页，从 1 开始 |
| `size` | Long | 每页数量，最大 200 |
| `pages` | Long | 总页数 |

成功示例：

```json
{
  "status": "success",
  "code": "0",
  "message": "OK",
  "data": {"id": 1001},
  "error": null,
  "time": "2026-07-28T10:30:00+08:00"
}
```

常见错误示例：

```json
{
  "status": "failure",
  "code": "ASSET-400001",
  "message": "参数校验失败",
  "data": null,
  "error": {"code": "ASSET-400001", "message": "reason 不能为空"},
  "time": "2026-07-28T10:31:00+08:00"
}
```

```json
{
  "status": "failure",
  "code": "ASSET-401001",
  "message": "未登录或登录已失效",
  "data": null,
  "error": {"code": "ASSET-401001", "message": "请重新登录"},
  "time": "2026-07-28T10:32:00+08:00"
}
```

```json
{
  "status": "failure",
  "code": "ASSET-500001",
  "message": "系统内部错误",
  "data": null,
  "error": {"code": "ASSET-500001", "message": "系统繁忙，请稍后重试"},
  "time": "2026-07-28T10:33:00+08:00"
}
```

常见 HTTP 状态：`200` 成功、`400` 参数错误、`401` 未认证、`403` 无权限、`404` 数据不存在、`409` 状态/占用冲突、`422` OA 业务预检失败、`500` 内部错误。

## 2. 公共查询模型

### 2.1 业务单分页参数

适用于 `/api/inbound`、`/api/issues`、`/api/returns`、`/api/transfers`。

| Query 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---|---|
| `page` | Long | 否 | `1` | 页码 |
| `size` | Long | 否 | `20` | 每页数量，最大 200 |
| `localNo` | String | 否 | - | 本地业务单号 |
| `oaRequestId` | String | 否 | - | OA 请求 ID |
| `applicantName` | String | 否 | - | 申请人姓名，模糊匹配（根据 Service 推断） |
| `teamId` | Long | 否 | - | 团队 ID，受数据权限限制 |
| `approvalStatus` | String | 否 | - | 如 `SUBMITTED/APPROVING/APPROVED/REJECTED/CANCELED/TERMINATED` |
| `orderStatus` | String | 否 | - | 业务单状态 |
| `keyword` | String | 否 | - | 综合关键字 |
| `applicationDateFrom` | String(date) | 否 | - | 申请开始日期，`yyyy-MM-dd` |
| `applicationDateTo` | String(date) | 否 | - | 申请结束日期，`yyyy-MM-dd` |

### 2.2 业务单详情响应

| `data` 字段 | 类型 | 说明 |
|---|---|---|
| `order` | Object | 对应入库/领用/归还/调拨主单 |
| `items` | Array | 业务明细 |
| `assets` | Object | `assetId -> Asset` 映射 |
| `attachments` | Array | 附件元数据 |
| `operationLogs` | Array | 操作审计记录 |
| `extra` | Object | 业务类型特有的补充数据 |
| `allowedActions` | Array<String> | 当前用户在当前状态允许执行的动作 |

示例：

```json
{
  "status": "success",
  "code": "0",
  "message": "OK",
  "data": {
    "order": {"id": 2001, "localNo": "LY202607280001", "orderStatus": "PROCESSING"},
    "items": [{"id": 2101, "assetId": 1001, "itemStatus": "WAITING"}],
    "assets": {"1001": {"id": 1001, "assetCode": "IT-LAPTOP-000001", "assetName": "笔记本电脑"}},
    "attachments": [],
    "operationLogs": [],
    "extra": {},
    "allowedActions": ["CONFIRM", "TERMINATE"]
  },
  "error": null,
  "time": "2026-07-28T10:40:00+08:00"
}
```

## 3. 认证接口（AuthController）

### 3.1 登录

- **接口描述**：使用 OA 同步到本系统的账号和本地密码登录。
- **请求方式/路径**：`POST /api/auth/login`
- **权限**：匿名可访问。

Body：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `username` | String | 是 | 登录账号 |
| `password` | String | 是 | 登录密码 |

```json
{"username":"zhangsan","password":"Password123"}
```

响应 `data`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `tokenName` | String | Token Header 名，通常为 `Authorization` |
| `tokenValue` | String | Token 值 |
| `userId` | Long | 用户 ID |
| `realName` | String | 姓名 |
| `deptId` | Long | 部门 ID |
| `roles` | Array<String> | 角色编码 |
| `managedTeamIds` | Array<Long> | 管理的团队 ID |
| `initialPassword` | Boolean | 是否仍使用初始密码 |

```json
{"status":"success","code":"0","message":"OK","data":{"tokenName":"Authorization","tokenValue":"8b52f...","userId":101,"realName":"张三","deptId":10,"roles":["TEAM_ADMIN"],"managedTeamIds":[1,2],"initialPassword":false},"error":null,"time":"2026-07-28T10:00:00+08:00"}
```

备注：默认连续失败 5 次锁定 15 分钟；阈值可配置。

### 3.2 修改密码

- **请求方式/路径**：`POST /api/auth/password`
- **权限**：已登录；初始密码用户允许访问。

| Body 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `currentPassword` | String | 是 | 当前密码 |
| `newPassword` | String | 是 | 新密码，8～64 位且至少含大写、小写字母和数字 |

成功返回通用响应，`data=null`。修改成功后当前登录态处理方式以客户端重新登录为准。

### 3.3 退出登录

- **请求方式/路径**：`POST /api/auth/logout`
- **权限**：已登录。
- **参数**：无。
- **响应**：通用成功响应，`data=null`。

## 4. 资产接口

### 4.1 资产台账（AssetController）

公共 Header：`Authorization: Bearer <token>`。

| 方法 | 路径 | 描述 | 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/assets` | 分页查询资产台账 | Query 见下表 | `PageResponse<Asset>` | `asset:view` |
| GET | `/api/assets/{id}` | 查询资产聚合详情 | Path `id: Long` | `AssetDetailVO` | `asset:view` |
| GET | `/api/assets/{id}/label` | 获取标签/二维码打印数据 | Path `id: Long` | `AssetLabelVO` | `asset:view` |
| GET | `/api/assets/categories` | 查询启用且未删除的分类 | 无 | `Array<AssetCategory>` | 仅登录 |

资产分页 Query：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---|---|
| `page` | Long | 否 | 1 | 页码 |
| `size` | Long | 否 | 20 | 每页数量 |
| `keyword` | String | 否 | - | 编码、名称、SN 等综合关键字（根据 Service 推断） |
| `categoryId` | Long | 否 | - | 分类 ID |
| `teamId` | Long | 否 | - | 所属团队 ID |
| `responsibleUserId` | Long | 否 | - | 责任人 ID |
| `assetStatus` | String | 否 | - | 资产状态，如 `IN_STOCK/IN_USE/TRANSFERRING` |
| `assetCondition` | String | 否 | - | 资产状况枚举 |

`AssetDetailVO` 包含 `asset`、`category`、`inboundOrder`、`assetEvents`、`operationLogs`、`relatedOrders`。`AssetLabelVO` 包含 `assetId`、`assetCode`、`assetName`、`teamName`、`serialNumber`、`qrContent`。

### 4.2 资产分类管理（AssetCategoryManageController）

| 方法 | 路径 | 描述 | 参数 | 响应 | 权限 |
|---|---|---|---|---|---|
| POST | `/api/system/asset-categories` | 创建分类 | Body `AssetCategory` | 创建后的分类 | `asset:category:edit` |
| PUT | `/api/system/asset-categories/{id}` | 更新分类 | Path `id` + Body `AssetCategory` | `data=null` | `asset:category:edit` |
| DELETE | `/api/system/asset-categories/{id}` | 逻辑删除分类 | Path `id` | `data=null` | `asset:category:edit` |

常用 Body 字段：`categoryCode:String`、`categoryName:String`、`parentId:Long`、`level:Integer`、`sortNo:Integer`、`enabled:Integer`。创建时服务强制 `id=null`、`deleted=0`、`enabled=1`；其余未展示字段为实体字段（部分为预估）。

## 5. 入库接口（InboundController）

| 方法 | 路径 | 描述 | 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/inbound` | 入库单分页 | 公共业务单 Query | `PageResponse<InboundOrder>` | `inbound:view` |
| GET | `/api/inbound/{orderId}` | 入库聚合详情 | Path `orderId:Long` | `OrderDetailVO` | `inbound:view` |
| POST | `/api/inbound/items/{itemId}/accept` | 验收入库明细并生成/更新资产 | Path `itemId` + Body | `Asset` | `inbound:handle` |
| POST | `/api/inbound/items/{itemId}/abnormal` | 标记验收异常 | Path `itemId` + Body | `null` | `inbound:handle` |
| POST | `/api/inbound/items/{itemId}/abnormal/handle` | 处理验收异常 | Path `itemId` + Body | `null` | `inbound:handle` |

请求 Body：

```json
// accept；serialNumber 在 Controller 未标 @Valid，是否必填取决于业务规则
{"serialNumber":"SN-LT-20260728-0001"}
```

```json
// abnormal
{"abnormalType":"SERIAL_NUMBER_MISMATCH","abnormalReason":"实物序列号与采购信息不一致"}
```

```json
// abnormal/handle
{"handlingType":"ACCEPT_WITH_CORRECTION","handlingReason":"已核实并修正采购明细"}
```

`abnormalType`、`handlingType` 的精确可选值未在 Controller DTO 中以枚举限制，以上为参考值，应与后端业务约定同步。

## 6. 领用接口（IssueController）

| 方法 | 路径 | 描述 | 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/issues` | 领用单分页 | 公共业务单 Query | `PageResponse<IssueOrder>` | `issue:view` |
| GET | `/api/issues/{orderId}` | 领用聚合详情 | Path `orderId` | `OrderDetailVO` | `issue:view` |
| GET | `/api/issues/{orderId}/items` | 查询领用明细 | Path `orderId` | `Array<IssueItem>` | `issue:view` |
| POST | `/api/issues/items/{itemId}/confirm` | 确认领用/发放 | Path `itemId` | `null` | `issue:handle` |
| POST | `/api/issues/items/{itemId}/terminate` | 终止单条领用 | Path `itemId` + Body | `null` | `issue:handle` |

终止 Body：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `reason` | String | 是 | 终止原因，最大长度以 DTO 校验为准 |

```json
{"reason":"申请人已取消本次领用"}
```

状态不满足操作前置条件时返回 `409`；数据访问范围为总部、所管理团队并集或本人申请。

## 7. 归还接口（ReturnController）

| 方法 | 路径 | 描述 | 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/returns` | 归还单分页 | 公共业务单 Query | `PageResponse<ReturnOrder>` | `return:view` |
| GET | `/api/returns/{orderId}` | 归还聚合详情 | Path `orderId` | `OrderDetailVO` | `return:view` |
| GET | `/api/returns/{orderId}/items` | 查询归还明细 | Path `orderId` | `Array<ReturnItem>` | `return:view` |
| POST | `/api/returns/items/{itemId}/confirm` | 确认归还 | Path `itemId` | `null` | `return:handle` |
| POST | `/api/returns/items/{itemId}/suspend` | 挂起异常归还 | Path `itemId` + Body `{reason}` | `null` | `return:handle` |
| POST | `/api/returns/items/{itemId}/reassign` | 转派处理管理员 | Path `itemId` + Body | `null` | `return:reassign` |

```json
{"reason":"设备外观损坏，等待进一步检测"}
```

```json
{"targetAdministratorId":1024}
```

`targetAdministratorId` 必填，且目标用户需满足管理员业务约束。

## 8. 团队调拨接口（TransferController）

| 方法 | 路径 | 描述 | 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/transfers` | 调拨单分页 | 公共业务单 Query | `PageResponse<TransferOrder>` | `transfer:view` |
| GET | `/api/transfers/{orderId}` | 调拨聚合详情 | Path `orderId` | `OrderDetailVO` | `transfer:view` |
| GET | `/api/transfers/{orderId}/items` | 查询调拨明细 | Path `orderId` | `Array<TransferItem>` | `transfer:view` |
| POST | `/api/transfers/items/{itemId}/dispatch` | 来源团队确认发出 | Path `itemId` | `null` | `transfer:handle` |
| POST | `/api/transfers/items/{itemId}/receive` | 目标团队确认接收 | Path `itemId` | `null` | `transfer:handle` |
| POST | `/api/transfers/items/{itemId}/cancel` | 发出前取消 | Path `itemId` + Body `{reason}` | `null` | `transfer:handle` |
| POST | `/api/transfers/items/{itemId}/reject` | 目标团队拒收 | Path `itemId` + Body `{reason}` | `null` | `transfer:handle` |
| POST | `/api/transfers/items/{itemId}/return-confirm` | 来源团队确认退回 | Path `itemId` | `null` | `transfer:handle` |

原因示例：`{"reason":"目标团队无接收需求"}`。各动作有严格状态前置条件，并使用事务和数据库行锁防止重复处理。

## 9. 系统管理接口

### 9.1 基础数据查询（SystemQueryController）

| 方法 | 路径 | 描述 | Query 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/system/users` | 查询 OA 同步用户，不返回密码哈希 | 无 | `Array<SysUser>` | `system:user:view` |
| GET | `/api/system/departments` | 查询 OA 同步部门 | 无 | `Array<SysDept>` | `system:dept:view` |
| GET | `/api/system/roles` | 查询角色 | 无 | `Array<SysRole>` | `system:role:view` |
| GET | `/api/system/menus` | 查询启用菜单 | 无 | `Array<SysMenu>` | 仅登录 |
| GET | `/api/system/login-logs` | 登录日志分页 | `page=1`、`size=20`、`username?`、`success?` | `PageResponse<SysLoginLog>` | `system:user:view` |

登录日志 `size` 会被限制在 1～200。`success=true/false` 分别映射成功/失败日志。

### 9.2 角色与用户授权（SystemManagementController）

| 方法 | 路径 | 描述 | 请求参数 | 响应 | 权限 |
|---|---|---|---|---|---|
| POST | `/api/system/roles` | 创建角色 | Body `RoleSaveRequest` | `SysRole` | `system:role:edit` |
| PUT | `/api/system/roles/{id}` | 更新角色 | Path `id` + Body | `SysRole` | `system:role:edit` |
| PUT | `/api/system/roles/{id}/enabled` | 启停角色 | Query `enabled:Boolean` | `null` | `system:role:edit` |
| DELETE | `/api/system/roles/{id}` | 删除角色 | Path `id` | `null` | `system:role:edit` |
| GET | `/api/system/roles/{id}/menus` | 查询角色菜单 ID | Path `id` | `Array<Long>` | `system:role:view` |
| PUT | `/api/system/roles/{id}/menus` | 整体替换角色菜单 | Body `{ids:[...]}` | `null` | `system:role:edit` |
| GET | `/api/system/users/{id}/roles` | 查询用户角色 ID | Path `id` | `Array<Long>` | `system:user:view` |
| PUT | `/api/system/users/{id}/roles` | 整体替换用户角色 | Body `{ids:[...]}` | `null` | `system:user:authorize` |
| POST | `/api/system/users/{id}/password/reset` | 重置用户密码 | Body | `null` | `system:user:reset-password` |

角色 Body：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `roleCode` | String | 是 | 唯一角色编码 |
| `roleName` | String | 是 | 角色名称 |
| `dataScope` | String | 是 | 数据范围编码，如 `ALL/TEAM/SELF`（可选值为合理推测） |

重置密码 Body：

```json
{"newPassword":"NewPassword123","reason":"用户忘记密码，经身份核验后重置"}
```

新密码需满足复杂度规则；重置后用户下次登录必须改密，用户授权变更可能使原会话失效。

### 9.3 团队管理（TeamController）

| 方法 | 路径 | 描述 | 参数 | 响应 | 权限 |
|---|---|---|---|---|---|
| GET | `/api/system/teams` | 查询团队 | 无 | `Array<Team>` | `system:team:view` |
| PUT | `/api/system/teams/{teamId}/enabled` | 启停团队 | Query `enabled:Boolean` | `null` | `system:team:edit` |
| GET | `/api/system/teams/{teamId}/administrators` | 查询管理员 ID | Path `teamId` | `Array<Long>` | `system:team:view` |
| PUT | `/api/system/teams/{teamId}/administrators` | 整体替换管理员 | Body `{userIds:[...]}` | `null` | `system:team:edit` |
| POST | `/api/system/teams/{teamId}/administrators/{userId}` | 添加管理员 | 两个 Path 参数 | `null` | `system:team:edit` |
| DELETE | `/api/system/teams/{teamId}/administrators/{userId}` | 移除管理员 | 两个 Path 参数 | `null` | `system:team:edit` |

团队 Body：

```json
{"teamCode":"TEAM-SH-IT","teamName":"上海 IT 资产团队","firstLevelDeptId":10}
```

`teamCode`、`teamName` 必填；`firstLevelDeptId` 表示映射的一层部门。

## 10. 工作台与消息

### 10.1 工作台（DashboardController）

| 方法 | 路径 | 描述 | 响应 data | 权限 |
|---|---|---|---|---|
| GET | `/api/dashboard/overview` | 查询资产概览 | `DashboardOverviewVO` | `dashboard:view` |
| GET | `/api/dashboard/pending-tasks` | 查询当前数据范围内待办数 | `PendingTaskSummaryVO` | `dashboard:view` |

概览字段：`assetTotal`、`inStock`、`inUse`、`transferring`、`inboundAbnormal`、`teamDistribution[{teamId,teamName,assetCount}]`。

待办字段：`inboundAbnormal`、`transferAbnormal`、`waitingInbound`、`waitingIssue`、`waitingReturn`、`waitingDispatch`、`waitingReceive`、`waitingReturnConfirmation`。

### 10.2 站内消息（MessageController）

| 方法 | 路径 | 描述 | 参数 | 响应 data | 权限 |
|---|---|---|---|---|---|
| GET | `/api/messages` | 当前用户消息分页 | Query `page=1,size=20,unreadOnly?` | `PageResponse<MessageVO>` | 已登录 |
| GET | `/api/messages/unread-count` | 未读消息数量 | 无 | `Long` | 已登录 |
| POST | `/api/messages/{id}/read` | 标记本人消息已读 | Path `id` | `null` | 已登录 |
| POST | `/api/messages/read-all` | 标记本人全部消息已读 | 无 | `null` | 已登录 |

`MessageVO` 字段：`id`、`messageType`、`title`、`content`、`businessType`、`businessId`、`readFlag`、`readTime`、`createdTime`、`routePath`。访问他人消息按不存在处理。

## 11. 文件接口（FileController）

### 11.1 上传文件

- **请求方式/路径**：`POST /api/files/upload`
- **Content-Type**：`multipart/form-data`
- **权限**：已登录。

| Form 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `file` | Binary | 是 | 上传文件 |
| `businessType` | String | 是 | `INBOUND/ISSUE/RETURN/TRANSFER` |
| `businessId` | Long | 是 | 业务单/明细 ID，具体关联由业务约定 |
| `assetId` | Long | 否 | 关联资产 ID |
| `fileUsage` | String | 是 | 文件用途，如 `ABNORMAL_IMAGE`（参考值） |

响应为 `StoredFile`，常见字段包括文件 ID、业务类型/ID、资产 ID、用途、原始文件名、对象 Key、大小、Content-Type 和创建时间。

备注：异常图片仅允许 jpg/jpeg/png，单张不超过 2 MB，同一业务明细与用途最多 3 张；整体请求上限 7 MB。

### 11.2 获取访问地址

- **请求方式/路径**：`GET /api/files/{id}/access-url`
- **Path 参数**：`id: Long`，必填。
- **响应 data**：String，COS 公网 URL 或私有桶短时签名 URL；默认签名有效期 10 分钟。

## 12. 审计接口（BusinessAuditController）

| 方法 | 路径 | 描述 | Path 参数 | 响应 | 权限 |
|---|---|---|---|---|---|
| GET | `/api/admin/audit/business/{businessType}/{businessId}` | 按业务单查询操作日志 | `businessType:String`、`businessId:Long` | `Array<BusinessOperationLog>` | `system:audit:view` |
| GET | `/api/admin/audit/assets/{assetId}` | 按资产查询操作日志 | `assetId:Long` | `Array<BusinessOperationLog>` | `system:audit:view` |

`businessType` 仅支持 `INBOUND/ISSUE/RETURN/TRANSFER`。非总部管理员仍受对应业务单/资产数据范围限制。

## 13. 错误码与业务注意事项

| 错误码 | HTTP | 说明 |
|---|---:|---|
| `ASSET-400001` | 400 | 管理端参数或文件不符合约束 |
| `ASSET-401001` | 401 | 未登录、登录失效或凭据错误 |
| `ASSET-403001` | 403 | 无功能权限或数据权限 |
| `ASSET-404001` | 404 | 数据不存在；越权详情也可能按不存在返回 |
| `ASSET-409001` | 409 | 当前业务/资产状态冲突 |
| `ASSET-409002` | 409 | 资产被其他业务占用 |
| `400001` | 400 | OA 字段、JSON 或枚举错误 |
| `401001/401002` | 401 | OA 签名、时间戳或 Nonce 重放无效 |
| `409001/409002` | 409 | OA 资产预约冲突或令牌状态冲突 |
| `422001` | 422 | OA trylock 业务预检未通过 |
| `COS-500001` | 500 | COS 上传或删除补偿失败 |

其他说明：

- 列表与详情都会执行数据范围校验：总部管理员可见全部；团队管理员可见所管团队并集；普通员工通常仅可见本人资产或本人申请。
- 入库、领用、归还、调拨的处理动作均具有状态前置条件，并通过事务与数据库行锁避免并发重复处理。
- OA 审批事件通过 RocketMQ + Inbox 异步处理，不提供 HTTP 审批回调接口。
- 接口当前没有显式 HTTP 频率限制实现；生产环境建议在网关对登录、文件上传和 OA 查询接口设置限流（建议项）。
- 所有生产密钥必须由 Nacos/Jenkins/环境变量注入，不得写入请求示例或代码仓库。
