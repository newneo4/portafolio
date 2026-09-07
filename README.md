# Portfolio 3D

Portafolio interactivo en una escena 3D: un cuarto navegable donde un portátil abre un escritorio Ubuntu simulado (ventanas, dock y topbar) con el contenido curriculares.

## Stack

- [Three.js](https://threejs.org/) — escena 3D, luces, sombras y post-procesado.
- [GSAP](https://gsap.com/) — transiciones y animaciones de cámara.
- [Vite](https://vite.dev/) — bundler y servidor de desarrollo.
- Vanilla JS (sin frameworks).

## Comandos

```bash
npm run dev     # servidor de desarrollo
npm run build   # build de producción en dist/
npm run lint    # ESLint
npm run preview # previsualizar el build
```

## Estructura

- `src/main.js` — lógica principal: cámara, raycasting, estados (ROOM / ZOOMING / PORTFOLIO).
- `src/scene/room.js` — construcción del cuarto (paredes, suelo, ventana, silla).
- `src/scene/props.js` — props del escritorio y la habitación (PC, taza, papeleras, estantería, cama, pósters).
- `src/scene/door.js` — puerta de entrada y cartel de "Sobre mí".
- `index.html` — overlay del 3D: butones de salida/vista rápida, transición, hint.
- `public/portfolio.html` + `public/portfolio.css` — el "escritorio Ubuntu" embebido en un iframe.
- `public/data/portfolio.json` — datos del currículum (ventanas, proyectos, educación…).
- `public/icons/yaru/` — iconos del tema Ubuntu Yaru (ver abajo).
- `public/textures/` — fondos, pósters y texturas de la escena.
- `public/models/*.glb` — modelos 3D cargados por la escena.

## Iconos

Los iconos provienen del tema [Yaru](https://github.com/ubuntu/yaru) (CC BY-SA 4.0),
adaptados y reducidos para este proyecto. Ver `public/icons/yaru/README.md`.