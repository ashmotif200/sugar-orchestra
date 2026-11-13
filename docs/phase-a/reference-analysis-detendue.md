# Phase A3 — « Détendue » (Sega Jazz / Segazz) : analyse

> **STATUT : BLOQUÉ — aucun résultat.**
> Les quatre fichiers de cette référence ne sont pas présents sur Hermes
> (`Zistwar-drums.wav`, `Zistwar-bass.wav`, `Zistwar-other.wav`,
> `zistoire mix v0.wav`). Recherche exhaustive et journal détaillé :
> voir `reference-analysis-summary.md`, §2.
>
> Ce document n'est **pas** une analyse. C'est le cadre pré-enregistré dans
> lequel l'analyse sera écrite, avec ses critères d'acceptation fixés **avant**
> de voir les données — pour éviter d'ajuster l'interprétation aux résultats.

## 1. Ce que dira ce document quand les fichiers arriveront

Chaque section ci-dessous est vide pour une raison précise, indiquée entre
parenthèses : la mesure correspondante n'a pas d'entrée.

### 1.1 Vérification technique
*(vide : aucun fichier)*

Doit contenir : durée, taux d'échantillonnage, canaux, crête, RMS, LUFS intégré
des quatre fichiers ; décalage mesuré de chaque stem par rapport au mix ;
`sample_count_delta` ; corrélation somme-des-stems contre mix ; conclusion
« le mix est / n'est pas reconstructible ».

### 1.2 Rythme
*(vide : aucun fichier)*

Doit contenir : les 4 candidats de tempo du tempogram avec leur support relatif,
le BPM global librosa, le BPM du stem batterie seul, la grille de temps, l'IBI
moyen et son écart-type, la position médiane du contretemps (0,5 = binaire,
> 0,56 = swingué), la proportion de temps contenant un onset intermédiaire.

**Interdit par construction** : présenter le candidat le plus fort comme « le »
BPM. Si deux candidats sont à moins de 10 % de support, les deux sont retenus.

### 1.3 Basse
*(vide : aucun fichier)*

Doit contenir : onsets, hauteur estimée par onset, MIDI, séquence d'intervalles,
prévalence voisée, et la liste brute des intervalles — présentée comme matériau,
jamais comme transcription. Si la prévalence voisée est faible, le document dira
« l'estimateur n'est pas fiable ici » au lieu de proposer des notes.

### 1.4 Harmonie et mélodie
*(vide : aucun fichier)*

Doit contenir : profil de chroma, trois candidats de tonalité avec corrélations
Krumhansl, instants de nouveauté harmonique.
**Le stem « other » ne sera pas traité comme un instrument unique** : le brief le
prescrit, et la mesure le confirmera ou non (largeur spectrale, nombre de
composantes harmoniques simultanées).

### 1.5 Arrangement
*(vide : aucun fichier)*

Doit contenir : timeline par mesure (RMS, densité d'onsets) pour le mix, la
batterie et la basse ; entrées/sorties de couches ; candidats de frontières de
section ; structure de fin.
Chaque frontière sera étiquetée **mesurée** ou **à confirmer à l'écoute**.

### 1.6 Comparaison avec les autres univers
*(vide : les trois autres univers n'ont pas non plus de référence)*

Rappel : Détendue ne définit pas Énergétique, Dansant ni Rêveur.

## 2. Critères d'acceptation fixés d'avance

L'analyse de Détendue sera considérée comme exploitable si et seulement si :

1. les quatre fichiers proviennent du même export et l'alignement est prouvé
   (`sample_count_delta == 0` pour les trois stems, |décalage| ≤ 12 ms sur la
   batterie) ;
2. la reconstruction du mix depuis les stems donne une corrélation ≥ 0,98 ;
3. le tempo retenu est corroboré par **au moins deux** méthodes indépendantes
   (tempogram sur le mix et tempogram sur la batterie seule), à ±2 % ;
4. toute affirmation harmonique cite au moins deux candidats avec leurs
   corrélations, et la corrélation du premier dépasse 0,7 ;
5. toute affirmation rythmique fine (swing, microtiming) est étiquetée comme
   dépendante de la grille du tracker.

Si le point 1 ou 2 échoue, l'analyse sera publiée **avec** sa réserve, pas
corrigée par un recalage manuel silencieux.

## 3. Preuve que la méthode fonctionne

Le pipeline a été exécuté sur des stems synthétiques de vérité connue et a
retrouvé : 88,34 BPM (vrai : 88), swing 0,61 (vrai : 0,62), 8 mesures (vrai : 8),
notes de basse MIDI 38/50 (vraies : 38/50), tonalité ré mineur correcte,
reconstruction à 0,9999. Détail et limites mesurées :
`reference-analysis-summary.md` §3.

Ce qui est bloqué n'est donc pas la capacité de mesurer, c'est **l'entrée**.

## 4. Prochaine action

Déposer les quatre fichiers, puis exécuter la commande du §4 de
`reference-analysis-summary.md`. Le présent document sera alors réécrit avec les
mesures réelles — et non complété à partir d'hypothèses.
