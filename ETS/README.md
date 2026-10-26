# LAPORAN TUGAS BESAR EVALUASI TENGAH SEMESTER (ETS)
## GRAFIKA KOMPUTER A — TAHUN AJARAN 2026
### DEPARTEMEN TEKNIK INFORMATIKA — INSTITUT TEKNOLOGI SEPULUH NOPEMBER

---

**Judul Proyek:** *Elemental Army Run — All-in-One 3D Interactive WebGL Runner*  
**Dosen Pengampu:** Darlis Herumurti, S.Kom., M.Kom.  
**Materi Referensi Silabus:** [Grafika Komputer — Learning Hub (Pertemuan 1 – 8)](https://darlis-its.github.io/materi-grafika-komputer/)  
**Live Demo Web (GitHub Pages):** [https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html](https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html)  
**Repositori GitHub:** [https://github.com/Maleka0809/web_praktikum_grafkom](https://github.com/Maleka0809/web_praktikum_grafkom)  

---

### 👥 IDENTITAS KELOMPOK
1. **Maleka Ghaniya** — **NRP: 5025241189**  
   *Peran Presentasi:* **Pembicara 1** (Fondasi Grafika, Transformasi Matematis, Kamera, Texturing & PBR)
2. **Jahhaza Assiqooyah Nurul Hidayah** — **NRP: 5025241019**  
   *Peran Presentasi:* **Pembicara 2** (Model 3D GLTF, Skeletal Animation, Interaktivitas Gate, Aturan Elemen & Boss)

---

# BAB I: PENDAHULUAN & KONSEP UTAMA PROYEK

### 1.1 Latar Belakang & Konsep Permainan
Game **"Elemental Army Run"** adalah aplikasi simulasi grafika komputer 3D interaktif berbasis web yang dibangun dengan pustaka **Three.js** di atas pipeline **WebGL (Web Graphics Library)**. Konsep permainan ini mengadopsi genre *crowd runner* 3D (seperti *Count Masters*), di mana seorang avatar pemimpin berlari di atas jalan silinder melingkar tanpa ujung (*infinite rolling cylinder*), mengumpulkan dan memperbanyak pasukan melalui gerbang interaktif (*gates*), serta berganti elemen (*Fire, Water, Electro*).

### 1.2 Tiga Arena Bertema Lingkungan
1. **Arena 01 — Kota Metropolitan Banjir (`kota.html`):** Jalan raya aspal tergenang gelombang air banjir. Avatar awal: **Firerun** (Api). Syarat Boss: Wajib **FIRE**.
2. **Arena 02 — Hutan Terbakar Malam (`hutan.html`):** Lintasan tanah dan aspal di tengah kobaran api rimba malam. Avatar awal: **Waterun** (Air). Syarat Boss: Wajib **WATER**.
3. **Arena 03 — Kota Futuristik Cyberpunk (`kota2.html`):** Kota metropolitan malam yang mengalami mati listrik total (*blackout*) di bawah kubah Galaksi 360°. Avatar awal: **Electrorun** (Listrik). Syarat Boss: Wajib **ELECTRO**.

---

# BAB II: ANALISIS IMPLEMENTASI KODING BERDASARKAN SILABUS MATERI KULIAH (PERTEMUAN 1 – 8)

Bagian ini menguraikan setiap konsep grafika komputer yang diajarkan pada silabus dosen (Pertemuan 1 hingga 8), lengkap dengan **tinjauan teori**, **potongan kodenya di proyek**, serta **analisis teknis kodingnya**.

---

## 2.1 WebGL Fundamentals & Canvas Setup (Materi Pertemuan 1 & 2)

### A. Tinjauan Teori Grafika
WebGL adalah API berbasis OpenGL ES 2.0/3.0 untuk merender grafik 2D dan 3D interaktif di browser tanpa plugin. WebGL bekerja menggunakan *Rendering Pipeline*: CPU menyiapkan data geometri ke memori GPU (VBO), lalu GPU memprosesnya melalui dua program shader:
1. **Vertex Shader:** Menghitung posisi koordinat titik sudut (*vertex*) dalam ruang proyeksi (*clip space*).
2. **Fragment Shader:** Menghitung warna, pencahayaan, dan nilai piksel akhir (*rasterization*).

Three.js membungkus (*abstracts*) kerumitan WebGL boilerplate menjadi objek yang rapi (`THREE.WebGLRenderer`), sekaligus mengelola context canvas, pengaturan anti-aliasing, rasio kerapatan piksel layar (*device pixel ratio*), dan penyesuaian ruang warna (*color space*).

### B. Potongan Kode Implementasi ([`ETS/app/scenes/kota.js:256-265`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L256-L265))
```javascript
// 1. Inisialisasi WebGL Context & Renderer
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

### C. Analisis Koding
* `{ canvas: canvas, antialias: true }`: Mengaitkan WebGL context langsung ke elemen `<canvas id="mainCanvas">` dan mengaktifkan algoritma *Multisample Anti-Aliasing* (MSAA) untuk menghaluskan tepi objek berundak (*jagged edges*).
* `setPixelRatio(Math.min(window.devicePixelRatio, 2))`: Menyelaraskan rendering dengan layar Retina/High-DPI namun dibatasi maksimal 2x agar GPU tidak mengalami *bottleneck*.
* `ACESFilmicToneMapping`: Algoritma pemetaan kurva warna filmis (*Academy Color Encoding System*) agar pencahayaan HDR dan refleksi cahaya tampak fotorealistik.

---

## 2.2 Transformasi Geometri & Sistem Koordinat Polar Silinder (Materi Pertemuan 3)

### A. Tinjauan Teori Grafika
Transformasi geometri merupakan fondasi grafika 3D yang melibatkan **Translasi** (pergeseran posisi), **Rotasi** (perputaran sudut), dan **Skalasi** (perubahan ukuran) yang direpresentasikan dalam bentuk **Matriks $4 \times 4$**.
Pada proyek ini, alih-alih membuat jalan lurus datar yang menghabiskan memori tak terhingga, kami menerapkan konsep **Dunia Silinder Berputar (Rotational Cyclic World)**. Karakter pelari diam di tempat secara matematis, sementara silinder jalan raya berputar pada poros sumbu putarnya, menciptakan ilusi visual bahwa karakter berlari maju tanpa akhir.

### B. Potongan Kode Implementasi ([`ETS/app/scenes/kota.js:192-210`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L192-L210) & [`kota.js:970-994`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L970-L994))

```javascript
// 1. Rotasi Silinder Dunia Setiap Frame (Loop Game)
if (isAnimating) {
  mainMesh.rotation.y += rollSpeed * delta;
}

// 2. Perpindahan Jalur Lateral Avatar dengan Linear Interpolation (LERP)
avatarLaneY = THREE.MathUtils.lerp(avatarLaneY, avatarTargetLaneY, delta * 9.0);
avatarGroup.position.y = avatarLaneY;

// 3. Matriks Transformasi Basis Tangensial (Frenet-Serret Frame) pada Permukaan Silinder
const targetZ = avatarBaseTargetZ;
const surfaceX = Math.sqrt(cylinderRadius * cylinderRadius - targetZ * targetZ);
const normal = new THREE.Vector3(surfaceX, 0, targetZ).normalize();
const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
const binormal = new THREE.Vector3(0, 1, 0);

const rotMatrix = new THREE.Matrix4();
rotMatrix.makeBasis(binormal.clone().negate(), normal, tangent);
avatarGroup.setRotationFromMatrix(rotMatrix);
avatarGroup.position.set(surfaceX, 0, targetZ);
```

```javascript
// 4. Penempatan Objek Gedung / Props Melingkar di Permukaan Silinder (Polar to Cartesian)
const xPos = radius * Math.cos(theta);
const zPos = radius * Math.sin(theta);
object.position.set(xPos, laneY, zPos);
object.rotation.y = -theta;
```

### C. Analisis Koding
* **Rotasi Silinder:** Menggunakan pertambahan sudut $\Delta \theta = \text{rollSpeed} \times \Delta t$ pada sumbu $Y$ tabung.
* **Basis Matrix Transformation:** Untuk menempelkan karakter di punggung silinder yang melengkung, dihitung vektor `normal` (arah luar tabung), `tangent` (arah lari lurus ke depan), dan `binormal` (arah samping jalan). Matriks orientasi dibentuk melalui `makeBasis()`, memastikan karakter menapak tegak lurus terhadap kelengkungan jalan.
* **Koordinat Polar:** Objek gedung dan gerbang di sekeliling tabung ditempatkan dengan rumus polar:
  $$x = R \cdot \cos(\theta), \quad z = R \cdot \sin(\theta)$$

---

## 2.3 Kamera & Proyeksi 3D (Materi Pertemuan 4)

### A. Tinjauan Teori Grafika
Kamera grafika komputer berfungsi mengubah koordinat dunia 3D (*World Space*) menjadi bidang gambar 2D (*Screen Space*). Kamera Perspektif (*Perspective Projection*) menirukan mata manusia di mana objek yang berada lebih jauh digambarkan lebih kecil, didefinisikan oleh **Field of View (FOV)**, **Aspek Rasio ($W/H$)**, **Near Plane**, dan **Far Plane** yang membentuk ruang pandang kerucut terpancung (*View Frustum*).

### B. Potongan Kode Implementasi ([`ETS/app/scenes/kota.js:917-942`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L917-L942) & [`kota.js:1036-1047`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L1036-L1047))
```javascript
// 1. Konfigurasi Third-Person Follow Camera di Selimut Tabung
function setCameraView(mode) {
  cameraView = mode;
  if (cameraView === 'surface') {
    controls.enabled = false;
    camera.fov = 82; // FOV lebar untuk efek kecepatan lari
    camera.updateProjectionMatrix();
    
    // Vektor UP kamera diselaraskan dengan Normal Tabung (+X)
    camera.up.set(1, 0, 0);
    const camX = cylinderRadius + eyeHeight;
    camera.position.set(camX, 0, camZOffset);
    
    const targetDist = 4.8;
    camera.lookAt(
      camX - Math.sin(basePitchDown) * targetDist, 
      0, 
      camZOffset + Math.cos(basePitchDown) * targetDist
    );
  } else {
    // Mode Kamera Bebas (OrbitControls)
    controls.enabled = true;
    camera.fov = 50;
    camera.up.set(0, 1, 0);
    camera.position.set(0, 4.0, 8.5);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

// 2. Dinamika Kamera Mengikuti Pemain dan Screen Shake
const camFollowY = avatarLaneY * 0.35;
camera.position.set(camX, camFollowY, camZOffset);
if (this.shakeIntensity > 0.001) {
  camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
}
```

### C. Analisis Koding
* `camera.up.set(1, 0, 0)`: Karena silinder membujur sepanjang sumbu $Y$, arah "atas" bagi pelari yang berdiri di permukaan tabung adalah searah vektor normal positif ($+X$). Konfigurasi ini penting agar kamera tidak terbalik saat memandang ke horizon.
* `updateProjectionMatrix()`: Wajib dipanggil setiap kali ada perubahan nilai FOV atau resize window agar matriks proyeksi 3D dikalkulasi ulang oleh WebGL.
* `Screen Shake`: Saat Boss menghentak atau melakukan serangan balik, intensitas getaran `shakeIntensity` diaplikasikan ke koordinat kamera untuk menghasilkan efek visual guncangan gempa yang dramatis.

---

## 2.4 Lighting, Shading & PBR Texturing (Materi Pertemuan 5)

### A. Tinjauan Teori Grafika
Pencahayaan menentukan bagaimana permukaan objek merespon sinar cahaya. Model konvensional (seperti Blinn-Phong) menggunakan aproksimasi empiris, sedangkan model modern **PBR (Physically Based Rendering)** menghitung interaksi cahaya berdasarkan hukum kekekalan energi fisika mikropermukaan menggunakan kombinasi tekstur:
1. **Albedo / Base Color:** Warna murni permukaan tanpa bayangan statis.
2. **Normal Map:** Ilusi detail cekungan, retakan, dan benjolan tanpa menambah poligon geometri.
3. **Roughness Map:** Tingkat kekasaran permukaan (mengatur kekaburan pantulan spekular).
4. **Metalness Map:** Menentukan konduktivitas logam vs dielektrik.

Selain itu, digunakan **Image-Based Lighting (IBL)** dengan format HDR/EXR 360° yang menyimpan nilai radiansi cahaya lingkungan secara floating-point 16-bit (*HalfFloat*).

### B. Potongan Kode Implementasi ([`ETS/app/scenes/kota.js:314-353`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L314-L353) & [`kota.js:267-287`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L267-L287))
```javascript
// 1. Memuat Tekstur PBR Aspal Jalanan
const textureLoader = new THREE.TextureLoader();
const roadColor = textureLoader.load('./assets/textures/road/color.jpg');
roadColor.colorSpace = THREE.SRGBColorSpace;
const roadNormal = textureLoader.load('./assets/textures/road/normal.jpg');
const roadRoughness = textureLoader.load('./assets/textures/road/roughness.jpg');

[roadColor, roadNormal, roadRoughness].forEach((tex) => {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 7); // Repetisi tekstur di sekeliling silinder
});

sideMaterial = new THREE.MeshStandardMaterial({
  map: roadColor,
  normalMap: roadNormal,
  roughnessMap: roadRoughness,
  roughness: 0.65,
  metalness: 0.15,
  wireframe: isWireframe
});

// 2. Pencahayaan Kubah Langit Panorama 360° Menggunakan EXRLoader
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

### C. Analisis Koding
* `RepeatWrapping`: Mengaktifkan pengulangan pola UV koordinat sehingga tekstur aspal tidak pecah atau tertarik saat membungkus silinder sepanjang keliling lingkaran.
* `THREE.MeshStandardMaterial`: Material PBR standar industri Three.js yang menghitung distribusi hamburan cahaya mikropermukaan (Cook-Torrance BRDF).
* `EXRLoader & HalfFloatType`: Memuat citra dinamis tinggi 16-bit per saluran untuk menghasilkan suasana fajar fajar di kota metropolitan, galaksi gelap di hutan, dan kubah Bima Sakti di arena cyberpunk.

---

## 2.5 Three.js Core, Hierarki Scene Graph & Aset GLTF (Materi Pertemuan 6)

### A. Tinjauan Teori Grafika
Three.js mengorganisir objek dalam struktur pohon hirarkis yang disebut **Scene Graph**. Ketika objek induk (*Parent Node / Group*) digerakkan atau diputar, seluruh objek anak (*Children Nodes*) secara otomatis mewarisi transformasi matriks lokal tersebut. Format **glTF (GL Transmission Format / .glb)** adalah format standar industri pengiriman aset 3D yang menyimpan hierarki node mesh, data material PBR, skinning skeleton, dan track animasi dalam satu berkas biner ringkas.

### B. Potongan Kode Implementasi ([`ETS/app/scenes/kota.js:211-230`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/scenes/kota.js#L211-L230) & [`app/game/army-element.js:13-35`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/army-element.js#L13-L35))
```javascript
// 1. Pemuatan Model Karakter 3D Eksternal (.glb)
const gltfLoader = new GLTFLoader();
gltfLoader.load('./assets/firerun.glb', (gltf) => {
  avatarModel = gltf.scene;
  const s = 0.038;
  avatarModel.scale.set(s, s, s);
  avatarModel.position.y = 0.009; // Menapak pas di atas aspal

  // Traversal Mesh untuk Optimasi Material & Shading
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

### C. Analisis Koding
* `GLTFLoader`: Melakukan parsing berkas biner `.glb`, mengekstrak geometri buffer, tekstur, material, dan hierarki skeleton.
* `traverse()`: Metode rekursif Scene Graph untuk menelusuri seluruh anak mesh di dalam model avatar, memastikan semua bagian badan mengaktifkan pencahayaan standar dan bayangan.

---

## 2.6 Interactive 3D, Skeletal Animation & Kloning Pasukan (Materi Pertemuan 7)

### A. Tinjauan Teori Grafika
Interaktivitas 3D membutuhkan sinkronisasi input pengguna dengan *game loop*. Animasi kerangka (*Skeletal Animation / Rigging*) bekerja dengan menggerakkan tulang (*bones*) yang mempengaruhi bobot simpul geometri (*skinning vertices*).
Untuk merender puluhan tentara di belakang karakter utama tanpa penurunan FPS yang drastis, dilakukan teknik duplikasi **Skeleton Cloning** menggunakan modul `SkeletonUtils.clone()`, dipadukan dengan **Object Pooling** dan batasan visual (*visual clamping*).

### B. Potongan Kode Implementasi ([`ETS/app/game/gates.js:241-285`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/gates.js#L241-L285) & [`gates.js:907-964`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/gates.js#L907-L964))
```javascript
// 1. Duplikasi Pasukan Efisien Menggunakan SkeletonUtils (Formasi 2 Banjar)
syncArmyClones() {
  const targetVisualCount = Math.min(ARMY_VISUAL_CAP, Math.max(1, this.armyCount)) - 1;
  const baseModel = this.getAvatarModel();

  while (this.armyClones.length < targetVisualCount && baseModel) {
    const idx = this.armyClones.length;
    const clone = SkeletonUtils.clone(baseModel);

    // Formasi 2 banjar teratur di belakang pemimpin
    const row = Math.floor(idx / 2) + 1;
    const col = idx % 2;
    const offsetX = col === 0 ? -0.096 : 0.096;
    const offsetZ = -row * 0.175;

    clone.position.set(offsetX, 0.009, offsetZ);
    clone.scale.set(0.038, 0.038, 0.038);

    // Pembuatan AnimationMixer Independen Setiap Klon Pasukan
    if (baseModel.animations && baseModel.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(clone);
      const action = mixer.clipAction(baseModel.animations[0]);
      action.time = Math.random() * 0.7; // Variasi langkah alami
      action.play();
      clone.userData.mixer = mixer;
      this.armyMixers.push(mixer);
    }

    this.avatarGroup.add(clone);
    this.armyClones.push(clone);
  }
}

// 2. Deteksi Tabrakan Gerbang Berbasis Jarak Sudut Angular (Collision Detection)
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

### C. Analisis Koding
* `SkeletonUtils.clone()`: Kloning standar Three.js (`clone()`) hanya menyalin mesh tanpa membuat instans tulang kerangka baru. `SkeletonUtils` menyalin seluruh hierarki `Bone` dan `Skeleton` secara mendalam (*deep-clone*) sehingga animasi lari setiap tentara dapat diputar secara independen.
* `ARMY_VISUAL_CAP = 30`: Membatasi jumlah klon 3D maksimal 30 model di layar sekalipun skor pasukan di HUD mencapai ratusan, mencegah *frame drop*.
* `Angular Collision Detection`: Menggunakan selisih sudut radian $\Delta \theta = (\theta_{\text{gate}} - \theta_{\text{silinder}} - \theta_{\text{player}}) \pmod{2\pi}$. Ketika sudut ini mendekati nol, posisi jalur samping $Y$ diperiksa untuk menentukan gerbang mana yang dilewati.

---

## 2.7 Evaluasi Tengah Semester (ETS) & Mekanik Permainan Lengkap (Materi Pertemuan 8)

### A. Tinjauan Desain Permainan
Pertemuan 8 merupakan evaluasi integrasi utuh yang menuntut sistem permainan lengkap dengan aturan yang adil (*game balance*), kondisi kemenangan, dan konsekuensi kekalahan yang jelas. Pada game ini diterapkan dua mekanisme gameplay mutlak:
1. **Mekanisme Eliminasi Pasukan $\le$ 0:** Melewati gerbang minus yang mengurangi pasukan hingga nol atau negatif memicu status **GAME OVER** seketika.
2. **Kunci Kemenangan Elemen Mutlak per Arena:** Setiap arena terikat secara eksklusif dengan kelemahan elemen Boss. Membawa elemen yang salah saat boss muncul membuat serangan kebal dan **pasti kalah**.

---

### B. Potongan Kode Implementasi Mekanik Pasukan $\le 0$ (Game Over Langsung)

#### File: [`ETS/app/game/game-rules.js:24-26`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/game-rules.js#L24-L26)
```javascript
// Rumus Pengurangan Pasukan Murni (Tanpa Batas Minimal Pengaman)
export function applyMinusGate(currentArmy, minusAmount) {
  return currentArmy - minusAmount;
}
```

#### File: [`ETS/app/game/gates.js:795-816`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/gates.js#L795-L816)
```javascript
case 'army_sub':
  const penalty = config.value;
  this.armyCount = applyMinusGate(this.armyCount, penalty);
  
  // Deteksi Pasukan Kurang dari atau Sama dengan 0 (Otomatis Kalah!)
  if (this.armyCount <= 0) {
    this.clearArmyClones();
    if (this.avatarGroup) this.avatarGroup.visible = false;
    this.createFloatingPopup(`-${penalty} PASUKAN (${this.armyCount})`, '#ef4444', hitPos);
    this.createPassBurst(hitPos, 0xef4444);
    this.playSound('negative');
    this.updateHud();
    this.drawHeadBadge(true);
    
    // Panggil Event Game Over Langsung ke Monster Manager
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
// Modal Hasil Khusus Kekalahan Akibat Pasukan Habis (<= 0)
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

### C. Potongan Kode Implementasi Kunci Kemenangan Elemen Mutlak

#### File: [`ETS/app/game/game-rules.js:10-15`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/game-rules.js#L10-L15) & [`game-rules.js:47-66`](file:///c:/Users/Maleka%20Ghaniya/Downloads/Grafika_Komputer/ETS/app/game/game-rules.js#L47-L66)
```javascript
// Pemetaan Elemen Wajib Mutlak Setiap Arena
export const REQUIRED_ELEMENT_PER_ARENA = Object.freeze({
  city: 'fire',      // Kota Banjir wajib Api
  forest: 'water',   // Hutan Terbakar wajib Air
  cyber: 'electro',  // Kota Cyberpunk wajib Listrik
  robot: 'electro'
});

// Penalti Kerusakan Jika Membawa Elemen yang Salah
export function calculateBossDamage({ armyCount = 1, level = 1, exp = 0, elementType } = {}, advantage = 0, arenaType = 'city') {
  const required = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  const armyPower = Math.round(Math.sqrt(Math.max(1, armyCount)) * 55);
  const levelPower = Math.max(1, level) * 40;
  const expPower = Math.floor(Math.max(0, exp) / 50) * 25;

  let elementMultiplier = advantage > 0 ? 1.25 : advantage < 0 ? 0.78 : 1;
  // Jika elemen salah, serangan tidak berdaya melawan Boss (Multiplier 0.15)
  if (elementType && elementType !== required) {
    elementMultiplier = 0.15;
  }

  return Math.max(10, Math.round((100 + armyPower + levelPower + expPower) * elementMultiplier));
}

// Evaluasi Kemenangan Boss (Wajib Elemen Sesuai Arena)
export function canDefeatBoss({ armyCount = 1, level = 1, exp = 0, elementType } = {}, targetExp = 0, arenaType = 'city') {
  const required = REQUIRED_ELEMENT_PER_ARENA[arenaType] || REQUIRED_ELEMENT_PER_ARENA.city;
  
  // Jika pemain berpindah gate ke elemen selain elemen wajib arena, PASTI KALAH!
  if (elementType !== required) {
    return false;
  }
  
  // Syarat tambahan: Pasukan minimal 10 orang, Level minimal 5, dan EXP mencukupi
  return armyCount >= MIN_BOSS_ARMY && level >= MIN_BOSS_LEVEL && exp >= targetExp;
}
```

### D. Analisis Koding
* **Penyelesaian Dilema Game Runner:** Pemain harus cermat memilih jalur. Jika memiliki 2 pasukan dan di depan ada gate `-5`, pemain tidak boleh menabraknya karena nilai pasukan menjadi $-3 \le 0$ dan permainan langsung selesai (*Game Over*).
* **Strategi Elemen Mutlak:** Di tengah jalan terdapat gate yang mengubah elemen (`TO FIRE`, `TO WATER`, `TO ELECTRIC`). Pemain harus memastikan elemen yang dibawa saat detik ke-60 adalah elemen yang tepat untuk arena tersebut, jika tidak serangan akan ditangkis dan pemain dinyatakan kalah.

---

# BAB III: PANDUAN PEMBAGIAN TUGAS PRESENTASI BERDUA

Berikut adalah panduan naskah presentasi terstruktur yang dibagi secara seimbang antara **Pembicara 1 (Maleka Ghaniya)** dan **Pembicara 2 (Jahhaza Assiqooyah)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ALUR & PEMBAGIAN PRESENTASI (15 MENIT)               │
├────────────────────────────────┬───────────────────────────────────────┤
│ PEMBICARA 1: MALEKA GHANIYA    │ PEMBICARA 2: JAHHAZA ASSIQOOYAH       │
│ (~6 Menit — Bab 1 s.d. Bab 2.4)│ (~6 Menit — Bab 2.5 s.d. Bab 2.7)     │
├────────────────────────────────┼───────────────────────────────────────┤
│ • Pembukaan & Konsep Proyek    │ • Pemuatan Model 3D GLTF (.glb)       │
│ • WebGL Context & Renderer     │ • Skeletal Animation & Army Cloning   │
│ • Silinder Dunia & Polar Math  │ • Collision Detection Gerbang 3D      │
│ • Kamera 3D & Third-Person Cam │ • Mekanik Kalah Pasukan <= 0          │
│ • PBR Texturing & HDR 360°     │ • Aturan Elemen Mutlak & Boss Fight   │
├────────────────────────────────┴───────────────────────────────────────┤
│           SESI LIVE DEMO BERSAMA & PENUTUP (2-3 MENIT)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 👤 Naskah & Poin Panduan Pembicara 1 (Maleka Ghaniya)
> **Topik:** *Fondasi WebGL, Arsitektur Scene 3D, Transformasi Geometri, Kamera, dan Texturing PBR.*

1. **Pembukaan (1 Menit):**
   * *"Selamat pagi/siang Bapak Darlis dan rekan-rekan. Kami dari kelompok Grafika Komputer A, saya Maleka Ghaniya bersama rekan saya Jahhaza Assiqooyah, mempresentasikan proyek ETS berjudul **Elemental Army Run**."*
   * *"Game ini merupakan runner 3D interaktif berbasis WebGL dan Three.js yang dirancang dengan 3 arena bertema lingkungan yang merepresentasikan materi kuliah pertemuan 1 hingga 8."*
2. **WebGL Context & Inisialisasi Canvas (Pertemuan 1 & 2):**
   * Tunjukkan kode di `app/scenes/kota.js` baris 256–265.
   * *"Pada bagian ini kami menginisialisasi `THREE.WebGLRenderer` ke canvas HTML5, mengaktifkan antialiasing, serta membatasi pixel-ratio maksimal 2 agar performa render GPU tetap optimal."*
3. **Sistem Koordinat Dunia Silinder & Transformasi Geometri (Pertemuan 3):**
   * Tunjukkan kode rotasi `mainMesh.rotation.y += rollSpeed * delta` dan fungsi `makeBasis` orientasi avatar.
   * *"Untuk menciptakan ilusi berlari tanpa batas yang hemat memori, kami tidak menggunakan jalan datar panjang, melainkan silinder berputar pada sumbu Y. Karakter diorientasikan menggunakan matriks transformasi Frenet-Serret frame berdasarkan vektor normal, tangen, dan binormal tabung."*
4. **Kamera Perspektif & View Frustum (Pertemuan 4):**
   * Tunjukkan kode `setCameraView()` dan `camera.up.set(1, 0, 0)`.
   * *"Kamera menggunakan proyeksi perspektif dengan FOV 82 derajat. Karena karakter berdiri di punggung tabung horizontal, vektor UP kamera kami selaraskan dengan vektor normal (+X) agar orientasi kamera tetap stabil dan tidak terbalik."*
5. **Lighting & PBR Texturing (Pertemuan 5):**
   * Tunjukkan kode tekstur jalanan dan `EXRLoader`.
   * *"Kami menerapkan Physically Based Rendering (PBR) dengan material `MeshStandardMaterial` yang menggabungkan color map, normal map untuk tekstur kasar aspal, dan roughness map. Kubah langit 360° dimuat menggunakan `EXRLoader` dalam format Half-Float HDR."*
   * *"Selanjutnya, bagian animasi, interaktivitas, dan logika permainan akan dijelaskan oleh rekan saya, Jahhaza."*

---

### 👤 Naskah & Poin Panduan Pembicara 2 (Jahhaza Assiqooyah)
> **Topik:** *Model 3D GLTF, Animasi Kerangka, Interaktivitas Gerbang, Aturan Elemen Mutlak, dan Pertarungan Boss.*

1. **Pemuatan Aset 3D & Hierarki Scene Graph (Pertemuan 6):**
   * Tunjukkan kode `GLTFLoader` di `app/scenes/kota.js` dan `army-element.js`.
   * *"Melanjutkan penjelasan Maleka, seluruh karakter runner, rintangan, dan boss dimuat dalam format standar industri `.glb` menggunakan `GLTFLoader`. Kami melakukan traversal mesh untuk memastikan material dan kalkulasi bayangan terpasang sempurna."*
2. **Skeletal Animation & Army Cloning (Pertemuan 7):**
   * Tunjukkan kode `syncArmyClones()` di `app/game/gates.js`.
   * *"Untuk animasi karakter berlari, kami menggunakan `THREE.AnimationMixer`. Pasukan tentara di belakang pemimpin diduplikasi menggunakan `SkeletonUtils.clone()` dengan formasi 2 banjar. Kami membatasi visual maksimal 30 klon 3D (`ARMY_VISUAL_CAP`) agar FPS tetap terkunci di 60 FPS meskipun jumlah pasukan mencapai ratusan."*
3. **Interaktivitas Gerbang & Aturan Pasukan $\le$ 0 (Pertemuan 7 & 8):**
   * Tunjukkan kode `applyGateEffect` pada kasus `army_sub`.
   * *"Deteksi tabrakan gerbang dihitung berdasarkan selisih sudut angular antara silinder dan posisi pemain. Kami menerapkan aturan eliminasi: jika pemain menabrak gerbang minus sehingga pasukan menjadi kurang dari atau sama dengan nol ($count \le 0$), pemain dinyatakan gugur dan modal **GAME OVER — PASUKAN HABIS** langsung muncul."*
4. **Aturan Elemen Mutlak & Pertarungan Final Boss (Pertemuan 8):**
   * Tunjukkan kode `canDefeatBoss` di `app/game/game-rules.js`.
   * *"Setiap arena memiliki aturan elemen mutlak: Kota Banjir wajib elemen FIRE, Hutan Terbakar wajib WATER, dan Kota Mati Lampu wajib ELECTRO. Jika pemain membawa elemen yang salah saat boss muncul di menit ke-1, boss akan kebal dan pemain pasti kalah. Jika menang, cutscene pemulihan lingkungan akan aktif seketika."*
5. **Live Demo Singkat (2 Menit):**
   * Jalankan game langsung di browser (GitHub Pages).
   * Demonstrasikan perpindahan jalur dengan tombol <kbd>A</kbd> dan <kbd>D</kbd>, demonstrasi menabrak gerbang minus hingga kalah, lalu main lagi (*restart*) untuk memperlihatkan perubahan elemen hingga pertarungan Boss.

---

# BAB IV: PANDUAN MENJALANKAN PROGRAM

### 4.1 Menjalankan Langsung via GitHub Pages
Game dapat langsung dimainkan melalui browser modern apa pun tanpa perlu instalasi:  
👉 **[https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html](https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html)**

### 4.2 Menjalankan Secara Lokal (Node.js & Vite)
1. Buka PowerShell / Terminal di folder `ETS`:
   ```powershell
   cd ETS
   npm install
   ```
2. Jalankan server lokal:
   ```powershell
   npm start
   # atau
   npm run dev
   ```
3. Akses tautan lokal pada browser: `http://127.0.0.1:5173/`

---

# BAB V: KESIMPULAN & TANYA JAWAB TEKNIS (Q&A)

### Pertanyaan 1: *"Di mana kaitan WebGL murni jika menggunakan Three.js?"*
* **Jawaban:** Three.js bekerja sebagai lapisan abstraksi tingkat tinggi di atas WebGL. Di balik layar, objek `THREE.BufferGeometry` diubah menjadi WebGL *Vertex Buffer Objects* (VBO) yang disimpan di memori VRAM GPU, dan `THREE.MeshStandardMaterial` dikompilasi menjadi pasangan kode GLSL (*Vertex Shader* dan *Fragment Shader*) yang dieksekusi per-piksel oleh prosesor grafis.

### Pertanyaan 2: *"Mengapa memilih geometri silinder daripada jalan datar panjang?"*
* **Jawaban:** Geometri silinder berputar memanfaatkan transformasi rotasi pada satu sumbu ($Y$). Dengan cara ini, memori GPU sangat hemat karena objek gedung dan lintasan yang telah dilewati pemain di bagian bawah secara matematis akan muncul kembali di atas horizon (*cyclic world*), menciptakan ilusi lintasan tanpa akhir tanpa perlu membuat alokasi memori objek baru secara kontinu.

### Pertanyaan 3: *"Bagaimana menjaga performa tetap stabil di 60 FPS saat banyak pasukan?"*
* **Jawaban:** Kami mengombinasikan 3 teknik optimasi:
  1. **Visual Clamping (`ARMY_VISUAL_CAP = 30`):** Klon 3D dibatasi 30 model, sementara skor pasukan murni dicatat numerik di HUD.
  2. **Object Pooling:** Proyektil peluru dan partikel ledakan didaur ulang alih-alih dibuat ulang setiap frame untuk menghindari *Garbage Collection spike*.
  3. **Disabling Scene Environment PMREM Overhead:** Peta langit panorama menggunakan `MeshBasicMaterial` bola terbalik (*BackSide*) yang ringan tanpa kalkulasi komputasi probe dinamis berlebih.
