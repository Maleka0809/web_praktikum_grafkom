# ETS Grafika Komputer — WebGL, GLSL & Three.js Canvas

Proyek **Evaluasi Tengah Semester (ETS)** Laboratorium Grafika Komputer A — Teknik Informatika ITS.

Aplikasi canvas grafis interaktif terpadu yang memadukan **WebGL 2.0**, **Custom GLSL Shaders**, dan **Three.js** langsung dalam satu canvas dan berkas `main.js`.

---

## 👥 Anggota Kelompok

| No | Nama | NRP |
|---|---|---|
| 1 | **Maleka Ghaniya** | 5025241189 |
| 2 | **Jahhaza Assiqooyah Nurul Hidayah** | 5025241019 |

---

## 🗂️ Struktur Folder Sederhana

```
ETS/
├── index.html       # Struktur halaman dengan canvas tunggal
├── main.js          # Seluruh logika Three.js, Custom GLSL Shaders, dan Native WebGL
├── style.css        # Tampilan canvas dan tombol navigasi
└── README.md        # Panduan dan dokumentasi ETS
```

---

## 🚀 3 Mode dalam Satu Canvas (`main.js`)

1. **🚀 Three.js Scene**:
   - Geometri 3D (Torus Knot) dengan pencahayaan dinamis (Ambient, Directional, Point Light).
   - Material PBR Standard (Roughness & Metalness).
   - Sistem orbit kamera (OrbitControls) dan satelit berotasi.

2. **🧪 Custom GLSL Shader**:
   - Menggunakan `THREE.ShaderMaterial` dengan kode shader GLSL langsung di `main.js`.
   - **Vertex Shader**: Deformasi gelombang permukaan sinusoidal (`sin()` dan `cos()`).
   - **Fragment Shader**: Efek pendaran tepi (*Fresnel rim lighting*) dan gelombang warna dinamis.

3. **🌐 Native WebGL**:
   - Pipeline murni WebGL 2.0 (`webgl2`) tanpa library eksternal.
   - Mengompilasi Vertex & Fragment Shader (GLSL ES 3.0), binding VAO/VBO, dan merender cincin plasma prosedural.

---

## ⌨️ Kontrol Interaktif

| Tombol / Aksi | Fungsi |
|---|---|
| `Tombol Mode (1 / 2 / 3)` | Ganti antara Three.js, GLSL Shader, dan Native WebGL |
| `Space` / `Tombol Pause` | Menjeda / melanjutkan animasi |
| `R` / `Tombol Reset` | Mengembalikan posisi sudut kamera ke awal |
| `Tombol Wireframe` | Mengubah tampilan antara Solid dan Kerangka Kawat (Wireframe) |
| `Tombol Warna` | Mengganti warna material aktif secara dinamis |
| `Mouse Drag` | Memutar sudut pandang kamera (Orbit) |
| `Mouse Wheel` | Memperbesar / memperkecil tampilan (Zoom In / Out) |
