/**
 * ETS Grafika Komputer - Lingkungan 02: Hutan Alami (Forest)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
let forestGroup, firefliesParticles;

const cylinderRadius = 2.6; // Diameter diperbesar menjadi 5.2
const cylinderHeight = 3.8; // Diperlebar agar memuat 2 layer pepohonan (depan & belakang)
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

function createSunsetSun(scene) {
  const sunGroup = new THREE.Group();
  // Posisi di dalam background langit di depan horizon jalan
  const sunPos = new THREE.Vector3(7.5, -2.8, 38.0);
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

  // 3. Sumber Cahaya Matahari Kuning Alami Selaras dengan Background
  const sunLight = new THREE.DirectionalLight(0xfef08a, 1.5);
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(2.6, 0, 5.0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Point Light pendar lokal matahari kuning
  const sunPoint = new THREE.PointLight(0xfacc15, 1.8, 75, 1.1);
  sunPoint.position.copy(sunPos);
  scene.add(sunPoint);

  // Hemisphere Light alami selaras dengan atmosfer kubah langit & tanah hutan
  const hemiLight = new THREE.HemisphereLight(
    0xfef9c3, // Cahaya lembut kubah langit
    0x292524, // Pantulan tanah humus hutan alami
    0.75
  );
  scene.add(hemiLight);

  return { sunGroup, coreSprite, bloomSprite, sunLight };
}

function initForest() {
  // 1. Scene & Sky (Belfast Sunset Pure Sky EXR)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9a3412);

  // 2. Camera (FOV 82 untuk pandangan lebih zoom-out & sinematik)
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(82, aspect, 0.05, 200);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;

  // Load Background 360° Langit Sore / Sunset (Belfast Sunset Pure Sky EXR)
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
      color: 0xfff7ed,
      depthWrite: false
    });
    skySphere = new THREE.Mesh(skyGeo, skyMat);
    skySphere.rotation.order = 'ZXY';
    skySphere.rotation.z = -Math.PI / 2; // Menyelaraskan zenith langit dengan UP kamera (+X)
    skySphere.rotation.x = Math.PI * 0.48;
    skySphere.rotation.y = Math.PI * 1.35; // Arahkan lengkungan horizon senja ke depan jalan
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

  // 5. Pencahayaan & Objek Matahari Sore Buatan Sendiri
  sunVisuals = createSunsetSun(scene);

  const forestGlow = new THREE.PointLight(0xfde047, 0.4, 15);
  forestGlow.position.set(0, 5, 3);
  scene.add(forestGlow);

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
    tex.repeat.set(1.2, 7);
  });

  sideMaterial = new THREE.MeshStandardMaterial({
    map: roadColor,
    normalMap: roadNormal,
    roughnessMap: roadRoughness,
    roughness: 0.7,
    metalness: 0.1,
    wireframe: isWireframe
  });

  capMaterial = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    roughnessMap: metalRoughness,
    metalnessMap: metalMetalness,
    roughness: 0.35,
    metalness: 0.8,
    wireframe: isWireframe
  });

  standardMaterials = [sideMaterial, capMaterial, capMaterial];

  // 8. Objek Utama: Tabung Drum Tegak Diameter Besar & Lebar
  const geom = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 32);
  mainMesh = new THREE.Mesh(geom, standardMaterials);
  scene.add(mainMesh);

  // Bibir Metal Tabung
  const rimGeo = new THREE.TorusGeometry(cylinderRadius + 0.02, 0.04, 16, 64);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x6ee7b7, metalness: 0.8, roughness: 0.25 });

  const topRim = new THREE.Mesh(rimGeo, rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = cylinderHeight / 2;
  mainMesh.add(topRim);

  const bottomRim = new THREE.Mesh(rimGeo, rimMat);
  bottomRim.rotation.x = Math.PI / 2;
  bottomRim.position.y = -cylinderHeight / 2;
  mainMesh.add(bottomRim);

  // 9. Pepohonan Hutan & Kunang-kunang
  buildForestScenery();
  buildFireflies();
}

// Membuat pohon pinus/cemara prosedural di sepanjang jalan tabung
function createTree() {
  const treeGroup = new THREE.Group();

  // Batang pohon kayu cokelat
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.85 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.4;
  treeGroup.add(trunk);

  // Daun cemara bertingkat hijau asri
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    roughness: 0.6,
    flatShading: true
  });

  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.8, 7), foliageMat);
  cone1.position.y = 0.9;
  treeGroup.add(cone1);

  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.7, 7), foliageMat);
  cone2.position.y = 1.35;
  treeGroup.add(cone2);

  const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.6, 7), foliageMat);
  cone3.position.y = 1.75;
  treeGroup.add(cone3);

  return treeGroup;
}

function buildForestScenery() {
  forestGroup = new THREE.Group();
  mainMesh.add(forestGroup); // Menempel langsung pada tabung agar ikut berputar!

  const xAxis = new THREE.Vector3(0, -1, 0);

  // 1A. Pepohonan Baris Depan (Sisi Tepi Jalan)
  const frontTreeCount = 48;
  for (let i = 0; i < frontTreeCount; i++) {
    const tree = createTree();
    const side = (i % 2 === 0) ? 1 : -1;

    const theta = (i / frontTreeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (0.96 + Math.random() * 0.20); // Baris depan dekat jalan

    const scale = 0.70 + Math.random() * 0.35;
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

  // 1B. Pepohonan Baris Belakang (Hutan Rimba Rimbun & Lebih Tinggi di Balik Pohon Depan)
  const backTreeCount = 60;
  for (let k = 0; k < backTreeCount; k++) {
    const tree = createTree();
    const side = (k % 2 === 0) ? 1 : -1;

    const theta = (k / backTreeCount) * Math.PI * 2 + 0.05 + (Math.random() - 0.5) * 0.08;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (1.38 + Math.random() * 0.36); // Baris belakang lebih jauh dari jalan

    // Pohon baris belakang lebih tinggi dan rimbun
    const scale = 1.05 + Math.random() * 0.50;
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

  // 2. Tambahkan bebatuan dan semak di pinggir aspal tabung
  const rockGeo = new THREE.DodecahedronGeometry(0.12, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const bushGeo = new THREE.SphereGeometry(0.18, 6, 6);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.7, flatShading: true });

  for (let j = 0; j < 40; j++) {
    const theta = (j / 40) * Math.PI * 2 + 0.1;
    const side = (j % 2 === 0) ? 1 : -1;
    const posX = cylinderRadius * Math.cos(theta);
    const posZ = cylinderRadius * Math.sin(theta);
    const posY = side * (0.86 + Math.random() * 0.16);

    const isRock = (j % 2 === 0);
    const propMesh = new THREE.Mesh(isRock ? rockGeo : bushGeo, isRock ? rockMat : bushMat);
    const pScale = 0.9 + Math.random() * 0.5;
    propMesh.scale.set(pScale, pScale, pScale);

    const propWrapper = new THREE.Group();
    propWrapper.add(propMesh);

    const yAxis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const zAxis = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    propWrapper.setRotationFromMatrix(basisMat);
    propWrapper.position.set(posX, posY, posZ);
    forestGroup.add(propWrapper);
  }
}

// Partikel kunang-kunang hutan yang berpendar
function buildFireflies() {
  const count = 140;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i += 3) {
    pos[i] = (Math.random() - 0.5) * 12;
    pos[i + 1] = (Math.random() - 0.5) * 6;
    pos[i + 2] = Math.random() * 12;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfde047, // Kunang-kunang senja keemasan
    size: 0.09,
    transparent: true,
    opacity: 0.85
  });

  firefliesParticles = new THREE.Points(geo, mat);
  scene.add(firefliesParticles);
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
      btnToggleCam.style.borderColor = '#f59e0b';
      btnToggleCam.style.color = '#f59e0b';
    }
    infoDetail.textContent = 'Kamera tetap di selimut tabung hutan | Suasana sore hari & senja keemasan';
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

    // Animasi ayunan pohon pelan tertiup angin
    if (forestGroup) {
      forestGroup.children.forEach((wrapper, idx) => {
        if (wrapper.children.length > 0) {
          wrapper.children[0].rotation.z = Math.sin(elapsed * 1.5 + idx) * 0.03;
        }
      });
    }

    // Gerak kunang-kunang
    if (firefliesParticles) {
      firefliesParticles.rotation.y = elapsed * 0.15;
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

  // Pendaran halus denyut cahaya matahari alami
  if (sunVisuals) {
    const pulse = 1.0 + Math.sin(time * 0.002) * 0.04;
    sunVisuals.coreSprite.scale.set(8.5 * pulse, 8.5 * pulse, 1);
    sunVisuals.bloomSprite.scale.set(18.0 * pulse, 18.0 * pulse, 1);
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
