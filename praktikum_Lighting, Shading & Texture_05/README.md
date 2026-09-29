# Praktikum 5: Lighting, Shading & Texture WebGL2

## Data Mahasiswa
- **Nama:** [Isi Nama Anda]
- **NRP:** [Isi NRP Anda]

## Deskripsi Aplikasi
Aplikasi ini merupakan implementasi WebGL2 murni untuk merender objek 3D (Cube, Sphere, Torus, Torus Knot) yang diintegrasikan dengan kerangka **Vite**. Aplikasi ini menambahkan efek **Lighting** (Ambient, Diffuse, Specular) berdasarkan Phong Reflection Model, **Shading** (Flat & Smooth), dan **Texture Mapping** (Checkerboard prosedural & Image eksternal).

## Kebutuhan Praktikum / Spesifikasi Rendering
- **Jenis Shading:** Flat Shading dan Smooth Shading (Bisa di-toggle).
- **Texture yang Digunakan:** Checkerboard (Prosedural) dan Image SVG (`texture.svg`).
- **Filtering yang Tersedia:** Nearest, Linear, dan Mipmap (`LINEAR_MIPMAP_LINEAR`).
- **Wrapping yang Tersedia:** Repeat (`REPEAT`) dan Clamp to Edge (`CLAMP_TO_EDGE`).
- **Nilai Ambient Default:** `0.18`
- **Nilai Shininess Default:** `32`

## Kontrol Keyboard
- **`F`**: Toggle Shading (Flat / Smooth)
- **`T`**: Toggle Texture
- **`L`**: Toggle Light Orbit (Pencahayaan bergerak mengelilingi objek)
- **`P`**: Toggle Object Rotation (Rotasi kubus berjalan/berhenti)
- **`R`**: Reset Semua Pengaturan
- **`W/S`** dan **`Panah`**: Menggerakkan posisi cahaya (Light)
- **`Q/E`**: Menggerakkan kamera
- **`A/Z`** *(Challenge B)*: Menambah/Mengurangi Ambient Strength
- **`N`** *(Challenge D)*: Toggle Uniform/Non-Uniform Scale
- **`1, 2, 3`** *(Challenge F)*: Toggle Komponen Lighting (1: Ambient, 2: Diffuse, 3: Specular)

---

## Penjelasan Kode Utama (Praktikum 5)

Berikut adalah komponen utama pada `main.js`:

1. **Inisialisasi WebGL2 & Shaders:**
   Sistem diinisialisasi menggunakan konteks `webgl2`. **Vertex Shader** berfungsi mengkalkulasi posisi setiap titik (*vertex*) pada dunia 3D berdasarkan model, view, dan proyeksi, sekaligus menghitung posisi dunia dan normal vektor. **Fragment Shader** berfungsi menghitung warna akhir tiap piksel dengan menggabungkan warna dasar (tekstur) dengan perhitungan intensitas cahaya (Ambient, Diffuse, Specular).

2. **Perhitungan Normal Matrix:**
   ```javascript
   function normalMatrixFromMat4(m) { ... }
   ```
   Digunakan untuk mengubah transformasi vektor normal ketika objek diskalakan secara tidak seragam (*non-uniform scale*). Normal Matrix adalah *inverse-transpose* dari matriks model. Hal ini memastikan arah pantulan cahaya tetap akurat.

3. **Texture Sampling:**
   Membuat tekstur prosedural berbasis array (checkerboard) dan memuat gambar eksternal (dengan CORS diatur ke `anonymous`). Fungsi `updateTextureState()` bertugas mengatur *wrapping* (`REPEAT` atau `CLAMP_TO_EDGE`) dan *filtering* (`NEAREST`, `LINEAR`, atau `MIPMAP`) melalui pemanggilan fungsi API WebGL `gl.texParameteri`.

---

## Implementasi Challenge (Kode & Penjelasan)

### Challenge A — Image Texture
**Kode (di `main.js`):**
```javascript
const image = new Image();
image.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  updateTextureState();
};
image.crossOrigin = "anonymous";
image.src = "https://darlis-its.github.io/materi-grafika-komputer/praktikum/output/pert05/texture.svg";
```
**Penjelasan:**
Membuat objek gambar, menyesuaikan *cross-origin* untuk mencegah error CORS, dan ketika di-load `gl.pixelStorei` membalik koordinat Y gambar agar orientasinya pas dengan sistem UV WebGL. Selanjutnya gambar disimpan pada `gl.TEXTURE_2D`.

### Challenge B — Ambient Control
**Kode (di dalam input control event & HUD):**
```javascript
document.querySelector("#ambientControl").oninput = (e) => {
  state.ambient = Number(e.target.value);
  document.querySelector("#ambientValue").textContent = state.ambient.toFixed(2);
};
// Di shader: 
// vec3 ambient = u_useAmbient ? u_ambientStrength * u_lightColor : vec3(0.0);
```
**Penjelasan:**
Menambahkan input untuk mengubah variabel konfigurasi `state.ambient`. Nilai ini dipassing ke dalam variabel seragam `u_ambientStrength` pada Fragment Shader untuk memodifikasi kecerahan seluruh area terlepas dari posisi sumber cahaya.

### Challenge C — Camera Control
**Kode (di fungsi `updateCamera`):**
```javascript
if (state.keys.q) state.camera.position[0] -= speed;
if (state.keys.e) state.camera.position[0] += speed;
```
**Penjelasan:**
Membaca input tombol `Q` dan `E` untuk memindahkan koordinat kamera di sumbu X. Secara khusus, perubahan specular/highlight terjadi dengan jelas saat kamera bergerak karena perhitungan specular bergantung langsung pada `viewDirection` (arah kamera ke objek).

### Challenge D — Non-Uniform Scale Mode
**Kode (di fungsi konfigurasi scale & handler):**
```javascript
["X", "Y", "Z"].forEach((axis) =>
  (document.querySelector(`#scale${axis}Control`).oninput = (e) => {
    state.scale[axis === "X" ? 0 : axis === "Y" ? 1 : 2] = Number(e.target.value);
  })
);
```
**Penjelasan:**
Non-uniform scale mengubah skala objek secara tidak proporsional (misalnya ditarik lebih pipih). Pada kondisi ini, perhitungan **Normal Matrix** bertugas memastikan vektor normal tetap tegak lurus dengan permukaan meskipun bentuk objek telah berubah.

### Challenge E — Light Orbit
**Kode (di `updateCamera`):**
```javascript
if (state.lightOrbit) {
  state.light[0] = Math.sin(state.time) * 3;
  state.light[2] = Math.cos(state.time) * 3;
}
```
**Penjelasan:**
Apabila orbit aktif, koordinat *light* X dan Z akan berotasi melingkar di sekeliling objek dengan memanfaatkan kalkulasi trigonometri sinus dan cosinus dari properti `state.time` (waktu).

### Challenge F — Lighting Components Toggle
**Kode (di HUD/Event Listener & Shader):**
```javascript
["ambient", "diffuse", "specular"].forEach((name) =>
  (document.querySelector(`#${name}Toggle`).onchange = (e) => {
    state.components[name] = e.target.checked;
  })
);
```
**Penjelasan:**
State boolean dikirimkan sebagai flag ke seragam WebGL. Di Fragment Shader, apabila `u_useDiffuse` false, komponen warna diffuse dikalikan dengan nol sehingga mati. Ini memungkinkan analisis visual individual dari masing-masing elemen pencahayaan.

### Challenge G — Mipmap Filtering
**Kode (di `updateTextureState`):**
```javascript
if (state.filter === "mipmap") {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
}
```
**Penjelasan:**
Alih-alih merender seluruh piksel tekstur asli dari jarak jauh (yang menyebabkan moire atau *flickering*), mipmapping merepresentasikan tekstur dari serangkaian resolusi yang diperkecil secara prasetel. Fungsi `gl.generateMipmap` membuat deretan ukuran dari gambar sumber tersebut secara otomatis.

---

## Pertanyaan Pemahaman

1. **Apa fungsi normal dalam lighting?** 
   Vektor normal menentukan arah hadap suatu permukaan poligon, yang krusial untuk menghitung sudut kedatangan cahaya dan menentukan kecerahan atau pantulan dari titik tersebut.
2. **Apa perbedaan face normal dan vertex normal?** 
   Face normal adalah vektor tegak lurus rata-rata untuk seluruh segmen luasan/permukaan (digunakan di Flat Shading). Vertex normal adalah vektor spesifik pada titik simpul (vertex) yang diinterpolasi secara halus di sela-sela ruang simpul (digunakan pada Smooth Shading).
3. **Apa perbedaan flat shading dan smooth shading?** 
   Flat shading menggunakan satu normal (face normal) yang sama untuk seluruh warna di dalam poligon, menyebabkan tampilannya tampak kotak-kotak bersudut. Smooth shading melakukan interpolasi antar normal di setiap verteks pada piksel (fragment), memberikan kesan lengkungan/permukaan yang halus.
4. **Mengapa normal harus dinormalisasi?** 
   Operasi produk skalar (dot product) mengasumsikan panjang vektor adalah 1 (unit vektor) untuk menghitung jarak sudut murni (cosinus theta). Jika tidak dinormalisasi, intensitas cahaya akan menjadi cacat/tidak teratur.
5. **Mengapa normal perlu ikut ditransformasikan?** 
   Saat objek diputar atau ditranslasikan pada koordinat model dunia, arah hadap permukaan (normal) otomatis ikut berubah orientasinya.
6. **Mengapa normal tidak selalu cukup dikalikan Model Matrix biasa?** 
   Karena operasi translasi memindahkan posisi (normal tak butuh translasi, hanya rotasi dan arah), dan operasi skala non-uniform (skala asimetris) dapat mendistorsi sudut dan menyebabkan vektor normal tidak lagi tegak lurus dengan permukaan.
7. **Apa fungsi Normal Matrix?** 
   Mengoreksi permasalahan distorsi tersebut dan mengkalibrasi ulang vektor normal sehingga ia selalu tegak lurus pada permukaan tanpa dipengaruhi translasi dan scale asimetris model.
8. **Apa yang dimaksud inverse-transpose secara konseptual?** 
   Membalik matriks lalu merotasikan dimensi sumbunya (transpose), di mana untuk rotasi hal ini akan saling menetralisir, namun pada vektor skala asimetris, ini akan menjaga sudut normal tetap ortogonal (tegak lurus).
9. **Apa fungsi ambient lighting?** 
   Mewakili pantulan cahaya secara global di lingkungan bayangan, mencegah bagian yang tidak tersentuh cahaya tampak hitam pekat 100%.
10. **Mengapa ambient sederhana bukan global illumination?** 
    Karena ambient statis diterapkan rata ke seluruh objek tanpa peduli arah cahaya pentalan (bouncing) sekunder. Global illumination menghitung hamburan cahaya aktual yang realistis.
11. **Apa fungsi diffuse lighting?** 
    Mensimulasikan sebaran pencahayaan (scattered) dari suatu sumber terang yang mengenai permukaan benda *matte* kasar (seperti kayu atau kertas).
12. **Apa arti `dot(N,L)`?** 
    Dot product antara Normal vektor dan arah cahaya (Light). Menghasilkan persentase nilai kecerahan cahaya yang diterima permukaan berdasar tingkat ketegak-lurusannya.
13. **Mengapa digunakan `max(dot(N,L),0)`?** 
    Karena jika sudut normal membelakangi cahaya (>90 derajat), nilainya menjadi negatif. Fungsi `max(..., 0)` mencegah piksel memproses warna atau energi cahaya yang bernilai negatif.
14. **Apa fungsi light direction?** 
    Menunjukkan vektor posisi dari area piksel (fragment) menuju titik sumber cahaya.
15. **Apa fungsi view direction?** 
    Menunjukkan arah dari area piksel yang dilihat menuju mata/kamera pengamat.
16. **Apa fungsi reflection direction?** 
    Menunjukkan sudut pantul cahaya sempurna dari suatu permukaan setelah ia bersinggungan dengan sudut datang (berdasarkan vektor normal).
17. **Apa fungsi specular lighting?** 
    Menciptakan "highlight" pendar atau kilapan terang, ciri khas pada benda-benda mengkilap seperti logam atau plastik.
18. **Apa pengaruh shininess?** 
    Faktor pangkat pada specular; nilai yang semakin tinggi membuat pantulan cahaya pendar/highlight ini menjadi lebih sempit, tajam, dan memusat (ciri permukaan licin sempurna).
19. **Apa yang dimaksud Phong Reflection Model sederhana?** 
    Rumus empiris penggabungan kalkulasi warna piksel dengan menambahkan total: `Ambient + Diffuse + Specular`.
20. **Apa perbedaan per-vertex dan per-fragment lighting?** 
    Per-vertex pencahayaan dihitung di vertex shader (hasilnya dikomputasi kaku lalu digradasi warna). Per-fragment dihitung secara piksel per piksel di fragment shader (Phong Shading, hasilnya jauh lebih mulus, terutama specular).
21. **Apa fungsi UV coordinate?** 
    Menunjuk titik ordinat matriks koordinat spesifik (skala 0.0 sampai 1.0) pada tekstur 2D yang harus diwarnai di muka segitiga poligon 3D.
22. **Apa fungsi texture sampler?** 
    Variabel khusus dalam WebGL (bertipe *sampler2D*) yang dipakai di fragment shader untuk memanggil warna dan mengekstrak gambar yang terikat (bound texture).
23. **Apa yang dimaksud texture sampling?** 
    Proses ekstraksi warna / rujukan koordinat piksel (RGB) dari gambar tekstur di titik UV tertentu.
24. **Apa perbedaan pixel dan texel?** 
    Piksel adalah unit terkecil elemen penampil layar. Texel (Texture Element) adalah unit terkecil elemen representasi dari gambar asal tekstur yang dibaca.
25. **Apa perbedaan NEAREST dan LINEAR?** 
    `NEAREST` mengambil bulat satu nilai piksel warna murni yang jarak koordinatnya paling dekat (terlihat *pixelated/blocky*). `LINEAR` melakukan interpolasi / rata-rata blending dengan tetangganya sehingga tampak halus / blur.
26. **Apa fungsi wrapping?** 
    Menentukan perlakuan rendering tekstur saat koordinat matriks UV jatuh di luar rentang angka logis standar (0.0 sampai 1.0).
27. **Apa perbedaan REPEAT dan CLAMP_TO_EDGE?** 
    `REPEAT` mengulang kembali gambar dari awalan, membentuk pola ubin bertumpuk tanpa akhir. `CLAMP_TO_EDGE` akan menyalin atau memanjangkan dan menarik piksel terluar yang paling ujung terus sampai tak terbatas (meleber).
28. **Mengapa UV scale diperlukan untuk mudah melihat wrapping?** 
    Dengan menskala titik bacaan UV melebihi rentang dasar > 1.0, barulah efek pengulangan tekstur berlebih / batasan luar gambar dapat terlihat dengan jelas.
29. **Mengapa texture dapat digunakan sebagai base color?** 
    Alokasi warna gambar yang statis tersebut sangat realistis untuk digunakan menjadi elemen dasar refleksi dan bayangan kalkulasi albedo.
30. **Bagaimana lighting dan texture digabungkan?** 
    Pada perhitungan warna di fragment shader, warna titik ekstrak tekstur (baseColor) cukup dikalikan dengan total faktor iluminasi (ambient + diffuse), kemudian ditambahkan dengan binar specular sebagai highlight: `baseColor * (ambient + diffuse) + specular`.

---

## Pertanyaan Analisis

1. **A — Normal (Mengapa hasil shading berubah padahal geometri sama?)**
   Karena pada flat shading arah cahaya bertumbukan rata (kaku) terhadap satu face/dinding poligon yang sama. Sebaliknya saat diubah ke smooth shading (vertex normal diinterpolasikan), gradasi vektor merubah sudut cahaya memantul lebih mulus seolah poligon tersebut melengkung bundar, sehingga transisi cahaya terlihat gradatif halus.

2. **B — Diffuse (Jika dot(N,L) = 1, apa artinya secara geometris?)**
   Artinya vektor normal (N) dan vektor datangnya cahaya (L) paralel persis (sudut antara keduanya 0 derajat). Cahaya menabrak permukaan secara tegak lurus sempurna, membuat titik tersebut merupakan iluminasi area yang paling terang (mendapat cahaya terkuat secara optimal).

3. **C — Specular (Mengapa highlight dapat berubah ketika camera bergerak?)**
   Karena intensitas specular adalah produk sudut antara *viewDirection* (arah ke pengamat) dan pantulan (*reflectionDirection*). Bila posisi kamera berubah, *viewDirection* turut berubah yang mengakibatkan pergeseran area mana pancaran pantulan highlight yang ideal sampai tepat sejajar ke mata.

4. **D — Texture (Mengapa texture memberi detail visual tanpa menambah triangle?)**
   Karena detail visual tekstur dipetakan, ditempel, dan diekstrak mentah-mentah secara individual (per fragment) selama proses rasterisasi (menggambar piksel dalam poligon) ketimbang membuat relief geometri fisikal yang membutuhkan daya komputasi segitiga tambahan.

5. **E — Normal Matrix (Mengapa non-uniform scaling menjadi kasus penting?)**
   Karena jika objek hanya ditarik (distretch) secara searah asimetris, vektor normal permukaan yang semula ortogonal akan ikut terpengaruh regangan matriks dan bisa menjadi condong memanjang/tergeser, yang menyebabkan sudut datang dan pantul cahaya menjadi tidak wajar dan membiaskan perhitungan fisika cahayanya. Normal Matrix meng-inverse transposisi ini sehingga normal kembali selaras.

---
**Catatan Debugging:**
- Bila menghadapi CORS Issue saat mengambil SVG, atur attribute `image.crossOrigin = "anonymous";`.
- Apabila terjadi error texture filter saat mengganti ke mipmap, pastikan teksturnya mematuhi aturan dimensi *power of 2* jika digunakan di implementasi murni tanpa ekstensi perbaikan WebGL. Pada WebGL2, non-power of 2 (NPOT) texturing didukung secara native penuh.
