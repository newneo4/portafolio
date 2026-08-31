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
  const aluminum = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.35, metalness: 0.85 });

  // ── Desk ─────────────────────────────────────────────────────────────────────
  const desk = buildDesk(group, darkWood);

  // ── Laptop (on desk) ─────────────────────────────────────────────────────────
  const { screenMesh, laptopClickable } = buildLaptop(desk, manager);

  // ── Coffee Mug (right side of desk) ──────────────────────────────────────────
  const mugGroup = buildMug(desk);

  // ── Trash Can (next to desk on the floor) ────────────────────────────────────
  buildTrashCan(group);

  // ── Bookshelf (left wall) ─────────────────────────────────────────────────────
  buildBookshelf(group);

  // ── Office Chair ──────────────────────────────────────────────────────────────
  const chairGroup = buildChair(group);

  // ── Rugs ─────────────────────────────────────────────────────────────────────
  buildRugs(group);

  // ── Bed (Loading external GLTF) ─────────────────────────────────────────
  buildBed(group, manager);

  // ── Posters (Back wall) ──────────────────────────────────────────────────
  buildPosters(group, manager);

  return { screenMesh, laptopClickable, mugGroup, chairGroup };
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

export function interactMug(mugGroup) {
  if (mugGroup.userData.isAnimating) return;
  mugGroup.userData.isAnimating = true;

  // Pequeño salto y tilt (como si alguien tomara un sorbo)
  gsap.to(mugGroup.position, {
    y: mugGroup.position.y + 0.1,
    duration: 0.25,
    yoyo: true,
    repeat: 1,
    ease: 'power1.inOut'
  });
  gsap.to(mugGroup.rotation, {
    x: 0.2,
    z: -0.15,
    duration: 0.25,
    yoyo: true,
    repeat: 1,
    ease: 'power1.inOut',
    onComplete: () => { mugGroup.userData.isAnimating = false; }
  });
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

  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.load('/models/laptop.glb', (gltf) => {
    const laptopModel = gltf.scene;
    
    // Scale and position adjustment to sit on the desk
    // Aumentamos un poquito más la escala
    laptopModel.scale.set(0.95, 0.95, 0.95); 
    // Ajustamos la altura proporcionalmente al nuevo escritorio más alto
    laptopModel.position.set(-0.1, 0.98, 0.1);
    // Rotate to face the chair
    laptopModel.rotation.y = 0; 
    
    const ubuntuTex = makeScreenTexture();
    
    laptopModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        
        if (node.material && node.material.name === 'Display and Camera') {
           // We found the screen mesh material! Apply our Ubuntu texture
           node.material = new THREE.MeshStandardMaterial({
             map: ubuntuTex,
             emissive: new THREE.Color(0xffffff),
             emissiveMap: ubuntuTex,
             emissiveIntensity: 0.8,
             roughness: 0.1,
             metalness: 0.1
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

    deskGroup.add(laptopModel);
  });

  return { screenMesh: null, laptopClickable };
}

/** Creates the "desktop" canvas texture shown on the laptop screen in 3D */
function makeScreenTexture() {
  const W = 512, H = 340;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07111e');
  bg.addColorStop(1, '#030810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0, 80, 180, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 30); ctx.stroke(); }
  for (let y = 0; y < H - 30; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Taskbar
  ctx.fillStyle = 'rgba(10,12,20,0.95)';
  ctx.fillRect(0, H - 30, W, 30);

  // Prompt text
  ctx.font = '500 18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(96, 160, 255, 0.5)';
  ctx.fillText('▷  Click to explore', W / 2, H / 2 - 5);

  // Terminal cursor blink (static)
  ctx.fillStyle = 'rgba(96, 200, 255, 0.7)';
  ctx.fillRect(W / 2 - 6, H / 2 + 12, 12, 2);

  // Taskbar clock
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(180, 200, 255, 0.5)';
  const now = new Date();
  ctx.fillText(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`, W - 12, H - 10);

  return new THREE.CanvasTexture(canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Coffee Mug
// ─────────────────────────────────────────────────────────────────────────────
function buildMug(deskGroup) {
  const mugGroup = new THREE.Group();
  mugGroup.position.set(0.85, 0.988, -0.2); // Raised to match new desk height
  mugGroup.scale.set(1.8, 1.8, 1.8); // Make the mug much larger
  deskGroup.add(mugGroup);

  // White porcelain materials — matte, completely non-glossy
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xf2eeea, roughness: 0.85, metalness: 0.0 });
  const porcelainInner = new THREE.MeshStandardMaterial({ color: 0xe5e0da, roughness: 0.9, metalness: 0.0 });

  // Body (cylinder) — white
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.1, 24), porcelain);
  body.position.set(0, 0.05, 0);
  body.castShadow = true;
  mugGroup.add(body);

  // Inner rim (darker white to suggest depth)
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.005, 20), porcelainInner);
  inner.position.set(0, 0.099, 0);
  mugGroup.add(inner);

  // Handle (torus arc) — also white
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 14, Math.PI), porcelain);
  handle.position.set(0.045, 0.05, 0);
  handle.rotation.y = Math.PI / 2;
  mugGroup.add(handle);

  // Coffee inside — warm dark brown, as if just poured
  const coffeeMat = new THREE.MeshStandardMaterial({
    color: 0x4b2c20,
    roughness: 0.15,   // slightly glossy surface (liquid)
    metalness: 0.05,
  });
  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.003, 20), coffeeMat);
  coffee.position.set(0, 0.097, 0);
  mugGroup.add(coffee);

  // Subtle steam — no heat light (avoid fake glow on white ceramic)
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
function buildTrashCan(parent) {
  // Larger metallic trash bin — matte dark plastic, no metalness to avoid highlights
  const trashMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.08, roughness: 0.9 });

  const CX = 1.1, CZ = -7.3; // position

  // Can body — taller and wider
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.45, 22, 1, true), trashMat);
  can.position.set(CX, 0.225, CZ);
  can.castShadow = true;
  parent.add(can);

  // Bottom disc
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.16, 22), trashMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(CX, 0.002, CZ);
  parent.add(bottom);

  // Top rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.012, 8, 24), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(CX, 0.45, CZ);
  parent.add(rim);

  // Crumpled paper sticking out
  addCrumpledPaper(parent, CX, 0.50, CZ);
}

function addCrumpledPaper(parent, x, y, z) {
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.95, metalness: 0 });
  const paper = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), paperMat);
  paper.position.set(x, y, z);
  paper.scale.set(1.2, 0.7, 1.1);
  paper.rotation.set(0.3, 0.8, 0.2);
  parent.add(paper);
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

// ─────────────────────────────────────────────────────────────────────────────
// Chair
// ─────────────────────────────────────────────────────────────────────────────
function buildChair(parent) {
  const chair = new THREE.Group();
  // Moved to the RIGHT side of the desk
  chair.position.set(-1.0, 0, -6.0);
  chair.rotation.y = -0.7; // Facing the desk from the right
  parent.add(chair);

  const fabricMat = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.95 });
  const fabricMid = new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.95 });
  const plasticMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.85, roughness: 0.25 });

  // ── Seat (wider, padded look with chamfer effect via scale) ──
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.72), fabricMat);
  seat.position.set(0, 0.5, 0);
  seat.castShadow = true;
  chair.add(seat);

  // Seat padding lip (front edge roll)
  const seatLip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.76, 12), fabricMid);
  seatLip.rotation.z = Math.PI / 2;
  seatLip.position.set(0, 0.5, 0.38);
  chair.add(seatLip);

  // ── Backrest (ergonomic S-curve approximated with two angled boxes) ──
  const lowerBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.09), fabricMat);
  lowerBack.position.set(0, 0.78, 0.32);
  lowerBack.rotation.x = -0.18;
  lowerBack.castShadow = true;
  chair.add(lowerBack);

  const upperBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.38, 0.09), fabricMat);
  upperBack.position.set(0, 1.16, 0.28);
  upperBack.rotation.x = -0.05;
  chair.add(upperBack);

  // Lumbar support bump
  const lumbar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 14), fabricMid);
  lumbar.rotation.z = Math.PI / 2;
  lumbar.position.set(0, 0.78, 0.37);
  chair.add(lumbar);

  // Headrest
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.09), fabricMat);
  headrest.position.set(0, 1.42, 0.26);
  headrest.rotation.x = 0.05;
  chair.add(headrest);

  // Back frame (sides of backrest, dark plastic)
  [-0.37, 0.37].forEach(bx => {
    const bf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.88, 0.06), plasticMat);
    bf.position.set(bx, 1.0, 0.30);
    bf.rotation.x = -0.1;
    chair.add(bf);
  });

  // ── Armrests ──
  [-0.42, 0.42].forEach(ax => {
    // Vertical support
    const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.04), plasticMat);
    armPost.position.set(ax, 0.65, 0.0);
    chair.add(armPost);

    // Horizontal pad (padded surface)
    const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.35), fabricMid);
    armPad.position.set(ax, 0.78, -0.05);
    chair.add(armPad);
  });

  // ── Central column (gas lift) ──
  const gasLift = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.38, 12), metalMat);
  gasLift.position.set(0, 0.28, 0);
  chair.add(gasLift);

  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12), metalMat);
  piston.position.set(0, 0.10, 0);
  chair.add(piston);

  // ── Star base (5 arms) ──
  const baseCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), plasticMat);
  baseCenter.position.set(0, 0.025, 0);
  chair.add(baseCenter);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.38), plasticMat);
    arm.position.set(Math.sin(angle) * 0.19, 0.025, Math.cos(angle) * 0.19);
    arm.rotation.y = angle;
    chair.add(arm);

    // Dual wheels (axle pair)
    [-0.03, 0.03].forEach(wo => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 10), plasticMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(
        Math.sin(angle) * 0.37 + Math.cos(angle) * wo,
        0.032,
        Math.cos(angle) * 0.37 - Math.sin(angle) * wo
      );
      chair.add(wheel);
    });
  }

  return chair;
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
  gltfLoader.load('/models/bed_model_002.glb', (gltf) => {
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
    { url: '/textures/posters/soda_stereo.png', x: -1.8, y: 1.8, scale: 0.8 },
    { url: '/textures/posters/guns_n_roses.png', x: 0, y: 1.9, scale: 1.0 },
    { url: '/textures/posters/rhcp.png', x: 1.8, y: 1.7, scale: 0.85 }
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
