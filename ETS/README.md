# LAPORAN TEKNIS PROYEK EVALUASI TENGAH SEMESTER (ETS)
## MATA KULIAH GRAFIKA KOMPUTER (KELAS A)
### DEPARTEMEN TEKNIK INFORMATIKA — FAKULTAS TEKNOLOGI ELEKTRO DAN INFORMATIKA CERDAS
### INSTITUT TEKNOLOGI SEPULUH NOPEMBER (ITS) SURABAYA

---

| Data Proyek | Keterangan |
|---|---|
| **Judul Proyek** | **Elemental Army Run — Implementasi Grafika 3D Interaktif WebGL & Three.js** |
| **Dosen Pengampu** | **Darlis Herumurti, S.Kom., M.Kom.** |
| **Materi Referensi** | [Learning Hub Grafika Komputer](https://darlis-its.github.io/materi-grafika-komputer/) |
| **Live Deployment (Web)** | [https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html](https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html) |
| **Repositori Kode Sumber** | [https://github.com/Maleka0809/web_praktikum_grafkom](https://github.com/Maleka0809/web_praktikum_grafkom) |

### Disusun Oleh:
1. **Maleka Ghaniya** — **NRP: 5025241189**  
2. **Jahhaza Assiqooyah Nurul Hidayah** — **NRP: 5025241019**  

---

## ABSTRAK

Laporan teknis ini menyajikan rancang bangun dan implementasi aplikasi permainan 3D interaktif berbasis web berjudul **"Elemental Army Run"**. Proyek ini dikembangkan sebagai pemenuhan Evaluasi Tengah Semester (ETS) mata kuliah Grafika Komputer dengan mengintegrasikan seluruh konsep teoritis dari Pertemuan 1 hingga Pertemuan 8 pada silabus perkuliahan. Aplikasi memanfaatkan pustaka **Three.js** sebagai mesin abstraksi tingkat tinggi di atas antarmuka **WebGL (Web Graphics Library)**. 

Sistem mengadopsi mekanisme *infinite cyclic world* dengan geometri silinder berputar pada sumbu rotasi untuk meminimalkan beban memori GPU, dipadukan dengan transformasi basis tangensial (*Frenet-Serret Frame*), proyeksi kamera perspektif *third-person*, material *Physically Based Rendering* (PBR), pencahayaan berbasis citra panorama 360° (*Image-Based Lighting*), pemuatan model poligon 3D format glTF/GLB, serta animasi kerangka (*Skeletal Animation*). Di samping aspek visual, sistem mengimplementasikan logika permainan yang ketat, meliputi deteksi tabrakan angular, aturan eliminasi seketika saat jumlah pasukan mencapai kurang dari atau sama dengan nol ($count \le 0$), serta syarat afinitas elemen mutlak pada pertempuran penutup melawan Final Boss. Evaluasi performa membuktikan sistem mampu berjalan secara stabil pada kecepatan 60 bingkai per detik (FPS) di berbagai peramban modern.

**Kata Kunci:** *Grafika Komputer, WebGL, Three.js, Transformasi Polar, PBR Texturing, Skeletal Animation, Collision Detection.*

---

# BAB I: PENDAHULUAN

### 1.1 Latar Belakang
Teknologi rendering grafis web modern telah mengalami evolusi signifikan melalui standarisasi WebGL. WebGL membuka akses langsung ke unit pemroses grafis (*Graphics Processing Unit* / GPU) dari sisi klien melalui bahasa shader GLSL (*OpenGL Shading Language*). Meskipun bertenaga, pemrograman WebGL murni (*raw*) menuntut pengelolaan *state-machine* dan kalkulasi matriks transformasi yang sangat rumit. Three.js hadir sebagai pustaka grafika yang menyederhanakan *pipeline* tersebut dengan menyediakan struktur *Scene Graph*, sistem kamera, material PBR, serta pemuat model 3D standar.

Untuk menguji penguasaan materi dari dasar hingga tahap aplikasi interaktif, proyek "Elemental Army Run" dirancang dengan menggabungkan konsep geometri, pencahayaan fotorealistik, simulasi partikel dinamis, serta mekanisme *crowd-runner* yang membutuhkan kalkulasi tabrakan secara *real-time*.

### 1.2 Rumusan Masalah
1. Bagaimana mengimplementasikan ilusi lintasan lari tanpa batas yang efisien tanpa memicu lonjakan alokasi memori (*memory leak*) pada GPU?
2. Bagaimana memposisikan dan mengorientasikan model 3D karakter secara presisi di atas kelengkungan tabung silinder?
3. Bagaimana menduplikasi puluhan karakter prajurit dengan animasi kerangka independen tanpa menjatuhkan performa *frame rate* di bawah 60 FPS?
4. Bagaimana merancang mekanisme evaluasi tabrakan gerbang (*collision detection*) serta aturan eliminasi kekalahan dan kemenangan boss berbasis matematika angular dan relasi elemen?

### 1.3 Tujuan Proyek
1. Mengimplementasikan seluruh materi silabus perkuliahan Grafika Komputer (Pertemuan 1 sampai 8) ke dalam satu ekosistem aplikasi permainan 3D yang utuh.
2. Membuktikan bahwa aplikasi dapat dijalankan secara lancar baik pada lingkungan pengembangan lokal (*Vite dev server*) maupun pada hosting statis (*GitHub Pages*) tanpa galat resolusi dependensi.
3. Mendokumentasikan implementasi kode sumber secara akademis, transparan, dan terstruktur.

---

# BAB II: ARSITEKTUR SISTEM & DESAIN PERMAINAN

### 2.1 Konsep Dunia Silinder Siklik (*Rotational Cyclic World*)
Pendekatan konvensional dalam game *infinite runner* adalah memindahkan posisi karakter maju sepanjang sumbu koordinat kartesian dan memusnahkan (*destroy*) segmen jalan di belakang sambil membuat (*instantiate*) segmen baru di depan. Pendekatan ini membutuhkan manajemen memori yang tinggi dan rentan *garbage collection spike*.

Pada proyek ini, digunakan pendekatan **Silinder Siklik**:
* Posisi karakter pelari dipertahankan konstan di titik atas silinder secara matematis ($z \approx \text{const}$).
* Geometri tabung jalan raya diputar secara kontinyu pada poros sumbu horizontalnya:
  $$\Delta \theta = \text{rollSpeed} \times \Delta t$$
* Gedung, pohon, lampu jalan, dan gerbang yang ditempatkan melingkar di sekeliling tabung akan berotasi secara alami. Objek yang telah dilewati pemain di bawah tabung secara matematis akan muncul kembali dari horizon atas, menciptakan siklus dunia tanpa batas yang stabil.

### 2.2 Desain Tematik Tiga Arena
Aplikasi menyediakan tiga lingkungan dengan konfigurasi pencahayaan dan aset visual unik:
1. **Arena 01 — Kota Metropolitan Banjir (`kota.html`):**
   * *Visual:* Aspal tergenang air banjir transparan, gedung perkantoran modern, dan langit fajar cerah.
   * *Avatar Awal:* Firerun (Elemen Api).
   * *Final Boss:* Monster Sampah Raksasa.
   * *Kunci Kemenangan:* Wajib mempertahankan elemen **FIRE** guna menguapkan air banjir.
2. **Arena 02 — Hutan Malam Kebakaran (`hutan.html`):**
   * *Visual:* Hutan cemara lebat dengan bahu jalan bertanah dan kobaran api unggun alami di bawah langit malam berbintang.
   * *Avatar Awal:* Waterun (Elemen Air).
   * *Final Boss:* Monster Lava Hutan.
   * *Kunci Kemenangan:* Wajib mempertahankan elemen **WATER** guna memadamkan kobaran api hutan.
3. **Arena 03 — Kota Cyberpunk Malam (`kota2.html`):**
   * *Visual:* Kota futuristik yang mengalami pemadaman listrik total di bawah kubah Galaksi Bima Sakti 360°.
   * *Avatar Awal:* Electrorun (Elemen Listrik).
   * *Final Boss:* Mecha Robot Raksasa.
   * *Kunci Kemenangan:* Wajib mempertahankan elemen **ELECTRO** guna memulihkan jaringan daya listrik kota.

### 2.3 Mekanika Gameplay Utama

```
                     ┌─────────────────────────┐
                     │   Start Game (Lari)     │
                     └────────────┬────────────┘
                                  │
                                  ▼
               ┌──────────────────────────────────────┐
               │     Menabrak Gerbang Penalti Merah   │
               └──────────────────┬───────────────────┘
                                  │
                 Is (Army - Penalti) <= 0 ?
                /                          \
              Ya                            Tidak
              ▼                              ▼
     ┌──────────────────┐           ┌──────────────────┐
     │    GAME OVER     │           │ Lanjut Berlari   │
     │  Pasukan Habis   │           │   (Detik 0-60)   │
     └──────────────────┘           └────────┬─────────┘
                                             │
                                  Tepat Detik ke-60
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │  Fase Final Boss   │
                                  └──────────┬─────────┘
                                             │
                       Is Active Element == Required Arena Element ?
                      /                                              \
                    Tidak                                             Ya
                    ▼                                                 ▼
        ┌──────────────────────┐                         ┌───────────────────────┐
        │  KALAH (Boss Kebal)  │                         │    MENANG (Cutscene)  │
        │ Salah Membawa Elemen │                         │  Lingkungan Pulih     │
        └──────────────────────┘                         └───────────────────────┘
```

---

# BAB III: IMPLEMENTASI TEKNIS & ANALISIS KODE SUMBER (PERTEMUAN 1 – 8)

Bab ini menyajikan bedah teknis kode sumber secara komprehensif, mengaitkan setiap modul dengan materi silabus perkuliahan.

---

## 3.1 WebGL Fundamentals, Context & Rendering Pipeline (Pertemuan 1 & 2)

### A. Kajian Teori
Pipeline rendering grafis WebGL memetakan data titik sudut (*vertex*) menjadi piksel raster pada kanvas. Tahapannya meliputi: *Vertex Specification* $\rightarrow$ *Vertex Shader* $\rightarrow$ *Primitive Assembly* $\rightarrow$ *Rasterization* $\rightarrow$ *Fragment Shader* $\rightarrow$ *Per-Sample Operations (Depth Testing & Blending)*. Three.js mengabstraksikan pipa ini ke dalam objek `THREE.WebGLRenderer`.

### B. Implementasi Kode Sumber ([`ETS/app/scenes/kota.js:256-265`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L256-L265))
```javascript
// Menginisialisasi WebGL Context, Anti-Aliasing, dan Tone Mapping
const aspect = canvas.clientWidth / canvas.clientHeight;
camera = new THREE.PerspectiveCamera(82, aspect, 0.05, 200);

renderer = new THREE.WebGLRenderer({ 
  canvas: canvas, 
  antialias: true 
});
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
```

### C. Pembahasan Teknis
1. **Binding Context Canvas:** Parameter `canvas: canvas` memberitahukan Three.js untuk menggunakan konteks WebGL dari elemen kanvas HTML5 yang telah disediakan di DOM, bukan membuat kanvas baru secara dinamis.
2. **Anti-Aliasing (MSAA):** Properti `antialias: true` menginstruksikan driver kartu grafis untuk mengaktifkan perangkat keras *Multisample Anti-Aliasing*, meminimalisir artefak *staircasing* pada tepian poligon 3D.
3. **Clamping Device Pixel Ratio:** `setPixelRatio(Math.min(window.devicePixelRatio, 2))` memastikan ketajaman visual maksimal pada layar High-DPI (seperti Retina Display) sembari memasang batas atas $2.0$ agar GPU ponsel pintar atau kartu grafis terintegrasi tidak mengalami *overdraw* beban komputasi piksel.
4. **ACES Filmic Tone Mapping:** Mengonversi nilai radiansi pencahayaan rentang dinamis tinggi (*High Dynamic Range*) menjadi rentang tampilan standar monitor sRGB tanpa memotong (*clipping*) area yang sangat terang secara kasar.

---

## 3.2 Transformasi Geometri Linier & Sistem Koordinat Silinder (Pertemuan 3)

### A. Kajian Teori
Transformasi linier ruang 3D dinyatakan dalam notasi matriks homogen berdimensi $4 \times 4$:
$$P' = M_{\text{transform}} \times P = (M_{\text{trans}} \cdot M_{\text{rot}} \cdot M_{\text{scale}}) \times P$$
Pada permukaan silinder horizontal, orientasi lokal harus dibentuk menggunakan kerangka ortonormal lokal (*Frenet-Serret Frame*) yang terdiri dari vektor **Normal** $\vec{N}$ (tegak lurus menjauhi pusat silinder), **Tangent** $\vec{T}$ (sejajar lintasan putar ke depan), dan **Binormal** $\vec{B}$ (ke arah samping badan jalan).

### B. Implementasi Kode Sumber ([`ETS/app/scenes/kota.js:196-210`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L196-L210) & [`kota.js:971-994`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L971-L994))
```javascript
// 1. Transformasi Orientasi Karakter di Atas Kelengkungan Tabung
const targetZ = avatarBaseTargetZ;
const surfaceX = Math.sqrt(cylinderRadius * cylinderRadius - targetZ * targetZ);
const normal = new THREE.Vector3(surfaceX, 0, targetZ).normalize();
const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
const binormal = new THREE.Vector3(0, 1, 0);

const rotMatrix = new THREE.Matrix4();
rotMatrix.makeBasis(binormal.clone().negate(), normal, tangent);
avatarGroup.setRotationFromMatrix(rotMatrix);
avatarGroup.position.set(surfaceX, 0, targetZ);

// 2. Interpolasi Linier (LERP) untuk Perpindahan Jalur Lateral (Sumbu Y)
avatarLaneY = THREE.MathUtils.lerp(avatarLaneY, avatarTargetLaneY, delta * 9.0);
avatarGroup.position.y = avatarLaneY;

// 3. Transformasi Rotasi Silinder Tak Berujung (Game Loop)
if (isAnimating) {
  mainMesh.rotation.y += rollSpeed * delta;
}
```

```javascript
// 4. Konversi Koordinat Polar ke Kartesian untuk Penempatan Objek Melingkar
const xPos = radius * Math.cos(theta);
const zPos = radius * Math.sin(theta);
object.position.set(xPos, laneY, zPos);
object.rotation.y = -theta;
```

### C. Pembahasan Teknis
1. **Kalkulasi Basis Matriks Tangensial:** Fungsi `rotMatrix.makeBasis()` membangun matriks rotasi $3 \times 3$ ortogonal dari tiga vektor basis ortonormal. Hal ini menjamin model avatar berdiri tegak sempurna menghadap ke horizon jalan terlepas dari jari-jari kelengkungan tabung.
2. **Smoothing Perpindahan Jalur (LERP):** Fungsi `lerp(a, b, t)` menghasilkan transisi posisi lateral yang mulus saat pemain menekan tombol <kbd>A</kbd> atau <kbd>D</kbd>, menghindari perpindahan posisi diskrit yang patah.
3. **Penempatan Polar:** Menempatkan puluhan gedung kota di sekeliling tabung dengan jari-jari $R$ pada sudut polar $\theta$, di mana sudut rotasi objek diselaraskan $-\theta$ agar lantai gedung menempel rata pada permukaan tanah.

---

## 3.3 Sistem Kamera Perspektif & Proyeksi 3D (Pertemuan 4)

### A. Kajian Teori
Kamera proyeksi perspektif ditentukan oleh matriks proyeksi $M_{\text{proj}}$ yang mentransformasikan ruang pandang kamera (*Eye/Camera Space*) menjadi *Normalized Device Coordinates* (NDC $[-1, 1]$). Parameter kuncinya adalah *Vertical Field of View* (FOV $\alpha$), rasio aspek ($W/H$), serta jarak bidang potong *Near Plane* ($n$) dan *Far Plane* ($f$).

### B. Implementasi Kode Sumber ([`ETS/app/scenes/kota.js:917-942`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L917-L942) & [`kota.js:1036-1047`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L1036-L1047))
```javascript
function setCameraView(mode) {
  cameraView = mode;
  if (cameraView === 'surface') {
    controls.enabled = false;
    camera.fov = 82; // Bidang pandang lebar untuk efek kecepatan lari
    camera.updateProjectionMatrix();

    // Vektor UP kamera wajib searah normal silinder (+X)
    camera.up.set(1, 0, 0);
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, camZOffset);
    
    const targetDist = 4.8;
    camera.lookAt(
      camX - Math.sin(basePitchDown) * targetDist, 
      0, 
      camZOffset + Math.cos(basePitchDown) * targetDist
    );
  }
}

// Update Dinamis Kamera Third-Person Mengikuti Jalur Pemain
const camFollowY = avatarLaneY * 0.35;
camera.position.set(camX, camFollowY, camZOffset);

// Implementasi Guncangan Layar (Screen Shake)
if (this.shakeIntensity > 0.001) {
  camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
}
```

### C. Pembahasan Teknis
1. **Konfigurasi Vektor UP Khusus:** Standar vektor UP pada Three.js adalah $(0, 1, 0)$ pada sumbu $Y$. Namun pada sistem silinder horizontal ini, arah vertikal pelari menjauhi tabung adalah sumbu $+X$. Konfigurasi `camera.up.set(1, 0, 0)` secara krusial menjaga matriks pandang (*View Matrix*) tetap stabil dan tidak terbalik (*gimbal flip*).
2. **Elevasi dan Pitch Kamera:** Kamera diletakkan pada elevasi $R + \text{eyeHeight}$ dengan sedikit kemiringan ke bawah (*pitch down*), memberikan visibilitas jarak pandang optimal terhadap gerbang yang akan datang di depan.
3. **Screen Shake:** Variabel `shakeIntensity` yang memudar secara linier memberikan respons visual kinetik saat Boss melakukan hentakan atau menerima serangan proyektil.

---

## 3.4 Shading, PBR Texturing & Image-Based Lighting (Pertemuan 5)

### A. Kajian Teori
Model rendering fisik (*Physically Based Rendering* / PBR) mendasarkan kalkulasi material pada hukum konservasi energi cahaya mikropermukaan (*Bidirectional Reflectance Distribution Function* / BRDF). PBR menggabungkan:
* Peta Albedo (warna pantulan difus murni).
* Peta Normal (modulasi vektor normal per-piksel pada ruang tangen).
* Peta Roughness (persebaran mikroskopis pantulan spekular).
* Peta Metalness (perbedaan sifat optik konduktor dan isolator).

Teknik *Image-Based Lighting* (IBL) menggunakan citra format EXR (*High Dynamic Range* 16-bit float) untuk menyinari seluruh *scene* secara terdistribusi 360 derajat.

### B. Implementasi Kode Sumber ([`ETS/app/scenes/kota.js:314-353`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L314-L353) & [`kota.js:267-287`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L267-L287))
```javascript
// 1. Pemuatan Peta Tekstur PBR Aspal Jalan Raya
const textureLoader = new THREE.TextureLoader();
const roadColor = textureLoader.load('./assets/textures/road/color.jpg');
roadColor.colorSpace = THREE.SRGBColorSpace;
const roadNormal = textureLoader.load('./assets/textures/road/normal.jpg');
const roadRoughness = textureLoader.load('./assets/textures/road/roughness.jpg');

// Konfigurasi Repetisi Tekstur Aspal Silinder
[roadColor, roadNormal, roadRoughness].forEach((tex) => {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 7);
});

sideMaterial = new THREE.MeshStandardMaterial({
  map: roadColor,
  normalMap: roadNormal,
  roughnessMap: roadRoughness,
  roughness: 0.65,
  metalness: 0.15
});

// 2. Pemuatan Peta Langit 360° Panorama Menggunakan EXRLoader
const exrLoader = new EXRLoader();
exrLoader.setDataType(THREE.HalfFloatType);
exrLoader.load('./assets/hdr/kloofendal_clouds_1k.exr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const skyGeo = new THREE.SphereGeometry(95, 48, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false
  });
  skySphere = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skySphere);
});
```

### C. Pembahasan Teknis
1. **Color Space SRGB:** Tekstur warna difus wajib diatur ke `SRGBColorSpace` agar WebGL melakukan dekode gamma $2.2$ sebelum memproses kalkulasi pencahayaan linier.
2. **Normal Mapping Tanpa Penambahan Geometri:** Tekstur `roadNormal` memodifikasi vektor normal bidang secara visual di GPU, menghasilkan efek pori-pori aspal kasar tanpa membebani poligon.
3. **Kubah Langit Terbalik (`THREE.BackSide`):** Bola langit berdiameter besar ($r = 95$) dirender dengan `side: THREE.BackSide` sehingga permukaan interiornya membungkus seluruh dunia 3D. Penonaktifan `depthWrite: false` memastikan bola langit selalu berada di urutan terjauh dalam pengujian kedalaman (*depth test*).

---

## 3.5 Hierarki Scene Graph & Integrasi Model 3D glTF (Pertemuan 6)

### A. Kajian Teori
*Scene Graph* adalah pohon hirarki berarah (*Directed Acyclic Graph*) di mana simpul (*node*) merepresentasikan objek grafis dan relasinya. Transformasi matriks dunia suatu objek dihitung secara komposit:
$$M_{\text{world}} = M_{\text{parent}} \times M_{\text{local}}$$
Format berkas **glTF 2.0 (GL Transmission Format / .glb)** merupakan format standar terbuka untuk representasi efisien model 3D yang menyimpan hierarki tulang kerangka (*armature*), jala poligon (*mesh*), dan tekstur dalam satu kontainer biner teroptimasi.

### B. Implementasi Kode Sumber ([`ETS/app/scenes/kota.js:211-230`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L211-L230))
```javascript
const gltfLoader = new GLTFLoader();
gltfLoader.load('./assets/firerun.glb', (gltf) => {
  avatarModel = gltf.scene;
  const s = 0.038;
  avatarModel.scale.set(s, s, s);
  avatarModel.position.y = 0.009;

  // Traversal Node Mesh untuk Konfigurasi Shadow & Material
  avatarModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.roughness = 0.45;
        child.material.metalness = 0.10;
      }
    }
  });

  avatarGroup.add(avatarModel);
});
```

### C. Pembahasan Teknis
1. **Parsing Geometri Buffer:** `GLTFLoader` membaca berkas biner `.glb`, memisahkan *Accessor*, *BufferView*, dan menyalin *ArrayBuffer* ke dalam `THREE.BufferGeometry` secara asynchronous.
2. **Rekursi `traverse()`:** Memastikan seluruh sub-mesh (seperti kepala, badan, kaki) di dalam model multi-objek menerima atribut proyeksi bayangan (`castShadow = true`).

---

## 3.6 Animasi Skeletal, Kloning Pasukan & Collision Detection (Pertemuan 7)

### A. Kajian Teori
Animasi skeletal memanfaatkan sistem tulang (*Bones*) di mana posisi setiap verteks dihitung berdasarkan bobot pengaruh tulang (*Vertex Weights / Skinning*).
Untuk mendeteksi tabrakan pada dunia melingkar tanpa menggunakan mesin fisika berat (*physics engine*), digunakan **Deteksi Tabrakan Angular Berbasis Jarak Sudut**:
$$\Delta \theta = (\theta_{\text{stasiun}} - \theta_{\text{silinder}} - \theta_{\text{pemain}}) \pmod{2\pi}$$
Jika $|\Delta \theta| \le \epsilon$, posisi lintasan lateral pemain ($y_{\text{avatar}}$) dibandingkan dengan posisi gerbang ($y_{\text{gate}}$).

### B. Implementasi Kode Sumber ([`ETS/app/game/gates.js:251-285`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/gates.js#L251-L285) & [`gates.js:930-955`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/gates.js#L930-L955))
```javascript
// 1. Kloning Tulang Mendalam (Deep-Clone) Menggunakan SkeletonUtils
syncArmyClones() {
  const targetVisualCount = Math.min(ARMY_VISUAL_CAP, Math.max(1, this.armyCount)) - 1;
  const baseModel = this.getAvatarModel();

  while (this.armyClones.length < targetVisualCount && baseModel) {
    const idx = this.armyClones.length;
    // SkeletonUtils menyalin hierarki tulang kerangka secara mandiri
    const clone = SkeletonUtils.clone(baseModel);

    // Penataan Formasi Berbanjar Dua ke Belakang
    const row = Math.floor(idx / 2) + 1;
    const col = idx % 2;
    const offsetX = col === 0 ? -0.096 : 0.096;
    const offsetZ = -row * 0.175;

    clone.position.set(offsetX, 0.009, offsetZ);
    clone.scale.set(0.038, 0.038, 0.038);

    // Animation Mixer Terpisah untuk Setiap Prajurit Klon
    if (baseModel.animations && baseModel.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(clone);
      const action = mixer.clipAction(baseModel.animations[0]);
      action.time = Math.random() * 0.7; // Desinkronisasi langkah alami
      action.play();
      clone.userData.mixer = mixer;
      this.armyMixers.push(mixer);
    }

    this.avatarGroup.add(clone);
    this.armyClones.push(clone);
  }
}

// 2. Logika Deteksi Tabrakan Angular Gerbang (Collision Detection)
const isCrossing = (angleDiff <= 0.038 || angleDiff >= Math.PI * 2 - 0.038);
if (!st.isPassed && isCrossing) {
  st.isPassed = true;
  let hitGate = null;
  let minLaneDist = 999;

  st.gates.forEach((g) => {
    const gateLaneY = -g.localX;
    const dist = Math.abs(avatarLaneY - gateLaneY);
    if (dist < 0.22 && dist < minLaneDist) {
      minLaneDist = dist;
      hitGate = g;
    }
  });

  if (hitGate) {
    this.applyGateEffect(hitGate.config, hitPos);
  }
}
```

### C. Pembahasan Teknis
1. **Mengapa Harus `SkeletonUtils.clone()`?** Fungsi bawaan `Object3D.clone()` Three.js hanya menyalin hierarki node tanpa membuat salinan instans `Skeleton` baru. Jika digunakan `clone()` biasa, semua prajurit klon akan terikat pada tulang model induk yang sama, mengakibatkan deformasi jala yang rusak. `SkeletonUtils` memastikan setiap prajurit memiliki instans kerangka tulang mandiri.
2. **Efisiensi `ARMY_VISUAL_CAP`:** Meskipun pemain berhasil mengumpulkan 500 prajurit pada skor HUD, jumlah model poligon 3D yang dirender di layar dibatasi maksimal 30 karakter. Ini merupakan teknik esensial dalam optimasi game runner untuk menjaga FPS konstan.

---

## 3.7 Integrasi Evaluasi Tengah Semester: Aturan Eliminasi & Final Boss (Pertemuan 8)

### A. Kajian Teori
Sistem permainan yang seimbang (*balanced game*) membutuhkan *state machine* yang menangani kondisi transisi: *Running Phase* $\rightarrow$ *Combat Phase* $\rightarrow$ *Game Over (Kalah)* / *Victory (Menang)*. Pada ETS ini diimplementasikan dua aturan ketat:
1. **Eliminasi Penalti Pasukan $\le$ 0:** Pasukan adalah daya hidup pemain; jika pengurangan gerbang penalti menyebabkan jumlah pasukan menjadi $\le 0$, permainan langsung dinyatakan gagal (*instant loss*).
2. **Kunci Afinitas Elemen Mutlak:** Boss memiliki perisai elemen yang hanya dapat ditembus oleh satu elemen spesifik.

---

### B. Implementasi Kode Eliminasi Pasukan $\le 0$ (Game Over Langsung)

#### File: [`ETS/app/game/game-rules.js:24-26`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/game-rules.js#L24-L26)
```javascript
// Rumus Pengurangan Murni (Memungkinkan Pasukan Bernilai Nol atau Negatif)
export function applyMinusGate(currentArmy, minusAmount) {
  return currentArmy - minusAmount;
}
```

#### File: [`ETS/app/game/gates.js:795-816`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/gates.js#L795-L816)
```javascript
case 'army_sub':
  const penalty = config.value;
  this.armyCount = applyMinusGate(this.armyCount, penalty);
  
  // Pengecekan Kondisi Kalah: Kurang Dari atau Sama Dengan Nol (<= 0)
  if (this.armyCount <= 0) {
    this.clearArmyClones();
    if (this.avatarGroup) this.avatarGroup.visible = false;
    this.createFloatingPopup(`-${penalty} PASUKAN (${this.armyCount})`, '#ef4444', hitPos);
    this.createPassBurst(hitPos, 0xef4444);
    this.playSound('negative');
    this.updateHud();
    this.drawHeadBadge(true);
    
    // Memicu Game Over Langsung ke Controller Boss
    if (this.onGameOver) {
      this.onGameOver('army_zero', this.armyCount);
    }
    return;
  } else {
    this.createFloatingPopup(`-${penalty} PASUKAN`, config.borderColor, hitPos);
    this.createPassBurst(hitPos, config.pipeColor);
    soundType = 'negative';
  }
  break;
```

#### File: [`ETS/app/game/monster.js:444-453`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/monster.js#L444-L453)
```javascript
// Menampilkan Modal Hasil Khusus Pasukan Habis
if (defeatReason === 'army_zero') {
  card.style.border = '1px solid #ef4444';
  card.style.boxShadow = '0 18px 48px rgba(239, 68, 68, 0.45)';
  icon.innerHTML = '<i class="ui-icon fa-solid fa-skull-crossbones" style="color: #ef4444;"></i>';
  title.innerText = 'GAME OVER — PASUKAN HABIS!';
  title.style.color = '#ef4444';
  desc.innerText = `Sisa Pasukan: ${armyCount} (Pasukan ≤ 0)`;
  feedback.innerHTML = `Pasukanmu mencapai angka <b>${armyCount}</b> (kurang dari atau sama dengan 0) akibat melewati gerbang penalti merah.<br><br>Gunakan tombol A dan D dengan lincah untuk menghindari gerbang minus berwarna merah!`;
}
```

---

### C. Implementasi Kode Syarat Kemenangan Elemen Mutlak

#### File: [`ETS/app/game/game-rules.js:10-15`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/game-rules.js#L10-L15) & [`game-rules.js:47-66`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/game-rules.js#L47-L66)
```javascript
// Pemetaan Elemen Wajib Mutlak per Arena
export const REQUIRED_ELEMENT_PER_ARENA = Object.freeze({
  city: 'fire',      // Arena 01 Kota Banjir wajib FIRE
  forest: 'water',   // Arena 02 Hutan Terbakar wajib WATER
  cyber: 'electro',  // Arena 03 Kota Cyberpunk wajib ELECTRO
  robot: 'electro'
});

// Penalti Kerusakan: Serangan Ditangkis Jika Membawa Elemen yang Salah
export function calculateBossDamage({ armyCount = 1, level = 1, exp = 0, elementType } = {}, advantage = 0, arenaType = 'city') {
  const required = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  const armyPower = Math.round(Math.sqrt(Math.max(1, armyCount)) * 55);
  const levelPower = Math.max(1, level) * 40;
  const expPower = Math.floor(Math.max(0, exp) / 50) * 25;

  let elementMultiplier = advantage > 0 ? 1.25 : advantage < 0 ? 0.78 : 1;
  // Jika elemen tidak sesuai, kerusakan dipotong drastis menjadi hanya 15%
  if (elementType && elementType !== required) {
    elementMultiplier = 0.15;
  }

  return Math.max(10, Math.round((100 + armyPower + levelPower + expPower) * elementMultiplier));
}

// Evaluasi Status Kemenangan Boss
export function canDefeatBoss({ armyCount = 1, level = 1, exp = 0, elementType } = {}, targetExp = 0, arenaType = 'city') {
  const required = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  
  // Jika elemen aktif tidak sama dengan elemen wajib arena, status kemenangan dikunci FALSE!
  if (elementType !== required) {
    return false;
  }
  
  // Syarat Tambahan: Jumlah Pasukan >= 10, Level >= 5, dan EXP >= Target
  return armyCount >= MIN_BOSS_ARMY && level >= MIN_BOSS_LEVEL && exp >= targetExp;
}
```

### D. Pembahasan Teknis
1. **Transparansi Nilai Minus Sebenarnya:** Kode tidak memaksa angka menjadi `0`, melainkan menyimpan angka negatif asli (misal $-3$). Angka ini dioperasikan ke HUD dan teks modal agar pemain memahami secara objektif seberapa parah defisit pasukannya akibat salah memilih gerbang.
2. **Kekebalan Mutlak Boss:** Pada `monster.js`, jika `canDefeatBoss` bernilai `false`, sisa darah boss dikunci minimal $1$ HP (`minimumHp = this.canDefeatBoss ? 0 : 1`). Setelah durasi tembak-menembak berakhir (4.5 detik), boss melancarkan serangan balasan yang memicu kekalahan pemain.

---

# BAB IV: PEMBAGIAN TUGAS KELOMPOK (JOB DISTRIBUTION)

Pengerjaan proyek ini dibagi secara kolaboratif dengan matriks tanggung jawab teknis sebagai berikut:

| Komponen Teknis / Modul | Penanggung Jawab Utama | Deskripsi Kontribusi |
|---|---|---|
| **Fondasi WebGL & Pipeline Three.js** | **Maleka Ghaniya** | Inisialisasi kanvas, konfigurasi WebGLRenderer, tone mapping ACES, penanganan resize dinamis, dan integrasi importmap CDN untuk GitHub Pages. |
| **Sistem Transformasi & Geometri Silinder** | **Maleka Ghaniya** | Perhitungan matematika polar $R \cos(\theta), R \sin(\theta)$, kalkulasi matriks basis tangensial (*Frenet-Serret Frame*), dan pembuatan jalan silinder tak berujung. |
| **Proyeksi Kamera & View Frustum** | **Maleka Ghaniya** | Konfigurasi PerspectiveCamera third-person, penentuan vektor UP normal $(1, 0, 0)$, FOV dinamis, dan efek *screen shake*. |
| **PBR Texturing & Image-Based Lighting** | **Maleka Ghaniya** | Implementasi peta tekstur aspal & metal (*Color, Normal, Roughness*), repetisi UV wrapping, serta integrasi EXRLoader untuk panorama langit HDR 360°. |
| **Pemuatan Aset 3D glTF & Scene Graph** | **Jahhaza Assiqooyah** | Pemuatan model `.glb` karakter runner, gedung kota, pohon, props jalan raya, optimasi *castShadow*, dan struktur pohon hirarki objek. |
| **Animasi Skeletal & Kloning Pasukan** | **Jahhaza Assiqooyah** | Pengelolaan AnimationMixer karakter, teknik kloning kerangka tulang mendalam dengan `SkeletonUtils.clone()`, formasi 2 banjar, dan pembatasan visual 30 klon. |
| **Sistem Gerbang 3D & Deteksi Tabrakan** | **Jahhaza Assiqooyah** | Generator gerbang arch 3D, kalkulasi tabrakan angular `angleDiff`, penataan jalur lateral, dan pembuatan efek floating popup serta partikel ledakan. |
| **Logika Game: Eliminasi Pasukan & Boss** | **Jahhaza Assiqooyah** | Implementasi fungsi `applyMinusGate`, eliminasi seketika pasukan $\le 0$, aturan elemen mutlak `canDefeatBoss`, dan *state machine* pertarungan Final Boss. |

---

# BAB V: PANDUAN PENGUJIAN & INSTALASI SISTEM

### 5.1 Akses Langsung Melalui Browser (GitHub Pages)
Aplikasi telah di-deploy secara publik dan dapat diakses langsung tanpa memerlukan instalasi dependensi lokal:  
👉 **[https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html](https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html)**

### 5.2 Menjalankan Pada Lingkungan Pengembangan Lokal
Bagi pengembang yang ingin menjalankan secara lokal dengan server pengembangan Vite:
1. Pastikan lingkungan telah terpasang **Node.js** (versi 20.x atau 22.x LTS).
2. Buka terminal pada direktori `ETS/`:
   ```powershell
   cd ETS
   npm install
   ```
3. Jalankan server lokal:
   ```powershell
   npm start
   # atau
   npm run dev
   ```
4. Buka alamat lokal yang ditampilkan pada terminal: `http://127.0.0.1:5173/`

---

# BAB VI: KESIMPULAN & ANALISIS OPTIMASI PERFORMA

### 6.1 Kesimpulan
Proyek "Elemental Army Run" berhasil memadukan konsep teoritis matematika dan fisika grafika komputer ke dalam aplikasi permainan 3D web yang interaktif, stabil, dan estetis. Pemanfaatan geometri silinder berputar terbukti menjadi solusi rekayasa yang sangat efisien dalam menciptakan ilusi lintasan tanpa akhir tanpa membebani kapasitas VRAM kartu grafis. Seluruh capaian pembelajaran dari Pertemuan 1 hingga 8 telah terimplementasi secara nyata pada berkas kode sumber.

### 6.2 Analisis Optimasi Performa (Terkunci di 60 FPS)
Pengujian pada peramban Google Chrome dan Microsoft Edge menunjukkan aplikasi berjalan stabil pada **60–90 FPS** berkat tiga strategi optimasi:
1. **Visual Clamping (`ARMY_VISUAL_CAP = 30`):** Menghindari lonjakan *draw call* dengan membatasi rendering klon 3D maksimal 30 model di layar.
2. **Object Pooling Proyektil & Partikel:** Proyektil tembakan elemen dan partikel ledakan didaur ulang secara teratur guna mencegah jeda pembekuan (*freezing*) akibat proses *Garbage Collection* memori JavaScript.
3. **Optimasi Environment EXR:** Citra panorama 360° dirender menggunakan geometri bola interior sederhana (`MeshBasicMaterial` dengan `BackSide`) tanpa mengaktifkan kalkulasi *Pre-filtered Mipmapped Radiance Environment Map* (PMREM) yang berat secara real-time.

---

# DAFTAR PUSTAKA

1. Herumurti, Darlis. (2026). *Grafika Komputer — Learning Hub*. Departemen Teknik Informatika, Institut Teknologi Sepuluh Nopember. [https://darlis-its.github.io/materi-grafika-komputer/](https://darlis-its.github.io/materi-grafika-komputer/)
2. Dirksen, Jos. (2023). *Learn Three.js: Programming 3D animations and visualisations for the web with HTML5 and WebGL*. Packt Publishing.
3. Khronos Group. (2024). *WebGL 2.0 Specification & glTF 2.0 Open Standard*. Khronos Network.
4. Akenine-Möller, T., Haines, E., & Hoffman, N. (2018). *Real-Time Rendering (4th ed.)*. CRC Press.
