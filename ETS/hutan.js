/**
 * ETS Grafika Komputer - Lingkungan 02: Hutan Kebakaran (Wildfire Forest)
 * Simulasi kebakaran hutan 3D dramatis di selimut tabung bergulir.
 * Dilengkapi model 3D api beranimasi (fire.glb & bomberman_fire.glb),
 * pohon terbakar & hangus, kabut asap tebal, bara api melayang (embers),
 * serta pencahayaan dinamis kobaran api (flickering firelight).
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
let sunVisuals;

// Koleksi animasi api & dynamic lighting
const animatedFireMixers = [];
const dynamicFireLights = [];
let emberVelocities = [];

// Tekstur Pendaran Matahari Terhalang Asap Tebal (Smoky Blood-Sun Glare)
function createWildfireSunTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256;
  const cy = 256;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 256);
  grad.addColorStop(0.00, 'rgba(255, 245, 220, 1.0)');  // Inti panas putih kekuningan
  grad.addColorStop(0.08, 'rgba(255, 150, 30, 0.95)');  // Pendaran oranye terang membara
  grad.addColorStop(0.22, 'rgba(240, 70, 35, 0.75)');   // Sinar merah membara
  grad.addColorStop(0.48, 'rgba(195, 35, 20, 0.35)');   // Pendaran merah padam berasap
  grad.addColorStop(0.75, 'rgba(130, 25, 15, 0.12)');   // Halo asap kebakaran luar
  grad.addColorStop(1.00, 'rgba(65, 12, 10, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Matahari Merah Membara di Ufuk Kebakaran
function createWildfireSun(scene) {
  const sunGroup = new THREE.Group();
  const sunPos = new THREE.Vector3(7.5, -2.8, 38.0);
  sunGroup.position.copy(sunPos);

  const sunTex = createWildfireSunTexture();

  // Inti pendaran matahari api
  const coreMat = new THREE.SpriteMaterial({
    map: sunTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(10.0, 10.0, 1);
  sunGroup.add(coreSprite);

  // Aura asap merah menyala luas di atmosfer
  const bloomMat = new THREE.SpriteMaterial({
    map: sunTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const bloomSprite = new THREE.Sprite(bloomMat);
  bloomSprite.scale.set(24.0, 24.0, 1);
  sunGroup.add(bloomSprite);

  scene.add(sunGroup);

  // Cahaya matahari menembus kabut asap tebal
  const sunLight = new THREE.DirectionalLight(0xff6b35, 1.5);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(2.6, 0, 5.0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Point light hangat di ufuk kebakaran
  const sunPoint = new THREE.PointLight(0xf97316, 2.2, 85, 1.1);
  sunPoint.position.copy(sunPos);
  scene.add(sunPoint);

  // Hemisphere Light: kubah atas oranye api, bawah tanah hitam abu
  const hemiLight = new THREE.HemisphereLight(
    0xfb923c, // Langit oranye api
    0x292524, // Tanah jelaga gelap
    0.80
  );
  scene.add(hemiLight);

  return { sunGroup, coreSprite, bloomSprite, sunLight };
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

// Tekstur partikel asap lembut
function createSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(75, 45, 40, 0.45)');
  grad.addColorStop(0.4, 'rgba(50, 30, 25, 0.25)');
  grad.addColorStop(0.8, 'rgba(30, 18, 15, 0.08)');
  grad.addColorStop(1.0, 'rgba(20, 10, 8, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function initForest() {
  // 1. Scene & Suasana Kebakaran
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x350e06);
  scene.fog = new THREE.Fog(0x350e06, 6.0, 45.0);

  // 2. Camera
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(82, aspect, 0.05, 200);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Background 360° Langit Senja / Sunset Hutan
  const exrLoader = new EXRLoader();
  exrLoader.setDataType(THREE.HalfFloatType);

  const setupSkyTexture = (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    scene.environment = texture;

    const skyGeo = new THREE.SphereGeometry(95, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      color: 0xff8c42,
      depthWrite: false
    });
    skySphere = new THREE.Mesh(skyGeo, skyMat);
    skySphere.rotation.order = 'ZXY';
    skySphere.rotation.z = -Math.PI / 2;
    skySphere.rotation.x = Math.PI * 0.48;
    skySphere.rotation.y = Math.PI * 1.35;
    scene.add(skySphere);
  };

  exrLoader.load('./assets/hdr/sunset_forest_warm_1k.exr', setupSkyTexture, undefined, () => {
    exrLoader.load('./assets/hdr/belfast_sunset_puresky_1k.exr', setupSkyTexture);
  });

  // 4. OrbitControls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  setCameraView('surface');

  // 5. Matahari & Pencahayaan Api
  sunVisuals = createWildfireSun(scene);

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
    roughness: 0.85,
    metalness: 0.1,
    color: 0xdf8464,
    wireframe: isWireframe
  });

  capMaterial = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    roughnessMap: metalRoughness,
    metalnessMap: metalMetalness,
    roughness: 0.45,
    metalness: 0.75,
    color: 0x4a1c06,
    emissive: 0x220700,
    wireframe: isWireframe
  });

  standardMaterials = [sideMaterial, capMaterial, capMaterial];

  // 7. Objek Utama: Tabung Drum Berputar
  const geom = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 32);
  mainMesh = new THREE.Mesh(geom, standardMaterials);
  scene.add(mainMesh);

  // Bibir Logam Tabung Membara
  const rimGeo = new THREE.TorusGeometry(cylinderRadius + 0.02, 0.04, 16, 64);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.75,
    metalness: 0.6,
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

  // 8. Bangun Pepohonan Hangus & Bebatuan Soot
  buildForestScenery();

  // 9. Sistem Partikel Bara Api & Asap
  buildEmbersAndSmoke();

  // 10. Load Model 3D Api Beranimasi (fire.glb & bomberman_fire.glb)
  loadFireAssetsAndPopulate();
}

// -------------------------------------------------------------
// POHON & PROPS HUTAN KEBAKARAN
// -------------------------------------------------------------

function createBurningPineTree(state = 'burning') {
  const treeGroup = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.10, 1.2, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: state === 'unburnt' ? 0x4a3224 : 0x1a1a1a,
    roughness: 0.95,
    emissive: state === 'burning' ? 0x450a0a : 0x000000,
    emissiveIntensity: 0.4
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.60;
  treeGroup.add(trunk);

  let color1, color2, color3;
  if (state === 'burning') {
    color1 = 0x991b1b;
    color2 = 0xea580c;
    color3 = 0xd97706;
  } else if (state === 'charred') {
    color1 = 0x1c1917;
    color2 = 0x262626;
    color3 = 0x1f1f1f;
  } else if (state === 'unburnt') {
    color1 = 0x14532d;
    color2 = 0x15803d;
    color3 = 0x166534;
  } else {
    color1 = 0x78350f;
    color2 = 0x9a3412;
    color3 = 0x3f1a07;
  }

  const mat1 = new THREE.MeshStandardMaterial({
    color: color1,
    roughness: 0.7,
    flatShading: true,
    emissive: state === 'burning' ? 0x7f1d1d : 0x000000,
    emissiveIntensity: 0.35
  });
  const mat2 = new THREE.MeshStandardMaterial({
    color: color2,
    roughness: 0.65,
    flatShading: true,
    emissive: state === 'burning' ? 0x9a3412 : 0x000000,
    emissiveIntensity: 0.35
  });
  const mat3 = new THREE.MeshStandardMaterial({
    color: color3,
    roughness: 0.6,
    flatShading: true,
    emissive: state === 'burning' ? 0xb45309 : 0x000000,
    emissiveIntensity: 0.3
  });

  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.60, 7), mat1);
  cone1.position.y = 1.05;
  treeGroup.add(cone1);

  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.50, 7), mat2);
  cone2.position.y = 1.40;
  treeGroup.add(cone2);

  const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.40, 7), mat3);
  cone3.position.y = 1.70;
  treeGroup.add(cone3);

  return treeGroup;
}

function createBurningBroadleafTree(state = 'burning') {
  const treeGroup = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.13, 1.35, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: state === 'unburnt' ? 0x3e281b : 0x171412,
    roughness: 0.95,
    emissive: state === 'burning' ? 0x3d0c02 : 0x000000,
    emissiveIntensity: 0.35
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
  } else if (state === 'unburnt') {
    cColor1 = 0x166534;
    cColor2 = 0x15803d;
  } else {
    cColor1 = 0xa16207;
    cColor2 = 0x7c2d12;
  }

  const foliageMat1 = new THREE.MeshStandardMaterial({
    color: cColor1,
    roughness: 0.75,
    flatShading: true,
    emissive: state === 'burning' ? 0x7c2d12 : 0x000000,
    emissiveIntensity: 0.4
  });
  const foliageMat2 = new THREE.MeshStandardMaterial({
    color: cColor2,
    roughness: 0.7,
    flatShading: true,
    emissive: state === 'burning' ? 0x991b1b : 0x000000,
    emissiveIntensity: 0.4
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

function createCharredStump() {
  const stumpGroup = new THREE.Group();
  const height = 0.5 + Math.random() * 0.4;
  const stumpGeo = new THREE.CylinderGeometry(0.07, 0.11, height, 6);
  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.95,
    flatShading: true,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.5
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

  // 1A. Pepohonan Tepi Jalan Terbakar (Front Row)
  const frontCount = 26;
  for (let i = 0; i < frontCount; i++) {
    const roll = Math.random();
    let tree;
    if (roll < 0.50) {
      tree = (i % 2 === 0) ? createBurningPineTree('burning') : createBurningBroadleafTree('burning');
    } else if (roll < 0.75) {
      tree = (i % 2 === 0) ? createBurningPineTree('charred') : createBurningBroadleafTree('charred');
    } else if (roll < 0.88) {
      tree = (i % 2 === 0) ? createBurningPineTree('unburnt') : createBurningBroadleafTree('unburnt');
    } else {
      tree = createCharredStump();
    }

    const side = (i % 2 === 0) ? 1 : -1;
    const theta = (i / frontCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.12 + Math.random() * 0.20);

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

  // 1B. Pepohonan Baris Belakang (Kobaran Api Rimba Luas)
  const backCount = 30;
  for (let k = 0; k < backCount; k++) {
    const isPine = (k % 2 === 0);
    const state = (k % 4 === 0) ? 'charred' : (k % 5 === 0) ? 'unburnt' : 'burning';
    const tree = isPine ? createBurningPineTree(state) : createBurningBroadleafTree(state);
    const side = (k % 2 === 0) ? 1 : -1;

    const theta = (k / backCount) * Math.PI * 2 + 0.05 + (Math.random() - 0.5) * 0.08;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.45 + Math.random() * 0.30);

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

  // 1C. Pepohonan Luar Melampaui Batas Tabung (Tirai Rimba Luar)
  const outerCount = 34;
  for (let m = 0; m < outerCount; m++) {
    const tree = (m % 2 === 0) ? createBurningBroadleafTree('burning') : createBurningPineTree('burning');
    const side = (m % 2 === 0) ? 1 : -1;

    const theta = (m / outerCount) * Math.PI * 2 + (m % 5) * 0.06;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.80 + Math.random() * 0.55);

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

  // 2. Bebatuan Hitam Hangus / Jelaga (Soot & Basalt Rocks)
  const charredRockMats = [
    new THREE.MeshStandardMaterial({ color: 0x221f1f, roughness: 0.95, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x332018, roughness: 0.90, flatShading: true, emissive: 0x330c00, emissiveIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92, flatShading: true })
  ];
  const rockGeos = [
    new THREE.DodecahedronGeometry(0.12, 1),
    new THREE.DodecahedronGeometry(0.09, 0),
    new THREE.IcosahedronGeometry(0.11, 0)
  ];

  const totalRocks = 36;
  for (let j = 0; j < totalRocks; j++) {
    const theta = (j / totalRocks) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const side = (Math.random() > 0.5) ? 1 : -1;
    const posY = side * (0.86 + Math.random() * 0.38);

    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);

    const geo = rockGeos[Math.floor(Math.random() * rockGeos.length)];
    const mat = charredRockMats[Math.floor(Math.random() * charredRockMats.length)];
    const rockMesh = new THREE.Mesh(geo, mat);

    const rScale = 0.65 + Math.random() * 0.60;
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

  // 3. Pasang 6 Sumber Cahaya Api Berkedip (Dynamic Flickering Firelights)
  const lightCount = 6;
  for (let l = 0; l < lightCount; l++) {
    const theta = (l / lightCount) * Math.PI * 2;
    const side = (l % 2 === 0) ? 1 : -1;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * 1.05;

    const fireLight = new THREE.PointLight(
      l % 2 === 0 ? 0xff5500 : 0xff3b00,
      2.5,
      6.0,
      1.5
    );

    const lightWrapper = new THREE.Group();
    lightWrapper.position.set(posX, posY, posZ);
    lightWrapper.add(fireLight);

    fireLight.position.set(0.2, 0, 0);
    forestGroup.add(lightWrapper);

    dynamicFireLights.push({
      light: fireLight,
      baseIntensity: 2.5,
      speed: 8.0 + Math.random() * 6.0,
      offset: Math.random() * 10
    });
  }
}

// -------------------------------------------------------------
// SISTEM PARTIKEL BARA API (EMBERS) & ASAP (SMOKE)
// -------------------------------------------------------------
function buildEmbersAndSmoke() {
  // 1. Partikel Bara Api (Flying Glowing Embers)
  const emberCount = 300;
  const emberGeo = new THREE.BufferGeometry();
  const emberPositions = new Float32Array(emberCount * 3);
  emberVelocities = [];

  for (let i = 0; i < emberCount; i++) {
    const i3 = i * 3;
    emberPositions[i3] = cylinderRadius + 0.1 + Math.random() * 3.0;
    emberPositions[i3 + 1] = (Math.random() - 0.5) * 3.6;
    emberPositions[i3 + 2] = -2.5 + Math.random() * 12.0;

    emberVelocities.push({
      vy: 0.015 + Math.random() * 0.025,
      vz: 0.010 + Math.random() * 0.020,
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

  // 2. Partikel Gumpalan Asap (Drifting Smoke Puffs)
  const smokeCount = 80;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePositions = new Float32Array(smokeCount * 3);

  for (let s = 0; s < smokeCount * 3; s += 3) {
    smokePositions[s] = cylinderRadius + 0.3 + Math.random() * 3.8;
    smokePositions[s + 1] = (Math.random() - 0.5) * 4.2;
    smokePositions[s + 2] = -2.0 + Math.random() * 14.0;
  }

  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

  const smokeMat = new THREE.PointsMaterial({
    map: createSmokeTexture(),
    color: 0x5c2418,
    size: 1.6,
    transparent: true,
    opacity: 0.28,
    blending: THREE.NormalBlending,
    depthWrite: false
  });

  smokeParticles = new THREE.Points(smokeGeo, smokeMat);
  scene.add(smokeParticles);
}

// -------------------------------------------------------------
// LOAD MODEL 3D API DARI FOLDER ASSET (fire.glb & bomberman_fire.glb)
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
          child.material.emissiveIntensity = 1.2;
        }
      }
    }
  });
}

function spawnFireInstances(fireModel, fireClip, bombermanModel, bombermanClip) {
  const xAxis = new THREE.Vector3(0, -1, 0);

  // A. Api Unggun / Kobaran Tepi Jalan (Roadside Flames)
  const roadsideCount = 12;
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
    const posY = side * (0.88 + Math.random() * 0.16);

    if (isBomberman) {
      const s = 0.007 + Math.random() * 0.003;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.04;
    } else {
      const s = 0.32 + Math.random() * 0.14;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.20;
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

  // B. Api Besar Melahap Pohon & Hutan Rimba Belakang (Tree & Canopy Flames)
  const treeFireCount = 8;
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
    const posY = side * (1.25 + Math.random() * 0.45);

    if (isBomberman) {
      const s = 0.010 + Math.random() * 0.004;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.38;
    } else {
      const s = 0.45 + Math.random() * 0.18;
      fireClone.scale.set(s, s, s);
      fireClone.position.y = 0.40;
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
      btnToggleCam.style.borderColor = '#ef4444';
      btnToggleCam.style.color = '#ef4444';
    }
    infoDetail.textContent = 'Kamera tetap di selimut tabung | Suasana kebakaran hutan & bara api melayang';
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
    infoDetail.textContent = 'Sudut pandang luar 3D | Drag mouse untuk orbit melihat tabung kebakaran';
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
          wrapper.children[0].rotation.z = Math.sin(elapsed * 2.2 + idx) * 0.030;
        }
      });
    }

    for (let i = 0; i < animatedFireMixers.length; i++) {
      animatedFireMixers[i].update(delta);
    }

    dynamicFireLights.forEach((fl) => {
      const flick = Math.sin(elapsed * fl.speed + fl.offset) * 0.28
                  + Math.sin(elapsed * 17.3 + fl.offset) * 0.12;
      fl.light.intensity = Math.max(0.6, fl.baseIntensity * (1.0 + flick));
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
        sPos[s3] += 0.007;
        sPos[s3 + 2] += 0.005;
        if (sPos[s3] > cylinderRadius + 4.8 || sPos[s3 + 2] > 14.0) {
          sPos[s3] = cylinderRadius + 0.2 + Math.random() * 0.8;
          sPos[s3 + 1] = (Math.random() - 0.5) * 4.2;
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

  if (sunVisuals) {
    const pulse = 1.0 + Math.sin(time * 0.003) * 0.06;
    sunVisuals.coreSprite.scale.set(10.0 * pulse, 10.0 * pulse, 1);
    sunVisuals.bloomSprite.scale.set(24.0 * pulse, 24.0 * pulse, 1);
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
