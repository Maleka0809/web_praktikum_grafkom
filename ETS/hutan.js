/**
 * ETS Grafika Komputer - Lingkungan 02: Hutan Malam Kebakaran (Galaxy Wildfire Forest)
 * - Background langit malam galaksi 360° (Galaxy Deep Space) & Bulan bersinar sama seperti kota2.
 * - Hutan rimba lebat & padat (tetap banyak pohon rimbun & cemara).
 * - Bahu jalan bertanah (dirt/soil shoulders) dan gundukan tanah alami di kedua sisi jalan.
 * - Asset api (fire.glb & bomberman_fire.glb) berukuran proporsional (agak kecil),
 *   tersebar sebagai api unggun / kobaran alami di tepi tanah dan pangkal pohon.
 * - Partikel bara api melayang (embers) berkerlip di bawah langit galaksi berbintang.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const canvas = document.getElementById('mainCanvas');
const fpsDisplay = document.getElementById('fpsDisplay');
const infoDetail = document.getElementById('infoDetail');

const btnToggleAnim = document.getElementById('btnToggleAnim');
const btnToggleCam = document.getElementById('btnToggleCam');
const btnWireframe = document.getElementById('btnWireframe');
const btnSpeed = document.getElementById('btnSpeed');

let scene, camera, renderer, controls;
let mainMesh, sideMaterial, capMaterial, standardMaterials;
let forestGroup, emberParticles, smokeParticles;

const cylinderRadius = 2.6;
const cylinderHeight = 3.8;
const eyeHeight = 0.54;
const basePitchDown = 17 * (Math.PI / 180);

let cameraView = 'surface'; // 'surface' | 'orbit'
let isAnimating = true;
let isWireframe = false;
let rollSpeed = 0.75;
const speedLevels = [0.5, 0.75, 1.25, 2.0];
let speedIndex = 1;

let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;

let skySphere;
let moonVisuals;

// Koleksi animasi api & dynamic lighting
const animatedFireMixers = [];
const dynamicFireLights = [];
let emberVelocities = [];

// Tekstur Pendaran Cahaya Bulan (Sama persis seperti di kota2)
function createMoonGlareTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256;
  const cy = 256;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 256);
  grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');  // Inti putih cemerlang murni
  grad.addColorStop(0.06, 'rgba(240, 246, 255, 0.95)'); // Pendaran perak lembut
  grad.addColorStop(0.18, 'rgba(199, 210, 254, 0.60)'); // Sinar biru es malam
  grad.addColorStop(0.40, 'rgba(147, 197, 253, 0.22)'); // Pendaran atmosfer lembut
  grad.addColorStop(0.70, 'rgba(96, 165, 250, 0.05)');  // Halo luar halus
  grad.addColorStop(1.00, 'rgba(96, 165, 250, 0.0)');   // Memudar menyatu dengan langit malam

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Objek Bulan Malam Galaksi (Sama seperti di kota2)
function createMoon(scene) {
  const moonGroup = new THREE.Group();
  const moonPos = new THREE.Vector3(-6.8, 4.0, 36.0);
  moonGroup.position.copy(moonPos);

  const moonTex = createMoonGlareTexture();

  const coreMat = new THREE.SpriteMaterial({
    map: moonTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(7.5, 7.5, 1);
  moonGroup.add(coreSprite);

  const bloomMat = new THREE.SpriteMaterial({
    map: moonTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const bloomSprite = new THREE.Sprite(bloomMat);
  bloomSprite.scale.set(16.5, 16.5, 1);
  moonGroup.add(bloomSprite);

  scene.add(moonGroup);

  const moonLight = new THREE.DirectionalLight(0xdbeafe, 1.45);
  moonLight.position.copy(moonPos);
  moonLight.target.position.set(2.6, 0, 5.0);
  scene.add(moonLight);
  scene.add(moonLight.target);

  const moonPoint = new THREE.PointLight(0xc7d2fe, 1.7, 75, 1.2);
  moonPoint.position.copy(moonPos);
  scene.add(moonPoint);

  return { moonGroup, coreSprite, bloomSprite, moonLight };
}

// Tekstur Tanah Humus Alami untuk Bahu Jalan (Procedural Soil/Dirt Texture)
function createDirtTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Warna dasar tanah cokelat tua subur
  ctx.fillStyle = '#342114';
  ctx.fillRect(0, 0, 512, 512);

  // Butiran tanah, kerikil, dan arang
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = Math.random() * 2.4 + 0.8;
    const r = Math.random();
    if (r < 0.35) {
      ctx.fillStyle = '#1c1109'; // Tanah hitam / humus pekat
    } else if (r < 0.65) {
      ctx.fillStyle = '#422c1b'; // Tanah cokelat hangat
    } else if (r < 0.88) {
      ctx.fillStyle = '#523722'; // Lempung cokelat terang
    } else {
      ctx.fillStyle = '#22150c'; // Jelaga arang
    }
    ctx.fillRect(x, y, size, size);
  }

  // Bercak-bercak tanah organik alami
  for (let p = 0; p < 75; p++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const pr = Math.random() * 16 + 5;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, 'rgba(25, 14, 7, 0.45)');
    grad.addColorStop(1, 'rgba(52, 33, 20, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Tekstur partikel bara api bulat bercahaya
function createEmberTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 230, 1.0)');
  grad.addColorStop(0.25, 'rgba(255, 180, 45, 0.95)');
  grad.addColorStop(0.55, 'rgba(245, 80, 40, 0.65)');
  grad.addColorStop(1.0, 'rgba(180, 30, 20, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Tekstur partikel asap malam lembut
function createSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(40, 30, 35, 0.40)');
  grad.addColorStop(0.4, 'rgba(25, 20, 25, 0.20)');
  grad.addColorStop(0.8, 'rgba(15, 12, 18, 0.06)');
  grad.addColorStop(1.0, 'rgba(10, 8, 12, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function initForest() {
  // 1. Scene & Background Langit Malam Galaksi (Sama seperti di kota2)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010106);

  // 2. Camera
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(82, aspect, 0.05, 200);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Load Background 360° Galaksi Bima Sakti (Deep Space Galaxy 360° - Sama persis dengan kota2)
  const setupSkyTexture = (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const skyGeo = new THREE.SphereGeometry(95, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false
    });
    skySphere = new THREE.Mesh(skyGeo, skyMat);
    skySphere.rotation.order = 'ZXY';
    skySphere.rotation.z = -Math.PI / 2;
    skySphere.rotation.x = Math.PI * 0.42;
    scene.add(skySphere);
  };

  const galaxyTexLoader = new THREE.TextureLoader();
  galaxyTexLoader.load(
    './assets/hdr/galaxy_deep_space_1k.jpg',
    setupSkyTexture,
    undefined,
    () => {
      const exrLoader = new EXRLoader();
      exrLoader.setDataType(THREE.HalfFloatType);
      exrLoader.load('./assets/hdr/galaxy_deep_space_1k.exr', setupSkyTexture);
    }
  );

  // 4. OrbitControls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  setCameraView('surface');

  // 5. Pencahayaan Bulan & Suasana Malam Galaksi
  moonVisuals = createMoon(scene);

  const ambientLight = new THREE.AmbientLight(0x2a3b50, 0.85);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(
    0x38bdf8, // Kubah langit malam berbinar kebiruan lembut
    0x1c1917, // Pantulan tanah humus hutan & jalan
    0.65
  );
  scene.add(hemiLight);

  // 6. Tekstur Jalan Aspal & Logam
  const textureLoader = new THREE.TextureLoader();
  const roadColor = textureLoader.load('./assets/textures/road/color.jpg');
  roadColor.colorSpace = THREE.SRGBColorSpace;
  const roadNormal = textureLoader.load('./assets/textures/road/normal.jpg');
  const roadRoughness = textureLoader.load('./assets/textures/road/roughness.jpg');

  const metalColor = textureLoader.load('./assets/textures/metal/color.jpg');
  metalColor.colorSpace = THREE.SRGBColorSpace;
  const metalNormal = textureLoader.load('./assets/textures/metal/normal.jpg');
  const metalRoughness = textureLoader.load('./assets/textures/metal/roughness.jpg');
  const metalMetalness = textureLoader.load('./assets/textures/metal/metalness.jpg');

  [roadColor, roadNormal, roadRoughness].forEach((tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    tex.repeat.set(1.2, 7);
  });

  sideMaterial = new THREE.MeshStandardMaterial({
    map: roadColor,
    normalMap: roadNormal,
    roughnessMap: roadRoughness,
    roughness: 0.80,
    metalness: 0.1,
    wireframe: isWireframe
  });

  capMaterial = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    roughnessMap: metalRoughness,
    metalnessMap: metalMetalness,
    roughness: 0.40,
    metalness: 0.80,
    color: 0x475569,
    wireframe: isWireframe
  });

  standardMaterials = [sideMaterial, capMaterial, capMaterial];

  // 7A. Objek Utama: Tabung Drum Berputar
  const geom = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 32);
  mainMesh = new THREE.Mesh(geom, standardMaterials);
  scene.add(mainMesh);

  // Bibir Logam Tabung
  const rimGeo = new THREE.TorusGeometry(cylinderRadius + 0.02, 0.04, 16, 64);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3
  });

  const topRim = new THREE.Mesh(rimGeo, rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = cylinderHeight / 2;
  mainMesh.add(topRim);

  const bottomRim = new THREE.Mesh(rimGeo, rimMat);
  bottomRim.rotation.x = Math.PI / 2;
  bottomRim.position.y = -cylinderHeight / 2;
  mainMesh.add(bottomRim);

  // 7B. Bahu Jalan Tanah di Samping Kanan & Kiri Aspal (Dirt / Soil Shoulders)
  buildDirtShoulders();

  // 8. Bangun Pepohonan Hutan Rimba Lebat & Gundukan Tanah/Batu
  buildForestScenery();

  // 9. Sistem Partikel Bara Api (Embers) & Asap Malam
  buildEmbersAndSmoke();

  // 10. Load Model 3D Api (Skala Proporsional Ramping/Kecil)
  loadFireAssetsAndPopulate();
}

// -------------------------------------------------------------
// BAHU JALAN TANAH (DIRT / SOIL STRIPS & MOUNDS)
// -------------------------------------------------------------
function buildDirtShoulders() {
  const dirtTex = createDirtTexture();
  const dirtMat = new THREE.MeshStandardMaterial({
    map: dirtTex,
    roughness: 0.94,
    metalness: 0.04,
    bumpMap: dirtTex,
    bumpScale: 0.015
  });

  // Lebar bahu tanah dari tepi aspal (0.64) hingga ke batas tepi tabung (1.89)
  const dirtWidth = 1.25;

  // Tanah Sisi Kiri Jalan (+Y)
  const leftDirtGeo = new THREE.CylinderGeometry(
    cylinderRadius + 0.003,
    cylinderRadius + 0.003,
    dirtWidth,
    64,
    1,
    true
  );
  const leftDirt = new THREE.Mesh(leftDirtGeo, dirtMat);
  leftDirt.position.y = 0.64 + dirtWidth / 2; // Y = 1.265
  mainMesh.add(leftDirt);

  // Tanah Sisi Kanan Jalan (-Y)
  const rightDirtGeo = new THREE.CylinderGeometry(
    cylinderRadius + 0.003,
    cylinderRadius + 0.003,
    dirtWidth,
    64,
    1,
    true
  );
  const rightDirt = new THREE.Mesh(rightDirtGeo, dirtMat);
  rightDirt.position.y = -(0.64 + dirtWidth / 2); // Y = -1.265
  mainMesh.add(rightDirt);
}

// -------------------------------------------------------------
// POHON & PROPS HUTAN LEBAT (TETAP BANYAK POHON)
// -------------------------------------------------------------

// Pohon Cemara (Pinus) Proporsional
function createPineTree(state = 'burning') {
  const treeGroup = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.10, 1.25, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: state === 'unburnt' ? 0x452a1a : 0x1a1a1a,
    roughness: 0.95,
    emissive: state === 'burning' ? 0x3d0a0a : 0x000000,
    emissiveIntensity: 0.35
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.62;
  treeGroup.add(trunk);

  let c1, c2, c3;
  if (state === 'burning') {
    c1 = 0xb91c1c; // Merah membara
    c2 = 0xea580c; // Oranye api
    c3 = 0xd97706; // Kuning keemasan
  } else if (state === 'charred') {
    c1 = 0x1c1917;
    c2 = 0x262626;
    c3 = 0x1f1f1f;
  } else {
    // Alami hutan hijau asri di malam hari
    c1 = 0x14532d;
    c2 = 0x15803d;
    c3 = 0x166534;
  }

  const mat1 = new THREE.MeshStandardMaterial({
    color: c1,
    roughness: 0.7,
    flatShading: true,
    emissive: state === 'burning' ? 0x7f1d1d : 0x000000,
    emissiveIntensity: 0.3
  });
  const mat2 = new THREE.MeshStandardMaterial({
    color: c2,
    roughness: 0.65,
    flatShading: true,
    emissive: state === 'burning' ? 0x9a3412 : 0x000000,
    emissiveIntensity: 0.3
  });
  const mat3 = new THREE.MeshStandardMaterial({
    color: c3,
    roughness: 0.6,
    flatShading: true,
    emissive: state === 'burning' ? 0xb45309 : 0x000000,
    emissiveIntensity: 0.25
  });

  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.60, 7), mat1);
  cone1.position.y = 1.10;
  treeGroup.add(cone1);

  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.50, 7), mat2);
  cone2.position.y = 1.45;
  treeGroup.add(cone2);

  const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.40, 7), mat3);
  cone3.position.y = 1.75;
  treeGroup.add(cone3);

  return treeGroup;
}

// Pohon Daun Lebar (Oak) Rimbun Proporsional
function createBroadleafTree(state = 'burning') {
  const treeGroup = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.13, 1.35, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: state === 'unburnt' ? 0x3d2618 : 0x171412,
    roughness: 0.95,
    emissive: state === 'burning' ? 0x350901 : 0x000000,
    emissiveIntensity: 0.3
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.67;
  treeGroup.add(trunk);

  let cColor1, cColor2;
  if (state === 'burning') {
    cColor1 = 0xc2410c;
    cColor2 = 0x991b1b;
  } else if (state === 'charred') {
    cColor1 = 0x262626;
    cColor2 = 0x171717;
  } else {
    cColor1 = 0x166534;
    cColor2 = 0x15803d;
  }

  const foliageMat1 = new THREE.MeshStandardMaterial({
    color: cColor1,
    roughness: 0.75,
    flatShading: true,
    emissive: state === 'burning' ? 0x7c2d12 : 0x000000,
    emissiveIntensity: 0.35
  });
  const foliageMat2 = new THREE.MeshStandardMaterial({
    color: cColor2,
    roughness: 0.7,
    flatShading: true,
    emissive: state === 'burning' ? 0x991b1b : 0x000000,
    emissiveIntensity: 0.35
  });

  const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), foliageMat1);
  c1.position.set(0, 1.45, 0);
  treeGroup.add(c1);

  const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), foliageMat2);
  c2.position.set(0.14, 1.70, -0.08);
  treeGroup.add(c2);

  const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), foliageMat1);
  c3.position.set(-0.12, 1.62, 0.10);
  treeGroup.add(c3);

  return treeGroup;
}

// Tunggul Kayu Terbakar / Patah
function createCharredStump() {
  const stumpGroup = new THREE.Group();
  const height = 0.5 + Math.random() * 0.4;
  const stumpGeo = new THREE.CylinderGeometry(0.07, 0.11, height, 6);
  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.95,
    flatShading: true,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.45
  });
  const stump = new THREE.Mesh(stumpGeo, stumpMat);
  stump.position.y = height / 2;
  stump.rotation.z = (Math.random() - 0.5) * 0.2;
  stumpGroup.add(stump);

  const branchGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.30, 5);
  const branch = new THREE.Mesh(branchGeo, stumpMat);
  branch.position.set(0.06, height * 0.7, 0);
  branch.rotation.z = -Math.PI / 3;
  stumpGroup.add(branch);

  return stumpGroup;
}

function buildForestScenery() {
  forestGroup = new THREE.Group();
  mainMesh.add(forestGroup);

  const xAxis = new THREE.Vector3(0, -1, 0);

  // 1A. Pepohonan Baris Depan di Atas Bahu Tanah (46 Pohon Rimbun)
  const frontCount = 46;
  for (let i = 0; i < frontCount; i++) {
    const roll = Math.random();
    let state = 'burning';
    if (roll < 0.40) state = 'burning';
    else if (roll < 0.70) state = 'unburnt';
    else if (roll < 0.90) state = 'charred';
    else state = 'stump';

    const tree = (state === 'stump') ? createCharredStump() : ((i % 2 === 0) ? createPineTree(state) : createBroadleafTree(state));
    const side = (i % 2 === 0) ? 1 : -1;

    const theta = (i / frontCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.10 + Math.random() * 0.22); // Menancap kokoh di bahu tanah

    const scale = 0.75 + Math.random() * 0.25;
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = Math.random() * Math.PI * 2;

    const treeWrapper = new THREE.Group();
    treeWrapper.add(tree);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    treeWrapper.setRotationFromMatrix(basisMat);
    treeWrapper.position.set(posX, posY, posZ);

    forestGroup.add(treeWrapper);
  }

  // 1B. Pepohonan Baris Tengah / Belakang (58 Pohon Hutan Rimba Lebat)
  const backCount = 58;
  for (let k = 0; k < backCount; k++) {
    const isPine = (k % 2 === 0);
    const state = (k % 3 === 0) ? 'unburnt' : (k % 5 === 0) ? 'charred' : 'burning';
    const tree = isPine ? createPineTree(state) : createBroadleafTree(state);
    const side = (k % 2 === 0) ? 1 : -1;

    const theta = (k / backCount) * Math.PI * 2 + 0.05 + (Math.random() - 0.5) * 0.08;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.42 + Math.random() * 0.32);

    const scale = 0.90 + Math.random() * 0.30;
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = Math.random() * Math.PI * 2;

    const treeWrapper = new THREE.Group();
    treeWrapper.add(tree);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    treeWrapper.setRotationFromMatrix(basisMat);
    treeWrapper.position.set(posX, posY, posZ);

    forestGroup.add(treeWrapper);
  }

  // 1C. Pepohonan Luar Kanopi Rimba (70 Pohon Lebat Melampaui Batas)
  const outerCount = 70;
  for (let m = 0; m < outerCount; m++) {
    const state = (m % 2 === 0) ? 'unburnt' : 'burning';
    const tree = (m % 2 === 0) ? createBroadleafTree(state) : createPineTree(state);
    const side = (m % 2 === 0) ? 1 : -1;

    const theta = (m / outerCount) * Math.PI * 2 + (m % 5) * 0.06;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.78 + Math.random() * 0.55);

    const scale = 1.05 + Math.random() * 0.35;
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = Math.random() * Math.PI * 2;

    const treeWrapper = new THREE.Group();
    treeWrapper.add(tree);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    treeWrapper.setRotationFromMatrix(basisMat);
    treeWrapper.position.set(posX, posY, posZ);

    forestGroup.add(treeWrapper);
  }

  // 2. Gundukan & Ceceran Tanah 3D di Tepi Jalan (3D Dirt Mounds & Patches)
  const dirtMoundMat = new THREE.MeshStandardMaterial({
    color: 0x3d2616,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true
  });
  const darkDirtMoundMat = new THREE.MeshStandardMaterial({
    color: 0x27170c,
    roughness: 0.96,
    metalness: 0.05,
    flatShading: true
  });

  const dirtMoundCount = 42;
  for (let d = 0; d < dirtMoundCount; d++) {
    const theta = (d / dirtMoundCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const side = (Math.random() > 0.5) ? 1 : -1;
    // Berada tepat di pertemuan antara tepi aspal (0.64) dan bahu tanah (0.70 - 0.95)
    const posY = side * (0.66 + Math.random() * 0.28);

    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);

    // Bentuk gundukan tanah agak pipih menempel permukaan
    const moundGeo = new THREE.DodecahedronGeometry(0.12, 1);
    const moundMesh = new THREE.Mesh(moundGeo, (d % 2 === 0) ? dirtMoundMat : darkDirtMoundMat);

    const ms = 0.60 + Math.random() * 0.55;
    moundMesh.scale.set(
      ms * (1.0 + Math.random() * 0.4), // Melebar di sepanjang jalan
      ms * (0.35 + Math.random() * 0.25), // Pipih menempel tanah
      ms * (1.1 + Math.random() * 0.5)
    );
    moundMesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    const moundWrapper = new THREE.Group();
    moundWrapper.add(moundMesh);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    moundWrapper.setRotationFromMatrix(basisMat);
    moundWrapper.position.set(posX, posY, posZ);
    forestGroup.add(moundWrapper);
  }

  // 3. Bebatuan Hutan & Kerikil di Bahu Tanah
  const rockMats = [
    new THREE.MeshStandardMaterial({ color: 0x332822, roughness: 0.95, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.90, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.92, flatShading: true })
  ];
  const rockGeos = [
    new THREE.DodecahedronGeometry(0.10, 1),
    new THREE.DodecahedronGeometry(0.08, 0),
    new THREE.IcosahedronGeometry(0.09, 0)
  ];

  const totalRocks = 36;
  for (let j = 0; j < totalRocks; j++) {
    const theta = (j / totalRocks) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const side = (Math.random() > 0.5) ? 1 : -1;
    const posY = side * (0.80 + Math.random() * 0.35);

    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);

    const geo = rockGeos[Math.floor(Math.random() * rockGeos.length)];
    const mat = rockMats[Math.floor(Math.random() * rockMats.length)];
    const rockMesh = new THREE.Mesh(geo, mat);

    const rScale = 0.60 + Math.random() * 0.55;
    rockMesh.scale.set(
      rScale * (0.85 + Math.random() * 0.3),
      rScale * (0.65 + Math.random() * 0.35),
      rScale * (0.85 + Math.random() * 0.3)
    );
    rockMesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    const rockWrapper = new THREE.Group();
    rockWrapper.add(rockMesh);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    rockWrapper.setRotationFromMatrix(basisMat);
    rockWrapper.position.set(posX, posY, posZ);
    forestGroup.add(rockWrapper);
  }

  // 4. Sumber Cahaya Api Berkedip (Dynamic Flickering Firelights)
  const lightCount = 6;
  for (let l = 0; l < lightCount; l++) {
    const theta = (l / lightCount) * Math.PI * 2;
    const side = (l % 2 === 0) ? 1 : -1;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * 0.95;

    const fireLight = new THREE.PointLight(
      l % 2 === 0 ? 0xff6600 : 0xff4400,
      2.2,
      5.5,
      1.5
    );

    const lightWrapper = new THREE.Group();
    lightWrapper.position.set(posX, posY, posZ);
    lightWrapper.add(fireLight);

    fireLight.position.set(0.15, 0, 0);
    forestGroup.add(lightWrapper);

    dynamicFireLights.push({
      light: fireLight,
      baseIntensity: 2.2,
      speed: 8.0 + Math.random() * 6.0,
      offset: Math.random() * 10
    });
  }
}

// -------------------------------------------------------------
// SISTEM PARTIKEL BARA API & ASAP MALAM
// -------------------------------------------------------------
function buildEmbersAndSmoke() {
  const emberCount = 320;
  const emberGeo = new THREE.BufferGeometry();
  const emberPositions = new Float32Array(emberCount * 3);
  emberVelocities = [];

  for (let i = 0; i < emberCount; i++) {
    const i3 = i * 3;
    emberPositions[i3] = cylinderRadius + 0.1 + Math.random() * 3.2;
    emberPositions[i3 + 1] = (Math.random() - 0.5) * 3.8;
    emberPositions[i3 + 2] = -2.5 + Math.random() * 12.0;

    emberVelocities.push({
      vy: 0.012 + Math.random() * 0.022,
      vz: 0.010 + Math.random() * 0.018,
      turbulence: 1.5 + Math.random() * 3.0,
      phase: Math.random() * Math.PI * 2
    });
  }

  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));

  const emberMat = new THREE.PointsMaterial({
    map: createEmberTexture(),
    color: 0xffedd5,
    size: 0.14,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  emberParticles = new THREE.Points(emberGeo, emberMat);
  scene.add(emberParticles);

  // Asap malam halus
  const smokeCount = 70;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePositions = new Float32Array(smokeCount * 3);

  for (let s = 0; s < smokeCount * 3; s += 3) {
    smokePositions[s] = cylinderRadius + 0.3 + Math.random() * 3.5;
    smokePositions[s + 1] = (Math.random() - 0.5) * 4.0;
    smokePositions[s + 2] = -2.0 + Math.random() * 14.0;
  }

  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

  const smokeMat = new THREE.PointsMaterial({
    map: createSmokeTexture(),
    color: 0x3d2822,
    size: 1.5,
    transparent: true,
    opacity: 0.22,
    blending: THREE.NormalBlending,
    depthWrite: false
  });

  smokeParticles = new THREE.Points(smokeGeo, smokeMat);
  scene.add(smokeParticles);
}

// -------------------------------------------------------------
// LOAD MODEL 3D API DENGAN UKURAN LEBIH KECIL & PROPORSIONAL
// -------------------------------------------------------------
function loadFireAssetsAndPopulate() {
  const gltfLoader = new GLTFLoader();

  const p1 = gltfLoader.loadAsync('./assets/fire.glb');
  const p2 = gltfLoader.loadAsync('./assets/bomberman_fire.glb');

  Promise.all([p1, p2])
    .then(([gltfFire, gltfBomberman]) => {
      console.log('✅ Asset 3D Api Berhasil Dimuat:', gltfFire, gltfBomberman);

      setupFireModelMaterials(gltfFire.scene);
      const fireClip = gltfFire.animations && gltfFire.animations.length > 0 ? gltfFire.animations[0] : null;

      setupFireModelMaterials(gltfBomberman.scene);
      const bombermanClip = gltfBomberman.animations && gltfBomberman.animations.length > 0 ? gltfBomberman.animations[0] : null;

      spawnFireInstances(gltfFire.scene, fireClip, gltfBomberman.scene, bombermanClip);
    })
    .catch((err) => {
      console.error('⚠️ Gagal memuat asset model api:', err);
    });
}

function setupFireModelMaterials(rootScene) {
  rootScene.traverse((child) => {
    if (child.isMesh) {
      if (child.material) {
        child.material.transparent = true;
        child.material.depthWrite = false;
        child.material.side = THREE.DoubleSide;
        if (child.material.emissive) {
          child.material.emissive.setHex(0xff5500);
          child.material.emissiveIntensity = 1.3;
        }
      }
    }
  });
}

function spawnFireInstances(fireModel, fireClip, bombermanModel, bombermanClip) {
  const xAxis = new THREE.Vector3(0, -1, 0);

  // A. Api di Tepi Jalan / Bahu Tanah (Ukuran Agak Kecil & Pas Seperti Api Unggun)
  // 14 Titik Api Unggun di Atas Bahu Tanah
  const roadsideCount = 14;
  for (let r = 0; r < roadsideCount; r++) {
    const isBomberman = (r % 3 === 0);
    const sourceModel = isBomberman ? bombermanModel : fireModel;
    const clip = isBomberman ? bombermanClip : fireClip;

    const fireClone = SkeletonUtils.clone(sourceModel);
    setupFireModelMaterials(fireClone);

    const side = (r % 2 === 0) ? 1 : -1;
    const theta = (r / roadsideCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.10;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    // Berada pas di bahu tanah (0.76 - 0.96)
    const posY = side * (0.78 + Math.random() * 0.16);

    // SKALA DIBUAT LEBIH KECIL & PROPORSIONAL
    if (isBomberman) {
      // bomberman_fire: skala kecil proporsional (~35cm - 50cm tinggi api)
      const s = 0.0035 + Math.random() * 0.0018;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.02;
    } else {
      // fire.glb: skala kecil proporsional (~30cm - 45cm tinggi api)
      const s = 0.16 + Math.random() * 0.08;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.10; // Base api menempel pas di tanah
    }

    fireClone.rotation.y = Math.random() * Math.PI * 2;

    const wrapper = new THREE.Group();
    wrapper.add(fireClone);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    wrapper.setRotationFromMatrix(basisMat);
    wrapper.position.set(posX, posY, posZ);

    forestGroup.add(wrapper);

    if (clip) {
      const mixer = new THREE.AnimationMixer(fireClone);
      const action = mixer.clipAction(clip);
      action.time = Math.random() * clip.duration;
      action.timeScale = 0.85 + Math.random() * 0.35;
      action.play();
      animatedFireMixers.push(mixer);
    }
  }

  // B. Api di Pangkal & Batang Pohon Hutan
  // 10 Titik Api Menjilat Pangkal Pohon
  const treeFireCount = 10;
  for (let t = 0; t < treeFireCount; t++) {
    const isBomberman = (t % 2 === 0);
    const sourceModel = isBomberman ? bombermanModel : fireModel;
    const clip = isBomberman ? bombermanClip : fireClip;

    const fireClone = SkeletonUtils.clone(sourceModel);
    setupFireModelMaterials(fireClone);

    const side = (t % 2 === 0) ? 1 : -1;
    const theta = (t / treeFireCount) * Math.PI * 2 + 0.12 + (Math.random() - 0.5) * 0.12;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.18 + Math.random() * 0.35); // Di celah batang pohon

    if (isBomberman) {
      // Skala sedang di pangkal pohon (~55cm - 75cm)
      const s = 0.0055 + Math.random() * 0.0022;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.15;
    } else {
      // Skala sedang di pangkal pohon (~45cm - 60cm)
      const s = 0.24 + Math.random() * 0.09;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.16;
    }

    fireClone.rotation.y = Math.random() * Math.PI * 2;

    const wrapper = new THREE.Group();
    wrapper.add(fireClone);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    wrapper.setRotationFromMatrix(basisMat);
    wrapper.position.set(posX, posY, posZ);

    forestGroup.add(wrapper);

    if (clip) {
      const mixer = new THREE.AnimationMixer(fireClone);
      const action = mixer.clipAction(clip);
      action.time = Math.random() * clip.duration;
      action.timeScale = 0.90 + Math.random() * 0.30;
      action.play();
      animatedFireMixers.push(mixer);
    }
  }
}

// -------------------------------------------------------------
// KAMERA & INTERAKSI
// -------------------------------------------------------------
function setCameraView(mode) {
  cameraView = mode;
  if (cameraView === 'surface') {
    controls.enabled = false;
    camera.fov = 82;
    camera.updateProjectionMatrix();
    camera.up.set(1, 0, 0);
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, 0);
    const targetDist = 4.6;
    camera.lookAt(camX - Math.sin(basePitchDown) * targetDist, 0, Math.cos(basePitchDown) * targetDist);

    if (btnToggleCam) {
      btnToggleCam.textContent = '📷 Kamera: Di Selimut (Fixed Smooth)';
      btnToggleCam.style.borderColor = '#f97316';
      btnToggleCam.style.color = '#f97316';
    }
    infoDetail.textContent = 'Kamera tetap di selimut tabung | Hutan lebat, bahu tanah & langit galaksi malam';
  } else {
    controls.enabled = true;
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    camera.position.set(0, 4.5, 9.5);
    controls.target.set(0, 0, 0);
    controls.update();
    if (btnToggleCam) {
      btnToggleCam.textContent = '🛰️ Kamera: Luar (Orbit 3D)';
      btnToggleCam.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      btnToggleCam.style.color = '#cbd5e1';
    }
    infoDetail.textContent = 'Sudut pandang luar 3D | Drag mouse untuk orbit melihat tabung hutan galaksi';
  }
}

function onResize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// -------------------------------------------------------------
// LOOP ANIMASI UTAMA
// -------------------------------------------------------------
function animate(time) {
  requestAnimationFrame(animate);

  const delta = (time - lastTime) * 0.001;
  const elapsed = time * 0.001;
  lastTime = time;

  frameCount++;
  fpsTimer += delta;
  if (fpsTimer >= 0.5) {
    fpsDisplay.textContent = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }

  onResize();

  if (isAnimating) {
    mainMesh.rotation.y += delta * rollSpeed;

    if (forestGroup) {
      forestGroup.children.forEach((wrapper, idx) => {
        if (wrapper.children.length > 0 && wrapper.children[0].type === 'Group') {
          wrapper.children[0].rotation.z = Math.sin(elapsed * 2.0 + idx) * 0.025;
        }
      });
    }

    for (let i = 0; i < animatedFireMixers.length; i++) {
      animatedFireMixers[i].update(delta);
    }

    dynamicFireLights.forEach((fl) => {
      const flick = Math.sin(elapsed * fl.speed + fl.offset) * 0.28
                  + Math.sin(elapsed * 17.3 + fl.offset) * 0.12;
      fl.light.intensity = Math.max(0.5, fl.baseIntensity * (1.0 + flick));
    });

    if (emberParticles && emberParticles.geometry) {
      const pos = emberParticles.geometry.attributes.position.array;
      const count = pos.length / 3;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const vel = emberVelocities[i];

        pos[i3] += vel.vy;
        pos[i3 + 1] += Math.sin(elapsed * vel.turbulence + vel.phase) * 0.008;
        pos[i3 + 2] += vel.vz;

        if (pos[i3] > cylinderRadius + 4.2 || Math.abs(pos[i3 + 1]) > 2.8 || pos[i3 + 2] > 11.0) {
          pos[i3] = cylinderRadius + 0.1 + Math.random() * 0.6;
          pos[i3 + 1] = (Math.random() - 0.5) * 3.6;
          pos[i3 + 2] = -2.5 + Math.random() * 5.0;
        }
      }
      emberParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (smokeParticles && smokeParticles.geometry) {
      const sPos = smokeParticles.geometry.attributes.position.array;
      const sCount = sPos.length / 3;

      for (let s = 0; s < sCount; s++) {
        const s3 = s * 3;
        sPos[s3] += 0.006;
        sPos[s3 + 2] += 0.004;
        if (sPos[s3] > cylinderRadius + 4.5 || sPos[s3 + 2] > 14.0) {
          sPos[s3] = cylinderRadius + 0.2 + Math.random() * 0.8;
          sPos[s3 + 1] = (Math.random() - 0.5) * 4.0;
          sPos[s3 + 2] = -2.0 + Math.random() * 6.0;
        }
      }
      smokeParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  if (cameraView === 'surface') {
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, 0);
    camera.up.set(1, 0, 0);
    const targetDist = 4.6;
    camera.lookAt(camX - Math.sin(basePitchDown) * targetDist, 0, Math.cos(basePitchDown) * targetDist);
  } else {
    controls.update();
  }

  if (skySphere) {
    skySphere.position.copy(camera.position);
  }

  if (moonVisuals) {
    const pulse = 1.0 + Math.sin(time * 0.002) * 0.04;
    moonVisuals.coreSprite.scale.set(7.5 * pulse, 7.5 * pulse, 1);
    moonVisuals.bloomSprite.scale.set(16.5 * pulse, 16.5 * pulse, 1);
  }

  renderer.render(scene, camera);
}

// Event Listeners
btnToggleCam.addEventListener('click', () => {
  setCameraView(cameraView === 'surface' ? 'orbit' : 'surface');
});

btnToggleAnim.addEventListener('click', () => {
  isAnimating = !isAnimating;
  btnToggleAnim.textContent = isAnimating ? '⏸️ Pause (Space)' : '▶️ Play (Space)';
});

btnWireframe.addEventListener('click', () => {
  isWireframe = !isWireframe;
  sideMaterial.wireframe = isWireframe;
  capMaterial.wireframe = isWireframe;
  btnWireframe.textContent = isWireframe ? '🧊 Solid' : '🕸️ Wireframe';
});

btnSpeed.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % speedLevels.length;
  rollSpeed = speedLevels[speedIndex];
  btnSpeed.textContent = `⚡ Kecepatan Jalan: ${rollSpeed.toFixed(2)}x`;
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    btnToggleAnim.click();
  } else if (e.key.toLowerCase() === 'c') {
    btnToggleCam.click();
  }
});

initForest();
requestAnimationFrame(animate);
