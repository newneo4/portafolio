import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Creates all desk props: desk, laptop, coffee mug, trash can, bookshelf.
 * Returns screenMesh (for the glow light) and laptopClickable (for raycasting).
 */
export function createProps(scene, manager) {
  const group = new THREE.Group();
  scene.add(group);

  // Shared materials
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x1e0d04, roughness: 0.85, metalness: 0.05 });

  // ── Desk ─────────────────────────────────────────────────────────────────────
  const desk = buildDesk(group, darkWood);

  // ── Laptop (on desk) ─────────────────────────────────────────────────────────
  // buildLaptop devuelve un objeto "vivo": su campo screenMesh se rellena cuando
  // el GLTF termina de cargar (async). Lo reutilizamos y adjuntamos el resto de
  // props para que createProps devuelva SIEMPRE la misma referencia actualizada.
  const props = buildLaptop(desk, manager);

  // ── Coffee Mug (right side of desk) ──────────────────────────────────────────
  props.mugGroup = buildMug(desk, manager);

  // ── Desk Lamp (left side of desk, illuminating CV) ───────────────────────────
  buildDeskLamp(desk);

  // ── Trash Can (next to desk on the floor) ────────────────────────────────────
  buildTrashCan(group, manager);

  // ── Bookshelf (left wall) ─────────────────────────────────────────────────────
  buildBookshelf(group);

  // Chair moved to room.js

  // ── Rugs ─────────────────────────────────────────────────────────────────────
  buildRugs(group);

  // ── Bed (Loading external GLTF) ─────────────────────────────────────────
  buildBed(group, manager);

  // ── Posters (Back wall) ──────────────────────────────────────────────────
  buildPosters(group, manager);

  return props;
}

export function interactMug(mugGroup) {
  if (mugGroup.userData.isAnimating) return;
  mugGroup.userData.isAnimating = true;

  // La taza se desliza hacia delante, eleva y gira sobre su propio eje (y) para
  // mostrar el asa, y luego vuelve.
  const origin = mugGroup.position.clone();
  const targetX = origin.x - 0.15;

  const posTl = gsap.timeline({
    onComplete: () => { mugGroup.userData.isAnimating = false; }
  });

  posTl
    .to(mugGroup.position, {
      x: targetX,
      y: origin.y + 0.08,
      duration: 0.35,
      ease: 'power1.in',
    }, 0)
    .to(mugGroup.rotation, {
      y: mugGroup.rotation.y + Math.PI * 2,
      duration: 0.9,
      ease: 'power2.inOut',
    }, 0.15)
    .to(mugGroup.rotation, {
      z: -0.12,
      duration: 0.35,
      ease: 'power1.in',
    }, 0)
    .to(mugGroup.position, {
      x: origin.x,
      y: origin.y,
      duration: 0.5,
      ease: 'power1.out',
    }, 0.5)
    .to(mugGroup.rotation, {
      z: 0,
      duration: 0.5,
      ease: 'power1.out',
    }, 0.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Desk
// ─────────────────────────────────────────────────────────────────────────────
function buildDesk(parent, mat) {
  const desk = new THREE.Group();
  desk.position.set(-0.2, 0, -7.8);
  parent.add(desk);

  // Tabletop
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.07, 1.4), mat);
  top.position.set(0, 0.95, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  desk.add(top);

  // Back panel (modesty panel)
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.83, 0.04), mat);
  back.position.set(0, 0.53, -0.68);
  desk.add(back);

  // 4 legs
  [[-1.52, -0.64], [1.52, -0.64], [-1.52, 0.64], [1.52, 0.64]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.07), mat);
    leg.position.set(lx, 0.475, lz);
    leg.castShadow = true;
    desk.add(leg);
  });

  return desk;
}

// ─────────────────────────────────────────────────────────────────────────────
// Laptop
// ─────────────────────────────────────────────────────────────────────────────
function buildLaptop(deskGroup, manager) {
  const laptopClickable = [];
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(-0.1, 0.98, 0.1);
  deskGroup.add(laptopGroup);

  const result = { screenMesh: null, laptopClickable, laptopGroup };

  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('/models/laptop.glb', (gltf) => {
    const laptopModel = gltf.scene;

    // Scale and position adjustment to sit on the desk
    laptopModel.scale.set(0.95, 0.95, 0.95);
    // Position and rotation are handled by laptopGroup now
    laptopModel.position.set(0, 0, 0);
    laptopModel.rotation.y = 0;

    const texLoader = new THREE.TextureLoader(manager);
    const ubuntuTex = texLoader.load('/textures/background/fondo.jpeg');
    ubuntuTex.flipY = true; // Restaurar flipY para geometries estándar (PlaneGeometry)
    ubuntuTex.colorSpace = THREE.SRGBColorSpace;

    laptopModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material && node.material.name === 'Display and Camera') {
          // Restaurar el material original de la pantalla a un negro/gris muy oscuro para el marco
          node.material = new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 0.6,
            metalness: 0.8
          });
        } else {
          // Ensure standard materials for good lighting on other parts
          if (node.material && (node.material.isMeshStandardMaterial || node.material.isMeshPhysicalMaterial)) {
            node.material.roughness = Math.max(node.material.roughness, 0.3);
          } else if (node.material) {
            const oldMat = node.material;
            node.material = new THREE.MeshStandardMaterial({
              color: oldMat.color || 0xffffff,
              roughness: 0.5,
              metalness: 0.5
            });
            if (oldMat.map) node.material.map = oldMat.map;
          }
        }

        laptopClickable.push(node);
      }
    });

    // Crear un plano separado para la pantalla, evitando los problemas de UV del modelo
    const screenOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.68),
      new THREE.MeshStandardMaterial({
        map: ubuntuTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: ubuntuTex,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.1
      })
    );
    // Posición y rotación calculadas basadas en los bounds del mesh original
    screenOverlay.position.set(-0.01, 0.42, -0.392);
    screenOverlay.rotation.x = -0.03; // Ligera inclinación hacia atrás
    laptopModel.add(screenOverlay);
    laptopClickable.push(screenOverlay);

    result.screenMesh = screenOverlay;

    laptopGroup.add(laptopModel);
  });

  return result;
}





// ─────────────────────────────────────────────────────────────────────────────
// Coffee Mug (GLTF)
// ─────────────────────────────────────────────────────────────────────────────
function buildMug(deskGroup, manager) {
  const mugGroup = new THREE.Group();
  mugGroup.position.set(0.85, 0.988, -0.2);
  deskGroup.add(mugGroup);

  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('/models/cup_of_coffee.glb', (gltf) => {
    const mugModel = gltf.scene;

    mugModel.scale.set(0.20, 0.20, 0.20);
    mugModel.position.set(0, 0, 0);
    mugModel.rotation.y = -Math.PI / 2;

    mugModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material) {
          if (node.material.isMeshStandardMaterial || node.material.isMeshPhysicalMaterial) {
            node.material.roughness = Math.max(node.material.roughness, 0.3);
          } else {
            const oldMat = node.material;
            node.material = new THREE.MeshStandardMaterial({
              color: oldMat.color || 0xffffff,
              roughness: 0.5,
              metalness: 0.3,
            });
            if (oldMat.map) node.material.map = oldMat.map;
          }
        }
      }
    });

    mugGroup.add(mugModel);
  });

  addSteam(mugGroup);

  return mugGroup;
}

function addSteam(parent) {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, 'rgba(200,200,255,0.5)');
  g.addColorStop(1, 'rgba(200,200,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(8, 64); ctx.bezierCurveTo(16, 40, 4, 20, 16, 0); ctx.bezierCurveTo(24, 20, 12, 40, 20, 64);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  const steamMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const steam = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.08), steamMat);
  steam.position.set(0, 0.14, 0);
  parent.add(steam);
}

// ─────────────────────────────────────────────────────────────────────────────
// Trash Can
// ─────────────────────────────────────────────────────────────────────────────
function buildTrashCan(parent, manager) {
  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('/models/garbage_can.glb', (gltf) => {
    const trashModel = gltf.scene;

    // La altura natural del modelo es ~0.41m, escala 1.1 la deja en ~0.45m
    trashModel.scale.set(1.1, 1.1, 1.1);

    const CX = 1.1, CZ = -7.3;
    trashModel.position.set(CX, 0, CZ);

    trashModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material) {
          node.material.roughness = 0.8;
          node.material.metalness = 0.2;
        }
      }
    });

    parent.add(trashModel);
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// Bookshelf (left wall)
// ─────────────────────────────────────────────────────────────────────────────
function buildBookshelf(parent) {
  const shelf = new THREE.Group();
  // Positioned against left wall
  shelf.position.set(-5.7, 0, -7.5);
  shelf.rotation.y = Math.PI / 2;
  parent.add(shelf);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x160802, roughness: 0.9, metalness: 0.05 });

  // Back panel
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.5, 0.04), woodMat);
  back.position.set(0, 1.75, -0.17);
  shelf.add(back);

  // Side panels
  [-1.2, 1.2].forEach(sx => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.5, 0.36), woodMat);
    side.position.set(sx, 1.75, 0);
    shelf.add(side);
  });

  // Top & bottom boards
  [0.03, 3.47].forEach(sy => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.36), woodMat);
    board.position.set(0, sy, 0);
    shelf.add(board);
  });

  // Horizontal shelves (3 rows)
  [0.9, 1.75, 2.6].forEach(sy => {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.04, 0.34), woodMat);
    sh.position.set(0, sy, 0);
    shelf.add(sh);

    // Books on this shelf
    placeBooks(shelf, sy + 0.02);
  });

  // Top row of books
  placeBooks(shelf, 3.47 + 0.02);
}

const BOOK_COLORS = [0x8b0000, 0x004b23, 0x00008b, 0x8b6914, 0x4b0082, 0x5c2d0e, 0x1a3a5c, 0x6b2737, 0x1a4a1a, 0x3a1a5c];

function placeBooks(shelfGroup, baseY) {
  let x = -1.1;
  const maxX = 1.1;
  while (x < maxX) {
    const bw = 0.055 + Math.random() * 0.065;
    const bh = 0.18 + Math.random() * 0.15;
    const color = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];

    const bookMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0,
    });

    const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.3), bookMat);
    book.position.set(x + bw / 2, baseY + bh / 2, 0);
    book.rotation.y = (Math.random() - 0.5) * 0.12;
    shelfGroup.add(book);

    // Spine highlight (thin lighter strip)
    const spineMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), roughness: 0.8 });
    const spine = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.6, bh * 0.4), spineMat);
    spine.position.set(x + bw / 2, baseY + bh / 2, 0.151);
    shelfGroup.add(spine);

    x += bw + 0.004 + Math.random() * 0.01;
  }
}

// ─────────────────────────────────────────────────────────────────
// Rugs
// ─────────────────────────────────────────────────────────────────
function buildRugs(parent) {
  // Large central area rug
  const centralRugMat = new THREE.MeshStandardMaterial({ color: 0x1e1530, roughness: 1.0 });
  const centralRug = new THREE.Mesh(new THREE.BoxGeometry(7, 0.015, 5.5), centralRugMat);
  centralRug.position.set(0, 0.007, -6.5);
  centralRug.receiveShadow = true;
  parent.add(centralRug);

  // Rug border detail (slightly lighter thin frame)
  const rugBorderMat = new THREE.MeshStandardMaterial({ color: 0x2a2040, roughness: 1.0 });
  const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.012, 5.6), rugBorderMat);
  rugBorder.position.set(0, 0.005, -6.5);
  parent.add(rugBorder);

  // Round desk rug (on top of central rug)
  const deskRugMat = new THREE.MeshStandardMaterial({ color: 0x16122a, roughness: 1.0 });
  const deskRug = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.018, 40), deskRugMat);
  deskRug.position.set(-0.2, 0.016, -7.0);
  deskRug.receiveShadow = true;
  parent.add(deskRug);
}

// ─────────────────────────────────────────────────────────────────
// Bed (Detailed Procedural with Soft Edges and Wrinkles)
// ─────────────────────────────────────────────────────────────────
function buildBed(parent, manager) {
  const bed = new THREE.Group();
  bed.position.set(4.0, 0, -8.5);
  parent.add(bed);

  // Load the external GLTF model provided by the user
  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('/models/bed_model_003.glb', (gltf) => {
    const bedModel = gltf.scene;
    // Scale and position adjustment
    bedModel.scale.set(1.2, 1.2, 1.2);
    bedModel.position.set(0, 0, 0);

    // Enable shadows on all meshes within the model
    bedModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        // Upgrade material if needed for better lighting
        if (node.material) {
          const oldMat = node.material;
          // Si el modelo ya trae un StandardMaterial, lo conservamos pero le ajustamos el roughness
          if (oldMat.isMeshStandardMaterial || oldMat.isMeshPhysicalMaterial) {
            oldMat.roughness = Math.max(oldMat.roughness, 0.7);
          } else {
            node.material = new THREE.MeshStandardMaterial({
              color: oldMat.color || 0xffffff,
              roughness: 0.9,
            });
            if (oldMat.map) node.material.map = oldMat.map;
            if (oldMat.vertexColors) node.material.vertexColors = true;
          }
        }
      }
    });

    bed.add(bedModel);
  });

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a0d04, roughness: 0.85 }); // dark wood

  // Bedside table (small nightstand)
  const nightstand = new THREE.Group();
  nightstand.position.set(-1.3, 0, -0.5);
  bed.add(nightstand);

  const nsTop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.45), frameMat);
  nsTop.position.set(0, 0.55, 0);
  nightstand.add(nsTop);

  const nsBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), frameMat);
  nsBody.position.set(0, 0.28, 0);
  nightstand.add(nsBody);

  // Small lamp on nightstand
  const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 12), lampBaseMat);
  lampBase.position.set(0, 0.66, 0);
  nightstand.add(lampBase);

  // Lamp shade — no emissive, just let lampLight illuminate it naturally
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xeedd99, roughness: 0.85, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.18, 16, 1, true), shadeMat);
  shade.position.set(0, 0.82, 0);
  nightstand.add(shade);

  // Lamp cap (top disc to block light going up)
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1a0d04, roughness: 0.9 });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), capMat);
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(0, 0.91, 0);
  nightstand.add(cap);

  // No lamp light — avoids the fake circle of light near the bed
  // The ceiling light provides enough ambient for this area
}

// ─────────────────────────────────────────────────────────────────
// Posters
// ─────────────────────────────────────────────────────────────────
function buildPosters(parent, manager) {
  const texLoader = new THREE.TextureLoader(manager);
  const postersData = [
    { url: '/textures/posters/soda_stereo.png', x: 0.2, y: 1.8, scale: 0.8 },
    { url: '/textures/posters/guns_n_roses.png', x: 2.0, y: 1.9, scale: 1.0 },
    { url: '/textures/posters/rhcp.png', x: 3.8, y: 1.7, scale: 0.85 }
  ];

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

  postersData.forEach(pData => {
    texLoader.load(pData.url, (tex) => {
      // Create a picture frame based on texture aspect ratio
      const aspect = tex.image.width / tex.image.height;
      const height = 1.0 * pData.scale;
      const width = height * aspect;

      const posterGroup = new THREE.Group();
      posterGroup.position.set(pData.x, pData.y, -9.95); // Wall is at -10

      // The frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.05), frameMat);
      posterGroup.add(frame);

      // The image canvas
      const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(width, height), canvasMat);
      canvas.position.set(0, 0, 0.026); // Just in front of the frame
      posterGroup.add(canvas);

      parent.add(posterGroup);
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// Desk Lamp
// ─────────────────────────────────────────────────────────────────
function buildDeskLamp(deskGroup) {
  const lampGroup = new THREE.Group();
  // Posicionada en el lado izquierdo del escritorio (sobre la superficie y = 0.985)
  lampGroup.position.set(-1.2, 0.985, -0.2);
  deskGroup.add(lampGroup);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });

  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 32), metalMat);
  // Alineada con la parte inferior del brazo (que cae en x = -0.1 debido a su inclinación)
  base.position.set(-0.1, 0.02, 0);
  lampGroup.add(base);

  // Brazo (inclinado hacia atrás)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), metalMat);
  arm.position.set(-0.05, 0.25, -0.05);
  arm.rotation.z = -0.2;
  arm.rotation.x = -0.2;
  lampGroup.add(arm);

  // Pantalla (Cono) apuntando hacia el póster
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.5 });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 32), shadeMat);
  shade.position.set(-0.1, 0.45, -0.1);
  // Rotarla para que apunte hacia el póster (atrás-izquierda)
  shade.rotation.x = -Math.PI / 2 + 0.3;
  shade.rotation.z = Math.PI / 4 + 0.1;
  lampGroup.add(shade);

  // Foco de luz
  const spotLight = new THREE.SpotLight(0xffddaa, 28, 12, Math.PI / 5, 0.6, 1);
  spotLight.position.set(-0.1, 0.45, -0.1); // En la pantalla

  const targetObj = new THREE.Object3D();
  // El póster está globalmente en (-2.6, 1.9, -10.98)
  // deskGroup está en (-0.2, 0, -7.8)
  // lampGroup en deskGroup está en (-1.2, 0.77, -0.2), global = (-1.4, 0.77, -8.0)
  // Vector objetivo local = (-2.6 - (-1.4), 1.9 - 0.77, -10.98 - (-8.0)) = (-1.2, 1.13, -2.98)
  targetObj.position.set(-1.2, 1.13, -2.98);
  lampGroup.add(targetObj);

  spotLight.target = targetObj;
  spotLight.castShadow = true;
  lampGroup.add(spotLight);

  // Bombilla visual
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0xffeedd }));
  bulb.position.set(0, -0.08, 0);
  shade.add(bulb);
}
