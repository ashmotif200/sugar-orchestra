# Muséomix 2026 — ce qui a été présenté

Ce document existe pour qu'on ne confonde pas trois choses : le prototype **présenté**
pendant l'événement, la **démonstration en ligne** publiée depuis, et le **projet
complet** envisagé mais non réalisé.

---

## 1. Le jalon Git

| | |
|---|---|
| Étiquette | `museomix-2026` |
| Commit | `38f8490` |
| Date | **14 novembre 2026, 10:54:51 UTC** |
| Message | « Carnet : chargement du buffer avant préécoute (preview échouait en "son non chargé" hors fiche) » |

Pour l'obtenir :

```bash
git checkout museomix-2026
```

### 1.1 La limite, dite franchement

**Aucune étiquette n'a été posée pendant l'événement.** Le dépôt n'a été mis en place
qu'après, le 16 novembre 2026. L'étiquette `museomix-2026` est donc une
**reconstruction** : elle pointe le dernier commit de la période de l'événement, et
non un état enregistré sur place.

Ce que cela garantit : c'est bien le code de la veille de l'archivage, avec sa date de
commit d'origine, intact.

Ce que cela ne garantit pas : que rien n'ait été modifié après la présentation et avant
l'arrêt du travail. Trois indices rendent cette hypothèse solide — mais ce sont des
indices, pas une preuve :

1. tous les commits de la démonstration sont datés du 14 novembre, entre 06:21 et
   10:54 UTC, et aucun fichier du prototype n'a d'horodatage postérieur dans
   l'atelier ;
2. le dernier commit est un correctif de confort (préécoute du carnet), du type de
   ceux qu'on fait juste avant de présenter ;
3. les fichiers `data/admin/` (base, publications) portent des dates cohérentes avec
   cette période.

Si l'exactitude au commit près importe pour une raison précise, la seule manière de
trancher est de recueillir le témoignage de l'équipe sur ce qui tournait pendant la
présentation.

### 1.2 Ce que contient ce jalon

- démonstration v0.1.1 : **8 samples de 5 s**, morceau final de Martin en AAC pour
  Safari iOS, repli WAV ;
- **8 postes QR** (`#/poste/N`), collecte automatique, scanner `jsQR` ;
- **carnet** avec lecteur partagé (play, pause, reprise réelle, forme d'onde
  synchronisée) ;
- 4 cartes de mascottes, dont 3 en « Bientôt » ;
- moteur V1 et moteurs expérimentaux V2.0 / V2.1 **présents mais hors du parcours** ;
- Super Admin : SQLite, API REST, chaîne éditoriale, laboratoires de rendu.

## 2. Les trois états du projet

### 2.1 Le prototype présenté (14 novembre 2026)

Ce qui tournait à L'Aventure du Sucre.

| | |
|---|---|
| Hébergement | un serveur de développement/aperçu sur un poste, exposé en HTTPS par un tunnel, plus un accès réseau local pour les téléphones |
| Adresse des QR | une adresse d'atelier, non publique |
| Morceau final | précomposé, joué tel quel |
| Sons écoutables | les 8 samples |
| Univers | Martin seulement |
| Administration | opérationnelle, sur la boucle locale du poste |
| Validation | parcours, carnet et lecture vérifiés en navigateur ; **caméra d'iPhone non testée** |

### 2.2 La démonstration en ligne (16 novembre 2026)

<https://ashmotif200.github.io/sugar-orchestra/>

Ce qui a changé, et pourquoi.

| Changement | Raison |
|---|---|
| Hébergement statique (GitHub Pages) | rendre la démonstration accessible sans le poste de travail |
| **Aucun appel `/api`** | il n'y a plus de serveur : l'état de publication et le contenu éditorial viennent d'instantanés embarqués |
| **Administration retirée** | `#/admin` renvoie à l'accueil ; l'authentifier demanderait un serveur |
| **QR régénérés** | ils encodaient l'adresse d'atelier ; ils encodent maintenant l'adresse publique |
| **32 sons du catalogue retirés du dépôt** | leurs droits de redistribution ne sont pas établis |
| 8 samples + morceau final **publiés** | demandés explicitement par le propriétaire du projet |
| Seuls les sons publiés sont téléchargés | une étape tirait aussi l'audio des sons en brouillon, absent du site |
| Textes d'atelier réécrits | adresses IP, ports et chemins propres au poste retirés |
| Documentation complète | rendre le projet transmissible |

Ce qui **n'a pas** changé : le parcours, les 8 postes, le carnet, le morceau final, le
moteur, les mascottes, les limites.

### 2.3 Le projet complet envisagé (non réalisé)

Ce que le projet visait, et qui reste à faire.

| Objectif | État | Blocage |
|---|---|---|
| Composition réelle à partir des sons collectés | non abouti | la matière sonore ne porte pas d'harmonie (0/40 sons utilisables en basse) ; les essais n'ont pas convaincu à l'écoute |
| Quatre univers musicaux | 1 sur 4 | trois univers sans moteur ; le quatrième (Rêveur) n'a même pas de référence mesurée |
| Textes historiques validés par le musée | absents | non fournis ; l'application n'invente rien |
| Catalogue complet de 40 sons accessible | 8 sur 40 | droits de redistribution non établis |
| Application installable, hors-ligne | non | pas de service worker |
| Parcours multi-visiteurs, comptes, partage | non | hors périmètre du prototype |
| Accompagnements musicaux précomposés | décidé, non produit | la décision du 13/11/2026 autorise la musique précomposée ; seul un morceau étalon a été produit |

Le document `docs/ROADMAP.md` détaille les étapes suivantes.

## 3. Chronologie du projet

Les dates sont celles des commits, en UTC.

| Date | Ce qui s'est passé |
|---|---|
| 13 nov., matin | prototype V1 : catalogue de 40 sons, 7 étapes, moteur de composition dans le navigateur, deux univers |
| 13 nov., après-midi | analyses musicales des références (tempo, métrique, harmonie, motifs) ; constat que le corpus ne peut pas porter de basse |
| 13 nov., soir | moteurs V2.0 puis V2.1 (motifs, basse hybride, rendu serveur) ; Super Admin |
| 14 nov., 06 h–07 h | cartes de mascottes, puis correction de leur taille après refus de la première version |
| 14 nov., 08 h | **bascule en mode démonstration** : publication comme source unique, 8 sons actifs, morceau précomposé |
| 14 nov., 08 h 42 | 8 samples de 5 s et morceau final intégrés ; 8 postes QR générés et vérifiés |
| 14 nov., 10 h | scanner `jsQR` (Safari iOS), diffusion AAC pour iOS, lecteur du carnet |
| 14 nov., 10 h 54 | **dernier commit de la période — étiquette `museomix-2026`** |
| 16 nov. | archivage : sauvegarde vérifiée, documentation, dépôt public, démonstration GitHub Pages |

## 4. Ce que le projet a appris

Trois constats qui valent plus que le prototype lui-même, et qui sont documentés en
détail dans `docs/music-engine-v2/` et `docs/strategie/` :

1. **Un corpus de bruits ne fait pas de la musique.** Quarante sons de musée, dont
   aucun utilisable comme basse et cinq seulement porteurs d'une hauteur crédible, ne
   peuvent pas fonder une harmonie. Ce n'est pas un défaut de réglage : c'est une
   propriété de la matière.
2. **Des tests verts peuvent coexister avec une absence totale de musique.** Vingt-deux
   contrôles passaient pendant que le moteur ne produisait pas une seule note avec une
   hauteur. Il faut compter le contenu musical dans l'artefact produit, pas seulement
   vérifier des invariants.
3. **Un morceau écrit à la main est un meilleur étalon qu'un paramétrage.** Rien ne
   s'automatise avant qu'un résultat produit manuellement convainque — c'est la méthode
   retenue à la fin du projet.

## 5. Remerciements

L'Aventure du Sucre, Pamplemousses, Maurice. L'équipe de médiation du musée. Martin,
pour le morceau. Les bibliothèques sonores libres qui ont fourni la matière
(SoundBible, Freesound, BigSoundBank) et leurs auteurs, crédités son par son dans le
catalogue.
