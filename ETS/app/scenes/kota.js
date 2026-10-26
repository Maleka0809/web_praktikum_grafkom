/**
 * ETS Grafika Komputer - Lingkungan 01: Kota Metropolitan (City)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GateManager } from '../game/gates.js';
import { changeArmyElement } from '../game/army-element.js';
import { MonsterManager } from '../game/monster.js';

const canvas = document.getElementById('mainCanvas');
const fpsDisplay = document.getElementById('fpsDisplay');
const infoDetail = document.getElementById('infoDetail');

const btnToggleAnim = document.getElementById('btnToggleAnim');
const btnToggleCam = document.getElementById('btnToggleCam');
const btnWireframe = document.getElementById('btnWireframe');
const btnSpeed = document.getElementById('btnSpeed');
const btnFloodRestoration = document.getElementById('btnFloodRestoration');
const btnSpawnMonster = document.getElementById('btnSpawnMonster');
const btnLaneLeft = document.getElementById('btnLaneLeft');
const btnLaneRight = document.getElementById('btnLaneRight');

// Avatar Karakter GLB: Firerun + Animasi Lari (Runner) - Hanya 2 Jalur: Kiri (-0.21) & Kanan (+0.21)
let avatarGroup, avatarModel, avatarMixer, avatarRunAction;
let avatarLaneY = -0.21;
let avatarTargetLaneY = -0.21;
const avatarBaseTargetZ = 0.15;
let splashParticles = null;
let splashVelocities = null;
let gateManager = null;
let monsterManager = null;

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
const waterBaseRadius = 2.66; // Genangan sekitar 6 cm di atas jalan, setinggi mata kaki karakter.
const waterTotalHeight = 3.78; // Menyelimuti penuh seluruh aspal dan kedua sisi trotoar kiri & kanan

const cylinderRadius = 2.6; // Diameter 5.2
const cylinderHeight = 3.8; // Diperlebar agar memuat 2 layer gedung (depan & belakang)
const eyeHeight = 1.18; // Posisi kamera di atas avatar agar lintasan jalan dan rintangan/gate terlihat jelas
const basePitchDown = 34.5 * (Math.PI / 180); // Sudut kamera menunduk (pitch down) lebih jelas ke permukaan jalan
const camZOffset = -0.74; // Ruang lega ke belakang agar seluruh barisan pasukan ukuran sama 2 banjar terlihat rapi

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
    opacity: 0.80,
    depthWrite: false
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(7.5, 7.5, 1);
  sunGroup.add(coreSprite);

  // 2. Pendaran Aura Luar Udara (Wide Atmospheric Light Bloom)
  const bloomMat = new THREE.SpriteMaterial({
    map: sunTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.22,
    depthWrite: false
  });
  const bloomSprite = new THREE.Sprite(bloomMat);
  bloomSprite.scale.set(12.0, 12.0, 1);
  sunGroup.add(bloomSprite);

  scene.add(sunGroup);

  // 3. Sumber Cahaya Matahari
  const sunLight = new THREE.DirectionalLight(0xfef08a, 1.6);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(2.6, 0, 5.0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Point Light pendar lokal matahari
  const sunPoint = new THREE.PointLight(0xfacc15, 1.2, 80, 1.1);
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




function createAvatarSplashEffect(parentGroup) {
  const count = 45;
  const geom = new THREE.BufferGeometry();
  const splashPositions = new Float32Array(count * 3);
  splashVelocities = [];

  for (let i = 0; i < count; i++) {
    splashPositions[i * 3 + 0] = (Math.random() - 0.5) * 0.10;
    splashPositions[i * 3 + 1] = Math.random() * 0.08;
    splashPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.10;
    splashVelocities.push({
      x: (Math.random() - 0.5) * 0.25,
      y: 0.12 + Math.random() * 0.28,
      z: -0.15 - Math.random() * 0.35,
      life: Math.random()
    });
  }

  geom.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xbae6fd,
    size: 0.012,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  splashParticles = new THREE.Points(geom, mat);
  splashParticles.visible = false;
  parentGroup.add(splashParticles);
}

function createRunnerAvatar(scene) {
  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);

  const targetZ = avatarBaseTargetZ;
  const surfaceX = Math.sqrt(cylinderRadius * cylinderRadius - targetZ * targetZ);
  const normal = new THREE.Vector3(surfaceX, 0, targetZ).normalize();
  const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
  const binormal = new THREE.Vector3(0, 1, 0);

  // Basis transform untuk firerun.glb:
  // Model UP (+Y) -> normal (+X)
  // Model FORWARD (+Z) -> tangent (+Z)
  // Model RIGHT (-X) -> -binormal (+Y)
  const rotMatrix = new THREE.Matrix4();
  rotMatrix.makeBasis(binormal.clone().negate(), normal, tangent);
  avatarGroup.setRotationFromMatrix(rotMatrix);
  avatarGroup.position.set(surfaceX, 0, targetZ);

  const gltfLoader = new GLTFLoader();
  gltfLoader.load('./assets/firerun.glb', (gltf) => {
    avatarModel = gltf.scene;
    // Skala lebih kecil & pas (~15.5cm di silinder 5.2m, dekat kamera)
    const s = 0.038;
    avatarModel.scale.set(s, s, s);
    avatarModel.position.y = 0.009; // Menapak pas di atas aspal jalan raya

    avatarModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.50;
          child.material.metalness = 0.10;
        }
      }
    });

    avatarGroup.add(avatarModel);

    // Rim/Key light lokal agar avatar terlihat tajam & berdefinisi
    const charSpot = new THREE.PointLight(0xffedd5, 1.0, 2.0);
    charSpot.position.set(0.08, 0.20, 0.15);
    avatarGroup.add(charSpot);

    // Jalankan animasi lari bawaan firerun.glb
    if (gltf.animations && gltf.animations.length > 0) {
      avatarModel.animations = gltf.animations;
      avatarMixer = new THREE.AnimationMixer(avatarModel);
      avatarRunAction = avatarMixer.clipAction(gltf.animations[0]);
      avatarRunAction.play();
    }
  });

  // Efek cipratan air saat ada banjir
  createAvatarSplashEffect(avatarGroup);
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

  // 11. Avatar Karakter Pelari (Firerun GLB)
  createRunnerAvatar(scene);

  // 12. Sistem Gerbang Interaktif Runner (Pasukan Army, Multiplier, EXP, Minus & Elemen)
  gateManager = new GateManager(scene, mainMesh, cylinderRadius, avatarGroup, () => avatarModel);
  gateManager.activeElement = 'FIRE';
  gateManager.elementType = 'fire';
  gateManager.initialActiveElement = 'FIRE';
  gateManager.initialElementType = 'fire';
  gateManager.updateHud();
  gateManager.onElementChange = (element) => changeArmyElement(gateManager, avatarGroup, avatarModel, element, (model, mixer, action) => {
    if (avatarMixer) {
      avatarMixer.stopAllAction();
      avatarMixer.uncacheRoot(avatarModel);
    }
    avatarModel = model;
    avatarMixer = mixer;
    avatarRunAction = action;
  });

  // 13. Sistem Monster Sampah Raksasa (Muncul setelah 1 menit / 60 detik berlari)
  monsterManager = new MonsterManager(
    scene,
    mainMesh,
    cylinderRadius,
    camera,
    gateManager,
    'city',
    () => {
      // onRaceEnd: Udahan larinya!
      isAnimating = false;
      rollSpeed = 0;
      if (avatarMixer) avatarMixer.timeScale = 0;
    },
    () => {
      // onRestart: Main lagi!
      isAnimating = true;
      rollSpeed = 0.75;
      if (avatarMixer) avatarMixer.timeScale = 1.0;
      avatarTargetLaneY = -0.21;
      avatarLaneY = -0.21;
      if (floodState === 'cleared') {
        floodState = 'flooded';
        floodLevel = 1;
        if (waterFloodGroup) waterFloodGroup.visible = true;
        if (waterMat) waterMat.opacity = 0.88;
        waterMeniscusRings.forEach((ring) => ring.scale.set(1, 1, 1));
      }
    },
    () => {
      // onVictoryCutscene: Banjirnya surut!
      if (floodState === 'flooded') {
        triggerFloodRestoration();
      }
    }
  );
  gateManager.onGameOver = () => monsterManager.triggerDefeatByArmy();
}

function createWaterNormalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  // Bangkitkan peta normal gelombang permukaan air ombak yang hidup, mengalir dan dinamis
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const u = (x / 512) * Math.PI * 6;
      const v = (y / 512) * Math.PI * 6;

      // Alunan ombak riak bergelombang dinamis
      const du = Math.sin(u) * Math.cos(v) * 0.28 +
                 Math.sin(u * 1.6 + v * 0.9) * 0.16 +
                 Math.cos(u * 0.8 - v * 1.4) * 0.12;

      const dv = Math.cos(u) * Math.sin(v) * 0.28 +
                 Math.cos(u * 1.6 + v * 0.9) * 0.16 -
                 Math.sin(u * 0.8 - v * 1.4) * 0.12;

      const nx = Math.min(255, Math.max(0, (-du * 0.25 + 0.5) * 255));
      const ny = Math.min(255, Math.max(0, (-dv * 0.25 + 0.5) * 255));
      const nz = 248; // Nilai z tinggi menjaga kilau air tetap bersih dan elegan

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
  tex.repeat.set(8, 4);
  return tex;
}

function createWaterFloodSystem(scene) {
  waterFloodGroup = new THREE.Group();
  waterFloodGroup.position.set(0, 0, 0); // Berpusat sepusat dengan tabung kota di sumbu Y

  if (infoDetail) {
    infoDetail.textContent = ' WASPADA BANJIR: Selimut air silindris meluap menutupi seluruh aspal jalanan dan trotoar kota!';
  }

  // 1. Tekstur Riak Gelombang Normal Air (Rolling Waves)
  waterNormalTex = createWaterNormalTexture();

  // 2. Material Air Kaca Transparan & Indeks Bias Optik (Rolling Waves Physical Liquid)
  // Warna: Biru toska laut jernih (cyan / aqua marine 0x38bdf8)
  // Transmisi: Semi-transparan tembus pandang dengan ombak yang berkilau hidup
  waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x168fbd,
    emissive: 0x075985,
    emissiveIntensity: 0.10,
    roughness: 0.24,
    metalness: 0.02,
    transmission: 0.14,
    transparent: true,
    opacity: 0.88,
    ior: 1.333,                 // Indeks bias air optik asli
    thickness: 1.6,             // Kedalaman volume bias air
    specularIntensity: 1.0,
    specularColor: 0xffffff,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    normalMap: waterNormalTex,
    normalScale: new THREE.Vector2(0.18, 0.18)
  });

  // 3. Potongan Silindris Air (Cylinder Sleeve) & Mesh Ombak 3D
  // Menyelimuti penuh seluruh tabung: aspal jalan raya dan trotoar pejalan kaki di kedua sisi
  waterGeo = new THREE.CylinderGeometry(waterBaseRadius, waterBaseRadius, waterTotalHeight, 96, 32, true);
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

function buildCityScenery() {
  cityBuildingsGroup = new THREE.Group();
  mainMesh.add(cityBuildingsGroup); // Terpasang langsung ke tabung agar ikut berputar!

  const gltfLoader = new GLTFLoader();
  const xAxis = new THREE.Vector3(0, -1, 0);
  const sidewalkRadius = cylinderRadius + 0.018; // Berdiri di atas trotoar

  // Helper untuk normalisasi pivot model (grounding dasar model di Y=0 & centering di tengah X, Z)
  function prepareModel(scene) {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.x = -center.x;
    scene.position.z = -center.z;
    scene.position.y = -box.min.y; // Menempel rata tepat di atas tanah
    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = Math.min(node.material.roughness, 0.75);
        }
      }
    });
  }

  // Helper untuk menempatkan objek pada koordinat silinder dengan rotasi tangent tegak lurus
  function placeOnCylinder(object, theta, posY, radius, side, facingRoad = true) {
    const posX = radius * Math.cos(theta);
    const posZ = radius * Math.sin(theta);

    const wrapper = new THREE.Group();
    wrapper.add(object);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    wrapper.setRotationFromMatrix(basisMat);
    wrapper.position.set(posX, posY, posZ);

    if (facingRoad) {
      object.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;
    }
    cityBuildingsGroup.add(wrapper);
    return wrapper;
  }

  // =========================================================================
  // 1. BARIS DEPAN (Boulevard Avenue - Gedung Toko & Rumah Warga)
  // 20 lot per sisi jalan dengan jarak sudut teratur (2pi / 20 = 18 derajat).
  // Dengan keliling 15.7m, tiap lot berjarak 0.785m. Lebar gedung/rumah 0.65-0.70m,
  // menghasilkan kerapatan jalan kota nyata yang padat namun memiliki celah teratur (~0.12m).
  // Setback Y = 1.32 (terletak tepat di belakang curb trotoar 0.83, tidak terendam air).
  // =========================================================================
  const frontLotsConfig = [
    { type: 'city', file: 'building-a.glb', scale: 0.38 },
    { type: 'house', file: 'rumah1.glb', scale: 0.28 },
    { type: 'city', file: 'building-b.glb', scale: 0.36 },
    { type: 'city', file: 'building-c.glb', scale: 0.38 },
    { type: 'house', file: 'rumah2.glb', scale: 0.15 },
    { type: 'city', file: 'building-d.glb', scale: 0.36 },
    { type: 'city', file: 'building-f.glb', scale: 0.36 },
    { type: 'house', file: 'rumah1.glb', scale: 0.28 },
    { type: 'city', file: 'building-g.glb', scale: 0.40 },
    { type: 'house', file: 'rumah1.glb', scale: 0.28 },
    { type: 'city', file: 'building-h.glb', scale: 0.38 },
    { type: 'city', file: 'building-e.glb', scale: 0.40 },
    { type: 'house', file: 'rumah2.glb', scale: 0.15 },
    { type: 'city', file: 'building-a.glb', scale: 0.38 },
    { type: 'city', file: 'building-b.glb', scale: 0.36 },
    { type: 'house', file: 'rumah2.glb', scale: 0.15 },
    { type: 'city', file: 'building-c.glb', scale: 0.38 },
    { type: 'city', file: 'building-d.glb', scale: 0.36 },
    { type: 'house', file: 'rumah1.glb', scale: 0.28 },
    { type: 'city', file: 'building-f.glb', scale: 0.36 }
  ];

  frontLotsConfig.forEach((cfg, lotIdx) => {
    const modelPath = cfg.type === 'house'
      ? `./assets/models/houses/${cfg.file}`
      : `./assets/models/city/${cfg.file}`;

    const onModelLoaded = (gltf) => {
      const baseScene = gltf.scene;
      prepareModel(baseScene);

      // Pasang di kedua sisi jalan (kiri side = 1, kanan side = -1)
      [-1, 1].forEach((side) => {
        const clone = baseScene.clone(true);
        clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

        // Sudut theta presisi untuk tiap lot
        const theta = (lotIdx / frontLotsConfig.length) * Math.PI * 2;
        const posY = side * 1.32; // Garis sempadan rapi di atas trotoar

        placeOnCylinder(clone, theta, posY, sidewalkRadius, side, true);
      });
    };

    gltfLoader.load(
      modelPath,
      onModelLoaded,
      undefined,
      () => {
        if (cfg.type === 'house') {
          gltfLoader.load(`./assets/${cfg.file}`, onModelLoaded, undefined, (err) => console.warn(err));
        }
      }
    );
  });

  // =========================================================================
  // 2. BARIS BELAKANG (Dinding Pencakar Langit Rapat Menutup Batas Tabung Y = 1.88 - 2.45)
  // 24 gedung pencakar langit megah per sisi.
  // Menghasilkan formasi dinding skyline rapat melingkar penuh yang menutup total ujung tabung silinder.
  // =========================================================================
  const skylineSkyscrapers = [
    { file: 'building-skyscraper-a.glb', scale: 0.74 },
    { file: 'building-skyscraper-b.glb', scale: 0.70 },
    { file: 'building-skyscraper-c.glb', scale: 0.72 },
    { file: 'building-e.glb', scale: 0.76 },
    { file: 'building-g.glb', scale: 0.70 }
  ];

  const totalSkylineLots = 24;
  for (let k = 0; k < totalSkylineLots; k++) {
    const cfg = skylineSkyscrapers[k % skylineSkyscrapers.length];
    gltfLoader.load(
      `./assets/models/city/${cfg.file}`,
      (gltf) => {
        const baseScene = gltf.scene;
        prepareModel(baseScene);

        [-1, 1].forEach((side) => {
          const clone = baseScene.clone(true);
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          // Staggered (+0.5) agar terlihat pas di sela-sela antar gedung depan
          const theta = ((k + 0.5) / totalSkylineLots) * Math.PI * 2;
          const posY = side * (1.88 + (k % 4) * 0.16); // Berada dari 1.88 hingga 2.36 (melampaui batas tabung 1.90)

          placeOnCylinder(clone, theta, posY, cylinderRadius, side, true);
        });
      },
      undefined,
      (err) => console.warn('Could not load skyscraper:', cfg.file, err)
    );
  }

  // =========================================================================
  // 3. PROPS PERKOTAAN: CONE, BARRIER, LAMPU JALAN & RAMBU LALU LINTAS
  // Tertata rapi di sepanjang tepi trotoar dengan skala manusiawi yang presisi
  // =========================================================================

  // 3A. Tiang Lampu Jalan Modern (Light Square)
  gltfLoader.load(
    './assets/models/props/light-square.glb',
    (gltf) => {
      const lampModel = gltf.scene;
      prepareModel(lampModel);

      lampModel.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = node.material.clone();
          node.material.emissive = new THREE.Color(0xfef08a);
          node.material.emissiveIntensity = 0.5;
        }
      });

      const lampCount = 8;
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < lampCount; k++) {
          const clone = lampModel.clone();
          clone.scale.set(0.95, 0.95, 0.95);

          const theta = ((k + 0.40) / lampCount) * Math.PI * 2;
          const posY = side * 0.94; // Berdiri di atas trotoar

          placeOnCylinder(clone, theta, posY, sidewalkRadius, side, false);
          clone.rotation.y = (side === 1) ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    },
    undefined,
    (err) => console.warn('Could not load light-square.glb:', err)
  );

  // 3B. Rambu Lampu Lalu Lintas (Traffic Lights) di Persimpangan
  gltfLoader.load(
    './assets/models/props/traffic-light.glb',
    (gltf) => {
      const trafficModel = gltf.scene;
      prepareModel(trafficModel);

      const trafficCount = 4;
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < trafficCount; k++) {
          const clone = trafficModel.clone();
          clone.scale.set(0.95, 0.95, 0.95);

          const theta = (k / trafficCount) * Math.PI * 2 + 0.55;
          const posY = side * 0.90;

          placeOnCylinder(clone, theta, posY, sidewalkRadius, side, true);
        }
      }
    },
    undefined,
    (err) => console.warn('Could not load traffic-light.glb:', err)
  );

  // 3C. Kerucut Lalu Lintas Oranye (Traffic Cones - construction-cone.glb)
  // Berjejer rapi di bibir trotoar dengan skala realistis dan proporsional
  gltfLoader.load(
    './assets/models/props/construction-cone.glb',
    (cGltf) => {
      const coneModel = cGltf.scene;
      prepareModel(coneModel);

      // Zona penempatan kerucut lalu lintas di kedua sisi jalan dengan jarak pandang ideal
      const coneZones = [0.46, 1.40, 2.35, 3.40, 4.40, 5.40];
      for (let side = -1; side <= 1; side += 2) {
        coneZones.forEach((baseTh) => {
          // Berderet 3 cone per zona di tepi trotoar dengan ukuran proporsional
          for (let c = 0; c < 3; c++) {
            const clone = coneModel.clone();
            clone.scale.set(0.95, 0.95, 0.95);

            const theta = baseTh + (c * 0.032);
            const posY = side * 0.81;

            placeOnCylinder(clone, theta, posY, sidewalkRadius, side, true);
          }
        });
      }
    },
    undefined,
    (err) => console.warn('Could not load construction-cone.glb:', err)
  );
}

function setCameraView(mode) {
  cameraView = mode;
  if (cameraView === 'surface') {
    controls.enabled = false;
    camera.fov = 82; // Zoom out sudut pandang lebar
    camera.updateProjectionMatrix();
    camera.up.set(1, 0, 0);
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, camZOffset);
    const targetDist = 4.8;
    camera.lookAt(camX - Math.sin(basePitchDown) * targetDist, 0, camZOffset + Math.cos(basePitchDown) * targetDist);

    if (btnToggleCam) {
      btnToggleCam.textContent = ' Kamera: Di Selimut (Third-Person)';
      btnToggleCam.style.borderColor = '#22d3ee';
      btnToggleCam.style.color = '#22d3ee';
    }
    if (infoDetail) {
      if (floodState === 'flooded') {
        infoDetail.textContent = ' WASPADA BANJIR: Pusaran knot air raksasa menggenangi aspal jalanan kota!';
      } else if (floodState === 'cleared') {
        infoDetail.textContent = ' KOTA PULIH! Pusaran air banjir tersedot habis ke saluran drainase. Jalanan kembali kering & bersih!';
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
      btnToggleCam.textContent = ' Kamera: Luar (Orbit 3D)';
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

  // Update Avatar Karakter Firerun (Perpindahan Jalur & Animasi Lari)
  if (avatarGroup) {
    avatarLaneY = THREE.MathUtils.lerp(avatarLaneY, avatarTargetLaneY, delta * 9.0);
    avatarGroup.position.y = avatarLaneY;

    if (avatarMixer) {
      const animRate = isAnimating ? (rollSpeed / 0.75) : 0.0;
      avatarMixer.update(delta * animRate);
    }

    // Cipratan air kaki avatar saat banjir meluap
    if (splashParticles && splashVelocities) {
      if (isAnimating && floodLevel > 0.12) {
        splashParticles.visible = true;
        const pos = splashParticles.geometry.attributes.position.array;
        for (let i = 0; i < splashVelocities.length; i++) {
          const v = splashVelocities[i];
          v.life += delta * 2.5;
          if (v.life > 1.0) {
            v.life = 0;
            pos[i * 3 + 0] = (Math.random() - 0.5) * 0.12;
            pos[i * 3 + 1] = 0.01;
            pos[i * 3 + 2] = -0.05 + (Math.random() - 0.5) * 0.08;
          } else {
            pos[i * 3 + 0] += v.x * delta;
            pos[i * 3 + 1] += v.y * delta;
            pos[i * 3 + 2] += v.z * delta;
          }
        }
        splashParticles.geometry.attributes.position.needsUpdate = true;
      } else {
        splashParticles.visible = false;
      }
    }
  }

  // Update Sistem Gerbang Interaktif Runner (Muncul sebelum lewat, Collision, Terhapus, Popup & Partikel)
  if (gateManager) {
    gateManager.update(delta, avatarLaneY, isAnimating);
  }

  // Update Sistem Monster Sampah Raksasa (Timer 1 Menit, Stomping, Combat, Animations)
  if (monsterManager) {
    monsterManager.update(delta, avatarLaneY, isAnimating);
  }

  if (cameraView === 'surface') {
    const camX = cylinderRadius + eyeHeight;
    // Kamera third-person elevated: posisi lebih tinggi dan menunduk ke arah jalan
    const camFollowY = avatarLaneY * 0.35;
    camera.position.set(camX, camFollowY, camZOffset);
    camera.up.set(1, 0, 0);
    const targetDist = 4.8;
    camera.lookAt(
      camX - Math.sin(basePitchDown) * targetDist,
      avatarLaneY * 0.45,
      camZOffset + Math.cos(basePitchDown) * targetDist
    );
  } else {
    controls.update();
  }

  if (skySphere) {
    skySphere.position.copy(camera.position);
  }


let lastWaterWaveTime = -Infinity;
let lastWaterWaveLevel = -Infinity;
function updateWaterWaves(time, currentFloodLevel) {
  if (!waterGeo || !waterInitialPositions) return;
  if (time - lastWaterWaveTime < 33 && Math.abs(currentFloodLevel - lastWaterWaveLevel) < 0.01) return;
  lastWaterWaveTime = time;
  lastWaterWaveLevel = currentFloodLevel;

  const posAttr = waterGeo.attributes.position;
  const arr = posAttr.array;
  const initArr = waterInitialPositions;
  const t = time * 0.001;

  // Ombak 3D bergulung nyata (Realistic Rolling Waves)
  // Amplitudo ombak jelas terlihat mengalun tinggi-rendah di atas jalan dan trotoar
  const waveAmp = 0.042 * currentFloodLevel;
  const currentBaseRadius = cylinderRadius + (waterBaseRadius - cylinderRadius) * currentFloodLevel;

  for (let i = 0; i < waterVertexCount; i++) {
    const idx = i * 3;
    const x0 = initArr[idx];
    const y0 = initArr[idx + 1];
    const z0 = initArr[idx + 2];

    const theta = Math.atan2(z0, x0);

    // Formulasi ombak bergulung dinamis & mulus:
    // 1. Gulungan ombak utama melingkari jalan silinder (panjang gelombang lebar dan mulus)
    const wave1 = Math.sin(theta * 6.0 + t * 2.8) * 0.58;
    // 2. Alunan ombak menyilang antara trotoar kiri dan kanan
    const wave2 = Math.sin(theta * 9.0 - y0 * 2.2 + t * 3.4) * 0.32;
    // 3. Puncak alunan ombak sekunder
    const wave3 = Math.cos(theta * 4.0 + y0 * 1.6 + t * 1.8) * 0.20;

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
      if (waterMat) waterMat.opacity = 0.88;

      // Simulasi ombak 3D bergelombang nyata
      updateWaterWaves(time, 1.0);

      // Aliran riak gelombang ombak dinamis
      if (waterNormalTex) {
        waterNormalTex.offset.x += delta * 0.08;
        waterNormalTex.offset.y += delta * 0.035;
      }

      waterMeniscusRings.forEach(r => r.scale.set(1, 1, 1));

      // Putaran arus air lembut menyelimuti tabung
      waterFloodGroup.rotation.y += delta * 0.025;
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
        waterMat.opacity = Math.max(0, floodLevel * 0.88);
      }

      if (floodLevel <= 0.015) {
        floodLevel = 0;
        waterFloodGroup.visible = false;
        floodState = 'cleared';
        if (infoDetail) {
          infoDetail.textContent = ' KOTA PULIH! Seluruh genangan banjir telah surut dan tersedot ke saluran drainase. Jalanan kembali kering & bersih!';
        }
        if (btnFloodRestoration) {
          btnFloodRestoration.textContent = ' Datangkan Banjir Kembali';
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
        waterMat.opacity = floodLevel * 0.88;
      }

      if (floodLevel >= 0.99) {
        floodLevel = 1.0;
        floodState = 'flooded';
        if (infoDetail) {
          infoDetail.textContent = ' WASPADA BANJIR: Selimut air silindris berombak meluap menutupi seluruh aspal jalanan dan trotoar kota!';
        }
        if (btnFloodRestoration) {
          btnFloodRestoration.textContent = ' Pulihkan Banjir (Cutscene)';
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
  btnToggleAnim.textContent = isAnimating ? ' Pause (Space)' : ' Play (Space)';
});

btnWireframe.addEventListener('click', () => {
  isWireframe = !isWireframe;
  sideMaterial.wireframe = isWireframe;
  capMaterial.wireframe = isWireframe;
  btnWireframe.textContent = isWireframe ? ' Solid' : ' Wireframe';
});

btnSpeed.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % speedLevels.length;
  rollSpeed = speedLevels[speedIndex];
  btnSpeed.textContent = ` Kecepatan Jalan: ${rollSpeed.toFixed(2)}x`;
});

function triggerFloodRestoration() {
  if (floodState === 'flooded') {
    floodState = 'restoring';
    if (infoDetail) {
      infoDetail.textContent = ' CUTSCENE: Air banjir silindris surut menyusut & tersedot masuk ke saluran drainase kota...';
    }
    if (btnFloodRestoration) {
      btnFloodRestoration.textContent = ' Memulihkan Kota...';
      btnFloodRestoration.style.borderColor = '#facc15';
      btnFloodRestoration.style.color = '#facc15';
    }
  } else if (floodState === 'cleared') {
    floodState = 'resurging';
    if (infoDetail) {
      infoDetail.textContent = ' Air banjir meluap kembali dari saluran air kota!';
    }
    if (btnFloodRestoration) {
      btnFloodRestoration.textContent = ' Air Banjir Meluap...';
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
  } else if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') {
    avatarTargetLaneY = -0.21; // Jalur Kiri
  } else if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') {
    avatarTargetLaneY = 0.21; // Jalur Kanan
  }
});

if (btnLaneLeft) {
  btnLaneLeft.addEventListener('click', () => {
    avatarTargetLaneY = -0.21;
  });
}
if (btnLaneRight) {
  btnLaneRight.addEventListener('click', () => {
    avatarTargetLaneY = 0.21;
  });
}
if (btnSpawnMonster) {
  btnSpawnMonster.addEventListener('click', () => {
    if (monsterManager) monsterManager.prepareBoss();
  });
}
const btnTestWin = document.getElementById('btnTestWin');
if (btnTestWin) {
  btnTestWin.addEventListener('click', () => {
    if (monsterManager) monsterManager.triggerTestVictory();
  });
}

initCity();
requestAnimationFrame(animate);
