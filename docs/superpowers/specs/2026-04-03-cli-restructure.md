# ConvoAI CLI 命令体系重构 Spec

## Goal

从用户场景出发重构 CLI 命令体系。废弃冗余命令，新增 `convoai go` 一键对话，重新设计 help 信息分层。

---

## 用户场景 → 命令映射

| 场景 | 命令 |
|------|------|
| 第一次用 | `convoai quickstart` |
| 再次对话（最快路径） | `convoai go` |
| 语音驱动 OpenClaw | `convoai openclaw` |
| 精确控制 Agent | `convoai agent join -c room --model qwen-max ...` |
| 改配置 | `convoai config show/set` |
| 查看/清理 Agent | `convoai agent list/stop/status/history/turns` |

---

## 新增: `convoai go`

### 行为
1. 检查是否有已保存的配置（app_id + llm + tts + asr），没有则提示 `Run convoai quickstart first`
2. 自动生成 channel name (`go-{timestamp}`)
3. 自动生成 RTC token
4. 智能检测对话方式：
   - 有系统 Chrome → 终端模式（headless Chrome，纯 CLI 体验）
   - 没有 Chrome → 浏览器模式（打开系统浏览器）
5. 启动 Agent → 进入运行时控制面板
6. Ctrl+C 退出 → Session Report

### 参数
零必填参数。可选覆盖：
```
convoai go [options]
  -c, --channel <name>     Override channel name
  --setup                  Re-configure ASR/LLM/TTS before starting (skip credentials)
  --model <model>          One-time model override
  --tts <vendor>           One-time TTS override
  --asr <vendor>           One-time ASR override
  --browser                Force browser mode
  --profile <name>         Use a named config profile
```

### --setup 模式
`convoai go --setup` 跳过凭证（已有），只走 ASR → LLM → TTS 配置，然后直接对话。
等同于 quickstart 的精简版——给"想换个模型试试"的用户。

### Corner cases
| 情况 | 处理 |
|------|------|
| 无配置 | 提示 `Run convoai quickstart first` |
| 配置不完整（有 app_id 无 LLM） | 提示缺什么，建议 `convoai go --setup` |
| 上次 Agent 还在跑 | 自动 stop 再启动 |
| 端口 3210 被占 | 自动 kill |
| Token 过期 | 自动重新生成 |
| Chrome 找不到 | fallback 浏览器 |
| 网络不通 | 友好报错 + 提示 |

### 用户旅程
```
第 1 次：convoai quickstart         → 全量配置 + 对话
第 2 次：convoai go                 → 直接对话（用上次配置）
第 3 次：convoai go --setup         → 快速换 ASR/LLM/TTS + 对话
第 3 次：convoai go --model qwen-max → 临时覆盖一个参数
第 N 次：convoai go                 → 秒启动
```

### 注册
顶级命令（不在 agent 子命令下）。

---

## 废弃命令

| 命令 | 处理方式 |
|------|---------|
| `chat` | 废弃。逻辑合并到 `go` 和 `agent join`。顶级 `chat` 命令和 `agent chat` 子命令都移除。 |
| `repl` | 废弃。被运行时控制面板取代。 |
| `agent watch` | 废弃。被运行时控制面板取代。 |

不删代码文件（避免 breaking change），但从 `index.ts` 的命令注册中移除，help 中不再显示。

---

## `agent join` 改造

当前 `agent join` 也接入智能检测（Chrome → 终端/浏览器），与 `go` 共用底层逻辑。区别：
- `go`：零参数，自动一切
- `agent join`：必须指定 `-c channel`，可以精确控制所有参数

`agent join` 启动后也进入运行时控制面板。

---

## Help 信息重新设计

`convoai --help` 或 `convoai`（无参数）显示：

```
  [mascot]  ConvoAI CLI vX.X.X
            Voice AI Engine ⚡🐦

  💡 Quick: convoai go

Start:
  go                Start a voice conversation (uses last config)
  quickstart        First-time setup wizard
  openclaw          Voice-enable your local OpenClaw 🦞

Agent:
  agent join        Join a channel with full control
  agent list        List running agents
  agent stop        Stop agent(s)
  agent status      Check agent status
  agent history     View conversation history
  agent turns       View latency analytics

Config:
  config show       Show current config
  config set        Change a setting
  config init       Re-run setup wizard

More:
  agent speak       Make agent say something
  agent interrupt   Interrupt agent speech
  token             Generate RTC token
  preset list       List built-in presets
  template *        Manage agent templates
  call *            Telephony (Beta)
  completion        Shell completions

Examples:
  convoai go                                Resume last conversation
  convoai agent join -c room1               Join a specific channel
  convoai agent join -c room1 --model qwen-max   Override model
  convoai openclaw                          Talk to OpenClaw by voice

Docs: github.com/Coowoolf/convoai-cli
```

### 智能提示
如果检测到已有配置，最上方显示：
```
  💡 Quick: convoai go
```
如果未配置：
```
  💡 Get started: convoai quickstart
```

### 中英文
- help 信息保持英文（CLI 标准）
- `💡` 提示行根据 config.region 切换：
  - cn: `💡 继续对话: convoai go`
  - global: `💡 Quick: convoai go`

---

## 不在 Scope 内

- 运行时控制面板本身的改动（已在 v1.3.3 完成）
- quickstart 流程改动（已在 v1.3.0 完成）
- install.sh 改动
- Dashboard 改动

---

## 技术影响

### 新建
- `src/commands/go.ts` — `convoai go` 命令

### 修改
- `src/index.ts` — 注册 go，移除 chat/repl/watch，自定义 help 输出
- `src/commands/agent/join.ts` — 接入智能 Chrome 检测（复用 find-chrome + panel）

### 不改（但从注册中移除）
- `src/commands/agent/chat.ts` — 文件保留，不注册
- `src/commands/agent/watch.ts` — 文件保留，不注册
- `src/commands/repl.ts` — 文件保留，不注册
