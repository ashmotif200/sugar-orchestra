# Sugar Orchestra — réévaluation musicale et changement de stratégie

**Statut : proposition. Aucun code de moteur n'a été modifié pour produire ce document.**
Base : commit `9390397` (V2.1.1). Document demandé : `Sugar_Orchestra_Etat_des_lieux_et_problematiques.md`
— **absent du disque**, voir note en fin de document. Ce travail s'appuie donc sur le brief de mission,
sur une inspection du code et sur des mesures réelles des plans livrés.

---

## A. Diagnostic

### A.1 Ce que le code démontre (mesuré, pas supposé)

J'ai instrumenté les six plans de démonstration V2.1 livrés. Résultat sans ambiguïté :

| Démos V2.1 | Événements | **Notes tonales** | Hauteurs distinctes | Durée médiane d'une note |
|---|---|---|---|---|
| Énergétique + basse | 135 | **0** | 0 | 0,12 s |
| Énergétique sans basse | 163 | **0** | 0 | 0,12 s |
| Détendu + basse | 93 | **0** | 0 | 0,15 s |
| Détendu sans basse | 95 | **0** | 0 | 0,15 s |
| Dansant | 220 | **0** | 0 | 0,11 s |
| Rêveur | 15 | **0** | 0 | 4,00 s (textures) |

**Zéro note tonale sur les six démonstrations.** Pas une seule note de mélodie, pas un seul accord.
Ce que le moteur produit est : une cellule de percussion répétée, des nappes, et une basse. Une
partition sans hauteurs n'est pas de la musique harmonique — c'est un groove et un bourdon.

### A.2 Trois défauts de code, précis et corrigeables

**D1 — La mélodie est supprimée en silence.**
Les deux seuls sons à hauteur crédible du catalogue sont `04_09` (722,5 Hz) et `07_02` (100,2 Hz).
Ils sont bien affectés au rôle `melody`. Mais le planificateur vise une racine harmonique à MIDI 65
(Fa4, héritée du profil) alors que l'ancre réelle de `07_02` est MIDI ≈ 43. L'écart est de 22 à 31
demi-tons, très au-delà du budget de transposition de ±7. Chaque tentative est donc rejetée — **sans
émettre de limite, sans fallback, sans trace**. Les 2 notes estampillées « mélodie » dans les plans
sont des notes de couverture ajoutées avec `writtenMidi: null`. Le rôle existe dans le type, il est
vide à l'exécution.

**D2 — La basse est une pédale d'une seule note.**
`bassNotes` de la démo Énergétique : **MIDI 45, quarante-neuf fois**. Le registre est borné à
`[33, 45]`, tandis que la fondamentale calculée vaut 53, 60 ou 65 selon le mouvement. Toutes les
valeurs sont donc écrêtées au plafond : 45. Ce n'est pas une ligne de basse, c'est une note tenue
répétée. Le contrôleur harmonique annonce pourtant « pédale du profil » — il n'a jamais l'occasion
de faire entendre autre chose.

**D3 — La répétition est littérale.**
Deux motifs seulement, dont un couvre **12 mesures sur 20** ; sur 15 variations, **13 sont de type
`keep`**. La courbe d'énergie est plate (0,43–0,49 dès la quatrième mesure). Le moteur sait placer,
il ne sait pas développer.

### A.3 La cause de fond

Nous avons confondu **séquencement d'attaques** et **composition**. Tout ce que le code sait faire est
de décider : *quel son, à quelle position de grille, avec quel gain, quel panoramique, quel taux de
lecture*. Ces quatre décisions produisent un collage rythmiquement organisé, pas une phrase musicale.

La musique exige au minimum : une organisation des **hauteurs** dans le temps (mélodie, harmonie,
conduite de voix), une **phrase** (début, respiration, fin), une **tension et une résolution**, et une
**forme** qui se souvienne de ce qu'elle a déjà joué. Aucune de ces quatre choses n'existe dans le
code. Les profils décrivent des enveloppes statistiques ; ils ne contiennent pas une note.

### A.4 Le matériau ne peut pas porter l'harmonie

Mesures Phase A3, inchangées : **0 son sur 40** n'est `bass_capable`, **5 sur 40** ont une hauteur
crédible. Les enregistrements sont des ambiances de terrain de 20 s (volcan, forêt, bateau, pas sur le
sable). Même un moteur parfait ne peut pas construire une progression harmonique avec des bruits.

C'est la contrainte structurante de tout le projet, et elle n'a jamais été traitée : nous avons
demandé à des ambiances de jouer le rôle d'instruments.

### A.5 Ce qui reste des hypothèses (nécessite une écoute)

Je n'ai pas écouté les démonstrations et je ne prétends pas savoir *comment* elles sonnent. Restent
indémontrables sans oreille : la qualité du groove malgré un motif unique ; le rendu des nappes
(pouvant masquer la percussion) ; l'acceptabilité du timbre de basse synthétique ; la
reconnaissabilité des samples sous transformation. Ces points ne changent pas le diagnostic
structurel ci-dessus, mais ils doivent être entendus avant de choisir la suite.

---

## B. Inventaire : ce qui est réutilisable

| Composant | Verdict | Usage futur |
|---|---|---|
| Catalogue 40 sons + matrice de capacités mesurée | **réutiliser tel quel** | socle de vérité sur ce que chaque son peut faire |
| Renderer serveur (mélange, WAV, vérification LUFS/true peak) | **réutiliser** | inchangé, c'est de l'ingénierie solide |
| API, file bornée, sécurité, CSRF, publication | **réutiliser** | ne rien reconstruire |
| Super Admin + laboratoires + comparaison A/B + loudness matching | **réutiliser** | support d'écoute et de décision |
| Chaîne éditoriale (fiches, publication, application) | **réutiliser** | indépendant du moteur |
| Synthèse de basse (3 harmoniques, ADSR, filtre) | **réutiliser comme voix** | à condition de lui donner une vraie ligne |
| Analyses A3 (tempo, mètre, sections, dynamique) | **réutiliser comme contraintes** | bornes de tempo, densité, hiérarchie des couches |
| Cellules rythmiques / 399 motifs / variations | **réduire à des indices de densité** | ne portent aucune information musicale (ni hauteur, ni accent réel, ni phrase) |
| Rôle `melody` tel qu'implémenté | **supprimer ou réécrire** | aujourd'hui vide à l'exécution |
| Arrangement engine (sections proportionnelles fixes) | **remplacer** | une forme écrite vaut mieux qu'un ratio 14/16/… |
| Courbe d'énergie | **supprimer** | décorative, ne pilote rien d'audible |

**Ce qui bloque une vraie composition :** l'absence totale de modèle de hauteurs, et l'absence de
matériau mélodique/harmonique dans le catalogue. Aucun module existant ne peut être « amélioré »
pour combler cela : il faudrait l'inventer.

---

## C. Comparaison des quatre approches

| Critère | **A. Algorithmique pure** | **B. Arrangements préparés** | **C. Hybride** | **D. IA générative** |
|---|---|---|---|---|
| Plafond de qualité musicale | moyen à élevé, **seulement si** théorie musicale écrite sérieusement (conduite de voix, développement motivique) | **élevé** (la musique est composée par un humain) | **élevé** | très élevé en apparence, imprévisible |
| Effort pour un résultat écoutable | 3–6 mois de moteur, résultat incertain | **3–5 jours** | 5–8 jours | 2–4 semaines + matériel |
| Risque principal | reproduire ce qu'on vient de faire, en plus gros | uniformité entre visiteurs | complexité de l'adaptateur | non-déterminisme, licences, matériel absent |
| Personnalisation réelle | élevée en théorie | moyenne (instrumentation, blocs de variation) | **élevée et contrôlée** | faible (prompt), difficile à garantir |
| Intégration des sons du musée | native | à construire | **native** | faible : les modèles ne respectent pas un timbre imposé |
| Contrainte matérielle | CPU léger | aucune | légère | GPU / Mac Studio |
| Licences | aucune | **à vérifier** (MIDI/stems) | à vérifier sur la partie préparée | modèles à licence variable |
| Reproductibilité | parfaite | parfaite | parfaite | faible |
| Adéquation au calendrier Muséomix | mauvaise | **bonne** | bonne | mauvaise |

**Lecture honnête :** l'approche A est celle que nous avons suivie, et elle a échoué non par manque de
rigueur mais parce qu'écrire un compositeur est un métier. B est la plus rapide vers la musicalité mais
produit des morceaux interchangeables. D ne peut pas garantir l'intégration des sons du visiteur, et le
matériel n'est pas là. **C est le seul compromis qui tienne.**

---

## D. Recommandation

**Adopter C — hybride —, et déplacer l'intelligence musicale du code vers une partition écrite.**

Concrètement, trois couches nettes :

1. **Squelette musical préparé** (une fois, par un musicien) : 32 mesures d'Electro Sega en MIDI —
   batterie, ligne de basse, accords, mélodie, avec une intro, deux variations, un break, une
   conclusion. C'est là que vit le groove, l'harmonie et la phrase.
2. **Adaptateur** (le code, ~500 lignes) : projette ce squelette sur les sons choisis par le visiteur.
   Chaque piste MIDI devient un rôle ; chaque son reçoit la transformation nécessaire pour tenir sa
   partie, dans les limites mesurées par la matrice de capacités. C'est un problème d'affectation et de
   transposition, pas de composition — donc tractable.
3. **Personnalisation** : le visiteur influence des choix **audibles** — quels blocs de variation,
   quelles couches entrent et quand, quel timbre de basse, quel ordre de sections. La partition fournit
   le matériau ; le visiteur choisit le trajet.

**Pourquoi cette recommandation :** elle déplace le problème là où il est soluble. Composer demande un
compositeur ; adapter une composition à un matériau donné est de l'ingénierie. Le projet a du matériau
sonore pauvre en hauteurs : la seule façon d'avoir de la musique est d'apporter les hauteurs de
l'extérieur — ce que la basse synthétique fait déjà, en miniature.

**Ce que cette recommandation coûte :** un musicien (ou un MIDI libres de droits) pour un univers, et la
construction d'un adaptateur. Pas de nouvelle infrastructure : le rendu, l'API, le laboratoire et la
chaîne éditoriale restent.

**Ce qu'elle abandonne :** le mythe que l'analyse produirait de la musique. Les 399 motifs, les 3 330
événements, les courbes d'énergie : utiles comme contraintes de densité et de tempo, insuffisants comme
matériau de composition.

---

## E. Prototype minimal (un seul univers)

**Périmètre : Énergétique / Electro Sega, 30–60 s, rien d'autre.**

### Ressources nécessaires

- 1 squelette MIDI de 32 mesures (batterie, basse, accords, mélodie) — **à faire composer ou à sourcer** ;
- 8 à 12 sons du musée choisis parmi les plus exploitables ;
- l'infrastructure existante (rendu, API, labo) ;
- une oreille : celle du propriétaire.

### Étapes

1. Écrire le squelette MIDI et **le faire écouter seul**, avec un piano et une batterie générique. Si le
   squelette n'est pas musical à ce stade, aucun adaptateur ne le sauvera. C'est le point de décision
   le moins coûteux de tout le projet.
2. Construire l'adaptateur : mapping piste → son, transposition dans les bornes mesurées, gestion des
   sons non tonals (percussion, texture).
3. Régler la hiérarchie des couches sur les mesures A3 (percussion devant sur Énergétique, basse
   discrète, textures en retrait).
4. Produire trois variantes de personnalisation (blocs de variation différents, entrées de couches
   différentes) et vérifier qu'elles sont **audiblement** distinctes.
5. Écoute comparative A/B, grille en main.

### Critères de réussite (à l'écoute, pas au test)

1. Musicalité · 2. Groove · 3. Cohérence · 4. Arrangement · 5. Intégration des sons du musée ·
6. Reconnaissance des samples · 7. Identité stylistique · 8. Personnalisation audible ·
9. Envie de réécouter.

Critère d'arrêt explicite : **si le squelette seul (étape 1) ne convainc pas, on arrête avant d'écrire
l'adaptateur.** C'est le garde-fou qui manquait à toutes les phases précédentes.

### Métriques de sanité (nécessaires, jamais suffisantes)

Présence de contenu tonal (> 0 note avec hauteur), au moins 3 accords distincts, mélodie d'au moins
5 hauteurs différentes, blocs de variation discernables, true peak ≤ −1 dBTP. Ces chiffres disent
seulement que le morceau *contient* de la musique — pas qu'elle est bonne.

---

## F. Décisions ouvertes (arbitrage propriétaire)

1. **Autoriser une partition écrite** : acceptez-vous que la musique soit composée en amont plutôt
   qu'entièrement générée ? C'est la décision qui conditionne tout le reste.
2. **Qui compose** : musicien rémunéré, MIDI libres de droits, ou vous-même ?
3. **Droits** : les enregistrements de référence servent à comprendre le style, pas à être réutilisés.
   Confirmez-vous, et faut-il documenter une licence pour le squelette MIDI ?
4. **Degré de personnalisation** : le visiteur choisit-il seulement l'instrumentation, ou aussi l'ordre
   des sections et les variations ? (Recommandation : les deux, c'est ce qui rend le résultat « sien ».)
5. **Basse synthétique** : maintenir l'exception à l'exclusivité des sources muséales ?
6. **Rêveur** : quel contenu musical pour un univers sans référence ? Sans réponse, il restera vide.
7. **Durée cible** et **voix** : 30–60 s confirmé ? Une voix chantée est-elle envisageable (elle
   réglerait une partie du problème mélodique) ?
8. **Sort des 40 sons** : accepter que certains ne puissent jamais porter une mélodie — donc les
   assigner systématiquement à percussion/texture, sans le présenter comme un échec ?

---

## Note sur le document manquant

`Sugar_Orchestra_Etat_des_lieux_et_problematiques.md` n'existe ni dans `/workspace`, ni ailleurs sur le
disque (recherche par nom, insensible à la casse, sur tout le système). Si ce document contient des
éléments que le brief ne reprend pas — notamment des retours d'écoute du propriétaire, des contraintes
Muséomix chiffrées, ou des décisions déjà prises — ils manquent à cette analyse. Le fournir permettrait
de préciser les sections D et F.

## Ce que je propose explicitement d'arrêter

- Ajouter des modules au moteur actuel : il place des événements, il ne compose pas.
- Produire de nouvelles analyses statistiques : nous en avons assez pour connaître les références.
- Considérer un test vert comme une preuve de musicalité.
- Défendre l'architecture parce qu'elle est grande.
