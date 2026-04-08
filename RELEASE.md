# ConvoAI CLI v1.7.0 — Release Notes

> **Telephony: Phone Calls & Number Management**

```bash
npm install -g convoai
convoai phone send
```

---

## Highlights

### Phone Calls from Your Terminal

```bash
# Interactive mode — prompts for everything
convoai phone send

# Flag mode — for scripts and automation
convoai phone send --from +15551234567 --to +15559876543 --task "Ask about demo" --wait

# Quick call from go
convoai go --call
```

`--wait` shows live call status:
```
✓ Call initiated
  ⠋ Ringing...
  ⠋ In conversation (0:32)
  ✓ Call ended (duration: 0:47)
```

### Phone Number Management

```bash
convoai phone import          # Interactive SIP config (Twilio or BYO)
convoai phone numbers         # List imported numbers
convoai phone number <num>    # View details
convoai phone update <num>    # Update config
convoai phone remove <num>    # Delete
```

### Quickstart + Go Integration

- `convoai quickstart` Step 5 now offers: Voice Chat / Phone Call / OpenClaw
- `convoai go --call` enters phone call mode with `--model/--tts/--asr` overrides

---

## New Commands

| Command | Description |
|---------|-------------|
| `phone send` | Make an outbound phone call |
| `phone numbers` | List imported numbers |
| `phone import` | Import a number with SIP config |
| `phone number <num>` | Number details |
| `phone update <num>` | Update number config |
| `phone remove <num>` | Delete a number |
| `phone hangup <id>` | End an active call |
| `phone status <id>` | Check call status |
| `phone history` | Recent calls |
| `go --call` | Phone call mode in go |

## Deprecations

| Old | New | Status |
|-----|-----|--------|
| `call initiate` | `phone send` | Works with warning + flag mapping |
| `call hangup` | `phone hangup` | Works with warning |
| `call status` | `phone status` | Works with warning |

## Stats

| Metric | Value |
|--------|-------|
| New files | 12 |
| Source code | ~15,000 lines |
| Tests | 519 / 519 |
| npm | [convoai@1.7.0](https://www.npmjs.com/package/convoai) |

---

*Built with Claude Code (Opus 4.6)*
