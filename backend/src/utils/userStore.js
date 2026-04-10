
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFile = path.resolve(__dirname, '../data/users.json');

function ensureFile() {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, '[]', 'utf-8');
  }
}

export function readUsers() {
  ensureFile();
  const raw = fs.readFileSync(usersFile, 'utf-8');
  return JSON.parse(raw);
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf-8');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  return readUsers().find((user) => normalizeEmail(user.email) === normalized) ?? null;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, passwordHash };
}

export function verifyPassword(user, password) {
  if (typeof user.password === 'string') {
    return user.password === password;
  }

  if (!user.salt || !user.passwordHash) {
    return false;
  }

  const attempt = crypto.scryptSync(password, user.salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    provider: user.provider ?? 'local',
    avatar: user.avatar ?? null
  };
}

export function createLocalUser({ name, email, password }) {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);

  if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
    throw new Error('Esiste già un account con questa email.');
  }

  const { salt, passwordHash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: String(name).trim(),
    role: 'viewer',
    provider: 'local',
    salt,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeUsers(users);
  return user;
}

export function upsertGoogleUser({ email, name, avatar, googleSub }) {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  const existing = users.find((user) => normalizeEmail(user.email) === normalizedEmail);

  if (existing) {
    const updated = {
      ...existing,
      name: name || existing.name,
      avatar: avatar || existing.avatar || null,
      provider: 'google',
      googleSub: googleSub || existing.googleSub || null,
      updatedAt: new Date().toISOString()
    };
    const next = users.map((user) => (user.id === existing.id ? updated : user));
    writeUsers(next);
    return updated;
  }

  const created = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0],
    role: 'viewer',
    provider: 'google',
    googleSub: googleSub || null,
    avatar: avatar || null,
    createdAt: new Date().toISOString()
  };

  users.push(created);
  writeUsers(users);
  return created;
}

export function updateLocalUser(email, updates = {}) {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const index = users.findIndex((user) => normalizeEmail(user.email) === normalizedEmail);

  if (index === -1) {
    return null;
  }

  const current = users[index];
  const next = {
    ...current,
    ...(updates.name ? { name: String(updates.name).trim() } : {}),
    updatedAt: new Date().toISOString()
  };

  if (typeof updates.password === 'string' && updates.password.length > 0) {
    const { salt, passwordHash } = hashPassword(updates.password);
    delete next.password;
    next.salt = salt;
    next.passwordHash = passwordHash;
  }

  users[index] = next;
  writeUsers(users);
  return next;
}
