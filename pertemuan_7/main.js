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
scene.background = new THREE.Color("#020812");

const perspectiveCamera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
perspectiveCamera.position.set(7.5, 5.2, 9.5);
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
const cameraTarget = new THREE.Vector3(0, 1, 0);
let controls;
const orbitDefaults = {
  enabled: true, enableDamping: true, enablePan: true,
  dampingFactor: 0.05, rotateSpeed: 1, zoomSpeed: 1,
};
const orbitSettings = { ...orbitDefaults };
function applyOrbitSettings() {
  Object.assign(controls, orbitSettings);
  const dampingInput = document.querySelector("#cameraDampingFactor");
  if (dampingInput) dampingInput.disabled = !orbitSettings.enableDamping;
}
function resetOrbitSettings() {
  Object.assign(orbitSettings, orbitDefaults);
  for (const [key, value] of Object.entries(orbitSettings)) {
    const input = document.querySelector(`[data-orbit-setting="${key}"]`);
    if (input) {
      if (typeof value === "boolean") input.checked = value;
      else {
        input.value = value;
        const valElem = document.querySelector(`#${input.id}Value`);
        if (valElem) valElem.textContent = value.toFixed(2);
      }
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
  studio: { label: "Studio Small 09 - HDR 1K", url: new URL("./assets/studio_small_09_1k.hdr", import.meta.url).href },
  ladybrand: { label: "Ladybrand Heritage House - HDR 1K", url: new URL("./assets/ladybrand_heritage_house_1k.hdr", import.meta.url).href },
  procedural: { label: "Panorama procedural" },
};
let activePanorama = "procedural";
let panoramaRequest = 0;
async function selectPanorama(key) {
  const option = panoramaOptions[key];
  const request = ++panoramaRequest;
  const selectElem = $("#panoramaSelect");
  if (selectElem) selectElem.value = key;
  if (key === activePanorama) {
    const statusElem = $("#panoramaStatus");
    if (statusElem) statusElem.textContent = option.label;
    return;
  }
  const statusElem = $("#panoramaStatus");
  if (statusElem) statusElem.textContent = `Memuat ${option.label}...`;
  let texture;
  try {
    texture = option.url
      ? await new HDRLoader().loadAsync(option.url)
      : createEnvironmentTexture();
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
    if (statusElem) statusElem.textContent = option.label;
  } catch (error) {
    texture?.dispose();
    if (request !== panoramaRequest) return;
    if (selectElem) selectElem.value = activePanorama;
    if (statusElem) statusElem.textContent = `HDR gagal dimuat - ${panoramaOptions[activePanorama].label} tetap aktif`;
    console.warn("HDR loading error", error);
  }
}
const panoramaSelect = $("#panoramaSelect");
if (panoramaSelect) {
  panoramaSelect.addEventListener("change", (event) => selectPanorama(event.target.value));
}
selectPanorama("studio");

scene.add(new THREE.HemisphereLight("#c9edff", "#12304a", 0.7));
const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
keyLight.position.set(5, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);
scene.add(new THREE.PointLight("#4df3ff", 12, 14, 2).translateX(-4));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(13, 64),
  new THREE.MeshStandardMaterial({
    color: "#0b263b",
    roughness: 0.85,
    metalness: 0.1,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- HIERARCHY DEMO SESUAI MODUL PRAKTIKUM 7 DR. DARLIS (SECTION 18-21 & 79-80) ---
const hierarchyGroup = new THREE.Group();
hierarchyGroup.name = "Hierarchy Demo Group";
hierarchyGroup.position.set(-2.5, 0, 0);

// Body (Parent Mesh)
const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.6, 1.0),
  new THREE.MeshStandardMaterial({
    color: 0x0ea5e9, // Biru langit (#0ea5e9)
    roughness: 0.45,
    metalness: 0.15,
  }),
);
body.name = "Body (Parent)";
body.position.y = 0.8;
body.castShadow = true;
body.receiveShadow = true;
body.userData.selectable = true;
body.userData.label = "Body (Parent)";
hierarchyGroup.add(body);

// Child Object (Anak)
const child = new THREE.Mesh(
  new THREE.BoxGeometry(0.45, 0.45, 0.45),
  new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Amber / Oranye (#f59e0b)
    roughness: 0.3,
    metalness: 0.1,
  }),
);
child.name = "Child Object";
child.position.set(1.0, 0, 0); // Local position: 1, 0, 0
child.rotation.z = Math.PI / 4; // Local rotation: PI / 4
child.castShadow = true;
child.receiveShadow = true;
child.userData.selectable = true;
child.userData.label = "Child Object";
// Hubungkan ke body: child adalah anak langsung dari body!
body.add(child);

scene.add(hierarchyGroup);
interactiveObjects.push(body, child);

// Baseline PBR Sphere dari Modul (Section 23)
const pbrSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.65, 48, 24),
  new THREE.MeshStandardMaterial({
    color: 0x22c55e, // Hijau (#22c55e)
    roughness: 0.25,
    metalness: 0.1,
  }),
);
pbrSphere.name = "PBR Sphere (Section 23)";
pbrSphere.position.set(0, 0.75, 0);
pbrSphere.castShadow = true;
pbrSphere.receiveShadow = true;
pbrSphere.userData.selectable = true;
pbrSphere.userData.label = "PBR Sphere";
scene.add(pbrSphere);
interactiveObjects.push(pbrSphere);

const solarSystem = new THREE.Group();
solarSystem.name = "Solar System (Hierarchy Challenge)";
solarSystem.position.set(1.8, 0, -2.4);
const sun = mesh(
  new THREE.SphereGeometry(0.7, 32, 20),
  new THREE.MeshStandardMaterial({
    color: "#ffdd22",
    emissive: "#ffcc00",
    emissiveIntensity: 5,
    roughness: 0.35,
    metalness: 0.05,
  }),
  "Sun",
);
sun.position.y = 1.1;
sun.castShadow = false;
sun.material.userData.preserveEmission = true;
sun.add(new THREE.PointLight("#ffcc33", 8, 6, 2));
const earthOrbit = new THREE.Group();
earthOrbit.name = "Earth Orbit";
earthOrbit.position.y = 1.1;
const earth = mesh(
  new THREE.SphereGeometry(0.28, 24, 16),
  new THREE.MeshStandardMaterial({
    color: "#4287ff",
    roughness: 0.48,
    metalness: 0.15,
  }),
  "Earth",
);
earth.position.x = 1.45;
const moonOrbit = new THREE.Group();
moonOrbit.name = "Moon Orbit";
moonOrbit.position.x = 1.45;
const moon = mesh(
  new THREE.SphereGeometry(0.11, 16, 12),
  new THREE.MeshStandardMaterial({
    color: "#b7c4d0",
    roughness: 0.9,
    metalness: 0,
  }),
  "Moon",
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
roughnessValues.forEach((roughness, row) =>
  metalnessValues.forEach((metalness, column) => {
    const material = new THREE.MeshStandardMaterial({
      color: column === 2 ? "#4df3ff" : "#ff6584",
      roughness,
      metalness,
    });
    const sphere = mesh(
      new THREE.SphereGeometry(0.3, 24, 16),
      material,
      `PBR r${roughness} m${metalness}`,
    );
    sphere.position.set(-1.4 + column * 0.8, 0.35 + (2 - row) * 0.8, -1.9);
    sphere.castShadow = true;
    gallery.add(sphere);
    interactiveObjects.push(sphere);
  }),
);
scene.add(gallery);

// Dedicated silver sample remains independent of the gallery sliders.
const silver = mesh(
  new THREE.SphereGeometry(0.85, 64, 40),
  new THREE.MeshStandardMaterial({
    color: "#eeeeee", metalness: 1, roughness: 0.08, envMapIntensity: 1,
  }),
  "Silver - HDR reflection",
);
silver.position.set(3.1, 0.9, 1.4);
scene.add(silver);
interactiveObjects.push(silver);

const loader = new GLTFLoader();
const modelUrl = new URL("./Duck.glb", import.meta.url).href;
loader.load(
  modelUrl,
  (gltf) => {
    const root = gltf.scene;
    root.name = "Imported Duck GLB";
    root.userData.selectable = true;
    root.userData.label = "Imported Duck GLB";
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
    const clips = gltf.animations && gltf.animations.length
      ? gltf.animations
      : createFallbackClips();
    state.actions = clips.map((clip) => state.mixer.clipAction(clip));
    if (state.actions.length) playClip(0);
    const modelInfo = $("#modelInfo");
    if (modelInfo) modelInfo.textContent = `${clips.length} clip${clips.length === 1 ? "" : "s"}`;
    const statusBadge = $("#statusBadge");
    if (statusBadge) statusBadge.textContent = "GLB LOADED · READY";
    log(`GLB loaded: ${root.name}; ${countDescendants(root)} descendants.`);
    console.log("GLB hierarchy", {
      root: root.name,
      descendants: countDescendants(root),
      animations: clips.map((clip) => clip.name),
    });
  },
  undefined,
  (error) => {
    const modelInfo = $("#modelInfo");
    if (modelInfo) modelInfo.textContent = "Fallback procedural";
    const statusBadge = $("#statusBadge");
    if (statusBadge) statusBadge.textContent = "FALLBACK SCENE · READY";
    log("Duck.glb tidak dapat dimuat; scene procedural tetap aktif.");
    console.warn("GLB loading error", error);
  },
);

function createEnvironmentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#031322");
  gradient.addColorStop(0.52, "#0b3b4a");
  gradient.addColorStop(1, "#01060c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 22; i += 1) {
    context.fillStyle = `rgba(77,243,255,${0.04 + i * 0.002})`;
    context.fillRect(i * 27, 45 + (i % 5) * 21, 3, 130);
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
    0.5 - fittedCenter.x,
    0.05 - fittedBounds.min.y,
    0.4 - fittedCenter.z,
  );
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
  const logElem = $("#logPanel");
  if (logElem) logElem.textContent = message;
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
function findSelectableRoot(object) {
  let current = object;
  while (current) {
    if (current.userData && current.userData.selectable) {
      return current;
    }
    if (current.parent === scene || !current.parent || current.parent.type === "Scene") {
      break;
    }
    current = current.parent;
  }
  return object;
}
function updateInfo(object) {
  if (!object) {
    const infoTitle = $("#infoTitle");
    if (infoTitle) infoTitle.textContent = "Belum ada objek dipilih";
    ["#infoPosition", "#infoRotation", "#infoScale", "#infoMaterial"].forEach(
      (id) => {
        const el = $(id);
        if (el) el.textContent = "-";
      },
    );
    return;
  }
  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  const infoTitle = $("#infoTitle");
  if (infoTitle) infoTitle.textContent = object.name || object.type;
  const infoPos = $("#infoPosition");
  const parentName = object.parent && object.parent !== scene ? ` (Parent: ${object.parent.name || object.parent.type})` : "";
  if (infoPos) infoPos.textContent = `local ${formatVector(object.position)} · world ${formatVector(world)}${parentName}`;
  const infoRot = $("#infoRotation");
  if (infoRot) infoRot.textContent = formatVector(object.rotation);
  const infoScale = $("#infoScale");
  if (infoScale) infoScale.textContent = formatVector(object.scale);
  const infoMat = $("#infoMaterial");
  if (infoMat) infoMat.textContent = materialName(object);
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
  return hit ? findSelectableRoot(hit.object) : null;
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
  const hoverInfo = $("#hoverInfo");
  if (hoverInfo) hoverInfo.textContent = next?.name || "-";
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
  const hoverInfo = $("#hoverInfo");
  if (hoverInfo) hoverInfo.textContent = "-";
});
renderer.domElement.addEventListener("click", (event) => {
  if (suppressSelection || event.button !== 0) return;
  const next = raycast(event);
  if (state.selected && state.selected !== next) {
    setEmissive(state.selected, false);
    setScaleFeedback(state.selected, 1);
  }
  state.selected = next;
  const selectedInfo = $("#selectedInfo");
  if (selectedInfo) selectedInfo.textContent = next?.name || "-";
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

const cameraSelect = $("#cameraSelect");
if (cameraSelect) {
  cameraSelect.addEventListener("change", (event) => {
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
}
const fovControl = $("#fovControl");
if (fovControl) {
  fovControl.addEventListener("input", (event) => {
    const fovVal = $("#fovValue");
    if (fovVal) fovVal.textContent = `${event.target.value}°`;
    perspectiveCamera.fov = Number(event.target.value);
    perspectiveCamera.updateProjectionMatrix();
  });
}
const roughnessControl = $("#roughnessControl");
if (roughnessControl) {
  roughnessControl.addEventListener("input", (event) => {
    state.roughness = Number(event.target.value);
    const valElem = $("#roughnessValue");
    if (valElem) valElem.textContent = state.roughness.toFixed(2);
    updatePbrGallery();
  });
}
const metalnessControl = $("#metalnessControl");
if (metalnessControl) {
  metalnessControl.addEventListener("input", (event) => {
    state.metalness = Number(event.target.value);
    const valElem = $("#metalnessValue");
    if (valElem) valElem.textContent = state.metalness.toFixed(2);
    updatePbrGallery();
  });
}
const orbitControl = $("#orbitControl");
if (orbitControl) {
  orbitControl.addEventListener("input", (event) => {
    state.orbitSpeed = Number(event.target.value);
    const valElem = $("#orbitValue");
    if (valElem) valElem.textContent = state.orbitSpeed.toFixed(2);
  });
}
const bloomDefaults = { emissiveIntensity: 5, bloomIntensity: 0.55, bloomRadius: 0.3 };
const bloomSettings = { ...bloomDefaults };
function applyBloomSettings() {
  if (child && child.material && "emissiveIntensity" in child.material) {
    child.material.emissiveIntensity = bloomSettings.emissiveIntensity;
  }
  if (sun && sun.material) {
    sun.material.emissiveIntensity = bloomSettings.emissiveIntensity;
  }
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
  const ctrl = $(`#${key}Control`);
  if (ctrl) {
    ctrl.addEventListener("input", (event) => {
      bloomSettings[key] = Number(event.target.value);
      applyBloomSettings();
    });
  }
}
applyBloomSettings();

const panoramaBtn = $("#panoramaButton");
if (panoramaBtn) panoramaBtn.addEventListener("click", togglePanorama);
const bloomBtn = $("#bloomButton");
if (bloomBtn) {
  bloomBtn.addEventListener("click", () => {
    state.bloom = !state.bloom;
    applyBloom();
  });
}
const envBtn = $("#environmentButton");
if (envBtn) envBtn.addEventListener("click", toggleEnvironment);
const resetBtn = $("#resetButton");
if (resetBtn) resetBtn.addEventListener("click", resetScene);
const solarBtn = $("#solarButton");
if (solarBtn) {
  solarBtn.addEventListener("click", () => {
    state.solar = !state.solar;
    log(`Solar hierarchy: ${state.solar ? "playing" : "paused"}`);
  });
}
const clip1Btn = $("#clip1Button");
if (clip1Btn) clip1Btn.addEventListener("click", () => playClip(0));
const clip2Btn = $("#clip2Button");
if (clip2Btn) clip2Btn.addEventListener("click", () => playClip(1));
const clip3Btn = $("#clip3Button");
if (clip3Btn) clip3Btn.addEventListener("click", () => playClip(2));

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
  const envInfo = $("#environmentInfo");
  if (envInfo) envInfo.textContent = state.environment ? "ON" : "OFF";
  const envBtnEl = $("#environmentButton");
  if (envBtnEl) {
    envBtnEl.textContent = `Refleksi: ${state.environment ? "ON" : "OFF"} (E)`;
    envBtnEl.setAttribute("aria-pressed", String(state.environment));
  }
  const panBtnEl = $("#panoramaButton");
  if (panBtnEl) {
    panBtnEl.textContent = `Panorama: ${state.panorama ? "ON" : "OFF"} (P)`;
    panBtnEl.setAttribute("aria-pressed", String(state.panorama));
  }
}
function togglePanorama() {
  state.panorama = !state.panorama;
  applyEnvironment();
  log(`Panorama ${state.panorama ? "ON" : "OFF"}; refleksi diatur terpisah dengan E.`);
}
function applyBloom() {
  bloomPass.enabled = state.bloom;
  const bloomBtnEl = $("#bloomButton");
  if (bloomBtnEl) {
    bloomBtnEl.textContent = `Bloom: ${state.bloom ? "ON" : "OFF"}`;
    bloomBtnEl.setAttribute("aria-pressed", String(state.bloom));
  }
}
function toggleEnvironment() {
  state.environment = !state.environment;
  applyEnvironment();
  log(`Refleksi environment ${state.environment ? "ON" : "OFF"}`);
}
function resetScene() {
  resetOrbitSettings();
  activeCamera = perspectiveCamera;
  perspectiveCamera.position.set(7.5, 5.2, 9.5);
  orthographicCamera.position.copy(perspectiveCamera.position);
  perspectiveCamera.fov = 52;
  perspectiveCamera.zoom = orthographicCamera.zoom = 1;
  configureControls();
  resize();
  updateCamera();
  const camSel = $("#cameraSelect");
  if (camSel) camSel.value = "perspective";
  const fovCtrl = $("#fovControl");
  if (fovCtrl) fovCtrl.value = 52;
  const fovVal = $("#fovValue");
  if (fovVal) fovVal.textContent = "52°";
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
  selectPanorama("studio");
  applyEnvironment();
  applyBloom();
  const hoverInfo = $("#hoverInfo");
  if (hoverInfo) hoverInfo.textContent = "-";
  const selectedInfo = $("#selectedInfo");
  if (selectedInfo) selectedInfo.textContent = "-";
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
const objInfo = $("#objectInfo");
if (objInfo) objInfo.textContent = String(interactiveObjects.length);

let frameCount = 0;
let fpsTime = 0;
let logTimer = 0;
const childWorldPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  state.time += delta;
  if (state.mixer) state.mixer.update(delta);

  // Animasi Hierarchy Demo sesuai Modul Praktikum Dr. Darlis (Section 66):
  hierarchyGroup.rotation.y += 0.25 * delta;
  child.rotation.x += 1.2 * delta;

  // Real-time Child World Position monitor (Milestone 3 & Eksperimen Wajib 1 & 2):
  child.getWorldPosition(childWorldPos);
  const childWorldElem = $("#childWorldPos");
  if (childWorldElem) {
    childWorldElem.textContent = `${childWorldPos.x.toFixed(2)}, ${childWorldPos.y.toFixed(2)}, ${childWorldPos.z.toFixed(2)}`;
  }

  // Periodic Console logging (Milestone 3):
  logTimer += delta;
  if (logTimer > 2.0) {
    console.log("[Milestone 3] Child local position:", child.position);
    console.log("[Milestone 3] Child world position:", childWorldPos);
    logTimer = 0;
  }

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
    const fpsElem = $("#fpsInfo");
    if (fpsElem) fpsElem.textContent = String(Math.round(frameCount / fpsTime));
    frameCount = 0;
    fpsTime = 0;
  }
}
animate();
