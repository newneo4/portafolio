import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Creates a simple door scene: just the door in a wall, semi-open.
 * The camera starts a few steps away (main.js cam.pz ≈ 3.5).
 * Returns { doorPivot } so main.js can animate it.
 */
export function createDoorScene(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ── Materials ────────────────────────────────────────────────────────────────
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8, metalness: 0.3 });
  const wood      = new THREE.MeshStandardMaterial({ color: 0x3a1a08, roughness: 0.8 });
  const wallMat   = new THREE.MeshStandardMaterial({ color: 0x3d5c45, roughness: 1.0 }); // verde salvia

  // ── Wall (flat backdrop behind the door frame) ────────────────────────────────
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
  wall.position.set(0, 2.5, 0);
  wall.receiveShadow = true;
  group.add(wall);

  // Floor strip in front of the door
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e1a14, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 3);
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling strip
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2a3d2e, roughness: 1.0 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 5, 3);
  group.add(ceil);

  // ── Door Frame ────────────────────────────────────────────────────────────────
  const DOOR_W = 2.0, DOOR_H = 3.1;

  const makeFrame = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkMetal);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  // Side pillars
  makeFrame(0.14, DOOR_H, 0.22, -(DOOR_W / 2 + 0.07), DOOR_H / 2, 0.01);
  makeFrame(0.14, DOOR_H, 0.22,   DOOR_W / 2 + 0.07,  DOOR_H / 2, 0.01);
  // Top bar
  makeFrame(DOOR_W + 0.28, 0.16, 0.22, 0, DOOR_H + 0.08, 0.01);

  // ── Door Panel (pivot on left hinge) ─────────────────────────────────────────
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-DOOR_W / 2, 0, 0.01);
  doorPivot.rotation.y = -0.5; // semi-open (~29°)
  group.add(doorPivot);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.04, DOOR_H - 0.04, 0.07), wood);
  panel.position.set(DOOR_W / 2 - 0.02, DOOR_H / 2, 0);
  panel.castShadow = true;
  panel.receiveShadow = true;
  doorPivot.add(panel);

  // Door knob
  const knobMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.15 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), knobMat);
  knob.position.set(DOOR_W * 0.8, 1.1, 0.06);
  doorPivot.add(knob);

  // ── "Sobre mí" Sign ──────────────────────────────────────────────────────────
  const signTex = makeSignTexture();
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.85 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.30, 0.04), signMat);
  sign.position.set(DOOR_W * 0.5, 2.0, 0.07);
  sign.rotation.z = -0.15;
  doorPivot.add(sign);

  // ── Lighting: simple, no drama ────────────────────────────────────────────────
  // Warm point light from inside the room (visible through the gap)
  const innerLight = new THREE.PointLight(0xffddaa, 40, 12, 1.5);
  innerLight.position.set(0, 3.5, -2); // behind the door
  innerLight.castShadow = true;
  innerLight.shadow.mapSize.set(512, 512);
  innerLight.shadow.bias = -0.002;
  group.add(innerLight);

  return { group, doorPivot };
}

/** Canvas texture for the "Sobre mí" sign */
function makeSignTexture() {
  const W = 512, H = 213;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0.0, '#b8864a');
  bg.addColorStop(0.3, '#d4a060');
  bg.addColorStop(0.7, '#c09050');
  bg.addColorStop(1.0, '#a87030');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(80, 40, 10, 0.15)';
  ctx.lineWidth = 2;
  for (let y = 0; y < H; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.3) * 3);
    ctx.bezierCurveTo(W * 0.3, y + 4, W * 0.7, y - 4, W, y + Math.sin(y * 0.5) * 3);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(60, 30, 5, 0.6)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  ctx.fillStyle = 'rgba(40, 20, 5, 0.4)';
  ctx.font = 'bold 72px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sobre mí', W / 2 + 3, H / 2 + 4);
  ctx.fillStyle = '#2c1205';
  ctx.fillText('Sobre mí', W / 2, H / 2);

  return new THREE.CanvasTexture(canvas);
}

/** Animates the door opening inward */
export function openDoor(doorPivot) {
  gsap.to(doorPivot.rotation, {
    y: -Math.PI * 0.58,
    duration: 1.3,
    ease: 'power2.inOut',
  });
}
