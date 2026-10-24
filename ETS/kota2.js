/**
 * ETS Grafika Komputer - Lingkungan 03: Kota Futuristik Malam (Cyber City)
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

let scene, camera, renderer, controls;
let mainMesh, sideMaterial, capMaterial, standardMaterials;
let cyberCityGroup;
let neonLights = [];
let starsParticles;

const cylinderRadius = 2.6; // Diameter diperbesar menjadi 5.2
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
    skySphere.rotation.x = Math.PI * 0.42; // Arahkan lengkungan galaksi megah melintang di langit atas-depan
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

  // 5. Pencahayaan Cahaya Bulan & Suasana Malam Galaksi
  moonVisuals = createMoon(scene);

  // Ambient diterangi agar detail tekstur jalan, aspal, dan arsitektur gedung terlihat jelas
  const ambientLight = new THREE.AmbientLight(0x3b4a6b, 0.95);
  scene.add(ambientLight);

  // Hemisphere Light langit malam bermandikan cahaya bulan (sky: cool slate blue, ground: subtle pavement bounce)
  const moonHemi = new THREE.HemisphereLight(0x4c5e87, 0x242e42, 1.05);
  scene.add(moonHemi);

  // Lampu Neon Point Lights Lokal (Aksen neon kontras tinggi)
  const cyanPoint = new THREE.PointLight(0x06b6d4, 1.8, 16);
  cyanPoint.position.set(-4.5, 3.5, 3.0);
  scene.add(cyanPoint);
  neonLights.push({ light: cyanPoint, baseColor: 0x06b6d4, speed: 2.1, targetIntensity: 1.8 });

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
  const rimMat = new THREE.MeshStandardMaterial({
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

  // 12. Event Listeners
  window.addEventListener('resize', onWindowResize);
  setupControls();

  // 13. Render Loop
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
  const kerbMatDark = new THREE.MeshStandardMaterial({
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

function createCyberCityScenery() {
  cyberCityGroup = new THREE.Group();
  mainMesh.add(cyberCityGroup); // Terpasang langsung ke tabung agar ikut berputar!

  const gltfLoader = new GLTFLoader();
  const xAxis = new THREE.Vector3(0, -1, 0);
  const sidewalkRadius = cylinderRadius + 0.018; // Di atas trotoar

  // 1A. Gedung Cyberpunk Baris Depan (Di Atas Trotoar Samping Jalan)
  const frontCyberModels = [
    { file: 'building-a.glb', scale: 0.44 },
    { file: 'building-c.glb', scale: 0.46 },
    { file: 'building-d.glb', scale: 0.44 },
    { file: 'building-f.glb', scale: 0.40 }
  ];

  frontCyberModels.forEach((cfg, idx) => {
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
          const theta = ((idx * 3 + copy) / (frontCyberModels.length * 3)) * Math.PI * 2;
          const posX = sidewalkRadius * Math.cos(theta);
          const posZ = sidewalkRadius * Math.sin(theta);
          const posY = side * (1.12 + (idx % 2) * 0.04);

          const bldgWrapper = new THREE.Group();
          bldgWrapper.add(clone);

          const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
          const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
          const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

          bldgWrapper.setRotationFromMatrix(basisMat);
          bldgWrapper.position.set(posX, posY, posZ);

          clone.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;

          cyberCityGroup.add(bldgWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load front cyber model:', cfg.file, err)
    );
  });

  // 1B. Gedung Cyberpunk Baris Belakang (Skyline Pencakar Langit Megah di Belakang Gedung Depan)
  const backCyberModels = [
    { file: 'building-skyscraper-a.glb', scale: 0.54 },
    { file: 'building-skyscraper-b.glb', scale: 0.50 },
    { file: 'building-skyscraper-c.glb', scale: 0.50 },
    { file: 'building-g.glb', scale: 0.52 },
    { file: 'building-e.glb', scale: 0.56 }
  ];

  backCyberModels.forEach((cfg, idx) => {
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

        for (let copy = 0; copy < 4; copy++) {
          const clone = baseScene.clone();
          clone.scale.set(cfg.scale, cfg.scale, cfg.scale);

          const side = (copy % 2 === 0) ? 1 : -1;
          const theta = ((idx * 4 + copy) / (backCyberModels.length * 4)) * Math.PI * 2 + 0.06;
          const posX = cylinderRadius * Math.cos(theta);
          const posZ = cylinderRadius * Math.sin(theta);
          const posY = side * (1.56 + (idx % 3) * 0.06); // Posisi di belakang gedung trotoar

          const bldgWrapper = new THREE.Group();
          bldgWrapper.add(clone);

          const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
          const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
          const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

          bldgWrapper.setRotationFromMatrix(basisMat);
          bldgWrapper.position.set(posX, posY, posZ);

          clone.rotation.y = (side === 1) ? Math.PI / 2 : -Math.PI / 2;

          cyberCityGroup.add(bldgWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load back cyber model:', cfg.file, err)
    );
  });

  // 2. Props dari assets/models/props/
  const cyberProps = [
    { file: 'light-square.glb', scale: 0.62, count: 24, yOffset: 0.88 },
    { file: 'traffic-light.glb', scale: 0.60, count: 14, yOffset: 0.88 },
    { file: 'pillar.glb', scale: 0.10, count: 16, yOffset: 1.15 },
    { file: 'barrier.glb', scale: 0.15, count: 16, yOffset: 1.12 }
  ];

  cyberProps.forEach((pCfg) => {
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
              // Lampu jalan mati / padam di malam hari (tanpa emissive glow)
              node.material.emissive = new THREE.Color(0x000000);
              node.material.emissiveIntensity = 0.0;
              // Redupkan warna material tiang & lampu menjadi gelap alami objek malam hari
              if (node.material.color) {
                node.material.color.multiplyScalar(0.35);
              }
            }
          }
        });

        for (let k = 0; k < pCfg.count; k++) {
          const clone = propModel.clone();
          clone.scale.set(pCfg.scale, pCfg.scale, pCfg.scale);

          const side = (k % 2 === 0) ? 1 : -1;
          const theta = (k / pCfg.count) * Math.PI * 2 + (side * 0.05);
          const posX = sidewalkRadius * Math.cos(theta);
          const posZ = sidewalkRadius * Math.sin(theta);
          const posY = side * pCfg.yOffset;

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

          cyberCityGroup.add(propWrapper);
        }
      },
      undefined,
      (err) => console.warn('Could not load cyber prop:', pCfg.file, err)
    );
  });
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

    // Upright: Kamera berdiri di selimut tabung (radius + eyeHeight)
    const camX = cylinderRadius + eyeHeight;
    const camY = 0;
    const camZ = 0;
    camera.position.set(camX, camY, camZ);

    camera.up.set(1, 0, 0);

    // Memandang ke arah jalan berputar, menunduk sedikit ke arah jalan
    const targetDist = 4.6;
    const targetX = camX - Math.sin(basePitchDown) * targetDist;
    const targetY = 0;
    const targetZ = Math.cos(basePitchDown) * targetDist;

    camera.lookAt(targetX, targetY, targetZ);

    if (btnToggleCam) {
      btnToggleCam.innerText = '📷 Kamera: Di Selimut (Fixed Smooth)';
      btnToggleCam.style.borderColor = '#ec4899';
      btnToggleCam.style.color = '#f472b6';
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

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      isAnimating = !isAnimating;
      if (btnToggleAnim) {
        btnToggleAnim.innerText = isAnimating ? '⏸️ Pause (Space)' : '▶️ Putar (Space)';
      }
    } else if (e.code === 'KeyC') {
      setCameraView(cameraView === 'surface' ? 'orbit' : 'surface');
    }
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

  // Animasi pulsing lampu neon terfokus (tetap gelap & kontras)
  const timeSec = currentTime * 0.001;
  neonLights.forEach((n) => {
    n.light.intensity = (n.targetIntensity || 1.6) + Math.sin(timeSec * n.speed) * 0.4;
  });

  // Rotasi lambat bintang-bintang di kejauhan
  if (starsParticles) {
    starsParticles.rotation.y += 0.0003;
  }

  if (cameraView === 'surface') {
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, 0);
    camera.up.set(1, 0, 0);
    const targetDist = 4.6;
    camera.lookAt(camX - Math.sin(basePitchDown) * targetDist, 0, Math.cos(basePitchDown) * targetDist);
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
