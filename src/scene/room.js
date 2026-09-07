import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

/**
 * Builds the interior room: floor, walls, ceiling, window, and light fixture.
 */
export function createRoom(scene, manager) {
  const group = new THREE.Group();
  scene.add(group);

  // ── Materials ────────────────────────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2632, roughness: 1.0, side: THREE.BackSide }); // Azul pizarra oscuro
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x121b24, roughness: 0.9, metalness: 0.05 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x141e28, roughness: 1.0 });

  // ── Room Box ─────────────────────────────────────────────────────────────────
  // Room: 12 wide × 4 tall × 12 deep, centered at (0, 2, -5)
  const roomBox = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 12), wallMat);
  roomBox.position.set(0, 2, -5);
  roomBox.receiveShadow = true;
  group.add(roomBox);

  // Floor plane (separate for shadow receiving)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -5);
  floor.receiveShadow = true;
  group.add(floor);

  // ── Foco de Luz (Entrada del cuarto) ──────────────────────────────────────────
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffddaa, emissiveIntensity: 4 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), bulbMat);
  bulb.position.set(0, 3.8, -1.0);
  group.add(bulb);

  const bulbCordMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const bulbCord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), bulbCordMat);
  bulbCord.position.set(0, 4.05, -1.0);
  group.add(bulbCord);

  const entryLight = new THREE.PointLight(0xffddaa, 60, 25, 1.5);
  entryLight.position.set(0, 3.8, -1.0);
  entryLight.castShadow = true;
  entryLight.shadow.mapSize.set(1024, 1024); // Mayor resolución
  entryLight.shadow.bias = 0.0001; // Evitar el sangrado de luz (light leaking)
  group.add(entryLight);

  // Ceiling plane
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 4, -5);
  group.add(ceil);

  // ── Baseboard trim (just a thin dark strip along the walls) ─────────────────
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0c1218, roughness: 0.9 }); // Un tono ligeramente más oscuro que la pared
  const baseTrim = (w, d, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), trimMat);
    m.position.set(x, 0.06, z);
    m.rotation.y = ry;
    group.add(m);
  };
  baseTrim(12, 0.04, 0, -11, 0);     // Back
  baseTrim(0.04, 12, -6, -5, 0);     // Left
  baseTrim(0.04, 12, 6, -5, 0);     // Right

  // ── Ceiling Light Fixture ─────────────────────────────────────────────────────
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xffd09a, emissive: 0xffd09a, emissiveIntensity: 3, roughness: 0.5,
  });
  const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 0.12, 16), fixtureMat);
  fixture.position.set(0, 3.95, -5);
  group.add(fixture);

  // Cord from ceiling to fixture
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 }),
  );
  cord.position.set(0, 4.15, -5);
  group.add(cord);

  // ── Night Window (right wall) ─────────────────────────────────────────────────
  addNightWindow(group, 5.98, 2, -6);

  // ── CV Poster (back wall) ─────────────────────────────────────────────────────
  // Se movió a x = -2.6 para centrarlo más junto con los otros pósters
  const posterGroup = addPoster(group, -2.6, 1.9, -10.98, manager);

  // ── Chair (GLTF) ─────────────────────────────────────────────────────────────
  const chairGroup = new THREE.Group();
  chairGroup.position.set(-1.0, 0, -6.0);
  // Girar la silla 180 grados (Math.PI) sumándolo a la rotación anterior
  chairGroup.rotation.y = -0.7 + Math.PI; 
  group.add(chairGroup);

  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('/models/chair.glb', (gltf) => {
    const chairModel = gltf.scene;

    // Automatically scale to ~1.1m height and place bottom at y=0
    const box = new THREE.Box3().setFromObject(chairModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    const targetHeight = 1.1;
    const scale = targetHeight / size.y;
    chairModel.scale.setScalar(scale);
    
    chairModel.position.x = -center.x * scale;
    chairModel.position.y = -box.min.y * scale;
    chairModel.position.z = -center.z * scale;

    chairModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = Math.max(node.material.roughness || 0.4, 0.4);
        }
      }
    });

    chairGroup.add(chairModel);
  });

  return { group, posterGroup, chairGroup };
}

export function interactChair(chairGroup) {
  if (chairGroup.userData.isAnimating) return;
  chairGroup.userData.isAnimating = true;
  gsap.to(chairGroup.rotation, {
    y: chairGroup.rotation.y + Math.PI * 2,
    duration: 1.5,
    ease: 'power2.inOut',
    onComplete: () => { chairGroup.userData.isAnimating = false; }
  });
}

function addPoster(parent, x, y, z, manager) {
  const posterGroup = new THREE.Group();
  posterGroup.position.set(x, y, z);
  parent.add(posterGroup);

  // Frame (mitad del tamaño: de 1.6x2.1 a 0.8x1.05)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 });
  const frameGeo = new THREE.BoxGeometry(0.8, 1.05, 0.05);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  posterGroup.add(frame);

  // Canvas (mitad del tamaño: de 1.5x2.0 a 0.75x1.0)
  const texLoader = new THREE.TextureLoader(manager);
  const tex = texLoader.load('/cv_poster.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  const canvasMat = new THREE.MeshBasicMaterial({ map: tex });
  const canvasGeo = new THREE.PlaneGeometry(0.75, 1.0);
  const canvas = new THREE.Mesh(canvasGeo, canvasMat);
  canvas.position.z = 0.026;
  posterGroup.add(canvas);

  // La luz (SpotLight) se eliminó de aquí porque vendrá de la lámpara del escritorio en props.js

  return posterGroup;
}

/** Adds a small glowing window with a city-night canvas texture on the right wall */
function addNightWindow(parent, x, y, z) {
  // Window frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 1.0), frameMat);
  frame.position.set(x, y, z);
  parent.add(frame);

  // Window glass pane (glowing city)
  const cityTex = makeCityTexture();
  const glassMat = new THREE.MeshBasicMaterial({ map: cityTex, side: THREE.DoubleSide });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), glassMat);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(x - 0.01, y, z);
  parent.add(glass);

  // Window light (spill de atardecer)
  const wLight = new THREE.PointLight(0xff8840, 15, 6, 2);
  wLight.position.set(x - 0.5, y, z);
  parent.add(wLight);
}

/** Generates a canvas texture simulating a night city view */
function makeCityTexture() {
  const W = 256, H = 340;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.0, '#4a2520');
  sky.addColorStop(0.5, '#753520');
  sky.addColorStop(1.0, '#a56030');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Buildings (random silhouettes)
  ctx.fillStyle = '#05080d';
  const buildings = [
    [0, 80, 30, 200], [35, 100, 25, 180], [65, 60, 40, 220],
    [110, 90, 35, 190], [150, 50, 50, 230], [205, 80, 30, 200],
    [240, 70, 30, 210],
  ];
  buildings.forEach(([bx, bh, bw, by]) => {
    ctx.fillRect(bx, H - by, bw, bh);
  });

  // Windows on buildings (small bright dots)
  for (let i = 0; i < 180; i++) {
    const wx = Math.random() * W;
    const wy = H * 0.3 + Math.random() * H * 0.65;
    const lit = Math.random() > 0.35;
    if (lit) {
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(255, 200, 100, ${0.5 + Math.random() * 0.5})`
        : `rgba(255, 160, 80, ${0.4 + Math.random() * 0.4})`;
      ctx.fillRect(wx, wy, 2, 3);
    }
  }

  // Stars (menos estrellas al atardecer)
  for (let i = 0; i < 20; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H * 0.3;
    const a = 0.2 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(sx, sy, 1, 1);
  }

  return new THREE.CanvasTexture(canvas);
}
