// Usage inside the backend container: node infra/grant-admin.mjs <qchatId>
// Run only after the account owner has authorized this role change.
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const qchatId = process.argv[2]?.trim().toLowerCase();
  if (!qchatId) throw new Error('A QChat ID is required');
  const user = await db.user.findUnique({ where: { qchatId } });
  if (!user || user.disabled) throw new Error('Account missing or disabled');
  if (user.role !== 'ADMIN') {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } }),
      db.auditLog.create({ data: { actorId: user.id, targetId: user.id, action: 'ADMIN_ROLE_GRANTED_BY_OPERATOR' } }),
    ]);
  }
  console.log(`Admin access verified for ${qchatId}`);
} finally { await db.$disconnect(); }
