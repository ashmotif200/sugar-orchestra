# Mascottes des univers

Déposer ici les quatre PNG officiels, **sans les renommer** :

| Fichier attendu | Mascotte | Univers | Ambiance |
|---|---|---|---|
| `Martin Rouge.png` (ou `martin-rouge.png`) | Martin | Electro Sega | Énergétique |
| `Mangouste Jaune.png` (ou `mangouste-jaune.png`) | Mangouste | Sega traditionnel | Dansant |
| `Dodo Vert.png` (ou `dodo-vert.png`) | Dodo | Segazz | Détendu |
| `Tortue bleu.png` (ou `tortue-bleu.png`) | Tortue | Ambient créole | Rêveur |

Les deux orthographes sont acceptées : le composant `MascotImage` essaie le nom
slugifié puis le nom d'origine, et retombe sur un visuel neutre si aucun fichier
n'est présent.

Contraintes respectées par l'interface : ratio 1:1 conservé, `object-fit: contain`,
aucun recadrage, aucun étirement, fonds d'origine conservés. Les images ne sont ni
retouchées ni recompressées ici : ce sont les fichiers source tels quels.
