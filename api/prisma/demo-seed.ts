/**
 * Demo seed for the analytics module.
 *
 * Builds a self-contained team owned by bogdanvorobienko@gmail.com with:
 *   - 7 synthetic teammates
 *   - 5 channels (4 public, 1 leads-only)
 *   - ~120 tasks across the last 14 weeks
 *   - Full TaskStatusHistory for every task (engineered to make all four
 *     recommendation rules fire — workload imbalance, IN_REVIEW bottleneck,
 *     throughput drop, overdue accumulation)
 *   - ~500 chat messages distributed across channels
 *   - ~20 calls with realistic participant lists
 *
 * Idempotent: deletes the demo team (cascade) before recreating. Re-running
 * produces the same shape thanks to a seeded PRNG. Skipped silently if the
 * target user doesn't exist.
 */
import { randomUUID } from 'crypto';
import {
  CallStatus,
  ChannelType,
  PrismaClient,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from '../generated/prisma/client';
import { DEFAULT_ANALYTICS_THRESHOLDS } from '../src/modules/analytics-settings/analytics-thresholds.constants';

const DEMO_USER_EMAIL = 'bogdanvorobienko@gmail.com';
const DEMO_TEAM_ID = '00000000-0000-0000-0000-0000000d0000';
const TIMELINE_WEEKS = 14;
const TARGET_TASK_COUNT = 120;
const TARGET_MESSAGE_COUNT = 500;
const TARGET_CALL_COUNT = 20;

// ---------- date helpers ----------

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function subDays(d: Date, n: number): Date {
  return new Date(d.getTime() - n * DAY_MS);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function addHours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * HOUR_MS);
}
function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

// ---------- seeded PRNG (mulberry32) ----------

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(0xdeadbeef);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return rng() * (max - min) + min;
}
function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function pickWeighted<T>(items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}
function chance(p: number): boolean {
  return rng() < p;
}

// ---------- static demo data ----------

interface TeammateSpec {
  email: string;
  firstName: string;
  lastName: string;
  role: TeamRole;
}

const DEMO_TEAMMATES: readonly TeammateSpec[] = [
  { email: 'alice.chen.demo@teamforge.local', firstName: 'Alice', lastName: 'Chen', role: TeamRole.ADMIN },
  { email: 'bob.martinez.demo@teamforge.local', firstName: 'Bob', lastName: 'Martinez', role: TeamRole.ADMIN },
  { email: 'carla.singh.demo@teamforge.local', firstName: 'Carla', lastName: 'Singh', role: TeamRole.MEMBER },
  { email: 'david.okafor.demo@teamforge.local', firstName: 'David', lastName: 'Okafor', role: TeamRole.MEMBER },
  { email: 'emma.lindqvist.demo@teamforge.local', firstName: 'Emma', lastName: 'Lindqvist', role: TeamRole.MEMBER },
  { email: 'farah.idris.demo@teamforge.local', firstName: 'Farah', lastName: 'Idris', role: TeamRole.MEMBER },
  { email: 'gabriel.santos.demo@teamforge.local', firstName: 'Gabriel', lastName: 'Santos', role: TeamRole.MEMBER },
];

interface ChannelSpec {
  name: string;
  description: string;
  type: ChannelType;
}

const DEMO_CHANNELS: readonly ChannelSpec[] = [
  { name: 'general', description: 'Team-wide announcements and chitchat', type: ChannelType.PUBLIC },
  { name: 'engineering', description: 'Engineering discussions, PR reviews, deploy talk', type: ChannelType.PUBLIC },
  { name: 'design', description: 'Design reviews, Figma links, feedback', type: ChannelType.PUBLIC },
  { name: 'random', description: 'Off-topic, memes, coffee', type: ChannelType.PUBLIC },
  { name: 'leads-only', description: 'Leadership sync (OWNER + ADMIN only)', type: ChannelType.PRIVATE },
];

const TASK_TITLE_TEMPLATES: readonly string[] = [
  'Implement {feature} endpoint',
  'Add {feature} component to dashboard',
  'Refactor {area} module for clarity',
  'Fix bug in {feature} flow',
  'Write integration tests for {feature}',
  'Update {feature} documentation',
  'Migrate {area} to new schema',
  'Profile {feature} performance',
  'Design mockup for {feature}',
  'Code review: {feature}',
  'Investigate {feature} regression',
  'Wire up {feature} to API',
  'Add error handling around {feature}',
  'Set up monitoring for {area}',
  'Schema migration for {area}',
];

const TASK_FEATURES: readonly string[] = [
  'authentication', 'notifications', 'team invitations', 'task board', 'real-time chat',
  'video calls', 'file uploads', 'analytics dashboard', 'search', 'user profiles',
  'OAuth integration', 'password reset', 'role permissions', 'audit log', 'CSV export',
  'mobile responsive layout', 'dark mode', 'keyboard shortcuts', 'i18n', 'rate limiting',
  'webhook delivery', 'image thumbnails', 'channel archiving', 'task ordering', 'presence indicators',
];

const TASK_AREAS: readonly string[] = [
  'auth', 'storage', 'realtime', 'messaging', 'tasks', 'teams', 'analytics', 'webhooks', 'invites',
];

function genTaskTitle(): string {
  return pickOne(TASK_TITLE_TEMPLATES)
    .replace('{feature}', pickOne(TASK_FEATURES))
    .replace('{area}', pickOne(TASK_AREAS));
}

function genTaskDescription(title: string): string | null {
  if (chance(0.3)) return null;
  const tails = [
    'Owner is responsible for landing this before the next release.',
    'Block scope; should be a one-PR change.',
    'Coordinate with design before starting.',
    'Needs a follow-up doc once merged.',
    'See related thread in #engineering.',
    'Loop in QA on the test plan.',
    'Will require a migration; coordinate with infra.',
  ];
  return `${title}.\n\n${pickOne(tails)}`;
}

const MESSAGE_TEMPLATES: readonly string[] = [
  'Hey team, just pushed the PR for {topic}. Could someone take a look?',
  'I noticed {topic} is acting up in staging. Anyone seeing the same?',
  'Standup in 5 minutes 🎯',
  'Lunch break! Will be back in 30.',
  "Heads up — we're deploying {topic} this afternoon.",
  'Quick question about {topic}: is the new endpoint paginated?',
  'Thanks for the review!',
  'Merged. Moving to the next ticket.',
  'Did anyone update the {topic} docs yet?',
  'Got it working 🎉',
  'Debugging {topic} for an hour now, will pair after lunch',
  'Pair programming on {topic} anyone? Need a second pair of eyes.',
  'Coffee?',
  'Reverted the last change — broke prod. Investigating.',
  'Tagging release v0.3.{patch} now.',
  'Anyone available for a code review on {topic}?',
  '🚀',
  'Holiday tomorrow — out of office.',
  'New design draft for {topic} in Figma',
  'PSA: please add tests for {topic} before merging.',
  'Did the analytics team see the recommendation engine spec?',
  'Should we add a dark theme to {topic} too?',
  'Quick win — patched the {topic} flake.',
  'Heads up, the staging env is down. Looking into it.',
  '@here can someone approve my PR? Blocking release.',
  'Posted RFC for {topic}, would love feedback by Friday.',
  'Demo on {topic} in 10, jump in if you have time.',
];

const MESSAGE_TOPICS: readonly string[] = [
  'auth flow', 'the new dashboard', 'message editing', 'invitation tokens', 'the LiveKit hookup',
  'attachment uploads', 'rate limiting', 'the team detail page', 'task board DnD', 'analytics queries',
  'the bottleneck detection', 'CFD chart', 'the workload widget', 'presence broadcasting',
];

function genMessageContent(): string {
  return pickOne(MESSAGE_TEMPLATES)
    .replace('{topic}', pickOne(MESSAGE_TOPICS))
    .replace('{patch}', String(randInt(0, 12)));
}

// ---------- entity scaffolding ----------

interface DemoMember {
  userId: string;
  role: TeamRole;
  weight: number; // workload weight; the OWNER gets 3x to create imbalance
}

async function ensureTeammates(prisma: PrismaClient, passwordHash: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const spec of DEMO_TEAMMATES) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { firstName: spec.firstName, lastName: spec.lastName },
      create: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        authProvider: 'LOCAL',
        passwordHash,
      },
    });
    map.set(spec.email, user.id);
  }
  return map;
}

// ---------- task lifecycle generation ----------

interface GeneratedTask {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description: string | null;
  assigneeUserId: string;
  reporterUserId: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  position: number;
  // Status transitions, oldest first. Every task has at least one (null → TODO at creation).
  history: Array<{
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus;
    changedByUserId: string;
    changedAt: Date;
  }>;
}

const PRIORITY_WEIGHTS = [
  { value: TaskPriority.LOW, weight: 2 },
  { value: TaskPriority.MEDIUM, weight: 5 },
  { value: TaskPriority.HIGH, weight: 2 },
  { value: TaskPriority.URGENT, weight: 1 },
];

/**
 * How many tasks complete each week, indexed from oldest (week 13) to newest (week 0).
 * The last 4 weeks decline (12 → 8 → 6 → 4) to trip the throughput-drop recommendation.
 */
const WEEKLY_COMPLETION_TARGET: readonly number[] = [
  12, 11, 13, 12, 14, 12, 13, 11, 12, 13, // weeks 13..4 ago: stable ~12
  10, 8, 6, 4,                              // weeks 3..0 ago: declining
];

function pickAssignee(members: readonly DemoMember[]): DemoMember {
  return pickWeighted(members.map((m) => ({ value: m, weight: m.weight })));
}

/**
 * Generate the full task list with status histories engineered for each
 * recommendation rule. Returns tasks sorted by createdAt ascending.
 */
function generateTasks(now: Date, members: readonly DemoMember[]): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  // Distribute task CREATIONS roughly evenly with a small recent dip
  // (recent throughput drop happens because tasks DON'T complete, not because fewer are created).
  const weeklyCreations: number[] = [];
  for (let w = 0; w < TIMELINE_WEEKS; w++) {
    weeklyCreations.push(randInt(7, 11));
  }
  // Normalize roughly to TARGET_TASK_COUNT
  const sum = weeklyCreations.reduce((a, b) => a + b, 0);
  const scale = TARGET_TASK_COUNT / sum;
  for (let i = 0; i < weeklyCreations.length; i++) {
    weeklyCreations[i] = Math.max(5, Math.round(weeklyCreations[i] * scale));
  }

  // Track per-week completion budget so the throughput target is hit.
  const completionBudget = [...WEEKLY_COMPLETION_TARGET]; // index 0 = newest week

  // Create tasks oldest-first so we can deterministically decide their final status.
  for (let w = TIMELINE_WEEKS - 1; w >= 0; w--) {
    const weekStart = subDays(now, (w + 1) * 7);
    const tasksThisWeek = weeklyCreations[TIMELINE_WEEKS - 1 - w];

    for (let i = 0; i < tasksThisWeek; i++) {
      const createdAt = addHours(weekStart, randInt(0, 7 * 24 - 1));
      const assignee = pickAssignee(members);
      const reporter = pickOne(members);

      const title = genTaskTitle();
      const description = genTaskDescription(title);
      const priority = pickWeighted(PRIORITY_WEIGHTS);

      const task: GeneratedTask = {
        id: randomUUID(),
        status: TaskStatus.TODO,
        priority,
        title,
        description,
        assigneeUserId: assignee.userId,
        reporterUserId: reporter.userId,
        dueDate: null,
        createdAt,
        updatedAt: createdAt,
        position: 0, // filled in later
        history: [
          {
            fromStatus: null,
            toStatus: TaskStatus.TODO,
            changedByUserId: reporter.userId,
            changedAt: createdAt,
          },
        ],
      };
      tasks.push(task);
    }
  }

  // Decide each task's final status + transitions.
  // Strategy:
  //   - For each task, compute its "lifecycle slot": which week was it completed in?
  //   - Tasks older than ~3 weeks: 95% DONE
  //   - Recent tasks: depend on completion budget
  //   - A handful of tasks stay in IN_REVIEW > 4 days (recent) — bottleneck signal
  //   - A handful stay TODO or IN_PROGRESS — backlog
  //   - 5–7 have past dueDate + non-DONE — overdue
  for (const task of tasks) {
    const ageDays = Math.max(0, (now.getTime() - task.createdAt.getTime()) / DAY_MS);
    const ageWeeks = Math.floor(ageDays / 7);

    // Default: most older tasks complete; recent ones distribute across statuses.
    let finalStatus: TaskStatus;
    if (ageWeeks >= 4) {
      // Old task — almost always DONE
      finalStatus = chance(0.95) ? TaskStatus.DONE : pickWeighted([
        { value: TaskStatus.IN_REVIEW, weight: 1 },
        { value: TaskStatus.IN_PROGRESS, weight: 2 },
        { value: TaskStatus.TODO, weight: 1 },
      ]);
    } else if (ageWeeks >= 2) {
      // Mid-age — mostly done but more IN_REVIEW
      finalStatus = pickWeighted([
        { value: TaskStatus.DONE, weight: 6 },
        { value: TaskStatus.IN_REVIEW, weight: 2 },
        { value: TaskStatus.IN_PROGRESS, weight: 1 },
        { value: TaskStatus.TODO, weight: 1 },
      ]);
    } else {
      // Recent — broader spread
      finalStatus = pickWeighted([
        { value: TaskStatus.DONE, weight: 2 },
        { value: TaskStatus.IN_REVIEW, weight: 3 },
        { value: TaskStatus.IN_PROGRESS, weight: 3 },
        { value: TaskStatus.TODO, weight: 2 },
      ]);
    }

    // Walk the lifecycle and emit history transitions.
    // TODO → IN_PROGRESS: 0.5–3 days after creation
    // IN_PROGRESS → IN_REVIEW: 1–5 days after that
    // IN_REVIEW → DONE: usually < 2 days, but for recent IN_REVIEW we'll keep it open
    let cursor = task.createdAt;
    const mover = task.assigneeUserId;

    if (finalStatus === TaskStatus.TODO) {
      // No transitions beyond the initial null→TODO
      task.status = TaskStatus.TODO;
      task.updatedAt = task.createdAt;
    } else {
      // TODO → IN_PROGRESS
      cursor = addHours(cursor, randInt(8, 72));
      task.history.push({
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.IN_PROGRESS,
        changedByUserId: mover,
        changedAt: cursor,
      });

      if (finalStatus === TaskStatus.IN_PROGRESS) {
        task.status = TaskStatus.IN_PROGRESS;
        task.updatedAt = cursor;
      } else {
        // IN_PROGRESS → IN_REVIEW
        cursor = addHours(cursor, randInt(12, 5 * 24));
        task.history.push({
          fromStatus: TaskStatus.IN_PROGRESS,
          toStatus: TaskStatus.IN_REVIEW,
          changedByUserId: mover,
          changedAt: cursor,
        });

        if (finalStatus === TaskStatus.IN_REVIEW) {
          // BOTTLENECK SIGNAL: for tasks currently IN_REVIEW within the last
          // 2 weeks, force a long dwell time (> 4 days) so IN_REVIEW p75
          // exceeds the threshold.
          if (ageWeeks < 2) {
            const stuckDays = randInt(5, 10);
            cursor = subDays(now, randInt(0, stuckDays));
            // overwrite the IN_REVIEW transition time so dwell is exactly stuckDays
            task.history[task.history.length - 1].changedAt = subDays(now, stuckDays);
          }
          task.status = TaskStatus.IN_REVIEW;
          task.updatedAt = task.history[task.history.length - 1].changedAt;
        } else {
          // IN_REVIEW → DONE
          // For older tasks: review took 0.5–2 days. For mid-age: 1–4 days.
          const reviewHours = ageWeeks >= 4 ? randInt(8, 48) : randInt(24, 96);
          cursor = addHours(cursor, reviewHours);
          // Clamp completion to "before now"
          if (cursor.getTime() > now.getTime()) {
            cursor = subHours(now, randInt(1, 48));
          }
          task.history.push({
            fromStatus: TaskStatus.IN_REVIEW,
            toStatus: TaskStatus.DONE,
            changedByUserId: mover,
            changedAt: cursor,
          });
          task.status = TaskStatus.DONE;
          task.updatedAt = cursor;
        }
      }
    }

    // Maybe give the task a due date (50% chance).
    if (chance(0.5)) {
      // Most due dates are in the future (relative to creation, with realistic spans).
      const offsetDays = randInt(-3, 21); // negative offsets create overdue tasks
      const due = addDays(task.createdAt, offsetDays);
      task.dueDate = due;
    }
  }

  // Force a handful of intentionally overdue tasks (status != DONE + dueDate in the past).
  const nonDone = tasks.filter((t) => t.status !== TaskStatus.DONE);
  let overdueCreated = 0;
  for (const t of nonDone) {
    if (overdueCreated >= 6) break;
    // Move due date to 2–10 days in the past.
    t.dueDate = subDays(now, randInt(2, 10));
    overdueCreated++;
  }

  // Assign positions per (teamId, status) lane. Just enumerate in creation order.
  const positionCounters: Record<TaskStatus, number> = {
    [TaskStatus.TODO]: 0,
    [TaskStatus.IN_PROGRESS]: 0,
    [TaskStatus.IN_REVIEW]: 0,
    [TaskStatus.DONE]: 0,
  };
  for (const t of tasks) {
    t.position = positionCounters[t.status]++;
  }

  return tasks;
}

function subHours(d: Date, n: number): Date {
  return new Date(d.getTime() - n * HOUR_MS);
}

// ---------- messages ----------

interface GeneratedMessage {
  id: string;
  channelId: string;
  authorUserId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
}

function generateMessages(
  now: Date,
  members: readonly DemoMember[],
  channelIds: readonly string[],
): GeneratedMessage[] {
  const messages: GeneratedMessage[] = [];
  const startDate = subDays(now, TIMELINE_WEEKS * 7);
  const totalSpanMs = now.getTime() - startDate.getTime();

  for (let i = 0; i < TARGET_MESSAGE_COUNT; i++) {
    // Weighted toward later weeks (more recent activity)
    const t = Math.pow(rng(), 0.7); // skew toward 1
    let createdAt = new Date(startDate.getTime() + t * totalSpanMs);

    // Weekday preference: if Sat/Sun, push to Mon ~70% of the time
    const day = createdAt.getDay();
    if ((day === 0 || day === 6) && chance(0.7)) {
      createdAt = addDays(createdAt, day === 0 ? 1 : 2);
    }

    messages.push({
      id: randomUUID(),
      channelId: pickOne(channelIds),
      authorUserId: pickOne(members).userId,
      content: genMessageContent(),
      createdAt,
      editedAt: chance(0.05) ? addMinutes(createdAt, randInt(1, 30)) : null,
    });
  }

  // Sort oldest first so DB ordering is sensible
  messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return messages;
}

// ---------- calls ----------

interface GeneratedCall {
  id: string;
  status: CallStatus;
  roomName: string;
  startedByUserId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  participants: Array<{ userId: string; joinedAt: Date; leftAt: Date | null }>;
}

function generateCalls(now: Date, members: readonly DemoMember[]): GeneratedCall[] {
  const calls: GeneratedCall[] = [];
  const startDate = subDays(now, TIMELINE_WEEKS * 7);
  const totalSpanMs = now.getTime() - startDate.getTime();

  for (let i = 0; i < TARGET_CALL_COUNT; i++) {
    const callId = randomUUID();
    const starter = pickOne(members);
    const t = rng();
    const startedAt = new Date(startDate.getTime() + t * totalSpanMs);
    const durationMin = randInt(10, 90);
    const endedAt = addMinutes(startedAt, durationMin);

    // 2–5 participants including starter
    const participantCount = randInt(2, 5);
    const pool = [...members].sort(() => rng() - 0.5).slice(0, participantCount);
    if (!pool.find((m) => m.userId === starter.userId)) pool[0] = starter;

    const participants = pool.map((m) => {
      const joinOffsetMin = m.userId === starter.userId ? 0 : randInt(0, 10);
      const leaveOffsetMin = randInt(durationMin - 5, durationMin + 2);
      return {
        userId: m.userId,
        joinedAt: addMinutes(startedAt, joinOffsetMin),
        leftAt: addMinutes(startedAt, Math.max(joinOffsetMin + 5, leaveOffsetMin)),
      };
    });

    calls.push({
      id: callId,
      status: CallStatus.ENDED,
      roomName: `team-${DEMO_TEAM_ID}-${callId}`,
      startedByUserId: starter.userId,
      startedAt,
      endedAt,
      durationSec: durationMin * 60,
      participants,
    });
  }

  calls.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return calls;
}

// ---------- main entry ----------

export async function seedDemo(prisma: PrismaClient, passwordHash: string): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
  if (!owner) {
    console.log(`[demo-seed] ${DEMO_USER_EMAIL} not found in users table — skipping demo seed.`);
    return;
  }

  console.log(`[demo-seed] Wiping any existing demo team (${DEMO_TEAM_ID})…`);
  // Several child tables reference TeamMember with onDelete: NoAction (see the
  // team-scoped FKs in schema.prisma). Cascading the Team delete would try to
  // remove TeamMembers while Messages/Tasks/etc. still point at them, raising
  // a P2003. Delete those rows first so the team-level cascade has nothing left
  // to bump into. (Mirrors TeamsService.detachAndDelete in the api.)
  await prisma.$transaction([
    prisma.taskStatusHistory.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.taskComment.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.attachment.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.message.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.callParticipant.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.task.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.call.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.teamInvitation.deleteMany({ where: { teamId: DEMO_TEAM_ID } }),
    prisma.team.deleteMany({ where: { id: DEMO_TEAM_ID } }),
  ]);

  console.log('[demo-seed] Ensuring 7 synthetic teammates exist…');
  const teammateIds = await ensureTeammates(prisma, passwordHash);

  // Build the member list. Owner has weight 3 (creates workload imbalance);
  // everyone else has weight 1.
  const members: DemoMember[] = [
    { userId: owner.id, role: TeamRole.OWNER, weight: 3 },
    ...DEMO_TEAMMATES.map((spec) => ({
      userId: teammateIds.get(spec.email)!,
      role: spec.role,
      weight: 1,
    })),
  ];

  console.log('[demo-seed] Creating team + members + analytics settings…');
  await prisma.team.create({
    data: {
      id: DEMO_TEAM_ID,
      name: 'TeamForge Analytics Demo',
      description: 'Demo team built for showcasing the analytics module.',
      members: {
        create: members.map((m) => ({ userId: m.userId, role: m.role })),
      },
      analyticsSettings: {
        create: { ...DEFAULT_ANALYTICS_THRESHOLDS },
      },
    },
  });

  console.log(`[demo-seed] Creating ${DEMO_CHANNELS.length} channels…`);
  const channelIds: string[] = [];
  for (const spec of DEMO_CHANNELS) {
    const c = await prisma.channel.create({
      data: {
        teamId: DEMO_TEAM_ID,
        name: spec.name,
        description: spec.description,
        type: spec.type,
      },
    });
    channelIds.push(c.id);
  }

  const now = new Date();

  // ----- tasks -----
  console.log(`[demo-seed] Generating ~${TARGET_TASK_COUNT} tasks with full status history…`);
  const tasks = generateTasks(now, members);

  await prisma.task.createMany({
    data: tasks.map((t) => ({
      id: t.id,
      teamId: DEMO_TEAM_ID,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assigneeUserId: t.assigneeUserId,
      reporterUserId: t.reporterUserId,
      dueDate: t.dueDate,
      labels: [],
      position: t.position,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });

  const historyRows = tasks.flatMap((t) =>
    t.history.map((h) => ({
      taskId: t.id,
      teamId: DEMO_TEAM_ID,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedByUserId: h.changedByUserId,
      changedAt: h.changedAt,
    })),
  );
  await prisma.taskStatusHistory.createMany({ data: historyRows });
  console.log(`[demo-seed]   ${tasks.length} tasks, ${historyRows.length} status transitions`);

  // ----- messages -----
  console.log(`[demo-seed] Generating ~${TARGET_MESSAGE_COUNT} messages…`);
  const messages = generateMessages(now, members, channelIds);
  await prisma.message.createMany({
    data: messages.map((m) => ({
      id: m.id,
      teamId: DEMO_TEAM_ID,
      channelId: m.channelId,
      authorUserId: m.authorUserId,
      content: m.content,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
    })),
  });

  // ----- calls -----
  console.log(`[demo-seed] Generating ${TARGET_CALL_COUNT} calls…`);
  const calls = generateCalls(now, members);
  await prisma.call.createMany({
    data: calls.map((c) => ({
      id: c.id,
      teamId: DEMO_TEAM_ID,
      status: c.status,
      roomName: c.roomName,
      startedByUserId: c.startedByUserId,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      durationSec: c.durationSec,
    })),
  });
  const participantRows = calls.flatMap((c) =>
    c.participants.map((p) => ({
      callId: c.id,
      teamId: DEMO_TEAM_ID,
      userId: p.userId,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
    })),
  );
  await prisma.callParticipant.createMany({ data: participantRows });
  console.log(`[demo-seed]   ${calls.length} calls, ${participantRows.length} participant entries`);

  // ----- summary -----
  const stats = {
    members: members.length,
    channels: channelIds.length,
    tasks: tasks.length,
    statusTransitions: historyRows.length,
    messages: messages.length,
    calls: calls.length,
    statusBreakdown: tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {}),
    overdue: tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== TaskStatus.DONE).length,
    inReviewBacklog: tasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length,
  };
  console.log('[demo-seed] DONE. Summary:', stats);
}
