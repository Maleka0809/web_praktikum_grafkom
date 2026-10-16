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

const perspectiveCamera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
perspectiveCamera.position.set(0, 4.6, 8.8);
const orthographicCamera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
orthographicCamera.position.copy(perspectiveCamera.position);
let activeCamera = perspectiveCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
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
};
const cameraTarget = new THREE.Vector3(0, 0.9, 0);
let controls;
const orbitDefaults = {
  enabled: true, enableDamping: true, enablePan: true,
  dampingFactor: 0.05, rotateSpeed: 1, zoomSpeed: 1,
};
const orbitSettings = { ...orbitDefaults };
function applyOrbitSettings() {
  Object.assign(controls, orbitSettings);
  document.querySelector("#cameraDampingFactor").disabled = !orbitSettings.enableDamping;
}
function resetOrbitSettings() {
  Object.assign(orbitSettings, orbitDefaults);
  for (const [key, value] of Object.entries(orbitSettings)) {
    const input = document.querySelector(`[data-orbit-setting="${key}"]`);
    if (typeof value === "boolean") input.checked = value;
    else {
      input.value = value;
      document.querySelector(`#${input.id}Value`).textContent = value.toFixed(2);
    }
  }
}
document.querySelectorAll("[data-orbit-setting]").forEach((input) => {
  input.addEventListener("input", () => {
    orbitSettings[input.dataset.orbitSetting] =
      input.type === "checkbox" ? input.checked : Number(input.value);
    if (input.type !== "checkbox")
      document.querySelector(`#${input.id}Value`).textContent = Number(input.value).toFixed(2);
    applyOrbitSettings();
  });
});
function configureControls(target = cameraTarget) {
  controls?.dispose();
  controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.target.copy(target);
  applyOrbitSettings();
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.minZoom = 0.5;
  controls.maxZoom = 3;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.update();
}
configureControls();

let panoramaTexture = createEnvironmentTexture();
panoramaTexture.colorSpace = THREE.SRGBColorSpace;
panoramaTexture.mapping = THREE.EquirectangularReflectionMapping;
const pmrem = new THREE.PMREMGenerator(renderer);
let environmentTarget = pmrem.fromEquirectangular(panoramaTexture);
let environmentTexture = environmentTarget.texture;
scene.backgroundIntensity = 0.35;
scene.environmentIntensity = 0.3;
applyEnvironment();
pmrem.compileEquirectangularShader();
const panoramaOptions = {
  nebula: { label: "Cosmic Nebula & Stars (Space)" },
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
  $("#panoramaSelect").value = key;
  if (key === activePanorama) {
    $("#panoramaStatus").textContent = option.label;
    return;
  }
  $("#panoramaStatus").textContent = `Memuat ${option.label}...`;
  let texture;
  try {
    if (key === "nebula") {
      texture = createNebulaTexture();
    } else if (option.url) {
      texture = await new HDRLoader().loadAsync(option.url);
    } else {
      texture = createEnvironmentTexture();
    }
    // Only the latest selection may replace the active environment.
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
    $("#panoramaStatus").textContent = option.label;
  } catch (error) {
    texture?.dispose();
    if (request !== panoramaRequest) return;
    $("#panoramaSelect").value = activePanorama;
    $("#panoramaStatus").textContent = `HDR gagal dimuat - ${panoramaOptions[activePanorama].label} tetap aktif`;
    console.warn("HDR loading error", error);
  }
}
$("#panoramaSelect").addEventListener("change", (event) => selectPanorama(event.target.value));
selectPanorama("nebula");

scene.add(new THREE.HemisphereLight("#38bdf8", "#3b0764", 0.85));
const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
keyLight.position.set(5, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);

const cyanPoint = new THREE.PointLight("#00f0ff", 10, 15, 2);
cyanPoint.position.set(-5, 3, 2);
scene.add(cyanPoint);

const magentaPoint = new THREE.PointLight("#f43f5e", 10, 15, 2);
magentaPoint.position.set(5, 3, 2);
scene.add(magentaPoint);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64),
  new THREE.MeshStandardMaterial({
    color: "#0a0618",
    roughness: 0.45,
    metalness: 0.55,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const polarGrid = new THREE.PolarGridHelper(13.5, 16, 8, 64, 0x8b5cf6, 0x1f143d);
polarGrid.position.y = 0.01;
scene.add(polarGrid);

// --- 3D COSMIC STARFIELD PARTICLES ---
const starGeometry = new THREE.BufferGeometry();
const starCount = 1200;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
  const radius = 22 + Math.random() * 35;
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
  size: 0.25,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
});
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

const hierarchyGroup = new THREE.Group();
hierarchyGroup.name = "Hierarchy Parent Group";
hierarchyGroup.position.set(3.2, 1.2, 0);
const parentMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 1.3, 1.3),
  new THREE.MeshPhysicalMaterial({
    color: "#c084fc",
    roughness: 0.05,
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
    metalness: 0,
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
earth.position.x = 1.45;
const moonOrbit = new THREE.Group();
moonOrbit.name = "Moon Orbit";
moonOrbit.position.x = 1.45;
const moon = mesh(
  new THREE.SphereGeometry(0.11, 16, 12),
  new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    roughness: 0.5,
    metalness: 0.2,
  }),
  "Cyber Moon (Platinum)",
);
moon.position.x = 0.55;
moonOrbit.add(moon);
earthOrbit.add(earth, moonOrbit);
solarSystem.add(sun, earthOrbit);
scene.add(solarSystem);
interactiveObjects.push(sun, earth, moon);

const gallery = new THREE.Group();
gallery.name = "PBR Material Gallery";
const roughnessValues = [0.1, 0.5, 0.9];
const metalnessValues = [0, 0.5, 1];
const columnColors = ["#f43f5e", "#a855f7", "#00f0ff"];
roughnessValues.forEach((roughness, row) =>
  metalnessValues.forEach((metalness, column) => {
    const material = new THREE.MeshStandardMaterial({
      color: columnColors[column],
      roughness,
      metalness,
    });
    const sphere = mesh(
      new THREE.SphereGeometry(0.28, 24, 16),
      material,
      `PBR r${roughness} m${metalness}`,
    );
    const colX = (column - 1) * 0.95;
    const arcZ = -2.3 + Math.abs(column - 1) * 0.35;
    sphere.position.set(colX, 0.35 + (2 - row) * 0.75, arcZ);
    sphere.castShadow = true;
    gallery.add(sphere);
    interactiveObjects.push(sphere);
  }),
);
scene.add(gallery);

const silver = mesh(
  new THREE.SphereGeometry(0.82, 64, 40),
  new THREE.MeshStandardMaterial({
    color: "#f5a896", metalness: 1, roughness: 0.03, envMapIntensity: 1.3,
  }),
  "Rose-Gold - HDR Reflection",
);
silver.position.set(-1.3, 0.85, 1.0);
scene.add(silver);
interactiveObjects.push(silver);

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
        interactiveObjects.push(object);
      }
    });
    scene.add(root);
    state.gltfRoot = root;
    state.mixer = new THREE.AnimationMixer(root);
    const clips = gltf.animations.length
      ? gltf.animations
      : createFallbackClips();
    state.actions = clips.map((clip) => state.mixer.clipAction(clip));
    if (state.actions.length) playClip(0);
    $("#modelInfo").textContent =
      `${clips.length} clip${clips.length === 1 ? "" : "s"}`;
    $("#statusBadge").textContent = "GLB LOADED · READY";
    log(`GLB loaded: ${root.name}; ${countDescendants(root)} descendants.`);
    console.log("GLB hierarchy", {
      root: root.name,
      descendants: countDescendants(root),
      animations: clips.map((clip) => clip.name),
    });
  },
  undefined,
  (error) => {
    $("#modelInfo").textContent = "Fallback procedural";
    $("#statusBadge").textContent = "FALLBACK SCENE · READY";
    log("Duck.glb tidak dapat dimuat; scene procedural tetap aktif.");
    console.warn("GLB loading error", error);
  },
);

function createNebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Deep space void base
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0, "#030009");
  bgGrad.addColorStop(0.5, "#070216");
  bgGrad.addColorStop(1, "#020006");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft glowing radial nebula gas clouds
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

  // Stardust & twinkling star specks
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

    if (size > 2.2) {
      ctx.strokeStyle = fill;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - size * 2.5, y);
      ctx.lineTo(x + size * 2.5, y);
      ctx.moveTo(x, y - size * 2.5);
      ctx.lineTo(x, y + size * 2.5);
      ctx.stroke();
    }
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
function mesh(geometry, material, name) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = true;
  return object;
}
function countDescendants(root) {
  let count = 0;
  root.traverse(() => {
    count += 1;
  });
  return count;
}
function fitImportedModel(root) {
  // Ukuran GLB berbeda-beda; gunakan bounding box agar model tetap terlihat.
  root.scale.setScalar(1);
  const originalBounds = new THREE.Box3().setFromObject(root);
  const originalSize = originalBounds.getSize(new THREE.Vector3());
  const largestDimension = Math.max(
    originalSize.x,
    originalSize.y,
    originalSize.z,
  );
  const targetSize = 1.8;
  root.scale.setScalar(
    largestDimension > 0 ? targetSize / largestDimension : 1,
  );
  const fittedBounds = new THREE.Box3().setFromObject(root);
  const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
  root.position.set(
    0.4 - fittedCenter.x,
    0.05 - fittedBounds.min.y,
    1.1 - fittedCenter.z,
  );
  root.rotation.y = -Math.PI / 8;
}
function createFallbackClips() {
  const times = [0, 0.5, 1];
  return [
    new THREE.AnimationClip("Idle (fallback)", 1, [
      new THREE.NumberKeyframeTrack(".rotation[y]", times, [0, 0.03, 0]),
    ]),
    new THREE.AnimationClip("Walk (fallback)", 1, [
      new THREE.NumberKeyframeTrack(
        ".rotation[y]",
        times,
        [-0.12, 0.12, -0.12],
      ),
    ]),
    new THREE.AnimationClip("Run (fallback)", 0.5, [
      new THREE.NumberKeyframeTrack(
        ".rotation[y]",
        times,
        [-0.25, 0.25, -0.25],
      ),
    ]),
  ];
}
function playClip(index) {
  if (!state.actions.length) return;
  const next = state.actions[index % state.actions.length];
  state.actions.forEach((action) => {
    if (action !== next) action.fadeOut(0.2);
  });
  next.reset().fadeIn(0.2).play();
  state.activeAction = next;
  log(`Animation clip aktif: ${next.getClip().name || index + 1}`);
}
function log(message) {
  $("#logPanel").textContent = message;
}
function materialName(object) {
  return object.material?.type || "Group / tanpa material";
}
function setEmissive(object, enabled) {
  if (!object) return;
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      if (!("emissive" in material) || material.userData.preserveEmission) return;
      if (!material.userData.originalEmissive) {
        material.userData.originalEmissive = material.emissive.clone();
        material.userData.originalEmissiveIntensity =
          material.emissiveIntensity ?? 1;
      }
      material.emissive.copy(
        enabled
          ? new THREE.Color("#d88945")
          : material.userData.originalEmissive,
      );
      material.emissiveIntensity = enabled
        ? 0.45
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
function objectRoot(object) {
  let current = object;
  while (
    current.parent &&
    current.parent !== scene &&
    current.parent.type !== "Scene"
  )
    current = current.parent;
  return current;
}
function updateInfo(object) {
  if (!object) {
    $("#infoTitle").textContent = "Belum ada objek dipilih";
    ["#infoPosition", "#infoRotation", "#infoScale", "#infoMaterial"].forEach(
      (id) => ($(id).textContent = "-"),
    );
    return;
  }
  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  $("#infoTitle").textContent = object.name || object.type;
  $("#infoPosition").textContent =
    `local ${formatVector(object.position)} · world ${formatVector(world)}`;
  $("#infoRotation").textContent = formatVector(object.rotation);
  $("#infoScale").textContent = formatVector(object.scale);
  $("#infoMaterial").textContent = materialName(object);
}
function formatVector(vector) {
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function raycast(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, activeCamera);
  const hit = raycaster.intersectObjects(interactiveObjects, true)[0];
  return hit ? objectRoot(hit.object) : null;
}
let selectionGesture = null;
let suppressSelection = false;
renderer.domElement.addEventListener("pointerdown", (event) => {
  suppressSelection = event.button !== 0 || selectionGesture !== null;
  selectionGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
// Remember the maximum movement, including a drag that returns to its start.
window.addEventListener("pointermove", (event) => {
  if (!selectionGesture || event.pointerId !== selectionGesture.id) return;
  if (Math.hypot(event.clientX - selectionGesture.x, event.clientY - selectionGesture.y) > 5)
    suppressSelection = true;
}, true);
window.addEventListener("pointerup", (event) => {
  if (event.pointerId === selectionGesture?.id) selectionGesture = null;
});
window.addEventListener("pointercancel", () => {
  selectionGesture = null;
  suppressSelection = true;
});
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
    log(
      `Hover: ${next.name}; NDC ${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)}`,
    );
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
    log(`Selected: ${next.name}; click menjalankan animasi jika tersedia.`);
    if (
      state.gltfRoot &&
      (next === state.gltfRoot || next.parent === state.gltfRoot)
    )
      playClip(0);
  }
});

$("#cameraSelect").addEventListener("change", (event) => {
  const previousCamera = activeCamera;
  const target = controls.target.clone();
  activeCamera =
    event.target.value === "orthographic"
      ? orthographicCamera
      : perspectiveCamera;
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
  updatePbrGallery();
});
$("#metalnessControl").addEventListener("input", (event) => {
  state.metalness = Number(event.target.value);
  $("#metalnessValue").textContent = state.metalness.toFixed(2);
  updatePbrGallery();
});
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
    $(`#${key}Control`).value = value;
    $(`#${key}Value`).textContent = value.toFixed(2);
  }
}
for (const key of Object.keys(bloomSettings)) {
  $(`#${key}Control`).addEventListener("input", (event) => {
    bloomSettings[key] = Number(event.target.value);
    applyBloomSettings();
  });
}
applyBloomSettings();
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
window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select")) return;
  if (event.key.toLowerCase() === "p") togglePanorama();
  if (event.key.toLowerCase() === "e") toggleEnvironment();
  if (event.key.toLowerCase() === "s") {
    state.solar = !state.solar;
  }
  if (event.key.toLowerCase() === "r") resetScene();
  if (["1", "2", "3"].includes(event.key)) playClip(Number(event.key) - 1);
});

function updatePbrGallery() {
  gallery.children.forEach((object) => {
    object.material.roughness = state.roughness;
    object.material.metalness = state.metalness;
  });
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
  log(`Panorama ${state.panorama ? "ON" : "OFF"}; refleksi diatur terpisah dengan E.`);
}
function applyBloom() {
  bloomPass.enabled = state.bloom;
  $("#bloomButton").textContent = `Bloom: ${state.bloom ? "ON" : "OFF"}`;
  $("#bloomButton").setAttribute("aria-pressed", String(state.bloom));
}
function toggleEnvironment() {
  state.environment = !state.environment;
  applyEnvironment();
  log(`Refleksi environment ${state.environment ? "ON" : "OFF"}`);
}
function resetScene() {
  resetOrbitSettings();
  activeCamera = perspectiveCamera;
  perspectiveCamera.position.set(0, 4.6, 8.8);
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
    setEmissive(object, false);
    setScaleFeedback(object, 1);
  });
  state.selected = null;
  state.hovered = null;
  state.panorama = true;
  state.bloom = true;
  Object.assign(bloomSettings, bloomDefaults);
  applyBloomSettings();
  selectPanorama("nebula");
  applyEnvironment();
  applyBloom();
  $("#hoverInfo").textContent = "-";
  $("#selectedInfo").textContent = "-";
  updateInfo(null);
  hierarchyGroup.rotation.set(0, 0, 0);
  solarSystem.rotation.set(0, 0, 0);
  log("Scene di-reset. Klik objek untuk memilih.");
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

let frameCount = 0;
let fpsTime = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  state.time += delta;
  if (state.mixer) state.mixer.update(delta);
  if (typeof starField !== "undefined" && starField) {
    starField.rotation.y += delta * 0.02;
  }
  hierarchyGroup.rotation.y += delta * 0.35;
  if (state.solar) {
    solarSystem.rotation.y += delta * state.orbitSpeed;
    earth.rotation.y += delta;
    moonOrbit.rotation.y += delta * 2.4;
  }
  if (state.selected) {
    state.selected.rotation.y += delta * 0.55;
  }
  keyLight.position.x = Math.cos(state.time * state.orbitSpeed) * 6;
  if (controls.enabled) controls.update();
  renderPass.camera = activeCamera;
  composer.render();
  frameCount += 1;
  fpsTime += delta;
  if (fpsTime > 0.5) {
    $("#fpsInfo").textContent = String(Math.round(frameCount / fpsTime));
    frameCount = 0;
    fpsTime = 0;
  }
}
animate();
