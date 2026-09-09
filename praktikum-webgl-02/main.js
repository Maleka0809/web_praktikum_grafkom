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
    -0.15, -0.15, 1.0, 0.0, 0.0, // Kiri Bawah - Merah
    0.15, -0.15, 0.0, 1.0, 0.0, // Kanan Bawah - Hijau
    0.00, 0.15, 0.0, 0.0, 1.0, // Atas - Biru

    // --- Primitive 2: Persegi Statis (Index 3-6) ---
    // Mode: gl.TRIANGLE_STRIP
    -0.8, 0.8, 1.0, 1.0, 0.0, // Kiri Atas - Kuning
    -0.8, 0.5, 1.0, 0.5, 0.0, // Kiri Bawah - Oranye
    -0.5, 0.8, 1.0, 0.0, 1.0, // Kanan Atas - Magenta
    -0.5, 0.5, 0.0, 1.0, 1.0, // Kanan Bawah - Cyan

    // --- Primitive 3: Segi Lima Garis Statis (Index 7-11) ---
    // Mode: gl.LINE_LOOP
    0.65, 0.8, 1.0, 1.0, 1.0, // Putih
    0.8, 0.6, 0.8, 0.8, 0.8, // Abu-abu
    0.7, 0.4, 0.5, 0.5, 0.5,
    0.5, 0.4, 0.5, 0.5, 0.5,
    0.4, 0.6, 0.8, 0.8, 0.8,

    // --- Primitive 4: Diamond (Index 12-15) ---
    // Mode: gl.TRIANGLE_FAN
    0.0, 0.6, 1.0, 0.5, 0.5, // Atas
    -0.2, 0.4, 0.5, 1.0, 0.5, // Kiri
    0.0, 0.2, 0.5, 0.5, 1.0, // Bawah
    0.2, 0.4, 1.0, 1.0, 0.0, // Kanan
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
let scaleNewObj = 1.0;
const moveSpeed = 0.02;

// --- Rotasi Bertahap: +45° → -90° → +90° → (ulang) ---
const rotationSequence = [45, -45, -45, 45]; // urutan delta rotasi (derajat)
let seqIndex = 0;       // indeks langkah saat ini
let currentAngle = 0;       // sudut aktual (radian)
let targetAngle = 0;       // sudut target (radian)
let isRotating = false;   // sedang beranimasi?
let isPaused = false;   // sedang jeda antar langkah?
let lastPauseTime = 0;
const PAUSE_MS = 400;     // jeda (ms) sebelum langkah berikutnya
const LERP_SPEED = 0.07;    // kecepatan interpolasi (0–1, lebih besar = lebih cepat)
let speedMultiplier = 1.0;

document.getElementById("btnSpeedUp").addEventListener("click", () => {
    speedMultiplier *= 1.5;
});

document.getElementById("btnSlowDown").addEventListener("click", () => {
    speedMultiplier /= 1.5;
});

function toRad(deg) { return deg * Math.PI / 180; }

/** Mulai rotasi ke langkah berikutnya dalam urutan */
function startNextRotation() {
    targetAngle += toRad(rotationSequence[seqIndex]);
    seqIndex = (seqIndex + 1) % rotationSequence.length;
    isRotating = true;
}

/** Dipanggil tiap frame untuk mengupdate sudut rotasi */
function updateRotation(timestamp) {
    if (isPaused) {
        // Tunggu jeda selesai, lalu mulai rotasi berikutnya
        if (timestamp - lastPauseTime >= (PAUSE_MS / speedMultiplier)) {
            isPaused = false;
            startNextRotation();
        }
        return;
    }

    if (isRotating) {
        // Lerp: dekati targetAngle secara halus
        currentAngle += (targetAngle - currentAngle) * Math.min(1.0, LERP_SPEED * speedMultiplier);

        // Jika sudah sangat dekat ke target → snap & masuk jeda
        if (Math.abs(targetAngle - currentAngle) < 0.001) {
            currentAngle = targetAngle;
            isRotating = false;
            isPaused = true;
            lastPauseTime = timestamp;
        }
    }
}

// Mulai langkah pertama saat halaman dimuat
startNextRotation();

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
    let nextOffsetX = offsetX;
    let nextOffsetY = offsetY;

    if (keys["ArrowLeft"]) nextOffsetX -= moveSpeed;
    if (keys["ArrowRight"]) nextOffsetX += moveSpeed;
    if (keys["ArrowUp"]) nextOffsetY += moveSpeed;
    if (keys["ArrowDown"]) nextOffsetY -= moveSpeed;

    if (keys["w"] || keys["W"]) scaleNewObj += 0.02;
    if (keys["s"] || keys["S"]) scaleNewObj = Math.max(0.1, scaleNewObj - 0.02);

    // Fungsi untuk mengecek apakah dengan offset baru, ada titik yang keluar canvas (-1.0 sampai 1.0)
    function checkOutOfBounds(testOffsetX, testOffsetY) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        function checkShape(startIndex, vertexCount, scale = 1.0) {
            let cx = 0, cy = 0;
            for (let i = 0; i < vertexCount; i++) {
                const offset = (startIndex + i) * 5;
                cx += baseVertices[offset];
                cy += baseVertices[offset + 1];
            }
            cx /= vertexCount;
            cy /= vertexCount;

            const cosA = Math.cos(currentAngle);
            const sinA = Math.sin(currentAngle);

            for (let i = 0; i < vertexCount; i++) {
                const offset = (startIndex + i) * 5;
                const lx = (baseVertices[offset] - cx) * scale;
                const ly = (baseVertices[offset + 1] - cy) * scale;

                const x = (lx * cosA - ly * sinA) + cx + testOffsetX;
                const y = (lx * sinA + ly * cosA) + cy + testOffsetY;

                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        // Cek semua primitive agar tidak keluar batas
        checkShape(0, 3);
        checkShape(3, 4);
        checkShape(7, 5);
        checkShape(12, 4, scaleNewObj);

        // Pisahkan pengecekan sumbu X dan Y agar tidak saling mengunci
        return {
            outX: minX < -1.0 || maxX > 1.0,
            outY: minY < -1.0 || maxY > 1.0
        };
    }

    // Terapkan offset X jika tidak menabrak batas, ATAU pergerakan tersebut mundur ke arah tengah
    const boundsX = checkOutOfBounds(nextOffsetX, offsetY);
    if (!boundsX.outX || Math.abs(nextOffsetX) < Math.abs(offsetX)) {
        offsetX = nextOffsetX;
    }

    // Terapkan offset Y jika tidak menabrak batas, ATAU pergerakan tersebut mundur ke arah tengah
    const boundsY = checkOutOfBounds(offsetX, nextOffsetY);
    if (!boundsY.outY || Math.abs(nextOffsetY) < Math.abs(offsetY)) {
        offsetY = nextOffsetY;
    }
}

function updateBufferData() {
    const updatedVertices = new Float32Array(baseVertices);

    // Fungsi bantuan (helper) untuk menghitung rotasi tiap objek
    function rotateShape(startIndex, vertexCount, offsetX_shape = 0, offsetY_shape = 0, scale = 1.0) {
        let cx = 0;
        let cy = 0;

        // 1. Cari titik tengah (centroid) khusus untuk objek ini
        for (let i = 0; i < vertexCount; i++) {
            const offset = (startIndex + i) * 5;
            cx += baseVertices[offset];
            cy += baseVertices[offset + 1];
        }
        cx /= vertexCount;
        cy /= vertexCount;

        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);

        // 2. Putar setiap titik pada objek ini di porosnya
        for (let i = 0; i < vertexCount; i++) {
            const offset = (startIndex + i) * 5;
            const lx = (baseVertices[offset] - cx) * scale;
            const ly = (baseVertices[offset + 1] - cy) * scale;

            updatedVertices[offset] = (lx * cosA - ly * sinA) + cx + offsetX_shape;
            updatedVertices[offset + 1] = (lx * sinA + ly * cosA) + cy + offsetY_shape;
        }
    }

    // --- Terapkan fungsi rotasi ke semua objek ---

    // Primitive 1: Segitiga (Mulai dari vertex ke-0, sebanyak 3 titik)
    // (Segitiga ditambahkan kontrol arah panah keyboard)
    rotateShape(0, 3, offsetX, offsetY);

    // Primitive 2: Persegi (Mulai dari vertex ke-3, sebanyak 4 titik)
    rotateShape(3, 4, offsetX, offsetY);

    // Primitive 3: Segi Lima Garis (Mulai dari vertex ke-7, sebanyak 5 titik)
    rotateShape(7, 5, offsetX, offsetY);

    // Primitive 4: Diamond (Mulai dari vertex ke-12, sebanyak 4 titik)
    rotateShape(12, 4, offsetX, offsetY, scaleNewObj);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, updatedVertices, gl.DYNAMIC_DRAW);
}

// 4. Main Render Loop
let lastFrameTime = 0;
let frameCount = 0;
let currentFps = 0;

function render(timestamp) {
    // Menghitung FPS
    if (lastFrameTime === 0) lastFrameTime = timestamp;
    frameCount++;
    const elapsed = timestamp - lastFrameTime;
    if (elapsed >= 1000) {
        currentFps = Math.round((frameCount * 1000) / elapsed);
        document.getElementById("fpsDisplay").innerText = currentFps;
        frameCount = 0;
        lastFrameTime = timestamp;
    }

    // Update teks kecepatan rotasi
    document.getElementById("speedDisplay").innerText = speedMultiplier.toFixed(2) + "x";

    // Menghitung ukuran piksel objek ke-4 (Diamond)
    // Lebar dan tinggi objek diamond di koordinat WebGL (tanpa scale) adalah 0.4
    // Kanvas ukuran 800x600. Koordinat WebGL dari -1 ke 1 (total lebar 2.0).
    // Lebar piksel = (0.4 * scaleNewObj / 2.0) * 800 = 160 * scaleNewObj
    // Tinggi piksel = (0.4 * scaleNewObj / 2.0) * 600 = 120 * scaleNewObj
    const pixelWidth = Math.round(160 * scaleNewObj);
    const pixelHeight = Math.round(120 * scaleNewObj);
    document.getElementById("scaleDisplay").innerText = `~ (${pixelWidth}x${pixelHeight} px)`;

    updateKeyboard();
    updateRotation(timestamp);  // update sudut rotasi bertahap
    updateBufferData();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.03, 0.05, 0.10, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render Primitive 1: Segitiga Bergerak & Berputar (3 Vertex)
    // Mode Draw: TRIANGLES
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Render Primitive 2: Persegi Statis (4 Vertex)
    // Mode Draw: TRIANGLE_STRIP
    gl.drawArrays(gl.TRIANGLE_STRIP, 3, 4);

    // Render Primitive 3: Segi Lima Garis Statis (5 Vertex)
    // Mode Draw: LINE_LOOP
    gl.drawArrays(gl.LINE_LOOP, 7, 5);

    // Render Primitive 4: Diamond berputar & bisa di scale (4 Vertex)
    // Mode Draw: TRIANGLE_FAN
    gl.drawArrays(gl.TRIANGLE_FAN, 12, 4);

    requestAnimationFrame(render);
}

// Mulai rendering
render();