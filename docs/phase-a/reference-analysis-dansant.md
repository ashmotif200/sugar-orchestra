# Référence Dansant — « Tififi » (mix + 3 stems)

**Fichiers :** `tififi_Dansant_mix.wav` + `tififi_Dansant_drums/vocals/other.mp3`
(44,1 kHz stéréo, 205,59 s). Archive `tififi_Dansant_Stems+mix.zip`,
sha256 `307c3f9d…907b69`, intégrité `testzip` OK. Extraits dans
`assets/references/tififi/` ; l'archive est conservée intacte.
**Données :** `data/reference-dansant.json`, `data/arrangement-dansant.json`,
`data/harmony-dansant.json`, `data/meter-dansant.json`.
**Réutilise :** `scripts/phase-a/analyze-reference.py`, `analyze-arrangement.py`,
`analyze-harmony.py` (pipeline des deux autres références) + `analyze-meter.py` (nouveau).

---

## 1. Vérification technique

| Élément | Mix | drums | vocals | other |
|---|---|---|---|---|
| Durée | 205,59 s | 205,59 s | 205,59 s | 205,59 s |
| Fréquence | 44 100 Hz | 44 100 Hz | 44 100 Hz | 44 100 Hz |
| Canaux | 2 | 2 | 2 | 2 |
| LUFS intégré | **−10,1** | −14,1 | **−14,3** | **−30,5** |
| Crête | −0,32 dBFS | −2,37 | −0,88 | −10,13 |
| RMS | −15,6 dB | −21,0 | −18,8 | −36,1 |

**Reconstruction :** corrélation **0,9969**, gain mix/somme **1,0758**, décalages
**0,0 ms** sur les trois stems, écarts d'échantillons nuls → **les stems sont le
multipiste réel**, alignés, et le mix est leur somme mise à niveau.

> Limite mesurée : 0,9969 et non 0,9999 comme pour les deux autres références.
> Cause identifiée : les stems sont des **MP3** (codec avec retard d'encodeur et
> perte), pas des WAV. L'écart est un artefact de compression, pas un désalignement
> — les décalages mesurés sont nuls et les sommes d'échantillons identiques.

**Aucun stem de basse n'existe dans cette référence.** C'est un fait, pas un oubli
d'extraction : l'archive contient exactement quatre fichiers.

## 2. Tempo et mètre — la mesure qui a demandé quatre tentatives

Le sélecteur de tempo générique de `analyze-reference.py` a rendu **103,36 BPM**.
C'est un **artefact 2:3** : la vraie pulsation est ~150, et 150 × 2/3 = 100.

Le test de mètre (`analyze-meter.py`) force chaque hypothèse de BPM et garde celle
dont la grille est la plus régulière (écart-type de l'intervalle inter-temps) :

| Hypothèse | Écart-type IBI | Concentration de phase | Verdict |
|---|---|---|---|
| **149,80** | **36,8 ms** | **44,7 %** | meilleure grille — drums |
| 155,04 | 38,7 ms | 44,6 % | quasi identique |
| 152,00 | 37,2 ms | 40,0 % | meilleure grille — mix |
| 99,87 / 101,33 | 48,0 / 53,1 ms | 31,0 / 29,2 % | **nettement moins bon** |
| 103,36 (rendu générique) | — | — | à ne pas réutiliser |

**Mesures objectives :**
- pulsation retenue : **149,8–152 BPM** (accord drums/mix à 1,5 %) ;
- **subdivision ternaire** : 44,7 % des onsets tombent à 1/3 ou 2/3 de la
  pulsation, contre 8,8 % à la moitié → la pulsation se divise en **trois** ;
- périodicité de mesure (autocorrélation) : **1,33 s** et **2,66 s** selon la source.

**Hypothèse de mètre (à confirmer à l'oreille) :** le morceau est **ternaire**, et
la formulation la plus cohérente est **6/8 (ou 12/8) avec une pulsation rapide**,
pas un 4/4 binaire. Deux lectures restent possibles et sont conservées :

| Lecture | Mesure | Nombre de mesures sur 205,59 s |
|---|---|---|
| **A — 4/4 à 149,8** (grille utilisée pour la timeline) | 1,60 s | **128** |
| **B — 6/8 à 149,8 croches** | 2,40 s | **~85** |

Les deux donnent la même pulsation ; elles diffèrent sur ce qu'on appelle une
mesure. La timeline du §6 est calculée en lecture A, et les durées en secondes y
sont valables quelle que soit la lecture. **Ne pas présenter 149,8 comme « le »
BPM sans dire ternaire.**

## 3. Analyse instrumentale

| Stem | Rôle musical | Registre (centroïde) | Présence | Densité | Confiance d'identification |
|---|---|---|---|---|---|
| **drums** | percussion complète : tambour grave + peaux + charleys | 3 052 Hz | entre à la mesure 7, puis ~100 % | médiane −20,3 dB | **haute** (percussion évidente) |
| **vocals** | voix chantée principale | 2 978 Hz, hauteur médiane **282 Hz** | **dès 0 s** | médiane −18,9 dB | **haute** (formants + hauteur stable) |
| **other** | couche tonale médium (cordes/clavier/guitare — **non identifiée**) | 3 405 Hz, hauteur médiane **204 Hz**, platitude 0,017 | à partir de la mesure 8, **−30,5 LUFS** | médiane −36,6 dB | **faible** : c'est une couche tonale, pas un instrument nommable |

**Le stem `other` n'est pas interprété comme un instrument unique.** Sa hauteur
médiane (204 Hz), sa platitude faible (0,017) et sa densité indiquent du matériau
tonal tenu, mais rien ne permet de dire s'il s'agit d'une guitare, d'un clavier ou
d'un ensemble. **Non identifié.**

## 4. Basse — il n'y en a pas

C'est la découverte structurante de cette référence.

| Question | Mesure |
|---|---|
| Stem de basse | **absent de l'archive** |
| Énergie sous 120 Hz — drums / other / vocals | **10,4 % / 6,1 % / 0,2 %** |
| Énergie 40–250 Hz — drums / other / vocals | **21,0 % / 31,1 % / 2,6 %** |
| Hauteur médiane détectée — other / vocals | 204 Hz / 282 Hz |

Le grave est porté par **la percussion** (21 % de son énergie entre 40 et 250 Hz :
la peau grave du tambour) et par le bas-médium de `other`. Il n'y a **ni instrument
de basse, ni ligne de basse**. Toute « analyse de basse » sur cette référence
mesurerait le tambour.

**Conséquence pour le projet :** l'univers « Dansant » n'a pas besoin de basse
pour être fidèle à sa référence. C'est aussi l'univers que le fonds sonore du
musée peut réellement produire (voir §7).

## 5. Harmonie

`other` : meilleur candidat **sol mineur, corrélation 0,368** ; ensuite fa# mineur
0,204 et sol majeur 0,178. Confiance par mesure entre 0,52 et 0,65, **cycle
d'accords : aucun**.

Lecture honnête : **aucun centre tonal n'est établi**. Une corrélation de 0,37 est
du niveau du bruit pour ce type de matcher, et l'absence de cycle signifie qu'il
n'y a pas de grille d'accords répétitive détectable. Trois hypothèses, non
tranchées : (a) matériau modal ou pentatonique sans accords tertiens ; (b) couche
`other` surtout timbrale, la hauteur venant de la voix ; (c) matcher inadapté à ce
matériau. **Ne pas écrire « sol mineur » comme un fait.**

## 6. Structure mesurée (grille 1,60 s — lecture A)

| Mesures | Durée | Couches actives | Lecture |
|---|---|---|---|
| **1–9** | **14,4 s** | **voix seule** | **introduction a cappella** |
| 10–12 | 4,8 s | + other | entrée du soutien tonal |
| **13–14** | 3,2 s | + drums | **entrée de la percussion** |
| 15–35 | 33,6 s | drums + voix, `other` par intermittence | mise en place, alternances |
| 36–48 | 20,8 s | toutes | premier plateau |
| 49 | 1,6 s | drums + voix | micro-variation |
| **50–118** | **110,5 s** | **toutes, continu** | **corps du morceau, 69 mesures** |
| 119–120 | 3,2 s | other + voix | la percussion s'arrête |
| 121–128 | 12,8 s | **silence** | queue silencieuse |

Forme : **intro voix (14 s) · entrée percussion · alternances · long plateau
continu (110 s) · arrêt de la percussion · silence**. Ce n'est pas une forme
couplet/refrain : c'est un **cycle de sega** qui tourne, avec une intro chantée.

Le silence final de 12,8 s est réel (mesuré), pas une fin en fondu.

## 7. Mixage

| Mesure | Valeur | Lecture |
|---|---|---|
| LUFS intégré (mix) | **−10,1** | le plus fort des trois morceaux (+4,4 dB vs Détendu) |
| Crête | −0,32 dBFS | limiteur serré, très proche du plafond |
| Équilibre | voix −14,3 ≈ drums −14,1 **≫** other −30,5 | **voix et percussion à égalité, couche tonale 16 dB en dessous** |
| Évolution d'énergie | intro voix seule → ajout par couches → plateau | montée par **ajout**, pas par intensification |

**Le mixage de cette référence est un mixage de chanson**, pas de production
instrumentale : la voix est au niveau de la batterie et la couche harmonique est
quasiment un décor. C'est l'inverse de Détendu (basse devant) et l'inverse
d'une production électro (drums devant tout).

## 8. Ce que cette référence dit pour la Phase B

1. **~150 BPM ternaire**, pas 103 : le picker générique s'est trompé d'un facteur
   3:2 sur les trois références tour à tour. À corriger avant d'écrire un univers.
2. **Pas de basse.** L'univers Dansant peut et doit fonctionner sans : c'est le
   seul des trois que le catalogue du musée peut honorer aujourd'hui.
3. **La voix porte le morceau** (présente dès 0 s, −14,3 LUFS). Le moteur ne peut
   pas chanter : il devra compenser par la percussion et l'articulation rythmique,
   ou assumer une version instrumentale.
4. **Intro sans percussion de 14 s** : une entrée progressive par couches est
   disponible dans la référence, sans avoir à l'inventer.
5. **Pas de grille d'accords** : ne pas fabriquer une progression harmonique pour
   cet univers ; une pédale ou un bourdon modal est plus fidèle.
6. **Durée 3 min 26** contre 36 s dans le moteur : pour cet univers, une boucle de
   36 s n'est pas une forme, c'est un extrait.

---

## Passe 3 — mesures complémentaires (13/11/2026)

Cette passe répond à trois questions laissées ouvertes : le tempo, le groove, et la
dynamique par section. Deux erreurs de méthode ont été trouvées et corrigées en route ;
elles sont documentées parce qu'elles invalidaient des chiffres déjà publiés.

### Correction de méthode 1 — le pouls n'est pas 103,36

`librosa.beat.beat_track` rendait 103,36 BPM. Un balayage complet (60–200 BPM, grille
ajustée sur les attaques, tolérance 25 ms) donne un maximum à **194,75 BPM** avec une
concentration faible (20,5 %) : aucun pouls discret ne se détache. Le tempogramme, second
estimateur indépendant, propose **103,36 / 99,38 / 139,67**.

Ces valeurs ne se contredisent pas : pour une mesure de **2,32 s**, 103,4 BPM (noires) et
~155 BPM (croches) décrivent **la même mesure**. C'est exactement le piège que le brief
signalait — un tempo sans unité métrique n'a pas de sens.

**Énoncé retenu :** mesure ≈ 2,32 s, subdivision ternaire, ~155 à l'unité croche
(≡ 103,4 à l'unité noire). Confiance **moyenne** sur l'unité, **élevée** sur la mesure.

### Correction de méthode 2 — un onset mal daté

La première passe utilisait `onset_detect(backtrack=True)`, qui déplace chaque attaque
vers le minimum d'énergie précédent. Résultat : 30 à 65 ms de « microtiming » qui
n'étaient qu'un artefact de mesure. En `backtrack=False`, l'Énergétique passe de 37 ms à
**17,8 ms** de dispersion. Les chiffres de la présente section sont tous mesurés sans
backtrack.

### Groove : une percussion continue, pas un motif

| Mesure | Valeur | Lecture |
|---|---|---|
| Attaques détectées (bande 35–160 Hz) | 811 en 205,6 s, soit **4,03/s** | roulement continu |
| Histogramme de phase (12 cases/temps) | **7–10 % dans chaque case** | aucune position privilégiée : le pouls n'est pas discrètement articulé |
| Similarité entre mesures adjacentes (grille 6 pas) | **0,955** | groove quasi invariant |
| Motifs distincts | 10 sur 83 mesures | pas de variation de motif |
| Microtiming | 66 ms médians, 17 % à ±20 ms | la notion ne s'applique pas à un roulement |

**Conséquence musicale :** la signature de cet univers est la **continuité** de la peau,
pas une cellule rythmique. Un moteur qui programme un kick-snare de 4 temps produira un
sega de bal, pas Tififi.

### Dynamique par section (ffmpeg ebur128, par section)

Mesurée séparément sur le stem percussif et sur le mix — deux informations différentes :
le stem montre les décisions d'arrangement, le mix montre ce que l'auditeur entend.

| Section | Mix LUFS | Mix true peak | Stem percussif LUFS |
|---|---|---|---|
| mesures 1–9 (intro voix) | −13,7 | −0,2 dBTP | −21,8 (percussion absente) |
| 10–12 | −12,2 | −0,1 | −22,1 |
| 13–14 | −11,4 | 0,0 | −18,8 |
| 15–22 (plateau) | −11,0 à −12,2 | 0,0 à +0,1 | −16,0 |
| 79–88 (fin + silence) | jusqu'à **−27,9** | — | jusqu'à −33,3 |

- **Plage du mix : 18,6 LU**, dont l'essentiel est le silence final et l'intro douce.
  À l'intérieur du plateau, la variation est inférieure à 1,5 LU : l'énergie ne bouge
  presque pas pendant 110 secondes.
- **True peak maximal : +0,6 dBTP** sur le mix. Le master de référence dépasse 0 dBTP en
  inter-échantillons : c'est un défaut de mastering de la référence, pas un objectif à
  reproduire. Le moteur visera −1,0 dBTP.
