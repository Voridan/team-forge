# ADR-005: LiveKit as All-in-One WebRTC Server (SFU + Built-in TURN/STUN)

## Status
Accepted (revised — coturn removed, using LiveKit's built-in TURN)

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
Use **LiveKit** (self-hosted) as the all-in-one WebRTC server. LiveKit provides the SFU, signaling, and a **built-in TURN/STUN server**, eliminating the need for a separate TURN deployment.

### Why LiveKit?

LiveKit is an open-source, self-hostable WebRTC media server written in Go. It provides:
- Complete SFU with room management, participant tracking, quality adaptation
- **Built-in TURN/STUN server** — NAT traversal out of the box, no separate deployment needed
- Built-in signaling protocol (no need to build our own)
- Client SDKs: JavaScript, React, iOS, Android, Flutter
- Server SDKs: Node.js, Python, Go — integrates with both our API and analytics services
- Recording and egress capabilities (record calls, stream to storage)
- Simulcast and dynacast (bandwidth-adaptive quality)
- Docker image available, horizontally scalable
- Active open-source community (CNCF ecosystem)

### Why not a separate coturn?

We initially considered deploying coturn separately alongside LiveKit. However:
- LiveKit's built-in TURN is sufficient for our scale (2-20 participants per call, team-sized usage)
- A separate coturn adds deployment complexity (extra container, port ranges, credential provisioning)
- Independent TURN scaling is only needed at very large scale (thousands of concurrent calls)
- For a 1-3 person team, fewer moving parts means less operational burden

If LiveKit's built-in TURN becomes a bottleneck at scale, we can add a dedicated external TURN server (e.g., coturn) later — this is a deployment change, not an architecture change.

## Alternatives Considered

### mediasoup (SFU)
- **Considered**: Low-level SFU library for Node.js (C++ media workers). Would integrate directly into our existing real-time service.
- **Rejected**: mediasoup is a library, not a server — we'd need to build room management, participant tracking, reconnection handling, quality adaptation, recording, and signaling from scratch. For a small team, this is weeks of work that LiveKit provides out of the box.
- **Trade-off**: mediasoup offers more control and tighter integration with our Node.js stack, but the development cost is prohibitive for our team size.

### Jitsi Meet
- **Considered**: Full-featured video conferencing platform (SFU + UI + signaling).
- **Rejected**: Jitsi is an entire application, not a composable service. It comes with its own UI, XMPP-based signaling, and a complex multi-component deployment (JVB, Orosody, Jicofo). We need an SFU that integrates into our platform, not a standalone video app.

### Pion/ion-sfu (Go)
- **Considered**: Lightweight Go-based SFU.
- **Rejected**: Less mature than LiveKit (which is built on Pion). LiveKit adds production essentials (room management, SDKs, recording, monitoring) on top of Pion's WebRTC implementation.

### Cloud services (Twilio, Agora, Daily)
- **Considered**: Managed WebRTC services with per-minute pricing.
- **Rejected**: Vendor lock-in, per-minute costs scale linearly with usage, data leaves our infrastructure. Conflicts with our self-hosted, Docker-first approach.

### Building a custom SFU
- **Considered**: Building our own SFU using Pion (Go) or webrtc-rs (Rust).
- **Rejected**: A production SFU requires implementing RTP routing, simulcast layer selection, bandwidth estimation, DTLS-SRTP, room state management, reconnection handling, and recording — months of work for experienced WebRTC engineers. LiveKit already does all of this on top of Pion.

## Consequences

### Positive
- **Single service for all WebRTC needs** — SFU + TURN/STUN in one container, minimal operational overhead
- LiveKit drastically reduces development time — room management, quality adaptation, and recording are built-in
- Client SDKs (JS, React) provide drop-in components for call UI
- Node.js server SDK allows the API server to create rooms and manage participants programmatically
- Built-in TURN ensures reliable connectivity through corporate firewalls at zero additional cost or complexity
- Self-hosted and Docker-deployable — full control over infrastructure
- LiveKit's architecture (Go + Pion) is highly performant for media forwarding
- Clear upgrade path: LiveKit Cloud exists as a managed option if self-hosting becomes burdensome

### Negative
- LiveKit is an additional service to deploy and operate (separate from our 3 existing services)
- LiveKit uses its own signaling protocol — call signaling is separate from our Socket.IO real-time service
- LiveKit's recording/egress features require additional storage configuration

### Neutral
- Call-related WebSocket events in our real-time service become thinner — they initiate/coordinate calls, but actual media signaling goes through LiveKit's protocol
- LiveKit has its own dashboard for monitoring call quality
- If TURN scaling becomes an issue at very high scale, we can add external coturn instances without changing the architecture
