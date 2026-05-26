import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthProvider, PrismaClient } from '../generated/prisma/client';
import { DEFAULT_ANALYTICS_THRESHOLDS } from '../src/modules/analytics-settings/analytics-thresholds.constants';
import { seedDemo } from './demo-seed';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log('Seeding database...');

  const localPasswordHash = await bcrypt.hash('Password123!', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Local',
      authProvider: 'LOCAL',
      passwordHash: localPasswordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Google',
      authProvider: AuthProvider.GOOGLE,
      externalId: 'seed-bob-google-id',
    },
  });

  // Second LOCAL user — used by the two-window E2E chat test.
  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      firstName: 'Charlie',
      lastName: 'Local',
      authProvider: 'LOCAL',
      passwordHash: localPasswordHash,
    },
  });

  console.log(`Users: ${alice.email}, ${bob.email}, ${charlie.email}`);

  const team = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Engineering',
      description: 'Seed team for development',
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: charlie.id, role: 'MEMBER' },
        ],
      },
      analyticsSettings: {
        create: { ...DEFAULT_ANALYTICS_THRESHOLDS },
      },
    },
    include: { members: true },
  });

  // Backfill analytics settings for teams that pre-date the analytics module.
  await prisma.teamAnalyticsSettings.upsert({
    where: { teamId: team.id },
    update: {},
    create: { teamId: team.id, ...DEFAULT_ANALYTICS_THRESHOLDS },
  });

  console.log(`Team: ${team.name} (${team.members.length} members)`);

  // Demo seed for the analytics module — runs only if the demo user exists.
  // Safe to leave on: if the user isn't present, it logs and returns.
  await seedDemo(prisma, localPasswordHash);

  console.log('Seeding complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
