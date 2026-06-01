# GOW2026 - Tron Light Cycles

Jeu 3D inspiré de Tron, développé avec **Babylon.js** et le moteur physique **Havok**.
Affronte un bot dans une arène : laisse une traînée lumineuse derrière toi et essaie de le faire crasher avant qu'il ne te coince.

## Aperçu

- Arène fermée avec murs, sol réfléchissant et skybox Tron.
- Une moto joueur et une moto bot, chacune laissant une *lightWall* derrière elle.
- IA du bot basée sur des **steering behaviors** : poursuite prédictive, évitement des murs, des autres motos et des traînées.
- HUD, plusieurs caméras (suivi joueur, libre, suivi bot), musique d'ambiance.

## Lien

Projet dispo a ce [lien](https://mc.claveille.fr/)

## Contrôles

| Touche | Action                      |
| ------ | --------------------------- |
| Z / S  | Avancer / Reculer           |
| Q / D  | Tourner gauche / droite     |
| Espace | Boost                       |
| C      | Changer de caméra          |
| ESC    | Libérer le pointeur souris |

## Structure

```
├── index.html
├── src/
│   ├── main.js     # Boucle de rendu, scène, caméras, inputs
│   ├── moto.js     # Création des motos + traînée lumineuse
│   ├── bot.js      # IA (steering behaviors)
│   └── hud.js      # Interface
├── assets/
│   ├── models/     # Modèles 3D (.glb)
│   ├── textures/   # Textures (sol, murs, skybox)
│   └── sounds/     # Musique
└── lib/babylon.max.js
```

## Technologies

- [Babylon.js](https://www.babylonjs.com/) — moteur de rendu 3D WebGL
- [Havok Physics](https://www.havok.com/) — moteur physique
