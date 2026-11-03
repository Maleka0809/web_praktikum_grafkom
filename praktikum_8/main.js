import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { modelBase64 } from "./modelData.js";

// ==========================================================================
// 1. DOM Elements & Log Helper
// ==========================================================================
const $ = (sel) => document.querySelector(sel);
const container = $("#sceneContainer");
const logPanel = $("#logPanel");

function log(msg) {
  const time = new Date().toLocaleTimeString("id-ID", { hour12: false });
  const entry = document.createElement("div");
  entry.innerHTML = `<span style="color: #64748b;">[${time}]</span> ${msg}`;
  if (logPanel) {
    logPanel.prepend(entry);
    while (logPanel.children.length > 25) {
      logPanel.removeChild(logPanel.lastChild);
    }
  }
  console.log(`[Praktikum 08] ${msg}`);
}

// ==========================================================================
// 2. Scene, Cameras & Renderer
// ==========================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color("#050814");

// Perspective Camera (Default)
const perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
perspectiveCamera.position.set(5.5, 4.0, 6.5);

// Orthographic Camera (Simulating Blender Numpad 5 Ortho Mode)
const orthoSize = 4.2;
const orthographicCamera = new THREE.OrthographicCamera(
  -orthoSize, orthoSize, orthoSize, -orthoSize, 0.1, 100
);
orthographicCamera.position.copy(perspectiveCamera.position);

let activeCamera = perspectiveCamera;

// Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(activeCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.85;
controls.zoomSpeed = 1.0;
controls.target.set(0, 0, 0);

// Procedural Environment Lighting (PMREM Generator)
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

function createProceduralSkybox() {
  const sceneEnv = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const count = geo.attributes.position.count;
  const colors = [];
  const colorTop = new THREE.Color("#1e1b4b");
  const colorMid = new THREE.Color("#0c152e");
  const colorBottom = new THREE.Color("#020617");

  for (let i = 0; i < count; i++) {
    const y = geo.attributes.position.getY(i);
    const t = THREE.MathUtils.clamp((y + 50) / 100, 0, 1);
    const col = t > 0.5 ? colorMid.clone().lerp(colorTop, (t - 0.5) * 2) : colorBottom.clone().lerp(colorMid, t * 2);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  const skyMesh = new THREE.Mesh(geo, mat);
  sceneEnv.add(skyMesh);

  const envMap = pmremGenerator.fromScene(sceneEnv).texture;
  scene.environment = envMap;
  geo.dispose();
  mat.dispose();
}
createProceduralSkybox();

// ==========================================================================
// 3. Studio Lighting & Helpers
// ==========================================================================
const hemiLight = new THREE.HemisphereLight("#a78bfa", "#0f172a", 0.65);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
keyLight.position.set(6, 9, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight("#22d3ee", 0.7);
fillLight.position.set(-6, 4, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight("#f472b6", 1.1);
rimLight.position.set(0, 6, -8);
scene.add(rimLight);

const gridHelper = new THREE.GridHelper(14, 28, "#8b5cf6", "#1e293b");
gridHelper.position.y = -1.6;
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(1.8);
axesHelper.position.set(-4.5, -1.5, 4.5);
scene.add(axesHelper);

const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = -1.601;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// ==========================================================================
// 4. Model State & Data Structures
// ==========================================================================
const state = {
  modelLoaded: false,
  autoRotate: true,
  autoRotateSpeed: 0.8,
  displayMode: "pbr", // pbr | wireframe | shaded_wireframe | xray | normals | clay
  explodeAmount: 0,
  roughnessScale: 1.0,
  metalnessScale: 1.0,
  activeCameraMode: "perspective",
  gridVisible: true,
  hoveredPart: null,
  selectedPart: null,
  currentPipelineStep: 4,
};

const modelParts = [];
let rootGroup = new THREE.Group();
scene.add(rootGroup);

const normalMat = new THREE.MeshNormalMaterial({ wireframe: false });
const clayMat = new THREE.MeshStandardMaterial({
  color: "#d8b4e2",
  roughness: 0.65,
  metalness: 0.1,
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ==========================================================================
// 5. Base64 to ArrayBuffer Helper (CORS-Safe Offline Execution)
// ==========================================================================
function base64ToArrayBuffer(b64) {
  const binaryString = atob(b64.replace(/^data:.*?;base64,/, ""));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==========================================================================
// 6. Mesh Display Mode Applicator
// ==========================================================================
function applyDisplayModeToMesh(part, mode) {
  const mesh = part.mesh;
  const oldWire = mesh.getObjectByName("__wireOverlay__");
  if (oldWire) mesh.remove(oldWire);

  if (mode === "pbr") {
    mesh.material = part.pbrMat;
    mesh.material.wireframe = false;
    mesh.material.transparent = false;
    mesh.material.opacity = 1.0;
  } else if (mode === "wireframe") {
    mesh.material = part.pbrMat;
    mesh.material.wireframe = true;
    mesh.material.transparent = false;
    mesh.material.opacity = 1.0;
  } else if (mode === "shaded_wireframe") {
    mesh.material = part.pbrMat;
    mesh.material.wireframe = false;
    const wireMat = new THREE.MeshBasicMaterial({
      color: "#22d3ee",
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const wireMesh = new THREE.Mesh(mesh.geometry, wireMat);
    wireMesh.name = "__wireOverlay__";
    mesh.add(wireMesh);
  } else if (mode === "xray") {
    mesh.material = part.pbrMat;
    mesh.material.wireframe = false;
    mesh.material.transparent = true;
    mesh.material.opacity = 0.42;
    mesh.material.depthWrite = false;
  } else if (mode === "normals") {
    mesh.material = normalMat;
  } else if (mode === "clay") {
    mesh.material = clayMat;
  }

  // Restore selection or hover emission
  if (state.selectedPart === part) {
    if (mesh.material.emissive) mesh.material.emissive.set("#38bdf8");
  } else if (state.hoveredPart === part) {
    if (mesh.material.emissive) mesh.material.emissive.set("#818cf8");
  } else {
    if (mesh.material.emissive) {
      mesh.material.emissive.copy(part.originalEmissive || new THREE.Color("#000000"));
    }
  }
}

// ==========================================================================
// 7. GLTF Processing & Scene Graph Setup
// ==========================================================================
const submeshSemanticNames = [
  { name: "Bodi Utama (Main Body)", desc: "Dibuat dari Default Cube via Box Modeling di Blender (Slot: Material)", colorHex: "#000827" },
  { name: "Sasis & Rangka (Chassis)", desc: "Dibuat dari ekstrusi face bawah & bevel sambungan (Slot: Material.001)", colorHex: "#202020" },
  { name: "Lampu / Indikator (Focal Accent)", desc: "Dibuat dari Inset Face (I) & material aksen cyan (Slot: Material.002)", colorHex: "#01433d" },
  { name: "Lis & Trim Interior (Trim Lines)", desc: "Dibuat dari Loop Cut (Ctrl+R) pembatas panel (Slot: Material.003)", colorHex: "#000000" },
];

function processLoadedGLTF(gltf) {
  log("Memproses Scene Graph: grafkom1.blend ➔ grafkom1.glb ➔ Canvas Three.js");
  const rawScene = gltf.scene;

  // Center model at origin
  const box = new THREE.Box3().setFromObject(rawScene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  rawScene.position.sub(center);
  rawScene.position.y += size.y * 0.15;

  rootGroup.add(rawScene);

  let totalVerts = 0;
  let totalTris = 0;
  const materialSet = new Set();
  let partIndex = 0;

  rawScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      const geo = child.geometry;
      const vertCount = geo.attributes.position ? geo.attributes.position.count : 0;
      const triCount = geo.index ? geo.index.count / 3 : vertCount / 3;
      totalVerts += vertCount;
      totalTris += Math.round(triCount);

      let origMat = child.material;
      let pbrMat = origMat ? origMat.clone() : new THREE.MeshStandardMaterial({ color: "#8b5cf6" });
      child.material = pbrMat;

      if (pbrMat.name) materialSet.add(pbrMat.name);

      child.geometry.computeBoundingBox();
      const pBox = child.geometry.boundingBox.clone();
      const pCenter = pBox.getCenter(new THREE.Vector3());

      let explodeDir = pCenter.clone().normalize();
      if (explodeDir.lengthSq() < 0.001) {
        explodeDir = new THREE.Vector3(
          partIndex === 0 ? -1 : partIndex === 1 ? 1 : 0,
          partIndex === 2 ? 1 : 0.2,
          partIndex === 3 ? 1 : -0.5
        ).normalize();
      }

      const semantic = submeshSemanticNames[partIndex] || {
        name: `Part ${partIndex + 1}`,
        desc: `Primitive ${partIndex}`,
        colorHex: `#${pbrMat.color ? pbrMat.color.getHexString() : "ffffff"}`
      };

      const partInfo = {
        index: partIndex,
        mesh: child,
        name: semantic.name,
        semanticDesc: semantic.desc,
        matName: pbrMat.name || `Material_Slot_${partIndex}`,
        pbrMat: pbrMat,
        originalColor: pbrMat.color ? pbrMat.color.clone() : new THREE.Color("#ffffff"),
        originalEmissive: pbrMat.emissive ? pbrMat.emissive.clone() : new THREE.Color("#000000"),
        originalRoughness: pbrMat.roughness !== undefined ? pbrMat.roughness : 0.5,
        originalMetalness: pbrMat.metalness !== undefined ? pbrMat.metalness : 0.0,
        originalPos: child.position.clone(),
        explodeDir: explodeDir,
        vertCount: vertCount,
        triCount: Math.round(triCount),
        bounds: pBox,
      };

      child.userData = partInfo;
      modelParts.push(partInfo);
      partIndex++;
    }
  });

  state.modelLoaded = true;

  // Update Status Badges
  const statusBadge = $("#statusBadge");
  if (statusBadge) {
    statusBadge.innerHTML = `<span class="status-dot"></span> MODEL TERHUBUNG KE CANVAS · 4 SUB-MESH PRIMITIVE`;
    statusBadge.style.borderColor = "rgba(34, 211, 238, 0.4)";
  }

  const pipelineStatus = $("#assetPipelineStatus");
  if (pipelineStatus) {
    pipelineStatus.innerHTML = `<span class="status-dot"></span> TERHUBUNG KE CANVAS (2.577 Verts · 1.449 Tris · 4 Material Slots)`;
  }

  // Update HUD
  $("#hudModel").textContent = "grafkom1.glb";
  $("#hudVerts").textContent = totalVerts.toLocaleString("id-ID");
  $("#hudTris").textContent = totalTris.toLocaleString("id-ID");
  $("#hudMaterials").textContent = `${materialSet.size || modelParts.length} Slots PBR`;
  $("#hudActiveMode").textContent = "Shaded PBR";
  $("#hudFPS").textContent = "60 FPS";

  log(`Model grafkom1 sukses terhubung: ${totalVerts} vertices, ${totalTris} tris, ${modelParts.length} sub-mesh primitives.`);

  // Auto-select part 0
  if (modelParts.length > 0) {
    selectPart(modelParts[0]);
  }
}

// ==========================================================================
// 8. GLTF Loader with Double-Safety (Direct URL + Direct Buffer Parse)
// ==========================================================================
const loader = new GLTFLoader();

function loadModel() {
  log("Memuat aset grafkom1.glb ke Canvas Three.js...");
  const modelUrl = new URL("./grafkom1.glb", import.meta.url).href;

  loader.load(
    modelUrl,
    (gltf) => {
      processLoadedGLTF(gltf);
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        log(`Mengunduh GLB: ${percent}%...`);
      }
    },
    (err) => {
      console.warn("Direct fetch error (likely CORS on file:///), parsing embedded binary buffer...", err);
      log("Mengurai Buffer Biner Lokal (ArrayBuffer CORS-Safe)...");
      try {
        const buffer = base64ToArrayBuffer(modelBase64);
        loader.parse(
          buffer,
          "",
          (gltf) => {
            processLoadedGLTF(gltf);
          },
          (parseErr) => {
            log("Gagal mem-parsing binary buffer GLTF: " + parseErr.message);
            console.error(parseErr);
          }
        );
      } catch (ex) {
        log("Error base64ToArrayBuffer: " + ex.message);
      }
    }
  );
}

loadModel();

// ==========================================================================
// 9. Two-Way Selection Binding (Canvas ⇄ UI)
// ==========================================================================
function selectPart(part) {
  if (state.selectedPart && state.selectedPart !== part) {
    if (state.selectedPart.mesh.material.emissive) {
      state.selectedPart.mesh.material.emissive.copy(state.selectedPart.originalEmissive);
    }
  }

  state.selectedPart = part;

  if (part) {
    if (part.mesh.material.emissive) {
      part.mesh.material.emissive.set("#0284c7");
    }

    $("#infoTitle").textContent = `${part.name} [${part.matName}]`;
    $("#infoColorSwatch").style.backgroundColor = `#${part.originalColor.getHexString()}`;
    $("#infoColorHex").textContent = `#${part.originalColor.getHexString().toUpperCase()} | RGB(${Math.round(part.originalColor.r * 255)}, ${Math.round(part.originalColor.g * 255)}, ${Math.round(part.originalColor.b * 255)})`;
    $("#infoRoughness").textContent = part.pbrMat.roughness !== undefined ? part.pbrMat.roughness.toFixed(2) : "N/A";
    $("#infoMetalness").textContent = part.pbrMat.metalness !== undefined ? part.pbrMat.metalness.toFixed(2) : "N/A";
    $("#infoVertCount").textContent = `${part.vertCount.toLocaleString("id-ID")} vertices`;
    $("#infoTriCount").textContent = `${part.triCount.toLocaleString("id-ID")} faces (tris)`;

    const size = part.bounds.getSize(new THREE.Vector3());
    $("#infoDimensions").textContent = `X: ${size.x.toFixed(2)}, Y: ${size.y.toFixed(2)}, Z: ${size.z.toFixed(2)}`;

    // Sync submesh card active state in UI
    document.querySelectorAll(".submesh-card").forEach((card) => {
      const idx = parseInt(card.dataset.submeshIndex, 10);
      card.classList.toggle("active-submesh", idx === part.index);
    });

    log(`Bagian terseleksi di Canvas: <b>${part.name}</b> (Slot: ${part.matName})`);
  }
}

function handlePointerMove(e) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, activeCamera);
  const meshes = modelParts.map((p) => p.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    const hitPart = hitMesh.userData;
    container.style.cursor = "pointer";

    if (state.hoveredPart !== hitPart) {
      if (state.hoveredPart && state.hoveredPart !== state.selectedPart) {
        if (state.hoveredPart.mesh.material.emissive) {
          state.hoveredPart.mesh.material.emissive.copy(state.hoveredPart.originalEmissive);
        }
      }
      state.hoveredPart = hitPart;
      if (hitPart !== state.selectedPart && hitPart.mesh.material.emissive) {
        hitPart.mesh.material.emissive.set("#38bdf8");
      }
    }
  } else {
    container.style.cursor = "grab";
    if (state.hoveredPart) {
      if (state.hoveredPart !== state.selectedPart && state.hoveredPart.mesh.material.emissive) {
        state.hoveredPart.mesh.material.emissive.copy(state.hoveredPart.originalEmissive);
      }
      state.hoveredPart = null;
    }
  }
}

function handlePointerClick(e) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, activeCamera);
  const meshes = modelParts.map((p) => p.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    const hitPart = intersects[0].object.userData;
    selectPart(hitPart);
  }
}

container.addEventListener("pointermove", handlePointerMove);
container.addEventListener("click", handlePointerClick);

// ==========================================================================
// 10. Exploded View Transform
// ==========================================================================
function updateExplode() {
  const amount = state.explodeAmount;
  modelParts.forEach((part) => {
    const offset = part.explodeDir.clone().multiplyScalar(amount * 2.2);
    part.mesh.position.copy(part.originalPos).add(offset);
  });
}

// ==========================================================================
// 11. Display Modes & Material Tuning
// ==========================================================================
function setDisplayMode(mode) {
  state.displayMode = mode;
  modelParts.forEach((part) => applyDisplayModeToMesh(part, mode));
  $("#hudActiveMode").textContent =
    mode === "pbr" ? "Shaded PBR" :
    mode === "wireframe" ? "Wireframe" :
    mode === "shaded_wireframe" ? "Shaded + Wire" :
    mode === "xray" ? "X-Ray View" :
    mode === "normals" ? "Normals" : "Clay Matcap";

  const sel = $("#displayModeSelect");
  if (sel) sel.value = mode;

  log(`Mode Tampilan di Canvas: <b>${mode.toUpperCase()}</b>`);
}

function updateMaterialOverrides() {
  modelParts.forEach((part) => {
    if (part.pbrMat && part.pbrMat.isMeshStandardMaterial) {
      part.pbrMat.roughness = THREE.MathUtils.clamp(part.originalRoughness * state.roughnessScale, 0, 1);
      part.pbrMat.metalness = THREE.MathUtils.clamp(part.originalMetalness * state.metalnessScale, 0, 1);
    }
  });
}

// ==========================================================================
// 12. Camera Presets
// ==========================================================================
function setCameraPreset(viewName) {
  controls.reset();
  const dist = 8.5;
  if (viewName === "front") {
    activeCamera.position.set(0, 0.5, dist);
    log("Preset Kamera: <b>FRONT VIEW (X)</b>");
  } else if (viewName === "side") {
    activeCamera.position.set(dist, 0.5, 0);
    log("Preset Kamera: <b>SIDE VIEW (Z)</b>");
  } else if (viewName === "top") {
    activeCamera.position.set(0, dist, 0.001);
    log("Preset Kamera: <b>TOP VIEW (Y)</b>");
  } else if (viewName === "iso") {
    activeCamera.position.set(5.5, 4.0, 6.5);
    log("Preset Kamera: <b>ISOMETRIC VIEW</b>");
  }
  controls.target.set(0, 0, 0);
  controls.update();

  document.querySelectorAll(".pill-view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
}

function switchCamera(type) {
  state.activeCameraMode = type;
  if (type === "orthographic") {
    orthographicCamera.position.copy(activeCamera.position);
    orthographicCamera.quaternion.copy(activeCamera.quaternion);
    activeCamera = orthographicCamera;
    log("Kamera: <b>ORTHOGRAPHIC</b> (Proyeksi Datar Blender Numpad 5)");
  } else {
    perspectiveCamera.position.copy(activeCamera.position);
    perspectiveCamera.quaternion.copy(activeCamera.quaternion);
    activeCamera = perspectiveCamera;
    log("Kamera: <b>PERSPECTIVE</b> (Kamera Realistis)");
  }
  controls.object = activeCamera;
  controls.update();
  onResize();
}

// ==========================================================================
// 13. Lighting Presets
// ==========================================================================
function setLightingPreset(preset) {
  if (preset === "studio") {
    keyLight.color.set("#ffffff");
    keyLight.intensity = 1.8;
    fillLight.color.set("#22d3ee");
    fillLight.intensity = 0.7;
    rimLight.color.set("#f472b6");
    rimLight.intensity = 1.1;
    hemiLight.color.set("#a78bfa");
    scene.background.set("#050814");
    log("Lighting Preset: <b>STUDIO 3-POINT LIGHT</b>");
  } else if (preset === "cyberpunk") {
    keyLight.color.set("#00f0ff");
    keyLight.intensity = 2.4;
    fillLight.color.set("#ec4899");
    fillLight.intensity = 1.5;
    rimLight.color.set("#8b5cf6");
    rimLight.intensity = 2.0;
    hemiLight.color.set("#6366f1");
    scene.background.set("#03020c");
    log("Lighting Preset: <b>CYBERPUNK NEON GLOW</b>");
  } else if (preset === "sunset") {
    keyLight.color.set("#fb923c");
    keyLight.intensity = 2.2;
    fillLight.color.set("#f43f5e");
    fillLight.intensity = 0.9;
    rimLight.color.set("#fde047");
    rimLight.intensity = 1.2;
    hemiLight.color.set("#ea580c");
    scene.background.set("#1a0808");
    log("Lighting Preset: <b>WARM SUNSET GOLDEN</b>");
  } else if (preset === "clean") {
    keyLight.color.set("#ffffff");
    keyLight.intensity = 1.5;
    fillLight.color.set("#ffffff");
    fillLight.intensity = 0.8;
    rimLight.color.set("#cbd5e1");
    rimLight.intensity = 0.5;
    hemiLight.color.set("#ffffff");
    scene.background.set("#0f172a");
    log("Lighting Preset: <b>CLEAN MINIMAL WHITE</b>");
  }
  $("#keyLightControl").value = keyLight.intensity;
  $("#keyLightVal").textContent = keyLight.intensity.toFixed(1);
}

// ==========================================================================
// 14. Global Interactive Pipeline & Canvas Bridge (Exposed to window)
// ==========================================================================
window.highlightSubmesh = function (index) {
  const part = modelParts[index];
  if (part) {
    selectPart(part);
    // Smooth camera focus to part centroid
    const target = part.bounds.getCenter(new THREE.Vector3());
    controls.target.copy(target);
    controls.update();
  }
};

window.isolateSubmesh = function (index) {
  const targetPart = modelParts[index];
  if (!targetPart) return;
  modelParts.forEach((p) => {
    p.mesh.visible = p === targetPart;
  });
  selectPart(targetPart);
  log(`Mengisolasi tampilan komponen: <b>${targetPart.name}</b>`);
};

window.showAllSubmeshes = function () {
  modelParts.forEach((p) => (p.mesh.visible = true));
  log("Menampilkan kembali seluruh komponen model di Canvas.");
};

window.setPipelineStep = function (step) {
  state.currentPipelineStep = step;
  document.querySelectorAll(".step-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.step, 10) === step);
  });

  if (step === 1) {
    // Step 1: Mentah Blender (Clay Workbench)
    setDisplayMode("clay");
    state.explodeAmount = 0;
    $("#explodeControl").value = 0;
    $("#explodeVal").textContent = "0.00";
    updateExplode();
    log("<b>[Tahap 1 Pipeline]</b> Model Mentah Blender (.blend): Shading Clay Workbench tanpa material.");
  } else if (step === 2) {
    // Step 2: Topologi glTF (Normals + Wireframe)
    setDisplayMode("shaded_wireframe");
    state.explodeAmount = 0;
    $("#explodeControl").value = 0;
    $("#explodeVal").textContent = "0.00";
    updateExplode();
    log("<b>[Tahap 2 Pipeline]</b> Topologi Mesh glTF: Triangulasi 1.449 segitiga & edge flow.");
  } else if (step === 3) {
    // Step 3: Multi-Material Partisi (Exploded View)
    setDisplayMode("pbr");
    state.explodeAmount = 0.75;
    $("#explodeControl").value = 0.75;
    $("#explodeVal").textContent = "0.75";
    updateExplode();
    log("<b>[Tahap 3 Pipeline]</b> Multi-Material Blender: Pembagian 4 primitive slot dibongkar terpisah.");
  } else if (step === 4) {
    // Step 4: Render PBR Penuh Runtime (.glb)
    setDisplayMode("pbr");
    state.explodeAmount = 0;
    $("#explodeControl").value = 0;
    $("#explodeVal").textContent = "0.00";
    updateExplode();
    log("<b>[Tahap 4 Pipeline]</b> Runtime WebGL (.glb): Rendering PBR penuh 60 FPS di Canvas.");
  }
};

window.setCanvasDisplayMode = function (mode) {
  setDisplayMode(mode);
};

window.setExplodeView = function (amount) {
  state.explodeAmount = amount;
  $("#explodeControl").value = amount;
  $("#explodeVal").textContent = amount.toFixed(2);
  updateExplode();
};

window.toggleGridAndAxis = function (visible) {
  state.gridVisible = visible !== undefined ? visible : !state.gridVisible;
  gridHelper.visible = state.gridVisible;
  axesHelper.visible = state.gridVisible;
  groundMesh.visible = state.gridVisible;
  log(`Grid & Axis Canvas: ${state.gridVisible ? "Aktif" : "Nonaktif"}`);
};

window.resetStudioCanvas = function () {
  setCameraPreset("iso");
  setDisplayMode("pbr");
  setLightingPreset("studio");
  state.explodeAmount = 0;
  $("#explodeControl").value = 0;
  $("#explodeVal").textContent = "0.00";
  state.roughnessScale = 1.0;
  $("#roughnessControl").value = 1.0;
  $("#roughnessVal").textContent = "1.00x";
  state.metalnessScale = 1.0;
  $("#metalnessControl").value = 1.0;
  $("#metalnessVal").textContent = "1.00x";
  window.showAllSubmeshes();
  updateExplode();
  updateMaterialOverrides();
  log("Canvas Three.js berhasil di-reset sepenuhnya.");
};

window.reloadModelAsset = function () {
  log("Memuat ulang file grafkom1.glb...");
  if (rootGroup) {
    while (rootGroup.children.length > 0) {
      rootGroup.remove(rootGroup.children[0]);
    }
  }
  modelParts.length = 0;
  loadModel();
};

// ==========================================================================
// 15. UI Controls Binding
// ==========================================================================
const displayModeSelect = $("#displayModeSelect");
if (displayModeSelect) {
  displayModeSelect.addEventListener("change", (e) => setDisplayMode(e.target.value));
}

const cameraSelect = $("#cameraSelect");
if (cameraSelect) {
  cameraSelect.addEventListener("change", (e) => switchCamera(e.target.value));
}

const fovControl = $("#fovControl");
if (fovControl) {
  fovControl.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    perspectiveCamera.fov = val;
    perspectiveCamera.updateProjectionMatrix();
    $("#fovVal").textContent = `${val}°`;
  });
}

const explodeControl = $("#explodeControl");
if (explodeControl) {
  explodeControl.addEventListener("input", (e) => {
    state.explodeAmount = parseFloat(e.target.value);
    $("#explodeVal").textContent = state.explodeAmount.toFixed(2);
    updateExplode();
  });
}

const roughnessControl = $("#roughnessControl");
if (roughnessControl) {
  roughnessControl.addEventListener("input", (e) => {
    state.roughnessScale = parseFloat(e.target.value);
    $("#roughnessVal").textContent = `${state.roughnessScale.toFixed(2)}x`;
    updateMaterialOverrides();
  });
}

const metalnessControl = $("#metalnessControl");
if (metalnessControl) {
  metalnessControl.addEventListener("input", (e) => {
    state.metalnessScale = parseFloat(e.target.value);
    $("#metalnessVal").textContent = `${state.metalnessScale.toFixed(2)}x`;
    updateMaterialOverrides();
  });
}

const lightPresetSelect = $("#lightPresetSelect");
if (lightPresetSelect) {
  lightPresetSelect.addEventListener("change", (e) => setLightingPreset(e.target.value));
}

const keyLightControl = $("#keyLightControl");
if (keyLightControl) {
  keyLightControl.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    keyLight.intensity = val;
    $("#keyLightVal").textContent = val.toFixed(1);
  });
}

const autoRotateBtn = $("#autoRotateBtn");
if (autoRotateBtn) {
  autoRotateBtn.addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    autoRotateBtn.classList.toggle("active", state.autoRotate);
    autoRotateBtn.textContent = state.autoRotate ? "⏸️ Auto-Rotate" : "▶️ Auto-Rotate";
    log(state.autoRotate ? "Auto-rotasi diaktifkan." : "Auto-rotasi dijeda.");
  });
}

const toggleGridBtn = $("#toggleGridBtn");
if (toggleGridBtn) {
  toggleGridBtn.addEventListener("click", () => {
    window.toggleGridAndAxis();
    toggleGridBtn.classList.toggle("active", state.gridVisible);
  });
}

const resetBtn = $("#resetBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    window.resetStudioCanvas();
  });
}

const wireframeBtn = $("#wireframeBtn");
if (wireframeBtn) {
  wireframeBtn.addEventListener("click", () => {
    if (state.displayMode === "wireframe") {
      setDisplayMode("pbr");
    } else {
      setDisplayMode("wireframe");
    }
  });
}

document.querySelectorAll(".pill-view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setCameraPreset(btn.dataset.view);
  });
});

const isolateBtn = $("#isolateBtn");
if (isolateBtn) {
  isolateBtn.addEventListener("click", () => {
    if (!state.selectedPart) return;
    const isIsolated = isolateBtn.getAttribute("data-isolated") === "true";
    if (isIsolated) {
      window.showAllSubmeshes();
      isolateBtn.setAttribute("data-isolated", "false");
      isolateBtn.textContent = "🔍 Isolasi Bagian";
    } else {
      window.isolateSubmesh(state.selectedPart.index);
      isolateBtn.setAttribute("data-isolated", "true");
      isolateBtn.textContent = "👁️ Tampilkan Semua";
    }
  });
}

document.querySelectorAll("[data-orbit-setting]").forEach((chk) => {
  chk.addEventListener("change", (e) => {
    const key = e.target.dataset.orbitSetting;
    controls[key] = e.target.checked;
  });
});

// Bind Submesh Card Clicks
document.querySelectorAll(".submesh-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    const idx = parseInt(card.dataset.submeshIndex, 10);
    window.highlightSubmesh(idx);
  });
});

// Bind Pipeline Step Buttons
document.querySelectorAll(".step-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const step = parseInt(btn.dataset.step, 10);
    window.setPipelineStep(step);
  });
});

// Bind Theory Callout Buttons
document.querySelectorAll(".canvas-trigger-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "highlight-part") {
      window.highlightSubmesh(parseInt(btn.dataset.targetPart, 10));
    } else if (action === "mode") {
      setDisplayMode(btn.dataset.mode);
    } else if (action === "explode") {
      window.setExplodeView(parseFloat(btn.dataset.amount));
    } else if (action === "step") {
      window.setPipelineStep(parseInt(btn.dataset.step, 10));
    } else if (action === "camera") {
      setCameraPreset(btn.dataset.view);
    } else if (action === "reset") {
      window.resetStudioCanvas();
    }
  });
});

// ==========================================================================
// 16. Keyboard Shortcuts
// ==========================================================================
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

  const key = e.key.toLowerCase();
  if (key === " ") {
    e.preventDefault();
    if (autoRotateBtn) autoRotateBtn.click();
  } else if (key === "w") {
    setDisplayMode(state.displayMode === "wireframe" ? "pbr" : "wireframe");
  } else if (key === "g") {
    if (toggleGridBtn) toggleGridBtn.click();
  } else if (key === "c") {
    switchCamera(state.activeCameraMode === "perspective" ? "orthographic" : "perspective");
    if (cameraSelect) cameraSelect.value = state.activeCameraMode;
  } else if (key === "1") {
    setCameraPreset("front");
  } else if (key === "2") {
    setCameraPreset("side");
  } else if (key === "3") {
    setCameraPreset("top");
  } else if (key === "4" || key === "0") {
    setCameraPreset("iso");
  } else if (key === "x") {
    state.explodeAmount = state.explodeAmount > 0.05 ? 0 : 0.65;
    if (explodeControl) {
      explodeControl.value = state.explodeAmount;
      $("#explodeVal").textContent = state.explodeAmount.toFixed(2);
    }
    updateExplode();
    log(`Exploded View: ${state.explodeAmount > 0 ? "ON" : "OFF"}`);
  } else if (key === "r") {
    window.resetStudioCanvas();
  }
});

// ==========================================================================
// 17. Responsive Resize
// ==========================================================================
function onResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (width === 0 || height === 0) return;

  const aspect = width / height;

  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();

  orthographicCamera.left = -orthoSize * aspect;
  orthographicCamera.right = orthoSize * aspect;
  orthographicCamera.top = orthoSize;
  orthographicCamera.bottom = -orthoSize;
  orthographicCamera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

window.addEventListener("resize", onResize);
onResize();

// ==========================================================================
// 18. Animation Loop
// ==========================================================================
let frameCount = 0;
let lastFpsTime = performance.now();
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (state.autoRotate && rootGroup) {
    rootGroup.rotation.y += state.autoRotateSpeed * delta * 0.75;
  }

  controls.update();
  renderer.render(scene, activeCamera);

  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    const fpsElem = $("#hudFPS");
    if (fpsElem) fpsElem.textContent = `${fps} FPS`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

animate();
