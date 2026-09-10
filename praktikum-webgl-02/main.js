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
    gl_PointSize = 8.0; // Membesarkan point agar mode POINTS terlihat
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
    // Mode Default: gl.TRIANGLES
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

// --- Challenge E: Procedural Grid ---
const gridVertices = [];
for (let i = -1.0; i <= 1.0; i += 0.1) {
    gridVertices.push(i, -1.0, 0.2, 0.2, 0.2,  i, 1.0, 0.2, 0.2, 0.2); // garis vertikal
    gridVertices.push(-1.0, i, 0.2, 0.2, 0.2,  1.0, i, 0.2, 0.2, 0.2); // garis horizontal
}

// --- Challenge C: Spawned Primitives ---
let spawnedVertices = [];
let spawnedCount = 0;

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

// --- Animasi Bouncing ---
let speedMultiplier = 1.0;

// --- State Tambahan Challenge ---
let isPaused = false;
let showGrid = true;
let mainDrawMode = gl.TRIANGLES;
let activeColor = [1.0, 0.0, 0.0];
let mouseNDC = {x: 0, y: 0};

// Event Listeners UI
document.getElementById("btnSpeedUp").addEventListener("click", () => speedMultiplier *= 1.5);
document.getElementById("btnSlowDown").addEventListener("click", () => speedMultiplier /= 1.5);
document.getElementById("btnClearSpawned").addEventListener("click", () => {
    spawnedVertices = [];
    spawnedCount = 0;
});
document.getElementById("toggleGrid").addEventListener("change", (e) => showGrid = e.target.checked);

document.getElementById("primitiveSelector").addEventListener("change", (e) => {
    mainDrawMode = gl[e.target.value];
    document.getElementById("drawModeDisplay").innerText = e.target.value;
});

// Selector & Warna (Challenge B)
function setMainColor(r, g, b) {
    activeColor = [r, g, b];
    // Update warna di dalam baseVertices untuk Primitive 1 (index 0, 1, 2)
    for(let i = 0; i < 3; i++) {
        baseVertices[i*5 + 2] = r;
        baseVertices[i*5 + 3] = g;
        baseVertices[i*5 + 4] = b;
    }
}

document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let color = e.target.getAttribute('data-color');
        if (color === 'random') {
            setMainColor(Math.random(), Math.random(), Math.random());
        } else {
            let [r, g, b] = color.split(',').map(Number);
            setMainColor(r, g, b);
        }
    });
});

// State pergerakan memantul untuk ke-4 objek asli kamu
const movingObjects = [
    { posX: 0, posY: 0, vx: 0.005, vy: 0.003 },   // Primitive 1: Segitiga
    { posX: 0, posY: 0, vx: -0.004, vy: 0.006 },  // Primitive 2: Persegi
    { posX: 0, posY: 0, vx: 0.006, vy: -0.005 },  // Primitive 3: Segi Lima
    { posX: 0, posY: 0, vx: -0.005, vy: -0.004 }  // Primitive 4: Diamond
];

window.addEventListener("keydown", (event) => {
    const controlledKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (controlledKeys.includes(event.key)) {
        event.preventDefault();
    }
    keys[event.key] = true;

    // Tekan 'r' atau 'R' untuk reset posisi
    if (event.key.toLowerCase() === "r" && !event.repeat) {
        offsetX = 0.0;
        offsetY = 0.0;
        movingObjects.forEach(obj => {
            obj.posX = 0;
            obj.posY = 0;
        });
        spawnedVertices = [];
        spawnedCount = 0;
    }
    // Tekan 'p' untuk pause (Challenge)
    if (event.key.toLowerCase() === "p" && !event.repeat) {
        isPaused = !isPaused;
    }
    // Tekan 'c' untuk ganti warna random (Challenge)
    if (event.key.toLowerCase() === "c" && !event.repeat) {
        setMainColor(Math.random(), Math.random(), Math.random());
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

// Mouse Event (Challenge F & C)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / canvas.width) * 2 - 1;
    mouseNDC.y = 1 - ((e.clientY - rect.top) / canvas.height) * 2;
    document.getElementById('mouseNdcDisplay').innerText = \`\${mouseNDC.x.toFixed(2)}, \${mouseNDC.y.toFixed(2)}\`;
});

canvas.addEventListener('click', () => {
    // Spawn objek baru berdasarkan draw mode aktif (triangle = 3 vertex) di posisi NDC
    let r = activeColor[0], g = activeColor[1], b = activeColor[2];
    let cx = mouseNDC.x, cy = mouseNDC.y;
    let s = 0.15 * scaleNewObj; 
    
    // Asumsi selalu spawn 3 titik (triangle/point/line)
    spawnedVertices.push(
        cx - s, cy - s, r, g, b,
        cx + s, cy - s, r, g, b,
        cx, cy + s, r, g, b
    );
    spawnedCount++;
});


function updateKeyboard() {
    if (keys["ArrowLeft"]) offsetX -= moveSpeed;
    if (keys["ArrowRight"]) offsetX += moveSpeed;
    if (keys["ArrowUp"]) offsetY += moveSpeed;
    if (keys["ArrowDown"]) offsetY -= moveSpeed;

    if (keys["w"] || keys["W"]) scaleNewObj += 0.02;
    if (keys["s"] || keys["S"]) scaleNewObj = Math.max(0.1, scaleNewObj - 0.02);
}

function updateBouncing() {
    if (isPaused) return;

    movingObjects.forEach((obj, objIndex) => {
        obj.posX += obj.vx * speedMultiplier;
        obj.posY += obj.vy * speedMultiplier;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let startIndex = 0, vertexCount = 0, scale = 1.0;
        
        if (objIndex === 0) { startIndex = 0; vertexCount = 3; }
        else if (objIndex === 1) { startIndex = 3; vertexCount = 4; }
        else if (objIndex === 2) { startIndex = 7; vertexCount = 5; }
        else if (objIndex === 3) { startIndex = 12; vertexCount = 4; scale = scaleNewObj; }
        
        let cx = 0, cy = 0;
        for (let i = 0; i < vertexCount; i++) {
            const offset = (startIndex + i) * 5;
            cx += baseVertices[offset];
            cy += baseVertices[offset + 1];
        }
        cx /= vertexCount;
        cy /= vertexCount;

        for (let i = 0; i < vertexCount; i++) {
            const offset = (startIndex + i) * 5;
            const lx = (baseVertices[offset] - cx) * scale;
            const ly = (baseVertices[offset + 1] - cy) * scale;
            
            const x = cx + lx + obj.posX + offsetX;
            const y = cy + ly + obj.posY + offsetY;
            
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        // Pantulan (Bouncing)
        if (minX < -1.0) { obj.posX += (-1.0 - minX); obj.vx = Math.abs(obj.vx); }
        if (maxX > 1.0) { obj.posX -= (maxX - 1.0); obj.vx = -Math.abs(obj.vx); }
        if (minY < -1.0) { obj.posY += (-1.0 - minY); obj.vy = Math.abs(obj.vy); }
        if (maxY > 1.0) { obj.posY -= (maxY - 1.0); obj.vy = -Math.abs(obj.vy); }
    });
}

function updateBufferData() {
    const updatedVertices = new Float32Array(baseVertices);

    function transformShape(startIndex, vertexCount, objIndex, scale = 1.0) {
        let cx = 0, cy = 0;
        for (let i = 0; i < vertexCount; i++) {
            const offset = (startIndex + i) * 5;
            cx += baseVertices[offset];
            cy += baseVertices[offset + 1];
        }
        cx /= vertexCount;
        cy /= vertexCount;

        const obj = movingObjects[objIndex];

        for (let i = 0; i < vertexCount; i++) {
            const offset = (startIndex + i) * 5;
            const lx = (baseVertices[offset] - cx) * scale;
            const ly = (baseVertices[offset + 1] - cy) * scale;

            updatedVertices[offset] = cx + lx + obj.posX + offsetX;
            updatedVertices[offset + 1] = cy + ly + obj.posY + offsetY;
        }
    }

    transformShape(0, 3, 0);
    transformShape(3, 4, 1);
    transformShape(7, 5, 2);
    transformShape(12, 4, 3, scaleNewObj);

    // --- Menggabungkan Grid, Objek Utama, dan Objek Spawned ke satu Buffer ---
    let finalArray = [];
    if (showGrid) finalArray.push(...gridVertices);
    finalArray.push(...updatedVertices);
    if (spawnedCount > 0) finalArray.push(...spawnedVertices);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(finalArray), gl.DYNAMIC_DRAW);
    
    // Update jumlah primitive di layar
    document.getElementById('primitiveCountDisplay').innerText = \`\${4 + spawnedCount} Obj\`;
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

    document.getElementById("speedDisplay").innerText = speedMultiplier.toFixed(2) + "x";

    updateKeyboard();
    updateBouncing();
    updateBufferData();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.03, 0.05, 0.10, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let offset = 0;
    
    // 1. Draw Grid
    if (showGrid) {
        const count = gridVertices.length / 5;
        gl.drawArrays(gl.LINES, offset, count);
        offset += count;
    }

    // 2. Draw Primitive 1: Segitiga Bergerak (Bentuk bisa diubah lewat UI)
    gl.drawArrays(mainDrawMode, offset, 3);
    offset += 3;

    // 3. Draw Primitive 2: Persegi Statis
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, 4);
    offset += 4;

    // 4. Draw Primitive 3: Segi Lima Garis Statis
    gl.drawArrays(gl.LINE_LOOP, offset, 5);
    offset += 5;

    // 5. Draw Primitive 4: Diamond
    gl.drawArrays(gl.TRIANGLE_FAN, offset, 4);
    offset += 4;
    
    // 6. Draw Spawned Objects (Jika ada)
    if (spawnedCount > 0) {
        gl.drawArrays(mainDrawMode, offset, spawnedCount * 3);
    }

    requestAnimationFrame(render);
}

// Mulai rendering
render();