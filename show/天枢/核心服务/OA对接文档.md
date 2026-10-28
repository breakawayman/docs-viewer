# 天枢资产管理系统 OA 对接文档

本文档面向上游 OA 开发与实施人员，包含两部分：

1. OA 通过天枢开放接口查询基础数据，并在提交流程前执行业务校验和资产预占。
2. OA 通过 RocketMQ 向天枢发送审批流程事件。

适用业务类型：

- 资产入库：`INBOUND`
- 资产领用：`ISSUE`
- 资产归还：`RETURN`
- 资产调拨：`TRANSFER`

# 第一部分 OA 开放接口

## 1. 接口概览

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/open-api/v1/oa/applications/trylock` | 提交前业务校验；领用、归还、调拨通过时预占资产 |
| `POST` | `/open-api/v1/oa/applications/reservations/release` | OA 创建流程失败时释放未绑定的预占 |
| `GET` | `/open-api/v1/oa/categories/tree` | 查询资产分类树 |
| `POST` | `/open-api/v1/oa/assets/query` | 分页查询当前申请场景的可选资产 |
| `GET` | `/open-api/v1/oa/assets/{assetCode}` | 查询单项资产及其在指定场景下的可用性 |
| `GET` | `/open-api/v1/oa/teams/by-department/{oaDeptId}` | 查询 OA 部门到资产团队的映射 |

基础 URL 由天枢联调人按环境提供，例如：

```text
https://assets.example.com/open-api/v1/oa
```

开放接口需要天枢配置 `OA_ENABLED=true` 后才会启用。POST 请求正文使用 `application/json; charset=UTF-8`，最大为 2 MB。

## 2. 请求认证与签名

### 2.1 通用 Header

所有 OA 开放接口都必须携带：

| Header | 必填 | 说明 |
| --- | --- | --- |
| `X-App-Id` | 是 | 天枢分配给 OA 的应用标识 |
| `X-Timestamp` | 是 | 13 位 Unix 毫秒时间戳，默认允许与服务器时间偏差 300 秒 |
| `X-Nonce` | 是 | 单次请求随机串，同一 AppId 下不可重用 |
| `X-Signature` | 是 | HMAC-SHA256 签名，小写十六进制 |
| `X-Trace-Id` | 是 | 链路跟踪标识，建议全局唯一 |

### 2.2 签名规则

先计算原始请求正文的 SHA-256：

```text
bodyHash = lowercase_hex(SHA256(rawBodyUtf8))
```

GET 请求或空正文按空字符串计算 SHA-256。按以下顺序用换行符 `\n` 组装规范串：

```text
UPPERCASE_HTTP_METHOD
RAW_PATH_WITH_QUERY
X-Timestamp
X-Nonce
bodyHash
```

然后使用 OA AppSecret 计算：

```text
X-Signature = lowercase_hex(HMAC_SHA256(canonicalString, appSecret))
```

签名时必须使用实际发送的原始 Body，不得在签名后重新格式化 JSON。`RAW_PATH_WITH_QUERY` 必须包含以 `?` 开始的原始查询串，参数顺序与 URL 一致。

### 2.3 签名示例

```text
POST
/open-api/v1/oa/assets/query
1785382200000
5dc895f7e7f24bc585345fc9b06d11b3
<原始JSON正文的SHA-256小写十六进制>
```

## 3. 统一响应结构

成功响应：

```json
{
  "status": "success",
  "code": "0",
  "message": "OK",
  "data": {},
  "error": null,
  "time": "2026-07-30T11:30:00+08:00",
  "traceId": "5dc895f7e7f24bc585345fc9b06d11b3"
}
```

失败响应：

```json
{
  "status": "error",
  "code": "400001",
  "message": "OA请求字段格式或枚举错误",
  "data": null,
  "error": {
    "code": "400001",
    "message": "OA请求字段格式或枚举错误"
  },
  "time": "2026-07-30T11:30:00+08:00",
  "traceId": "5dc895f7e7f24bc585345fc9b06d11b3"
}
```

## 4. 提交前校验与预占

### 4.1 请求

```http
POST /open-api/v1/oa/applications/trylock
Content-Type: application/json
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `clientRequestNo` | String | 是 | OA 客户端请求号，用于关联预占和后续流程 |
| `bizType` | String | 是 | `INBOUND` / `ISSUE` / `RETURN` / `TRANSFER` |
| `applicantOaUserId` | String | 是 | 申请人 OA 用户标识 |
| `applicantDeptOaId` | String | 是 | 申请人 OA 部门标识 |
| `assetIds` | Long[] | 否 | 资产主键列表，与 `assetCodes` 按对接方案选用 |
| `assetCodes` | String[] | 否 | 资产编码列表 |
| `sourceDeptOaId` | String | 条件必填 | 调出部门 OA ID，主要用于调拨 |
| `targetDeptOaId` | String | 条件必填 | 调入部门 OA ID，主要用于调拨 |
| `formDigest` | String | 否 | OA 表单摘要，用于请求一致性核对 |
| `formData` | Object | 条件必填 | OA 表单业务数据；入库必须携带完整表单 |

示例：

```json
{
  "clientRequestNo": "OA-REQ-20260730-001",
  "bizType": "ISSUE",
  "applicantOaUserId": "OA-U-001",
  "applicantDeptOaId": "OA-DEPT-001",
  "assetCodes": ["TS-000001"],
  "formDigest": "OA端计算的表单摘要",
  "formData": {
    "schemaVersion": "1.0",
    "applicationNo": "LY-20260730-001",
    "assetCodes": ["TS-000001"]
  }
}
```

### 4.2 响应

| 字段 | 说明 |
| --- | --- |
| `passed` | 是否通过全部校验 |
| `reservationToken` | 预占令牌；入库不需预占或校验失败时可为空 |
| `expiresAt` | 预占过期时间 |
| `normalizedTeamId` | 申请人部门映射后的资产团队 ID |
| `violations` | 校验失败明细，包含 `assetId`、`code`、`message` |

校验成功返回 HTTP `200`。业务校验未通过返回 HTTP `422` 和错误码 `422001`，具体失败项在 `data.violations` 中。

`ISSUE`、`RETURN`、`TRANSFER` 校验成功后，OA 必须将 `reservationToken` 原样写入后续 `SUBMITTED` MQ 消息。

## 5. 释放资产预占

OA 已获取 `reservationToken` 但创建或提交审批流程失败时，应调用本接口释放预占。

```http
POST /open-api/v1/oa/applications/reservations/release
Content-Type: application/json
```

```json
{
  "reservationToken": "TRYLOCK-RETURNED-TOKEN",
  "reason": "OA流程创建失败"
}
```

`reservationToken` 和 `reason` 均必填。释放操作幂等；已绑定正式业务单的预占不允许通过本接口释放。

## 6. 查询资产分类

```http
GET /open-api/v1/oa/categories/tree?enabled=true
```

`enabled` 可选，默认为 `true`。响应 `data` 是分类列表，每项包含：

| 字段 | 说明 |
| --- | --- |
| `categoryId` | 分类主键 |
| `categoryCode` | 分类编码 |
| `categoryName` | 分类名称 |
| `level` | 分类层级 |
| `parentId` | 父分类 ID，根分类为空 |
| `enabled` | `1` 启用，`0` 停用 |
| `version` | 乐观锁版本 |

> 当 URL 含有 `?enabled=true` 时，签名规范串中也必须包含该查询串。

## 7. 分页查询可选资产

```http
POST /open-api/v1/oa/assets/query
Content-Type: application/json
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `bizType` | String | 否 | `INBOUND` / `ISSUE` / `RETURN` / `TRANSFER` |
| `applicantOaUserId` | String | 否 | 申请人 OA 用户 ID |
| `deptOaId` | String | 否 | 申请人 OA 部门 ID |
| `sourceDeptOaId` | String | 否 | 调拨场景的调出部门 OA ID |
| `keyword` | String | 否 | 资产编码、名称或 SN 模糊关键字 |
| `categoryId` | Long | 否 | 资产分类主键 |
| `pageNo` | Integer | 否 | 页码，默认 1 |
| `pageSize` | Integer | 否 | 每页数量，默认 20，最大 100 |

```json
{
  "bizType": "ISSUE",
  "applicantOaUserId": "OA-U-001",
  "deptOaId": "OA-DEPT-001",
  "keyword": "笔记本",
  "categoryId": 1001,
  "pageNo": 1,
  "pageSize": 20
}
```

响应 `data` 包含 `pageNo`、`pageSize`、`total`、`records`。`records` 每项包含：

- `assetCode`、`assetName`、`brand`、`model`、`sn`、`status`、`version`；
- `category`：分类的 `id`、`code`、`name`；
- `team`：所属团队的 `id`、`code`、`name`；
- `eligibility`：当前申请场景下是否可选；
- `unavailableReason`：不可选原因，可选时为空。

## 8. 查询单项资产

```http
GET /open-api/v1/oa/assets/{assetCode}?bizType=ISSUE&applicantOaUserId=OA-U-001&sourceDeptOaId=OA-DEPT-001
```

| 参数 | 位置 | 必填 | 说明 |
| --- | --- | --- | --- |
| `assetCode` | Path | 是 | 资产编码 |
| `bizType` | Query | 是 | 业务类型 |
| `applicantOaUserId` | Query | 是 | 申请人 OA 用户 ID |
| `sourceDeptOaId` | Query | 否 | 调出部门 OA ID |

响应 `data` 结构与资产分页查询的 `records` 单项相同。

## 9. 查询部门与团队映射

```http
GET /open-api/v1/oa/teams/by-department/{oaDeptId}
```

响应 `data` 包含：

| 字段 | 说明 |
| --- | --- |
| `originalDept` | OA 传入的原始部门：`deptId`、`oaDeptId`、`deptName` |
| `firstLevelDept` | 原始部门归属的一级部门 |
| `team` | 映射的资产团队：`teamId`、`teamCode`、`teamName` |
| `passed` | 部门与团队映射是否完整有效 |

`passed=false` 时，OA 应阻止提交并提示管理员完成部门与资产团队的映射。

## 10. HTTP 错误码

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `400001` | OA 请求字段、JSON 格式或枚举错误 |
| 401 | `401001` | AppId、时间戳或签名无效/已过期 |
| 401 | `401002` | Nonce 已使用，命中防重放校验 |
| 404 | `404001` | 资产不存在或无权查看 |
| 409 | `409001` | 资产已被其他流程预占 |
| 409 | `409002` | 预占令牌状态冲突 |
| 422 | `422001` | 提交前业务校验未通过 |
| 500 | `500001` | OA 开放接口处理失败 |

OA 不应对 400、401、404、409、422 无限自动重试。仅在网络异常或服务端 5xx 时按退避策略重试；每次重试需生成新的时间戳、Nonce 和签名，业务请求号保持不变。

# 第二部分 RocketMQ 对接

## 1. 文档说明

本部分约定 OA 审批流程事件通过 RocketMQ 推送至天枢资产管理系统的消息契约、顺序、幂等与异常处理要求。

## 2. 对接架构

```text
OA 系统
  └── Producer 发送普通有序消息
         └── Topic: tianshu_oa_workflow_event
                └── Consumer Group: tianshu_assets_oa_workflow_cg
                       └── 天枢契约校验
                              └── Inbox 持久化
                                     └── 异步推进资产业务
```

天枢 MQ 消费线程只负责契约校验和 Inbox 落库。Inbox 成功落库，或相同 `eventId` 已经存在时，消息即可 ACK；实际资产业务由后台任务异步处理。

## 3. RocketMQ 连接信息

| 配置项 | 约定 |
| --- | --- |
| NameServer | 由环境管理员提供，格式为 `host:9876` |
| Topic | `tianshu_oa_workflow_event` |
| Consumer Group | `tianshu_assets_oa_workflow_cg` |
| Message Model | `CLUSTERING` |
| Consume Mode | `ORDERLY` |
| Selector | `SUBMITTED\|\|NODE_COMPLETED\|\|APPROVED\|\|REJECTED\|\|CANCELED\|\|TERMINATED` |
| 消息类型 | 普通有序消息，非事务消息 |
| 最大消息体 | 1 MB |
| 编码 | UTF-8 JSON |
| ACL | 若 Broker 开启 ACL，由环境管理员提供 AccessKey/SecretKey |

Topic 和 Consumer Group 应由 RocketMQ 管理员在联调前创建并授权。生产环境不应依赖 Broker 自动创建 Topic 或 Consumer Group。

## 4. 消息元数据契约

### 4.1 基本属性

| 属性 | 必填 | 要求 |
| --- | --- | --- |
| Topic | 是 | 固定为 `tianshu_oa_workflow_event` |
| Tag | 是 | 必须等于正文的 `eventType` |
| Key | 是 | 必须等于正文的 `eventId` |
| Sharding Key | 是 | 使用 `processInstanceId`，保证同一流程的事件进入同一队列 |
| Body | 是 | UTF-8 JSON，不得为空，不得超过 1 MB |

> `UNIQ_KEY` 是 RocketMQ 自动生成的消息标识，不能替代业务 Key。OA 必须显式设置 Message Key。

### 4.2 User Properties

| 属性 | 必填 | 固定值/说明 |
| --- | --- | --- |
| `contractVersion` | 是 | 当前固定为 `1.0` |
| `traceId` | 是 | 非空的链路跟踪号，建议全局唯一 |
| `sourceSystem` | 是 | 固定为 `OA` |

## 5. 消息正文

### 5.1 通用字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `eventId` | String | 是 | OA 事件全局唯一 ID，同时用作 Message Key 和幂等键 |
| `requestId` | String | 是 | OA 申请/请求唯一 ID，同一流程全程不变 |
| `processInstanceId` | String | 是 | OA 流程实例 ID，同时用作 Sharding Key |
| `eventSeq` | Long | 是 | 流程内正整数序号，从 1 开始严格连续递增 |
| `eventType` | String | 是 | 事件类型，必须与 Tag 一致 |
| `bizType` | String | 是 | `INBOUND` / `ISSUE` / `RETURN` / `TRANSFER` |
| `reservationToken` | String | 条件必填 | `ISSUE`/`RETURN`/`TRANSFER` 的 `SUBMITTED` 事件必填，值来自提交前预检接口 |
| `currentNode` | String | 是 | 当前审批节点名称 |
| `approvalResult` | String | 终态必填 | 终态事件中必须与 `eventType` 完全一致 |
| `occurredAt` | String | 是 | ISO 8601 带时区时间，例如 `2026-07-30T11:30:00+08:00` |
| `completedAt` | String | 终态必填 | 流程结束时间，ISO 8601 带时区 |
| `formData` | Object/null | 条件必填 | `SUBMITTED` 和 `APPROVED` 必须为 JSON 对象，且包含非空 `schemaVersion` |

JSON 字段名必须使用 `bizType`，不得改为 `businessType`。

### 5.2 事件类型

| 事件 | 含义 | 附加要求 |
| --- | --- | --- |
| `SUBMITTED` | 流程已提交 | 必须是流程首条事件；`eventSeq=1`；`formData.schemaVersion` 必填 |
| `NODE_COMPLETED` | 某审批节点已完成 | 可出现多次，每次使用新的 `eventId` 和连续的 `eventSeq` |
| `APPROVED` | 流程审批通过 | 终态；`approvalResult=APPROVED`；`completedAt` 和 `formData.schemaVersion` 必填 |
| `REJECTED` | 流程已驳回 | 终态；`approvalResult=REJECTED`；`completedAt` 必填 |
| `CANCELED` | 流程已撤销 | 终态；`approvalResult=CANCELED`；`completedAt` 必填 |
| `TERMINATED` | 流程已终止 | 终态；`approvalResult=TERMINATED`；`completedAt` 必填 |

流程进入任一终态后，OA 不得再发送该流程的后续事件。

## 6. 顺序与幂等要求

### 6.1 顺序要求

1. OA Producer 必须使用 `processInstanceId` 作为顺序分片键。
2. 同一 `requestId`/`processInstanceId` 内，`eventSeq` 必须从 1 开始严格连续递增。
3. 流程首条事件必须是 `SUBMITTED`。
4. 不同流程之间无顺序要求，可并行发送。
5. 若系统已处理到序号 `N`，收到小于等于 `N` 的事件视为重复；收到大于 `N+1` 的事件视为序号缺口，保留在 Inbox 等待前序事件。

正常示例：

```text
SUBMITTED(1) -> NODE_COMPLETED(2) -> NODE_COMPLETED(3) -> APPROVED(4)
```

### 6.2 幂等要求

- `eventId` 是事件幂等键，一旦生成不得重新分配给其他事件。
- OA 因发送超时而重试时，必须复用原 `eventId`、`eventSeq`、Key、Tag、Sharding Key 和完全相同的 Body。
- 不得通过更换 `eventId` 的方式重试同一业务事件，否则可能被视为新事件。
- 天枢系统对重复 `eventId` 进行幂等接收。

## 7. 完整消息示例

### 7.1 SUBMITTED（入库）

Message Properties：

```text
Topic       = tianshu_oa_workflow_event
Tag         = SUBMITTED
Key         = EVENT-INBOUND-20260730-001
ShardingKey = PROC-INBOUND-20260730-001

contractVersion = 1.0
traceId          = TRACE-INBOUND-20260730-001
sourceSystem     = OA
```

Body：

```json
{
  "eventId": "EVENT-INBOUND-20260730-001",
  "requestId": "REQ-INBOUND-20260730-001",
  "processInstanceId": "PROC-INBOUND-20260730-001",
  "eventSeq": 1,
  "eventType": "SUBMITTED",
  "bizType": "INBOUND",
  "currentNode": "发起",
  "occurredAt": "2026-07-30T11:30:00+08:00",
  "formData": {
    "schemaVersion": "1.0",
    "applicationNo": "RK-20260730-001",
    "purchaseReason": "新员工设备采购",
    "useDeptOaId": "OA-DEPT-001",
    "lines": [
      {
        "lineNo": "1",
        "categoryLevel2Id": 1001,
        "assetName": "笔记本电脑",
        "quantity": 1
      }
    ]
  }
}
```

### 7.2 SUBMITTED（领用）

`ISSUE` 与入库的主要差异是必须传入提交前预检返回的 `reservationToken`。

```json
{
  "eventId": "EVENT-ISSUE-20260730-001",
  "requestId": "REQ-ISSUE-20260730-001",
  "processInstanceId": "PROC-ISSUE-20260730-001",
  "eventSeq": 1,
  "eventType": "SUBMITTED",
  "bizType": "ISSUE",
  "reservationToken": "使用提交前预检接口返回的真实令牌",
  "currentNode": "发起",
  "occurredAt": "2026-07-30T11:30:00+08:00",
  "formData": {
    "schemaVersion": "1.0",
    "applicationNo": "LY-20260730-001",
    "applicantOaUserId": "OA-U-001",
    "issueReason": "工作使用",
    "assetCodes": ["TS-000001"]
  }
}
```

其 Message Key 必须为 `EVENT-ISSUE-20260730-001`，Tag 必须为 `SUBMITTED`，Sharding Key 必须为 `PROC-ISSUE-20260730-001`。

### 7.3 NODE_COMPLETED

```json
{
  "eventId": "EVENT-ISSUE-20260730-002",
  "requestId": "REQ-ISSUE-20260730-001",
  "processInstanceId": "PROC-ISSUE-20260730-001",
  "eventSeq": 2,
  "eventType": "NODE_COMPLETED",
  "bizType": "ISSUE",
  "currentNode": "部门负责人审批完成",
  "occurredAt": "2026-07-30T11:40:00+08:00",
  "formData": null
}
```

### 7.4 APPROVED

```json
{
  "eventId": "EVENT-ISSUE-20260730-003",
  "requestId": "REQ-ISSUE-20260730-001",
  "processInstanceId": "PROC-ISSUE-20260730-001",
  "eventSeq": 3,
  "eventType": "APPROVED",
  "bizType": "ISSUE",
  "currentNode": "流程结束",
  "approvalResult": "APPROVED",
  "occurredAt": "2026-07-30T11:50:00+08:00",
  "completedAt": "2026-07-30T11:50:00+08:00",
  "formData": {
    "schemaVersion": "1.0",
    "applicationNo": "LY-20260730-001",
    "applicantOaUserId": "OA-U-001",
    "assetCodes": ["TS-000001"]
  }
}
```

### 7.5 REJECTED / CANCELED / TERMINATED

以 `REJECTED` 为例：

```json
{
  "eventId": "EVENT-ISSUE-20260730-003-R",
  "requestId": "REQ-ISSUE-20260730-001",
  "processInstanceId": "PROC-ISSUE-20260730-001",
  "eventSeq": 3,
  "eventType": "REJECTED",
  "bizType": "ISSUE",
  "currentNode": "流程结束",
  "approvalResult": "REJECTED",
  "occurredAt": "2026-07-30T11:50:00+08:00",
  "completedAt": "2026-07-30T11:50:00+08:00",
  "formData": null
}
```

`CANCELED` 和 `TERMINATED` 使用相同结构，并将 Tag、`eventType` 和 `approvalResult` 同步改为对应值。

## 8. Producer 发送要求

Producer 发送时应明确设置 Topic、Tag、Key、User Properties 和顺序分片键。伪代码如下：

```java
Message<String> message = MessageBuilder.withPayload(jsonBody)
        .setHeader(RocketMQHeaders.KEYS, eventId)
        .setHeader("contractVersion", "1.0")
        .setHeader("traceId", traceId)
        .setHeader("sourceSystem", "OA")
        .build();

rocketMQTemplate.syncSendOrderly(
        "tianshu_oa_workflow_event:" + eventType,
        message,
        processInstanceId
);
```

具体 API 以 OA 所使用的 RocketMQ Client 版本为准，但最终生成的消息必须满足本文第 4、5、6 节的契约。

## 9. 重试与异常处理

### 9.1 OA Producer

- 同步发送返回成功时，OA 保存 Broker 返回的 Message ID 便于追溯。
- 返回失败或超时时允许重试，但必须按第 6.2 节复用完全相同的业务消息。
- 建议 OA 端保存 `eventId` 、Message ID、`traceId`、发送次数和最后一次发送结果。
- 不得因为网络超时自动跳过当前 `eventSeq`。

### 9.2 天枢 Consumer

- JSON 无法反序列化、必填字段缺失、Key/Tag 不匹配、User Properties 错误等契约异常会抛出失败，触发 RocketMQ 重试。
- Consumer 配置的最大重新消费次数为 10。持续失败的消息将按 RocketMQ 机制进入重试/死信流程。
- 契约校验通过后先写入 Inbox，业务处理失败不会阻塞 MQ 消费线程。
- Inbox 业务处理采用 1、5、15、30、60、120、240、480、720、1440 分钟退避重试；超过重试上限或确认为永久错误时进入 `DEAD` 状态，由管理员人工处理。

## 10. 联调步骤

1. 确认 NameServer 和 Broker 网络可达，以及 ACL 权限正确。
2. 确认 Topic `tianshu_oa_workflow_event` 已创建。
3. 启动天枢应用，在 Dashboard 中确认 Consumer Group `tianshu_assets_oa_workflow_cg` 的在线数 `Quantity >= 1`。
4. 在 Consumer 在线后发送一条全新的 `SUBMITTED` 消息。
5. 核对 OA 侧发送结果、RocketMQ Message ID、天枢应用日志和 Inbox 记录。
6. 按相同 `processInstanceId` 依次发送 `NODE_COMPLETED` 和一个终态事件。
7. 验证重复发送同一 `eventId` 时不会重复推进业务。
8. 验证序号缺口、非法 JSON、错误 Tag/Key 等异常场景的告警与补偿流程。

## 11. 验收标准

- OA 可连续发送完整流程，同一流程的消息顺序与 `eventSeq` 一致。
- 天枢可根据 Message Key、Message ID 和 `traceId` 完成端到端追溯。
- 合法消息能落入 Inbox，并最终更新为 `SUCCESS`。
- 重复消息不会导致重复建单或重复更新资产状态。
- 乱序事件不会越过缺失事件推进流程。
- 非法契约消息不会落入正常业务，且能通过日志或 RocketMQ 重试/死信队列定位。

## 12. 常见问题

| 现象 | 检查项 |
| --- | --- |
| Consumer Group 存在但 `Quantity=0` | 消费者未在线；检查 NameServer、Broker 对外注册地址、ACL 和应用启动日志 |
| 消息存在但未消费 | 确认消费者已在线后再发送新消息，并检查 Topic、Tag 过滤与消费位点 |
| 持续重试 | 检查 Body 是否为合法 JSON，以及 Key、Tag、User Properties 和必填字段 |
| `Tag与eventType不一致` | 保证 RocketMQ Tag 与 JSON `eventType` 完全一致，包括大小写 |
| `Key必须等于eventId` | 显式设置业务 Message Key，不要将 `UNIQ_KEY` 当作 Key |
| `OA事件序号存在缺口` | 补发缺失的前序事件，不得直接跳号 |
| `SUBMITTED/APPROVED必须包含schemaVersion` | 确保 `formData` 为 JSON 对象且 `formData.schemaVersion` 非空 |
| 非入库 `SUBMITTED` 被拒绝 | 使用提交前预检接口返回的真实 `reservationToken` |

## 13. 联调信息清单

联调前由双方确认并填写：

| 项目 | 值 |
| --- | --- |
| 环境 | 待填写 |
| NameServer | 待填写 |
| Topic | `tianshu_oa_workflow_event` |
| OA Producer Group | 待 OA 提供 |
| 天枢 Consumer Group | `tianshu_assets_oa_workflow_cg` |
| ACL AccessKey | 通过安全渠道提供，不写入本文档 |
| 天枢联调人 | 待填写 |
| OA 联调人 | 待填写 |
