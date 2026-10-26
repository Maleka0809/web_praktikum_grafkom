# Elemental Army Run

Game runner 3D berbasis browser dengan tiga arena, sistem pasukan, gate, pergantian elemen, dan pertarungan final boss.

## Persyaratan

- Node.js 20.19+ atau 22.12+
- Browser modern dengan dukungan WebGL

## Menjalankan game

```powershell
npm install
npm start
```

Buka alamat lokal yang ditampilkan pada terminal, biasanya `http://127.0.0.1:5173`.

## Build produksi

```powershell
npm run build
npm run preview
```

Hasil build tersimpan di folder `dist`.

## Kontrol

- `A`: bergerak ke kiri
- `D`: bergerak ke kanan
- `Space`: jeda atau lanjut
- Tombol kamera: mengganti sudut pandang

## Struktur proyek

```text
index.html             Menu utama dan pemilihan arena
kota.html              Arena kota metropolitan
hutan.html             Arena hutan malam
kota2.html             Arena kota futuristik
app/
  game/                Sistem gate, pasukan, elemen, dan boss
  scenes/              Pengaturan dan alur arena 3D
  ui/                  Komponen antarmuka dan kontrol
styles/                Tampilan antarmuka
assets/                Model 3D, tekstur, gambar, dan audio
```

## Alur permainan

Pemain mengembangkan pasukan selama fase lari 60 detik dengan memilih gate pasukan, EXP, atau elemen. Setelah waktu habis, permainan beralih ke pertarungan final boss. Gate pengurang pasukan selalu menyisakan minimal satu anggota.

Fire, Water, dan Electric memiliki hubungan kekuatan dan kelemahan masing-masing. Model, warna, proyektil, dan efek suara pasukan mengikuti elemen yang aktif.

Informasi lisensi aset pihak ketiga tersedia di `assets/KREDIT-DAN-LISENSI.md`.
