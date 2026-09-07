import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { createRoom, interactChair } from './scene/room.js';
import { createProps, interactMug } from './scene/props.js';

// ─── RENDERER ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.getElementById('container').appendChild(renderer.domElement);

// ─── SCENE & CAMERA ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1e2420');
scene.fog = new THREE.FogExp2('#1e2420', 0.04);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);

// ─── POST-PROCESSING ─────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Camera starts directly inside the room, in front of the desk
const cam = { px: 0, py: 1.35, pz: -4.5, tx: -0.1, ty: 0.82, tz: -7.0 };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateCamera(t = 0) {
  // Sway / Breathing effect (desactivado con reduced-motion; muy sutil en otro caso)
  const swayX = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.008;
  const swayY = reducedMotion ? 0 : Math.cos(t * 0.5) * 0.006;
  camera.position.set(cam.px + swayX, cam.py + swayY, cam.pz);
  camera.lookAt(cam.tx, cam.ty, cam.tz);
}

// ─── LIGHTS ──────────────────────────────────────────────────────────────────
// Global ambient — sutil, solo para que las sombras no sean completamente negras
const ambient = new THREE.AmbientLight(0x2a3830, 3);
scene.add(ambient);

// Ceiling lamp – warm, reduced to avoid harsh highlights on props
const ceilingLight = new THREE.PointLight(0xffd09a, 35, 10, 2);
ceilingLight.position.set(0, 3.8, -5);
ceilingLight.castShadow = true;
ceilingLight.shadow.mapSize.set(512, 512);
scene.add(ceilingLight);

// Desk area warm fill – softer
const deskFill = new THREE.PointLight(0xffa040, 8, 4, 2);
deskFill.position.set(0.5, 2.0, -7.5);
scene.add(deskFill);

// (screen glow handled by the screen mesh emissive material, no extra light needed)

// ─── DOM REFERENCES ──────────────────────────────────────────────────────────
const loader = document.getElementById('loader');
const hint = document.getElementById('hint');
const crosshair = document.getElementById('crosshair');
const overlay = document.getElementById('portfolio-overlay');
const exitBtn = document.getElementById('exit-btn');
const transitionScreen = document.getElementById('transition-screen');
const quickViewBtn = document.getElementById('quick-view-btn');

// ─── LOADING MANAGER ───────────────────────────────────────────────────────────
const manager = new THREE.LoadingManager();
manager.onLoad = () => {
  // All models and textures loaded
  loader.style.opacity = '0';
  setTimeout(() => loader.style.display = 'none', 500);
  setHint('💻 Haz clic en la laptop para ver mi portafolio', 6000);
};

// ─── SCENE GEOMETRY ──────────────────────────────────────────────────────────
const room = createRoom(scene, manager);
// Se guarda el objeto completo: props.screenMesh se asigna cuando el GLTF termina
// de cargar (async), por eso no se desestructura en const.
const props = createProps(scene, manager);
const interactableObjects = [props.laptopGroup, room.chairGroup, props.mugGroup, room.posterGroup];

// ─── STATE MACHINE ───────────────────────────────────────────────────────────
let state = 'ROOM'; // ROOM | ZOOMING | PORTFOLIO

// ─── RAYCASTER ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse2d = new THREE.Vector2();

// ─── MOUSE PARALLAX (ROOM state) ─────────────────────────────────────────────
let mouseNX = 0, mouseNY = 0; // Normalized -1..1

window.addEventListener('mousemove', (e) => {
  mouseNX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseNY = (e.clientY / window.innerHeight - 0.5) * 2;

  // Hover detection for pointer cursor in ROOM
  if (state === 'ROOM') {
    mouse2d.set(mouseNX, -mouseNY);
    raycaster.setFromCamera(mouse2d, camera);
    const hits = raycaster.intersectObjects(interactableObjects, true);
    if (hits.length > 0) {
      renderer.domElement.style.cursor = 'pointer';
      
      let isPoster = false;
      let parent = hits[0].object;
      while (parent) {
        if (parent === room.posterGroup) { isPoster = true; break; }
        parent = parent.parent;
      }
      if (isPoster && hint.dataset.text !== '📄 Descargar CV') {
        setHint('📄 Descargar CV');
      } else if (!isPoster && hint.dataset.text === '📄 Descargar CV') {
        hint.classList.remove('visible');
        hint.dataset.text = '';
      }
    } else {
      renderer.domElement.style.cursor = 'default';
      if (hint.dataset.text === '📄 Descargar CV') {
        hint.classList.remove('visible');
        hint.dataset.text = '';
      }
    }
  }
});

// ─── CLICK HANDLER ───────────────────────────────────────────────────────────
renderer.domElement.addEventListener('click', (e) => {
  if (state === 'ROOM') {
    mouse2d.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(mouse2d, camera);
    const hits = raycaster.intersectObjects(interactableObjects, true);
    if (hits.length > 0) {
      const obj = hits[0].object;

      // Check if it's the laptop
      if (props.laptopClickable.includes(obj)) {
        zoomToLaptop();
      } else {
        // Traverse up to find if it belongs to chair or mug or poster
        let parent = obj;
        while (parent) {
          if (parent === room.chairGroup) {
            interactChair(room.chairGroup);
            break;
          } else if (parent === props.mugGroup) {
            interactMug(props.mugGroup);
            break;
          } else if (parent === room.posterGroup) {
            const a = document.createElement('a');
            a.href = '/CV_Noe_Machaca.pdf';
            a.download = 'CV_Noe_Machaca.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            break;
          }
          parent = parent.parent;
        }
      }
    }
  }
});

// ─── TRANSITIONS ─────────────────────────────────────────────────────────────
function zoomToLaptop() {
  state = 'ZOOMING';
  crosshair.classList.remove('visible');
  quickViewBtn.classList.add('hidden');
  renderer.domElement.style.cursor = 'default';

  // Pantalla a máximo brillo durante el acercamiento
  if (props.screenMesh) {
    props.screenMesh.material.emissiveIntensity = 1.2;
    props.screenMesh.material.color.setScalar(1);
  }

  gsap.to(cam, {
    px: -0.2, py: 1.15, pz: -6.3,
    tx: -0.2, ty: 1.1, tz: -7.5,
    duration: 1.6,
    ease: 'power3.inOut',
    onComplete: beginPortfolioEntry,
  });
}

function beginPortfolioEntry() {
  // Flash de transición "Entrando en el sistema" antes de mostrar el portafolio
  transitionScreen.classList.add('visible');
  setTimeout(() => {
    showPortfolio();
    transitionScreen.classList.remove('visible');
  }, 650);
}

function showPortfolio() {
  state = 'PORTFOLIO';
  overlay.classList.add('active');
  exitBtn.classList.add('visible');
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.5 });
}

function exitPortfolio() {
  gsap.to(overlay, {
    opacity: 0,
    duration: 0.4,
    onComplete: () => {
      overlay.classList.remove('active');
      exitBtn.classList.remove('visible');

      gsap.to(cam, {
        px: 0, py: 1.35, pz: -4.5,
        tx: 0, ty: 0.82, tz: -7.0,
        duration: 1.4,
        ease: 'power2.out',
        onComplete: () => {
          state = 'ROOM';
          crosshair.classList.add('visible');
          quickViewBtn.classList.remove('hidden');
        }
      });
    }
  });
}

// Expose for portfolio iframe
window.exitPortfolio = exitPortfolio;
exitBtn.addEventListener('click', exitPortfolio);

// ─── HINT HELPER ─────────────────────────────────────────────────────────────
let hintTimer = null;
const HINT_ICONS = {
  '💻': '/icons/yaru/laptop.svg',
  '📄': '/icons/yaru/document.svg'
};
function setHint(text, autoHideMs = 0) {
  hint.dataset.text = text || '';
  if (!text) {
    hint.innerHTML = '';
  } else {
    hint.innerHTML = text.replace(/^([💻📄])/u, (m, e) =>
      `<img class="hint-icon" src="${HINT_ICONS[e]}" alt="" data-fb="${e}" onerror="this.outerHTML=this.dataset.fb">`
    );
  }
  hint.classList.toggle('visible', !!text);
  clearTimeout(hintTimer);
  if (autoHideMs) hintTimer = setTimeout(() => hint.classList.remove('visible'), autoHideMs);
}

// ─── RENDER LOOP ─────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // "Monitor respirando": la pantalla enciende y apaga suavemente en ciclo lento
  if (props.screenMesh && state === 'ROOM') {
    if (reducedMotion) {
      // Sin animación: brillo estático pero "encendido"
      props.screenMesh.material.emissiveIntensity = 1.0;
      props.screenMesh.material.color.setScalar(0.9);
    } else {
      const breathe = (Math.sin(t * 1.4) + 1) / 2; // 0..1, ciclo ~4.5s
      props.screenMesh.material.emissiveIntensity = 0.25 + breathe * 0.95; // 0.25..1.2
      props.screenMesh.material.color.setScalar(0.35 + breathe * 0.65);    // 0.35..1
      deskFill.intensity = 6 + breathe * 2.4;                              // 6..8.4
    }
  }
  // Subtle parallax in ROOM state
  if (state === 'ROOM') {
    gsap.to(cam, {
      tx: mouseNX * 0.5,
      ty: 0.85 - mouseNY * 0.15,
      duration: 1.5,
      overwrite: true,
    });
  }

  updateCamera(t);
  composer.render();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// The loader is hidden by the LoadingManager onLoad callback
updateCamera(0);
animate();

// ─── RESIZE ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
