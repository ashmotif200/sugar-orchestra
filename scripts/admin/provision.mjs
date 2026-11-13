#!/usr/bin/env node
/**
 * Provision an administrator account. This is the only way an account is created
 * before the UI exists, and it is the reason there is no default login.
 *
 *   npm run admin:provision -- --email you@example.org --name "Your Name"
 *   npm run admin:provision -- --email you@example.org --password-stdin
 *
 * The generated password is never printed to the terminal or written to a log.
 * It is written once to data/admin/first-admin.txt with mode 0600, and the
 * command prints only the file path. Move it to a password manager and delete it.
 */
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { db, DATA_DIR, seedFromBundle } from '../../server/db.mjs'
import { createUser } from '../../server/auth.mjs'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{16,}$/

function generatePassword() {
  // 24 chars from a 62-symbol alphabet, then guarantee the character classes
  // the strength check asks for. Never derived from the email or the hostname.
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%*-_=+'
  let out = ''
  while (!STRONG.test(out)) {
    out = Array.from(randomBytes(24)).map((b) => alphabet[b % alphabet.length]).join('')
  }
  return out
}

async function readStdinPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false })
  const lines = []
  for await (const line of rl) lines.push(line)
  return (lines[0] ?? '').trim()
}

async function main() {
  db()
  seedFromBundle()

  const email = arg('email')
  if (!email) {
    console.error('usage: npm run admin:provision -- --email <email> [--name "<nom>"] [--role super_admin] [--password-stdin]')
    process.exit(2)
  }
  const name = arg('name', email.split('@')[0])
  const role = arg('role', 'super_admin')
  const force = process.argv.includes('--force')

  const admins = db().prepare("SELECT COUNT(*) n FROM users WHERE role='super_admin'").get().n
  if (admins > 0 && !force) {
    console.error('un super_admin existe déjà. Utilisez --force pour en ajouter un autre, '
      + 'ou créez les autres comptes depuis /admin/users une fois connecté.')
    process.exit(1)
  }

  let password
  let generated = false
  if (process.argv.includes('--password-stdin')) {
    password = await readStdinPassword()
    if (!STRONG.test(password)) {
      console.error('mot de passe refusé : 16 caractères minimum, avec majuscule, minuscule, chiffre et symbole.')
      process.exit(1)
    }
  } else {
    password = generatePassword()
    generated = true
  }

  const created = createUser({ email, name, password, role })

  if (generated) {
    mkdirSync(DATA_DIR, { recursive: true })
    const credPath = join(DATA_DIR, 'first-admin.txt')
    if (existsSync(credPath)) {
      console.error(`un fichier de credentials existe déjà (${credPath}) — déplacez-le avant de continuer.`)
      process.exit(1)
    }
    writeFileSync(credPath,
      `Sugar Orchestra — Super Admin\n`
      + `email: ${created.email}\nrôle: ${created.role}\n`
      + `mot de passe (à usage unique, à changer après la première connexion): ${password}\n`
      + `créé: ${new Date().toISOString()}\n`)
    chmodSync(credPath, 0o600)
    console.log(`compte créé: ${created.email} (${created.role})`)
    console.log(`mot de passe écrit une seule fois dans : ${credPath} (chmod 600)`)
    console.log('déplacez-le dans un gestionnaire de mots de passe puis supprimez ce fichier.')
  } else {
    console.log(`compte créé: ${created.email} (${created.role}) — mot de passe fourni par stdin, non enregistré.`)
  }
}

main().catch((e) => { console.error('échec:', e.message); process.exit(1) })
