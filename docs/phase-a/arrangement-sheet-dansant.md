# Fiche d'arrangement — Dansant / Sega traditionnel

**Destinataire :** Phase B. **Référence mesurée :** « Tififi » (voir
`reference-analysis-dansant.md`). **Sélection disponible :** v2, 17 sons
(`sound-selection-v2.md`). **Aucune modification du moteur n'est faite ici.**
**État actuel : l'univers `sega-trad` existe** (compositeur `composeSegaTrad`,
126 BPM, 6/8, 24 mesures, `available: true`).

---

## 1. Carte d'identité

| Paramètre | Valeur cible | Mesuré sur la référence | Moteur actuel |
|---|---|---|---|
| Pulsation | **149,8–152 BPM** | 149,80 (drums) / 152,00 (mix), IBI σ 37 ms | **126 BPM** → **−16 %** |
| Subdivision | **ternaire** (1/3–2/3) | 44,7 % des onsets en 1/3–2/3, 8,8 % à 1/2 | 6/8 ternaire ✔ (grille `at8`) |
| Mesure | 6/8 (hypothèse principale) — 1,60 s en lecture 4/4 | voir §2 du doc de référence | 24 mesures · 34 s |
| Durée | **3 min 26** (205,6 s) | 205,59 s | **34 s** → 6× trop court |
| Basse | **aucune** | pas de stem, grave porté par le tambour (21 % 40–250 Hz) | une basse est prévue (`bass` role) |
| Harmonie | **pas de grille détectée** | corrélation max 0,368, cycle aucun | `SEGA_ROOTS` = 24 accords imposés |
| LUFS intégré | **−10,1** | −10,1 | −17 visé actuellement |
| Crête | ≤ −0,3 dBFS | −0,32 | −1,0 |

## 2. Organisation rythmique — ce qui donne envie de danser

La référence est **percussion + voix**, ternaire, à ~150. Ce qui produit le
mouvement, dans l'ordre d'importance mesurée :

1. **La pulsation est rapide** (150, pas 126) et **divisée en trois** : c'est le
   balancement du sega, pas un shuffle de jazz.
2. **La percussion est continue** : médiane −20,3 dB sur tout le morceau, aucun
   trou à l'intérieur des sections. Le tambour ne s'arrête qu'à la mesure 119.
3. **L'articulation vient de la superposition** (tambour + voix + couche tonale),
   pas d'une variation de motif : 44,7 % des onsets tombent sur les 1/3, ce qui
   crée un flux ininterrompu de frappes.
4. **Aucune basse** : rien ne « pose » le grave, donc rien ne ralentit la sensation.
   Le poids est dans la peau du tambour, pas dans une note tenue.

## 3. Rôles et sources disponibles (sélection v2)

Correspondance mesurée sur les 17 sons de la sélection, à partir de
`data/corpus-analysis.json` :

| Rôle requis par la référence | Sons de la sélection qui peuvent le tenir | Mesure | Verdict |
|---|---|---|---|
| **Percussion (tambour)** | `03_04` Charpentier, `06_04` Charrette, `08_02` Jus de canne, `04_03` Coupe, `01_03` Bateau | 4,5–10,8 onsets/s | **réalisable** — 5 sources, la ressource la plus solide |
| **Percussion métallique / charley** | `04_09` Cuillère sur fer blanc | périodicité 0,86 à 723 Hz, attaque 0,1 ms | **réalisable et précise** (frappe nette) |
| **Voix** | **aucune** — `04_05` est une maquette `not_musical` | — | **impossible** (voir §6) |
| **Couche tonale médium** | `02_01`, `05_01`, `08_03` (nappes) | platitude 0,11–0,28 | **réalisable**, mais timbrale, pas harmonique |
| **Basse** | **aucune** — et la référence n'en a pas | 0/40 sons sous 220 Hz avec hauteur crédible | **non requise** ✔ |
| Percussion sensible | `04_02` Fers ouverture/fermeture | — | **interdit** : `sensitive` |

Le point décisif : **cet univers n'a pas besoin de basse**, et c'est le seul des
trois dans ce cas. La sélection v2 peut donc honorer la référence Dansant presque
entièrement — sauf la voix.

## 4. Forme à produire

D'après la timeline mesurée (§6 du doc de référence), transposée en principes
réutilisables — pas en copie :

| Section | Proportion de la référence | Contenu | Intention |
|---|---|---|---|
| **Intro chantée** | 7 % (14 s) | une seule couche, sans percussion | faire entrer l'oreille avant le rythme |
| **Montée par couches** | 10 % (20 s) | ajout de la couche tonale, puis de la percussion | chaque couche gagne un cran |
| **Plateau rythmique** | 62 % (128 s) | percussion continue + couche tonale | c'est là que le visiteur danse |
| **Arrêt de la percussion** | 2 % (3 s) | la couche tonale reste seule | respiration, une à deux mesures |
| **Fin** | 6 % (13 s) | retrait, silence | |

Pour Sugar Orchestra, à l'échelle d'une pièce courte (35–60 s), l'équivalent
proportionnel donne : intro 4–6 s · montée 6–8 s · plateau 20–35 s · arrêt 1–2
mesures · fin 3–4 s.

## 5. Traitement et équilibre

- **Aucune basse à fabriquer.** Ne pas assigner le rôle `bass` pour cet univers :
  c'est une décision musicale fondée sur la référence, pas une carence.
- **Percussion devant** : −14,1 LUFS contre −30,5 pour la couche tonale dans la
  référence, soit **16 dB d'écart**. Le moteur actuel met la basse devant.
- **Couche tonale en décor** : elle ne porte pas l'harmonie, elle remplit le
  milieu. Pas d'accords qui changent, pas de progression inventée.
- **Voix absente** → compenser par : densité de percussion (viser ≥ 8 onsets/s),
  accents métalliques (`04_09`), et une intro instrumentale qui joue le rôle de
  l'intro chantée.
- **Niveau cible** : −10 LUFS est le plus fort des trois. Pour un casque de musée,
  viser **−14 à −12 LUFS** avec crête ≤ −1 dBFS (la référence est à −0,32, trop
  chaud pour une écoute prolongée).

## 6. La voix : décision requise

| Option | Ce que ça donne | Coût | Honnêteté |
|---|---|---|---|
| **A. Pièce instrumentale assumée** | percussion + textures, sans voix | nul | **recommandé** pour la démo |
| B. Utiliser `04_05 Ayo` (maquette) | voix synthétique | — | **interdit** : `not_musical`, `sensitive`, `needsValidation` |
| C. Enregistrer une voix au musée | la référence est approchée | terrain | hors délai 14/11 |

La référence est portée par une voix réelle à −14,3 LUFS présente dès la première
seconde. Une version instrumentale **ne sonnera pas comme Tififi** : elle sonnera
comme un sega instrumental. C'est acceptable si c'est annoncé, pas si on prétend
reproduire la référence.

## 7. Ce que la Phase B doit changer (propositions)

1. **Tempo `sega-trad` : 126 → 150** (pulsation). L'écart actuel est de 16 %, ce
   qui s'entend comme « plus lent que la référence ».
2. **Durée : 24 mesures → 40–56 mesures** selon la lecture de mètre, pour que
   l'intro, la montée et le plateau existent.
3. **Supprimer la basse** de cet univers (ou la rendre facultative si une source
   grave apparaît un jour).
4. **Forme en ajout de couches** : intro 1 couche → + tonale → + percussion →
   plateau → arrêt → fin.
5. **Ne pas écrire de grille d'accords** : bourdon ou pédale modale.
6. **Percussion devant** de 8–16 dB sur les autres couches.

## 8. Contrat d'écoute (acceptation)

- [ ] Ça donne envie de bouger : la percussion ne s'arrête pas au milieu.
- [ ] Le balancement est ternaire — on entend trois, pas deux.
- [ ] Il n'y a pas de basse, et ça ne manque pas.
- [ ] Le début fait entrer une couche avant le rythme.
- [ ] Il y a un trou d'une à deux mesures avant la fin.
- [ ] Ça ne sonne pas comme un sega de bal musette ralenti : le tempo est vif.

---

## Paramètres mesurés utilisables par le moteur (passe 3)

Complète les valeurs estimées plus haut par des mesures ; en cas de conflit, **la mesure
fait foi**.

| Paramètre | Valeur mesurée | Source |
|---|---|---|
| Durée de mesure | **2,32 s** | `reference-dansant.json` |
| Pulsation | ~155 à l'unité croche (≡ 103,4 noires) — confiance moyenne | `pulse-dansant.json` |
| Subdivision | ternaire ; 6 pas par mesure | `meter-dansant.json`, `groove-dansant.json` |
| Densité de percussion | **4,03 attaques/s**, tenue en continu (pas de trou) | idem |
| Type de frappe | roulement : histogramme de phase plat, 66 ms de dispersion | idem |
| Variation de motif | **0,955** de similarité entre mesures : programmer très peu de variation | idem |
| Niveau du plateau (mix) | −11,0 à −12,2 LUFS, stable à ±1,5 LU | `groove-dansant.json` |
| Niveau de l'intro | −13,7 LUFS (voix seule) | idem |
| Plafond de sortie | viser **−1,0 dBTP** (la référence atteint +0,6 : à ne pas copier) | idem |
| Voix vs percussion | à égalité (2 dB d'écart au maximum) | `reference-dansant.json` |
| Couche tonale | **16,4 dB sous** les deux autres : présence discrète, jamais porteuse | idem |

### Trois conséquences pour l'implémentation

1. Le roulement se programme en **densité** (nombre de frappes par seconde), pas en
   positions sur une grille : une cellule de 6 pas avec des frappes à chaque pas est
   déjà un roulement.
2. La **variation est l'ennemie** de cet univers : introduire des fills toutes les deux
   mesures le transforme en autre chose. Un changement de couche tous les 8 à 16 mesures
   suffit.
3. L'introduction doit **précéder le rythme** : c'est un trait de la référence
   (14 s a cappella), pas un accident.
