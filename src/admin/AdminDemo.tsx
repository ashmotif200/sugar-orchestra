import { useMemo, useState } from 'react'
import { catalog } from '../audio/service'
import { UNIVERSES } from '../engine/universes'
import { catalogState } from '../data/publication'
import './admin.css'

/**
 * Démonstration STATIQUE de l'administration — `#/admin-demo`
 *
 * GitHub Pages ne peut pas exécuter le serveur d'administration : il n'y a ni
 * API, ni base, ni session. Cette page montre donc l'interface et les données
 * déjà embarquées dans le bundle, en lecture seule.
 *
 * Ce qu'elle ne fait pas, par construction :
 *   - aucun appel réseau (pas de `fetch`) ;
 *   - aucune écriture, aucun formulaire actif ;
 *   - aucun secret, aucune donnée privée : uniquement ce que le catalogue publié
 *     contient déjà et que n'importe quel visiteur peut lire ;
 *   - aucune allusion à une base d'administration qui n'existerait pas ici.
 *
 * Ce qu'elle est : une visite guidée de l'outil, pour qu'un développeur ou un
 * membre du musée comprenne le produit sans installer le serveur. La vraie
 * administration reste `#/admin`, derrière authentification.
 */

type Tab = 'dashboard' | 'sounds' | 'steps' | 'universes' | 'content'

const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', glyph: '◱' },
  { id: 'sounds', label: 'Bibliothèque sonore', glyph: '◉' },
  { id: 'steps', label: 'Étapes du musée', glyph: '⇥' },
  { id: 'universes', label: 'Studio musical', glyph: '∫' },
  { id: 'content', label: 'Contenus & histoires', glyph: '¶' },
]

const Pill = ({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }) => (
  <span className={`adm-pill adm-pill-${tone}`}>{children}</span>
)

export default function AdminDemo({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [q, setQ] = useState('')

  const pub = catalogState()
  const sounds = catalog.sounds
  const steps = catalog.steps ?? []

  const published = useMemo(
    () => new Set(pub.sounds.filter((s) => s.status === 'published').map((s) => s.code)),
    [pub],
  )
  const openUniverses = useMemo(
    () => UNIVERSES.filter((u) => {
      const row = pub.universes.find((x) => x.id === u.id)
      return !!row && row.status === 'published' && row.engineImplemented
    }),
    [pub],
  )

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return sounds
    return sounds.filter((s) =>
      (s.code ?? '').toLowerCase().includes(needle)
      || (s.name ?? '').toLowerCase().includes(needle)
      || (s.title ?? '').toLowerCase().includes(needle))
  }, [sounds, q])

  const sensitive = sounds.filter((s) => s.sensitive).length
  const publishedCount = published.size

  const metrics = [
    { v: sounds.length, k: 'Sons au catalogue', note: `${steps.length} étapes` },
    { v: publishedCount, k: 'Sons publiés', note: `${sounds.length - publishedCount} en brouillon` },
    { v: sensitive, k: 'Sons à signalement historique', note: 'écoute contextualisée' },
    { v: `${openUniverses.length}/${UNIVERSES.length}`, k: 'Univers proposés', note: 'publié + moteur présent' },
  ]

  return (
    <div className="adm">
      <aside className="adm-side">
        <a className="adm-brand" href="#/" onClick={(e) => { e.preventDefault(); onBack() }}>
          <span className="adm-brand-mark">SO</span>
          <span>
            <b>Sugar Orchestra</b>
            <i>Administration — démo</i>
          </span>
        </a>
        <nav>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              className={`adm-nav ${tab === tb.id ? 'is-on' : ''}`}
              onClick={() => setTab(tb.id)}
              aria-current={tab === tb.id ? 'page' : undefined}
            >
              <span aria-hidden>{tb.glyph}</span> {tb.label}
            </button>
          ))}
        </nav>
        <div className="adm-user">
          <div>
            <b>Visiteur</b>
            <i>lecture seule</i>
          </div>
          <span className="adm-pill adm-pill-muted">démo</span>
        </div>
        <a className="adm-visitor" href="#/" onClick={(e) => { e.preventDefault(); onBack() }}>
          ← Parcours visiteur
        </a>
      </aside>

      <main className="adm-main">
        <div className="adm-demo-banner" role="note">
          <b>Démonstration statique.</b> Cette page montre l'interface
          d'administration avec les données déjà publiées dans l'application : aucune
          connexion, aucune modification, aucune requête vers un serveur. GitHub
          Pages ne peut pas exécuter l'API d'administration ; l'outil réel — comptes,
          édition, publication, laboratoires — est servi par
          <code> npm run admin:serve</code>, derrière authentification.
        </div>

        {tab === 'dashboard' && (
          <>
            <header className="adm-head">
              <div>
                <h1>Tableau de bord</h1>
                <p className="adm-muted">
                  Indicateurs calculés depuis le catalogue embarqué et l'état de
                  publication livré avec le site. Ce sont exactement les chiffres que
                  lit le parcours visiteur.
                </p>
              </div>
            </header>

            <div className="adm-metrics">
              {metrics.map((m) => (
                <div className="adm-metric" key={m.k}>
                  <b>{m.v}</b>
                  <span>{m.k}</span>
                  <i>{m.note}</i>
                </div>
              ))}
            </div>

            <div className="adm-cols">
              <div className="adm-card">
                <h2>Univers musicaux</h2>
                <table className="adm-table">
                  <thead><tr><th>Univers</th><th>Statut</th><th>Moteur</th><th>Proposé</th></tr></thead>
                  <tbody>
                    {UNIVERSES.map((u) => {
                      const row = pub.universes.find((x) => x.id === u.id)
                      const open = !!row && row.status === 'published' && row.engineImplemented
                      return (
                        <tr key={u.id}>
                          <td><b>{u.name}</b><br /><span className="adm-mono">{u.id}</span></td>
                          <td>{row
                            ? <Pill tone={row.status === 'published' ? 'ok' : 'muted'}>{row.status}</Pill>
                            : <Pill tone="muted">inconnu</Pill>}</td>
                          <td>{row?.engineImplemented ? <Pill tone="ok">implémenté</Pill> : <Pill tone="warn">sans compositeur</Pill>}</td>
                          <td>{open ? '✅' : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="adm-card">
                <h2>Principe de disponibilité</h2>
                <p className="adm-small">
                  Un univers n'est ouvert que s'il est <b>publié</b> et si son moteur
                  existe. Un son n'est utilisable que s'il est <b>publié</b>. Ces deux
                  règles vivent dans un seul module, côté application, et les écrans
                  ne les contournent pas.
                </p>
                <p className="adm-small adm-muted">
                  Les {sounds.length - publishedCount} sons en brouillon restent
                  visibles dans les étapes, verrouillés « Bientôt » : leurs droits de
                  diffusion ne sont pas établis, ils ne sont donc ni écoutables ni
                  publiés.
                </p>
              </div>
            </div>
          </>
        )}

        {tab === 'sounds' && (
          <>
            <header className="adm-head">
              <div>
                <h1>Bibliothèque sonore</h1>
                <p className="adm-muted">{rows.length} résultat(s) · catalogue embarqué</p>
              </div>
            </header>
            <div className="adm-filters">
              <div className="adm-field">
                <input
                  placeholder="Rechercher un code ou un nom…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Rechercher un son"
                />
              </div>
            </div>
            <table className="adm-table">
              <thead>
                <tr><th>Code</th><th>Nom</th><th>Étape</th><th>Statut</th><th>Crédits</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((s) => (
                  <tr key={s.id}>
                    <td className="adm-mono">{s.code}</td>
                    <td>{s.title ?? s.name}</td>
                    <td>{s.stepId}</td>
                    <td>{published.has(s.code)
                      ? <Pill tone="ok">publié</Pill>
                      : <Pill tone="muted">brouillon</Pill>}</td>
                    <td className="adm-small adm-muted">{s.credits ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="adm-muted adm-small">
              En lecture seule : remplacer un fichier, versionner ou restaurer une
              version demande le serveur d'administration.
            </p>
          </>
        )}

        {tab === 'steps' && (
          <>
            <header className="adm-head">
              <div>
                <h1>Étapes du musée</h1>
                <p className="adm-muted">
                  Sept étapes, identifiants stables. Un son peut appartenir à une étape
                  différente de sa séquence d'inventaire.
                </p>
              </div>
            </header>
            <table className="adm-table">
              <thead>
                <tr><th>#</th><th>Titre</th><th>Sons</th><th>Publiés</th></tr>
              </thead>
              <tbody>
                {steps.map((st) => {
                  const list = sounds.filter((s) => s.stepId === st.id)
                  return (
                    <tr key={st.id}>
                      <td>{st.id}</td>
                      <td>{st.title}</td>
                      <td>{list.length}</td>
                      <td>{list.filter((s) => published.has(s.code)).length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {tab === 'universes' && (
          <>
            <header className="adm-head">
              <div>
                <h1>Studio musical</h1>
                <p className="adm-muted">
                  Quatre univers, un seul proposé au visiteur. Les paramètres
                  d'arrangement ne sont pas modifiables ici : un contrôle qui ne
                  changerait rien serait un mensonge d'interface.
                </p>
              </div>
            </header>
            <table className="adm-table">
              <thead>
                <tr><th>Univers</th><th>Mascotte</th><th>Ambiance</th><th>Statut</th><th>Moteur</th><th>Proposé</th></tr>
              </thead>
              <tbody>
                {UNIVERSES.map((u) => {
                  const row = pub.universes.find((x) => x.id === u.id)
                  const open = !!row && row.status === 'published' && row.engineImplemented
                  return (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.mascot?.name ?? '—'}</td>
                      <td>{u.emotion}</td>
                      <td>{row
                        ? <Pill tone={row.status === 'published' ? 'ok' : 'muted'}>{row.status}</Pill>
                        : <Pill tone="muted">inconnu</Pill>}</td>
                      <td>{row?.engineImplemented ? 'présent' : 'absent'}</td>
                      <td>{open ? '✅' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {tab === 'content' && (
          <>
            <header className="adm-head">
              <div>
                <h1>Contenus & histoires</h1>
                <p className="adm-muted">Circuit brouillon → relecture → approuvé → publié.</p>
              </div>
            </header>
            <div className="adm-card">
              <p>
                Aucune fiche éditoriale n'est publiée dans cette démonstration. Les
                textes historiques doivent être écrits et validés par le musée ;
                l'application n'en invente aucun, et les fiches affichent
                « Description à venir. » tant qu'il n'y en a pas.
              </p>
              <p className="adm-muted adm-small">
                La chaîne réelle existe et est documentée dans
                <code> docs/ADMINISTRATION.md</code>. Elle n'est pas rejouable ici :
                elle écrit en base.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
