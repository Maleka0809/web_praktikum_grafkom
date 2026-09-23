const canvas = document.querySelector("#webglCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  document.querySelector("#statusBadge").textContent = "WebGL2 TIDAK TERSEDIA";
  throw new Error("Browser tidak mendukung WebGL2.");
}

const vertexShaderSource = `#version 300 es
in vec3 a_position;
in vec3 a_color;
out vec3 v_color;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

void main() {
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
  v_color = a_color;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 outColor;

void main() {
  outColor = vec4(v_color, 1.0);
}`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

function createProgram() {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(
    program,
    compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource),
  );
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  return program;
}

const program = createProgram();
const positionLocation = gl.getAttribLocation(program, "a_position");
const colorLocation = gl.getAttribLocation(program, "a_color");
const modelLocation = gl.getUniformLocation(program, "u_model");
const viewLocation = gl.getUniformLocation(program, "u_view");
const projectionLocation = gl.getUniformLocation(program, "u_projection");

// =======================
// KUBUS (Tengah)
// =======================
const faceColors = [
  [0.1, 0.9, 1], [1, 0.25, 0.3], [0.3, 1, 0.45],
  [1, 0.75, 0.15], [0.65, 0.35, 1], [1, 0.45, 0.7],
];

const cubePositions = [];
const cubeColors = [];
const faces = [
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
  [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
  [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
];

const faceTriangles = [0, 1, 2, 0, 2, 3];
faces.forEach((face, faceIndex) => {
  faceTriangles.forEach((vertexIndex) => {
    cubePositions.push(...face[vertexIndex].map((value) => value * 0.55));
    cubeColors.push(...faceColors[faceIndex]);
  });
});

// =======================
// PIRAMIDA (Kiri)
// =======================
const pyramidPositions = [];
const pyramidColors = [];
const s = 0.55; 
const pyrVertices = [
  [0, s, 0],       // 0: Puncak
  [-s, -s, s],     // 1: Kiri Depan
  [s, -s, s],      // 2: Kanan Depan
  [s, -s, -s],     // 3: Kanan Belakang
  [-s, -s, -s]     // 4: Kiri Belakang
];
const pyrFaces = [
  { v: [0, 1, 2], c: [1, 0.5, 0] }, // Depan (Orange)
  { v: [0, 2, 3], c: [0, 1, 0] },   // Kanan (Hijau)
  { v: [0, 3, 4], c: [1, 0, 0] },   // Belakang (Merah)
  { v: [0, 4, 1], c: [0, 0, 1] },   // Kiri (Biru)
  { v: [1, 4, 3], c: [1, 1, 0] },   // Alas 1 (Kuning)
  { v: [1, 3, 2], c: [1, 1, 0] }    // Alas 2 (Kuning)
];
pyrFaces.forEach(face => {
  face.v.forEach(idx => {
    pyramidPositions.push(...pyrVertices[idx]);
    pyramidColors.push(...face.c);
  });
});

// =======================
// BOLA (Kanan)
// =======================
const spherePositions = [];
const sphereColors = [];
const radius = 0.55;
const latBands = 20;
const lonBands = 20;

const sphV = [];
const sphC = [];
for (let latNumber = 0; latNumber <= latBands; latNumber++) {
  const theta = latNumber * Math.PI / latBands;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  for (let longNumber = 0; longNumber <= lonBands; longNumber++) {
    const phi = longNumber * 2 * Math.PI / lonBands;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const x = cosPhi * sinTheta;
    const y = cosTheta;
    const z = sinPhi * sinTheta;

    sphV.push(radius * x, radius * y, radius * z);
    
    // Warna gradasi berdasarkan posisi
    sphC.push(0.5 + 0.5 * x, 0.5 + 0.5 * y, 0.5 + 0.5 * z); 
  }
}

for (let latNumber = 0; latNumber < latBands; latNumber++) {
  for (let longNumber = 0; longNumber < lonBands; longNumber++) {
    const first = (latNumber * (lonBands + 1)) + longNumber;
    const second = first + lonBands + 1;

    // Triangle 1
    spherePositions.push(
      sphV[first * 3], sphV[first * 3 + 1], sphV[first * 3 + 2],
      sphV[second * 3], sphV[second * 3 + 1], sphV[second * 3 + 2],
      sphV[(first + 1) * 3], sphV[(first + 1) * 3 + 1], sphV[(first + 1) * 3 + 2]
    );
    sphereColors.push(
      sphC[first * 3], sphC[first * 3 + 1], sphC[first * 3 + 2],
      sphC[second * 3], sphC[second * 3 + 1], sphC[second * 3 + 2],
      sphC[(first + 1) * 3], sphC[(first + 1) * 3 + 1], sphC[(first + 1) * 3 + 2]
    );

    // Triangle 2
    spherePositions.push(
      sphV[second * 3], sphV[second * 3 + 1], sphV[second * 3 + 2],
      sphV[(second + 1) * 3], sphV[(second + 1) * 3 + 1], sphV[(second + 1) * 3 + 2],
      sphV[(first + 1) * 3], sphV[(first + 1) * 3 + 1], sphV[(first + 1) * 3 + 2]
    );
    sphereColors.push(
      sphC[second * 3], sphC[second * 3 + 1], sphC[second * 3 + 2],
      sphC[(second + 1) * 3], sphC[(second + 1) * 3 + 1], sphC[(second + 1) * 3 + 2],
      sphC[(first + 1) * 3], sphC[(first + 1) * 3 + 1], sphC[(first + 1) * 3 + 2]
    );
  }
}


function createBuffer(data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return buffer;
}

const objCube = {
  pos: createBuffer(cubePositions),
  col: createBuffer(cubeColors),
  count: cubePositions.length / 3
};
const objPyramid = {
  pos: createBuffer(pyramidPositions),
  col: createBuffer(pyramidColors),
  count: pyramidPositions.length / 3
};
const objSphere = {
  pos: createBuffer(spherePositions),
  col: createBuffer(sphereColors),
  count: spherePositions.length / 3
};


function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function translation(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function rotationX(degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ]);
}

function rotationY(degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ]);
}

function perspective(fovDegrees, aspect, near, far) {
  const f = 1 / Math.tan((fovDegrees * Math.PI) / 360);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * range, -1,
    0, 0, near * far * 2 * range, 0,
  ]);
}

function orthographic(size, aspect, near, far) {
  const halfWidth = size * aspect;
  const rangeX = 1 / (halfWidth * 2);
  const rangeY = 1 / (size * 2);
  const rangeZ = 1 / (near - far);
  return new Float32Array([
    rangeX, 0, 0, 0,
    0, rangeY, 0, 0,
    0, 0, 2 * rangeZ, 0,
    0, 0, (near + far) * rangeZ, 1,
  ]);
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function lookAt(eye, target, up) {
  const backward = normalize(subtract(eye, target));
  const right = normalize(cross(up, backward));
  const correctedUp = cross(backward, right);
  return new Float32Array([
    right[0], correctedUp[0], backward[0], 0,
    right[1], correctedUp[1], backward[1], 0,
    right[2], correctedUp[2], backward[2], 0,
    -dot(right, eye), -dot(correctedUp, eye), -dot(backward, eye), 1,
  ]);
}

const state = {
  camera: { position: [0, 1.2, 5], target: [0, 0, 0], up: [0, 1, 0] },
  fov: 60,
  near: 0.1,
  far: 30,
  projection: "perspective",
  depth: true,
  orbit: false,
  split: false,
  keys: {},
  time: 0,
  clipIndex: 0,
  fovIndex: 0,
};

const clipPresets = [
  { near: 0.1, far: 30 },
  { near: 0.5, far: 8 },
  { near: 1.5, far: 4 },
];
const fovPresets = [45, 60, 90];

function modelMatrix(position, rotation) {
  return multiply(
    translation(...position),
    multiply(rotationY(rotation[1]), rotationX(rotation[0])),
  );
}

function bindAttributes(objData) {
  gl.bindBuffer(gl.ARRAY_BUFFER, objData.pos);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, objData.col);
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
}

function drawShape(model, view, projection, objData) {
  bindAttributes(objData);
  gl.uniformMatrix4fv(modelLocation, false, model);
  gl.uniformMatrix4fv(viewLocation, false, view);
  gl.uniformMatrix4fv(projectionLocation, false, projection);
  gl.drawArrays(gl.TRIANGLES, 0, objData.count);
}

function drawPass(x, width, projection) {
  gl.viewport(x, 0, width, canvas.height);
  const view = lookAt(
    state.camera.position,
    state.camera.target,
    state.camera.up,
  );
  
  // Tengah: KUBUS
  drawShape(
    modelMatrix([0, 0, 0], [state.time * 34, state.time * 52]),
    view,
    projection,
    objCube
  );
  
  // Kiri: PIRAMIDA
  drawShape(
    modelMatrix([-1.45, 0.15, -1.6], [state.time * 20, state.time * 30]),
    view,
    projection,
    objPyramid
  );
  
  // Kanan: BOLA
  drawShape(
    modelMatrix([1.35, -0.2, -3.4], [state.time * 48, state.time * 18]),
    view,
    projection,
    objSphere
  );
}

function renderScene() {
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.015, 0.045, 0.09, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);

  if (state.depth) gl.enable(gl.DEPTH_TEST);
  else gl.disable(gl.DEPTH_TEST);

  if (state.split) {
    const half = Math.floor(canvas.width / 2);
    gl.scissor(0, 0, half, canvas.height);
    gl.clearColor(0.025, 0.07, 0.12, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawPass(0, half, projectionMatrix(half / canvas.height, "perspective"));
    
    gl.scissor(half, 0, canvas.width - half, canvas.height);
    gl.clearColor(0.04, 0.025, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawPass(
      half,
      canvas.width - half,
      projectionMatrix((canvas.width - half) / canvas.height, "orthographic"),
    );
  } else {
    gl.scissor(0, 0, canvas.width, canvas.height);
    drawPass(
      0,
      canvas.width,
      projectionMatrix(canvas.width / canvas.height, state.projection),
    );
  }

  gl.disable(gl.SCISSOR_TEST);
  updateHud();
}

function projectionMatrix(aspect, mode) {
  return mode === "perspective"
    ? perspective(state.fov, aspect, state.near, state.far)
    : orthographic(2.8, aspect, state.near, state.far);
}

function updateCamera(deltaTime) {
  const speed = 2.0 * deltaTime;
  if (state.keys.ArrowLeft) state.camera.position[0] -= speed;
  if (state.keys.ArrowRight) state.camera.position[0] += speed;
  if (state.keys.ArrowUp) state.camera.position[1] += speed;
  if (state.keys.ArrowDown) state.camera.position[1] -= speed;
  if (state.keys.w) state.camera.position[2] -= speed;
  if (state.keys.s) state.camera.position[2] += speed;
  if (state.keys.q) state.camera.target[0] -= speed;
  if (state.keys.e) state.camera.target[0] += speed;
  if (state.keys.a) state.camera.target[1] -= speed;
  if (state.keys.d) state.camera.target[1] += speed;
  if (state.orbit) {
    const radius = 5;
    state.camera.position[0] = Math.sin(state.time * 0.45) * radius;
    state.camera.position[2] = Math.cos(state.time * 0.45) * radius;
  }
}

function updateHud() {
  document.querySelector("#projectionInfo").textContent = state.split
    ? "Split P / O"
    : state.projection;
  document.querySelector("#cameraInfo").textContent =
    `(${state.camera.position.map((value) => value.toFixed(2)).join(", ")})`;
  document.querySelector("#fovInfo").textContent = `${state.fov.toFixed(0)}°`;
  document.querySelector("#clipInfo").textContent =
    `${state.near.toFixed(2)} / ${state.far.toFixed(2)}`;
  document.querySelector("#depthInfo").textContent = state.depth
    ? "Enabled"
    : "Disabled";
  document.querySelector("#cameraModeInfo").textContent = state.orbit
    ? "Orbit"
    : "Manual";
  document.querySelector("#statusBadge").textContent =
    `${state.depth ? "DEPTH ON" : "DEPTH OFF"} · WEBGL2`;
}

function resetScene() {
  state.camera.position = [0, 1.2, 5];
  state.camera.target = [0, 0, 0];
  state.fov = 60;
  state.near = 0.1;
  state.far = 30;
  state.projection = "perspective";
  state.depth = true;
  state.orbit = false;
  state.split = false;
  document.querySelector("#fovControl").value = 60;
  document.querySelector("#heightControl").value = 1.2;
  document.querySelector("#targetXControl").value = 0;
  document.querySelector("#targetYControl").value = 0;
}

function nextClipPreset() {
  state.clipIndex = (state.clipIndex + 1) % clipPresets.length;
  Object.assign(state, clipPresets[state.clipIndex]);
}

function nextFovPreset() {
  state.fovIndex = (state.fovIndex + 1) % fovPresets.length;
  state.fov = fovPresets[state.fovIndex];
  document.querySelector("#fovControl").value = state.fov;
}

function bindControls() {
  document.querySelector("#projectionButton").addEventListener("click", () => {
    state.projection =
      state.projection === "perspective" ? "orthographic" : "perspective";
  });
  document.querySelector("#orbitButton").addEventListener("click", () => {
    state.orbit = !state.orbit;
  });
  document.querySelector("#splitButton").addEventListener("click", () => {
    state.split = !state.split;
  });
  document.querySelector("#depthButton").addEventListener("click", () => {
    state.depth = !state.depth;
  });
  document
    .querySelector("#clipButton")
    .addEventListener("click", nextClipPreset);
  document
    .querySelector("#fovPresetButton")
    .addEventListener("click", nextFovPreset);
  document.querySelector("#resetButton").addEventListener("click", resetScene);
  document.querySelector("#fovControl").addEventListener("input", (event) => {
    state.fov = Number(event.target.value);
    document.querySelector("#fovValue").textContent = `${state.fov}°`;
  });
  document
    .querySelector("#heightControl")
    .addEventListener("input", (event) => {
      state.camera.position[1] = Number(event.target.value);
      document.querySelector("#heightValue").textContent = Number(
        event.target.value,
      ).toFixed(2);
    });
  document
    .querySelector("#targetXControl")
    .addEventListener("input", (event) => {
      state.camera.target[0] = Number(event.target.value);
      document.querySelector("#targetXValue").textContent = Number(
        event.target.value,
      ).toFixed(2);
    });
  document
    .querySelector("#targetYControl")
    .addEventListener("input", (event) => {
      state.camera.target[1] = Number(event.target.value);
      document.querySelector("#targetYValue").textContent = Number(
        event.target.value,
      ).toFixed(2);
    });
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)
  )
    event.preventDefault();
  state.keys[key] = true;
  if (event.repeat) return;
  if (key === "o")
    state.projection =
      state.projection === "perspective" ? "orthographic" : "perspective";
  if (key === "b") state.orbit = !state.orbit;
  if (key === "x") state.split = !state.split;
  if (key === "d") state.depth = !state.depth;
  if (key === "n") nextClipPreset();
  if (key === "r") resetScene();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  state.keys[key] = false;
});

let lastTime = 0;
function render(time) {
  const deltaTime = Math.min((time - lastTime) * 0.001, 0.05);
  lastTime = time;
  state.time += deltaTime;
  updateCamera(deltaTime);
  renderScene();
  requestAnimationFrame(render);
}

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);
bindControls();
renderScene();
requestAnimationFrame(render);
