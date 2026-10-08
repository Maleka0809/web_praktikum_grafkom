import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.querySelector("#sceneContainer");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#07111f");

const cameraPerspective = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
cameraPerspective.position.set(4.8, 3.6, 6.5);
const cameraOrthographic = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
cameraOrthographic.position.copy(cameraPerspective.position);
let activeCamera = cameraPerspective;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = {};
const state = {
  animation: true,
  lightOrbit: false,
  gallery: true,
  segment: 24,
  lightIntensity: 1.2,
  time: 0,
};

const cameraTarget = new THREE.Vector3(0, 0.8, 0);
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
  controls.update();
}
configureControls();
const mainCube = new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 1.25, 1.25),
  new THREE.MeshStandardMaterial({
    color: "#ff5e57",
    roughness: 0.28,
    metalness: 0.25,
  }),
);
mainCube.position.set(2.5, 1, -1.0);
mainCube.castShadow = true;
scene.add(mainCube);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.MeshLambertMaterial({ color: "#2c3e50" }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.72, state.segment, state.segment),
  new THREE.MeshPhongMaterial({ color: "#0fb9b1", shininess: 70 }),
);
sphere.position.set(-1.5, 0.85, 2.0);
sphere.castShadow = true;
scene.add(sphere);

const cone = new THREE.Mesh(
  new THREE.ConeGeometry(0.65, 1.5, state.segment),
  new THREE.MeshStandardMaterial({
    color: "#a55eea",
    roughness: 0.42,
    metalness: 0.08,
  }),
);
cone.position.set(-2.5, 0.75, -1.5);
cone.castShadow = true;
scene.add(cone);

const torus = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.55, 0.18, 64, 12),
  new THREE.MeshPhongMaterial({ color: "#f7b731", shininess: 80 }),
);
torus.position.set(0.5, 1.1, -3.0);
torus.castShadow = true;
scene.add(torus);

const gallery = new THREE.Group();
const galleryMaterials = [
  new THREE.MeshBasicMaterial({ color: "#fa8231" }),
  new THREE.MeshLambertMaterial({ color: "#20bf6b" }),
  new THREE.MeshPhongMaterial({ color: "#eb3b5a", shininess: 90 }),
];
galleryMaterials.forEach((material, index) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 0.65),
    material,
  );
  mesh.position.set(-2.6 + index * 0.8, 0.35, -2.4);
  mesh.castShadow = true;
  gallery.add(mesh);
});
scene.add(gallery);

const ambientLight = new THREE.AmbientLight("#9ecbff", 0.35);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(
  "#ffffff",
  state.lightIntensity,
);
directionalLight.position.set(3, 6, 4);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.bottom = -7;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 20;
scene.add(directionalLight);
const pointLight = new THREE.PointLight("#4df3ff", 1.1, 12);
pointLight.position.set(-2, 3, 2);
pointLight.castShadow = true;
scene.add(pointLight);
const lightMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 12, 8),
  new THREE.MeshBasicMaterial({ color: "#fff1a8" }),
);
scene.add(lightMarker);

// The directional light shines from its position toward its target.
scene.add(directionalLight.target);
const lightHelpers = new THREE.Group();
const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 0.6, "#ffe066");
const pointHelper = new THREE.PointLightHelper(pointLight, 0.25, "#4df3ff");
const lightDirection = new THREE.Vector3();
const lightOrigin = new THREE.Vector3();
const lightTarget = new THREE.Vector3();
const directionArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, -1, 0), directionalLight.position, 1, "#ffe066",
);
lightHelpers.add(directionalHelper, pointHelper, directionArrow);
scene.add(lightHelpers);

function updateLightHelpers() {
  lightMarker.position.copy(directionalLight.position);
  directionalLight.updateWorldMatrix(true, false);
  directionalLight.target.updateWorldMatrix(true, false);
  directionalLight.getWorldPosition(lightOrigin);
  directionalLight.target.getWorldPosition(lightTarget);
  lightDirection.subVectors(lightTarget, lightOrigin);
  const length = lightDirection.length();
  directionArrow.visible = length > 0;
  if (length > 0) {
    directionArrow.position.copy(lightOrigin);
    directionArrow.setDirection(lightDirection.normalize());
    directionArrow.setLength(length, 0.4, 0.2);
  }
  directionalHelper.update();
  pointHelper.update();
}

function updateCameraProjection() {
  const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
  cameraPerspective.aspect = aspect;
  cameraPerspective.updateProjectionMatrix();
  const size = 4.8;
  cameraOrthographic.left = -size * aspect;
  cameraOrthographic.right = size * aspect;
  cameraOrthographic.top = size;
  cameraOrthographic.bottom = -size;
  cameraOrthographic.updateProjectionMatrix();
}

function resize() {
  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);
  renderer.setSize(width, height, false);
  updateCameraProjection();
}

function updateHud() {
  document.querySelector("#cameraInfo").textContent =
    activeCamera === cameraPerspective ? "Perspective" : "Orthographic";
  document.querySelector("#objectInfo").textContent = String(
    scene.children.length,
  );
  document.querySelector("#rendererInfo").textContent =
    `${renderer.info.render.triangles} tris`;
  document.querySelector("#lightInfo").textContent =
    directionalLight.intensity.toFixed(2);
  document.querySelector("#animationInfo").textContent = state.animation
    ? "Playing"
    : "Paused";
  document.querySelector("#statusBadge").textContent = state.animation
    ? "RUNNING · THREE.JS"
    : "PAUSED · THREE.JS";
}

function updateObject(deltaTime) {
  const movement = 2.2 * deltaTime;
  if (keys.ArrowLeft || keys.a) mainCube.position.x -= movement;
  if (keys.ArrowRight || keys.d) mainCube.position.x += movement;
  if (keys.ArrowUp || keys.w) mainCube.position.z -= movement;
  if (keys.ArrowDown || keys.s) mainCube.position.z += movement;
  if (keys.q) mainCube.rotation.y -= 1.8 * deltaTime;
  if (keys.e) mainCube.rotation.y += 1.8 * deltaTime;
  mainCube.position.x = THREE.MathUtils.clamp(mainCube.position.x, -3.6, 3.6);
  mainCube.position.z = THREE.MathUtils.clamp(mainCube.position.z, -3.2, 2.4);
}

function updateScene(deltaTime) {
  updateObject(deltaTime);
  if (state.lightOrbit) {
    directionalLight.position.x = Math.sin(state.time) * 4;
    directionalLight.position.z = Math.cos(state.time) * 4;
  }
  lightMarker.position.copy(directionalLight.position);
  sphere.rotation.y += deltaTime * 0.8;
  sphere.position.y = 0.85 + Math.sin(state.time * 1.8) * 0.18;
  cone.rotation.y -= deltaTime * 0.65;
  torus.rotation.x += deltaTime * 0.8;
  torus.rotation.y += deltaTime * 1.1;
  gallery.children.forEach((mesh, index) => {
    mesh.rotation.y += deltaTime * (0.35 + index * 0.15);
  });
}

function render() {
  updateLightHelpers();
  renderer.render(scene, activeCamera);
  updateHud();
}

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.05);
  if (state.animation) {
    state.time += deltaTime;
    updateScene(deltaTime);
  }
  if (controls.enabled) controls.update();
  render();
}

function toggleCamera() {
  const previousCamera = activeCamera;
  const target = controls.target.clone();
  activeCamera =
    activeCamera === cameraPerspective ? cameraOrthographic : cameraPerspective;
  activeCamera.position.copy(previousCamera.position);
  configureControls(target);
  document.querySelector("#cameraSelect").value =
    activeCamera === cameraPerspective ? "perspective" : "orthographic";
  updateCameraProjection();
}

function toggleGallery() {
  state.gallery = !state.gallery;
  gallery.visible = state.gallery;
}
function toggleAnimation() {
  state.animation = !state.animation;
  document.querySelector("#animationButton").textContent = state.animation
    ? "Pause (G)"
    : "Resume (G)";
}

function reset() {
  lightHelpers.visible = true;
  document.querySelector("#lightHelperControl").checked = true;
  resetOrbitSettings();
  activeCamera = cameraPerspective;
  cameraPerspective.position.set(4.8, 3.6, 6.5);
  cameraOrthographic.position.copy(cameraPerspective.position);
  cameraPerspective.fov = 50;
  cameraPerspective.zoom = cameraOrthographic.zoom = 1;
  configureControls();
  updateCameraProjection();
  document.querySelector("#cameraSelect").value = "perspective";
  document.querySelector("#fovControl").value = 50;
  document.querySelector("#fovValue").textContent = "50°";
  mainCube.position.set(2.5, 1, -1.0);
  mainCube.rotation.set(0, 0, 0);
  directionalLight.position.set(3, 6, 4);
  directionalLight.intensity = 1.2;
  state.lightOrbit = false;
  state.animation = true;
  document.querySelector("#lightControl").value = 1.2;
  document.querySelector("#lightValue").textContent = "1.20";
  document.querySelector("#animationButton").textContent = "Pause (G)";
}

function updateSegments(value) {
  const segment = Number(value);
  const oldSphereGeometry = sphere.geometry;
  const oldConeGeometry = cone.geometry;
  sphere.geometry = new THREE.SphereGeometry(0.72, segment, segment);
  cone.geometry = new THREE.ConeGeometry(0.65, 1.5, segment);
  oldSphereGeometry.dispose();
  oldConeGeometry.dispose();
  document.querySelector("#segmentValue").textContent = String(segment);
}

document.querySelector("#cameraSelect").addEventListener("change", (event) => {
  if (
    (event.target.value === "perspective") !==
    (activeCamera === cameraPerspective)
  )
    toggleCamera();
});
document.querySelector("#cameraButton").addEventListener("click", toggleCamera);
document.querySelector("#lightOrbitButton").addEventListener("click", () => {
  state.lightOrbit = !state.lightOrbit;
});
document.querySelector("#lightHelperControl").addEventListener("change", (event) => {
  lightHelpers.visible = event.target.checked;
});
document
  .querySelector("#galleryButton")
  .addEventListener("click", toggleGallery);
document
  .querySelector("#animationButton")
  .addEventListener("click", toggleAnimation);
document.querySelector("#resetButton").addEventListener("click", reset);
document.querySelector("#fovControl").addEventListener("input", (event) => {
  cameraPerspective.fov = Number(event.target.value);
  cameraPerspective.updateProjectionMatrix();
  document.querySelector("#fovValue").textContent = `${event.target.value}°`;
});
document.querySelector("#lightControl").addEventListener("input", (event) => {
  directionalLight.intensity = Number(event.target.value);
  document.querySelector("#lightValue").textContent = Number(
    event.target.value,
  ).toFixed(2);
});
document
  .querySelector("#segmentControl")
  .addEventListener("input", (event) => updateSegments(event.target.value));
document.querySelector("#shadowSelect").addEventListener("change", (event) => {
  const size = Number(event.target.value);
  directionalLight.shadow.mapSize.set(size, size);
  directionalLight.shadow.map?.dispose();
  directionalLight.shadow.map = null;
});

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)
  )
    event.preventDefault();
  keys[key] = true;
  if (event.repeat) return;
  if (key === "c") toggleCamera();
  if (key === "l") state.lightOrbit = !state.lightOrbit;
  if (key === "h") toggleGallery();
  if (key === "g") toggleAnimation();
  if (key === "r") reset();
});
window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = false;
});
window.addEventListener("resize", resize);

resize();
render();
animate();
