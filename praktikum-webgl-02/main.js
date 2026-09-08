const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
    throw new Error("WebGL2 tidak tersedia");
}

// 1. Shaders (Dengan Vertex Color)
const vertexShaderSource = `#version 300 es
in vec2 a_position;
in vec3 a_color;

out vec3 v_color;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_color = a_color;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_color;
out vec4 outColor;

void main() {
    outColor = vec4(v_color, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

// 2. Data Geometri & Warna (3 Primitives: Segitiga, Persegi, Segi Lima Garis)
// Format per vertex: X, Y, R, G, B
const baseVertices = new Float32Array([
    // --- Primitive 1: Segitiga Bergerak (Index 0-2) ---
    // Mode: gl.TRIANGLES
    -0.15, -0.15,   1.0, 0.0, 0.0, // Kiri Bawah - Merah
     0.15, -0.15,   0.0, 1.0, 0.0, // Kanan Bawah - Hijau
     0.00,  0.15,   0.0, 0.0, 1.0, // Atas - Biru

    // --- Primitive 2: Persegi Statis (Index 3-6) ---
    // Mode: gl.TRIANGLE_STRIP
    -0.8,  0.8,     1.0, 1.0, 0.0, // Kiri Atas - Kuning
    -0.8,  0.5,     1.0, 0.5, 0.0, // Kiri Bawah - Oranye
    -0.5,  0.8,     1.0, 0.0, 1.0, // Kanan Atas - Magenta
    -0.5,  0.5,     0.0, 1.0, 1.0, // Kanan Bawah - Cyan

    // --- Primitive 3: Segi Lima Garis Statis (Index 7-11) ---
    // Mode: gl.LINE_LOOP
     0.65,  0.8,    1.0, 1.0, 1.0, // Putih
     0.8,   0.6,    0.8, 0.8, 0.8, // Abu-abu
     0.7,   0.4,    0.5, 0.5, 0.5, 
     0.5,   0.4,    0.5, 0.5, 0.5,
     0.4,   0.6,    0.8, 0.8, 0.8,
]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

const stride = 5 * Float32Array.BYTES_PER_ELEMENT; // 5 nilai per vertex (x, y, r, g, b)

const positionLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);

const colorLocation = gl.getAttribLocation(program, "a_color");
gl.enableVertexAttribArray(colorLocation);
// Offset untuk warna adalah 2 (setelah x, y)
gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);


// 3. Interaksi (Menggerakkan Objek 1)
const keys = {};
let offsetX = 0.0;
let offsetY = 0.0;
const moveSpeed = 0.02;

window.addEventListener("keydown", (event) => {
    const controlledKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (controlledKeys.includes(event.key)) {
        event.preventDefault();
    }
    keys[event.key] = true;

    // Tekan 'r' atau 'R' untuk reset posisi segitiga
    if (event.key.toLowerCase() === "r" && !event.repeat) {
        offsetX = 0.0;
        offsetY = 0.0;
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

function updateKeyboard() {
    if (keys["ArrowLeft"]) offsetX -= moveSpeed;
    if (keys["ArrowRight"]) offsetX += moveSpeed;
    if (keys["ArrowUp"]) offsetY += moveSpeed;
    if (keys["ArrowDown"]) offsetY -= moveSpeed;
}

function updateBufferData() {
    const updatedVertices = new Float32Array(baseVertices);

    // Hanya update posisi X dan Y untuk Primitive 1 (3 vertex pertama)
    for (let i = 0; i < 3; i++) {
        const offset = i * 5; // Lompati 5 data (x, y, r, g, b) per vertex
        updatedVertices[offset] = baseVertices[offset] + offsetX;
        updatedVertices[offset + 1] = baseVertices[offset + 1] + offsetY;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, updatedVertices, gl.DYNAMIC_DRAW);
}

// 4. Main Render Loop
function render() {
    updateKeyboard();
    updateBufferData();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.03, 0.05, 0.10, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render Primitive 1: Segitiga Bergerak (3 Vertex)
    // Mode Draw: TRIANGLES
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Render Primitive 2: Persegi Statis (4 Vertex)
    // Mode Draw: TRIANGLE_STRIP
    gl.drawArrays(gl.TRIANGLE_STRIP, 3, 4);

    // Render Primitive 3: Segi Lima Garis Statis (5 Vertex)
    // Mode Draw: LINE_LOOP
    gl.drawArrays(gl.LINE_LOOP, 7, 5);

    requestAnimationFrame(render);
}

// Mulai rendering
render();