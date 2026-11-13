# Pièce étalon — plan de production manuelle

**Univers : Énergétique / Electro Sega. Durée : 24 mesures = 42,7 s.**
Objet : servir d'étalon artistique avant toute automatisation (étape 2 du cadrage).
Ce document est un **plan**, pas du code : il décrit ce qu'un musicien (ou moi, sur votre accord)
doit produire à la main.

---

## 1. Paramètres musicaux

| Paramètre | Valeur | Source |
|---|---|---|
| Tempo | **135 BPM** | mesuré sur Ohwalawa (accord entre ajustement de grille et tempogramme) |
| Mesure | 4/4, **subdivision ternaire**, swing ≈ 0,67 | mesuré : triolets, décalage 17,8 ms |
| Durée de mesure | 1,778 s | découle du tempo |
| Nombre de mesures | **24** (42,7 s) | cible 30–60 s du cadrage |
| Tonalité | **Fa majeur**, pédale de fa | mesuré sur la référence (corrélation 0,74) |
| Hiérarchie | percussion devant, basse discrète | mesuré : percussions 8 dB au-dessus de la basse |

**Choix de composition assumé :** la référence tient une pédale de fa. Une pièce de 43 s sur une seule
pédale est monotone ; j'introduis donc un mouvement d'accords **explicite**, déclaré comme choix et non
comme transcription. C'est exactement la distinction que le cadrage exige (P4).

## 2. Grille d'accords

| Mesures | Section | Accords (1 par mesure) |
|---|---|---|
| 1–2 | Intro | Fa (pédale, sans percussion) |
| 3–10 | A | Fa · Lam · Sib · Do · Fa · Lam · Sib · Do |
| 11–16 | B | Fa · Rém · Sib · Do · Sib · Do |
| 17–18 | Break | Sib (accord tenu, percussions retirées) |
| 19–22 | A' | Fa · Lam · Sib · Do |
| 23–24 | Outro | Fa · Fa |

## 3. Ligne de basse (écrite, pas une pédale)

Motif ternaire de 12 pas, frappes aux pas **0, 6 et 9** — c'est la cellule dominante mesurée sur la
référence (`x.....x....x`), donc un matériau issu de l'analyse, pas une invention.

| Pas | 0 | 6 | 9 |
|---|---|---|---|
| Note | fondamentale | quinte | octave |

Sur chaque accord, la basse joue : fondamentale (pas 0), quinte (pas 6), octave (pas 9), puis
fondamentale de l'accord suivant. Registre **Fa1–Fa2** (43,7–87,3 Hz), jamais au-dessus de Do3.
Timbre : *Percussive* (attaque 4 ms, decay 90 ms) sur A, *Warm* sur B et le break — le contraste de
timbre est l'un des leviers de personnalisation.

## 4. Rôles des sons du musée (dix sons)

Sélection fondée sur la matrice de capacités mesurée. Aucun de ces sons ne peut porter d'accord : ils
sont ** percussion, accent, texture, transition ou signature**.

| Son | Nom | Rôle musical | Fréquence d'apparition |
|---|---|---|---|
| `04_03` | Coupe-coupe dans le champ | **ostinato principal** — le motif qui rend l'Electro Sega reconnaissable | toutes les mesures de A et A' |
| `08_02` | Jus de canne | ostinato secondaire (couche de doubles croches) | A, B, A' |
| `06_04` | Charrette à bœufs | **grave percussif** — tient le rôle du kick | temps 1 de chaque mesure |
| `04_02` | Fers et chaînes | **accent de signature** — métal, rare, donc marquant | 3 fois : m.10, m.16, m.24 |
| `01_03` | Bateau fendant l'eau | transition / montée (filtre qui s'ouvre) | m.2, m.16, m.18 |
| `07_02` | Électricité | **hook mélodique** — seul son à hauteur crédible (100 Hz) | B et A', une phrase de 4 notes |
| `04_09` | Cuillère sur fer blanc | contre-chant aigu, réponse au hook | B, en alternance avec `07_02` |
| `04_07` | Sucre — sibilance | texture de fond (souffle) | intro, break, outro |
| `05_01` | Canne qui pousse | texture d'intro | intro |
| `01_01` | Volcan | sub / grondement sous le break | break uniquement |

**Règles d'usage** — c'est là que se joue la différence entre musique et bruit :
- un son n'est **jamais** déclenché à chaque mesure s'il n'a pas de fonction rythmique ;
- `04_02` (métal) apparaît **trois fois** dans la pièce : sa rareté fait son effet ;
- `07_02` et `04_09` ne jouent **jamais ensemble** : ils se répondent ;
- au moins un silence réel : dernier temps de la mesure 18, tout s'arrête ;

## 5. Forme et intentions

| Section | Mesures | Intention musicale |
|---|---|---|
| Intro | 1–2 | On entend le lieu avant la musique : texture + un accent lointain (m.2). Aucune percussion. |
| A | 3–10 | Le groove s'installe en **deux temps** : charrette + coupe-coupe d'abord (m.3–4), jus de canne ensuite (m.5). La basse entre m.5, pas avant. |
| B | 11–16 | **Le hook arrive** (`07_02`), la basse change de couleur (warm), l'accord devient Rém : c'est le moment où l'on reconnaît un thème. |
| Break | 17–18 | Chute d'énergie : percussions retirées, accord tenu, volcan dessous. Le silence de la m.18 rend le retour puissant. |
| A' | 19–22 | Retour du groove **avec** le hook : la section A modifiée, pas répétée. |
| Outro | 23–24 | Tout tombe sauf basse et texture ; l'accent métal conclut. Fin nette, pas un fondu. |

## 6. Personnalisation (à démontrer dès l'étalon)

Trois leviers, tous **audibles** :

1. **Instrumentation** : quel ostinato secondaire (`08_02`, `03_04` ou `02_04`) ;
2. **Hook** : `07_02` (grave, cuivré) ou `04_09` (aigu, métallique) — change le caractère sans changer la musique ;
3. **Ordre** : A-B-A' (forme standard) ou A-A'-B (construction) ou B-A-A' (commencer par le thème).

La deuxième collection de l'étape 3 du cadrage teste exactement ces trois leviers.

## 7. Critères de réussite (écoute, pas mesure)

1. On entend une **composition**, pas une suite de bruitages.
2. Le groove est identifiable dès la mesure 5.
3. Le hook de la section B se retient après une écoute.
4. Les sons du musée sont reconnaissables **et** à leur place.
5. Le break crée un manque, le retour le comble.
6. La fin conclut.
7. Deux collections différentes donnent deux morceaux différents, tous deux musicaux.

**Si les points 1 à 3 échouent, on arrête : aucun adaptateur ne les sauvera.**

## 8. Ce qu'il faut pour produire cette pièce

- 1 DAW (ou un assemblage que je produis ici, sur votre accord) ;
- les 10 sons, dont les originaux WAV non modifiés ;
- la basse synthétique existante, si son timbre convient — sinon une basse échantillonnée ;
- **2 à 3 jours** de travail musical, contre 6 mois de moteur.

## 9. Ce que ce plan ne dit pas

Il ne dit pas si le résultat sera bon. C'est précisément le point : **c'est l'écoute qui tranchera**, et
elle coûte deux jours, pas un trimestre. Le plan sert seulement à ce que cette écoute porte sur une
intention musicale et non sur une page blanche.
