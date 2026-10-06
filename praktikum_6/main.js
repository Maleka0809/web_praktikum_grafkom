import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---- SCENE, CAMERA, RENDERER ----
const canvas = document.getElementById('webglCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0f1d'); // Default bg color

const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
camera.position.set(0, 3, 6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ---- CONTROLS ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground

// ---- LIGHTING ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 8, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 25;
const d = 10;
directionalLight.shadow.camera.left = -d;
directionalLight.shadow.camera.right = d;
directionalLight.shadow.camera.top = d;
directionalLight.shadow.camera.bottom = -d;
scene.add(directionalLight);

// Light Helper
const dirLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
dirLightHelper.visible = false;
scene.add(dirLightHelper);

// ---- GROUND ----
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x334455,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---- OBJECT GEOMETRIES ----
const geometries = {
    cube: new THREE.BoxGeometry(2, 2, 2),
    sphere: new THREE.SphereGeometry(1.2, 32, 16),
    torus: new THREE.TorusGeometry(0.8, 0.4, 16, 48),
    torusKnot: new THREE.TorusKnotGeometry(0.8, 0.25, 100, 16),
    cone: new THREE.ConeGeometry(1.2, 2.5, 32),
    cylinder: new THREE.CylinderGeometry(1, 1, 2.5, 32)
};

// ---- OBJECT MATERIALS ----
const materials = {
    standard: new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.3, metalness: 0.4 }),
    phong: new THREE.MeshPhongMaterial({ color: 0x22d3ee, shininess: 100 }),
    lambert: new THREE.MeshLambertMaterial({ color: 0xf472b6 }),
    basic: new THREE.MeshBasicMaterial({ color: 0xa78bfa }),
    normal: new THREE.MeshNormalMaterial(),
    wireframe: new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true })
};

let currentMesh = new THREE.Mesh(geometries.cube, materials.standard);
currentMesh.position.y = 1.2;
currentMesh.castShadow = true;
currentMesh.receiveShadow = true;
scene.add(currentMesh);

// ---- STATE ----
let time = 0;
let isAnimating = true;
let isOrbitingLight = false;
let frames = 0;
let lastTime = performance.now();

// ---- HUD ELEMENTS ----
const fpsDisplay = document.getElementById('fpsDisplay');
const camPosDisplay = document.getElementById('camPosDisplay');
const lightStatusDisplay = document.getElementById('lightStatusDisplay');
const shadowStatusDisplay = document.getElementById('shadowStatusDisplay');

// ---- UI CONTROLS ----
document.getElementById('shapeSelect').addEventListener('change', (e) => {
    currentMesh.geometry = geometries[e.target.value];
});

document.getElementById('materialSelect').addEventListener('change', (e) => {
    currentMesh.material = materials[e.target.value];
    
    // Basic material ignores lights, turn off shadows visually
    if(e.target.value === 'basic' || e.target.value === 'wireframe') {
        currentMesh.castShadow = false;
    } else {
        currentMesh.castShadow = document.getElementById('shadowToggle').checked;
    }
});

document.getElementById('animateToggle').addEventListener('change', (e) => {
    isAnimating = e.target.checked;
});

document.getElementById('ambientLightToggle').addEventListener('change', (e) => {
    ambientLight.visible = e.target.checked;
    updateLightStatus();
});

document.getElementById('ambientIntensity').addEventListener('input', (e) => {
    ambientLight.intensity = parseFloat(e.target.value);
    document.getElementById('ambientIntensityVal').innerText = ambientLight.intensity.toFixed(2);
});

document.getElementById('dirLightToggle').addEventListener('change', (e) => {
    directionalLight.visible = e.target.checked;
    updateLightStatus();
});

document.getElementById('dirIntensity').addEventListener('input', (e) => {
    directionalLight.intensity = parseFloat(e.target.value);
    document.getElementById('dirIntensityVal').innerText = directionalLight.intensity.toFixed(2);
});

document.getElementById('shadowToggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    renderer.shadowMap.enabled = enabled;
    
    // Force materials update to re-compile shaders for shadows
    scene.traverse((child) => {
        if (child.material) {
            child.material.needsUpdate = true;
        }
    });
    
    shadowStatusDisplay.innerText = enabled ? "ENABLED" : "DISABLED";
    shadowStatusDisplay.style.color = enabled ? "var(--cyan)" : "var(--muted)";
});

document.getElementById('lightHelperToggle').addEventListener('change', (e) => {
    dirLightHelper.visible = e.target.checked;
});

document.getElementById('animateLightBtn').addEventListener('click', () => {
    isOrbitingLight = !isOrbitingLight;
    document.getElementById('animateLightBtn').innerText = isOrbitingLight ? "Stop Orbit Light" : "Orbit Directional Light";
    document.getElementById('animateLightBtn').classList.toggle('btn-primary');
    document.getElementById('animateLightBtn').classList.toggle('btn-outline');
});

document.getElementById('groundColor').addEventListener('input', (e) => {
    ground.material.color.set(e.target.value);
});

document.getElementById('bgColor').addEventListener('input', (e) => {
    scene.background.set(e.target.value);
});

document.getElementById('resetCameraBtn').addEventListener('click', () => {
    camera.position.set(0, 3, 6);
    controls.target.set(0, 0, 0);
    controls.update();
});

document.getElementById('resetAllBtn').addEventListener('click', () => {
    location.reload();
});

function updateLightStatus() {
    const anyLight = ambientLight.visible || directionalLight.visible;
    lightStatusDisplay.innerText = anyLight ? "ON" : "OFF";
    lightStatusDisplay.style.color = anyLight ? "var(--cyan)" : "var(--muted)";
}

// Window resize handling
window.addEventListener('resize', () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height, false);
});

// Remove status badge on load
document.getElementById('statusBadge').innerText = "THREE.JS READY";
document.getElementById('statusBadge').classList.add('ready');

// ---- ANIMATION LOOP ----
function animate() {
    requestAnimationFrame(animate);

    // FPS calculation
    frames++;
    const currentTime = performance.now();
    if (currentTime > lastTime + 1000) {
        fpsDisplay.innerText = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;
    }

    if (isAnimating) {
        time += 0.01;
        // Rotate Object
        currentMesh.rotation.x += 0.01;
        currentMesh.rotation.y += 0.015;
        // Bounce Object
        currentMesh.position.y = 1.2 + Math.sin(time * 3) * 0.5;
    }

    if (isOrbitingLight) {
        const lightTime = performance.now() * 0.001;
        directionalLight.position.x = Math.sin(lightTime) * 8;
        directionalLight.position.z = Math.cos(lightTime) * 8;
        if(dirLightHelper.visible) dirLightHelper.update();
    }

    // Update HUD
    camPosDisplay.innerText = `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;

    controls.update();
    renderer.render(scene, camera);
}

animate();
