# Penjelasan Detail & Implementasi Challenge: Praktikum 05 (Lighting, Shading & Texture)

Dokumen ini memuat dokumentasi dan penjabaran komprehensif mengenai implementasi **Challenge A hingga G** pada **Praktikum 05 (WebGL2)**. Penjelasan ini mencakup konsep teoretis grafika komputer 3D, integrasi kode WebGL2 dan GLSL ES 3.00, analisis baris per baris, serta hasil pengamatan visualnya.

---

## Challenge A — Image Texture

### 1. Konsep Teoretis Grafika Komputer
Dalam grafika 3D, *texture mapping* adalah teknik memetakan citra digital 2D (susunan texel) ke permukaan poligon 3D menggunakan sistem koordinat UV $(u, v) \in [0, 1]$. Pada WebGL2, pemuatan citra raster dari web menghadapi tantangan utama:
1. **Perbedaan Titik Asal Sumbu Y (Coordinate Origin Inversion):**
   - WebGL2 mengadopsi standar sistem koordinat kartesius dengan origin $(0, 0)$ terletak pada **sudut kiri-bawah**, dan sumbu $+Y$ mengarah ke atas.
   - Standar citra bitmap di web (seperti HTML `<img>`, `<canvas>`, SVG, JPEG, PNG) menempatkan origin $(0, 0)$ pada **sudut kiri-atas**, dengan sumbu $+Y$ mengarah ke bawah.
   - Tanpa pembalikan sumbu vertikal (*vertical flip*), tekstur akan terproyeksikan secara terbalik (*upside-down*) pada permukaan 3D.
2. **Keamanan Lintas Asal (CORS & Canvas Security):**
   - Mengambil aset citra dari domain/host eksternal (`https://darlis-its.github.io/...`) tunduk pada kebijakan *Same-Origin Policy* peramban. Jika atribut `crossOrigin` tidak disetel ke `"anonymous"`, peramban akan menandai konteks WebGL sebagai *tainted*, memicu galat keamanan saat memanggil `gl.texImage2D`.
3. **Pemuatan Asinkron & Tekstur Placeholder (1x1 Pixel):**
   - Pengunduhan gambar melalui jaringan berlangsung asinkron (*non-blocking*). Agar pipeline WebGL tetap dapat merender frame tanpa crash atau menampilkan artefak hitam/kosong sebelum gambar selesai diunduh, disiapkan tekstur *placeholder* sementara berukuran 1x1 piksel.

### 2. Implementasi Kode
**A. Inisialisasi Placeholder & Pemuatan Gambar (di `main.js`):**
```javascript
// 1. Alokasi Tekstur dan Penyediaan Placeholder 1x1 piksel sementara
const imageTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, imageTexture);
gl.texImage2D(
  gl.TEXTURE_2D,
  0,                  // Level Mipmap dasar (level 0)
  gl.RGBA,           // Format internal WebGL
  1, 1, 0,           // Lebar 1px, Tinggi 1px, Border 0
  gl.RGBA,           // Format data piksel sumber
  gl.UNSIGNED_BYTE,  // Tipe data per kanal warna (8-bit per channel)
  new Uint8Array([40, 90, 150, 255]) // Warna biru placeholder sementara
);

// 2. Pemuatan Asinkron Gambar Eksternal
const image = new Image();
image.crossOrigin = "anonymous"; // Bypass restriksi CORS agar tekstur valid
image.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Menyesuaikan orientasi vertikal WebGL
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  updateTextureState(); // Terapkan parameter filter dan wrapping yang aktif
};
image.src = "https://darlis-its.github.io/materi-grafika-komputer/praktikum/output/pert05/texture.svg";
```

**B. Pengambilan Sampel di Fragment Shader (GLSL ES 3.00):**
```glsl
uniform sampler2D u_texture;
uniform bool u_useTexture;
in vec2 v_uv;

void main() {
  ...
  // Sampling warna dasar objek dari tekstur atau warna default
  vec3 baseColor = u_useTexture ? texture(u_texture, v_uv).rgb : vec3(0.35, 0.78, 1.0);
  ...
}
```

### 3. Bedah Kode Baris per Baris
- `gl.createTexture()`: Meminta alokasi objek tekstur baru ke memori VRAM GPU.
- `gl.bindTexture(gl.TEXTURE_2D, imageTexture)`: Mengaitkan (*binding*) objek tekstur ke target aktif `gl.TEXTURE_2D` pada unit tekstur yang sedang aktif.
- `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`: Parameter konfigurasi penyimpanan piksel WebGL yang memerintahkan GPU membalik urutan baris memori vertikal (atas-bawah) saat membongkar (*unpacking*) data gambar, sehingga orientasi UV $(0, 0)$ pada kiri-bawah sesuai dengan gambar asli.
- `gl.texImage2D(...)`: Mentransfer data piksel gambar dari RAM CPU/DOM ke VRAM GPU dengan format warna 32-bit `RGBA` (`UNSIGNED_BYTE` = 8 bit per saluran R, G, B, A).
- `texture(u_texture, v_uv)`: Fungsi intrinsik GLSL untuk melakukan proses interpolasi dan pengambilan nilai warna texel pada koordinat $v\_uv$.

### 4. Dampak Visual & Hasil Observasi
- Logo/gambar SVG terpeta secara tegak sempurna pada seluruh sisi poligon (kubus, bola, torus, torus knot).
- Tidak ada distorsi orientasi vertikal (tidak terbalik).
- Perpindahan sumber tekstur dari checkerboard ke image berlangsung instan dan mulus tanpa *flicker* karena telah ada tekstur placeholder sebelumnya.

---

## Challenge B — Ambient Control

### 1. Konsep Teoretis Grafika Komputer
Dalam *Phong Reflection Model*, pencahayaan objek merupakan superposisi dari tiga komponen terpisah:
$$I = I_{\text{ambient}} + I_{\text{diffuse}} + I_{\text{specular}}$$

Komponen **Ambient Light** mensimulasikan iluminasi global tidak langsung (*indirect / scattered light*) yang dipantulkan berulang kali oleh dinding dan objek-objek di sekitarnya. Tanpa ambient light, permukaan poligon yang tidak menghadap langsung ke arah sumber cahaya akan tampak gelap pekat bernilai hitam total ($RGB = 0, 0, 0$), yang terlihat tidak natural.
Formulasi matematis komponen ambient:
$$I_{\text{ambient}} = k_a \times I_{\text{light}}$$
di mana:
- $k_a$ adalah faktor koefisien kekuatan ambient (`u_ambientStrength`), bernilai skalar riil $[0.0, 1.0]$.
- $I_{\text{light}}$ adalah intensitas dan warna sumber cahaya (`u_lightColor`).

### 2. Implementasi Kode
**A. Kontrol UI Slider & Keyboard Handler (di `index.html` dan `main.js`):**
```javascript
// Menangkap input rentang (range slider) secara realtime
document.querySelector("#ambientControl").oninput = (e) => {
  state.ambient = Number(e.target.value);
  document.querySelector("#ambientValue").textContent = state.ambient.toFixed(2);
};

// Shortcut keyboard: Tombol 'A' (tambah) dan 'Z' (kurang)
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "a") {
    state.ambient = Math.min(1.0, state.ambient + 0.05);
    document.querySelector("#ambientControl").value = state.ambient;
    document.querySelector("#ambientValue").textContent = state.ambient.toFixed(2);
  } else if (key === "z") {
    state.ambient = Math.max(0.0, state.ambient - 0.05);
    document.querySelector("#ambientControl").value = state.ambient;
    document.querySelector("#ambientValue").textContent = state.ambient.toFixed(2);
  }
});
```

**B. Pengiriman Data ke GPU di Render Loop (`draw()`):**
```javascript
gl.uniform1f(locations.ambient, state.ambient);
```

**C. Perhitungan di Fragment Shader (GLSL ES 3.00):**
```glsl
uniform float u_ambientStrength;
uniform vec3 u_lightColor;
uniform bool u_useAmbient;

void main() {
  ...
  vec3 ambient = u_useAmbient ? u_ambientStrength * u_lightColor : vec3(0.0);
  ...
  outColor = vec4(baseColor * (ambient + diffuse) + specular, 1.0);
}
```

### 3. Bedah Kode Baris per Baris
- `state.ambient = Number(e.target.value)`: Memperbarui nilai ambien di dalam objek state aplikasi secara dinamis saat slider digeser.
- `gl.uniform1f(locations.ambient, state.ambient)`: Mengunggah nilai skalar float 32-bit ke variabel seragam `u_ambientStrength` pada kartu grafis setiap frame render.
- `u_useAmbient ? u_ambientStrength * u_lightColor : vec3(0.0)`: Operator percabangan kondisional pada shader; jika sakelar ambient aktif, nilai warna cahaya diskalakan dengan kekuatan ambien. Jika mati, kontribusi ambien dinolkan.
- `baseColor * (ambient + diffuse)`: Warna ambien berinteraksi langsung secara multiplikatif dengan warna dasar tekstur (`baseColor`), menjaga karakter warna objek tetap terlihat meskipun dalam area bayangan.

### 4. Dampak Visual & Hasil Observasi
- **Slider pada 0.00:** Sisi belakang objek yang terhalang dari posisi lampu menjadi gelap gulita (kontras sangat tajam, mirip suasana luar angkasa tanpa atmosfer).
- **Slider pada 0.18 (Default):** Memberikan keseimbangan kontras yang realistis; sisi bayangan tetap memiliki visibilitas tekstur yang lembut.
- **Slider pada 1.00:** Objek bermandikan cahaya datar merata sehingga efek bayangan 3D hampir hilang (objek tampak datar tanpa kedalaman).

---

## Challenge C — Camera Control

### 1. Konsep Teoretis Grafika Komputer
Kamera virtual dalam WebGL didefinisikan menggunakan **View Matrix** ($V$), yang mentransformasikan koordinat ruang dunia (*World Space*) ke ruang mata/kamera pengamat (*Eye/View Space*). Matriks ini dibangun melalui fungsi `lookAt(eye, target, up)`.

Selain mengubah perspektif ruang pandang objek, pergerakan posisi kamera memiliki dampak krusial terhadap perhitungan pencahayaan **Specular Reflection** (pantulan mengkilap). Berdasarkan model pantulan **Blinn-Phong**:
$$\vec{V} = \text{normalize}(\vec{P}_{\text{camera}} - \vec{P}_{\text{world}})$$
$$\vec{H} = \text{normalize}(\vec{L} + \vec{V})$$
$$I_{\text{specular}} = (\max(\vec{N} \cdot \vec{H}, 0))^{\text{shininess}} \times I_{\text{light}}$$
di mana:
- $\vec{V}$ (*viewDirection*) adalah vektor arah dari fragmen poligon menuju posisi lensa kamera.
- $\vec{H}$ (*halfway vector*) adalah vektor bagi antara arah datang cahaya $\vec{L}$ dan arah pandang $\vec{V}$.
- Karena posisi kamera ($\vec{P}_{\text{camera}}$) berubah saat digerakkan, vektor arah pandang $\vec{V}$ ikut bergeser secara dinamis. Akibatnya, titik konsentrasi pantulan kilau specular (*specular highlight*) ikut berpindah di permukaan geometri mengikuti sudut mata pengamat (*view-dependent phenomenon*).

### 2. Implementasi Kode
**A. Pembaruan Posisi Kamera Berbasis Waktu (`updateCamera` di `main.js`):**
```javascript
function updateCamera(deltaTime) {
  // Kecepatan independen dari variasi frame rate layar (frame-rate independent)
  const speed = 1.8 * deltaTime;

  // Tombol Q: Geser kamera ke kiri sepanjang sumbu X
  if (state.keys.q) state.camera.position[0] -= speed;
  // Tombol E: Geser kamera ke kanan sepanjang sumbu X
  if (state.keys.e) state.camera.position[0] += speed;

  // Mode Camera Orbit Otomatis
  if (state.cameraOrbit) {
    state.camera.position[0] = Math.sin(state.time * 0.45) * 5;
    state.camera.position[2] = Math.cos(state.time * 0.45) * 5;
  }
}
```

**B. Pengiriman Matriks Pandangan dan Posisi Kamera ke GPU (`draw()`):**
```javascript
const view = lookAt(state.camera.position, state.camera.target, state.camera.up);
gl.uniformMatrix4fv(locations.view, false, view);
gl.uniform3fv(locations.cameraPosition, state.camera.position);
```

**C. Evaluasi Vektor Pandang di Fragment Shader (GLSL ES 3.00):**
```glsl
uniform vec3 u_cameraPosition;
in vec3 v_worldPosition;
in vec3 v_normal;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 lightDirection = normalize(u_lightPosition - v_worldPosition);
  
  // Menghitung vektor arah pengamat dari permukaan objek menuju kamera
  vec3 viewDirection = normalize(u_cameraPosition - v_worldPosition);
  
  // Komputasi Halfway Vector untuk model Blinn-Phong
  vec3 halfVector = normalize(lightDirection + viewDirection);
  
  float specularAmount = pow(max(dot(normal, halfVector), 0.0), u_shininess);
  ...
}
```

### 3. Bedah Kode Baris per Baris
- `const speed = 1.8 * deltaTime`: Mengalikan konstanta kecepatan dengan selang waktu frame `deltaTime` agar pergerakan kamera tetap konstan pada monitor refresh rate 60Hz, 120Hz, maupun 144Hz.
- `state.camera.position[0] -= speed`: Mengurangi koordinat sumbu $X$ kamera (geser kiri) saat tombol `Q` ditekan, dan menambahkannya saat tombol `E` ditekan.
- `lookAt(...)`: Menghasilkan matriks transformasi ortonormal 4x4 dari 3 vektor: posisi mata (`eye`), titik bidik (`target`), dan vektor arah atas (`up`).
- `normalize(u_cameraPosition - v_worldPosition)`: Mengkalkulasi unit vektor berpanjang 1 yang mengarah tepat ke posisi pengamat untuk setiap fragmen piksel poligon.

### 4. Dampak Visual & Hasil Observasi
- Saat menekan tombol `Q` atau `E`, objek bergeser secara halus dari kiri ke kanan dalam bidang pandang perspektif.
- Titik kilau putih specular (*highlight spot*) pada permukaan lengkung bola atau torus bergerak secara dinamis melintasi permukaan objek, membuktikan secara visual bahwa komponen specular bergantung langsung pada orientasi sudut pandang kamera pengamat.

---

## Challenge D — Non-Uniform Scale Mode

### 1. Konsep Teoretis Grafika Komputer
Transformasi skala seragam (*uniform scale*, di mana $S_x = S_y = S_z$) memperbesar atau mengecilkan geometri secara merata sehingga sudut antar vektor tetap terjaga. Namun, pada **Non-Uniform Scale** ($S_x \neq S_y \neq S_z$), poligon diregangkan atau dipipihkan secara asimetris pada salah satu sumbu kartesius.

**Masalah Normal Vector pada Transformasi Skala Asimetris:**
- Vektor normal $\vec{N}$ merupakan vektor arah yang wajib tegak lurus ($90^\circ$, ortogonal) terhadap bidang tangensial permukaan poligon.
- Jika vektor normal ditransformasikan langsung menggunakan matriks model biasa ($M \cdot \vec{N}$), peregangan yang tidak seragam akan memutar dan mendistorsi arah normal sehingga **tidak lagi tegak lurus** terhadap permukaan objek baru.
- Akibatnya, perhitungan sudut pencahayaan $\vec{N} \cdot \vec{L}$ (diffuse) dan $\vec{N} \cdot \vec{H}$ (specular) menjadi rusak parah, menghasilkan bayangan gelap yang miring, belang, atau cacat visual.

**Solusi Matematis: The Normal Matrix ($M_{\text{normal}}$)**
Untuk mempertahankan hubungan ortogonalitas antara vektor normal dan bidang tangen setelah deformasi non-uniform, vektor normal harus dikalikan dengan **Transpose dari Invers matriks transformasi $3 \times 3$ model**:
$$M_{\text{normal}} = (M_{3\times3}^{-1})^T$$

### 2. Implementasi Kode
**A. Slider Kontrol Skala Sumbu X, Y, Z (di `index.html` dan `main.js`):**
```javascript
// Registrasi handler untuk ketiga slider skala independen
["X", "Y", "Z"].forEach((axis) =>
  (document.querySelector(`#scale${axis}Control`).oninput = (e) => {
    state.scale[axis === "X" ? 0 : axis === "Y" ? 1 : 2] = Number(e.target.value);
  })
);
```

**B. Algoritma Kalkulasi Matriks Invers-Transpose 3x3 (`normalMatrixFromMat4` di `main.js`):**
```javascript
function normalMatrixFromMat4(m) {
  // Ekstraksi elemen matriks rotasi dan skala 3x3 dari matriks 4x4
  const a00 = m[0], a01 = m[4], a02 = m[8],
        a10 = m[1], a11 = m[5], a12 = m[9],
        a20 = m[2], a21 = m[6], a22 = m[10];

  // Perhitungan Kofaktor 2x2
  const b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20;

  // Determinan Matriks 3x3
  const determinant = a00 * b01 + a01 * b11 + a02 * b21 || 1;

  // Membentuk matriks Inverse-Transpose 3x3 (dalam format Float32Array column-major)
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
```

**C. Penerapan di Pipeline Shader (`draw()` dan Vertex Shader):**
```javascript
// Di draw():
gl.uniformMatrix3fv(locations.normalMatrix, false, normalMatrixFromMat4(model));
```
```glsl
// Di Vertex Shader:
uniform mat3 u_normalMatrix;
in vec3 a_normal;
out vec3 v_normal;

void main() {
  ...
  v_normal = u_normalMatrix * a_normal; // Koreksi vektor normal menggunakan Normal Matrix
  ...
}
```

### 3. Bedah Kode Baris per Baris
- `scale(...state.scale)`: Matriks model dibentuk dari perkalian translasi, rotasi dinamis, dan matriks skala non-uniform `[scaleX, scaleY, scaleZ]`.
- `normalMatrixFromMat4(m)`: Mengabaikan komponen translasi baris/kolom ke-4 (karena normal hanyalah besaran arah, bukan posisi titik), lalu menghitung matriks adjoin/kofaktor dibagi determinan (inversi) kemudian dibalik baris dan kolomnya (transposisi).
- `gl.uniformMatrix3fv`: Mengirimkan struktur data matriks 3x3 (9 nilai floating point) ke uniform GPU `u_normalMatrix`.
- `normalize(v_normal)` di Fragment Shader: Setelah ditransformasikan oleh normal matrix dan diinterpolasi oleh rasterizer poligon, panjang vektor dinormalisasi kembali ke unit length $= 1.0$.

### 4. Dampak Visual & Hasil Observasi
- Saat objek kubus dipipihkan secara ekstrem menjadi pelat tipis ($S_y = 0.2, S_x = 2.0$), permukaan atas pelat tetap menerima pencahayaan tegak lurus sempurna tanpa ada bayangan miring yang keliru.
- Pantulan specular tetap terpusat di titik yang benar secara fisika, membuktikan bahwa Normal Matrix berhasil mengompensasi distorsi skala asimetris.

---

## Challenge E — Light Orbit

### 1. Konsep Teoretis Grafika Komputer
Dalam pengujian shader dan material 3D, memindahkan sumber cahaya secara dinamis di sekitar model sangat penting untuk memvalidasi transisi antara daerah terang (*lit area*), batas bayangan (*terminator line*), dan daerah gelap (*shadowed area*).

Secara analitis, lintasan melingkar berpusat di $(0, 0)$ pada bidang horizontal $XZ$ dapat dimodelkan menggunakan **persamaan parametrik trigonometri lingkaran**:
$$X(t) = R \times \sin(\omega \cdot t)$$
$$Z(t) = R \times \cos(\omega \cdot t)$$
$$Y(t) = \text{konstan (ketinggian sumber cahaya)}$$
di mana:
- $R$ adalah radius lintasan orbit (dalam program bernilai $3.0$ unit).
- $t$ adalah variabel waktu yang berjalan kontinu (`state.time`).
- $\omega$ adalah kecepatan sudut rotasi.

### 2. Implementasi Kode
**A. Pembaruan Koordinat Orbit pada Loop Waktu (`updateCamera` di `main.js`):**
```javascript
function updateCamera(deltaTime) {
  ...
  // Challenge E: Menggerakkan posisi cahaya melingkari objek
  if (state.lightOrbit) {
    state.light[0] = Math.sin(state.time) * 3; // Posisi sumbu X
    state.light[2] = Math.cos(state.time) * 3; // Posisi sumbu Z
    // Ketinggian sumbu Y tetap dipertahankan pada state.light[1]
  }
  ...
}
```

**B. Pengaturan Tombol Interaktif dan Shortcut:**
```javascript
// Toggle melalui tombol HUD
document.querySelector("#lightOrbitButton").onclick = () => {
  state.lightOrbit = !state.lightOrbit;
};

// Toggle melalui keyboard shortcut 'L'
if (key === "l") state.lightOrbit = !state.lightOrbit;
```

**C. Konsumsi Posisi Cahaya di Fragment Shader (GLSL ES 3.00):**
```glsl
uniform vec3 u_lightPosition;
in vec3 v_worldPosition;

void main() {
  ...
  // Vektor datangnya cahaya dihitung dinamis untuk setiap fragmen piksel
  vec3 lightDirection = normalize(u_lightPosition - v_worldPosition);
  
  // Intensitas diffuse berbasis hukum Lambert Cosine Law
  float diffuseAmount = max(dot(normal, lightDirection), 0.0);
  ...
}
```

### 3. Bedah Kode Baris per Baris
- `Math.sin(state.time) * 3` & `Math.cos(state.time) * 3`: Menghitung koordinat melingkar pada radius 3 unit di bidang XZ secara periodik setiap pergantian frame.
- `state.time += dt`: Akumulasi waktu berbasis selisih waktu nyata (*high-resolution timestamp*) dari `requestAnimationFrame`.
- `gl.uniform3fv(locations.lightPosition, state.light)`: Mengunggah koordinat 3D baru sumber cahaya ke uniform shader setiap frame render.
- `normalize(u_lightPosition - v_worldPosition)`: Menghasilkan vektor arah $\vec{L}$ dari titik fragmen menuju posisi orbit sumber cahaya, sehingga setiap pergeseran lampu secara otomatis memperbarui sudut datang cahaya $\theta$ terhadap normal $\vec{N}$.

### 4. Dampak Visual & Hasil Observasi
- Sumber cahaya berputar $360^\circ$ mengelilingi objek 3D secara kontinu dan mulus.
- Garis batas bayangan (*shadow terminator*) dan titik pantulan kilap bergerak menyapu seluruh sisi poligon secara berkesinambungan.
- Status posisi cahaya pada kartu HUD (`#lightInfo`) diperbarui secara riil menampilkan koordinat numerik `(X, Y, Z)` yang bergerak dinamis.

---

## Challenge F — Lighting Components Toggle

### 1. Konsep Teoretis Grafika Komputer
Phong Reflection Model merupakan model pencahayaan aditif (*additive illumination*), di mana warna akhir setiap fragmen adalah penjumlahan terpisah dari ketiga elemen fisik:
$$C_{\text{final}} = C_{\text{base}} \times (I_{\text{ambient}} + I_{\text{diffuse}}) + I_{\text{specular}}$$

Untuk keperluan analisis grafika, inspeksi kualitas permukaan poligon, serta debugging shader, pemisahan masing-masing komponen pencahayaan sangat diperlukan:
- **Ambient murni:** Menginspeksi iluminasi dasar tanpa terpengaruh orientasi normal terhadap lampu.
- **Diffuse murni (Lambertian):** Menginspeksi kehalusan kelengkungan permukaan geometri dan kualitas interpolasi normal (*shading smoothness*).
- **Specular murni (Phong/Blinn-Phong):** Menginspeksi pantulan mikro permukaan, kekasaran material (*roughness/shininess*), dan keakuratan sudut pandang kamera.

### 2. Implementasi Kode
**A. Checkbox Kontrol UI dan Keyboard Handler (di `index.html` dan `main.js`):**
```javascript
// Inisialisasi state komponen pencahayaan
state.components = { ambient: true, diffuse: true, specular: true };

// Event listener untuk checkbox UI
["ambient", "diffuse", "specular"].forEach((name) =>
  (document.querySelector(`#${name}Toggle`).onchange = (e) => {
    state.components[name] = e.target.checked;
  })
);

// Shortcut Keyboard: Tombol 1 (Ambient), 2 (Diffuse), 3 (Specular)
window.addEventListener("keydown", (e) => {
  if (e.key === "1") {
    state.components.ambient = !state.components.ambient;
    document.querySelector("#ambientToggle").checked = state.components.ambient;
  }
  if (e.key === "2") {
    state.components.diffuse = !state.components.diffuse;
    document.querySelector("#diffuseToggle").checked = state.components.diffuse;
  }
  if (e.key === "3") {
    state.components.specular = !state.components.specular;
    document.querySelector("#specularToggle").checked = state.components.specular;
  }
});
```

**B. Pengiriman Boolean Flag ke Uniform WebGL (`draw()`):**
```javascript
gl.uniform1i(locations.useAmbient, state.components.ambient);
gl.uniform1i(locations.useDiffuse, state.components.diffuse);
gl.uniform1i(locations.useSpecular, state.components.specular);
```

**C. Seleksi Aditif di Fragment Shader (GLSL ES 3.00):**
```glsl
uniform bool u_useAmbient;
uniform bool u_useDiffuse;
uniform bool u_useSpecular;

void main() {
  ...
  vec3 ambient  = u_useAmbient  ? u_ambientStrength * u_lightColor : vec3(0.0);
  vec3 diffuse  = u_useDiffuse  ? diffuseAmount * u_lightColor     : vec3(0.0);
  vec3 specular = u_useSpecular ? specularAmount * u_lightColor    : vec3(0.0);

  // Komposisi aditif akhir
  outColor = vec4(baseColor * (ambient + diffuse) + specular, 1.0);
}
```

### 3. Bedah Kode Baris per Baris
- `state.components[name] = e.target.checked`: Menyimpan status aktif/nonaktif masing-masing komponen dalam objek boolean JavaScript.
- `gl.uniform1i(locations.useDiffuse, ...)`: Dalam WebGL2 GLSL ES 3.00, uniform bertipe `bool` menerima input bilangan bulat (integer) melalui fungsi `gl.uniform1i`, di mana nilai `true` diterjemahkan menjadi `1` dan `false` menjadi `0`.
- Operator kondisional pada shader `u_useDiffuse ? ... : vec3(0.0)`: Apabila flag bernilai false, vektor warna komponen tersebut dikalikan dengan nol (`vec3(0.0)`), meniadakan kontribusinya dari perhitungan warna akhir tanpa merusak pipeline rendering.

### 4. Dampak Visual & Hasil Observasi
| Konfigurasi Komponen | Tampilan Visual Objek |
| :--- | :--- |
| **Ambient Saja** | Objek tampak seperti siluet 2D berwarna datar tanpa ada lekukan atau gradasi bayangan. |
| **Diffuse Saja** | Objek memiliki bentuk 3D padat dan berbayang *matte* (seperti tanah liat atau kapur), tanpa kilau pantulan cahaya. |
| **Specular Saja** | Seluruh badan objek berwarna hitam pekat, hanya menyisakan kilatan cahaya putih mengkilap di area yang memantulkan cahaya ke kamera. |
| **Ketiganya Aktif** | Render 3D realistis lengkap dengan kedalaman bayangan, warna tekstur alami, dan kilau material yang meyakinkan. |

---

## Challenge G — Mipmap Filtering

### 1. Konsep Teoretis Grafika Komputer
Ketika objek bertekstur berada pada jarak yang jauh dari kamera atau diproyeksikan pada sudut miring yang tajam (*oblique angle*), satu piksel pada layar mencakup area yang sangat luas pada gambar tekstur asli (*Texture Minification*).
Jika hanya mengandalkan filter konvensional:
- **`NEAREST`:** Mengambil satu texel terdekat secara kasar, menimbulkan artefak gerigi bergerigi (*pixelation*) dan efek kedipan parah (*flickering / temporal aliasing*) saat kamera bergerak.
- **`LINEAR`:** Hanya merata-ratakan 4 texel terdekat pada resolusi penuh, tetap gagal mengatasi *undersampling* saat rasio pengecilan sangat drastis, sehingga memunculkan pola distorsi interferensi (*Moire pattern*).

**Solusi Mipmapping (Hierarki Piramida Citra):**
Teknik **Mipmap** (berasal dari bahasa Latin *multum in parvo*, "banyak hal di tempat kecil") membuat rangkaian salinan tekstur prasetel dengan resolusi yang menurun secara eksponensial dengan faktor 2:
$$128\times128 \to 64\times64 \to 32\times32 \to 16\times16 \to 8\times8 \to 4\times4 \to 2\times2 \to 1\times1$$
Rasterizer GPU secara otomatis menghitung laju perubahan koordinat UV terhadap piksel layar menggunakan fungsi turunan parsial ($\frac{\partial u}{\partial x}, \frac{\partial v}{\partial y}$), lalu memilih level mipmap yang tepat.

Dengan filter **`LINEAR_MIPMAP_LINEAR`** (**Trilinear Filtering**):
1. Dilakukan interpolasi bilinear antar 4 texel pada level mipmap $N$.
2. Dilakukan interpolasi bilinear antar 4 texel pada level mipmap $N+1$.
3. Dilakukan interpolasi linear antar kedua hasil level tersebut, menghasilkan transisi tekstur yang paling halus tanpa patahan antar tingkat resolusi.

### 2. Implementasi Kode
**A. Konfigurasi State dan UI Dropdown:**
```html
<select id="filterSelect">
  <option value="nearest">Nearest</option>
  <option value="linear" selected>Linear</option>
  <option value="mipmap">Mipmap</option>
</select>
```

**B. Pengaturan Parameter Tekstur & Generasi Mipmap (`updateTextureState` di `main.js`):**
```javascript
function updateTextureState() {
  const texture = state.textureSource === "image" ? imageTexture : checkerTexture;
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Tentukan filter dasar pembesaran/pengecilan
  const filter = state.filter === "nearest" ? gl.NEAREST : gl.LINEAR;

  // Konfigurasi Minification Filter
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    state.filter === "mipmap" ? gl.LINEAR_MIPMAP_LINEAR : filter
  );

  // Konfigurasi Magnification Filter
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

  // Konfigurasi Wrapping Sumbu S dan T
  const wrapMode = state.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);

  // Pembuatan otomatis seluruh rantai level Mipmap oleh GPU
  if (state.filter === "mipmap") {
    gl.generateMipmap(gl.TEXTURE_2D);
  }
}
```

### 3. Bedah Kode Baris per Baris
- `gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)`: Menginstruksikan GPU menggunakan filter trilinear saat tekstur mengalami pengecilan (*minification*).
- `gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)`: Pada saat pembesaran (*magnification*, objek sangat dekat dengan kamera), mipmap tidak digunakan sehingga filter dibatasi pada `gl.LINEAR` atau `gl.NEAREST`.
- `gl.generateMipmap(gl.TEXTURE_2D)`: Memerintahkan driver WebGL2/GPU untuk secara otomatis mengomputasi dan menyimpan piramida mipmap lengkap dari citra dasar level 0 hingga level terkecil $1\times1$.
- Karena WebGL2 mendukung tekstur *Non-Power of Two* (NPOT) secara *native*, pembuatan mipmap dapat langsung diterapkan baik pada pola kanvas buatan (128x128) maupun gambar SVG eksternal.

### 4. Dampak Visual & Hasil Observasi
- **Nearest Filtering:** Menghasilkan garis tepi ubin checkerboard yang bergerigi kasar; saat kamera digerakkan atau objek berotasi, permukaan tampak bergetar (*shimmering/crawling pixels*).
- **Linear Filtering:** Menghilangkan gerigi saat objek dekat, tetapi pada sudut tajam di kejauhan tetap memperlihatkan artefak interferensi moire.
- **Mipmap (`LINEAR_MIPMAP_LINEAR`):** Menghilangkan seluruh distorsi moire dan getaran flickering pada jarak jauh. Permukaan objek di latar belakang tampak tenang, stabil, dan bersih, menghasilkan kualitas visual rendering standar industri grafika 3D.
