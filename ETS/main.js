/**
 * ETS Grafika Komputer - Canvas & Main.js
 * Menggabungkan WebGL, GLSL Shaders, dan Three.js dalam satu file mandiri.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global DOM Elements ---
const canvas = document.getElementById('mainCanvas');
const modeDisplay = document.getElementById('modeDisplay');
const fpsDisplay = document.getElementById('fpsDisplay');
const infoDetail = document.getElementById('infoDetail');

const btnThree = document.getElementById('btnThree');
const btnGLSL = document.getElementById('btnGLSL');
const btnWebGL = document.getElementById('btnWebGL');

const btnToggleCam = document.getElementById('btnToggleCam');
const btnToggleAnim = document.getElementById('btnToggleAnim');
const btnResetCam = document.getElementById('btnResetCam');
const btnWireframe = document.getElementById('btnWireframe');
const btnColor = document.getElementById('btnColor');

// --- Global State ---
let currentMode = 'three'; // 'three' | 'glsl' | 'webgl'
let isAnimating = true;
let isWireframe = false;
let colorIndex = 0;
const colorPalette = [0x22d3ee, 0x8b5cf6, 0xf472b6, 0x10b981, 0xfbbf24];

let cameraView = 'surface'; // 'surface' (Kamera tetap di atas selimut) | 'orbit' (Luar 3D)
const cylinderRadius = 1.15;
const eyeHeight = 0.45; // Posisi zoom out lapang
const basePitchDown = 25 * (Math.PI / 180); // Menunduk 25 derajat ke bawah langsung ke jalan aspal

let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;

// ============================================================================
// 1. THREE.JS & GLSL SETUP
// ============================================================================
let scene, camera, renderer, controls;
let mainMesh;
let sideMaterial, capMaterial, customShaderSideMaterial;
let standardMaterials, customShaderMaterials;

// GLSL Vertex Shader
const customVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  uniform float uTime;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Deformasi sinusoidal gelombang pada verteks
    vec3 pos = position;
    float wave = sin(pos.x * 3.0 + uTime * 2.5) * cos(pos.y * 3.0 + uTime * 2.0) * 0.18;
    pos += normal * wave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// GLSL Fragment Shader
const customFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  uniform float uTime;
  uniform vec3 uColor;
  uniform sampler2D uRoadTexture;

  void main() {
    // Sample tekstur road dirotasi 90 derajat pada selimut tabung
    vec4 roadTex = texture2D(uRoadTexture, vec2(vUv.y * 3.0, vUv.x));

    // Efek pendaran Fresnel (rim light)
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    rim = pow(rim, 2.5);

    // Animasi gelombang warna di fragmen shader dipadukan dengan tekstur jalan
    float pulse = sin(uTime * 3.0 + vUv.x * 6.28) * 0.5 + 0.5;
    vec3 col = roadTex.rgb * mix(vec3(1.0), uColor, 0.35);
    col += vec3(0.15, 0.85, 1.0) * pulse * 0.3;
    col += vec3(0.9, 0.4, 1.0) * rim * 1.3;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function initThree() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040714);

  // Camera
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(76, aspect, 0.05, 100);

  // Renderer (terhubung langsung ke mainCanvas)
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // OrbitControls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Inisialisasi Kamera di Selimut Tabung
  setCameraView('surface');

  // Pencahayaan
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(5, 8, 4);
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0x22d3ee, 2, 10);
  pointLight.position.set(-2, 2, 2);
  scene.add(pointLight);

  // Grid pembantu
  const grid = new THREE.GridHelper(16, 16, 0x8b5cf6, 0x1e293b);
  grid.position.y = -1.6;
  scene.add(grid);

  // Load Texture Road untuk Selimut Tabung
  const textureLoader = new THREE.TextureLoader();
  const roadColor = textureLoader.load('./assets/textures/road/color.jpg');
  const roadNormal = textureLoader.load('./assets/textures/road/normal.jpg');
  const roadRoughness = textureLoader.load('./assets/textures/road/roughness.jpg');

  // Load Texture Metal untuk Tutup Atas & Bawah Tabung
  const metalColor = textureLoader.load('./assets/textures/metal/color.jpg');
  const metalNormal = textureLoader.load('./assets/textures/metal/normal.jpg');
  const metalRoughness = textureLoader.load('./assets/textures/metal/roughness.jpg');
  const metalMetalness = textureLoader.load('./assets/textures/metal/metalness.jpg');

  // Konfigurasi rotasi 90 derajat agar arah jalan melingkari selimut tabung
  roadColor.wrapS = THREE.RepeatWrapping;
  roadColor.wrapT = THREE.RepeatWrapping;
  roadColor.center.set(0.5, 0.5);
  roadColor.rotation = Math.PI / 2;
  roadColor.repeat.set(1, 3);

  roadNormal.wrapS = THREE.RepeatWrapping;
  roadNormal.wrapT = THREE.RepeatWrapping;
  roadNormal.center.set(0.5, 0.5);
  roadNormal.rotation = Math.PI / 2;
  roadNormal.repeat.set(1, 3);

  roadRoughness.wrapS = THREE.RepeatWrapping;
  roadRoughness.wrapT = THREE.RepeatWrapping;
  roadRoughness.center.set(0.5, 0.5);
  roadRoughness.rotation = Math.PI / 2;
  roadRoughness.repeat.set(1, 3);

  // Material Selimut Tabung (PBR Standard dengan tekstur Road)
  sideMaterial = new THREE.MeshStandardMaterial({
    map: roadColor,
    normalMap: roadNormal,
    roughnessMap: roadRoughness,
    roughness: 0.65,
    metalness: 0.15,
    wireframe: isWireframe
  });

  // Material Tutup Atas & Tutup Bawah Tabung (Metal Chrome Asli)
  capMaterial = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    roughnessMap: metalRoughness,
    metalnessMap: metalMetalness,
    roughness: 0.3,
    metalness: 0.85,
    wireframe: isWireframe
  });

  // THREE.CylinderGeometry groups: [0: selimut/side, 1: tutup atas/top, 2: tutup bawah/bottom]
  standardMaterials = [sideMaterial, capMaterial, capMaterial];

  // Custom GLSL ShaderMaterial untuk Selimut Tabung
  customShaderSideMaterial = new THREE.ShaderMaterial({
    vertexShader: customVertexShader,
    fragmentShader: customFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorPalette[colorIndex]) },
      uRoadTexture: { value: roadColor }
    },
    wireframe: isWireframe
  });

  customShaderMaterials = [customShaderSideMaterial, capMaterial, capMaterial];

  // Objek Utama: Tabung Drum / Kaleng Tegak
  // Parameter: radiusTop, radiusBottom, height, radialSegments, heightSegments
  const geom = new THREE.CylinderGeometry(1.15, 1.15, 2.1, 64, 32);
  mainMesh = new THREE.Mesh(geom, standardMaterials);
  scene.add(mainMesh);

  // Bibir / Cincin Metal Tabung Atas & Bawah
  const rimGeo = new THREE.TorusGeometry(1.16, 0.035, 16, 64);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.9,
    roughness: 0.2,
    wireframe: isWireframe
  });

  const topRim = new THREE.Mesh(rimGeo, rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 1.05;
  mainMesh.add(topRim);

  const bottomRim = new THREE.Mesh(rimGeo, rimMat);
  bottomRim.rotation.x = Math.PI / 2;
  bottomRim.position.y = -1.05;
  mainMesh.add(bottomRim);
}

// ============================================================================
// 2. NATIVE WEBGL 2.0 (RAW PIPELINE TANPA THREE.JS)
// ============================================================================
let gl = null;
let webglProgram = null;
let webglVao = null;
let webglIndexCount = 0;
let webglUniformTime = null;
let webglUniformResolution = null;

function initNativeWebGL() {
  gl = canvas.getContext('webgl2');
  if (!gl) {
    console.error('WebGL 2 tidak didukung');
    return;
  }

  // Shader GLSL ES 3.0 Native
  const vsSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    out vec4 fragColor;

    // Signed Distance Function untuk Silinder 3D (Capped Cylinder)
    float sdCylinder(vec3 p, float h, float r) {
      vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
      return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
    }

    vec3 calcNormal(vec3 p, float h, float r) {
      vec2 e = vec2(0.002, 0.0);
      return normalize(vec3(
        sdCylinder(p + e.xyy, h, r) - sdCylinder(p - e.xyy, h, r),
        sdCylinder(p + e.yxy, h, r) - sdCylinder(p - e.yxy, h, r),
        sdCylinder(p + e.yyx, h, r) - sdCylinder(p - e.yyx, h, r)
      ));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
      vec3 ro = vec3(0.0, 0.0, 3.6);
      vec3 rd = normalize(vec3(p, -1.2));

      // Rotasi silinder 3D
      float rotY = u_time * 0.9;
      float rotX = 0.35 + sin(u_time * 0.5) * 0.2;
      mat2 ry = mat2(cos(rotY), -sin(rotY), sin(rotY), cos(rotY));
      mat2 rx = mat2(cos(rotX), -sin(rotX), sin(rotX), cos(rotX));

      float t = 0.0;
      float d = 0.0;
      float cylH = 1.0;
      float cylR = 0.75;

      for (int i = 0; i < 64; i++) {
        vec3 pos = ro + rd * t;
        pos.yz = rx * pos.yz;
        pos.xz = ry * pos.xz;
        d = sdCylinder(pos, cylH, cylR);
        t += d;
        if (d < 0.001 || t > 10.0) break;
      }

      vec3 bg = vec3(0.02, 0.04, 0.08);
      if (t < 10.0) {
        vec3 hitPos = ro + rd * t;
        hitPos.yz = rx * hitPos.yz;
        hitPos.xz = ry * hitPos.xz;
        vec3 normal = calcNormal(hitPos, cylH, cylR);

        vec3 lightDir = normalize(vec3(1.2, 1.8, 2.0));
        float diff = max(dot(normal, lightDir), 0.0);
        float spec = pow(max(dot(normal, normalize(lightDir + vec3(0.0, 0.0, 1.0))), 0.0), 32.0);

        vec3 baseColor = vec3(0.13, 0.83, 0.98); // Cyan Silinder
        vec3 col = baseColor * (0.25 + diff * 0.75) + vec3(1.0) * spec * 0.6;
        fragColor = vec4(col, 1.0);
      } else {
        fragColor = vec4(bg, 1.0);
      }
    }
  `;

  // Kompilasi shader
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  webglProgram = gl.createProgram();
  gl.attachShader(webglProgram, vs);
  gl.attachShader(webglProgram, fs);
  gl.linkProgram(webglProgram);

  webglUniformTime = gl.getUniformLocation(webglProgram, 'u_time');
  webglUniformResolution = gl.getUniformLocation(webglProgram, 'u_resolution');

  // Quad Geometry
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]);

  webglVao = gl.createVertexArray();
  gl.bindVertexArray(webglVao);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(webglProgram, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  webglIndexCount = 4;
}

// ============================================================================
// 3. MAIN RENDER LOOP & RESIZE
// ============================================================================
function onResize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    if (currentMode !== 'webgl' && renderer) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    } else if (gl) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
}

function animate(time) {
  requestAnimationFrame(animate);

  const elapsed = time * 0.001;
  const delta = (time - lastTime) * 0.001;
  lastTime = time;

  // FPS Calculator
  frameCount++;
  fpsTimer += delta;
  if (fpsTimer >= 0.5) {
    fpsDisplay.textContent = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }

  onResize();

  if (currentMode === 'three' || currentMode === 'glsl') {
    if (isAnimating) {
      // Rotasi tabung pada sumbu Y (permukaan jalan berputar menggelinding di bawah kaki)
      mainMesh.rotation.y += delta * 0.75;
      mainMesh.rotation.x = 0;

      // Update waktu GLSL Shader
      if (customShaderSideMaterial) {
        customShaderSideMaterial.uniforms.uTime.value = elapsed;
      }
    }

    if (cameraView === 'surface') {
      // Kamera stay (diam tenang di tempat, tanpa goyangan walking / head-bobbing)
      const camX = cylinderRadius + eyeHeight;
      const camY = 0;
      const camZ = 0;
      camera.position.set(camX, camY, camZ);
      camera.up.set(1, 0, 0); // Up vector tegak lurus terhadap selimut tabung

      // Arah pandang tetap menunduk 25 derajat lurus ke permukaan aspal di depan
      const targetDist = 3.2;
      const targetX = camX - Math.sin(basePitchDown) * targetDist;
      const targetY = 0;
      const targetZ = Math.cos(basePitchDown) * targetDist;
      camera.lookAt(targetX, targetY, targetZ);
    } else {
      controls.update();
    }

    renderer.render(scene, camera);
  } else if (currentMode === 'webgl' && gl) {
    gl.clearColor(0.02, 0.04, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(webglProgram);
    gl.uniform1f(webglUniformTime, isAnimating ? elapsed : 0);
    gl.uniform2f(webglUniformResolution, canvas.width, canvas.height);

    gl.bindVertexArray(webglVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, webglIndexCount);
    gl.bindVertexArray(null);
  }
}

// ============================================================================
// 4. UI CONTROLS & EVENT LISTENERS
// ============================================================================
function setMode(mode) {
  currentMode = mode;
  btnThree.classList.toggle('active', mode === 'three');
  btnGLSL.classList.toggle('active', mode === 'glsl');
  btnWebGL.classList.toggle('active', mode === 'webgl');

  if (mode === 'three') {
    modeDisplay.textContent = 'Three.js Tabung Drum (Road)';
    infoDetail.textContent = 'Tabung tegak PBR dengan selimut Road & tutup metal | Drag mouse untuk orbit';
    mainMesh.material = standardMaterials;
  } else if (mode === 'glsl') {
    modeDisplay.textContent = 'Custom GLSL Tabung (Road)';
    infoDetail.textContent = 'Tabung tegak selimut Road + Deformasi Gelombang & Fresnel GLSL';
    mainMesh.material = customShaderMaterials;
  } else if (mode === 'webgl') {
    modeDisplay.textContent = 'Native WebGL Tabung';
    infoDetail.textContent = 'Tabung 3D Raymarching Pipeline Native GLSL ES 3.0';
    if (!gl) initNativeWebGL();
    onResize();
  }
}

// Fungsi Pengatur Sudut Pandang Kamera
function setCameraView(mode) {
  cameraView = mode;
  if (cameraView === 'surface') {
    controls.enabled = false; // Nonaktifkan orbit mouse agar kamera tetap stay
    camera.fov = 76;
    camera.updateProjectionMatrix();
    camera.up.set(1, 0, 0);
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, 0);
    const targetDist = 3.2;
    camera.lookAt(camX - Math.sin(basePitchDown) * targetDist, 0, Math.cos(basePitchDown) * targetDist);

    if (btnToggleCam) {
      btnToggleCam.textContent = '📷 Kamera: Di Selimut (Fixed Smooth)';
      btnToggleCam.style.borderColor = '#22d3ee';
      btnToggleCam.style.color = '#22d3ee';
    }
    infoDetail.textContent = 'Kamera tetap di selimut tabung | Permukaan jalan berputar mulus (Smooth)';
  } else {
    controls.enabled = true;
    camera.fov = 48;
    camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    camera.position.set(0, 1.8, 4.5);
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

if (btnToggleCam) {
  btnToggleCam.addEventListener('click', () => {
    setCameraView(cameraView === 'surface' ? 'orbit' : 'surface');
  });
}

btnThree.addEventListener('click', () => setMode('three'));
btnGLSL.addEventListener('click', () => setMode('glsl'));
btnWebGL.addEventListener('click', () => setMode('webgl'));

btnToggleAnim.addEventListener('click', () => {
  isAnimating = !isAnimating;
  btnToggleAnim.textContent = isAnimating ? '⏸️ Pause (Space)' : '▶️ Play (Space)';
});

btnResetCam.addEventListener('click', () => {
  if (cameraView === 'surface') {
    setCameraView('surface');
  } else {
    camera.position.set(0, 1.8, 4.5);
    controls.target.set(0, 0, 0);
    controls.update();
  }
});

btnWireframe.addEventListener('click', () => {
  isWireframe = !isWireframe;
  sideMaterial.wireframe = isWireframe;
  capMaterial.wireframe = isWireframe;
  customShaderSideMaterial.wireframe = isWireframe;
  btnWireframe.textContent = isWireframe ? '🧊 Solid' : '🕸️ Wireframe';
});

btnColor.addEventListener('click', () => {
  colorIndex = (colorIndex + 1) % colorPalette.length;
  const col = colorPalette[colorIndex];
  capMaterial.color.setHex(col);
  customShaderSideMaterial.uniforms.uColor.value.setHex(col);
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    btnToggleAnim.click();
  } else if (e.key.toLowerCase() === 'r') {
    btnResetCam.click();
  } else if (e.key.toLowerCase() === 'c') {
    if (btnToggleCam) btnToggleCam.click();
  } else if (e.key === '1') {
    setMode('three');
  } else if (e.key === '2') {
    setMode('glsl');
  } else if (e.key === '3') {
    setMode('webgl');
  }
});

// --- Inisialisasi Pertama ---
initThree();
requestAnimationFrame(animate);
