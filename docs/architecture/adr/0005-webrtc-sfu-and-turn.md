# ADR-005: LiveKit as WebRTC SFU + coturn for TURN/STUN

## Status
Accepted

## Context
The platform requires audio/video calls and screen sharing within teams. WebRTC is the standard for browser-based real-time media, but it requires:

1. **SFU (Selective Forwarding Unit)** — a media server that receives streams from each participant and selectively forwards them to others. Without an SFU, participants connect in a mesh topology (each sends to every other), which collapses beyond 3-4 participants.

2. **TURN/STUN server** — enables connections through NATs and firewalls. STUN discovers the client's public IP; TURN relays media when direct peer-to-peer is impossible (corporate firewalls, symmetric NAT). Without TURN, ~10-15% of users cannot connect.

### Requirements
- Support 2-20 participants per call (team-sized calls)
- Audio, video, and screen sharing
- Self-hostable (no vendor lock-in)
- Must work through corporate firewalls and NAT
- Deployable via Docker
- Manageable by a small team (1-3 developers)

## Decision
Use **LiveKit** (self-hosted) as the WebRTC SFU and **coturn** as the TURN/STUN server.

### Why LiveKit?

LiveKit is an open-source, self-hostable WebRTC media server written in Go. It provides:
- Complete SFU with room management, participant tracking, quality adaptation
- Built-in signaling protocol (no need to build our own)
- Client SDKs: JavaScript, React, iOS, Android, Flutter
- Server SDKs: Node.js, Python, Go — integrates with both our API and analytics services
- Recording and egress capabilities (record calls, stream to storage)
- Simulcast and dynacast (bandwidth-adaptive quality)
- Docker image available, horizontally scalable
- Active open-source community (CNCF ecosystem)

### Why coturn?

coturn (https://github.com/coturn/coturn) is the standard open-source TURN/STUN server:
- Free and open-source (battle-tested, used by Jitsi, Nextcloud Talk, etc.)
- Supports TURN over UDP, TCP, and TLS (TURNS)
- STUN built-in alongside TURN
- Lightweight, runs as a single process
- Docker image available
- LiveKit integrates natively with external TURN servers

We deploy coturn separately rather than relying on LiveKit's built-in TURN because:
- coturn can be placed on a public-facing server with a dedicated IP
- Independent scaling — TURN traffic is relay-heavy and can be isolated
- Shared across environments (dev/staging/prod can use the same TURN server)

## Alternatives Considered

### mediasoup (SFU)
- **Considered**: Low-level SFU library for Node.js (C++ media workers). Would integrate directly into our existing real-time service.
- **Rejected**: mediasoup is a library, not a server — we'd need to build room management, participant tracking, reconnection handling, quality adaptation, recording, and signaling from scratch. For a small team, this is weeks of work that LiveKit provides out of the box.
- **Trade-off**: mediasoup offers more control and tighter integration with our Node.js stack, but the development cost is prohibitive for our team size.

### Jitsi Meet
- **Considered**: Full-featured video conferencing platform (SFU + UI + signaling).
- **Rejected**: Jitsi is an entire application, not a composable service. It comes with its own UI, XMPP-based signaling (Orosody), and a complex multi-component deployment (JVB, Orosody, Jicofo, Orosody). We need an SFU that integrates into our platform, not a standalone video app.

### Pion/ion-sfu (Go)
- **Considered**: Lightweight Go-based SFU.
- **Rejected**: Less mature than LiveKit (which is built on Pion). LiveKit adds production essentials (room management, SDKs, recording, monitoring) on top of Pion's WebRTC implementation.

### Cloud services (Twilio, Agora, Daily)
- **Considered**: Managed WebRTC services with per-minute pricing.
- **Rejected**: Vendor lock-in, per-minute costs scale linearly with usage, data leaves our infrastructure. Conflicts with our self-hosted, Docker-first approach.

### TURN alternatives (Twilio NTS, Xirsys)
- **Considered**: Managed TURN services.
- **Rejected**: Per-usage pricing, vendor dependency. coturn is free, well-documented, and battle-tested in production by major open-source projects.

## Consequences

### Positive
- LiveKit drastically reduces development time — room management, quality adaptation, and recording are built-in
- Client SDKs (JS, React) provide drop-in components for call UI
- Node.js server SDK allows the API server to create rooms and manage participants programmatically
- coturn ensures reliable connectivity through corporate firewalls at zero cost
- Both are self-hosted and Docker-deployable — full control over infrastructure
- LiveKit's architecture (Go + Pion) is highly performant for media forwarding
- Clear upgrade path: LiveKit Cloud exists as a managed option if self-hosting becomes burdensome

### Negative
- LiveKit is an additional service to deploy and operate (separate from our 3 existing services)
- LiveKit uses its own signaling protocol — call signaling is separate from our Socket.IO real-time service
- coturn requires a public IP and open UDP ports (may complicate deployment in some environments)
- LiveKit's recording/egress features require additional storage configuration

### Neutral
- Call-related WebSocket events in our real-time service become thinner — they initiate/coordinate calls, but actual media signaling goes through LiveKit's protocol
- LiveKit has its own dashboard for monitoring call quality
- coturn credentials must be provisioned and rotated (static auth or time-limited TURN credentials via LiveKit)
