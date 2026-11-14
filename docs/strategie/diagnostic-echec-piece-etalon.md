# Diagnostic — pourquoi la pièce étalon a échoué

**Verdict reçu :** les trois compositions Electro Sega (A, B, C) ne sont pas validées. Ce document
cherche la cause, pas une excuse. Aucune nouvelle composition n'a été produite.

---

## 1. Les défauts, mesurés dans mon propre travail

J'ai instrumenté la partition et les stems. Ces chiffres ne sont pas des jugements d'écoute : ce sont
des propriétés de ce que j'ai écrit.

| Constat | Mesure | Ce que ça signifie |
|---|---|---|
| **Un seul motif de batterie** | 18 mesures renseignées → **1 motif distinct** | la batterie joue la même chose pendant 32 secondes |
| **Une seule cellule de basse** | 18 mesures → 8 variantes, toutes de même rythme (3 frappes) ; seules les hauteurs changent | la basse ne dialogue pas, elle répète |
| **Microtiming nul** | écart-type 3,3 ms sur la grosse caisse = biais du détecteur, pas du jeu ; chaque frappe est posée exactement sur `pas × STEP` dans le code | aucune respiration, aucun swing réel malgré l'étiquette « ternaire » |
| **Dynamique nulle** | les gains par rôle sont des constantes ; aucune vélocité par note | toutes les frappes ont la même force |
| **Mélodie de 4 mesures, exposée 2 fois à l'identique** | 16 notes, 8 hauteurs, intervalles [0,4,3] | pas de développement, pas de variation de phrase |
| **Harmonie statique** | 5 accords, 1 par mesure (1,78 s) | aucune respiration harmonique, aucune tension |
| **Timbres fixes** | même enveloppe à chaque frappe, aucun mouvement de filtre | l'instrument ne « joue » pas, il déclenche |

### Ce que ces défauts ne sont pas

Ce ne sont **pas** des défauts de mastering, de niveau ou de rendu. Le true peak est à −1,2 dBTP, les
LUFS sont cohérents, la forme est correcte (intro −28 dB, break −20,7, retour −15,7). Techniquement,
c'est propre. Musicalement, c'est un métronome avec des accords.

### Ce que je ne peux pas affirmer

Je n'ai pas écouté les fichiers et je ne peux pas le faire. Je ne sais donc pas *comment* ça sonne mal
— seulement que la partition ne contient presque rien de ce qui fait qu'un morceau tient debout :
pas de dynamique, pas de variation, pas de développement, pas de jeu.

---

## 2. La cause réelle : j'ai reproduit l'échec de V2.1 à un autre niveau

V2.1 plaçait des **événements** sur une grille. Ma pièce étalon place des **notes** sur une grille.
Entre les deux, j'ai changé d'outil, pas de nature : dans les deux cas, un programme décide *où* et
*quoi*, sans jamais décider *comment*.

La musique ne vit pas dans les notes, elle vit dans l'exécution : la dynamique entre les frappes, le
microtiming qui fait respirer un groove, le legato et l'articulation, les phrasés qui montent et
retombent, les timbres qui évoluent, les remplissages qui annoncent une transition. Rien de tout cela
n'est présent, parce que **rien dans ma chaîne ne sait le produire ni le juger** :

- ma synthèse produit des sons corrects mais **sans expression** — une enveloppe fixe n'est pas un instrument ;
- j'écris **sans entendre**, donc je corrige ce que je peux mesurer, et la musicalité n'est pas mesurable ainsi ;
- mes références ont été **analysées**, jamais imitées : je connais le tempo et la densité d'Ohwalawa, je ne sais pas ce que fait son batteur entre deux temps.

C'est la réponse honnête à la question posée : deux échecs successifs ne sont pas deux accidents, c'est
la même limite atteinte par deux chemins différents.

---

## 3. Limites réelles des outils dont je dispose

| Capacité | État réel | Conséquence |
|---|---|---|
| Génération MIDI par script | possible, précise, **inerte** | notes justes, aucune expression |
| Synthèse audio programmée | timbres crédibles en contexte rythmique, **bornés** | pas de banque d'instruments, pas d'articulations, pas de legato réel |
| Échantillons du musée | 40 ambiances de 20 s, 0 basse, 5 hauteurs crédibles | ne peuvent pas porter l'harmonie |
| Instruments virtuels | **absents** (aucun VST, aucun échantillonneur) | pas de piano, pas de guitare, pas de cuivres |
| Environnement DAW | **absent** — pas d'interface graphique, pas de monitoring | impossible de sculpter un son en l'écoutant |
| Retour d'écoute | **aucun** pendant la composition | j'avance à l'aveugle, je ne peux corriger que le mesurable |
| Références analysées | tempo, densité, sections | ne transmettent ni le jeu, ni l'intention |

**Réponse directe : non, Hermes ne peut pas produire seul une musique convaincante dans ces
conditions.** Il peut produire une structure, une harmonie correcte, un arrangement, une intégration de
samples, un rendu fiable et déterministe. Il ne peut pas produire une *interprétation* — et c'est
l'interprétation qui manque.

---

## 4. Ce qui peut être conservé

- **La forme et la grille** de la pièce étalon : 24 mesures, intro / A / thème / break / retour / outro,
  Fa–Lam–Sib–Do. C'est un squelette valide, réutilisable tel quel.
- **La chaîne de rendu** : stems, WAV, vérification, déterminisme, archive de livraison.
- **L'analyse des capacités** des sons du musée : elle dit ce qu'ils peuvent et ne peuvent pas faire.
- **L'idée d'un étalon humain** avant automatisation — confortée par cet échec.
- La documentation de livraison, le laboratoire d'écoute, la comparaison A/B.

## 5. Ce qui doit être abandonné

- **La composition par script** comme méthode de production musicale. Elle peut produire un schéma,
  jamais une pièce.
- **L'idée qu'ajouter des paramètres** (plus de motifs, plus de variations, plus de timbres) corrigera
  l'absence de jeu. Le problème n'est pas la variété, c'est l'exécution.
- **La synthèse additive maison** comme source d'instruments mélodiques.
- **L'étiquette « ternaire » sans swing réel** : une grille de 12 pas n'est pas un groove.
- Les mesures de qualité (LUFS, densité, événements) présentées comme des indicateurs artistiques.

---

## 6. Les trois alternatives

### A — Production dans un DAW par un musicien

Un musicien (ou vous) compose et produit les accompagnements dans un vrai environnement : instruments
virtuels, groove joué ou programmé avec feel, mixage. Hermes conserve la préparation des samples,
l'adaptation, la personnalisation, le rendu et l'intégration.

- **Qualité** : élevée et prévisible — c'est le seul chemin qui apporte l'interprétation.
- **Personnalisation** : préservée, si l'étalon est livré en **stems** avec des blocs de variation.
- **Droits** : simples — la musique est créée pour le projet, ou sous licence explicite.
- **Coût** : 1 à 3 jours de musicien par univers ; un DAW (Reaper ≈ 60 €, ou Logic/Ableton) ; des
  instruments virtuels, dont beaucoup sont gratuits (LABS, Surge XT, Decent Sampler).
- **Risque** : dépend d'une compétence humaine — c'est précisément ce qui manque aujourd'hui.

### B — Compositions existantes sous licence

Utiliser des morceaux ou stems déjà produits, avec des droits adaptés.

- **Qualité** : immédiate.
- **Personnalisation** : faible à nulle — tous les visiteurs entendent la même base ; les sons du musée
  deviennent un habillage. C'est exactement ce que le cadrage refuse.
- **Droits** : le point dur. Une licence de bibliothèque autorise généralement la diffusion d'une œuvre
  finie, pas la redistribution de stems ni la génération de mixes dérivés par un utilisateur final.
  Il faudrait une licence sur mesure, ce qui est plus long et plus cher qu'une commande.
- **Verdict** : rapide, mais contredit le concept.

### C — Génération assistée par IA

- **Qualité** : prometteuse sur des genres bien représentés ; l'Electro Sega mauricien n'en fait pas partie.
- **Contrôle** : faible sur la structure, très faible sur l'imposition d'un timbre de sample précis.
  Les modèles produisent un mélange, pas des stems obéissants.
- **Matériel** : GPU absent ; les modèles lourds sont différés sur Mac Studio.
- **Droits** : **à vérifier cas par cas, et c'est bloquant pour un musée.** Les codes et les poids n'ont
  pas la même licence ; plusieurs modèles ouverts sont sous licence **non commerciale**, d'autres sous
  licence communautaire avec un seuil de revenus. Je n'ai pas pu vérifier ces points aujourd'hui (le
  service de recherche est indisponible) : à faire avant toute décision.
- **Verdict** : à explorer plus tard, sur Mac Studio, avec un test de droits préalable. Pas la solution
  de la prochaine étape.

---

## 7. Recommandation

**A — un musicien produit les accompagnements dans un DAW ; Hermes devient l'adaptateur.**

Trois raisons, dans l'ordre :

1. **C'est la seule option qui apporte ce qui manque** : l'interprétation. Ni B ni C ne la donnent de
   façon contrôlable.
2. **Elle préserve le concept** : si le musicien livre des stems par couche et des blocs de variation,
   la personnalisation reste réelle — le visiteur choisit un trajet dans un matériau joué.
3. **Elle réduit le risque** : elle ne demande aucun développement nouveau. L'adaptation d'un stem vers
   les sons choisis est un problème d'affectation et de transformation, que je sais traiter.

La répartition proposée : le musicien fournit le **jeu** (batterie, basse, accords, thème, mix) ;
Hermes fournit l'**adaptation** (quels sons du musée remplacent quelle couche, transformations,
déclenchements, personnalisation, rendu). Personne ne fait le travail de l'autre.

---

## 8. Ressources nécessaires

| Ressource | Détail | Coût |
|---|---|---|
| Musicien / producteur | 1 à 3 jours pour l'Electro Sega : 24–32 mesures, stems séparés, 2–3 blocs de variation | à budgéter |
| DAW | Reaper (≈ 60 €), ou Logic/Ableton si déjà disponible | 0–300 € |
| Instruments virtuels | LABS, Surge XT, Decent Sampler (gratuits) ; une batterie acoustique et une basse correctes | 0–200 € |
| Retour d'écoute | vous, plus une oreille musicale, sur chaque étape | — |
| Matériel | n'importe quel ordinateur portable pour le DAW ; pas de GPU | 0 € |

Ce qui n'est **pas** nécessaire : nouveau moteur, nouvelle analyse, nouveau modèle, nouvelle version.

---

## 9. Le plus petit test pour valider la direction

Il ne doit pas coûter des jours. **Une boucle de 8 mesures, trois écoutes, une décision.**

1. Un musicien produit **8 mesures** d'Electro Sega dans un DAW — batterie, basse, accords — soit
   environ 15 secondes. Pas une pièce : une boucle.
2. Je produis la **même boucle** avec mes moyens actuels (synthèse par script), pour comparaison.
3. Je remplace la couche percussions de la version musicien par les sons du musée, et je rends le
   résultat.

Puis vous écoutez, dans cet ordre : ma boucle, la boucle du musicien, la boucle du musicien avec les
sons du musée.

**Décision :**

- Si la boucle du musicien est **nettement** meilleure que la mienne → l'hypothèse « il manque
  l'interprétation » est confirmée, on engage la production complète avec lui.
- Si elle n'est **pas** nettement meilleure → mon diagnostic est faux, et il faut chercher ailleurs
  (arrangement, choix esthétique, références) avant de dépenser un euro de plus.

Ce test coûte une demi-journée de musicien et une heure de ma part. Il tranche la question qui a coûté
six mois.

### Ce que ce test ne prouve pas

Il ne prouve pas que le résultat final plaira aux visiteurs, ni que la personnalisation sera
satisfaisante. Il prouve seulement une chose, mais c'est la bonne : **est-ce que l'interprétation est
bien ce qui manque ?**

---

## 10. Réponses aux trois questions de la mission

**1. Pourquoi les méthodes employées échouent-elles ?**
Parce qu'elles produisent des partitions, pas des interprétations. Mesures à l'appui : un seul motif de
batterie sur 18 mesures, une seule cellule de basse, zéro dynamique, zéro microtiming, une mélodie de
16 notes exposée deux fois à l'identique. Les deux échecs (V2.1 et pièce étalon) ont la même cause, à
deux niveaux d'outillage différents.

**2. Quelle méthode offre les meilleures chances ?**
Un musicien produit les accompagnements dans un DAW et livre des stems ; Hermes adapte, personnalise et
rend. C'est la seule combinaison qui apporte l'interprétation tout en gardant la personnalisation.

**3. Comment vérifier vite ?**
Huit mesures, deux versions (musicien / script), un remplacement de couche par les sons du musée, trois
écoutes. Une demi-journée. Si l'écart n'est pas flagrant, le diagnostic est faux et il faut le réviser
avant tout engagement.
