# Penjelasan Praktikum 4: Kamera dan Proyeksi 3D

Dokumen ini berisi penjelasan bagaimana kode pada praktikum ini memenuhi *requirement minimum* dan *challenge* (Eksperimen Tambahan) berdasarkan instruksi di modul pembelajaran Grafika Komputer (Pertemuan 4).

---

## 1. Pemenuhan Requirement Minimum (Tugas Utama)

### A. WebGL2 Context & Geometri
- **Inisialisasi WebGL2**: Dilakukan pada awal `main.js` dengan memanggil `canvas.getContext("webgl2")`. Jika browser tidak mendukung, UI (badge status) akan menampilkan pesan error.
```javascript
const canvas = document.querySelector("#webglCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  document.querySelector("#statusBadge").textContent = "WebGL2 TIDAK TERSEDIA";
  throw new Error("Browser tidak mendukung WebGL2.");
}
```
- **Geometri 3D**: Menggunakan objek 3D penuh. Pada awalnya berupa Kubus (36 vertex dari 6 sisi), namun telah diperluas sehingga merender **Kubus (Tengah)**, **Piramida (Kiri)**, dan **Bola (Kanan)** dengan buffer terpisah.
- **Vertex Attributes**: Posisi (`a_position`) bertipe `vec3` dan warna (`a_color`) dikirimkan per *face/vertex* dan dirender dengan `gl.drawArrays`.

### B. Matriks Transformasi (Pipeline 3D)
Ketiga matriks utama (`Model`, `View`, dan `Projection`) dihitung langsung menggunakan algoritma custom (tidak menggunakan library eksternal `gl-matrix` dalam implementasi akhir):
- **Model Matrix (`u_model`)**: Dihitung dari fungsi `modelMatrix(position, rotation)` yang mengalikan matriks Translasi dengan matriks Rotasi (X dan Y). 
```javascript
function modelMatrix(position, rotation) {
  return multiply(
    translation(...position),
    multiply(rotationY(rotation[1]), rotationX(rotation[0])),
  );
}
```
- **View Matrix (`u_view`)**: Dibuat menggunakan fungsi `lookAt(eye, target, up)` yang secara dinamis menghitung *Forward*, *Right*, dan *Up vector* relatif.
```javascript
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
```
- **Projection Matrix (`u_projection`)**: Mendukung dua tipe matriks (Perspektif dan Ortografis) yang di-generate melalui fungsi `perspective()` dan `orthographic()`.
```javascript
function projectionMatrix(aspect, mode) {
  return mode === "perspective"
    ? perspective(state.fov, aspect, state.near, state.far)
    : orthographic(2.8, aspect, state.near, state.far);
}
```

### C. Fitur Proyeksi & Kontrol UI
- **Perspective vs Orthographic**: Terdapat fungsi toggle (tombol di layar atau menekan tombol `O`) untuk beralih antar mode proyeksi secara *real-time*.
```javascript
  if (key === "o")
    state.projection =
      state.projection === "perspective" ? "orthographic" : "perspective";
```
- **Aspect Ratio**: Kalkulasi rasio diatur menyesuaikan ukuran layar (width/height canvas) secara presisi pada argumen `projectionMatrix()`.
- **FOV Control**: Sudut pandang (Field of View) dapat diatur secara *continuous* menggunakan *range slider* di panel kontrol.
- **Depth Test**: Dapat diaktifkan / dinonaktifkan *(toggle)* untuk melihat bagaimana urutan render mempengaruhi visual jika Z-buffer tidak dipakai.

### D. Heads-Up Display (HUD)
Semua statistik *real-time* seperti Mode Proyeksi (Perspective/Orthographic), Koordinat Kamera (X,Y,Z), nilai FOV, status Depth Test, serta parameter Clipping (Near/Far) di-*update* dan ditampilkan pada layar HUD sebelah kanan kanvas (`updateHud()`).

---

## 2. Pemenuhan Eksperimen Wajib (Poin 60-70)

Kode ini dirancang untuk memudahkan eksplorasi poin-poin wajib:
1. **Camera Position (Interaktif)**: Pengguna dapat menggeser kamera dengan tombol Arah (`Arrow Keys`) dan `W`/`S` (mengubah X, Y, Z secara state-based input dalam fungsi `updateCamera()`). 
2. **Camera Target**: Target acuan dapat digeser menggunakan tombol `Q`/`E` (Sumbu X) dan `A`/`D` (Sumbu Y), atau menggunakan Slider Target. Kamera akan berputar menatap arah yang baru.
3. **Up Vector**: Pada `state.camera.up`, up vector secara default diset ke `[0, 1, 0]`.
4. **Proyeksi**: Peralihan mulus dari Perspektif ke Ortografik memperlihatkan dengan jelas hilangnya "efek mengecil" pada benda jarak jauh.
5. **FOV & Aspect Ratio**: Slider FOV menguji efek distorsi (fisheye-like) pada sudut ekstrem. 
6. **Clipping Planes**: Tombol `Cycle Clip` (atau tuts `N`) mengubah preset *Near/Far plane* untuk eksperimen pemotongan geometri depan/belakang secara paksa.
7. **Depth Test (Z-Fighting)**: Ketika `Depth Test` dimatikan (melalui tombol `Toggle Depth` atau tuts `D`), objek yang berada jauh di belakang dapat tergambar menumpuk dan menembus objek di depannya (membuktikan kelemahan rendering yang hanya bergantung pada *draw order*).

---

## 3. Pemenuhan Challenge (Tantangan Eksperimen)

Semua Challenge yang tersedia pada modul **telah diimplementasikan**:

### Challenge A: Orbit Camera
Terdapat mode **Orbit** (diaktifkan via tombol "Toggle Orbit" atau tuts `B`). Saat aktif, posisi `X` dan `Z` kamera diatur secara otomatis menggunakan fungsi sin/cos (`sin(time) * radius` dan `cos(time) * radius`), memaksa kamera mengelilingi objek di titik target konstan secara melingkar.
```javascript
  if (state.orbit) {
    const radius = 5;
    state.camera.position[0] = Math.sin(state.time * 0.45) * radius;
    state.camera.position[2] = Math.cos(state.time * 0.45) * radius;
  }
```

### Challenge B: Camera Height Control
Terdapat kontrol slider independen bernama **"Camera Height"** di panel UI yang terikat pada elemen input range `heightControl`. Mengubahnya akan memodifikasi ketinggian (sumbu Y) pada posisi kamera.

### Challenge C: Target Control
Selain `W/A/S/D/Q/E` dari keyboard, disediakan kontrol Slider eksplisit **"Target X"** dan **"Target Y"** di antarmuka HUD untuk mengubah fokus ke arah pinggir kanvas secara halus.

### Challenge D: Projection Comparison Split Mode
Terdapat mode **Split Screen** (diaktifkan dengan tombol "Toggle Split" atau tuts `X`). Fungsi `renderScene()` akan membelah layar (menggunakan fitur `gl.scissor()`). Kanvas sisi kiri menampilkan model dalam proyeksi Perspektif, sedangkan sisi kanan menggambar objek yang sama dari *state* (kamera & model matrix) yang persis sama namun menggunakan Proyeksi Ortografis. 
```javascript
  if (state.split) {
    const half = Math.floor(canvas.width / 2);
    gl.scissor(0, 0, half, canvas.height);
    // Draw Perspective
    drawPass(0, half, projectionMatrix(half / canvas.height, "perspective"));
    
    gl.scissor(half, 0, canvas.width - half, canvas.height);
    // Draw Orthographic
    drawPass(half, canvas.width - half, projectionMatrix((canvas.width - half) / canvas.height, "orthographic"));
  }
```

### Challenge E: Multiple Objects Depth Test
Alih-alih merender objek pada koordinat Z yang sama, *scene* merender 3 objek berbeda (Kubus, Piramida, dan Bola) pada titik kedalaman (Z) yang berbeda:
- Piramida di `Z = -1.6`
- Bola di `Z = -3.4`
- Kubus di tengah (`Z = 0` ditarik matriks pandang).
Hal ini memaksimalkan visualisasi ketika `Depth Test` dimatikan (objek jauh akan terlihat *overlap* memotong benda di depannya secara aneh).
```javascript
  // Tengah: KUBUS
  drawShape(
    modelMatrix([0, 0, 0], [state.time * 34, state.time * 52]),
    view, projection, objCube
  );
  
  // Kiri: PIRAMIDA
  drawShape(
    modelMatrix([-1.45, 0.15, -1.6], [state.time * 20, state.time * 30]),
    view, projection, objPyramid
  );
  
  // Kanan: BOLA
  drawShape(
    modelMatrix([1.35, -0.2, -3.4], [state.time * 48, state.time * 18]),
    view, projection, objSphere
  );
```

### Challenge F: FOV Preset
Terdapat pintasan tombol **"Cycle FOV"** yang berfungsi merotasi konfigurasi sudut Field of View ke nilai preset khusus (45°, 60°, 90°) secara bergiliran. Nilai ini juga langsung tersinkronisasi ke nilai Slider dan label HUD di sebelah kiri.
