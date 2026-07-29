import { PrismaClient, Priority, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed two demo accounts and a spread of PERSONAL TASKS so the UI looks alive on
 * first run. Personal tasks are tickets with no sprint and no key — see
 * docs/architecture.md §1. Idempotent: upserts users, and only seeds tasks when
 * none exist yet.
 *
 *   admin@rival.app / Password123   (ADMIN)
 *   demo@rival.app  / Password123   (USER)
 */
async function main() {
  const passwordHash = await bcrypt.hash('Password123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@rival.app' },
    update: {},
    create: { email: 'admin@rival.app', name: 'Ada Admin', role: 'ADMIN', passwordHash },
  });

  const demo = await prisma.user.upsert({
    where: { email: 'demo@rival.app' },
    update: {},
    create: { email: 'demo@rival.app', name: 'Devon Demo', role: 'USER', passwordHash },
  });

  const existing = await prisma.ticket.count({ where: { createdById: demo.id } });
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log('Tasks already seeded — skipping.');
    return;
  }

  const day = 24 * 60 * 60 * 1000;
  const base = new Date('2026-06-11T09:00:00.000Z').getTime();

  const seed = [
    { title: 'Ship the onboarding flow', priority: Priority.URGENT, status: TaskStatus.IN_PROGRESS, due: 1, desc: 'Finish the 3-step welcome and connect analytics.' },
    { title: 'Design the weekly review ritual', priority: Priority.HIGH, status: TaskStatus.TODO, due: 3, desc: 'A calm Friday recap of what moved.' },
    { title: 'Refactor the task list virtualization', priority: Priority.MEDIUM, status: TaskStatus.TODO, due: 6, desc: null },
    { title: 'Write the launch announcement', priority: Priority.HIGH, status: TaskStatus.TODO, due: 2, desc: 'Lead with the kinetic command bar.' },
    { title: 'Pay the cloud invoice', priority: Priority.LOW, status: TaskStatus.DONE, due: -2, desc: 'Auto-renew is on, just confirm.' },
    { title: 'Interview two design candidates', priority: Priority.MEDIUM, status: TaskStatus.IN_PROGRESS, due: 4, desc: null },
    { title: 'Fix the dark-mode contrast on chips', priority: Priority.HIGH, status: TaskStatus.TODO, due: 0, desc: 'AA at minimum.' },
    { title: 'Archive last quarter’s OKRs', priority: Priority.LOW, status: TaskStatus.DONE, due: -5, desc: null },
    { title: 'Plan the offsite agenda', priority: Priority.MEDIUM, status: TaskStatus.TODO, due: 9, desc: 'Half maker time, half strategy.' },
    { title: 'Add optimistic UI to task toggles', priority: Priority.URGENT, status: TaskStatus.IN_PROGRESS, due: 1, desc: 'Roll back on failure with a toast.' },
    { title: 'Audit accessibility on the dashboard', priority: Priority.HIGH, status: TaskStatus.TODO, due: 5, desc: null },
    { title: 'Reply to the partnership email', priority: Priority.MEDIUM, status: TaskStatus.TODO, due: -1, desc: 'Overdue — handle first thing.' },
  ];

  await prisma.ticket.createMany({
    data: seed.map((t) => ({
      title: t.title,
      description: t.desc,
      priority: t.priority,
      status: t.status,
      dueDate: new Date(base + t.due * day),
      completedAt: t.status === TaskStatus.DONE ? new Date(base - day) : null,
      createdById: demo.id,
    })),
  });

  // A couple of admin-owned tasks so the admin login isn't empty.
  await prisma.ticket.createMany({
    data: [
      { title: 'Review user feedback queue', priority: Priority.HIGH, status: TaskStatus.TODO, dueDate: new Date(base + day), createdById: admin.id },
      { title: 'Approve Q3 roadmap', priority: Priority.URGENT, status: TaskStatus.IN_PROGRESS, dueDate: new Date(base + 2 * day), createdById: admin.id },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seeded users (admin@rival.app / demo@rival.app — Password123) and tasks.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
