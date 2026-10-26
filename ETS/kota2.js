/**
 * ETS Grafika Komputer - Lingkungan 03: Kota Futuristik Malam (Cyber City)
 * Final Boss: Mecha Robot (idle, attack, dying)
 * Victory Cutscene: Mati lampu jadi nyala (Cyberpunk Power Grid Restored)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GateManager } from './gates.js';
import { MonsterManager } from './monster.js?v=boss_v2';

const canvas = document.getElementById('mainCanvas');
const fpsDisplay = document.getElementById('fpsDisplay');
const infoDetail = document.getElementById('infoDetail');

const btnToggleAnim = document.getElementById('btnToggleAnim');
const btnToggleCam = document.getElementById('btnToggleCam');
const btnWireframe = document.getElementById('btnWireframe');
const btnSpeed = document.getElementById('btnSpeed');
const btnLaneLeft = document.getElementById('btnLaneLeft');
const btnLaneRight = document.getElementById('btnLaneRight');
let btnSpawnMonster = null;

let scene, camera, renderer, controls;
let mainMesh, sideMaterial, capMaterial, standardMaterials;
let cyberCityGroup;
let neonLights = [];
let starsParticles;
let avatarGroup, avatarModel, avatarMixer, avatarRunAction;
let avatarLaneY = -0.21;
let avatarTargetLaneY = -0.21;
let sparkParticles = null;
let sparkVelocities = null;
let gateManager = null;
let monsterManager = null;

// Environmental Restoration (Mati Lampu -> Nyala) Tracking
const streetLampMaterials = [];
const cyberBuildingMaterials = [];
const cyberTrafficMaterials = [];
let rimMat = null;
let kerbMatDark = null;
let powerRestored = false;

const cylinderRadius = 2.6; // Diameter diperbesar menjadi 5.2
const cylinderHeight = 3.8; // Diperlebar agar memuat 2 layer gedung (depan & belakang)
const eyeHeight = 0.85; // Posisi kamera di atas avatar agar lintasan jalan dan rintangan terlihat lapang
const basePitchDown = 31.5 * (Math.PI / 180); // Sudut kamera menunduk (pitch down) sama persis dengan kota & hutan
const camZOffset = -0.16; // Posisi offset Z kamera sama persis dengan kota & hutan
const avatarBaseTargetZ = 0.15; // Posisi avatar tepat dekat dasar bawah kanvas (sama seperti kota & hutan)

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

function createMoonGlareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 256;

  // Gradien radial alami cahaya bulan perak-kebiruan murni tanpa batas/lingkaran konsentris
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 256);
  grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');  // Inti sinar bulan putih perak murni sangat terang
  grad.addColorStop(0.06, 'rgba(241, 245, 249, 0.95)'); // Pendaran perak cerah
  grad.addColorStop(0.16, 'rgba(219, 234, 254, 0.65)'); // Pendaran lembut biru es / ice blue
  grad.addColorStop(0.36, 'rgba(199, 210, 254, 0.28)'); // Halo pendar bulan (lunar halo)
  grad.addColorStop(0.62, 'rgba(165, 180, 252, 0.08)'); // Haze malam luar tipis
  grad.addColorStop(1.00, 'rgba(165, 180, 252, 0.0)');  // Memudar sempurna menyatu dengan langit galaksi

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMoon(scene) {
  const moonGroup = new THREE.Group();
  // Posisi pendar cahaya bulan di langit malam atas-kiri depan
  const moonPos = new THREE.Vector3(-6.8, 4.0, 36.0);
  moonGroup.position.copy(moonPos);

  const moonTex = createMoonGlareTexture();

  // 1. Inti Pendaran Cahaya Terang (Pure Light Glare - Tanpa Objek Bola/Lingkaran Keras)
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

  // 2. Aura Pendaran Luar Cahaya Bulan (Soft Ethereal Moonlight Bloom)
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

  // 3. Sumber Cahaya Bulan (Moonlight Directional & Point Light)
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

// -------------------------------------------------------------
// AVATAR KARAKTER: ELECTRORUN (GLB) + ANIMASI LARI & EFEK SPARK
// -------------------------------------------------------------
function createRunnerAvatar(scene) {
  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);

  const targetZ = avatarBaseTargetZ;
  const surfaceX = Math.sqrt(cylinderRadius * cylinderRadius - targetZ * targetZ);
  const normal = new THREE.Vector3(surfaceX, 0, targetZ).normalize();
  const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
  const binormal = new THREE.Vector3(0, 1, 0);

  // Basis transform untuk firerun / electrorun / waterun:
  // Model UP (+Y) -> normal (+X)
  // Model FORWARD (+Z) -> tangent (+Z)
  // Model RIGHT (-X) -> -binormal (+Y)
  const rotMatrix = new THREE.Matrix4();
  rotMatrix.makeBasis(binormal.clone().negate(), normal, tangent);
  avatarGroup.setRotationFromMatrix(rotMatrix);
  avatarGroup.position.set(surfaceX, 0, targetZ);

  // Load Model Avatar Electrorun
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    './assets/electrorun.glb',
    (gltf) => {
      avatarModel = gltf.scene;

      // Skala normal proporsional sama persis seperti di kota & hutan (s = 0.038)
      const s = 0.038;
      avatarModel.scale.set(s, s, s);
      avatarModel.rotation.y = 0;
      avatarModel.position.set(0, 0.009, 0);

      avatarModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) {
            node.material = node.material.clone();
            node.material.roughness = 0.60;
            node.material.metalness = 0.05;
            // Ambient lembut berbasis warna asli material karakter agar rambut, jaket, dan celana terlihat natural
            if (node.material.color) {
              node.material.emissive = node.material.color.clone();
              node.material.emissiveIntensity = 0.28;
            }
          }
        }
      });

      avatarGroup.add(avatarModel);

      // Setup Animasi Running Loop
      if (gltf.animations && gltf.animations.length > 0) {
        avatarMixer = new THREE.AnimationMixer(avatarModel);
        avatarRunAction = avatarMixer.clipAction(gltf.animations[0]);
        avatarRunAction.play();
      }
    },
    undefined,
    (err) => console.warn('Could not load electrorun.glb:', err)
  );

  // Lampu Amber Sorotan Avatar (Electrorun Light) lembut
  const avatarLight = new THREE.PointLight(0xfacc15, 0.45, 0.85, 2.0);
  avatarLight.position.set(0.04, 0.16, 0.08);
  avatarGroup.add(avatarLight);

  // Efek percikan listrik / sparks neon di kaki avatar saat berlari
  createElectroSparkEffect(avatarGroup);
}

function createElectroSparkEffect(parentGroup) {
  const particleCount = 28;
  const positions = new Float32Array(particleCount * 3);
  sparkVelocities = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 0.10;
    positions[i * 3 + 1] = 0.01;
    positions[i * 3 + 2] = -0.05 + (Math.random() - 0.5) * 0.08;

    sparkVelocities.push({
      x: (Math.random() - 0.5) * 0.25,
      y: 0.15 + Math.random() * 0.20,
      z: -0.28 - Math.random() * 0.25,
      life: Math.random()
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xfacc15,
    size: 0.022,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending
  });

  sparkParticles = new THREE.Points(geo, mat);
  parentGroup.add(sparkParticles);
}

// -------------------------------------------------------------
// AUDIO SINTESIS: CYBER POWER GRID RESTORATION
// -------------------------------------------------------------
function playCyberPowerGridSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // 1. Power Generator Hum (Ramping UP)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.exponentialRampToValueAtTime(320, now + 0.8);
    gain1.gain.setValueAtTime(0.01, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.5);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.65);

    // 2. High Voltage Relay Switch (Click)
    setTimeout(() => {
      if (ctx.state === 'closed') return;
      const t = ctx.currentTime;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(880, t);
      osc2.frequency.exponentialRampToValueAtTime(110, t + 0.12);
      gain2.gain.setValueAtTime(0.40, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t);
      osc2.stop(t + 0.16);
    }, 450);

    // 3. Glorious Neon Power Chime (C-Major Power On Arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (ctx.state === 'closed') return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.25);
      }, 700 + idx * 140);
    });
  } catch (e) {
    console.warn('Audio synthesis not permitted:', e);
  }
}

// -------------------------------------------------------------
// CUTSCENE PEMULIHAN: MATI LAMPU JADI NYALA
// -------------------------------------------------------------
function restoreCyberPower() {
  powerRestored = true;
  playCyberPowerGridSound();

  // 1. Lampu jalan menyala terang keemasan / neon cyan
  streetLampMaterials.forEach((m) => {
    m.emissive.setHex(0xfacc15);
    m.emissiveIntensity = 2.8;
    if (m.color) m.color.setHex(0xffedd5);
  });

  // 2. Gedung pencakar langit cyberpunk menyalakan lampu jendela neon
  cyberBuildingMaterials.forEach((item) => {
    item.material.emissive.setHex(item.cyberColor);
    item.material.emissiveIntensity = 1.25;
  });

  // 3. Rambu lalu lintas menyala terang
  cyberTrafficMaterials.forEach((m) => {
    m.emissive.setHex(0x10b981);
    m.emissiveIntensity = 2.5;
  });

  // 4. Garis neon trotoar & ring jalan menyala
  if (rimMat) {
    rimMat.color.setHex(0x38bdf8);
    rimMat.emissive.setHex(0x0284c7);
    rimMat.emissiveIntensity = 1.8;
  }
  if (kerbMatDark) {
    kerbMatDark.color.setHex(0xc084fc);
    kerbMatDark.emissive.setHex(0x9333ea);
    kerbMatDark.emissiveIntensity = 1.5;
  }

  // 5. Booster lampu neon overhead
  neonLights.forEach((n) => {
    n.targetIntensity = 5.5;
  });

  if (infoDetail) {
    infoDetail.textContent = '⚡ CUTSCENE: Daya Kota Dipulihkan! Seluruh lampu jalan, gedung cyberpunk & jaringan neon kota menyala terang benderang!';
  }
}

function restoreBlackout() {
  powerRestored = false;
  streetLampMaterials.forEach((m) => {
    m.emissive.setHex(0x000000);
    m.emissiveIntensity = 0.0;
    if (m.color) m.color.multiplyScalar(0.40);
  });
  cyberBuildingMaterials.forEach((item) => {
    item.material.emissive.setHex(0x000000);
    item.material.emissiveIntensity = 0.0;
  });
  cyberTrafficMaterials.forEach((m) => {
    m.emissive.setHex(0x000000);
    m.emissiveIntensity = 0.0;
  });
  if (rimMat) {
    rimMat.color.setHex(0x1e293b);
    rimMat.emissive.setHex(0x000000);
    rimMat.emissiveIntensity = 0.0;
  }
  if (kerbMatDark) {
    kerbMatDark.color.setHex(0x1e293b);
    kerbMatDark.emissive.setHex(0x000000);
    kerbMatDark.emissiveIntensity = 0.0;
  }
  neonLights.forEach((n) => {
    n.targetIntensity = (n.light.color.getHex() === 0xec4899) ? 2.0 : 1.4;
  });
}

function initCyberCity() {
  // 1. Scene & Sky (Deep Dark Galaxy 360° EXR)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010106);

  // 2. Camera (FOV 82 untuk pandangan lebih zoom-out & cinematic)
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(82, aspect, 0.05, 200);

  // 3. Renderer (Kontras malam pekat & dalam)
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Load Background 360° Galaksi Bima Sakti (Deep Space Galaxy 360°)
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
    skySphere.rotation.z = -Math.PI / 2; // Menyelaraskan zenith langit dengan UP kamera (+X)
    scene.add(skySphere);
  };

  const exrLoader = new EXRLoader();
  exrLoader.load(
    './assets/textures/sky/milkyway.exr',
    (tex) => setupSkyTexture(tex),
    undefined,
    () => {
      new THREE.TextureLoader().load('./assets/textures/sky/milkyway.png', (pngTex) => setupSkyTexture(pngTex));
    }
  );

  // 4. Pendar Cahaya Bulan Murni di Langit Malam
  moonVisuals = createMoon(scene);

  // 5. Controls (Orbit 3D untuk inspeksi bebas)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = false;

  // 6. Pencahayaan Kota Cyberpunk Malam Hari (Mati Lampu Awal)
  const ambientLight = new THREE.AmbientLight(0x1e1e38, 0.45);
  scene.add(ambientLight);

  const cyanKey = new THREE.DirectionalLight(0x38bdf8, 0.95);
  cyanKey.position.set(6, 9, 7);
  scene.add(cyanKey);

  const magentaFill = new THREE.DirectionalLight(0xa855f7, 0.75);
  magentaFill.position.set(-6, -4, -5);
  scene.add(magentaFill);

  const pinkPoint = new THREE.PointLight(0xec4899, 2.0, 16);
  pinkPoint.position.set(4.5, 4.0, -2.5);
  scene.add(pinkPoint);
  neonLights.push({ light: pinkPoint, baseColor: 0xec4899, speed: 2.8, targetIntensity: 2.0 });

  const amberPoint = new THREE.PointLight(0xf59e0b, 1.4, 14);
  amberPoint.position.set(0, 5.5, -4.5);
  scene.add(amberPoint);
  neonLights.push({ light: amberPoint, baseColor: 0xf59e0b, speed: 1.7, targetIntensity: 1.4 });

  // 7. Tekstur Jalan & Tutup Logam Tabung
  const texLoader = new THREE.TextureLoader();

  const roadColor = texLoader.load('./assets/textures/road/color.jpg');
  roadColor.colorSpace = THREE.SRGBColorSpace;
  const roadNormal = texLoader.load('./assets/textures/road/normal.jpg');
  const roadRough = texLoader.load('./assets/textures/road/roughness.jpg');

  [roadColor, roadNormal, roadRough].forEach((tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.rotation = Math.PI / 2;
    tex.center.set(0.5, 0.5);
    tex.repeat.set(1.2, 7);
  });

  const metalColor = texLoader.load('./assets/textures/metal/color.jpg');
  metalColor.colorSpace = THREE.SRGBColorSpace;
  const metalNormal = texLoader.load('./assets/textures/metal/normal.jpg');
  const metalRough = texLoader.load('./assets/textures/metal/roughness.jpg');
  const metalMetal = texLoader.load('./assets/textures/metal/metalness.jpg');

  sideMaterial = new THREE.MeshStandardMaterial({
    map: roadColor,
    normalMap: roadNormal,
    roughnessMap: roadRough,
    roughness: 0.8,
    metalness: 0.15,
  });

  capMaterial = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    roughnessMap: metalRough,
    metalnessMap: metalMetal,
    roughness: 0.35,
    metalness: 0.85,
  });

  standardMaterials = [sideMaterial, capMaterial, capMaterial];

  // 8. Tabung Jalan Utama
  const cylinderGeo = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 32);
  mainMesh = new THREE.Mesh(cylinderGeo, standardMaterials);
  scene.add(mainMesh);

  // Ring Logam Penjepit di Kedua Sisi (Gelap Malam Hari / Mati Lampu)
  const rimGeo = new THREE.TorusGeometry(cylinderRadius + 0.02, 0.04, 16, 64);
  rimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.4
  });

  const rimTop = new THREE.Mesh(rimGeo, rimMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = cylinderHeight / 2;
  mainMesh.add(rimTop);

  const rimBottom = new THREE.Mesh(rimGeo, rimMat);
  rimBottom.rotation.x = Math.PI / 2;
  rimBottom.position.y = -cylinderHeight / 2;
  mainMesh.add(rimBottom);

  // 9. Trotoar di Sisi Jalan (Mati Lampu / Non-Neon)
  buildCyberSidewalks();

  // 10. Gedung Pencakar Langit Asli & Props dari Folder Assets
  createCyberCityScenery();

  // 11. Bintang Digital / Partikel Langit Malam
  createCyberStars();

  // 12. Avatar Electrorun (Runner) berlari di atas jalan raya kota futuristik
  createRunnerAvatar(scene);

  // 13. Sistem Gerbang Interaktif Runner (Pasukan Army, Multiplier, EXP, Minus & Elemen)
  gateManager = new GateManager(scene, mainMesh, cylinderRadius, avatarGroup, () => avatarModel);

  // 14. Sistem Final Boss Mecha Robot (Muncul setelah 1 menit / 60 detik berlari)
  monsterManager = new MonsterManager(
    scene,
    mainMesh,
    cylinderRadius,
    camera,
    gateManager,
    'cyber',
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
      restoreBlackout();
    },
    () => {
      // onVictoryCutscene: Mati lampu jadi nyala!
      restoreCyberPower();
    }
  );

  // 15. Event Listeners
  window.addEventListener('resize', onWindowResize);
  setupControls();

  // 16. Render Loop
  requestAnimationFrame(animate);
}

function buildCyberSidewalks() {
  const sidewalkGroup = new THREE.Group();

  // Tekstur Paving Blok Trotoar Malam Hari Gelap (Mati Lampu / Tanpa Neon)
  const cvs = document.createElement('canvas');
  cvs.width = 512;
  cvs.height = 512;
  const ctx = cvs.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#1e293b';
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

  // Pinggiran tepi trotoar gelap (batu kerb beton malam hari tanpa neon menyala)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 16);

  const sidewalkTex = new THREE.CanvasTexture(cvs);
  sidewalkTex.wrapS = THREE.RepeatWrapping;
  sidewalkTex.wrapT = THREE.RepeatWrapping;
  sidewalkTex.repeat.set(16, 5);

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.75,
    metalness: 0.25
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

  // Tepi Kerb Trotoar Fisik Gelap (Objek Biasa di Malam Hari / Mati Lampu)
  const kerbGeo = new THREE.TorusGeometry(sidewalkRadius, 0.016, 8, 64);
  kerbMatDark = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.2
  });

  const leftKerb = new THREE.Mesh(kerbGeo, kerbMatDark);
  leftKerb.rotation.x = Math.PI / 2;
  leftKerb.position.y = 0.83;
  sidewalkGroup.add(leftKerb);

  const rightKerb = new THREE.Mesh(kerbGeo, kerbMatDark);
  rightKerb.rotation.x = Math.PI / 2;
  rightKerb.position.y = -0.83;
  sidewalkGroup.add(rightKerb);

  mainMesh.add(sidewalkGroup);
}

// Pohon siluet malam hari untuk kota cyberpunk
function createNightTree(variant = 0) {
  const treeGroup = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 0.9, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.45;
  treeGroup.add(trunk);

  if (variant % 2 === 0) {
    const fMat1 = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.8, flatShading: true });
    const fMat2 = new THREE.MeshStandardMaterial({ color: 0x0f2d24, roughness: 0.85, flatShading: true });

    const f1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.56, 1), fMat1);
    f1.position.set(0, 1.25, 0);
    treeGroup.add(f1);

    const f2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), fMat2);
    f2.position.set(0.18, 1.55, -0.12);
    treeGroup.add(f2);
  } else {
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x04382c, roughness: 0.75, flatShading: true });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.9, 7), pineMat);
    c1.position.y = 1.0;
    treeGroup.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 7), pineMat);
    c2.position.y = 1.55;
    treeGroup.add(c2);
  }

  return treeGroup;
}

function createCyberCityScenery() {
  cyberCityGroup = new THREE.Group();
  mainMesh.add(cyberCityGroup); // Terpasang langsung ke tabung agar ikut berputar!

  const gltfLoader = new GLTFLoader();
  const xAxis = new THREE.Vector3(0, -1, 0);
  const sidewalkRadius = cylinderRadius + 0.018; // Di atas trotoar

  // Helper normalisasi pivot model
  function prepareModel(scene) {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.x = -center.x;
    scene.position.z = -center.z;
    scene.position.y = -box.min.y;

    const cyberPalette = [0x06b6d4, 0xec4899, 0xfacc15, 0x3b82f6, 0xa855f7];

    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material = node.material.clone();
          node.material.emissive = new THREE.Color(0x000000);
          node.material.emissiveIntensity = 0.0;
          cyberBuildingMaterials.push({
            material: node.material,
            cyberColor: cyberPalette[Math.floor(Math.random() * cyberPalette.length)]
          });
        }
      }
    });
  }

  // Helper penempatan koordinat silinder dengan rotasi tangent tegak lurus sempurna
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
    cyberCityGroup.add(wrapper);
    return wrapper;
  }

  // =========================================================================
  // 1. GEDUNG DEPAN (Boulevard Cyberpunk - 18 Lot Teratur Per Sisi)
  // =========================================================================
  const frontCyberLots = [
    { file: 'building-a.glb', scale: 0.38 },
    { file: 'building-c.glb', scale: 0.38 },
    { file: 'building-d.glb', scale: 0.36 },
    { file: 'building-f.glb', scale: 0.36 },
    { file: 'building-b.glb', scale: 0.36 },
    { file: 'building-h.glb', scale: 0.38 },
    { file: 'building-g.glb', scale: 0.38 },
    { file: 'building-e.glb', scale: 0.38 },
    { file: 'building-a.glb', scale: 0.38 },
    { file: 'building-d.glb', scale: 0.36 },
    { file: 'building-c.glb', scale: 0.38 },
    { file: 'building-f.glb', scale: 0.36 },
    { file: 'building-b.glb', scale: 0.36 },
    { file: 'building-g.glb', scale: 0.38 },
    { file: 'building-h.glb', scale: 0.38 },
    { file: 'building-e.glb', scale: 0.38 },
    { file: 'building-a.glb', scale: 0.38 },
    { file: 'building-c.glb', scale: 0.38 }
  ];

  frontCyberLots.forEach((cfg, lotIdx) => {
    gltfLoader.load(
      `./assets/models/city/${cfg.file}`,
      (gltf) => {
        const baseScene = gltf.scene;
        prepareModel(baseScene);

        [-1, 1].forEach((side) => {
          const clone = baseScene.clone(true);
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          const theta = (lotIdx / frontCyberLots.length) * Math.PI * 2;
          const posY = side * 1.34;

          placeOnCylinder(clone, theta, posY, sidewalkRadius, side, true);
        });
      },
      undefined,
      (err) => console.warn('Could not load front cyber model:', cfg.file, err)
    );
  });

  // =========================================================================
  // 2. SKYLINE PENCAKAR LANGIT BELAKANG (22 Lot Teratur Per Sisi)
  // =========================================================================
  const skylineCyberModels = [
    { file: 'building-skyscraper-a.glb', scale: 0.72 },
    { file: 'building-skyscraper-b.glb', scale: 0.68 },
    { file: 'building-skyscraper-c.glb', scale: 0.70 },
    { file: 'building-g.glb', scale: 0.68 },
    { file: 'building-e.glb', scale: 0.72 }
  ];

  const totalSkylineLots = 22;
  for (let k = 0; k < totalSkylineLots; k++) {
    const cfg = skylineCyberModels[k % skylineCyberModels.length];
    gltfLoader.load(
      `./assets/models/city/${cfg.file}`,
      (gltf) => {
        const baseScene = gltf.scene;
        prepareModel(baseScene);

        [-1, 1].forEach((side) => {
          const clone = baseScene.clone(true);
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          const theta = ((k + 0.5) / totalSkylineLots) * Math.PI * 2;
          const posY = side * (1.85 + (k % 4) * 0.14);

          placeOnCylinder(clone, theta, posY, cylinderRadius, side, true);
        });
      },
      undefined,
      (err) => console.warn('Could not load skyline cyber model:', cfg.file, err)
    );
  }

  // =========================================================================
  // 3. PEPOHONAN MALAM CYBERPUNK
  // =========================================================================
  const boulevardTreeCount = 18;
  [-1, 1].forEach((side, sIdx) => {
    for (let k = 0; k < boulevardTreeCount; k++) {
      const variant = (k + sIdx) % 2;
      const tree = createNightTree(variant);
      tree.scale.set(0.58, 0.58, 0.58);
      tree.rotation.y = (k * 1.5) % (Math.PI * 2);

      const theta = ((k + 0.5) / boulevardTreeCount) * Math.PI * 2;
      const posY = side * 0.95;

      placeOnCylinder(tree, theta, posY, sidewalkRadius, side, false);
    }

    for (let m = 0; m < boulevardTreeCount; m++) {
      const variant = (m + sIdx + 1) % 2;
      const tree = createNightTree(variant);
      const bScale = 0.85 + (m % 3) * 0.12;
      tree.scale.set(bScale, bScale, bScale);
      tree.rotation.y = (m * 2.1) % (Math.PI * 2);

      const theta = (m / boulevardTreeCount) * Math.PI * 2 + 0.08;
      const posY = side * (1.68 + (m % 3) * 0.18);

      placeOnCylinder(tree, theta, posY, cylinderRadius, side, false);
    }
  });

  // =========================================================================
  // 4. PROPS JALANAN (Tiang Lampu Jalan & Rambu Lalu Lintas)
  // =========================================================================

  // 4A. Tiang Lampu Jalan Modern (Light Square)
  gltfLoader.load(
    './assets/models/props/light-square.glb',
    (gltf) => {
      const lampModel = gltf.scene;
      prepareModel(lampModel);

      lampModel.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = node.material.clone();
          node.material.emissive = new THREE.Color(0x000000);
          node.material.emissiveIntensity = 0.0;
          if (node.material.color) {
            node.material.color.multiplyScalar(0.40);
          }
          streetLampMaterials.push(node.material);
        }
      });

      const lampCount = 10;
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < lampCount; k++) {
          const clone = lampModel.clone();
          clone.scale.set(0.85, 0.85, 0.85);

          const theta = ((k + 0.25) / lampCount) * Math.PI * 2;
          const posY = side * 0.90;

          placeOnCylinder(clone, theta, posY, sidewalkRadius, side, false);
          clone.rotation.y = (side === 1) ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    },
    undefined,
    (err) => console.warn('Could not load light-square.glb:', err)
  );

  // 4B. Rambu Lampu Lalu Lintas (Traffic Lights)
  gltfLoader.load(
    './assets/models/props/traffic-light.glb',
    (gltf) => {
      const trafficModel = gltf.scene;
      prepareModel(trafficModel);

      trafficModel.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = node.material.clone();
          node.material.emissive = new THREE.Color(0x000000);
          node.material.emissiveIntensity = 0.0;
          cyberTrafficMaterials.push(node.material);
        }
      });

      const trafficCount = 4;
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < trafficCount; k++) {
          const clone = trafficModel.clone();
          clone.scale.set(0.85, 0.85, 0.85);

          const theta = (k / trafficCount) * Math.PI * 2 + 0.40;
          const posY = side * 0.88;

          placeOnCylinder(clone, theta, posY, sidewalkRadius, side, true);
        }
      }
    },
    undefined,
    (err) => console.warn('Could not load traffic-light.glb:', err)
  );
}

function createCyberStars() {
  const starsCount = 450;
  const starsGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(starsCount * 3);

  for (let i = 0; i < starsCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 60;
    positions[i + 1] = Math.random() * 25 + 2;
    positions[i + 2] = (Math.random() - 0.5) * 60;
  }

  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starsMat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.12,
    transparent: true,
    opacity: 0.75
  });

  starsParticles = new THREE.Points(starsGeo, starsMat);
  scene.add(starsParticles);
}

function setCameraView(mode) {
  cameraView = mode;

  if (mode === 'surface') {
    controls.enabled = false;
    camera.fov = 82; // Zoom out sudut pandang lebar
    camera.updateProjectionMatrix();

    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, camZOffset);
    camera.up.set(1, 0, 0);

    const targetDist = 4.8;
    camera.lookAt(
      camX - Math.sin(basePitchDown) * targetDist,
      0,
      camZOffset + Math.cos(basePitchDown) * targetDist
    );

    if (btnToggleCam) {
      btnToggleCam.innerText = '📷 Kamera: Di Selimut (Third-Person)';
      btnToggleCam.style.borderColor = '#facc15';
      btnToggleCam.style.color = '#facc15';
    }
    if (infoDetail) {
      infoDetail.innerText = 'Kamera tetap di selimut tabung | Lampu neon kota & putaran halus';
    }
  } else {
    // Mode Orbit Perspektif Luar
    controls.enabled = true;
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    camera.position.set(0, 4.0, 8.5);
    controls.target.set(0, 0, 0);
    controls.update();

    if (btnToggleCam) {
      btnToggleCam.innerText = '📷 Kamera: Orbit Bebas (Mouse Look)';
      btnToggleCam.style.borderColor = '#38bdf8';
      btnToggleCam.style.color = '#38bdf8';
    }
    if (infoDetail) {
      infoDetail.innerText = 'Gunakan mouse drag / scroll untuk melihat tabung & kota dari luar';
    }
  }
}

function setupControls() {
  btnToggleCam?.addEventListener('click', () => {
    setCameraView(cameraView === 'surface' ? 'orbit' : 'surface');
  });

  btnToggleAnim?.addEventListener('click', () => {
    isAnimating = !isAnimating;
    btnToggleAnim.innerText = isAnimating ? '⏸️ Pause (Space)' : '▶️ Putar (Space)';
  });

  btnSpawnMonster = document.getElementById('btnSpawnMonster');
  btnSpawnMonster?.addEventListener('click', () => {
    if (monsterManager) monsterManager.spawnMonster();
  });

  const btnTestWin = document.getElementById('btnTestWin');
  btnTestWin?.addEventListener('click', () => {
    if (monsterManager) monsterManager.triggerTestVictory();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      isAnimating = !isAnimating;
      if (btnToggleAnim) {
        btnToggleAnim.innerText = isAnimating ? '⏸️ Pause (Space)' : '▶️ Putar (Space)';
      }
    } else if (e.code === 'KeyC') {
      setCameraView(cameraView === 'surface' ? 'orbit' : 'surface');
    } else if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') {
      avatarTargetLaneY = -0.21; // Jalur Kiri
    } else if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') {
      avatarTargetLaneY = 0.21; // Jalur Kanan
    } else if (e.key.toLowerCase() === 'm') {
      if (monsterManager) monsterManager.spawnMonster();
    }
  });

  btnLaneLeft?.addEventListener('click', () => {
    avatarTargetLaneY = -0.21;
  });

  btnLaneRight?.addEventListener('click', () => {
    avatarTargetLaneY = 0.21;
  });

  btnWireframe?.addEventListener('click', () => {
    isWireframe = !isWireframe;
    standardMaterials.forEach((m) => (m.wireframe = isWireframe));
    btnWireframe.style.color = isWireframe ? '#ec4899' : '';
    btnWireframe.style.borderColor = isWireframe ? '#ec4899' : '';
  });

  btnSpeed?.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % speedLevels.length;
    rollSpeed = speedLevels[speedIndex];
    btnSpeed.innerText = `⚡ Kecepatan Jalan: ${rollSpeed.toFixed(1)}x`;
  });
}

function onWindowResize() {
  if (!canvas || !renderer || !camera) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate(currentTime) {
  requestAnimationFrame(animate);

  const delta = (currentTime - lastTime) * 0.001;
  lastTime = currentTime;

  frameCount++;
  fpsTimer += delta;
  if (fpsTimer >= 0.5) {
    if (fpsDisplay) {
      fpsDisplay.innerText = Math.round(frameCount / fpsTimer);
    }
    frameCount = 0;
    fpsTimer = 0;
  }

  // Putaran tabung jalan mulus
  if (isAnimating && mainMesh) {
    mainMesh.rotation.y += rollSpeed * (delta || 0.016);
  }

  // Animasi pulsing lampu neon terfokus
  const timeSec = currentTime * 0.001;
  neonLights.forEach((n) => {
    n.light.intensity = (n.targetIntensity || 1.6) + Math.sin(timeSec * n.speed) * 0.4;
  });

  // Rotasi lambat bintang-bintang di kejauhan
  if (starsParticles) {
    starsParticles.rotation.y += 0.0003;
  }

  // Update Avatar Karakter Electrorun (Perpindahan Jalur & Animasi Lari)
  if (avatarGroup) {
    avatarLaneY = THREE.MathUtils.lerp(avatarLaneY, avatarTargetLaneY, delta * 9.0);
    avatarGroup.position.y = avatarLaneY;

    if (avatarMixer) {
      const animRate = isAnimating ? (rollSpeed / 0.75) : 0.0;
      avatarMixer.update(delta * animRate);
    }

    // Percikan listrik neon di kaki avatar
    if (sparkParticles && sparkVelocities) {
      if (isAnimating) {
        sparkParticles.visible = true;
        const pos = sparkParticles.geometry.attributes.position.array;
        for (let i = 0; i < sparkVelocities.length; i++) {
          const v = sparkVelocities[i];
          v.life += delta * 2.5;
          if (v.life > 1.0) {
            v.life = 0;
            pos[i * 3 + 0] = (Math.random() - 0.5) * 0.10;
            pos[i * 3 + 1] = 0.01;
            pos[i * 3 + 2] = -0.05 + (Math.random() - 0.5) * 0.08;
          } else {
            pos[i * 3 + 0] += v.x * delta;
            pos[i * 3 + 1] += v.y * delta;
            pos[i * 3 + 2] += v.z * delta;
          }
        }
        sparkParticles.geometry.attributes.position.needsUpdate = true;
      } else {
        sparkParticles.visible = false;
      }
    }
  }

  // Update Sistem Gerbang Interaktif Runner (Muncul sebelum lewat, Collision, Terhapus, Popup & Partikel)
  if (gateManager) {
    gateManager.update(delta, avatarLaneY, isAnimating);
  }

  // Update Sistem Final Boss Mecha Robot (Timer 1 Menit, Idle/Attack/Dying, Evaluasi EXP)
  if (monsterManager) {
    monsterManager.update(delta, avatarLaneY, isAnimating);
  }

  if (cameraView === 'surface') {
    const camX = cylinderRadius + eyeHeight;
    const camFollowY = avatarLaneY * 0.35;
    camera.position.set(camX, camFollowY, camZOffset);
    camera.up.set(1, 0, 0);
    const targetDist = 4.8;
    camera.lookAt(
      camX - Math.sin(basePitchDown) * targetDist,
      avatarLaneY * 0.45,
      camZOffset + Math.cos(basePitchDown) * targetDist
    );
  } else if (cameraView === 'orbit') {
    controls.update();
  }

  if (skySphere) {
    skySphere.position.copy(camera.position);
  }

  // Pendaran lembut cahaya bulan murni di langit malam
  if (moonVisuals) {
    const mPulse = 1.0 + Math.sin(currentTime * 0.0015) * 0.04;
    moonVisuals.coreSprite.scale.set(7.5 * mPulse, 7.5 * mPulse, 1);
    moonVisuals.bloomSprite.scale.set(16.5 * mPulse, 16.5 * mPulse, 1);
  }

  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', initCyberCity);
