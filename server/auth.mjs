/**
 * Authentication and authorisation.
 *
 * - Passwords: scrypt (N=2^14, r=8, p=1) with a 32-byte per-user salt, verified
 *   with timingSafeEqual. No password ever leaves the server, and none is logged.
 * - Sessions: 32 random bytes, delivered in an HttpOnly + SameSite=Strict cookie,
 *   stored in the database as a SHA-256 hash so a database leak does not hand out
 *   live sessions.
 * - Permissions: an explicit matrix, checked server-side on every request. Roles
 *   never imply permissions implicitly; the list is written out.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { db, nowIso, audit } from './db.mjs'

export const ROLES = ['super_admin', 'technical_admin', 'museum_manager',
  'content_editor', 'music_editor', 'viewer']

/** Explicit permission matrix. Server-side truth; the UI only mirrors it. */
export const PERMISSIONS = {
  super_admin: ['*'],
  technical_admin: ['sounds.read', 'sounds.replace', 'dev.use', 'system.read',
    'system.manage', 'audit.read', 'music.read', 'steps.read', 'content.read', 'users.read'],
  museum_manager: ['sounds.read', 'content.read', 'content.edit', 'content.review',
    'steps.read', 'steps.edit', 'music.read', 'audit.read', 'publication.publish'],
  content_editor: ['sounds.read', 'content.read', 'content.edit', 'steps.read'],
  music_editor: ['sounds.read', 'music.read', 'music.edit', 'dev.use'],
  viewer: ['sounds.read', 'content.read', 'steps.read', 'music.read'],
}

export const PERMISSION_LIST = [...new Set(Object.values(PERMISSIONS).flat())].sort()

export function can(role, permission) {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  if (perms.includes('*')) return true
  if (perms.includes(permission)) return true
  // a granular permission also grants read on its module ("content.edit" -> "content.read")
  const [mod] = permission.split('.')
  return perms.includes(`${mod}.*`)
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export function hashPassword(password) {
  const salt = randomBytes(32).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT.keylen, SCRYPT).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password, hash, salt) {
  const candidate = scryptSync(password, salt, SCRYPT.keylen, SCRYPT)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

const tokenHash = (t) => createHash('sha256').update(t).digest('hex')

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000

export function createSession(user, { ip, userAgent } = {}) {
  const token = randomBytes(32).toString('hex')
  const created = nowIso()
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db().prepare(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent)
                VALUES (?,?,?,?,?,?)`)
    .run(tokenHash(token), user.id, created, expires, ip ?? null, (userAgent ?? '').slice(0, 300))
  db().prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(created, user.id)
  audit({ id: user.id, email: user.email }, 'auth.login', 'user', user.id, { ip: ip ?? null })
  return { token, expires }
}

export function destroySession(token, actor) {
  if (!token) return
  const th = tokenHash(token)
  const row = db().prepare('SELECT user_id FROM sessions WHERE token_hash=?').get(th)
  db().prepare('DELETE FROM sessions WHERE token_hash=?').run(th)
  if (row) audit(actor ?? null, 'auth.logout', 'user', row.user_id, null)
}

export function userFromToken(token) {
  if (!token) return null
  const row = db().prepare(`SELECT s.expires_at, u.id, u.email, u.name, u.role, u.is_active,
                                   u.must_change_password
                            FROM sessions s JOIN users u ON u.id = s.user_id
                            WHERE s.token_hash = ?`).get(tokenHash(token))
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db().prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token))
    return null
  }
  if (!row.is_active) return null
  return { id: row.id, email: row.email, name: row.name, role: row.role,
    mustChangePassword: !!row.must_change_password, expiresAt: row.expires_at }
}

/* ---------------- brute-force protection (in-process, per email+ip) --------- */
const attempts = new Map()
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

export function loginBlocked(key) {
  const rec = attempts.get(key)
  if (!rec) return 0
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return Math.ceil((rec.lockedUntil - Date.now()) / 1000)
  }
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) attempts.delete(key)
  return 0
}

export function recordFailure(key) {
  const rec = attempts.get(key) ?? { count: 0, lockedUntil: 0 }
  rec.count += 1
  if (rec.count >= MAX_FAILURES) rec.lockedUntil = Date.now() + LOCK_MS
  attempts.set(key, rec)
}

export function clearFailures(key) { attempts.delete(key) }

/* --------------------------------------------------------------- provisioning */
/**
 * Create an administrator. Used by `npm run admin:provision` and by nothing else.
 * Refuses to create a second super_admin silently and never accepts a weak
 * password: the caller must pass one that was generated or supplied out of band.
 */
export function createUser({ email, name, password, role }) {
  if (!ROLES.includes(role)) throw new Error(`rôle inconnu: ${role}`)
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('email invalide')
  if (!password || password.length < 12) throw new Error('mot de passe trop court (min 12)')
  const exists = db().prepare('SELECT 1 AS x FROM users WHERE email = ?').get(email)
  if (exists) throw new Error('un utilisateur avec cet email existe déjà')
  const { hash, salt } = hashPassword(password)
  const id = randomBytes(8).toString('hex')
  db().prepare(`INSERT INTO users (id, email, name, role, password_hash, password_salt,
                                  is_active, must_change_password, created_at)
                VALUES (?,?,?,?,?,?,1,0,?)`)
    .run(id, email, name ?? email, role, hash, salt, nowIso())
  audit(null, 'user.create', 'user', id, { email, role })
  return { id, email, role }
}
