import { PrismaClient } from '@prisma/client';
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/postgres';
const db = new PrismaClient({datasourceUrl:url.toString()});
try {
  for (let attempt = 0; ; attempt++) {
    try { await db.$queryRaw`SELECT 1`; break; }
    catch (error) { if (attempt >= 59) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  const rows = await db.$queryRaw`SELECT 1 FROM pg_database WHERE datname = 'qchat'`;
  if (rows.length === 0) await db.$executeRawUnsafe('CREATE DATABASE qchat');
} finally { await db.$disconnect(); }
