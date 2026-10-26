# Elemental Army Run — Proyek ETS Grafika Komputer A

> **Evaluasi Tengah Semester (ETS) Grafika Komputer A (2026)**  
> **Departemen Teknik Informatika — Institut Teknologi Sepuluh Nopember (ITS)**  
> **Dosen Pengampu:** Darlis Herumurti, S.Kom., M.Kom.  
> **Materi Acuan Kuliah:** [Grafika Komputer — Learning Hub](https://darlis-its.github.io/materi-grafika-komputer/)  
> **Live Demo (GitHub Pages):** [https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html](https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html)

---

## 👥 Identitas Anggota Kelompok

| No | Nama Mahasiswa | NRP | Peran Utama |
|---|---|---|---|
| 1 | **Maleka Ghaniya** | 5025241189 | Speaker 1 (Fondasi WebGL, Transformasi, Kamera, Texturing & PBR) |
| 2 | **Jahhaza Assiqooyah Nurul Hidayah** | 5025241019 | Speaker 2 (Model 3D GLTF, Skeletal Animation, Interaktivitas Gate & Game Rules) |

---

## 📌 Deskripsi Proyek

**Elemental Army Run** adalah game runner 3D interaktif berbasis browser yang dibangun menggunakan pustaka **Three.js** di atas WebGL API. Game ini mengadopsi mekanisme *crowd-runner* bergaya *Count Masters*, di mana pemain mengendalikan avatar yang berlari di atas lintasan silinder 3D tanpa ujung, memilih gerbang (*gates*) penambah pasukan/EXP/elemen, dan bersiap menghadapi pertempuran **Final Boss** setelah fase berlari 60 detik.

Proyek ini memiliki **3 arena tematik** dengan mekanik lingkungan dan aturan elemen mutlak yang berbeda:
1. **Arena 01 — Kota Metropolitan Banjir:** Jalan aspal tergenang air banjir. Pemimpin avatar adalah **Firerun** (Elemen Api). Boss: *Monster Sampah*.
2. **Arena 02 — Hutan Terbakar (Wildfire):** Hutan rimba dengan kobaran api malam hari. Pemimpin avatar adalah **Waterun** (Elemen Air). Boss: *Monster Lava*.
3. **Arena 03 — Kota Futuristik Malam (Cyberpunk):** Kota modern yang mengalami mati listrik total di bawah kubah galaksi Bima Sakti 360°. Pemimpin avatar adalah **Electrorun** (Elemen Listrik). Boss: *Mecha Robot*.

---

## 🎯 Pemetaan Kode Proyek dengan Materi Silabus Kuliah (Pertemuan 1 – 8)

Proyek ini mengintegrasikan seluruh materi kuliah Grafika Komputer dari Pertemuan 1 hingga Pertemuan 8 (ETS):

| Pertemuan | Topik Silabus Kuliah | Implementasi Nyata di Kode Proyek | Lokasi File |
|---|---|---|---|
| **01 & 02** | **WebGL Fundamentals & Rendering Pipeline** | Pembuatan kanvas HTML5, konfigurasi `WebGLRenderer`, penanganan resolusi *pixel-ratio*, pembersihan buffer warna & *depth-buffer*, serta pemahaman shader GLSL yang dieksekusi GPU. | `app/scenes/kota.js`, `hutan.js`, `kota2.js` |
| **03** | **Transformasi & Sistem Koordinat** | Perputaran kontinu dunia silinder (`mainMesh.rotation.y += speed * delta`), translasi posisi lateral avatar di jalur kiri-kanan (`avatarLaneY`), penempatan polar/silinder (`Math.cos` & `Math.sin`) untuk gedung, pohon, dan gerbang di sekeliling permukaan tabung. | `app/scenes/*.js`, `app/game/gates.js` |
| **04** | **Kamera & Proyeksi 3D** | Konfigurasi `THREE.PerspectiveCamera(60, aspect, 0.1, 1000)` dengan sudut pandang *third-person follow camera* yang terpasang dinamis di belakang avatar, efek guncangan layar (*screen shake* saat Boss menyerang), serta opsi sudut pandang bebas (*OrbitControls*). | `app/scenes/*.js`, `app/game/monster.js` |
| **05** | **Lighting, Shading & PBR Texturing** | Penerapan material berbasis fisika (*Physically Based Rendering / MeshStandardMaterial*), peta tekstur lengkap (*Albedo/Color, Normal Map, Roughness, Metalness*) untuk aspal dan metal, serta pencahayaan `AmbientLight`, `DirectionalLight`, dan pemetaan langit HDR 360° menggunakan `EXRLoader`. | `app/scenes/*.js`, `assets/textures/` |
| **06** | **Three.js Core & Hierarchical Asset 3D** | Pengorganisasian objek dalam `THREE.Scene` dan hierarki induk-anak (*Scene Graph / Group*). Pemuatan model poligon 3D eksternal format glTF/GLB menggunakan `GLTFLoader` (karakter runner, monster, gedung, dan *props* jalan raya). | `app/game/army-element.js`, `app/scenes/*.js` |
| **07** | **Interactive 3D, Collision & Animasi** | Render loop 60 FPS via `requestAnimationFrame()`, animasi kerangka karakter (*Skeletal Animation*) dengan `THREE.AnimationMixer` & `clipAction`, kloning instan pasukan dengan `SkeletonUtils.clone()`, deteksi tabrakan gerbang berbasis selisih sudut angular (*angular distance*), dan event handling keyboard (`A`, `D`, `Space`). | `app/game/gates.js`, `app/ui/controls.js` |
| **08** | **Evaluasi Tengah Semester (Integrasi Sistem)** | Penggabungan utuh seluruh komponen grafis ke dalam sistem permainan mandiri dengan HUD interaktif, sintesis audio via Web Audio API, sistem penalti gerbang minus (pasukan $\le$ 0 otomatis kalah), dan evaluasi elemen mutlak saat melawan Boss. | `app/game/game-rules.js`, `app/game/monster.js` |

---

## 👥 Panduan Pembagian Tugas Presentasi (Berdua)

Berikut adalah panduan pembagian materi presentasi berbobot akademis yang dirancang khusus untuk 2 anggota tim:

### 👤 Pembicara 1: Maleka Ghaniya (Fondasi Grafika, Arsitektur Scene, Kamera & Visual)
* **Waktu Alokasi:** ~5–7 Menit
* **Fokus Materi:** Pertemuan 1 – 5
* **Poin Pembahasan:**
  1. **Pembuka & Konsep Proyek:** Memperkenalkan judul proyek *Elemental Army Run*, latar belakang pemilihan konsep 3D runner, dan gambaran umum 3 arena.
  2. **WebGL Context & Inisialisasi Three.js (Pertemuan 1 & 2):** Menjelaskan bagaimana kanvas WebGL diinisialisasi melalui `THREE.WebGLRenderer`, pengaturan *antialias*, ukuran kanvas responsif, dan *color space* (`SRGBColorSpace`).
  3. **Dunia Silinder & Transformasi Geometri (Pertemuan 3):** Menjelaskan trik grafis lintasan silinder tak berujung (*infinite cylinder runner*). Menunjukkan kode rotasi silinder:
     ```javascript
     mainMesh.rotation.y += rollSpeed * delta;
     ```
     dan perhitungan koordinat polar untuk menempatkan gedung serta gerbang di permukaan tabung menggunakan rumus:
     $$x = R \cdot \cos(\theta), \quad z = R \cdot \sin(\theta)$$
  4. **Kamera & Proyeksi 3D (Pertemuan 4):** Menunjukkan pembuatan `PerspectiveCamera` third-person yang mengikuti gerakan avatar, serta fitur *screen shake* saat boss melancarkan serangan.
  5. **Tekstur PBR & Pencahayaan Lingkungan (Pertemuan 5):** Menunjukkan pemuatan tekstur jalan raya (*color, normal, roughness*) dan kubah langit panoramik HDR/EXR 360° yang menghasilkan pencahayaan ambient alami.

---

### 👤 Pembicara 2: Jahhaza Assiqooyah (Model 3D, Animasi, Interaktivitas & Aturan Game)
* **Waktu Alokasi:** ~5–7 Menit
* **Fokus Materi:** Pertemuan 6 – 8
* **Poin Pembahasan:**
  1. **Pemuatan Aset GLTF & Animasi Kerangka (Pertemuan 6 & 7):** Menunjukkan penggunaan `GLTFLoader` untuk memuat karakter 3D (`firerun.glb`, `waterun.glb`, `electrorun.glb`) dan model Final Boss.
  2. **Skeletal Animation & Army Cloning (Pertemuan 7):** Menjelaskan bagaimana animasi lari dikontrol melalui `THREE.AnimationMixer`, serta bagaimana puluhan pasukan diduplikasi tanpa membebani performa menggunakan `SkeletonUtils.clone()` dengan batas visual 30 klon (`ARMY_VISUAL_CAP`).
  3. **Deteksi Tabrakan Gerbang (*Collision Detection*) & Mekanik Gerbang Minus (Pertemuan 7):**
     * Menjelaskan deteksi tabrakan berbasis perhitungan selisih sudut angular (`angleDiff`) antara posisi rotasi silinder dengan avatar pemain.
     * **Mekanik Kalah Pasukan $\le$ 0:** Menjelaskan aturan baru di mana jika pemain menabrak gerbang penalti merah (`-3`, `-5`, `-8`) sehingga pasukan menjadi $\le 0$, permainan seketika memicu status **GAME OVER** di tempat.
  4. **Logika Kemenangan & Elemen Mutlak per Arena (File: `game-rules.js` & `monster.js`):**
     * Menunjukkan implementasi fungsi `canDefeatBoss()`:
       * **Arena Kota Banjir** $\rightarrow$ Wajib membawa elemen **FIRE**.
       * **Arena Hutan Kebakaran** $\rightarrow$ Wajib membawa elemen **WATER**.
       * **Arena Kota Mati Lampu** $\rightarrow$ Wajib membawa elemen **ELECTRO**.
     * Jika pemain berpindah gate ke elemen yang salah saat boss muncul, boss akan kebal dan pemain **pasti kalah**.
  5. **Live Demo Singkat (1–2 Menit):** Memperlihatkan permainan secara langsung di browser, mendemonstrasikan perpindahan jalur, perubahan elemen, dan cutscene kemenangan saat boss dikalahkan.

---

## 🕹️ Aturan Mekanik Permainan (Gameplay Rules)

### 1. Kunci Kemenangan Elemen Mutlak

| Arena | Lingkungan | Avatar Awal | Elemen Wajib | Final Boss | Kondisi Kalah Elemen |
|---|---|---|---|---|---|
| **Arena 01** | Kota Metropolitan | Firerun | **FIRE** (Api) | Monster Sampah | Membawa Water / Electro saat boss muncul $\rightarrow$ **Pasti Kalah** (Boss Kebal). |
| **Arena 02** | Hutan Malam | Waterun | **WATER** (Air) | Monster Lava | Membawa Fire / Electro saat boss muncul $\rightarrow$ **Pasti Kalah** (Api gagal padam). |
| **Arena 03** | Kota Cyberpunk | Electrorun | **ELECTRO** (Listrik) | Mecha Robot | Membawa Fire / Water saat boss muncul $\rightarrow$ **Pasti Kalah** (Listrik kota gagal pulih). |

### 2. Gerbang Penalti & Aturan Pasukan $\le$ 0 (Game Over Langsung)
* Terdapat berbagai tipe gerbang: Tambah Pasukan (`+5`, `+10`), Pengganda (`×2`, `×3`), Tambah EXP (`+50`, `+100`), Pengurang EXP (`-30`), dan Gerbang Transformasi Elemen (`TO FIRE`, `TO WATER`, `TO ELECTRIC`).
* **Gerbang Minus Pasukan (`-3`, `-5`, `-8`):**
  * Jika pemain menabrak gerbang penalti merah dan jumlah pengurangan membuat sisa pasukan menjadi **kurang dari atau sama dengan 0** ($count \le 0$):
  * Klon pasukan lenyap dengan partikel merah.
  * Putaran lintasan dan gerakan lari langsung berhenti.
  * Muncul modal **GAME OVER — PASUKAN HABIS** yang menampilkan nilai sisa pasukan sebenarnya (misal: `-3 UNIT`).

### 3. Fase Final Boss (Menit 01:00)
* Pemain mengumpulkan pasukan dan EXP selama 60 detik pertama.
* Tepat di detik ke-60, avatar berhenti berlari dan Final Boss muncul di hadapan pemain.
* Pasukan secara otomatis menembakkan proyektil energi elemen ke arah boss.
* **Syarat Menang:**
  1. Elemen aktif **wajib sesuai** dengan elemen wajib arena.
  2. Jumlah pasukan $\ge 10$.
  3. Level karakter $\ge 5$.
  4. Akumulasi EXP memenuhi target batas boss ($EXP \ge Target$).
* **Cutscene Pemulihan Lingkungan saat Menang:**
  * **Kota:** Air banjir bandang surut mengering.
  * **Hutan:** Kobaran api padam dan dedaunan kembali asri.
  * **Kota Futuristik:** Lampu gedung dan lampu jalan menyala terang benderang (*Cyberpunk power grid restored*).

---

## 🎮 Kontrol Permainan

| Tombol / Tombol Layar | Fungsi |
|---|---|
| <kbd>A</kbd> / Tombol Kiri | Berpindah ke jalur kiri |
| <kbd>D</kbd> / Tombol Kanan | Berpindah ke jalur kanan |
| <kbd>Space</kbd> / Tombol Jeda | Menjeda (*Pause*) / Melanjutkan (*Resume*) permainan |
| Tombol Kamera | Mengganti sudut pandang kamera (*Third-Person Follow* / *Free Orbit*) |
| Tombol Wireframe | Mengaktifkan mode jaring kawat (*Wireframe Mode*) untuk inspeksi geometri 3D |
| Tombol Kecepatan | Mengubah kecepatan rotasi jalan raya (1.0x / 1.5x / 2.0x) |

---

## 📁 Struktur Direktori Proyek

```text
ETS/
├── index.html                   # Menu utama & pemilihan 3 arena
├── kota.html                    # Arena 01: Kota Metropolitan Banjir
├── hutan.html                   # Arena 02: Hutan Malam Kebakaran
├── kota2.html                   # Arena 03: Kota Futuristik Malam
├── app/
│   ├── menu.js                  # Logika interaksi antarmuka menu utama
│   ├── game/
│   │   ├── army-element.js      # Pemuatan model GLTF & penggantian elemen avatar
│   │   ├── element-balance.js   # Siklus keunggulan dan kelemahan elemen
│   │   ├── game-rules.js        # Parameter matematis, aturan elemen wajib & evaluasi boss
│   │   ├── gates.js             # Generator 3D arch gate, collision detection & penalty
│   │   └── monster.js           # Model 3D boss, pertarungan proyektil, sfx & result modal
│   ├── scenes/
│   │   ├── kota.js              # Alur grafika Arena 01 (jalan raya, banjir, cutscene surut)
│   │   ├── hutan.js             # Alur grafika Arena 02 (pohon, kobaran api, cutscene padam)
│   │   └── kota2.js             # Alur grafika Arena 03 (gedung cyber, galaksi, cutscene nyala)
│   └── ui/
│       └── controls.js          # Helper UI & pemulihan ikon tombol kontrol
├── assets/
│   ├── firerun.glb              # Model 3D avatar elemen Fire
│   ├── waterun.glb              # Model 3D avatar elemen Water
│   ├── electrorun.glb           # Model 3D avatar elemen Electro
│   ├── flexmusc_sampah.glb      # Model 3D idle Boss Sampah (Kota)
│   ├── swipping_sampah.glb      # Model 3D serang Boss Sampah (Kota)
│   ├── idle_lava.glb            # Model 3D idle Boss Lava (Hutan)
│   ├── swipping_lava.glb        # Model 3D serang Boss Lava (Hutan)
│   ├── idle_robot.glb           # Model 3D idle Mecha Robot (Kota 2)
│   ├── attack_robot.glb         # Model 3D serang Mecha Robot (Kota 2)
│   ├── dying_robot.glb          # Model 3D dying Mecha Robot (Kota 2)
│   ├── audio/                   # Efek suara tembakan elemen (ogg/wav)
│   ├── hdr/                     # Tekstur kubah langit panorama 360° (EXR/JPG)
│   ├── models/                  # Komponen 3D kota, rumah, lampu jalan, pembatas
│   └── textures/                # PBR texture maps jalan raya & metal (color, normal, rough)
├── styles/
│   └── style.css                # Desain visual modern HUD, kartu arena & dialog panduan
├── package.json                 # Konfigurasi dependensi npm (Three.js, Vite, FontAwesome)
└── vite.config.js               # Konfigurasi bundler build multi-page Vite
```

---

## 🚀 Cara Menjalankan Proyek

### Opsi 1: Langsung di Browser via GitHub Pages (Tanpa Instalasi)
Buka tautan resmi proyek:  
👉 **[https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html](https://maleka0809.github.io/web_praktikum_grafkom/ETS/index.html)**

*(Three.js dan FontAwesome dimuat secara modular melalui CDN importmap bawaan browser)*.

---

### Opsi 2: Menjalankan Secara Lokal (Node.js & Vite)

1. Pastikan telah menginstal **Node.js** (versi 20 atau yang lebih baru).
2. Buka terminal pada folder `ETS`:
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
4. Buka URL lokal yang muncul pada terminal (biasanya `http://127.0.0.1:5173/`).

---

## 💡 Pertanyaan Umum Dosen & Tips Jawaban (Tanya Jawab)

1. **"Di mana kaitan WebGL murninya jika kalian menggunakan Three.js?"**
   * *Jawaban:* Three.js berperan sebagai *high-level abstraction engine* di atas WebGL API. Di balik layar, Three.js mengelola WebGL Context, mengunggah data titik geometri ke GPU sebagai *Vertex Buffer Objects* (VBO), mengikat *Index Buffer*, serta mengompilasi material Three.js menjadi pasangan *Vertex Shader* dan *Fragment Shader* GLSL standar WebGL yang dieksekusi per-pixel oleh kartu grafis.
2. **"Bagaimana cara menjaga frame rate tetap stabil (60 FPS) saat jumlah pasukan bertambah banyak?"**
   * *Jawaban:* Kami menerapkan teknik *clamping* visual (`ARMY_VISUAL_CAP = 30`) di mana visualisasi 3D klon karakter dibatasi maksimal 30 model di layar sekalipun skor pasukan di HUD mencapai ratusan. Selain itu, kami menggunakan teknik *Object Pooling* untuk proyektil dan partikel ledakan guna menghindari *garbage collection freeze*.
3. **"Mengapa menggunakan lintasan silinder daripada lintasan lurus?"**
   * *Jawaban:* Lintasan silinder berputar memanfaatkan transformasi rotasi pada satu sumbu (`rotation.y`), sehingga lingkungan tidak perlu di-generate tanpa batas di memori. Objek yang telah dilewati pemain di bawah tabung secara otomatis muncul kembali di horizon atas (*cyclic world*), menciptakan ilusi lintasan tanpa batas yang sangat hemat memori.
