# ConvoAI CLI — 实时字幕方案 (Real-Time Subtitles)

> **Review 目标**：请 Gemini 3.1 Pro 和 GPT-5.4 审查此方案的技术可行性、风险点和实现细节。

---

## 1. 背景

### 当前问题
ConvoAI CLI 的终端对话面板（`convoai go` / `convoai agent join`）通过**轮询 Agora ConvoAI 的 history API**（每 500ms）获取对话文字。这导致：

- 字幕延迟 0.5-2 秒（轮询间隔 + API 延迟）
- Agent 说话时用户听到声音但看不到文字
- 用户说话的 ASR 识别结果只在一句话结束后才显示
- 无法显示 ASR 的中间结果（partial transcription）

### 目标
**字幕实时推送**——Agent 说的每个字、用户说的每个字，实时出现在终端里，跟声音同步。

### 参考实现
声网官方 Demo（[Conversational-AI-Demo](https://github.com/Shengwang-Community/Conversational-AI-Demo)）的 Web 端使用 RTM + DataStream 实现了三种字幕渲染模式（WORD/TEXT/CHUNK），字幕与音频精确同步。

---

## 2. 技术方案

### 2.1 传输方式选择

| 方式 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **轮询 history API** | 简单 | 延迟高（500ms+），无中间结果 | 当前方案 ❌ |
| **RTM（Real-Time Messaging）** | 实时推送，支持 WORD 模式 | 需要 RTM SDK，复杂度高 | 最优 ⭐ |
| **RTC DataStream** | 实时推送，RTC SDK 已有 | 旧协议，可能不稳定 | 备选 |

**选择 RTM**。理由：
1. 声网官方 Demo 用的就是 RTM
2. RTM SDK 在浏览器端有成熟的 npm 包（`agora-rtm-sdk`）
3. 支持 v2 协议的完整字幕功能（逐词、状态、打断）

### 2.2 Agent 启动参数变更

当前 Agent 启动请求的 `properties` 中需要新增：

```json
{
  "properties": {
    // ... 现有字段 ...
    "parameters": {
      "data_channel": "rtm",
      "transcript": {
        "enable": true,
        "enable_words": false,
        "protocol_version": "v2"
      },
      "enable_metrics": true
    },
    "advanced_features": {
      "enable_rtm": true
    }
  }
}
```

**关键字段**：
- `data_channel: "rtm"` — 启用 RTM 传输
- `transcript.enable: true` — 启用字幕推送
- `transcript.protocol_version: "v2"` — 使用 v2 消息格式
- `transcript.enable_words: false` — 不需要逐词同步（终端不需要音频 PTS 对齐）
- `advanced_features.enable_rtm: true` — 启用 RTM 功能

### 2.3 字幕消息格式（v2 协议）

RTM 推送的消息结构：

**用户转写（ASR 结果）**：
```typescript
{
  object: "user.transcription",
  text: string,          // ASR 识别的文字
  final: boolean,        // true = 最终结果，false = 中间结果
  turn_id: number,
  stream_id: number,
  language: string
}
```

**Agent 转写（LLM + TTS 输出）**：
```typescript
{
  object: "assistant.transcription",
  text: string,           // Agent 说的文字
  turn_id: number,
  turn_status: 0 | 1 | 2, // 0=进行中, 1=结束, 2=被打断
  turn_seq_id: number,
  quiet: boolean
}
```

**打断信号**：
```typescript
{
  object: "message.interrupt",
  turn_id: number
}
```

**延迟指标**：
```typescript
{
  object: "message.metrics",
  // ASR/LLM/TTS 分段延迟
}
```

### 2.4 架构变更

```
当前架构：
  终端 ← 500ms 轮询 history API ← Agora Cloud

新架构：
  终端 ← WebSocket ← headless Chrome ← RTM 实时推送 ← Agora Cloud
                                      ← RTC 音频 ← Agora Cloud
```

变更的组件：

#### A. chat-client.html（headless Chrome 页面）
新增：
1. 引入 `agora-rtm-sdk`（CDN）
2. 初始化 RTM client，连接到同一频道
3. 监听 RTM `message` 事件
4. 收到字幕消息后通过 WebSocket 发送给终端

```javascript
// 伪代码
const rtmClient = AgoraRTM.createInstance(appId);
await rtmClient.login({ uid: String(uid), token: rtmToken });
await rtmClient.subscribe(channelName);

rtmClient.on('message', (event) => {
  const msg = JSON.parse(event.message);
  if (msg.object === 'user.transcription' || msg.object === 'assistant.transcription') {
    ws.send(JSON.stringify({ type: 'transcript', data: msg }));
  }
  if (msg.object === 'message.metrics') {
    ws.send(JSON.stringify({ type: 'metrics', data: msg }));
  }
});
```

#### B. panel.ts（终端 UI）
新增：
1. WebSocket server 监听 `transcript` 类型消息
2. 收到 `user.transcription` → 实时显示用户说的话（final=false 显示灰色中间结果，final=true 显示完整）
3. 收到 `assistant.transcription` → 实时显示 Agent 的话（turn_status=0 持续追加文字，1=完成，2=被打断标记）
4. **去掉 500ms 轮询 history API**（改为 RTM 推送驱动）
5. 保留轮询 turns API 用于延迟统计（或用 `message.metrics` 替代）

终端渲染逻辑：
```
收到 user.transcription (final=false):
  覆盖当前行: [you]  今天天...    ← 灰色，中间结果

收到 user.transcription (final=true):
  打印完整行: [you]  今天天气怎么样？  ← 正常颜色

收到 assistant.transcription (turn_status=0):
  追加文字到当前行: [assistant] 今天北京晴天...  ← 逐步增长

收到 assistant.transcription (turn_status=1):
  行结束，不再追加

收到 message.interrupt:
  当前行标记 ⚡interrupted
```

#### C. go.ts / join.ts
变更：
1. Agent 启动请求新增 `parameters.data_channel`、`transcript`、`advanced_features` 字段
2. RTM Token 需要额外生成（或复用 RTC Token）

#### D. token.ts
可能需要新增 RTM Token 生成（或确认 RTC Token 是否可复用于 RTM）。

### 2.5 RTM Token

根据声网文档，RTM 可以使用 RTC Token（因为底层是同一套鉴权体系）。Agent 启动时传的 `token` 字段同时用于 RTC 和 RTM。客户端连接 RTM 时也使用同一个 Token。

需要验证：客户端的 RTM Token 是否需要单独生成，还是可以用 `generateRtcToken(channel, clientUid)` 的输出。

---

## 3. 风险点

### 3.1 RTM SDK 体积
`agora-rtm-sdk` 的 CDN 版本约 200KB（gzip）。在 headless Chrome 里加载不影响 npm 包体积，但会影响首次加载速度。

### 3.2 RTM 连接稳定性
RTM 是独立于 RTC 的连接。如果 RTM 断连但 RTC 正常，会出现"有声音没字幕"的情况。需要 fallback 机制。

**Fallback 策略**：如果 RTM 连接失败或超时，回退到 500ms 轮询 history API（当前方案）。

### 3.3 中间结果（partial transcription）的覆盖渲染
终端不像浏览器可以轻松覆盖 DOM。显示中间结果需要用 ANSI 控制码覆盖当前行（`\r` + 清行）。如果中间结果频繁更新（每 100ms），终端可能闪烁。

**方案**：中间结果只在同一行覆盖，不换行。用 `process.stdout.write('\r\x1b[K' + text)` 覆盖。final=true 时换行。

### 3.4 client.html vs chat-client.html
两个 HTML 文件都需要改（浏览器模式和终端模式）。或者统一成一个文件。

### 3.5 `enable_rtm: true` 可能影响 Agent 行为
需要验证声网 ConvoAI 在 `enable_rtm: true` 时的行为是否有变化。

---

## 4. 实现步骤

### Phase 1: Agent 请求参数（低风险）
- 在 `go.ts`、`join.ts`、`quickstart.ts` 的 agent request 中加入 `parameters.data_channel`、`transcript`、`advanced_features` 字段
- 验证 Agent 仍能正常启动和对话

### Phase 2: chat-client.html 加 RTM（中风险）
- 引入 RTM SDK CDN
- 初始化 RTM 连接
- 监听字幕消息
- 通过 WebSocket 转发到终端

### Phase 3: panel.ts 实时渲染（中风险）
- WebSocket 接收字幕消息
- 替换轮询为推送驱动
- 实现中间结果覆盖渲染
- Fallback 到轮询

### Phase 4: 浏览器模式同步（低风险）
- client.html 也加 RTM 字幕显示（或只在 headless 模式启用）

---

## 5. 需要确认的问题

1. **RTM Token**：客户端 RTM 是否可以用 RTC Token 连接？还是需要单独的 RTM Token？
2. **RTM SDK CDN URL**：最新的 `agora-rtm-sdk` CDN 地址是什么版本？
3. **`enable_rtm: true`**：是否有额外计费？
4. **`data_channel: "rtm"` vs `"datastream"`**：哪个更适合 CLI 场景？
5. **中国区 RTM 连接**：RTM 在国内是否需要不同的连接配置？

---

## 6. 文件变更清单

| 文件 | 变更 |
|------|------|
| `src/web/chat-client.html` | 加 RTM SDK + 字幕消息监听 + WebSocket 转发 |
| `src/web/client.html` | 可选：加 RTM 字幕显示 |
| `src/commands/agent/panel.ts` | 改为 RTM 推送驱动 + 中间结果渲染 + fallback |
| `src/commands/go.ts` | Agent request 加 RTM/transcript 参数 |
| `src/commands/agent/join.ts` | Agent request 加 RTM/transcript 参数 |
| `src/commands/quickstart.ts` | Agent request 加 RTM/transcript 参数 |
| `src/commands/openclaw.ts` | Agent request 加 RTM/transcript 参数 |
| `src/utils/token.ts` | 可能需要 RTM Token 生成 |
