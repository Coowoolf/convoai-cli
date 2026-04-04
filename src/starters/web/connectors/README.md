# ConvoAI Connectors

This directory is reserved for future communication connectors.

## Architecture

ConvoAI uses a three-layer architecture:

```
[Connector]  -->  [Customer Server]  -->  [ConvoAI Engine]
```

New communication capabilities extend through the Connector layer.
The Customer Server and ConvoAI Engine remain the same.

**Web is the first connector** — implemented in `frontend/`.

## Planned Connectors

### Telephony / SIP (Phase 2)
Inbound/outbound phone calls via SIP. Connector handles call signaling; server handles business logic.

### Text / IM (Phase 3)
Chat platforms (Slack, WhatsApp, web chat widgets). Connector handles message transport.

### Device / Edge (Phase 3)
IoT devices, smart speakers, embedded systems. Connector handles device communication.

## Design Principle

Each connector only handles communication transport.
Business logic stays in the Customer Server.
AI capabilities stay in ConvoAI Engine.

Adding a new connector never requires rewriting your server or AI config.
