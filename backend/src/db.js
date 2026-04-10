import mysql from 'mysql2/promise';

let pool;

export function isDatabaseConfigured() {
  return Boolean(
    process.env.DB_HOST &&
      process.env.DB_PORT &&
      process.env.DB_USER &&
      process.env.DB_NAME
  );
}

export function getPool() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  return pool;
}

export async function query(sql, params = []) {
  const activePool = getPool();

  if (!activePool) {
    throw new Error('Database non configurato.');
  }

  const [rows] = await activePool.execute(sql, params);
  return rows;
}

export async function canUseDatabase() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    const rows = await query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
