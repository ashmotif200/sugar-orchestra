# Fiche d'arrangement — Détendu / Segazz

**Destinataire :** Phase B. **Référence mesurée :** « Zistoire » (voir
`reference-analysis-detendue.md`). **Aucune modification du moteur n'est faite ici.**
**État actuel : l'univers `segazz` n'existe pas dans le moteur** (aucun compositeur,
`available: false`).

## 1. Carte d'identité

| Paramètre | Valeur cible | Mesuré sur la référence | Moteur actuel |
|---|---|---|---|
| Tempo | **134 BPM binaire** | 133,93 | univers absent |
| Mètre | 4/4, contretemps binaire (pas de swing ternaire) | 4/4, 1,792 s/mesure, swing 0,475 | — |
| Durée | **54 s / 30 mesures** | 54,47 s / 30 mes. | — |
| Tonalité | **si mineur**, jeu diatonique (Bm–Em–G–D–A–F#m) | si mineur 0,762 | — |
| LUFS intégré | **−14,5** | −14,5 | — |
| Crête | ≤ −1 dBFS | −1,42 | — |

## 2. Forme à produire (30 mesures)

| Section | Mesures | Durée | Couches | Intention |
|---|---|---|---|---|
| **A** | 1–8 | 14,3 s | batterie, basse, harmonie | installer sans presse |
| **Creux 1** | 9–10 | 3,6 s | batterie + basse, harmonie **−6 dB** | retirer le tapis |
| **A'** | 11–13 | 5,4 s | tout revient | reprise |
| **Stop 1** | 14 | 1,8 s | batterie + basse, harmonie **−10 dB** | respiration d'une mesure |
| **B** | 15–20 | 10,8 s | tout, harmonie plus présente | ouverture |
| **Stop 2** | 21 | 1,8 s | batterie + basse | relance |
| **Outro** | 22–30 | 16,1 s | tout, **batterie +4 dB** | montée finale discrète |

Les creux sont obtenus en **baissant la couche harmonique de 6 à 10 dB**, pas en
filtrant : c'est un stop-time d'arrangement.

## 3. Rôles et densités cibles

| Rôle | Source catalogue (sélection v2) | Densité cible | Niveau cible |
|---|---|---|---|
| **Basse (motrice)** | **aucune source grave** — voir §5 | **3,5 attaques/s** | **−19,2 LUFS** |
| Batterie | `02_01`, `03_04` (métal fin), `06_06` | 218 attaques/min, charleys aigus | **−23,0 LUFS** |
| Harmonie | `01_02`, `05_01`, `01_04` (nappe tenue) | 150 attaques/min | **−17,0 LUFS** |
| Percussion discrète | `07_02`, `06_04` très filtrés | ponctuelle | −28 LUFS |

**Inversion à assumer :** `harmonie > basse > batterie` en niveau. Le moteur actuel
met la batterie devant dans tous ses univers. Pour « Détendu », la batterie est
**5,8 dB sous la basse** et son centroïde est très aigu (3 348 Hz) : des charleys
fins, pas de grosse caisse dominante.

## 4. Traitement

- Passe-haut à 400 Hz sur la batterie, passe-bas à 8 kHz : ne garder que le « tic »
  métallique (centroïde mesuré 3 348 Hz).
- Nappe harmonique : accord tenu, changement à la mesure (cycle non détecté : la
  référence ne se répète pas à l'identique, elle **varie**).
- Basse : note tenue + attaques régulières ; registre la1 (~55 Hz).
- Pas de sidechain agressif (ce n'est pas de l'électro) : compression douce, la
  batterie reste derrière.

## 5. Décision requise — sans basse, cet univers n'existe pas

| Option | Conséquence | Verdict |
|---|---|---|
| **A. Pas de basse** | ce n'est plus un Segazz : la référence est portée par la basse (3,5 attaques/s, présence 100 %) | à éviter |
| **B. Sub fabriqué** (`07_01` bagasse 51 Hz → 55 Hz, passe-bas 150 Hz) | timbre plausible, mais transformation lourde | acceptable si écrit à l'écran |
| **C. Enregistrer 2–3 sons graves au musée** | seule voie conforme | recommandé, hors délai démo |

Recommandation : **ne pas livrer Segazz pour le 14/11** tant que C n'est pas fait, ou
le livrer en B avec la mention d'adaptation. L'afficher « Bientôt » reste honnête.

## 6. Ce que la Phase B doit changer (propositions)

1. Créer l'univers `segazz` : 134 BPM, 4/4, **30 mesures**.
2. Inverser l'équilibre : harmonie −17, basse −19, batterie −23 LUFS.
3. Écrire la forme A / creux 2 / A' / stop / B / stop / outro avec les baisses de
   6–10 dB sur l'harmonie.
4. Faire varier l'accord à la mesure (si mineur diatonique), pas une pédale.
5. Basse motrice 3,5/s — impossible sans source grave (voir §5).
6. Assumer une compression douce, pas un mastering électro.

## 7. Contrat d'écoute (acceptation)

- [ ] On entend une basse qui conduit, pas une batterie qui pilote.
- [ ] Le tempo est celui d'un morceau dansant tranquille (~134), pas d'une ballade.
- [ ] Il y a deux « trous » d'une à deux mesures où le tapis harmonique s'efface.
- [ ] L'harmonie change d'accord, elle ne tient pas une note.
- [ ] Les charleys sont fins et hauts, pas de grosse caisse en avant.
