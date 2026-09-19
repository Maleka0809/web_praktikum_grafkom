// --- UI Elements ---
const canvas = document.getElementById("canvas");
const wrapper = canvas.parentElement;

const valPosA = document.getElementById("valPosA");
const valRotA = document.getElementById("valRotA");
const valScaleA = document.getElementById("valScaleA");
const valOrder = document.getElementById("valOrder");
const valDt = document.getElementById("valDt");
const valMat = document.getElementById("valMat");

const tSpeedSlider = document.getElementById("tSpeed");
const rSpeedSlider = document.getElementById("rSpeed");
const sSpeedSlider = document.getElementById("sSpeed");
const lblTSpeed = document.getElementById("lblTSpeed");
const lblRSpeed = document.getElementById("lblRSpeed");
const lblSSpeed = document.getElementById("lblSSpeed");

const chkAutoB = document.getElementById("chkAutoB");
const chkAxes = document.getElementById("chkAxes");
const chkPivot = document.getElementById("chkPivot");
const chkParent = document.getElementById("chkParent");

const btnPause = document.getElementById("btnPause");
const btnReset = document.getElementById("btnReset");
const btnOrder = document.getElementById("btnOrder");
const btnOrbit = document.getElementById("btnOrbit");

const chkShowA = document.getElementById("chkShowA");
const chkShowB = document.getElementById("chkShowB");
const chkShowC = document.getElementById("chkShowC");

// --- WebGL Setup ---
let gl = canvas.getContext("webgl2");

function resizeCanvas() {
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
}

const ro = new ResizeObserver(resizeCanvas);
ro.observe(wrapper);
resizeCanvas();

const vsSource = `#version 300 es
  in vec2 aPosition;
  uniform mat3 uModelMatrix;
  void main() {
    vec3 pos = uModelMatrix * vec3(aPosition, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
  }
`;

const fsSource = `#version 300 es
  precision mediump float;
  uniform vec4 uColor;
  out vec4 fragColor;
  void main() {
    fragColor = uColor;
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    document.body.innerHTML += '<div style="color:red; position:absolute; top:10px; left:10px; z-index:9999; background:black; padding:10px;">Shader error: ' + info + '</div>';
    console.error('Shader compile error:', info);
  }
  return shader;
}

const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, createShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(shaderProgram, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(shaderProgram);
if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
  const info = gl.getProgramInfoLog(shaderProgram);
  document.body.innerHTML += '<div style="color:red; position:absolute; top:50px; left:10px; z-index:9999; background:black; padding:10px;">Program error: ' + info + '</div>';
}
gl.useProgram(shaderProgram);

const aPosition = gl.getAttribLocation(shaderProgram, "aPosition");
const uModelMatrix = gl.getUniformLocation(shaderProgram, "uModelMatrix");
const uColor = gl.getUniformLocation(shaderProgram, "uColor");

gl.enableVertexAttribArray(aPosition);

// --- Buffers & VAOs ---
const squareVertices = new Float32Array([
  -0.15, 0.15,
  -0.15, -0.15,
  0.15, 0.15,
  0.15, -0.15
]);
const squareBuffer = gl.createBuffer();
const vaoSquare = gl.createVertexArray();
gl.bindVertexArray(vaoSquare);
gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.STATIC_DRAW);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aPosition);

const axesVertices = new Float32Array([
  -2.0, 0.0, 2.0, 0.0,
  0.0, -2.0, 0.0, 2.0
]);
const axesBuffer = gl.createBuffer();
const vaoAxes = gl.createVertexArray();
gl.bindVertexArray(vaoAxes);
gl.bindBuffer(gl.ARRAY_BUFFER, axesBuffer);
gl.bufferData(gl.ARRAY_BUFFER, axesVertices, gl.STATIC_DRAW);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aPosition);

const pivotVertices = new Float32Array([
  -0.04, 0.0, 0.04, 0.0,
  0.0, -0.04, 0.0, 0.04
]);
const pivotBuffer = gl.createBuffer();
const vaoPivot = gl.createVertexArray();
gl.bindVertexArray(vaoPivot);
gl.bindBuffer(gl.ARRAY_BUFFER, pivotBuffer);
gl.bufferData(gl.ARRAY_BUFFER, pivotVertices, gl.STATIC_DRAW);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aPosition);

gl.bindVertexArray(null);


// --- State ---
let objA = { x: -0.38, y: 0.0, r: 0.0, sx: 1.0, sy: 1.0, color: [1.0, 1.0, 1.0, 1.0] };
let objB = { x: 0.4, y: 0.0, r: 0.0, sx: 0.5, sy: 0.5, color: [0.98, 0.82, 0.28, 1.0] }; // Child
let objC = { x: 0.4, y: 0.1, r: 0.0, sx: 0.8, sy: 0.8, color: [0.9, 0.4, 0.3, 1.0] }; // Auto rotate

let orderTRS = true;
let isPaused = false;
let orbitDirection = 1;

let keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// UI Events
tSpeedSlider.oninput = () => lblTSpeed.textContent = parseFloat(tSpeedSlider.value).toFixed(2);
rSpeedSlider.oninput = () => lblRSpeed.textContent = rSpeedSlider.value + "°/s";
sSpeedSlider.oninput = () => lblSSpeed.textContent = parseFloat(sSpeedSlider.value).toFixed(2);

btnPause.onclick = () => { isPaused = !isPaused; btnPause.textContent = isPaused ? "Resume (P)" : "Pause (P)"; };
btnReset.onclick = () => {
  objA = { x: -0.38, y: 0.0, r: 0.0, sx: 1.0, sy: 1.0, color: [1.0, 1.0, 1.0, 1.0] };
  objB = { x: 0.4, y: 0.0, r: 0.0, sx: 0.5, sy: 0.5, color: [0.98, 0.82, 0.28, 1.0] };
  objC.r = 0;
};
btnOrder.onclick = () => { orderTRS = !orderTRS; valOrder.textContent = orderTRS ? "TRS" : "RTS"; };
btnOrbit.onclick = () => { orbitDirection *= -1; };

window.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === 'p') btnPause.onclick();
  if (e.key.toLowerCase() === 'r') btnReset.onclick();
  if (e.key.toLowerCase() === 't') btnOrder.onclick();
  if (e.key.toLowerCase() === 'o') btnOrbit.onclick();

  // Challenge B: Presets
  if (e.key === '1') {
    objA = { x: -0.4, y: 0.2, r: 0.0, sx: 1.0, sy: 1.0, color: objA.color };
  }
  if (e.key === '2') {
    objA = { x: 0.0, y: 0.0, r: 45 * Math.PI / 180, sx: 1.5, sy: 1.5, color: objA.color };
  }
  if (e.key === '3') {
    objA = { x: 0.3, y: -0.2, r: 90 * Math.PI / 180, sx: 1.8, sy: 0.6, color: objA.color };
  }
});

let isDragging = false;
canvas.addEventListener('mousedown', () => isDragging = true);
canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height * 2 - 1);
  objA.x = x;
  objA.y = y;
});


// --- Math ---
function multiply3x3(a, b) {
  let out = new Array(9);
  out[0] = b[0] * a[0] + b[1] * a[3] + b[2] * a[6]; out[1] = b[0] * a[1] + b[1] * a[4] + b[2] * a[7]; out[2] = b[0] * a[2] + b[1] * a[5] + b[2] * a[8];
  out[3] = b[3] * a[0] + b[4] * a[3] + b[5] * a[6]; out[4] = b[3] * a[1] + b[4] * a[4] + b[5] * a[7]; out[5] = b[3] * a[2] + b[4] * a[5] + b[5] * a[8];
  out[6] = b[6] * a[0] + b[7] * a[3] + b[8] * a[6]; out[7] = b[6] * a[1] + b[7] * a[4] + b[8] * a[7]; out[8] = b[6] * a[2] + b[7] * a[5] + b[8] * a[8];
  return out;
}

function getMatrix(x, y, r, sx, sy, isTRS) {
  let t = [1, 0, 0, 0, 1, 0, x, y, 1];
  let c = Math.cos(r), s = Math.sin(r);
  let rot = [c, s, 0, -s, c, 0, 0, 0, 1];
  let sc = [sx, 0, 0, 0, sy, 0, 0, 0, 1];

  let mat;
  if (isTRS) {
    mat = multiply3x3(rot, sc);
    mat = multiply3x3(t, mat);
  } else {
    mat = multiply3x3(t, sc);
    mat = multiply3x3(rot, mat);
  }
  return mat;
}


// --- Render ---
let lastTime = performance.now();

function render(time) {
  let dt = (time - lastTime) / 1000;
  lastTime = time;

  if (!isPaused) {
    valDt.textContent = (dt * 1000).toFixed(0) + "ms";

    // Inputs
    let tSpd = parseFloat(tSpeedSlider.value);
    let rSpd = parseFloat(rSpeedSlider.value) * Math.PI / 180;
    let sSpd = parseFloat(sSpeedSlider.value);

    if (keys["w"] || keys["arrowup"]) objA.y += tSpd * dt;
    if (keys["s"] || keys["arrowdown"]) objA.y -= tSpd * dt;
    if (keys["a"] || keys["arrowleft"]) objA.x -= tSpd * dt;
    if (keys["d"] || keys["arrowright"]) objA.x += tSpd * dt;
    if (keys["q"]) objA.r += rSpd * dt;
    if (keys["e"]) objA.r -= rSpd * dt;

    if (keys["="]) { objA.sx += sSpd * dt; objA.sy += sSpd * dt; }
    if (keys["-"]) { objA.sx -= sSpd * dt; objA.sy -= sSpd * dt; }
    if (keys["z"]) { objA.sx -= sSpd * dt; }
    if (keys["x"]) { objA.sx += sSpd * dt; }
    if (keys["c"]) { objA.sy -= sSpd * dt; }
    if (keys["v"]) { objA.sy += sSpd * dt; }

    // Rotasi kontinu (Rotation)
    // rSpd diambil dari slider Rotasi di UI
    objC.r += rSpd * dt * 0.3;

    // Membesar dan mengecil secara smooth (Scaling pulse)
    // sSpd diambil dari slider Skala di UI untuk mengatur kecepatan denyut
    let pulse = 0.8 + Math.sin((time * sSpd) / 800) * 0.25;
    objC.sx = pulse;
    objC.sy = pulse;

    // Auto Object B (Orbit/Rotate)
    if (chkAutoB.checked) {
      objB.r += rSpd * dt * orbitDirection;
    }
  }

  // Update Stats UI
  valPosA.textContent = '(' + objA.x.toFixed(2) + ', ' + objA.y.toFixed(2) + ')';
  valRotA.textContent = (objA.r * 180 / Math.PI % 360).toFixed(1) + String.fromCharCode(176);
  valScaleA.textContent = '(' + objA.sx.toFixed(2) + ', ' + objA.sy.toFixed(2) + ')';

  gl.clearColor(0.03, 0.05, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  let idMat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // Draw Axes
  if (chkAxes.checked) {
    gl.bindVertexArray(vaoAxes);
    gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(idMat));
    gl.uniform4f(uColor, 1.0, 1.0, 1.0, 0.15);
    gl.drawArrays(gl.LINES, 0, 4);
  }

  // Calculate Matrices
  let matA = getMatrix(objA.x, objA.y, objA.r, objA.sx, objA.sy, orderTRS);
  let matB_local = getMatrix(objB.x, objB.y, objB.r, objB.sx, objB.sy, orderTRS);

  let matB;
  if (chkParent.checked) {
    matB = multiply3x3(matA, matB_local);
  } else {
    matB = matB_local;
  }

  let matC = getMatrix(objC.x, objC.y, objC.r, objC.sx, objC.sy, orderTRS);

  // Update Matrix String for UI (Matrix A)
  valMat.innerHTML =
    '[' + matA[0].toFixed(2) + ' ' + matA[3].toFixed(2) + ' ' + matA[6].toFixed(2) + ']<br>' +
    '[' + matA[1].toFixed(2) + ' ' + matA[4].toFixed(2) + ' ' + matA[7].toFixed(2) + ']<br>' +
    '[' + matA[2].toFixed(2) + ' ' + matA[5].toFixed(2) + ' ' + matA[8].toFixed(2) + ']';

  // Draw Squares
  gl.bindVertexArray(vaoSquare);

  // Object A
  if (chkShowA.checked) {
    gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(matA));
    gl.uniform4fv(uColor, objA.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Object B
  if (chkShowB.checked) {
    gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(matB));
    gl.uniform4fv(uColor, objB.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Object C
  if (chkShowC.checked) {
    gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(matC));
    gl.uniform4fv(uColor, objC.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Draw Pivot Markers
  if (chkPivot.checked) {
    gl.bindVertexArray(vaoPivot);
    if (chkShowA.checked) {
      gl.uniform4f(uColor, 0.0, 1.0, 0.0, 1.0);
      gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(matA));
      gl.drawArrays(gl.LINES, 0, 4);
    }
    if (chkShowB.checked) {
      gl.uniform4f(uColor, 0.0, 1.0, 1.0, 1.0);
      gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(matB));
      gl.drawArrays(gl.LINES, 0, 4);
    }
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);