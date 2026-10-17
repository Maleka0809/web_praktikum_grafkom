import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const $ = (selector) => document.querySelector(selector);
const container = $("#sceneContainer");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#080214");

// ==========================================================================
// 1. Cameras & Renderer
// ==========================================================================
const perspectiveCamera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
perspectiveCamera.position.set(0, 4.6, 9.2);

const orthographicCamera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
orthographicCamera.position.copy(perspectiveCamera.position);
let activeCamera = perspectiveCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
container.appendChild(renderer.domElement);

const renderPass = new RenderPass(scene, activeCamera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.3, 3.0);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactiveObjects = [];

// ==========================================================================
// 2. Global State
// ==========================================================================
const state = {
  environment: true,
  panorama: true,
  bloom: true,
  solar: true,
  orbitSpeed: 0.45,
  roughness: 0.35,
  metalness: 0.65,
  time: 0,
  hovered: null,
  selected: null,
  gltfRoot: null,
  mixer: null,
  actions: [],
  activeAction: null,
  clipIndex: 0,
};

const cameraTarget = new THREE.Vector3(0, 0.9, 0);
let controls;
const orbitDefaults = {
  enabled: true,
  enableDamping: true,
  enablePan: true,
  dampingFactor: 0.05,
  rotateSpeed: 1,
  zoomSpeed: 1,
};
const orbitSettings = { ...orbitDefaults };

function applyOrbitSettings() {
  Object.assign(controls, orbitSettings);
  const dampingFactorInput = document.querySelector("#cameraDampingFactor");
  if (dampingFactorInput) {
    dampingFactorInput.disabled = !orbitSettings.enableDamping;
  }
}

function resetOrbitSettings() {
  Object.assign(orbitSettings, orbitDefaults);
  for (const [key, value] of Object.entries(orbitSettings)) {
    const input = document.querySelector(`[data-orbit-setting="${key}"]`);
    if (!input) continue;
    if (typeof value === "boolean") input.checked = value;
    else {
      input.value = value;
      const valElem = document.querySelector(`#${input.id}Value`);
      if (valElem) valElem.textContent = value.toFixed(2);
    }
  }
}

document.querySelectorAll("[data-orbit-setting]").forEach((input) => {
  input.addEventListener("input", () => {
    orbitSettings[input.dataset.orbitSetting] =
      input.type === "checkbox" ? input.checked : Number(input.value);
    if (input.type !== "checkbox") {
      const valElem = document.querySelector(`#${input.id}Value`);
      if (valElem) valElem.textContent = Number(input.value).toFixed(2);
    }
    applyOrbitSettings();
  });
});

function configureControls(target = cameraTarget) {
  controls?.dispose();
  controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.target.copy(target);
  applyOrbitSettings();
  controls.minDistance = 2.5;
  controls.maxDistance = 28;
  controls.minZoom = 0.5;
  controls.maxZoom = 3.5;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();
}
configureControls();

// ==========================================================================
// 3. Environment & HDR Skybox (PMREM Image-Based Lighting)
// ==========================================================================
let panoramaTexture = createEnvironmentTexture();
panoramaTexture.colorSpace = THREE.SRGBColorSpace;
panoramaTexture.mapping = THREE.EquirectangularReflectionMapping;

const pmrem = new THREE.PMREMGenerator(renderer);
let environmentTarget = pmrem.fromEquirectangular(panoramaTexture);
let environmentTexture = environmentTarget.texture;
scene.backgroundIntensity = 0.35;
scene.environmentIntensity = 0.85;
applyEnvironment();
pmrem.compileEquirectangularShader();

const panoramaOptions = {
  moonless: { label: "Moonless Golf Night (Three.js HDR 1K)", url: new URL("./assets/moonless_golf_1k.hdr", import.meta.url).href },
  nebula: { label: "Cosmic Nebula & Stars (Space Panorama)" },
  studio: { label: "Studio Small 09 - HDR 1K", url: new URL("./assets/studio_small_09_1k.hdr", import.meta.url).href },
  ladybrand: { label: "Ladybrand Heritage House - HDR 1K", url: new URL("./assets/ladybrand_heritage_house_1k.hdr", import.meta.url).href },
  procedural: { label: "Procedural Cyberpunk Gradient" },
};
let activePanorama = "procedural";
let panoramaRequest = 0;

async function selectPanorama(key) {
  const option = panoramaOptions[key];
  if (!option) return;
  const request = ++panoramaRequest;
  const selectElem = $("#panoramaSelect");
  if (selectElem) selectElem.value = key;

  const statusElem = $("#panoramaStatus");
  if (key === activePanorama) {
    if (statusElem) statusElem.textContent = option.label;
    return;
  }
  if (statusElem) statusElem.textContent = `Memuat ${option.label}...`;

  let texture;
  try {
    if (key === "nebula") {
      texture = createNebulaTexture();
    } else if (option.url) {
      texture = await new HDRLoader().loadAsync(option.url);
    } else {
      texture = createEnvironmentTexture();
    }

    if (request !== panoramaRequest) {
      texture.dispose();
      return;
    }
    if (!option.url) texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;

    const nextTarget = pmrem.fromEquirectangular(texture);
    panoramaTexture.dispose();
    environmentTarget.dispose();
    panoramaTexture = texture;
    environmentTarget = nextTarget;
    environmentTexture = nextTarget.texture;
    activePanorama = key;
    applyEnvironment();
    if (statusElem) statusElem.textContent = option.label;
    log(`Panorama aktif: ${option.label}`);
  } catch (error) {
    texture?.dispose();
    if (request !== panoramaRequest) return;
    if (selectElem) selectElem.value = activePanorama;
    if (statusElem) statusElem.textContent = `HDR gagal dimuat - ${panoramaOptions[activePanorama].label} tetap aktif`;
    console.warn("HDR loading error", error);
  }
}

const panoramaSelectElem = $("#panoramaSelect");
if (panoramaSelectElem) {
  panoramaSelectElem.addEventListener("change", (e) => selectPanorama(e.target.value));
}
selectPanorama("moonless");

// ==========================================================================
// 4. Lights & Static Ground Scene
// ==========================================================================
scene.add(new THREE.HemisphereLight("#38bdf8", "#3b0764", 0.75));

const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
keyLight.position.set(5, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const cyanPoint = new THREE.PointLight("#00f0ff", 8, 14, 2);
cyanPoint.position.set(-5, 3, 2);
scene.add(cyanPoint);

const magentaPoint = new THREE.PointLight("#f43f5e", 8, 14, 2);
magentaPoint.position.set(5, 3, 2);
scene.add(magentaPoint);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(15, 64),
  new THREE.MeshStandardMaterial({
    color: "#080414",
    roughness: 0.45,
    metalness: 0.55,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const polarGrid = new THREE.PolarGridHelper(14.5, 16, 8, 64, 0x8b5cf6, 0x1f143d);
polarGrid.position.y = 0.01;
scene.add(polarGrid);

// Starfield particles
const starGeometry = new THREE.BufferGeometry();
const starCount = 1200;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
  const radius = 24 + Math.random() * 30;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 0.5;
  starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

  const colType = Math.random();
  if (colType < 0.45) {
    starColors[i * 3] = 0.4; starColors[i * 3 + 1] = 0.9; starColors[i * 3 + 2] = 1.0;
  } else if (colType < 0.75) {
    starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.35; starColors[i * 3 + 2] = 0.85;
  } else {
    starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 1.0;
  }
}
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
const starMaterial = new THREE.PointsMaterial({
  size: 0.22,
  vertexColors: true,
  transparent: true,
  opacity: 0.85,
});
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

// ==========================================================================
// 5. Hierarchical Parent-Child Object (Glass Cube & Neon Sphere)
// ==========================================================================
const hierarchyGroup = new THREE.Group();
hierarchyGroup.name = "Hierarchy Parent Group";
hierarchyGroup.position.set(3.4, 1.2, 0);

const parentMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 1.3, 1.3),
  new THREE.MeshPhysicalMaterial({
    color: "#c084fc",
    roughness: 0.06,
    metalness: 0.05,
    transmission: 0.96,
    thickness: 1.4,
    ior: 1.55,
    opacity: 1,
  }),
);
parentMesh.name = "Parent Mesh - Amethyst Glass (transmission 0.96)";
parentMesh.castShadow = false;

const childMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.38, 24, 16),
  new THREE.MeshStandardMaterial({
    color: "#34d399",
    emissive: "#10b981",
    emissiveIntensity: 5,
    roughness: 0.25,
    metalness: 0.1,
  }),
);
childMesh.name = "Child Mesh - Emerald Neon (local 0.9, 0.8, 0)";
childMesh.position.set(0.9, 0.8, 0);
childMesh.castShadow = false;
childMesh.material.userData.preserveEmission = true;
childMesh.add(new THREE.PointLight("#10b981", 6, 6, 2));

hierarchyGroup.add(parentMesh, childMesh);
scene.add(hierarchyGroup);
interactiveObjects.push(parentMesh, childMesh);

// ==========================================================================
// 6. Challenge D — Hierarchical Solar System
// Hierarchy:
// Sun
// └── Earth Orbit
//     └── Earth
//         └── Moon Orbit
//             └── Moon
// ==========================================================================
const solarSystem = new THREE.Group();
solarSystem.name = "Solar System (Hierarchy Challenge)";
solarSystem.position.set(-3.2, 0, 0);

const sun = mesh(
  new THREE.SphereGeometry(0.68, 32, 20),
  new THREE.MeshStandardMaterial({
    color: "#ff007f",
    emissive: "#f43f5e",
    emissiveIntensity: 5,
    roughness: 0.2,
    metalness: 0.1,
  }),
  "Cyber Sun (Neon Magenta)",
);
sun.position.y = 1.1;
sun.castShadow = false;
sun.material.userData.preserveEmission = true;
sun.add(new THREE.PointLight("#ff007f", 9, 7, 2));

const earthOrbit = new THREE.Group();
earthOrbit.name = "Earth Orbit";
earthOrbit.position.y = 1.1;

const earth = mesh(
  new THREE.SphereGeometry(0.28, 24, 16),
  new THREE.MeshStandardMaterial({
    color: "#00f0ff",
    roughness: 0.35,
    metalness: 0.3,
  }),
  "Cyber Earth (Cyan)",
);
earth.position.x = 2.0;

const moonOrbit = new THREE.Group();
moonOrbit.name = "Moon Orbit";
moonOrbit.position.set(0, 0, 0); // Moon orbit is a child of Earth!

const moon = mesh(
  new THREE.SphereGeometry(0.11, 16, 12),
  new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    roughness: 0.5,
    metalness: 0.2,
  }),
  "Cyber Moon (Platinum)",
);
moon.position.x = 0.65; // Moon offset relative to Earth

// Visual orbital path rings
const earthOrbitPath = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    new Array(64).fill(0).map((_, i) => {
      const theta = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(theta) * 2.0, 0, Math.sin(theta) * 2.0);
    })
  ),
  new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.25 })
);
earthOrbit.add(earthOrbitPath);

const moonOrbitPath = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    new Array(48).fill(0).map((_, i) => {
      const theta = (i / 48) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(theta) * 0.65, 0, Math.sin(theta) * 0.65);
    })
  ),
  new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.35 })
);
earth.add(moonOrbitPath);

// Establish hierarchy
moonOrbit.add(moon);
earth.add(moonOrbit);
earthOrbit.add(earth);
solarSystem.add(sun, earthOrbit);
scene.add(solarSystem);
interactiveObjects.push(sun, earth, moon);

// ==========================================================================
// 7. Challenge E — PBR Material Gallery Grid (3x3 Matrix)
// Roughness -> (0.1, 0.5, 0.9)
// Metalness  | (1.0, 0.5, 0.0)
// ==========================================================================
const gallery = new THREE.Group();
gallery.name = "PBR Material Gallery";

const roughnessValues = [0.1, 0.5, 0.9];
const metalnessValues = [1.0, 0.5, 0.0];
const pbrSphereGrid = [];

roughnessValues.forEach((roughness, col) => {
  metalnessValues.forEach((metalness, row) => {
    const colX = (col - 1) * 0.95;
    const posY = 0.35 + (2 - row) * 0.75;
    const posZ = -2.3 + Math.abs(col - 1) * 0.35;

    // Rich metallic copper/cyan gradient tone
    const hue = (col * 35 + row * 120) % 360;
    const color = new THREE.Color().setHSL(hue / 360, 0.85, 0.55);

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      envMapIntensity: 1.0,
    });

    const sphere = mesh(
      new THREE.SphereGeometry(0.28, 24, 16),
      material,
      `PBR [Roughness: ${roughness.toFixed(1)}, Metalness: ${metalness.toFixed(1)}]`,
    );
    sphere.position.set(colX, posY, posZ);
    sphere.userData.isGallerySphere = true;
    sphere.userData.originalRoughness = roughness;
    sphere.userData.originalMetalness = metalness;

    gallery.add(sphere);
    interactiveObjects.push(sphere);
    pbrSphereGrid.push(sphere);
  });
});
scene.add(gallery);

// Standalone mirror reflection sphere
const silver = mesh(
  new THREE.SphereGeometry(0.82, 64, 40),
  new THREE.MeshStandardMaterial({
    color: "#f5a896",
    metalness: 1.0,
    roughness: 0.02,
    envMapIntensity: 1.35,
  }),
  "Rose-Gold Chrome - Pure HDR Reflection",
);
silver.position.set(-1.3, 0.85, 1.0);
scene.add(silver);
interactiveObjects.push(silver);

// ==========================================================================
// 8. GLTF/GLB Loader & Animations (Challenge A & B)
// ==========================================================================
const loader = new GLTFLoader();
const modelUrl = new URL("./Duck.glb", import.meta.url).href;

loader.load(
  modelUrl,
  (gltf) => {
    const root = gltf.scene;
    root.name = "Imported Duck GLB";
    fitImportedModel(root);

    root.traverse((object) => {
      if (!object.name) object.name = object.type;
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        // Non-destructive material isolation (Challenge F)
        if (object.material) {
          object.material = object.material.clone();
        }
        interactiveObjects.push(object);
      }
    });

    scene.add(root);
    state.gltfRoot = root;
    state.mixer = new THREE.AnimationMixer(root);

    // If Duck.glb doesn't have embedded animations, create 3 procedural clips
    const clips = gltf.animations.length ? gltf.animations : createFallbackClips();
    state.actions = clips.map((clip) => state.mixer.clipAction(clip));

    if (state.actions.length) playClip(0);

    const modelInfoElem = $("#modelInfo");
    if (modelInfoElem) modelInfoElem.textContent = `${clips.length} Clips (Active: ${clips[0].name.split(" ")[0]})`;
    const statusBadgeElem = $("#statusBadge");
    if (statusBadgeElem) statusBadgeElem.textContent = "GLB LOADED · READY";

    log(`GLB loaded: ${root.name}; ${countDescendants(root)} descendants.`);
    console.log("GLB hierarchy ready", {
      root: root.name,
      descendants: countDescendants(root),
      clips: clips.map((c) => c.name),
    });
  },
  undefined,
  (error) => {
    const modelInfoElem = $("#modelInfo");
    if (modelInfoElem) modelInfoElem.textContent = "Fallback Procedural";
    const statusBadgeElem = $("#statusBadge");
    if (statusBadgeElem) statusBadgeElem.textContent = "FALLBACK SCENE · READY";
    log("Duck.glb tidak dapat dimuat; scene procedural tetap aktif.");
    console.warn("GLB loading error", error);
  },
);

// Procedural Animation Clips for Challenge A
function createFallbackClips() {
  // Clip 1: Idle (calm bobbing and gentle nod)
  const idleTimes = [0, 0.5, 1.0, 1.5, 2.0];
  const idlePos = new THREE.NumberKeyframeTrack(
    ".position[y]",
    idleTimes,
    [0.05, 0.08, 0.05, 0.08, 0.05],
  );
  const idleRotX = new THREE.NumberKeyframeTrack(
    ".rotation[x]",
    idleTimes,
    [0, 0.05, 0, -0.05, 0],
  );
  const idleClip = new THREE.AnimationClip("1 · Idle (Bobbing)", 2.0, [idlePos, idleRotX]);

  // Clip 2: Walk (classic duck waddling side-to-side)
  const walkTimes = [0, 0.25, 0.5, 0.75, 1.0];
  const walkRotZ = new THREE.NumberKeyframeTrack(
    ".rotation[z]",
    walkTimes,
    [0, 0.16, 0, -0.16, 0],
  );
  const walkRotY = new THREE.NumberKeyframeTrack(
    ".rotation[y]",
    walkTimes,
    [-0.15, 0.1, 0.15, -0.1, -0.15],
  );
  const walkPos = new THREE.NumberKeyframeTrack(
    ".position[y]",
    walkTimes,
    [0.05, 0.11, 0.05, 0.11, 0.05],
  );
  const walkClip = new THREE.AnimationClip("2 · Walk (Waddling)", 1.0, [walkRotZ, walkRotY, walkPos]);

  // Clip 3: Run (fast energetic sprint & hop)
  const runTimes = [0, 0.11, 0.22, 0.33, 0.45];
  const runRotZ = new THREE.NumberKeyframeTrack(
    ".rotation[z]",
    runTimes,
    [0, -0.25, 0, 0.25, 0],
  );
  const runRotX = new THREE.NumberKeyframeTrack(
    ".rotation[x]",
    runTimes,
    [-0.1, 0.15, -0.1, 0.15, -0.1],
  );
  const runPos = new THREE.NumberKeyframeTrack(
    ".position[y]",
    runTimes,
    [0.05, 0.18, 0.05, 0.18, 0.05],
  );
  const runClip = new THREE.AnimationClip("3 · Run (Sprint)", 0.45, [runRotZ, runRotX, runPos]);

  return [idleClip, walkClip, runClip];
}

// Challenge A — Crossfading between animation clips
function playClip(index) {
  if (!state.actions.length) return;
  const next = state.actions[index % state.actions.length];
  state.clipIndex = index % state.actions.length;

  if (state.activeAction && state.activeAction !== next) {
    state.activeAction.fadeOut(0.25);
  }
  next.reset().fadeIn(0.25).play();
  state.activeAction = next;

  const clipName = next.getClip().name || `Clip ${state.clipIndex + 1}`;
  log(`Animation clip aktif: ${clipName} (Challenge A)`);

  const modelInfoElem = $("#modelInfo");
  if (modelInfoElem) modelInfoElem.textContent = clipName;

  // Update UI active buttons
  ["#clip1Button", "#clip2Button", "#clip3Button"].forEach((id, i) => {
    const btn = $(id);
    if (btn) {
      if (i === state.clipIndex) btn.classList.add("active-clip");
      else btn.classList.remove("active-clip");
    }
  });
}

function fitImportedModel(root) {
  root.scale.setScalar(1);
  const originalBounds = new THREE.Box3().setFromObject(root);
  const originalSize = originalBounds.getSize(new THREE.Vector3());
  const largestDimension = Math.max(originalSize.x, originalSize.y, originalSize.z);
  const targetSize = 1.8;
  root.scale.setScalar(largestDimension > 0 ? targetSize / largestDimension : 1);

  const fittedBounds = new THREE.Box3().setFromObject(root);
  const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
  root.position.set(0.4 - fittedCenter.x, 0.05 - fittedBounds.min.y, 1.1 - fittedCenter.z);
  root.rotation.y = -Math.PI / 8;
}

function countDescendants(root) {
  let count = 0;
  root.traverse(() => { count += 1; });
  return count;
}

function mesh(geometry, material, name) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = true;
  return object;
}

// ==========================================================================
// 9. Procedural Skybox & Nebula Generators
// ==========================================================================
function createNebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0, "#030009");
  bgGrad.addColorStop(0.5, "#070216");
  bgGrad.addColorStop(1, "#020006");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  function drawNebulaCloud(cx, cy, r, colorStart, colorEnd) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(0.6, colorEnd);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawNebulaCloud(250, 180, 200, "rgba(168, 85, 247, 0.45)", "rgba(147, 51, 234, 0.12)");
  drawNebulaCloud(380, 240, 170, "rgba(244, 63, 94, 0.38)", "rgba(225, 29, 72, 0.09)");
  drawNebulaCloud(650, 200, 230, "rgba(6, 182, 212, 0.4)", "rgba(14, 116, 144, 0.12)");
  drawNebulaCloud(820, 260, 180, "rgba(139, 92, 246, 0.38)", "rgba(109, 40, 217, 0.09)");
  drawNebulaCloud(110, 290, 150, "rgba(217, 70, 239, 0.35)", "rgba(192, 38, 211, 0.08)");

  let seed = 7331;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < 480; i++) {
    const x = rand() * 1024;
    const y = rand() * 512;
    const size = rand() < 0.88 ? rand() * 1.5 + 0.4 : rand() * 2.8 + 1.2;
    const starType = rand();

    let fill;
    if (starType < 0.4) fill = "rgba(255, 255, 255, 0.95)";
    else if (starType < 0.7) fill = "rgba(165, 243, 252, 0.95)";
    else if (starType < 0.9) fill = "rgba(244, 114, 182, 0.9)";
    else fill = "rgba(253, 224, 71, 0.9)";

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createEnvironmentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#080214");
  gradient.addColorStop(0.5, "#250a47");
  gradient.addColorStop(1, "#05010c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 24; i += 1) {
    context.fillStyle =
      i % 2 === 0
        ? `rgba(0,240,255,${0.05 + i * 0.002})`
        : `rgba(244,63,94,${0.05 + i * 0.002})`;
    context.fillRect(i * 22, 40 + (i % 6) * 18, 3, 140);
  }
  return new THREE.CanvasTexture(canvas);
}

// ==========================================================================
// 10. Raycasting, Selection, Hover & Emissive (Challenges B, C, F, G)
// ==========================================================================
function isDescendantOf(child, parent) {
  let curr = child;
  while (curr) {
    if (curr === parent) return true;
    curr = curr.parent;
  }
  return false;
}

// Determines the logical object for interaction
function getSelectableTarget(hitObject) {
  if (!hitObject) return null;
  // If clicked object is part of the imported GLB model, select GLB Root
  if (state.gltfRoot && isDescendantOf(hitObject, state.gltfRoot)) {
    return state.gltfRoot;
  }
  // Otherwise select the hit mesh directly (e.g. Earth, Moon, Sun, PBR sphere, etc.)
  return hitObject;
}

// Challenge F — Hover Emissive (Non-destructive)
function setEmissive(object, enabled) {
  if (!object) return;
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];

    materials.forEach((material) => {
      if (!("emissive" in material) || material.userData.preserveEmission) return;
      if (!material.userData.originalEmissive) {
        material.userData.originalEmissive = material.emissive.clone();
        material.userData.originalEmissiveIntensity = material.emissiveIntensity ?? 0;
      }

      material.emissive.copy(
        enabled ? new THREE.Color("#d88945") : material.userData.originalEmissive
      );
      material.emissiveIntensity = enabled
        ? 0.75
        : material.userData.originalEmissiveIntensity;
    });
  });
}

function setScaleFeedback(object, scale) {
  if (!object) return;
  const base = object.userData.baseScale || object.scale.clone();
  object.userData.baseScale = base;
  object.scale.copy(base).multiplyScalar(scale);
}

// Challenge C — Information Panel
function updateInfo(object) {
  const rootBadgeElem = $("#infoRootBadge");

  if (!object) {
    $("#infoTitle").textContent = "Belum ada objek dipilih";
    if (rootBadgeElem) rootBadgeElem.style.display = "none";
    ["#infoPosition", "#infoRotation", "#infoScale", "#infoMaterial"].forEach(
      (id) => ($(id).textContent = "-")
    );
    return;
  }

  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  $("#infoTitle").textContent = object.name || object.type;

  // Show root label if imported model
  if (rootBadgeElem) {
    if (state.gltfRoot && (object === state.gltfRoot || isDescendantOf(object, state.gltfRoot))) {
      rootBadgeElem.style.display = "inline-block";
      rootBadgeElem.textContent = `Root Model: ${state.gltfRoot.name}`;
    } else {
      rootBadgeElem.style.display = "none";
    }
  }

  $("#infoPosition").textContent =
    `local [${formatVector(object.position)}] · world [${formatVector(world)}]`;
  $("#infoRotation").textContent =
    `[${(object.rotation.x * 57.3).toFixed(1)}°, ${(object.rotation.y * 57.3).toFixed(1)}°, ${(object.rotation.z * 57.3).toFixed(1)}°]`;
  $("#infoScale").textContent = `[${formatVector(object.scale)}]`;

  let matText = materialName(object);
  if (object.material && "roughness" in object.material) {
    matText += ` (r: ${object.material.roughness.toFixed(2)}, m: ${object.material.metalness.toFixed(2)})`;
  }
  $("#infoMaterial").textContent = matText;
}

function materialName(object) {
  if (object.material) {
    return Array.isArray(object.material)
      ? object.material.map((m) => m.type).join(", ")
      : object.material.type;
  }
  return "Group / Node Hierarchy";
}

function formatVector(vector) {
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function raycast(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, activeCamera);
  const hits = raycaster.intersectObjects(interactiveObjects, true);
  return hits.length ? getSelectableTarget(hits[0].object) : null;
}

let selectionGesture = null;
let suppressSelection = false;

renderer.domElement.addEventListener("pointerdown", (event) => {
  suppressSelection = event.button !== 0 || selectionGesture !== null;
  selectionGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
});

window.addEventListener("pointermove", (event) => {
  if (!selectionGesture || event.pointerId !== selectionGesture.id) return;
  if (Math.hypot(event.clientX - selectionGesture.x, event.clientY - selectionGesture.y) > 5) {
    suppressSelection = true;
  }
}, true);

window.addEventListener("pointerup", (event) => {
  if (event.pointerId === selectionGesture?.id) selectionGesture = null;
});

window.addEventListener("pointercancel", () => {
  selectionGesture = null;
  suppressSelection = true;
});

// Pointer Move -> Hover Emissive (Challenge F)
renderer.domElement.addEventListener("pointermove", (event) => {
  if (selectionGesture) return;
  const next = raycast(event);
  if (next === state.hovered) return;

  if (state.hovered && state.hovered !== state.selected) {
    setEmissive(state.hovered, false);
    setScaleFeedback(state.hovered, 1);
  }

  state.hovered = next;
  $("#hoverInfo").textContent = next?.name || "-";

  if (next && next !== state.selected) {
    setEmissive(next, true);
    setScaleFeedback(next, 1.06);
    log(`Hover: ${next.name} · NDC: [${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)}]`);
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  if (state.hovered && state.hovered !== state.selected) {
    setEmissive(state.hovered, false);
    setScaleFeedback(state.hovered, 1);
  }
  state.hovered = null;
  $("#hoverInfo").textContent = "-";
});

// Click -> Select & Play Animation (Challenge B & G)
renderer.domElement.addEventListener("click", (event) => {
  if (suppressSelection || event.button !== 0) return;
  const next = raycast(event);

  if (state.selected && state.selected !== next) {
    setEmissive(state.selected, false);
    setScaleFeedback(state.selected, 1);
  }

  state.selected = next;
  $("#selectedInfo").textContent = next?.name || "-";
  updateInfo(next);

  if (next) {
    setEmissive(next, true);
    setScaleFeedback(next, 1.12);

    const isDuck = state.gltfRoot && (next === state.gltfRoot || isDescendantOf(next, state.gltfRoot));
    if (isDuck) {
      // Challenge B: Click -> Select -> Play Animation
      state.clipIndex = (state.clipIndex + 1) % (state.actions.length || 1);
      playClip(state.clipIndex);
      log(`Click imported model: ${state.gltfRoot.name} dipilih · Memainkan animation clip ${state.clipIndex + 1}!`);
    } else {
      // Challenge G: Selected object initiates continuous slow rotation
      log(`Selected: ${next.name} · Rotasi seleksi perlahan aktif (Challenge G).`);
    }
  } else {
    log("Deselect: area kosong diklik. Rotasi seleksi dihentikan.");
  }
});

// ==========================================================================
// 11. UI Controls & Listeners
// ==========================================================================
$("#cameraSelect").addEventListener("change", (event) => {
  const previousCamera = activeCamera;
  const target = controls.target.clone();
  activeCamera = event.target.value === "orthographic" ? orthographicCamera : perspectiveCamera;
  activeCamera.position.copy(previousCamera.position);
  configureControls(target);
  updateCamera();
});

$("#fovControl").addEventListener("input", (event) => {
  $("#fovValue").textContent = `${event.target.value}°`;
  perspectiveCamera.fov = Number(event.target.value);
  perspectiveCamera.updateProjectionMatrix();
});

$("#roughnessControl").addEventListener("input", (event) => {
  state.roughness = Number(event.target.value);
  $("#roughnessValue").textContent = state.roughness.toFixed(2);
  updateSelectedPbr();
});

$("#metalnessControl").addEventListener("input", (event) => {
  state.metalness = Number(event.target.value);
  $("#metalnessValue").textContent = state.metalness.toFixed(2);
  updateSelectedPbr();
});

function updateSelectedPbr() {
  if (state.selected && state.selected.material && "roughness" in state.selected.material) {
    state.selected.material.roughness = state.roughness;
    state.selected.material.metalness = state.metalness;
    updateInfo(state.selected);
  } else {
    // If nothing selected, update the Rose-gold preview sphere
    silver.material.roughness = state.roughness;
    silver.material.metalness = state.metalness;
  }
}

$("#orbitControl").addEventListener("input", (event) => {
  state.orbitSpeed = Number(event.target.value);
  $("#orbitValue").textContent = state.orbitSpeed.toFixed(2);
});

const bloomDefaults = { emissiveIntensity: 5, bloomIntensity: 0.55, bloomRadius: 0.3 };
const bloomSettings = { ...bloomDefaults };

function applyBloomSettings() {
  childMesh.material.emissiveIntensity = bloomSettings.emissiveIntensity;
  sun.material.emissiveIntensity = bloomSettings.emissiveIntensity;
  bloomPass.strength = bloomSettings.bloomIntensity;
  bloomPass.radius = bloomSettings.bloomRadius;

  for (const [key, value] of Object.entries(bloomSettings)) {
    const ctrl = $(`#${key}Control`);
    if (ctrl) ctrl.value = value;
    const valElem = $(`#${key}Value`);
    if (valElem) valElem.textContent = value.toFixed(2);
  }
}

for (const key of Object.keys(bloomSettings)) {
  $(`#${key}Control`)?.addEventListener("input", (event) => {
    bloomSettings[key] = Number(event.target.value);
    applyBloomSettings();
  });
}
applyBloomSettings();

// Challenge H — Environment Toggle
function toggleEnvironment() {
  state.environment = !state.environment;
  applyEnvironment();
  log(`Refleksi environment ${state.environment ? "ON" : "OFF"} (Challenge H)`);
}

function applyEnvironment() {
  scene.environment = state.environment ? environmentTexture : null;
  scene.background = state.panorama ? panoramaTexture : new THREE.Color("#020812");

  $("#environmentInfo").textContent = state.environment ? "ON" : "OFF";
  $("#environmentButton").textContent = `Refleksi: ${state.environment ? "ON" : "OFF"} (E)`;
  $("#environmentButton").setAttribute("aria-pressed", String(state.environment));

  $("#panoramaButton").textContent = `Panorama: ${state.panorama ? "ON" : "OFF"} (P)`;
  $("#panoramaButton").setAttribute("aria-pressed", String(state.panorama));
}

function togglePanorama() {
  state.panorama = !state.panorama;
  applyEnvironment();
  log(`Panorama skybox ${state.panorama ? "ON" : "OFF"}`);
}

function applyBloom() {
  bloomPass.enabled = state.bloom;
  $("#bloomButton").textContent = `Bloom: ${state.bloom ? "ON" : "OFF"}`;
  $("#bloomButton").setAttribute("aria-pressed", String(state.bloom));
}

function resetScene() {
  resetOrbitSettings();
  activeCamera = perspectiveCamera;
  perspectiveCamera.position.set(0, 4.6, 9.2);
  orthographicCamera.position.copy(perspectiveCamera.position);
  perspectiveCamera.fov = 52;
  perspectiveCamera.zoom = orthographicCamera.zoom = 1;
  configureControls();
  resize();
  updateCamera();

  $("#cameraSelect").value = "perspective";
  $("#fovControl").value = 52;
  $("#fovValue").textContent = "52°";
  state.environment = true;
  state.solar = true;

  [state.selected, state.hovered].forEach((object) => {
    if (object) {
      setEmissive(object, false);
      setScaleFeedback(object, 1);
    }
  });

  state.selected = null;
  state.hovered = null;
  state.panorama = true;
  state.bloom = true;
  Object.assign(bloomSettings, bloomDefaults);
  applyBloomSettings();
  selectPanorama("moonless");
  applyEnvironment();
  applyBloom();

  $("#hoverInfo").textContent = "-";
  $("#selectedInfo").textContent = "-";
  updateInfo(null);

  hierarchyGroup.rotation.set(0, 0, 0);
  solarSystem.rotation.set(0, 0, 0);
  log("Scene di-reset. Klik objek untuk memilih.");
}

$("#panoramaButton").addEventListener("click", togglePanorama);
$("#bloomButton").addEventListener("click", () => {
  state.bloom = !state.bloom;
  applyBloom();
});
$("#environmentButton").addEventListener("click", toggleEnvironment);
$("#resetButton").addEventListener("click", resetScene);
$("#solarButton").addEventListener("click", () => {
  state.solar = !state.solar;
  log(`Solar hierarchy: ${state.solar ? "playing" : "paused"}`);
});

$("#clip1Button").addEventListener("click", () => playClip(0));
$("#clip2Button").addEventListener("click", () => playClip(1));
$("#clip3Button").addEventListener("click", () => playClip(2));

// Keyboard event bindings
window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select")) return;
  const key = event.key.toLowerCase();
  if (key === "p") togglePanorama();
  if (key === "e") toggleEnvironment();
  if (key === "s") {
    state.solar = !state.solar;
    log(`Solar hierarchy: ${state.solar ? "playing" : "paused"}`);
  }
  if (key === "r") resetScene();
  if (["1", "2", "3"].includes(event.key)) {
    playClip(Number(event.key) - 1);
  }
});

function log(message) {
  const panel = $("#logPanel");
  if (panel) panel.textContent = message;
}

function updateCamera() {
  controls.update();
  activeCamera.updateProjectionMatrix();
  renderPass.camera = activeCamera;
}

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  renderer.setSize(width, height, false);
  perspectiveCamera.aspect = width / height;
  perspectiveCamera.updateProjectionMatrix();

  const aspect = width / height;
  orthographicCamera.left = -6 * aspect;
  orthographicCamera.right = 6 * aspect;
  orthographicCamera.top = 6;
  orthographicCamera.bottom = -6;
  orthographicCamera.updateProjectionMatrix();

  composer.setSize(width, height);
}
window.addEventListener("resize", resize);
resize();
updateCamera();
$("#objectInfo").textContent = String(interactiveObjects.length);

// ==========================================================================
// 12. Main Animation Render Loop
// ==========================================================================
let frameCount = 0;
let fpsTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  state.time += delta;

  // Challenge A & E: Animation Mixer update
  if (state.mixer) state.mixer.update(delta);

  // Background starfield rotation
  if (starField) {
    starField.rotation.y += delta * 0.02;
  }

  // Hierarchy Amethyst Group rotation
  hierarchyGroup.rotation.y += delta * 0.35;

  // Challenge D — Hierarchical Solar System transformations
  if (state.solar) {
    earthOrbit.rotation.y += delta * state.orbitSpeed; // Earth revolutions around Sun
    earth.rotation.y += delta * 1.5;                  // Earth axial spin
    moonOrbit.rotation.y += delta * 3.5;              // Moon revolutions around Earth
    moon.rotation.y += delta * 2.0;                   // Moon axial spin
    sun.rotation.y += delta * 0.2;                    // Sun axial spin
  }

  // Challenge G — Selection Rotation (Continuous slow rotation on selected object)
  if (state.selected) {
    state.selected.rotation.y += delta * 0.8;
  }

  // Orbiting dynamic light
  keyLight.position.x = Math.cos(state.time * state.orbitSpeed) * 6;
  keyLight.position.z = Math.sin(state.time * state.orbitSpeed) * 6;

  if (controls.enabled) controls.update();
  renderPass.camera = activeCamera;
  composer.render();

  frameCount += 1;
  fpsTime += delta;
  if (fpsTime > 0.5) {
    const fpsElem = $("#fpsInfo");
    if (fpsElem) fpsElem.textContent = String(Math.round(frameCount / fpsTime));
    frameCount = 0;
    fpsTime = 0;
  }
}
animate();
