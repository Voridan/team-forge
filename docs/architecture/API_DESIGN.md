# API Design: Team Collaboration Platform

## Conventions

| Convention | Choice |
|-----------|--------|
| **Naming** | camelCase for JSON fields, kebab-case for URLs where needed |
| **IDs** | UUIDs (v4) for all resources |
| **Dates** | ISO 8601 (`2026-04-05T14:30:00Z`) |
| **Pagination** | Cursor-based (default), offset available for admin/analytics |
| **Versioning** | URL prefix: `/api/v1/...` |
| **Auth** | Bearer JWT in `Authorization` header |
| **Errors** | RFC 7807 Problem Details (`application/problem+json`) |
| **Content-Type** | `application/json` for all requests and responses |

---

## Standard Response Envelope

### Success (single resource)
```json
{
  "data": { ... }
}
```

### Success (collection)
```json
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "eyJpZCI6Ijk5In0=",
    "hasMore": true
  }
}
```

### Error (RFC 7807)
```json
{
  "type": "https://api.teamcollab.io/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "The 'email' field must be a valid email address.",
  "instance": "/api/v1/auth/register",
  "errors": [
    { "field": "email", "code": "INVALID_FORMAT", "message": "Must be a valid email address" }
  ]
}
```

---

## 1. Auth Module

Base path: `/api/v1/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login with email/password | No |
| POST | `/auth/logout` | Invalidate refresh token | Yes |
| POST | `/auth/refresh` | Get new access token | No (refresh token in body) |
| POST | `/auth/forgot-password` | Send password reset email | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| POST | `/auth/oauth/{provider}` | OAuth login (google, github) | No |

### POST `/auth/register`
```json
// Request
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Response: 201 Created
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2026-04-05T14:30:00Z"
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

### POST `/auth/login`
```json
// Request
{
  "email": "user@example.com",
  "password": "securePassword123!"
}

// Response: 200 OK
{
  "data": {
    "user": { "id": "uuid", "email": "...", "firstName": "...", "lastName": "..." },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

### POST `/auth/refresh`
```json
// Request
{ "refreshToken": "eyJhbG..." }

// Response: 200 OK
{
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."  // rotated
  }
}
```

---

## 2. Users Module

Base path: `/api/v1/users`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/me` | Get current user profile | Yes |
| PATCH | `/users/me` | Update current user profile | Yes |
| DELETE | `/users/me` | Delete account | Yes |
| PATCH | `/users/me/avatar` | Upload avatar | Yes |
| PATCH | `/users/me/password` | Change password | Yes |
| GET | `/users/{id}` | Get user public profile | Yes |
| GET | `/users/search?q=` | Search users by name/email | Yes |

### GET `/users/me`
```json
// Response: 200 OK
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://...",
    "timezone": "Europe/Kyiv",
    "status": "online",
    "createdAt": "2026-04-05T14:30:00Z",
    "updatedAt": "2026-04-05T15:00:00Z"
  }
}
```

### PATCH `/users/me`
```json
// Request (partial update — only include fields to change)
{
  "firstName": "Jane",
  "timezone": "America/New_York"
}

// Response: 200 OK
{ "data": { /* updated user */ } }
```

---

## 3. Teams Module

Base path: `/api/v1/teams`

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/teams` | Create team | Yes | — |
| GET | `/teams` | List user's teams | Yes | — |
| GET | `/teams/{teamId}` | Get team details | Yes | Member+ |
| PATCH | `/teams/{teamId}` | Update team settings | Yes | Admin+ |
| DELETE | `/teams/{teamId}` | Archive/delete team | Yes | Owner |
| GET | `/teams/{teamId}/members` | List team members | Yes | Member+ |
| POST | `/teams/{teamId}/members` | Invite member(s) | Yes | Admin+ |
| PATCH | `/teams/{teamId}/members/{userId}` | Update member role | Yes | Owner |
| DELETE | `/teams/{teamId}/members/{userId}` | Remove member | Yes | Admin+ |
| POST | `/teams/{teamId}/leave` | Leave team | Yes | Member+ |

### POST `/teams`
```json
// Request
{
  "name": "Engineering",
  "description": "Core engineering team"
}

// Response: 201 Created
{
  "data": {
    "id": "uuid",
    "name": "Engineering",
    "description": "Core engineering team",
    "ownerId": "uuid",
    "memberCount": 1,
    "createdAt": "2026-04-05T14:30:00Z"
  }
}
```

### GET `/teams` (with pagination)
```
GET /api/v1/teams?cursor=eyJ...&limit=20
```
```json
// Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Engineering",
      "description": "...",
      "memberCount": 8,
      "role": "admin",
      "createdAt": "2026-04-05T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJ...",
    "hasMore": true
  }
}
```

### POST `/teams/{teamId}/members`
```json
// Request
{
  "userIds": ["uuid-1", "uuid-2"],
  "role": "member"  // "admin" | "member" | "guest"
}

// Response: 201 Created
{
  "data": {
    "added": [
      { "userId": "uuid-1", "role": "member" },
      { "userId": "uuid-2", "role": "member" }
    ]
  }
}
```

---

## 4. Tasks Module

Base path: `/api/v1/teams/{teamId}/tasks`

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/teams/{teamId}/tasks` | Create task | Yes | Member+ |
| GET | `/teams/{teamId}/tasks` | List tasks (filterable) | Yes | Member+ |
| GET | `/teams/{teamId}/tasks/{taskId}` | Get task detail | Yes | Member+ |
| PATCH | `/teams/{teamId}/tasks/{taskId}` | Update task | Yes | Member+ |
| DELETE | `/teams/{teamId}/tasks/{taskId}` | Delete task | Yes | Admin+ |
| PATCH | `/teams/{teamId}/tasks/{taskId}/status` | Change status | Yes | Member+ |
| PATCH | `/teams/{teamId}/tasks/{taskId}/assign` | Assign/unassign | Yes | Member+ |
| POST | `/teams/{teamId}/tasks/{taskId}/comments` | Add comment | Yes | Member+ |
| GET | `/teams/{teamId}/tasks/{taskId}/comments` | List comments | Yes | Member+ |
| DELETE | `/teams/{teamId}/tasks/{taskId}/comments/{commentId}` | Delete comment | Yes | Author/Admin+ |
| POST | `/teams/{teamId}/tasks/{taskId}/attachments` | Upload attachment | Yes | Member+ |
| DELETE | `/teams/{teamId}/tasks/{taskId}/attachments/{attachmentId}` | Delete attachment | Yes | Author/Admin+ |
| POST | `/teams/{teamId}/tasks/{taskId}/subtasks` | Create subtask | Yes | Member+ |
| PATCH | `/teams/{teamId}/tasks/{taskId}/subtasks/{subtaskId}` | Update subtask | Yes | Member+ |

### POST `/teams/{teamId}/tasks`
```json
// Request
{
  "title": "Implement auth module",
  "description": "Set up JWT-based authentication with NestJS",
  "priority": "high",        // "low" | "medium" | "high" | "urgent"
  "status": "todo",          // "todo" | "in_progress" | "in_review" | "done"
  "assigneeId": "uuid",      // nullable
  "dueDate": "2026-04-15",   // nullable
  "labels": ["backend", "auth"]
}

// Response: 201 Created
{
  "data": {
    "id": "uuid",
    "title": "Implement auth module",
    "description": "...",
    "priority": "high",
    "status": "todo",
    "assignee": { "id": "uuid", "firstName": "John", "lastName": "Doe", "avatarUrl": "..." },
    "reporter": { "id": "uuid", "firstName": "Jane", "lastName": "Smith", "avatarUrl": "..." },
    "teamId": "uuid",
    "dueDate": "2026-04-15",
    "labels": ["backend", "auth"],
    "commentCount": 0,
    "attachmentCount": 0,
    "subtasks": [],
    "createdAt": "2026-04-05T14:30:00Z",
    "updatedAt": "2026-04-05T14:30:00Z"
  }
}
```

### GET `/teams/{teamId}/tasks` (filtering & sorting)
```
GET /api/v1/teams/{teamId}/tasks?status=todo,in_progress&priority=high&assigneeId=uuid&sort=-dueDate&cursor=eyJ...&limit=30
```

Supported query params:
- `status` — comma-separated statuses
- `priority` — comma-separated priorities
- `assigneeId` — filter by assignee
- `labels` — comma-separated labels
- `dueBefore` / `dueAfter` — date range
- `q` — search title/description
- `sort` — field name, prefix `-` for descending (default: `-createdAt`)
- `cursor` / `limit` — pagination

---

## 5. Messaging Module

Base path: `/api/v1/teams/{teamId}/channels`

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/teams/{teamId}/channels` | Create channel | Yes | Member+ |
| GET | `/teams/{teamId}/channels` | List channels | Yes | Member+ |
| GET | `/teams/{teamId}/channels/{channelId}` | Get channel detail | Yes | Member+ |
| PATCH | `/teams/{teamId}/channels/{channelId}` | Update channel | Yes | Admin+ |
| DELETE | `/teams/{teamId}/channels/{channelId}` | Delete channel | Yes | Admin+ |
| GET | `/teams/{teamId}/channels/{channelId}/messages` | Get message history | Yes | Member+ |
| GET | `/teams/{teamId}/channels/{channelId}/messages/{messageId}` | Get single message | Yes | Member+ |
| DELETE | `/teams/{teamId}/channels/{channelId}/messages/{messageId}` | Delete message | Yes | Author/Admin+ |

Note: **Sending messages happens over WebSocket (real-time service)**, not REST. The REST endpoints here are for retrieving history and managing channels.

### GET `/teams/{teamId}/channels/{channelId}/messages`
```
GET .../messages?cursor=eyJ...&limit=50&before=2026-04-05T14:30:00Z
```
```json
// Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "content": "Hey team, the auth module is ready for review",
      "author": { "id": "uuid", "firstName": "John", "avatarUrl": "..." },
      "attachments": [],
      "reactions": [
        { "emoji": "thumbsup", "count": 2, "users": ["uuid-1", "uuid-2"] }
      ],
      "editedAt": null,
      "createdAt": "2026-04-05T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJ...",
    "hasMore": true
  }
}
```

### Direct Messages (1:1)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/me/conversations` | List DM conversations | Yes |
| GET | `/conversations/{conversationId}/messages` | Get DM history | Yes |

---

## 6. Notifications Module

Base path: `/api/v1/notifications`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | List notifications | Yes |
| PATCH | `/notifications/{id}/read` | Mark as read | Yes |
| POST | `/notifications/read-all` | Mark all as read | Yes |
| GET | `/notifications/unread-count` | Get unread count | Yes |
| PATCH | `/notifications/settings` | Update notification prefs | Yes |

### GET `/notifications`
```
GET /api/v1/notifications?cursor=eyJ...&limit=20&unreadOnly=true
```
```json
// Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "type": "task_assigned",     // "task_assigned" | "task_comment" | "team_invite" | "mention" | "deadline_reminder"
      "title": "New task assigned",
      "body": "John assigned 'Implement auth module' to you",
      "isRead": false,
      "resourceType": "task",
      "resourceId": "uuid",
      "teamId": "uuid",
      "createdAt": "2026-04-05T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJ...",
    "hasMore": true
  }
}
```

---

## 7. Calls Module (LiveKit Integration)

Base path: `/api/v1/teams/{teamId}/calls`

The API server manages call lifecycle and generates LiveKit tokens. Actual media flows through LiveKit directly — these endpoints coordinate, not relay.

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/teams/{teamId}/calls` | Start a call (creates LiveKit room) | Yes | Member+ |
| POST | `/teams/{teamId}/calls/{callId}/join` | Join an active call (get LiveKit token) | Yes | Member+ |
| POST | `/teams/{teamId}/calls/{callId}/leave` | Leave a call | Yes | Member+ |
| GET | `/teams/{teamId}/calls/active` | Get active call in team (if any) | Yes | Member+ |
| GET | `/teams/{teamId}/calls/{callId}` | Get call details (participants, duration) | Yes | Member+ |
| GET | `/teams/{teamId}/calls` | List past calls (history) | Yes | Admin+ |

### POST `/teams/{teamId}/calls`
```json
// Request
{
  "type": "audio"  // "audio" | "video"
}

// Response: 201 Created
{
  "data": {
    "callId": "uuid",
    "roomName": "team-{teamId}-{callId}",
    "livekitUrl": "wss://livekit.teamcollab.io",
    "token": "eyJ...",          // LiveKit participant token (signed, scoped to this room)
    "participants": [],
    "startedAt": "2026-04-05T14:30:00Z",
    "startedBy": { "id": "uuid", "firstName": "John", "avatarUrl": "..." }
  }
}
```

### POST `/teams/{teamId}/calls/{callId}/join`
```json
// Response: 200 OK
{
  "data": {
    "token": "eyJ...",           // LiveKit participant token for this user
    "livekitUrl": "wss://livekit.teamcollab.io",
    "participants": [
      { "id": "uuid", "firstName": "John", "avatarUrl": "...", "joinedAt": "..." }
    ]
  }
}
```

### LiveKit Webhook Endpoint (internal)

LiveKit sends room events to the API server:

```
POST /api/v1/internal/livekit/webhook
```

Events handled:
- `room_started` — log call start
- `participant_joined` / `participant_left` — update participant list, notify via real-time service
- `room_finished` — log call end, calculate duration, send event to analytics service

This endpoint validates the LiveKit webhook signature and is not exposed to clients.

---

## 8. Analytics Service (Python / FastAPI)

Base path: `/analytics/v1` (routed via Nginx to the FastAPI service)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/analytics/v1/teams/{teamId}/overview` | Team activity overview | Yes (Admin+) |
| GET | `/analytics/v1/teams/{teamId}/tasks/metrics` | Task completion metrics | Yes (Admin+) |
| GET | `/analytics/v1/teams/{teamId}/tasks/distribution` | Workload distribution | Yes (Admin+) |
| GET | `/analytics/v1/teams/{teamId}/members/{userId}/activity` | Individual activity | Yes (Admin+) |
| GET | `/analytics/v1/teams/{teamId}/trends` | Productivity trends | Yes (Admin+) |
| GET | `/analytics/v1/teams/{teamId}/recommendations` | Workflow recommendations | Yes (Admin+) |

### GET `/analytics/v1/teams/{teamId}/overview`
```
GET /analytics/v1/teams/{teamId}/overview?period=30d
```
Supported periods: `7d`, `14d`, `30d`, `90d`, custom range via `from`/`to`

```json
// Response: 200 OK
{
  "data": {
    "period": { "from": "2026-03-06", "to": "2026-04-05" },
    "summary": {
      "tasksCreated": 45,
      "tasksCompleted": 38,
      "completionRate": 0.844,
      "avgCompletionTimeHours": 18.5,
      "activeMembers": 6,
      "messagesExchanged": 342
    },
    "tasksByStatus": {
      "todo": 12,
      "inProgress": 8,
      "inReview": 3,
      "done": 38
    },
    "tasksByPriority": {
      "urgent": 2,
      "high": 15,
      "medium": 28,
      "low": 16
    }
  }
}
```

### GET `/analytics/v1/teams/{teamId}/tasks/distribution`
```json
// Response: 200 OK
{
  "data": {
    "period": { "from": "2026-03-06", "to": "2026-04-05" },
    "members": [
      {
        "userId": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "tasksAssigned": 12,
        "tasksCompleted": 10,
        "avgCompletionTimeHours": 14.2,
        "overdueTasks": 1
      }
    ]
  }
}
```

### GET `/analytics/v1/teams/{teamId}/recommendations`
```json
// Response: 200 OK
{
  "data": {
    "recommendations": [
      {
        "type": "workload_imbalance",
        "severity": "warning",
        "title": "Uneven workload distribution",
        "description": "John has 3x more tasks assigned than the team average. Consider redistributing.",
        "affectedMembers": ["uuid-john"],
        "suggestedAction": "redistribute_tasks"
      },
      {
        "type": "bottleneck",
        "severity": "info",
        "title": "Review stage bottleneck",
        "description": "Tasks spend an average of 2.5 days in review. Consider adding more reviewers.",
        "suggestedAction": "add_reviewers"
      }
    ]
  }
}
```

### Analytics Auth Model

The analytics service validates JWTs independently using the same shared secret/public key as the API server. It also accepts service-to-service calls from the API server using an internal API key for event ingestion.

---

## 9. WebSocket Events (Real-Time Service)

Connection: `wss://api.teamcollab.io/ws?token=<JWT>`

Note: The real-time service handles **chat, presence, and notifications**. Call media/signaling flows through **LiveKit directly** — the real-time service only coordinates call notifications (incoming call alerts, participant join/leave UI updates).

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{ channelId, content, attachments? }` | Send message |
| `message:edit` | `{ messageId, content }` | Edit message |
| `message:react` | `{ messageId, emoji }` | Add/remove reaction |
| `typing:start` | `{ channelId }` | User started typing |
| `typing:stop` | `{ channelId }` | User stopped typing |
| `presence:update` | `{ status }` | Update presence (online/away/dnd) |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `{ message }` | New message in a channel |
| `message:updated` | `{ message }` | Message edited |
| `message:deleted` | `{ messageId, channelId }` | Message deleted |
| `message:reaction` | `{ messageId, emoji, userId, action }` | Reaction added/removed |
| `typing:update` | `{ channelId, userId, isTyping }` | Typing indicator |
| `presence:changed` | `{ userId, status }` | User presence changed |
| `notification:new` | `{ notification }` | New notification |
| `task:updated` | `{ task }` | Task state changed |
| `call:incoming` | `{ teamId, callId, callerId, type }` | Someone started a call in your team |
| `call:participant-joined` | `{ callId, user }` | Someone joined the call (UI update) |
| `call:participant-left` | `{ callId, userId }` | Someone left the call (UI update) |
| `call:ended` | `{ callId, duration }` | Call has ended (all participants left) |

---

## 10. Rate Limiting

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Auth (login/register) | 10 req/min per IP |
| Auth (password reset) | 3 req/hour per email |
| General API | 100 req/min per user |
| File uploads | 20 req/min per user |
| WebSocket messages | 60 msg/min per user |
| Analytics | 30 req/min per user |

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1712345678
```

---

## 11. Error Catalog

| HTTP Status | Error Type | When |
|-------------|-----------|------|
| 400 | `validation-error` | Invalid request body/params |
| 401 | `authentication-error` | Missing/invalid/expired JWT |
| 403 | `authorization-error` | Insufficient role/permissions |
| 404 | `resource-not-found` | Resource doesn't exist or user has no access |
| 409 | `conflict-error` | Duplicate resource (email, team name) |
| 422 | `unprocessable-entity` | Valid syntax but business rule violation |
| 429 | `rate-limit-exceeded` | Too many requests |
| 500 | `internal-error` | Unexpected server error |
| 503 | `service-unavailable` | Service temporarily down |
