# Roadmap

Ce document dit ce qui est fait, ce qui vient ensuite, et dans quel ordre — avec les
décisions qui ne peuvent pas être prises par un développeur seul.

**Aucune date.** Le projet est archivé ; une feuille de route datée serait un
engagement que personne ne peut tenir.

---

## 1. Fait

| | État |
|---|---|
| Parcours visiteur en 7 étapes | ✅ |
| 8 postes QR, collecte automatique | ✅ |
| Carnet, sélection, lecteur partagé | ✅ |
| Morceau final lisible sur Safari iOS, Chrome, desktop | ✅ |
| Session persistée au rechargement | ✅ |
| Administration (SQLite, API, permissions, audit, chaîne éditoriale) | ✅ |
| Super Admin : 8 modules opérationnels | ✅ |
| Analyses musicales des trois références | ✅ |
| Moteurs V1, V2.0, V2.1 | ✅ fonctionnels, hors parcours |
| Démonstration statique publiée | ✅ |
| Documentation et transmission | ✅ |

## 2. Prochaine étape — décisions à prendre (bloquantes)

Ces trois points ne relèvent pas du code.

### 2.1 Le moteur : quelle stratégie ?

Le constat mesuré : 0 son sur 40 utilisable comme basse, 5 sur 40 porteurs d'une
hauteur crédible. La matière ne peut pas porter une harmonie, donc un moteur qui
« séquence » les sons collectés ne peut pas produire de la musique.

Trois issues, déjà instruites (`docs/phase-a/phase-b-engine-proposal.md`,
`docs/strategie/reevaluation-musicale.md`) :

| Option | Coût | Conséquence |
|---|---|---|
| **A. Percussion-led** | faible | honnête vis-à-vis du corpus, mais s'éloigne de la promesse musicale |
| **B. Accompagnement précomposé sous les sons du visiteur** | moyen | **décision déjà prise par le propriétaire le 13/11/2026** ; un morceau étalon existe ; reste à en produire d'autres et à les brancher |
| **C. Enregistrer 2–3 sons graves au musée** | élevé (déplacement, autorisation) | la seule voie qui garde « uniquement les sons du musée » |

**Décision attendue** : confirmer B, ou basculer vers C. Sans cette décision, aucun
développement de moteur n'a de sens.

### 2.2 Les textes du musée

Les fiches affichent « Description à venir. » pour les huit postes. C'est un manque de
contenu, pas un défaut : le projet refuse d'inventer une histoire de l'esclavage ou de
l'engagisme.

**Décision attendue** : qui écrit, qui valide, sous quelles conditions de sourçage.

### 2.3 Les droits des ressources

Auteurs identifiés et accords confirmés par le propriétaire du projet : Tanguy
(enregistrement du lota), Noémie (personnages), Ashley (développement), Martin
(musique). Ce qui reste ouvert, dans `docs/ASSET-LICENSES.md` § 5 :

- les **conditions de la charte juridique Muséomix**, qui existe mais n'est pas encore
  disponible — aucune licence n'est attribuée en attendant, et rien n'est retiré au
  motif que la charte manque ;
- l'**autorisation écrite de Martin** pour la diffusion en ligne du morceau.

**Décision attendue** : lire la charte dès qu'elle sera disponible, puis aligner la
documentation et, si elle l'exige, les mentions de crédit affichées.

## 3. Ensuite — travail de développement

Par ordre de valeur, une fois les décisions du § 2 prises.

### 3.1 Court terme

| Tâche | Effort | Pourquoi |
|---|---|---|
| Corriger le contrôle `visitor_catalog_unchanged_by_publish` | ~10 lignes | un test rouge permanent finit par être ignoré ; la correction est décrite dans `docs/DEVELOPMENT.md` § 5 |
| Tester le scanner sur un iPhone physique | 30 min | seule la validation bureau a été faite ; c'est un risque d'usage réel |
| Rédiger les descriptions des 8 postes | dépend du musée | supprime le « Description à venir » |
| Compléter les licences des mascottes | dépend de l'équipe | condition de toute réutilisation |

### 3.2 Moyen terme

| Tâche | Prérequis |
|---|---|
| Brancher un accompagnement précomposé sur la sélection du visiteur | décision 2.1 = B |
| Décider du sort des trois univers « Bientôt » | décision de l'équipe ; ils ne doivent pas rester une promesse |
| Mode hors-ligne (service worker) | si l'usage en musée l'exige |
| Rapatrier le catalogue complet dans le dépôt | autorisation de diffusion des 40 sons |

### 3.3 Long terme — hypothèses, pas engagements

- **Une basse par synthèse** (V2.1 en produit une) : possible techniquement, mais elle
  doit être **annoncée** comme une adaptation, pas présentée comme un son du musée.
- **Quatre univers réellement distincts** : suppose une référence mesurée pour Rêveur ;
  elle n'existe pas, et l'inventer serait pire que de laisser « Bientôt ».
- **Mastering** : les rendus V2 sont normalisés en crête (−1 dBTP), pas en loudness ;
  l'écart entre univers atteint 14 dB. Une chaîne de mastering est nécessaire avant
  toute diffusion sérieuse.
- **Application installable** : sort du périmètre d'un prototype de médiation.

## 4. Méthode à conserver

Le projet a coûté plusieurs passes parce que des intuitions non mesurées ont été
implémentées avant d'être vérifiées. La méthode qui a fini par fonctionner :

1. **Mesurer** la cible (un enregistrement de référence, un corpus).
2. **Écrire à la main** un résultat qui convainc à l'écoute — l'étalon.
3. **Automatiser** seulement ce que l'étalon justifie.
4. **Compter le contenu musical dans l'artefact**, pas seulement les invariants des
   tests.

Toute reprise qui inverse cet ordre reproduira les mêmes passes.

## 5. Ce qui est explicitement abandonné

Pour éviter qu'un repreneur le regrette :

- **Faire composer le moteur uniquement à partir des sons du visiteur** — mesuré
  impossible avec ce corpus.
- **Choisir un tempo en BPM entier** — ne peut pas représenter une mesure ternaire.
- **Attribuer un rôle à partir de la fréquence dominante** — produit des lignes de
  notes écrites à partir de bruit.
- **Réutiliser les enregistrements de référence comme bandes-son** — aucune autorisation.
- **Publier les 32 sons restants** tant que leurs droits ne sont pas établis.
