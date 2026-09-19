# Praktikum 03 — Transformasi & Sistem Koordinat

## Deskripsi

Praktikum ini mengeksplorasi konsep **transformasi 2D** (translasi, rotasi, skala) dan **sistem koordinat** (local/world coordinate) menggunakan **WebGL2**. Program menampilkan 3 objek persegi dengan hubungan **parent-child**, di mana transformasi objek induk akan mempengaruhi posisi/orientasi objek anak melalui perkalian matriks model.

**Demo langsung:** [GitHub Pages](https://maleka0809.github.io/web_praktikum_grafkom/praktikum_Transformasi_dan_Sistem_Koordinat_03/praktikum_03/index.html)

---

## Struktur File

```
praktikum_03/
├── index.html    → Struktur halaman dan elemen UI (canvas, sidebar, kontrol)
├── main.js       → Logika WebGL, shader, matriks transformasi, dan render loop
└── style.css     → Styling layout dan komponen UI
```

---

## 1. Inisialisasi WebGL2 dan Shader

### Membuat Context WebGL2

```js
let gl = canvas.getContext("webgl2");
```

Mengambil konteks rendering WebGL2 dari elemen `<canvas>`. WebGL2 merupakan versi terbaru yang mendukung fitur GLSL ES 3.00.

### Vertex Shader

```glsl
#version 300 es
in vec2 aPosition;
uniform mat3 uModelMatrix;
void main() {
    vec3 pos = uModelMatrix * vec3(aPosition, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
}
```

**Penjelasan:**
- `in vec2 aPosition` — menerima data posisi vertex (titik sudut) dari buffer.
- `uniform mat3 uModelMatrix` — matriks model 3×3 yang berisi hasil gabungan dari transformasi translasi, rotasi, dan skala.
- Posisi vertex dikalikan dengan `uModelMatrix` untuk menerapkan transformasi. Hasilnya dikonversi ke `vec4` untuk dikirim ke `gl_Position`.

### Fragment Shader

```glsl
#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
    fragColor = uColor;
}
```

**Penjelasan:**
- `uniform vec4 uColor` — warna objek yang dikirim dari JavaScript, berupa RGBA.
- `out vec4 fragColor` — output warna pixel ke layar (pengganti `gl_FragColor` di WebGL1).

### Kompilasi dan Linking Shader

```js
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    }
    return shader;
}

const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, createShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(shaderProgram, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);
```

**Penjelasan:**
- Shader dikompilasi satu per satu (vertex dan fragment), lalu di-link menjadi satu program shader.
- Dilengkapi pengecekan error kompilasi agar mudah debugging.

---

## 2. Vertex Buffer dan VAO (Vertex Array Object)

### Definisi Geometry Persegi

```js
const squareVertices = new Float32Array([
    -0.15,  0.15,   // Kiri atas
    -0.15, -0.15,   // Kiri bawah
     0.15,  0.15,   // Kanan atas
     0.15, -0.15    // Kanan bawah
]);
```

Keempat titik ini membentuk persegi dengan ukuran 0.3 × 0.3 unit di clip space. Digambar menggunakan `gl.TRIANGLE_STRIP` yang menghubungkan 4 titik menjadi 2 segitiga yang membentuk persegi.

### VAO (Vertex Array Object) — Wajib di WebGL2

```js
const vaoSquare = gl.createVertexArray();
gl.bindVertexArray(vaoSquare);
gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.STATIC_DRAW);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aPosition);
```

**Penjelasan:**
- **VAO** menyimpan konfigurasi vertex attribute agar tidak perlu diulang setiap kali menggambar.
- `vertexAttribPointer(aPosition, 2, ...)` menghubungkan data buffer ke atribut `aPosition` di vertex shader, dengan 2 komponen (x, y) per vertex.
- WebGL2 mewajibkan penggunaan VAO (berbeda dengan WebGL1 yang opsional).

### Garis Sumbu Koordinat dan Pivot Marker

```js
// Garis sumbu X dan Y
const axesVertices = new Float32Array([
    -2.0, 0.0,  2.0, 0.0,   // Garis horizontal (sumbu X)
     0.0,-2.0,  0.0, 2.0    // Garis vertikal (sumbu Y)
]);

// Pivot marker (tanda silang kecil di titik pusat objek)
const pivotVertices = new Float32Array([
    -0.04, 0.0, 0.04, 0.0,  // Garis horizontal kecil
     0.0, -0.04, 0.0, 0.04  // Garis vertikal kecil
]);
```

Masing-masing juga memiliki VAO tersendiri (`vaoAxes` dan `vaoPivot`).

---

## 3. State Objek (3 Objek Berbeda)

```js
let objA = { x: -0.38, y: 0.0, r: 0.0, sx: 1.0, sy: 1.0, color: [1.0, 1.0, 1.0, 1.0] };
let objB = { x: 0.4, y: 0.0, r: 0.0, sx: 0.5, sy: 0.5, color: [0.98, 0.82, 0.28, 1.0] };
let objC = { x: 0.4, y: 0.1, r: 0.0, sx: 0.8, sy: 0.8, color: [0.9, 0.4, 0.3, 1.0] };
```

| Objek | Warna | Peran | Deskripsi |
|-------|-------|-------|-----------|
| **A** | Putih | **Parent** | Objek utama, dikontrol melalui keyboard (WASD/Arrow) dan mouse drag |
| **B** | Kuning | **Child** | Anak dari A; posisinya relatif terhadap A jika mode parent-child aktif |
| **C** | Merah | **Independen** | Berotasi otomatis, tidak terhubung dengan A maupun B |

Setiap objek menyimpan properti:
- `x, y` — posisi translasi
- `r` — sudut rotasi (dalam radian)
- `sx, sy` — faktor skala pada sumbu X dan Y
- `color` — warna RGBA

---

## 4. Matriks Transformasi 2D

### Fungsi Perkalian Matriks 3×3

```js
function multiply3x3(a, b) {
    let out = new Array(9);
    out[0] = b[0]*a[0] + b[1]*a[3] + b[2]*a[6];
    out[1] = b[0]*a[1] + b[1]*a[4] + b[2]*a[7];
    out[2] = b[0]*a[2] + b[1]*a[5] + b[2]*a[8];
    // ... (9 elemen total)
    return out;
}
```

**Penjelasan:**
Fungsi ini mengalikan dua matriks 3×3 (`a × b`). Format matriks menggunakan **column-major order** sesuai standar OpenGL/WebGL, di mana elemen disimpan per kolom:

```
Kolom 0: [m[0], m[1], m[2]]
Kolom 1: [m[3], m[4], m[5]]
Kolom 2: [m[6], m[7], m[8]]
```

### Fungsi Pembuatan Model Matrix (TRS / RTS)

```js
function getMatrix(x, y, r, sx, sy, isTRS) {
    // Matriks Translasi
    let t = [1,0,0, 0,1,0, x,y,1];

    // Matriks Rotasi
    let c = Math.cos(r), s = Math.sin(r);
    let rot = [c,s,0, -s,c,0, 0,0,1];

    // Matriks Skala
    let sc = [sx,0,0, 0,sy,0, 0,0,1];

    let mat;
    if (isTRS) {
        // Urutan TRS: Translation × Rotation × Scale
        mat = multiply3x3(rot, sc);    // R × S
        mat = multiply3x3(t, mat);     // T × (R × S)
    } else {
        // Urutan RTS: Rotation × Translation × Scale
        mat = multiply3x3(t, sc);      // T × S
        mat = multiply3x3(rot, mat);   // R × (T × S)
    }
    return mat;
}
```

**Penjelasan:**
- **TRS (Translation → Rotation → Scale):** Objek di-skala dulu, lalu dirotasi di tempat, lalu dipindahkan. Ini adalah urutan standar yang menjaga rotasi terjadi di sekitar titik pivot objek.
- **RTS (Rotation → Translation → Scale):** Urutan berbeda yang menyebabkan objek bergerak mengelilingi origin dunia saat dirotasi (karena translasi diterapkan sebelum rotasi).
- Pengguna dapat berganti urutan menggunakan tombol **Toggle order (T)**.

### Matriks Translasi (T)

```
| 1  0  tx |
| 0  1  ty |
| 0  0   1 |
```

Menggeser posisi objek sebesar `(tx, ty)` tanpa mengubah orientasi atau ukurannya.

### Matriks Rotasi (R)

```
| cos(θ)  -sin(θ)  0 |
| sin(θ)   cos(θ)  0 |
|   0        0     1 |
```

Memutar objek sebesar sudut `θ` radian terhadap titik origin. Berlawanan arah jarum jam jika `θ` positif.

### Matriks Skala (S)

```
| sx  0   0 |
| 0   sy  0 |
| 0   0   1 |
```

Mengubah ukuran objek pada sumbu X sebesar `sx` dan sumbu Y sebesar `sy`.

---

## 5. Hubungan Parent-Child (Hirarki Matriks)

```js
let matA = getMatrix(objA.x, objA.y, objA.r, objA.sx, objA.sy, orderTRS);
let matB_local = getMatrix(objB.x, objB.y, objB.r, objB.sx, objB.sy, orderTRS);

let matB;
if (chkParent.checked) {
    // World matrix B = Parent (A) × Local (B)
    matB = multiply3x3(matA, matB_local);
} else {
    matB = matB_local;
}
```

**Penjelasan:**
- **`matA`** adalah matriks transformasi dunia (world matrix) objek A.
- **`matB_local`** adalah matriks transformasi lokal objek B (relatif terhadap parent-nya).
- Jika mode **parent-child aktif**, matriks dunia objek B dihitung dengan mengalikan `matA × matB_local`. Artinya posisi, rotasi, dan skala objek B akan **mengikuti** objek A.
- Jika mode **parent-child nonaktif**, objek B menggunakan matriks lokalnya sendiri dan bergerak secara independen.

**Konsep Local vs World Coordinate:**
- **Local coordinate** — posisi objek relatif terhadap parent-nya.
- **World coordinate** — posisi objek di ruang dunia setelah dikalikan dengan matriks parent.

---

## 6. Kontrol Input (Keyboard dan Mouse)

### Kontrol Keyboard

```js
let keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// Di dalam render loop:
if (keys["w"] || keys["arrowup"]) objA.y += tSpd * dt;
if (keys["s"] || keys["arrowdown"]) objA.y -= tSpd * dt;
if (keys["a"] || keys["arrowleft"]) objA.x -= tSpd * dt;
if (keys["d"] || keys["arrowright"]) objA.x += tSpd * dt;
if (keys["q"]) objA.r += rSpd * dt;   // Rotasi counter-clockwise
if (keys["e"]) objA.r -= rSpd * dt;   // Rotasi clockwise
```

**Penjelasan:**
- Objek `keys` menyimpan status setiap tombol (ditekan atau tidak).
- Pergerakan dikalikan `dt` (delta time) agar kecepatan konsisten di berbagai frame rate.

### Kontrol Mouse (Drag)

```js
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
```

**Penjelasan:**
- Saat mouse ditekan dan digeser di atas canvas, posisi pixel mouse dikonversi ke **clip space** (-1 sampai 1).
- Koordinat Y dibalik (`-`) karena canvas memiliki Y ke bawah sedangkan WebGL memiliki Y ke atas.

---

## 7. Render Loop

```js
let lastTime = performance.now();

function render(time) {
    let dt = (time - lastTime) / 1000;
    lastTime = time;

    // Update logika (input, auto-rotate, dst.)
    // ...

    gl.clearColor(0.03, 0.05, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Gambar sumbu koordinat
    if (chkAxes.checked) {
        gl.bindVertexArray(vaoAxes);
        gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(idMat));
        gl.uniform4f(uColor, 1.0, 1.0, 1.0, 0.15);
        gl.drawArrays(gl.LINES, 0, 4);
    }

    // Gambar objek persegi
    gl.bindVertexArray(vaoSquare);

    // Object A (jika checkbox aktif)
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

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

**Penjelasan:**
- `requestAnimationFrame(render)` memanggil fungsi `render` secara rekursif ~60 kali per detik.
- `dt` (delta time) menghitung waktu antar frame untuk animasi yang konsisten.
- Setiap frame: layar dibersihkan → matriks dihitung → objek digambar satu per satu.
- `gl.uniformMatrix3fv()` mengirim matriks model ke GPU.
- `gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)` menggambar persegi dari 4 vertex.
- Setiap objek bisa ditampilkan/disembunyikan melalui checkbox.

---

## 8. Fitur Interaktif

### Auto-Rotate Object C

```js
objC.r += rSpd * dt * 0.5;
```

Object C berotasi secara otomatis dan independen setiap frame.

### Auto-Orbit Object B

```js
if (chkAutoB.checked) {
    objB.r += rSpd * dt * orbitDirection;
}
```

Jika checkbox **Auto Object B** aktif, objek B akan berputar mengorbit secara otomatis. Arah orbit bisa dibalik dengan tombol **Toggle orbit (O)**.

### Toggle Show/Hide Objek

Setiap objek (A, B, C) memiliki checkbox di sidebar. Ketika checkbox tidak dicentang, objek tersebut tidak digambar ke canvas:

```js
if (chkShowA.checked) {
    // gambar objek A
}
```

---

## 9. Kontrol yang Tersedia

| Kontrol | Fungsi |
|---------|--------|
| **W/A/S/D atau Arrow** | Translasi objek A (atas/kiri/bawah/kanan) |
| **Q / E** | Rotasi objek A (counter-clockwise / clockwise) |
| **+ / -** | Skala uniform objek A (perbesar / perkecil) |
| **Z / X** | Skala X objek A |
| **C / V** | Skala Y objek A |
| **Mouse Drag** | Geser posisi objek A langsung di canvas |
| **P** | Pause / Resume animasi |
| **R** | Reset semua objek ke posisi awal |
| **T** | Toggle urutan transformasi (TRS ↔ RTS) |
| **O** | Toggle arah orbit objek B |
| **Checkbox Show** | Tampilkan / sembunyikan masing-masing objek |
| **Checkbox Parent-child** | Aktifkan / nonaktifkan hubungan parent-child A→B |
| **Checkbox Coordinate axes** | Tampilkan / sembunyikan garis sumbu X dan Y |
| **Checkbox Pivot marker** | Tampilkan / sembunyikan tanda titik pusat objek |

---

## 10. Kesimpulan

Praktikum ini mendemonstrasikan:

1. **Transformasi Geometri 2D** — Translasi, rotasi, dan skala melalui matriks 3×3 homogen.
2. **Urutan Transformasi (TRS vs RTS)** — Perbedaan urutan matriks menghasilkan hasil visual yang berbeda secara signifikan.
3. **Hirarki Parent-Child** — Matriks dunia anak dihitung dari `Parent × Child`, sehingga anak selalu mengikuti transformasi induknya.
4. **Local vs World Coordinate** — Sistem koordinat lokal objek berbeda dari sistem koordinat dunia global.
5. **Interaktivitas** — Kontrol real-time melalui keyboard, mouse, dan UI untuk eksplorasi langsung.
