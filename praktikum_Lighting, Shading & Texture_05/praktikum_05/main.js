

const canvas = document.querySelector("#webglCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  document.querySelector("#statusBadge").textContent = "WebGL2 TIDAK TERSEDIA";
  throw new Error("Browser tidak mendukung WebGL2.");
}

const vertexShaderSource = `#version 300 es
in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normalMatrix;
out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_uv;

void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);
  gl_Position = u_projection * u_view * worldPosition;
  v_worldPosition = worldPosition.xyz;
  v_normal = u_normalMatrix * a_normal;
  v_uv = a_uv;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_uv;
uniform vec3 u_lightPosition;
uniform vec3 u_cameraPosition;
uniform vec3 u_lightColor;
uniform float u_ambientStrength;
uniform float u_shininess;
uniform sampler2D u_texture;
uniform bool u_useTexture;
uniform bool u_useAmbient;
uniform bool u_useDiffuse;
uniform bool u_useSpecular;
out vec4 outColor;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 lightDirection = normalize(u_lightPosition - v_worldPosition);
  vec3 viewDirection = normalize(u_cameraPosition - v_worldPosition);
  vec3 halfVector = normalize(lightDirection + viewDirection);
  float diffuseAmount = max(dot(normal, lightDirection), 0.0);
  float specularAmount = pow(max(dot(normal, halfVector), 0.0), u_shininess);
  vec3 baseColor = u_useTexture ? texture(u_texture, v_uv).rgb : vec3(0.35, 0.78, 1.0);
  vec3 ambient = u_useAmbient ? u_ambientStrength * u_lightColor : vec3(0.0);
  vec3 diffuse = u_useDiffuse ? diffuseAmount * u_lightColor : vec3(0.0);
  vec3 specular = u_useSpecular ? specularAmount * u_lightColor : vec3(0.0);
  outColor = vec4(baseColor * (ambient + diffuse) + specular, 1.0);
}`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader));
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
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  return program;
}

const program = createProgram();
const positionLocation = gl.getAttribLocation(program, "a_position");
const normalLocation = gl.getAttribLocation(program, "a_normal");
const uvLocation = gl.getAttribLocation(program, "a_uv");
const locations = {
  model: gl.getUniformLocation(program, "u_model"),
  view: gl.getUniformLocation(program, "u_view"),
  projection: gl.getUniformLocation(program, "u_projection"),
  normalMatrix: gl.getUniformLocation(program, "u_normalMatrix"),
  lightPosition: gl.getUniformLocation(program, "u_lightPosition"),
  cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
  lightColor: gl.getUniformLocation(program, "u_lightColor"),
  ambient: gl.getUniformLocation(program, "u_ambientStrength"),
  shininess: gl.getUniformLocation(program, "u_shininess"),
  texture: gl.getUniformLocation(program, "u_texture"),
  useTexture: gl.getUniformLocation(program, "u_useTexture"),
  useAmbient: gl.getUniformLocation(program, "u_useAmbient"),
  useDiffuse: gl.getUniformLocation(program, "u_useDiffuse"),
  useSpecular: gl.getUniformLocation(program, "u_useSpecular"),
};

function cubeData() {
  const faces = [
    {
      corners: [
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1],
      ],
      normal: [0, 0, 1],
    },
    {
      corners: [
        [1, -1, -1],
        [-1, -1, -1],
        [-1, 1, -1],
        [1, 1, -1],
      ],
      normal: [0, 0, -1],
    },
    {
      corners: [
        [-1, 1, 1],
        [1, 1, 1],
        [1, 1, -1],
        [-1, 1, -1],
      ],
      normal: [0, 1, 0],
    },
    {
      corners: [
        [-1, -1, -1],
        [1, -1, -1],
        [1, -1, 1],
        [-1, -1, 1],
      ],
      normal: [0, -1, 0],
    },
    {
      corners: [
        [1, -1, 1],
        [1, -1, -1],
        [1, 1, -1],
        [1, 1, 1],
      ],
      normal: [1, 0, 0],
    },
    {
      corners: [
        [-1, -1, -1],
        [-1, -1, 1],
        [-1, 1, 1],
        [-1, 1, -1],
      ],
      normal: [-1, 0, 0],
    },
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  const uv = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  const positions = [];
  const normals = [];
  const uvs = [];

  faces.forEach((face) =>
    indices.forEach((index) => {
      positions.push(...face.corners[index].map((value) => value * 0.75));
      normals.push(...face.normal);
      uvs.push(...uv[index]);
    }),
  );

  return { positions, normals, uvs };
}

// Parametric surfaces keep this WebGL2 example usable without external libraries.
function curvedData(shape) {
  const tau = Math.PI * 2;
  function knotCenter(t) {
    const radius = 0.68 + 0.24 * Math.cos(5 * t);
    return [radius * Math.cos(2 * t), radius * Math.sin(2 * t),
      0.24 * Math.sin(5 * t)];
  }
  function surface(u, v) {
    const t = u * tau, angle = v * tau;
    if (shape === "sphere") {
      const latitude = v * Math.PI;
      const normal = [Math.sin(latitude) * Math.cos(t), Math.cos(latitude),
        Math.sin(latitude) * Math.sin(t)];
      return { position: normal.map(value => value * 1.05), normal };
    }
    if (shape === "torus") {
      const normal = [Math.cos(t) * Math.cos(angle),
        Math.sin(t) * Math.cos(angle), Math.sin(angle)];
      return { position: [(0.78 + 0.3 * Math.cos(angle)) * Math.cos(t),
        (0.78 + 0.3 * Math.cos(angle)) * Math.sin(t), 0.3 * Math.sin(angle)], normal };
    }
    const center = knotCenter(t);
    const tangent = normalize(subtract(knotCenter(t + 0.0001), knotCenter(t - 0.0001)));
    // The planar tangent never vanishes for this (2, 5) knot. This frame is periodic.
    const side = normalize(cross(tangent, [0, 0, 1]));
    const up = normalize(cross(side, tangent));
    const normal = side.map((value, i) => value * Math.cos(angle) + up[i] * Math.sin(angle));
    return { position: center.map((value, i) => value + 0.15 * normal[i]), normal };
  }
  const positions = [], normals = [], smoothNormals = [], uvs = [];
  const columns = shape === "torusKnot" ? 160 : 64;
  const rows = 32;
  function vertex(u, v) {
    const sample = surface(u, v);
    // Surface derivatives give the actual normal, including the tube frame's twist.
    if (shape === "torusKnot") {
      const du = subtract(surface(u + 0.00001, v).position, surface(u - 0.00001, v).position);
      const dv = subtract(surface(u, v + 0.00001).position, surface(u, v - 0.00001).position);
      let normal = normalize(cross(du, dv));
      if (dot(normal, sample.normal) < 0) normal = normal.map(value => -value);
      sample.normal = normal;
    }
    return { ...sample, uv: [u * 2, v * 2] };
  }
  const grid = Array.from({ length: columns + 1 }, (_, x) =>
    Array.from({ length: rows + 1 }, (_, y) => vertex(x / columns, y / rows)));
  function triangle(a, b, c) {
    let face = cross(subtract(b.position, a.position), subtract(c.position, a.position));
    if (Math.hypot(...face) < 1e-10) return; // Skip collapsed sphere pole triangles.
    if (dot(face, a.normal) < 0) {
      [b, c] = [c, b];
      face = face.map(value => -value);
    }
    face = normalize(face);
    for (const point of [a, b, c]) {
      positions.push(...point.position);
      normals.push(...face);
      smoothNormals.push(...point.normal);
      uvs.push(...point.uv);
    }
  }
  for (let x = 0; x < columns; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      triangle(grid[x][y], grid[x + 1][y], grid[x + 1][y + 1]);
      triangle(grid[x][y], grid[x + 1][y + 1], grid[x][y + 1]);
    }
  }
  return { positions, normals, smoothNormals, uvs };
}

const meshes = new Map();
function getMesh(shape) {
  if (meshes.has(shape)) return meshes.get(shape);
  const geometry = shape === "cube" ? cubeData() : curvedData(shape);
  const smoothNormals = geometry.smoothNormals || geometry.positions.reduce((result, _, index) => {
    if (index % 3 === 0) result.push(...normalize(geometry.positions.slice(index, index + 3)));
    return result;
  }, []);
  const mesh = {
    position: createBuffer(geometry.positions),
    flat: createBuffer(geometry.normals),
    smooth: createBuffer(smoothNormals),
    uv: createBuffer(geometry.uvs),
    count: geometry.positions.length / 3,
  };
  meshes.set(shape, mesh);
  return mesh;
}

function createBuffer(data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return buffer;
}

function bindAttribute(location, buffer, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function multiply(a, b) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1)
    for (let row = 0; row < 4; row += 1)
      r[c * 4 + row] =
        a[row] * b[c * 4] +
        a[4 + row] * b[c * 4 + 1] +
        a[8 + row] * b[c * 4 + 2] +
        a[12 + row] * b[c * 4 + 3];
  return r;
}
function translation(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}
function scale(x, y, z) {
  return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
}
function rotationX(degrees) {
  const a = (degrees * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
function rotationY(degrees) {
  const a = (degrees * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan((fov * Math.PI) / 360),
    range = 1 / (near - far);
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * range,
    -1,
    0,
    0,
    near * far * 2 * range,
    0,
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
  const backward = normalize(subtract(eye, target)),
    right = normalize(cross(up, backward)),
    correctedUp = cross(backward, right);
  return new Float32Array([
    right[0],
    correctedUp[0],
    backward[0],
    0,
    right[1],
    correctedUp[1],
    backward[1],
    0,
    right[2],
    correctedUp[2],
    backward[2],
    0,
    -dot(right, eye),
    -dot(correctedUp, eye),
    -dot(backward, eye),
    1,
  ]);
}
function normalMatrixFromMat4(m) {
  const a00 = m[0],
    a01 = m[4],
    a02 = m[8],
    a10 = m[1],
    a11 = m[5],
    a12 = m[9],
    a20 = m[2],
    a21 = m[6],
    a22 = m[10];
  const b01 = a22 * a11 - a12 * a21,
    b11 = -a22 * a10 + a12 * a20,
    b21 = a21 * a10 - a11 * a20;
  const determinant = a00 * b01 + a01 * b11 + a02 * b21 || 1;
  return new Float32Array([
    b01 / determinant,
    (-a22 * a01 + a02 * a21) / determinant,
    (a12 * a01 - a02 * a11) / determinant,
    b11 / determinant,
    (a22 * a00 - a02 * a20) / determinant,
    (-a12 * a00 + a02 * a10) / determinant,
    b21 / determinant,
    (-a21 * a00 + a01 * a20) / determinant,
    (a11 * a00 - a01 * a10) / determinant,
  ]);
}

const state = {
  camera: { position: [0, 1.3, 5], target: [0, 0, 0], up: [0, 1, 0] },
  light: [2, 2, 3],
  ambient: 0.18,
  shininess: 32,
  shape: "cube",
  flat: true,
  texture: true,
  textureSource: "checker",
  filter: "linear",
  wrap: "repeat",
  lightOrbit: false,
  cameraOrbit: false,
  depth: true,
  keys: {},
  scale: [1, 1, 1],
  components: { ambient: true, diffuse: true, specular: true },
  time: 0,
  cubeRotation: true,
  cubeTime: 0,
};

function createCheckerTexture() {
  const size = 128,
    checker = document.createElement("canvas");
  checker.width = size;
  checker.height = size;
  const context = checker.getContext("2d");
  for (let y = 0; y < 8; y += 1)
    for (let x = 0; x < 8; x += 1) {
      context.fillStyle = (x + y) % 2 ? "#1e3a8a" : "#8b5cf6";
      context.fillRect(x * 16, y * 16, 16, 16);
    }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, checker);
  return texture;
}
const checkerTexture = createCheckerTexture();
const imageTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, imageTexture);
gl.texImage2D(
  gl.TEXTURE_2D,
  0,
  gl.RGBA,
  1,
  1,
  0,
  gl.RGBA,
  gl.UNSIGNED_BYTE,
  new Uint8Array([40, 90, 150, 255]),
);
const image = new Image();
image.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  updateTextureState();
};
image.crossOrigin = "anonymous";
image.src = "https://darlis-its.github.io/materi-grafika-komputer/praktikum/output/pert05/texture.svg";

function updateTextureState() {
  const texture =
    state.textureSource === "image" ? imageTexture : checkerTexture;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const filter = state.filter === "nearest" ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    state.filter === "mipmap" ? gl.LINEAR_MIPMAP_LINEAR : filter,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_S,
    state.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE,
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_T,
    state.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE,
  );
  if (state.filter === "mipmap") gl.generateMipmap(gl.TEXTURE_2D);
}

function modelMatrix() {
  return multiply(
    translation(0, 0, 0),
    multiply(
      rotationY(state.cubeTime * 35),
      multiply(rotationX(state.cubeTime * 22), scale(...state.scale)),
    ),
  );
}
function draw() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.015, 0.045, 0.09, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  if (state.depth) gl.enable(gl.DEPTH_TEST);
  else gl.disable(gl.DEPTH_TEST);
  const mesh = getMesh(state.shape);
  bindAttribute(positionLocation, mesh.position, 3);
  bindAttribute(
    normalLocation,
    state.flat ? mesh.flat : mesh.smooth,
    3,
  );
  bindAttribute(uvLocation, mesh.uv, 2);
  const model = modelMatrix(),
    view = lookAt(state.camera.position, state.camera.target, state.camera.up),
    projection = perspective(60, canvas.width / canvas.height, 0.1, 30);
  gl.uniformMatrix4fv(locations.model, false, model);
  gl.uniformMatrix4fv(locations.view, false, view);
  gl.uniformMatrix4fv(locations.projection, false, projection);
  gl.uniformMatrix3fv(
    locations.normalMatrix,
    false,
    normalMatrixFromMat4(model),
  );
  gl.uniform3fv(locations.lightPosition, state.light);
  gl.uniform3fv(locations.cameraPosition, state.camera.position);
  gl.uniform3f(locations.lightColor, 1, 1, 1);
  gl.uniform1f(locations.ambient, state.ambient);
  gl.uniform1f(locations.shininess, state.shininess);
  gl.uniform1i(locations.useTexture, state.texture);
  gl.uniform1i(locations.useAmbient, state.components.ambient);
  gl.uniform1i(locations.useDiffuse, state.components.diffuse);
  gl.uniform1i(locations.useSpecular, state.components.specular);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(
    gl.TEXTURE_2D,
    state.textureSource === "image" ? imageTexture : checkerTexture,
  );
  gl.uniform1i(locations.texture, 0);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  updateHud();
}
function updateCamera(deltaTime) {
  const speed = 1.8 * deltaTime;
  if (state.keys.ArrowLeft) state.light[0] -= speed;
  if (state.keys.ArrowRight) state.light[0] += speed;
  if (state.keys.ArrowUp) state.light[1] += speed;
  if (state.keys.ArrowDown) state.light[1] -= speed;
  if (state.keys.w) state.light[2] -= speed;
  if (state.keys.s) state.light[2] += speed;
  if (state.keys.q) state.camera.position[0] -= speed;
  if (state.keys.e) state.camera.position[0] += speed;
  if (state.lightOrbit) {
    state.light[0] = Math.sin(state.time) * 3;
    state.light[2] = Math.cos(state.time) * 3;
  }
  if (state.cameraOrbit) {
    state.camera.position[0] = Math.sin(state.time * 0.45) * 5;
    state.camera.position[2] = Math.cos(state.time * 0.45) * 5;
  }
}
function updateHud() {
  document.querySelector("#cubeRotationButton").textContent = state.cubeRotation
    ? "Stop Object Rotation (P)"
    : "Resume Object Rotation (P)";
  document.querySelector("#shadingInfo").textContent = state.flat
    ? "FLAT"
    : "SMOOTH";
  document.querySelector("#lightInfo").textContent =
    `(${state.light.map((value) => value.toFixed(2)).join(", ")})`;
  document.querySelector("#textureInfo").textContent = state.texture
    ? state.textureSource.toUpperCase()
    : "OFF";
  document.querySelector("#filterInfo").textContent =
    state.filter.toUpperCase();
  document.querySelector("#wrapInfo").textContent = state.wrap.toUpperCase();
  document.querySelector("#cameraInfo").textContent = state.cameraOrbit
    ? "ORBIT ON"
    : "ORBIT OFF";
}
function reset() {
  Object.assign(state, {
    ambient: 0.18,
    shininess: 32,
    shape: "cube",
    flat: true,
    texture: true,
    textureSource: "checker",
    filter: "linear",
    wrap: "repeat",
    lightOrbit: false,
    cameraOrbit: false,
    depth: true,
    scale: [1, 1, 1],
    light: [2, 2, 3],
    time: 0,
    cubeRotation: true,
    cubeTime: 0,
  });
  document.querySelector("#shapeSelect").value = state.shape;
  state.camera.position = [0, 1.3, 5];
  state.camera.target = [0, 0, 0];
  [
    "ambientControl",
    "shininessControl",
    "lightXControl",
    "lightYControl",
    "lightZControl",
    "scaleXControl",
    "scaleYControl",
    "scaleZControl",
  ].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    if (element)
      element.value = id.includes("ambient")
        ? 0.18
        : id.includes("shininess")
          ? 32
          : id.includes("lightX")
            ? 2
            : id.includes("lightY")
              ? 2
              : id.includes("lightZ")
                ? 3
                : 1;
  });
  updateTextureState();
}
function bindControls() {
  document.querySelector("#shapeSelect").onchange = (event) => {
    state.shape = event.target.value;
    // Curved surfaces start smooth; F still lets learners compare triangle normals.
    state.flat = state.shape === "cube";
  };
  document.querySelector("#cubeRotationButton").onclick = () => {
    state.cubeRotation = !state.cubeRotation;
  };
  document.querySelector("#ambientControl").oninput = (e) => {
    state.ambient = Number(e.target.value);
    document.querySelector("#ambientValue").textContent =
      state.ambient.toFixed(2);
  };
  document.querySelector("#shininessControl").oninput = (e) => {
    state.shininess = Number(e.target.value);
    document.querySelector("#shininessValue").textContent = state.shininess;
  };
  ["X", "Y", "Z"].forEach(
    (axis) =>
      (document.querySelector(`#light${axis}Control`).oninput = (e) => {
        state.light[axis === "X" ? 0 : axis === "Y" ? 1 : 2] = Number(
          e.target.value,
        );
      }),
  );
  ["X", "Y", "Z"].forEach(
    (axis) =>
      (document.querySelector(`#scale${axis}Control`).oninput = (e) => {
        state.scale[axis === "X" ? 0 : axis === "Y" ? 1 : 2] = Number(
          e.target.value,
        );
      }),
  );
  document.querySelector("#flatButton").onclick = () => {
    state.flat = !state.flat;
  };
  document.querySelector("#textureButton").onclick = () => {
    state.texture = !state.texture;
  };
  document.querySelector("#lightOrbitButton").onclick = () => {
    state.lightOrbit = !state.lightOrbit;
  };
  document.querySelector("#cameraOrbitButton").onclick = () => {
    state.cameraOrbit = !state.cameraOrbit;
  };
  document.querySelector("#textureSource").onchange = (e) => {
    state.textureSource = e.target.value;
    updateTextureState();
  };
  document.querySelector("#filterSelect").onchange = (e) => {
    state.filter = e.target.value;
    updateTextureState();
  };
  document.querySelector("#wrapSelect").onchange = (e) => {
    state.wrap = e.target.value;
    updateTextureState();
  };
  ["ambient", "diffuse", "specular"].forEach(
    (name) =>
      (document.querySelector(`#${name}Toggle`).onchange = (e) => {
        state.components[name] = e.target.checked;
      }),
  );
  document.querySelector("#resetButton").onclick = reset;
}
window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
    event.preventDefault();
  state.keys[key] = true;
  if (event.repeat) return;
  if (key === "r") reset();
  if (key === "f") state.flat = !state.flat;
  if (key === "t") state.texture = !state.texture;
  if (key === "l") state.lightOrbit = !state.lightOrbit;
  if (key === "p") state.cubeRotation = !state.cubeRotation;
});
window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  state.keys[key] = false;
});

// Setup canvas size based on container
function resizeCanvas() {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let lastTime = 0;
function render(time) {
  const dt = Math.min((time - lastTime) * 0.001, 0.05);
  lastTime = time;
  state.time += dt;
  if (state.cubeRotation) state.cubeTime += dt;
  updateCamera(dt);
  draw();
  requestAnimationFrame(render);
}
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);
bindControls();
updateTextureState();
draw();
requestAnimationFrame(render);
