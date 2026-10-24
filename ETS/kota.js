/**
 * ETS Grafika Komputer - Lingkungan 01: Kota Metropolitan (City)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const canvas = document.getElementById('mainCanvas');
const fpsDisplay = document.getElementById('fpsDisplay');
const infoDetail = document.getElementById('infoDetail');

const btnToggleAnim = document.getElementById('btnToggleAnim');
const btnToggleCam = document.getElementById('btnToggleCam');
const btnWireframe = document.getElementById('btnWireframe');
const btnSpeed = document.getElementById('btnSpeed');
const btnFloodRestoration = document.getElementById('btnFloodRestoration');

let scene, camera, renderer, controls;
let mainMesh, sideMaterial, capMaterial, standardMaterials;
let cityBuildingsGroup;

// Sistem Air Banjir: Selimut Silindris Air Kaca (Cylindrical Water Sleeve) & Ombak 3D
let waterFloodGroup;
let waterCylinderMesh;
let waterGeo;
let waterInitialPositions = null;
let waterVertexCount = 0;
let waterMeniscusRings = [];
let waterNormalTex;
let waterMat;
let floodLevel = 1.0; // 1.0 = banjir penuh, 0.0 = surut kering
let floodState = 'flooded'; // 'flooded' | 'restoring' | 'cleared' | 'resurging'
const waterBaseRadius = 2.685; // Diameter 5.37 (tinggi air di atas aspal dan meluap merendam trotoar)
const waterTotalHeight = 3.78; // Menyelimuti penuh seluruh aspal dan kedua sisi trotoar kiri & kanan

const cylinderRadius = 2.6; // Diameter 5.2
const cylinderHeight = 3.8; // Diperlebar agar memuat 2 layer gedung (depan & belakang)
const eyeHeight = 0.54; // Posisi kamera agak dinaikkan sedikit untuk zoom-out yang proporsional
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

function createSunGlareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 256;

  // Gradien radial alami cahaya matahari murni tanpa batas/lingkaran konsentris
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 256);
  grad.addColorStop(0.00, 'rgba(255, 255, 245, 1.0)');  // Inti cahaya putih keemasan sangat terang
  grad.addColorStop(0.07, 'rgba(254, 240, 138, 0.95)'); // Pendaran kuning cerah
  grad.addColorStop(0.18, 'rgba(250, 204, 21, 0.65)');  // Sinar kuning hangat
  grad.addColorStop(0.38, 'rgba(245, 158, 11, 0.28)');  // Pendaran lembut keemasan
  grad.addColorStop(0.65, 'rgba(234, 179, 8, 0.08)');   // Haze luar halus
  grad.addColorStop(1.00, 'rgba(234, 179, 8, 0.0)');    // Memudar sempurna menyatu dengan langit

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMorningSun(scene, isForest = false) {
  const sunGroup = new THREE.Group();
  // Posisi di dalam background langit fajar di depan horizon jalan
  const sunPos = new THREE.Vector3(7.5, -2.5, 40.0);
  sunGroup.position.copy(sunPos);

  const sunTex = createSunGlareTexture();

  // 1. Inti Pendaran Cahaya Terang (Pure Light Glare - Tanpa Geometri Bola/Lingkaran)
  const coreMat = new THREE.SpriteMaterial({
    map: sunTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(8.5, 8.5, 1);
  sunGroup.add(coreSprite);

  // 2. Pendaran Aura Luar Udara (Wide Atmospheric Light Bloom)
  const bloomMat = new THREE.SpriteMaterial({
    map: sunTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const bloomSprite = new THREE.Sprite(bloomMat);
  bloomSprite.scale.set(18.0, 18.0, 1);
  sunGroup.add(bloomSprite);

  scene.add(sunGroup);

  // 3. Sumber Cahaya Matahari
  const sunLight = new THREE.DirectionalLight(0xfef08a, 1.6);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(2.6, 0, 5.0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Point Light pendar lokal matahari
  const sunPoint = new THREE.PointLight(0xfacc15, 2.0, 80, 1.1);
  sunPoint.position.copy(sunPos);
  scene.add(sunPoint);

  // Hemisphere Light alami fajar / pagi hari
  const hemiLight = new THREE.HemisphereLight(
    0xfef9c3,
    isForest ? 0x14532d : 0x334155,
    0.85
  );
  scene.add(hemiLight);

  return { sunGroup, coreSprite, bloomSprite, sunLight };
}



function initCity() {
  // 1. Scene & Sky (Qwantani Sunrise Pure Sky EXR)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfcd34d); // Warna dasar fajar matahari terbit

  // 2. Camera (FOV 82 untuk pandangan lebih zoom-out & cinematic)
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(82, aspect, 0.05, 200);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Load Background 360° Langit Berawan Cerah (Kloofendal Clouds / Qwantani Clouds EXR)
  const exrLoader = new EXRLoader();
  exrLoader.setDataType(THREE.HalfFloatType);

  const setupSkyTexture = (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    // scene.environment dinonaktifkan agar tidak memicu overhead komputasi PMREM sehingga FPS stabil di 60-90 FPS

    const skyGeo = new THREE.SphereGeometry(95, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false
    });
    skySphere = new THREE.Mesh(skyGeo, skyMat);
    skySphere.rotation.order = 'ZXY';
    skySphere.rotation.z = -Math.PI / 2; // Menyelaraskan zenith langit dengan UP kamera (+X)
    skySphere.rotation.x = Math.PI * 0.45;
    scene.add(skySphere);
  };

  exrLoader.load('./assets/hdr/kloofendal_clouds_1k.exr', setupSkyTexture, undefined, () => {
    exrLoader.load('./assets/hdr/qwantani_clouds_2k.exr', setupSkyTexture, undefined, () => {
      exrLoader.load('./assets/hdr/qwantani_sunrise_puresky_4k.exr', setupSkyTexture);
    });
  });

  // 4. OrbitControls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  setCameraView('surface');

  // 5. Pencahayaan & Objek Matahari Pagi Buatan Sendiri
  sunVisuals = createMorningSun(scene, false);

  const cityLight = new THREE.PointLight(0xf59e0b, 2.0, 24);
  cityLight.position.set(0, 6, 3);
  scene.add(cityLight);

  // 6. Sistem Bencana Banjir: Knot Air Kaca Transparan & Saluran Drainase Pemulihan
  createWaterFloodSystem(scene);

  // 7. Load Tekstur Road & Metal
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
    tex.repeat.set(1.2, 7); // Repeat proporsional untuk silinder lebar 3.8
  });

  sideMaterial = new THREE.MeshStandardMaterial({
    map: roadColor,
    normalMap: roadNormal,
    roughnessMap: roadRoughness,
    roughness: 0.65,
    metalness: 0.15,
    wireframe: isWireframe
  });

  capMaterial = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    roughnessMap: metalRoughness,
    metalnessMap: metalMetalness,
    roughness: 0.3,
    metalness: 0.85,
    wireframe: isWireframe
  });

  standardMaterials = [sideMaterial, capMaterial, capMaterial];

  // 8. Objek Utama: Tabung Drum Tegak Diameter Besar & Lebar
  const geom = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 32);
  mainMesh = new THREE.Mesh(geom, standardMaterials);
  scene.add(mainMesh);

  // Bibir Metal Tabung
  const rimGeo = new THREE.TorusGeometry(cylinderRadius + 0.02, 0.04, 16, 64);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

  const topRim = new THREE.Mesh(rimGeo, rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = cylinderHeight / 2;
  mainMesh.add(topRim);

  const bottomRim = new THREE.Mesh(rimGeo, rimMat);
  bottomRim.rotation.x = Math.PI / 2;
  bottomRim.position.y = -cylinderHeight / 2;
  mainMesh.add(bottomRim);

  // 9. Trotoar di Sisi Kiri & Kanan Jalan Tabung
  buildSidewalks();

  // 10. Bangunan Kota & Props dari Folder Assets (city & props)
  buildCityScenery();
}

function createWaterNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  // Bangkitkan peta normal gelombang permukaan air dinamis multi-frekuensi
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const u = (x / 512) * Math.PI * 10;
      const v = (y / 512) * Math.PI * 10;

      const du = Math.cos(u) * Math.cos(v) * 0.8 +
                 Math.cos(u * 2.1 + v * 1.6) * 0.45 -
                 Math.cos(-u * 1.8 + v * 2.8) * 0.25;

      const dv = -Math.sin(u) * Math.sin(v) * 0.8 +
                 Math.sin(u * 2.1 + v * 1.6) * 0.45 +
                 Math.sin(-u * 1.8 + v * 2.8) * 0.25;

      const nx = Math.min(255, Math.max(0, (-du * 0.35 + 0.5) * 255));
      const ny = Math.min(255, Math.max(0, (-dv * 0.35 + 0.5) * 255));
      const nz = 245;

      const idx = (y * 512 + x) * 4;
      data[idx] = nx;
      data[idx + 1] = ny;
      data[idx + 2] = nz;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 8);
  return tex;
}

function createWaterFloodSystem(scene) {
  waterFloodGroup = new THREE.Group();
  waterFloodGroup.position.set(0, 0, 0); // Berpusat sepusat dengan tabung kota di sumbu Y

  if (infoDetail) {
    infoDetail.textContent = '🌊 WASPADA BANJIR: Selimut air silindris meluap menutupi seluruh aspal jalanan dan trotoar kota!';
  }

  // 1. Tekstur Riak Gelombang Normal Air
  waterNormalTex = createWaterNormalTexture();

  // 2. Material Air Kaca Transparan & Indeks Bias Optik (MeshPhysicalMaterial)
  // Warna: Biru toska laut jernih (cyan / aqua marine 0x38bdf8)
  // Transmisi (Glass/Liquid Transmission): Semi-transparan tembus pandang
  // IOR (Index of Refraction): 1.333 (indeks bias air optik asli)
  waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.16,
    roughness: 0.04,
    metalness: 0.05,
    transmission: 0.88,         // Glass/Liquid Transmission: tembus pandang
    transparent: true,
    opacity: 0.94,
    ior: 1.333,                 // Indeks bias air optik asli
    thickness: 1.6,             // Kedalaman volume bias air
    specularIntensity: 1.0,
    specularColor: 0xffffff,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    normalMap: waterNormalTex,
    normalScale: new THREE.Vector2(0.35, 0.35)
  });

  // 3. Potongan Silindris Air (Cylinder Sleeve) & Mesh Ombak 3D
  // Menyelimuti penuh seluruh tabung: aspal jalan raya dan trotoar pejalan kaki di kedua sisi
  waterGeo = new THREE.CylinderGeometry(waterBaseRadius, waterBaseRadius, waterTotalHeight, 160, 64, true);
  const posAttr = waterGeo.attributes.position;
  waterVertexCount = posAttr.count;
  waterInitialPositions = new Float32Array(posAttr.array.length);
  waterInitialPositions.set(posAttr.array);

  waterCylinderMesh = new THREE.Mesh(waterGeo, waterMat);
  waterFloodGroup.add(waterCylinderMesh);

  // 4. Bibir Meniskus Air di Batas Ujung Luar Trotoar Kiri & Kanan (Y = ±waterTotalHeight / 2)
  const ringGeo = new THREE.RingGeometry(cylinderRadius, waterBaseRadius, 96);
  waterMeniscusRings = [];
  [-waterTotalHeight / 2, waterTotalHeight / 2].forEach((yPos) => {
    const ringMesh = new THREE.Mesh(ringGeo, waterMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = yPos;
    waterFloodGroup.add(ringMesh);
    waterMeniscusRings.push(ringMesh);
  });

  // 5. Saluran Drainase Jalan Kota (Street Storm Drains) di Tepi Aspal
  const drainGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24);
  const drainMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.3
  });
  const drainRingGeo = new THREE.RingGeometry(0.16, 0.22, 24);
  const drainRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7
  });

  // Pasang 6 titik saluran pembuangan di kedua sisi tepi jalan
  for (let i = 0; i < 6; i++) {
    const theta = (i / 6) * Math.PI * 2;
    [-0.72, 0.72].forEach((sideY) => {
      const drainWrapper = new THREE.Group();
      const drainMesh = new THREE.Mesh(drainGeo, drainMat);
      const ringMesh = new THREE.Mesh(drainRingGeo, drainRingMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.012;

      drainWrapper.add(drainMesh);
      drainWrapper.add(ringMesh);

      const dX = (cylinderRadius + 0.005) * Math.cos(theta);
      const dZ = (cylinderRadius + 0.005) * Math.sin(theta);
      drainWrapper.position.set(dX, sideY, dZ);

      drainWrapper.rotation.y = -theta;
      drainWrapper.rotation.z = Math.PI / 2;
      waterFloodGroup.add(drainWrapper);
    });
  }

  scene.add(waterFloodGroup);
}

function buildSidewalks() {
  const sidewalkGroup = new THREE.Group();

  // Tekstur Paving Blok Trotoar Kota
  const cvs = document.createElement('canvas');
  cvs.width = 512;
  cvs.height = 512;
  const ctx = cvs.getContext('2d');

  // Warna dasar beton trotoar
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 512, 512);

  // Noise tekstur permukaan semen
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  // Garis pola paving block trotoar
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Tepi trotoar (kerbstone) bercat hitam-putih
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 512, 24);
  ctx.fillStyle = '#f8fafc';
  for (let x = 0; x < 512; x += 64) {
    ctx.fillRect(x, 0, 32, 24);
  }

  const sidewalkTex = new THREE.CanvasTexture(cvs);
  sidewalkTex.wrapS = THREE.RepeatWrapping;
  sidewalkTex.wrapT = THREE.RepeatWrapping;
  sidewalkTex.repeat.set(16, 5);

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.8,
    metalness: 0.1
  });

  // Trotoar Kiri dan Kanan: Membentang penuh dari kerb jalan (0.83) sampai ke ujung belakang tabung (1.90)
  const sidewalkRadius = cylinderRadius + 0.018;
  const swWidth = (cylinderHeight / 2) - 0.83; // Lebar 1.07 mencakup gedung baris depan & belakang
  const swCenterY = 0.83 + (swWidth / 2); // Titik tengah 1.365

  const swGeo = new THREE.CylinderGeometry(sidewalkRadius, sidewalkRadius, swWidth, 64, 1, false);

  const leftSidewalk = new THREE.Mesh(swGeo, sidewalkMat);
  leftSidewalk.position.y = swCenterY;
  sidewalkGroup.add(leftSidewalk);

  const rightSidewalk = new THREE.Mesh(swGeo, sidewalkMat);
  rightSidewalk.position.y = -swCenterY;
  sidewalkGroup.add(rightSidewalk);

  // Kerb Rim (Bibir pembatas fisik trotoar dengan jalan)
  const kerbGeo = new THREE.TorusGeometry(sidewalkRadius, 0.015, 8, 64);
  const kerbMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.6,
    metalness: 0.3
  });

  const leftKerb = new THREE.Mesh(kerbGeo, kerbMat);
  leftKerb.rotation.x = Math.PI / 2;
  leftKerb.position.y = 0.83;
  sidewalkGroup.add(leftKerb);

  const rightKerb = new THREE.Mesh(kerbGeo, kerbMat);
  rightKerb.rotation.x = Math.PI / 2;
  rightKerb.position.y = -0.83;
  sidewalkGroup.add(rightKerb);

  mainMesh.add(sidewalkGroup);
}

// Membuat pohon taman kota prosedural (pohon rindang daun bulat & pohon cemara hias)
function createCityTree(variant = 0) {
  const treeGroup = new THREE.Group();

  // Batang pohon kayu
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 0.9, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.9,
    metalness: 0.05
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  if (variant % 2 === 0) {
    // 1. Pohon Rindang Kanopi Daun Bulat Asri (City Oak / Shade Tree)
    const foliageMat1 = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.7,
      flatShading: true
    });
    const foliageMat2 = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.65,
      flatShading: true
    });

    const f1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), foliageMat1);
    f1.position.set(0, 1.25, 0);
    f1.castShadow = true;
    treeGroup.add(f1);

    const f2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), foliageMat2);
    f2.position.set(0.18, 1.55, -0.12);
    f2.castShadow = true;
    treeGroup.add(f2);

    const f3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), foliageMat1);
    f3.position.set(-0.16, 1.48, 0.15);
    f3.castShadow = true;
    treeGroup.add(f3);
  } else {
    // 2. Pohon Cemara Hias Kota (Ornamental Cypress/Pine)
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x047857,
      roughness: 0.6,
      flatShading: true
    });

    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.85, 7), pineMat);
    c1.position.y = 1.0;
    c1.castShadow = true;
    treeGroup.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.40, 0.75, 7), pineMat);
    c2.position.y = 1.50;
    c2.castShadow = true;
    treeGroup.add(c2);

    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 7), pineMat);
    c3.position.y = 1.95;
    c3.castShadow = true;
    treeGroup.add(c3);
  }

  return treeGroup;
}

function buildCityScenery() {
  cityBuildingsGroup = new THREE.Group();
  mainMesh.add(cityBuildingsGroup); // Terpasang langsung ke tabung agar ikut berputar!

  const gltfLoader = new GLTFLoader();
  const xAxis = new THREE.Vector3(0, -1, 0);
  const sidewalkRadius = cylinderRadius + 0.018; // Berdiri di atas trotoar

  // 1A. Gedung Baris Depan (Di Atas Trotoar Samping Jalan)
  const frontCityModels = [
    { file: 'building-a.glb', scale: 0.46 },
    { file: 'building-b.glb', scale: 0.44 },
    { file: 'building-c.glb', scale: 0.48 },
    { file: 'building-d.glb', scale: 0.45 },
    { file: 'building-f.glb', scale: 0.42 },
    { file: 'building-h.glb', scale: 0.44 }
  ];

  frontCityModels.forEach((cfg, idx) => {
    gltfLoader.load(
      `./assets/models/city/${cfg.file}`,
      (gltf) => {
        const baseScene = gltf.scene;
        baseScene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        for (let copy = 0; copy < 3; copy++) {
          const clone = baseScene.clone();
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          const side = (copy % 2 === 0) ? 1 : -1;
          const theta = ((idx * 3 + copy) / (frontCityModels.length * 3)) * Math.PI * 2;
          const posX = sidewalkRadius * Math.cos(theta);
          const posZ = sidewalkRadius * Math.sin(theta);
          const posY = side * (1.12 + (idx % 2) * 0.04); // Baris depan di atas trotoar

          const bldgWrapper = new THREE.Group();
          bldgWrapper.add(clone);

          const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
          const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
          const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

          bldgWrapper.setRotationFromMatrix(basisMat);
          bldgWrapper.position.set(posX, posY, posZ);

          clone.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;

          cityBuildingsGroup.add(bldgWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load front city model:', cfg.file, err)
    );
  });

  // 1B. Gedung Baris Belakang (Skyline Pencakar Langit Megah di Belakang Gedung Depan)
  const backCityModels = [
    { file: 'building-skyscraper-a.glb', scale: 0.54 },
    { file: 'building-skyscraper-b.glb', scale: 0.50 },
    { file: 'building-skyscraper-c.glb', scale: 0.50 },
    { file: 'building-e.glb', scale: 0.56 },
    { file: 'building-g.glb', scale: 0.52 }
  ];

  backCityModels.forEach((cfg, idx) => {
    gltfLoader.load(
      `./assets/models/city/${cfg.file}`,
      (gltf) => {
        const baseScene = gltf.scene;
        baseScene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        // 4 salinan mengelilingi tabung di baris kedua
        for (let copy = 0; copy < 4; copy++) {
          const clone = baseScene.clone();
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          const side = (copy % 2 === 0) ? 1 : -1;
          const theta = ((idx * 4 + copy) / (backCityModels.length * 4)) * Math.PI * 2 + 0.06;
          const posX = cylinderRadius * Math.cos(theta);
          const posZ = cylinderRadius * Math.sin(theta);
          const posY = side * (1.56 + (idx % 3) * 0.06); // Posisi baris belakang di balik gedung trotoar

          const bldgWrapper = new THREE.Group();
          bldgWrapper.add(clone);

          const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
          const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
          const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

          bldgWrapper.setRotationFromMatrix(basisMat);
          bldgWrapper.position.set(posX, posY, posZ);

          clone.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;

          cityBuildingsGroup.add(bldgWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load back city model:', cfg.file, err)
    );
  });

  // 1C. Rumah-Rumah Warga Asli dari Folder Asset (rumah1.glb, rumah2.glb, rumah3.glb)
  const houseConfigs = [
    { file: 'rumah1.glb', scale: 0.42, yOffset: 1.18, rotY: 0 },
    { file: 'rumah2.glb', scale: 0.17, yOffset: 1.16, rotY: 0 },
    { file: 'rumah3.glb', scale: 0.18, yOffset: 1.15, rotY: 0 }
  ];

  houseConfigs.forEach((hCfg, hIdx) => {
    const onHouseLoaded = (gltf) => {
      const baseScene = gltf.scene;
      // Hitung bounding box agar dasar rumah menempel rata tepat di atas permukaan trotoar
      const box = new THREE.Box3().setFromObject(baseScene);
      baseScene.position.y -= box.min.y;

      baseScene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) {
            node.material.roughness = Math.min(node.material.roughness, 0.75);
          }
        }
      });

      // Buat 4 salinan tiap model rumah mengelilingi tabung di sisi trotoar
      for (let copy = 0; copy < 4; copy++) {
        const clone = baseScene.clone(true);
        clone.scale.set(hCfg.scale, hCfg.scale, hCfg.scale);

        const side = (copy % 2 === 0) ? 1 : -1;
        // Penempatan berselang-seling indah di antara gedung-gedung kota
        const theta = ((hIdx * 4 + copy) / (houseConfigs.length * 4)) * Math.PI * 2 + 0.18;
        const posX = sidewalkRadius * Math.cos(theta);
        const posZ = sidewalkRadius * Math.sin(theta);
        const posY = side * (hCfg.yOffset + (hIdx % 2) * 0.04);

        const houseWrapper = new THREE.Group();
        houseWrapper.add(clone);

        const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
        const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
        const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

        houseWrapper.setRotationFromMatrix(basisMat);
        houseWrapper.position.set(posX, posY, posZ);

        // Hadapkan fasad rumah ke arah tengah aspal jalan
        clone.rotation.y = (side === 1) ? (Math.PI / 2 + hCfg.rotY) : (-Math.PI / 2 + hCfg.rotY);

        cityBuildingsGroup.add(houseWrapper);
      }
    };

    gltfLoader.load(
      `./assets/models/houses/${hCfg.file}`,
      onHouseLoaded,
      undefined,
      () => {
        gltfLoader.load(
          `./assets/${hCfg.file}`,
          onHouseLoaded,
          undefined,
          (err) => console.warn('Could not load house model:', hCfg.file, err)
        );
      }
    );
  });

  // 1D. Pepohonan Rimbun Kota di Trotoar & Penutup Batas Ujung Tabung
  const treeCount = 72;
  for (let t = 0; t < treeCount; t++) {
    const tree = createCityTree(t);
    const side = (t % 2 === 0) ? 1 : -1;

    // Berselang-seling: sebagian di trotoar tengah, mayoritas di batas luar (Y = 1.62 - 2.05) untuk menutupi batas tabung
    const isPerimeter = (t % 3 !== 0);
    const yOffset = isPerimeter ? (1.64 + (t % 5) * 0.08) : (1.08 + (t % 4) * 0.05);

    const theta = (t / treeCount) * Math.PI * 2 + (t % 7) * 0.04;
    const posX = sidewalkRadius * Math.cos(theta);
    const posZ = sidewalkRadius * Math.sin(theta);
    const posY = side * yOffset;

    const scale = isPerimeter ? (0.88 + (t % 4) * 0.16) : (0.68 + (t % 3) * 0.12);
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = (t * 1.37) % (Math.PI * 2);

    const treeWrapper = new THREE.Group();
    treeWrapper.add(tree);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    treeWrapper.setRotationFromMatrix(basisMat);
    treeWrapper.position.set(posX, posY, posZ);

    cityBuildingsGroup.add(treeWrapper);
  }

  // 1E. Dinding Pencakar Langit Rapat di Batas Luar Tabung (Perimeter Skyline Wall)
  // Menutup penuh batas ujung tabung dengan skyline megah menjulang tinggi
  const perimeterModels = [
    { file: 'building-skyscraper-a.glb', scale: 0.72 },
    { file: 'building-skyscraper-b.glb', scale: 0.68 },
    { file: 'building-skyscraper-c.glb', scale: 0.70 },
    { file: 'building-e.glb', scale: 0.74 },
    { file: 'building-g.glb', scale: 0.68 },
    { file: 'building-c.glb', scale: 0.64 },
    { file: 'building-d.glb', scale: 0.62 }
  ];

  perimeterModels.forEach((cfg, pIdx) => {
    gltfLoader.load(
      `./assets/models/city/${cfg.file}`,
      (gltf) => {
        const baseScene = gltf.scene;
        baseScene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        // 6 salinan tiap model diposisikan rapat di batas luar (Y = 1.74 - 2.15)
        for (let copy = 0; copy < 6; copy++) {
          const clone = baseScene.clone();
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          const side = (copy % 2 === 0) ? 1 : -1;
          const theta = ((pIdx * 6 + copy) / (perimeterModels.length * 6)) * Math.PI * 2 + 0.05;
          const posX = cylinderRadius * Math.cos(theta);
          const posZ = cylinderRadius * Math.sin(theta);
          const posY = side * (1.76 + (copy % 4) * 0.10); // Menutupi tepat batas ujung tabung

          const bldgWrapper = new THREE.Group();
          bldgWrapper.add(clone);

          const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
          const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
          const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

          bldgWrapper.setRotationFromMatrix(basisMat);
          bldgWrapper.position.set(posX, posY, posZ);

          clone.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;

          cityBuildingsGroup.add(bldgWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load perimeter city model:', cfg.file, err)
    );
  });

  // 2. Daftar Model Props Asli dari assets/models/props/
  const propConfigs = [
    { file: 'traffic-light.glb', scale: 0.62, count: 14, yOffset: 0.87 },
    { file: 'light-square.glb', scale: 0.60, count: 20, yOffset: 0.88 },
    { file: 'construction-cone.glb', scale: 1.35, count: 12, yOffset: 0.84 },
    { file: 'construction-barrier.glb', scale: 1.15, count: 8, yOffset: 0.86 },
    { file: 'barrier.glb', scale: 0.13, count: 8, yOffset: 1.05 }
  ];

  propConfigs.forEach((pCfg) => {
    gltfLoader.load(
      `./assets/models/props/${pCfg.file}`,
      (gltf) => {
        const propModel = gltf.scene;
        propModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (pCfg.file === 'light-square.glb' && node.material) {
              node.material = node.material.clone();
              node.material.emissive = new THREE.Color(0xfef08a);
              node.material.emissiveIntensity = 0.5;
            }
          }
        });

        for (let k = 0; k < pCfg.count; k++) {
          const clone = propModel.clone();
          clone.scale.set(pCfg.scale, pCfg.scale, pCfg.scale);

          const side = (k % 2 === 0) ? 1 : -1;
          const theta = (k / pCfg.count) * Math.PI * 2 + (side * 0.04);
          const posX = sidewalkRadius * Math.cos(theta);
          const posZ = sidewalkRadius * Math.sin(theta);
          const posY = side * pCfg.yOffset; // Di tepi pembatas trotoar

          const propWrapper = new THREE.Group();
          propWrapper.add(clone);

          const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
          const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
          const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

          propWrapper.setRotationFromMatrix(basisMat);
          propWrapper.position.set(posX, posY, posZ);

          // Hadapkan tiang lampu jalan ke arah tengah aspal jalan
          if (pCfg.file === 'light-square.glb') {
            clone.rotation.y = (side === 1) ? -Math.PI / 2 : Math.PI / 2;
          } else {
            clone.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;
          }

          cityBuildingsGroup.add(propWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load prop:', pCfg.file, err)
    );
  });
}

function setCameraView(mode) {
  cameraView = mode;
  if (cameraView === 'surface') {
    controls.enabled = false;
    camera.fov = 82; // Zoom out sudut pandang lebar
    camera.updateProjectionMatrix();
    camera.up.set(1, 0, 0);
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, 0);
    const targetDist = 4.6;
    camera.lookAt(camX - Math.sin(basePitchDown) * targetDist, 0, Math.cos(basePitchDown) * targetDist);

    if (btnToggleCam) {
      btnToggleCam.textContent = '📷 Kamera: Di Selimut (Fixed Smooth)';
      btnToggleCam.style.borderColor = '#22d3ee';
      btnToggleCam.style.color = '#22d3ee';
    }
    if (infoDetail) {
      if (floodState === 'flooded') {
        infoDetail.textContent = '🌊 WASPADA BANJIR: Pusaran knot air raksasa menggenangi aspal jalanan kota!';
      } else if (floodState === 'cleared') {
        infoDetail.textContent = '✨ KOTA PULIH! Pusaran air banjir tersedot habis ke saluran drainase. Jalanan kembali kering & bersih!';
      } else {
        infoDetail.textContent = 'Kamera tetap di selimut tabung kota | Putaran jalan mulus (Smooth)';
      }
    }
  } else {
    controls.enabled = true;
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    camera.position.set(0, 4.0, 8.5);
    controls.target.set(0, 0, 0);
    controls.update();
    if (btnToggleCam) {
      btnToggleCam.textContent = '🛰️ Kamera: Luar (Orbit 3D)';
      btnToggleCam.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      btnToggleCam.style.color = '#cbd5e1';
    }
    infoDetail.textContent = 'Sudut pandang luar 3D | Drag mouse untuk orbit';
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

function animate(time) {
  requestAnimationFrame(animate);

  const delta = (time - lastTime) * 0.001;
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

  // Pendaran halus denyut cahaya matahari alami
  if (sunVisuals) {
    const pulse = 1.0 + Math.sin(time * 0.002) * 0.04;
    sunVisuals.coreSprite.scale.set(8.5 * pulse, 8.5 * pulse, 1);
    sunVisuals.bloomSprite.scale.set(18.0 * pulse, 18.0 * pulse, 1);
  }

function updateWaterWaves(time, currentFloodLevel) {
  if (!waterGeo || !waterInitialPositions) return;

  const posAttr = waterGeo.attributes.position;
  const arr = posAttr.array;
  const initArr = waterInitialPositions;
  const t = time * 0.001;

  // Ombak dinamis 3D yang bergulung di atas tabung jalan dan trotoar
  // Amplitudo ombak membesar saat banjir dan mengecil saat surut
  const waveAmp = 0.034 * currentFloodLevel;
  const currentBaseRadius = cylinderRadius + (waterBaseRadius - cylinderRadius) * currentFloodLevel;

  for (let i = 0; i < waterVertexCount; i++) {
    const idx = i * 3;
    const x0 = initArr[idx];
    const y0 = initArr[idx + 1];
    const z0 = initArr[idx + 2];

    const theta = Math.atan2(z0, x0);

    // Formulasi ombak multi-harmonis bergulung:
    // 1. Gulungan ombak utama melingkari silinder jalan
    const wave1 = Math.sin(theta * 8.0 + t * 3.5) * 0.55;
    // 2. Ombak bersilang melintang kiri-kanan trotoar
    const wave2 = Math.sin(theta * 14.0 - y0 * 3.8 + t * 4.8) * 0.32;
    // 3. Riak gelombang permukaan cepat (chop)
    const wave3 = Math.cos(theta * 22.0 + y0 * 7.5 + t * 6.5) * 0.13;

    const totalWave = (wave1 + wave2 + wave3) * waveAmp;
    const r = currentBaseRadius + totalWave;

    arr[idx] = Math.cos(theta) * r;
    arr[idx + 1] = y0;
    arr[idx + 2] = Math.sin(theta) * r;
  }

  posAttr.needsUpdate = true;
  waterGeo.computeVertexNormals();
}

  // Animasi Selimut Silindris Air Kaca & Cutscene Pemulihan Lingkungan (Restoration)
  if (waterFloodGroup && waterCylinderMesh) {
    if (floodState === 'flooded') {
      floodLevel = 1.0;
      waterFloodGroup.visible = true;
      if (waterMat) waterMat.opacity = 0.94;

      // Simulasi ombak 3D bergulung
      updateWaterWaves(time, 1.0);

      // Aliran riak gelombang normal map dinamis
      if (waterNormalTex) {
        waterNormalTex.offset.x += delta * 0.09;
        waterNormalTex.offset.y += delta * 0.04;
      }

      waterMeniscusRings.forEach(r => r.scale.set(1, 1, 1));

      // Putaran arus air lembut menyelimuti tabung
      waterFloodGroup.rotation.y += delta * 0.03;
    } else if (floodState === 'restoring') {
      // Cutscene: Air banjir surut meresap/tersedot masuk ke saluran drainase kota
      floodLevel = Math.max(0, floodLevel - delta * 0.45);

      // Ombak mereda seiring surutnya air
      updateWaterWaves(time, floodLevel);

      // Riak air mengalir lebih cepat saat tersedot ke saluran
      if (waterNormalTex) {
        waterNormalTex.offset.x += delta * 0.45;
        waterNormalTex.offset.y += delta * 0.25;
      }

      const currentRadius = cylinderRadius + (waterBaseRadius - cylinderRadius) * floodLevel;
      const s = currentRadius / waterBaseRadius;
      waterMeniscusRings.forEach(r => r.scale.set(s, s, 1));

      // Opasitas air memudar halus saat surut habis
      if (waterMat) {
        waterMat.opacity = Math.max(0, floodLevel * 0.94);
      }

      if (floodLevel <= 0.015) {
        floodLevel = 0;
        waterFloodGroup.visible = false;
        floodState = 'cleared';
        if (infoDetail) {
          infoDetail.textContent = '✨ KOTA PULIH! Seluruh genangan banjir telah surut dan tersedot ke saluran drainase. Jalanan kembali kering & bersih!';
        }
        if (btnFloodRestoration) {
          btnFloodRestoration.textContent = '🌊 Datangkan Banjir Kembali';
          btnFloodRestoration.style.borderColor = '#38bdf8';
          btnFloodRestoration.style.color = '#38bdf8';
        }
      }
    } else if (floodState === 'resurging') {
      // Air banjir meluap kembali dari saluran air kota menutupi aspal
      waterFloodGroup.visible = true;
      floodLevel = Math.min(1.0, floodLevel + delta * 0.65);

      updateWaterWaves(time, floodLevel);

      const currentRadius = cylinderRadius + (waterBaseRadius - cylinderRadius) * floodLevel;
      const s = currentRadius / waterBaseRadius;
      waterMeniscusRings.forEach(r => r.scale.set(s, s, 1));
      if (waterMat) {
        waterMat.opacity = floodLevel * 0.94;
      }

      if (floodLevel >= 0.99) {
        floodLevel = 1.0;
        floodState = 'flooded';
        if (infoDetail) {
          infoDetail.textContent = '🌊 WASPADA BANJIR: Selimut air silindris berombak meluap menutupi seluruh aspal jalanan dan trotoar kota!';
        }
        if (btnFloodRestoration) {
          btnFloodRestoration.textContent = '🌊 Pulihkan Banjir (Cutscene)';
          btnFloodRestoration.style.borderColor = '#38bdf8';
          btnFloodRestoration.style.color = '#38bdf8';
        }
      }
    }
  }

  renderer.render(scene, camera);
}

// Controls
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

function triggerFloodRestoration() {
  if (floodState === 'flooded') {
    floodState = 'restoring';
    if (infoDetail) {
      infoDetail.textContent = '🌊 CUTSCENE: Air banjir silindris surut menyusut & tersedot masuk ke saluran drainase kota...';
    }
    if (btnFloodRestoration) {
      btnFloodRestoration.textContent = '⏳ Memulihkan Kota...';
      btnFloodRestoration.style.borderColor = '#facc15';
      btnFloodRestoration.style.color = '#facc15';
    }
  } else if (floodState === 'cleared') {
    floodState = 'resurging';
    if (infoDetail) {
      infoDetail.textContent = '🌊 Air banjir meluap kembali dari saluran air kota!';
    }
    if (btnFloodRestoration) {
      btnFloodRestoration.textContent = '⏳ Air Banjir Meluap...';
      btnFloodRestoration.style.borderColor = '#facc15';
      btnFloodRestoration.style.color = '#facc15';
    }
  }
}

if (btnFloodRestoration) {
  btnFloodRestoration.addEventListener('click', triggerFloodRestoration);
}

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    btnToggleAnim.click();
  } else if (e.key.toLowerCase() === 'c') {
    btnToggleCam.click();
  } else if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'r') {
    triggerFloodRestoration();
  }
});

initCity();
requestAnimationFrame(animate);
