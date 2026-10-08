# Praktikum 6: Pengenalan Three.js

## Deskripsi Praktikum
Praktikum ini membahas tentang dasar-dasar penggunaan Three.js untuk merender scene 3D di browser, menyederhanakan pekerjaan low-level WebGL tanpa menghapus konsep grafika komputer yang mendasarinya. 

Praktikum ini mengimplementasikan:
- project Node.js + Vite + Three.js
- Scene
- PerspectiveCamera
- WebGLRenderer
- BoxGeometry, SphereGeometry, PlaneGeometry, BufferGeometry inspection
- MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial
- Mesh (position, rotation, scale)
- AmbientLight, DirectionalLight
- shadow
- animation loop
- delta time
- responsive rendering

## Daftar Challenge

### Challenge A — Tambah Geometry
Menambahkan minimal dua geometry (CylinderGeometry, ConeGeometry, TorusGeometry). Setiap geometry memiliki material, transform, dan posisi yang tidak saling bertabrakan.

### Challenge B — Material Gallery
Membuat beberapa object dengan geometry sama tetapi material berbeda (MeshBasicMaterial, MeshNormalMaterial, MeshLambertMaterial, MeshPhongMaterial) yang disusun berjajar agar perbedaannya mudah dibandingkan.

### Challenge C — OrthographicCamera
Membuat mode camera kedua menggunakan `THREE.OrthographicCamera` dengan tombol `P` untuk berpindah antara Perspective dan Orthographic. Projection tetap responsif ketika window resize.

### Challenge D — Light Animation
Membuat DirectionalLight atau object visual penanda light bergerak untuk mengamati perubahan shading dan shadow.

### Challenge E — Shadow Quality
Membandingkan kualitas shadow map (512x512, 1024x1024, 2048x2048) untuk memahami trade-off antara quality vs resource cost.

### Challenge F — Scene Information
Memperluas HUD dengan Camera Position, Object Count, Triangle Count, FPS sederhana, Material aktif, dan mengeksplorasi renderer statistics (`renderer.info`).

### Challenge G — Toggle Animation
Menambahkan event-based keyboard (Space) untuk pause / resume animation menggunakan state boolean.

### Challenge H — Continuous Object Control
Menambahkan state-based keyboard input (Arrow untuk move cube, Q/E untuk rotate cube) dengan menggunakan delta time.

## Penjelasan Konsep dan Pertanyaan Pemahaman

### Apa hubungan Three.js dan WebGL?
Three.js adalah library JavaScript tingkat tinggi (high-level) yang dibangun di atas WebGL. Three.js menyederhanakan pembuatan grafis 3D kompleks dengan menyediakan abstraksi untuk objek, kamera, pencahayaan, material, dan bayangan, sehingga pengembang tidak perlu berurusan langsung dengan API WebGL yang low-level dan rumit.

### Mengapa Three.js disebut high-level library?
Karena Three.js menyembunyikan kerumitan interaksi langsung dengan GPU (seperti kompilasi shader, manajemen buffer, matriks transformasi matematis rumit) dan menyediakan antarmuka (API) yang lebih intuitif berbasis objek-objek 3D yang mudah dipahami.

### Apakah Three.js menghilangkan konsep buffer dan shader?
Tidak, Three.js tidak menghilangkannya. Three.js mengelola buffer dan shader di balik layar. Pengembang masih dapat mengakses dan memodifikasinya menggunakan fitur seperti `BufferGeometry` dan `ShaderMaterial` jika membutuhkan kontrol lebih mendalam.

### Apa fungsi Scene?
Scene adalah wadah utama di Three.js tempat kita menempatkan objek (Mesh), kamera, dan pencahayaan. Renderer akan menggambar apa yang ada di dalam Scene dari sudut pandang Kamera.

### Apa komponen minimum agar Mesh dapat terlihat?
Komponen minimum adalah:
1. `Geometry` (bentuk objek)
2. `Material` (tampilan permukaan objek)
3. Sebuah `Camera` yang mengarah ke objek
4. `Renderer` yang merender scene
(Jika menggunakan material yang bereaksi terhadap cahaya seperti MeshLambertMaterial, diperlukan juga setidaknya satu `Light`).

### Apa fungsi PerspectiveCamera?
PerspectiveCamera mensimulasikan cara mata manusia melihat dunia 3D, di mana objek yang lebih jauh akan tampak lebih kecil (proyeksi perspektif). Ini memberikan efek kedalaman yang realistis.

### Apa arti FOV?
FOV (Field of View) adalah seberapa luas sudut pandang kamera, diukur dalam derajat dari bawah ke atas layar. FOV besar akan mencakup lebih banyak area (seperti lensa wide-angle), sedangkan FOV kecil akan memperbesar area kecil (seperti lensa telefoto).

### Apa fungsi aspect ratio?
Aspect ratio adalah perbandingan antara lebar dan tinggi dari layar/canvas. Ini digunakan kamera untuk memastikan gambar tidak terdistorsi (terlihat gepeng atau memanjang) sesuai dengan dimensi layar penampil.

### Apa fungsi near dan far?
`near` dan `far` mendefinisikan bidang pemotongan dekat dan jauh dari kamera (frustum). Objek yang lebih dekat dari `near` atau lebih jauh dari `far` tidak akan dirender. Ini membantu optimasi performa.

### Apa fungsi camera.lookAt()?
Fungsi ini digunakan untuk mengarahkan kamera agar selalu menatap ke suatu koordinat atau posisi dari objek tertentu.

### Apa fungsi WebGLRenderer?
WebGLRenderer adalah komponen yang bertugas untuk mengambil informasi dari `Scene` dan `Camera`, lalu menggambarkannya (merender) sebagai piksel-piksel pada elemen canvas HTML menggunakan WebGL.

### Apa itu renderer.domElement?
`renderer.domElement` adalah elemen `<canvas>` HTML tempat WebGLRenderer menggambar grafis 3D. Elemen ini harus ditambahkan ke dalam DOM HTML (misalnya dengan `document.body.appendChild`) agar hasil render bisa dilihat.

### Apa fungsi Geometry?
Geometry mendefinisikan bentuk struktural dari sebuah objek 3D (seperti kubus, bola, silinder), yang tersusun dari titik-titik (vertices) dan bidang (faces).

### Apa hubungan BufferGeometry dengan vertex buffer?
`BufferGeometry` adalah cara Three.js mengelola vertex buffer (array data mentah) untuk dikirim langsung ke GPU secara efisien. Ini meminimalkan overhead karena data disimpan dalam format yang ramah GPU (Typed Arrays).

### Attribute apa yang umum tersedia pada BufferGeometry?
Atribut yang umum meliputi `position` (posisi verteks koordinat x,y,z), `normal` (vektor arah tegak lurus permukaan untuk perhitungan cahaya), `uv` (koordinat pemetaan tekstur), dan terkadang `color`.

### Apa fungsi Material?
Material mendefinisikan bagaimana permukaan objek berinteraksi dengan cahaya dan bagaimana warna/teksturnya ditampilkan, misalnya apakah objek terlihat kusam, mengkilap, transparan, atau bercahaya.

### Apa karakter MeshBasicMaterial?
MeshBasicMaterial adalah material yang paling sederhana dan **tidak bereaksi terhadap pencahayaan**. Objek akan terlihat datar dan memiliki warna merata terlepas dari ada atau tidaknya cahaya di scene.

### Apa fungsi MeshNormalMaterial?
MeshNormalMaterial memetakan warna berdasarkan vektor normal dari geometri. Ini sering digunakan untuk debugging karena kita bisa melihat perbedaan arah permukaan geometri dengan mudah melalui warnanya yang berbeda.

### Apa karakter MeshLambertMaterial?
MeshLambertMaterial digunakan untuk permukaan yang tidak mengkilap (non-shiny/diffuse) seperti kayu atau batu tak poles. Material ini bereaksi terhadap cahaya tetapi tidak memiliki specular highlight (pantulan tajam).

### Apa karakter MeshPhongMaterial?
MeshPhongMaterial digunakan untuk permukaan mengkilap (shiny) seperti logam, plastik licin, atau keramik. Material ini mendukung pencahayaan diffuse serta memberikan *specular highlight* (pantulan titik cahaya).

### Apa hubungan Geometry + Material + Mesh?
`Geometry` (kerangka bentuk) digabungkan dengan `Material` (tampilan permukaan) untuk membentuk sebuah `Mesh`. Mesh ini adalah objek 3D utuh yang akhirnya ditambahkan ke dalam Scene.

### Apa fungsi scene.add()?
Digunakan untuk memasukkan objek 3D (seperti Mesh, Camera, Light) ke dalam Scene agar objek tersebut bisa diproses dan digambar oleh renderer.

### Apa fungsi position?
Digunakan untuk menentukan lokasi / letak objek (x, y, z) relatif terhadap origin (pusat koordinat lokal atau scene).

### Apa fungsi rotation?
Digunakan untuk menentukan rotasi (sudut kemiringan/putaran) objek pada sumbu x, y, dan z.

### Apa fungsi scale?
Digunakan untuk memperbesar atau memperkecil ukuran objek pada sumbu x, y, dan z.

### Bagaimana transform Three.js berhubungan dengan Model Matrix?
Properti transformasi di Three.js (position, rotation, scale, quaternion) digunakan untuk membentuk **Model Matrix** objek tersebut. Model Matrix ini akan digunakan untuk mengubah koordinat vertex objek dari Local Space (ruang objek itu sendiri) ke World Space (ruang keseluruhan scene).

### Apa itu Object3D?
`Object3D` adalah class dasar untuk semua objek grafik dalam Three.js (Mesh, Camera, Light, Group). Class ini menyediakan properti dan metode fundamental seperti posisi, rotasi, skala, serta kemampuan untuk memiliki objek anak (hierarki scene graph).

### Apa fungsi AmbientLight?
AmbientLight memberikan pencahayaan merata ke seluruh objek di scene dari segala arah secara merata. Cahaya ini tidak memiliki arah, tidak memantul, dan tidak menghasilkan bayangan.

### Apa fungsi DirectionalLight?
DirectionalLight adalah cahaya yang memancar dari satu arah paralel yang jauh (seperti matahari). Cahaya ini berguna untuk menciptakan efek shading (terang gelap) dan dapat menghasilkan bayangan.

### Mengapa material tertentu membutuhkan Light?
Material seperti Lambert, Phong, dan Standard mensimulasikan interaksi dunia nyata dengan cahaya. Algoritma shader mereka membutuhkan nilai pencahayaan untuk menghitung warna akhir piksel; tanpa cahaya, perhitungannya bernilai 0 (hitam).

### Apa fungsi shadow?
Bayangan (shadow) memberikan isyarat visual tambahan yang krusial tentang hubungan spasial (kedalaman, jarak, kontak) antara objek-objek dalam adegan 3D, membuat scene terasa jauh lebih realistis.

### Apa arti castShadow?
Properti boolean yang menunjukkan apakah sebuah objek (Mesh) atau sumber cahaya akan menembakkan sinar (men-cast) bayangan terhadap benda lain yang menghalangi cahaya tersebut.

### Apa arti receiveShadow?
Properti boolean yang menunjukkan apakah permukaan sebuah objek (Mesh) dapat menampilkan bayangan yang jatuh dari objek lain ke atasnya.

### Mengapa renderer shadow map harus diaktifkan?
Perhitungan bayangan di real-time rendering menggunakan teknik Shadow Mapping yang cukup berat (mengambil memori dan beban komputasi tambahan). Three.js mematikannya secara default untuk menghemat performa, sehingga harus diaktifkan secara eksplisit.

### Apa fungsi animation loop?
Animation loop adalah fungsi yang terus-menerus berjalan untuk merender ulang scene pada setiap frame. Ini memungkinkan pembaruan posisi, rotasi, warna, dan interaksi pengguna secara terus menerus, sehingga menciptakan ilusi gerakan/animasi.

### Mengapa menggunakan requestAnimationFrame()?
`requestAnimationFrame()` adalah fungsi bawaan browser yang dioptimalkan untuk memanggil fungsi pembaruan sebelum browser melakukan repaint. Ia menyesuaikan dengan refresh rate monitor dan akan dijeda saat tab tidak aktif, yang mana lebih hemat daya dan halus dibanding `setInterval`.

### Apa fungsi delta time?
Delta time adalah waktu yang berlalu antara frame sebelumnya dan frame saat ini. Mengalikan pergerakan dengan delta time memastikan kecepatan animasi konsisten pada berbagai perangkat, terlepas dari seberapa cepat (FPS tinggi) atau lambat (FPS rendah) perangkat tersebut.

### Mengapa renderer harus responsif?
Agar aplikasi 3D tetap terlihat dengan baik ketika pengguna mengubah ukuran jendela browser atau saat dijalankan di perangkat dengan ukuran layar berbeda (desktop vs mobile), tanpa membuat ukuran canvas tertinggal.

### Mengapa camera aspect harus diperbarui saat resize?
Jika rasio lebar/tinggi jendela berubah, aspek rasio kamera juga harus disesuaikan. Jika tidak diperbarui, gambar yang dirender akan mengalami distorsi (memanjang atau menyusut) saat layar diperbesar/diperkecil.

### Mengapa updateProjectionMatrix() diperlukan?
Setelah mengubah properti kamera (seperti aspect, FOV, near, atau far), matriks internal yang mengubah ruang 3D menjadi proyeksi 2D harus dihitung ulang. `updateProjectionMatrix()` memicu perhitungan ulang ini agar perubahan diterapkan.

## Pertanyaan Analisis

### A — Abstraction
**Pertanyaan:** Bandingkan kode WebGL manual untuk membuat cube dengan: `new THREE.Mesh(geometry, material);`. Apa pekerjaan yang disederhanakan Three.js?
**Jawaban:** Three.js menyederhanakan pembuatan array vertex, kompilasi dan penautan vertex shader & fragment shader, penyiapan WebGL program, binding vertex buffer ke atribut, penyiapan matriks transformasi (Model, View, Projection), serta pemanggilan fungsi gambar bawaan seperti `gl.drawArrays` atau `gl.drawElements`. Semua langkah rumit yang butuh puluhan baris WebGL native digantikan dengan satu perintah pembuatan Mesh.

### B — Material
**Pertanyaan:** Mengapa `MeshBasicMaterial` dapat terlihat tanpa Light, sedangkan `MeshLambertMaterial` membutuhkan Light?
**Jawaban:** Karena shader dari `MeshBasicMaterial` hanya mengeluarkan warna dasar objek langsung ke layar, tanpa menghitung interaksi cahaya. Sementara itu, shader dari `MeshLambertMaterial` didesain untuk menghitung pantulan diffuse, di mana warna setiap piksel dikalikan dengan intensitas cahaya yang mengenai permukaannya. Tanpa lampu, intensitas cahaya = 0, sehingga warna = hitam.

### C — Geometry
**Pertanyaan:** Mengapa meningkatkan segment SphereGeometry membuat object lebih halus tetapi juga menambah beban geometry?
**Jawaban:** Segment yang lebih banyak berarti memecah permukaan bola menjadi lebih banyak segitiga/wajah (faces). Semakin banyak segitiga, kelengkungan terlihat semakin mulus. Namun, lebih banyak segitiga berarti lebih banyak jumlah vertex data yang harus dikirim ke memori GPU dan dihitung oleh vertex shader di setiap frame, sehingga meningkatkan beban komputasi.

### D — Transform
**Pertanyaan:** Ketika menulis `mesh.position.x = 2;` apakah vertex asli harus diubah satu per satu? Jelaskan hubungannya dengan Model Matrix.
**Jawaban:** Tidak. Mengubah `mesh.position.x` tidak mengubah data koordinat vertex geometri asli yang disimpan di memori. Sebaliknya, Three.js memperbarui *Model Matrix* dari Mesh tersebut. Matriks ini lalu dikirim ke GPU. Di dalam GPU (lewat vertex shader), semua vertex asli dikalikan dengan Model Matrix ini secara massal (paralel) untuk menghasilkan posisi finalnya di layar.

### E — Shadow
**Pertanyaan:** Mengapa shadow memerlukan konfigurasi lebih dari sekadar menambahkan Light?
**Jawaban:** Karena rendering bayangan di WebGL (Shadow Mapping) membutuhkan banyak langkah kalkulasi ekstra: kamera harus me-render scene dari sudut pandang lampu ke dalam sebuah tekstur (shadow map), lalu melakukan perbandingan kedalaman untuk mengetahui area yang tertutup. Ini memerlukan alokasi memori tambahan (untuk texture shadow), mengaktifkan shadow renderer, serta konfigurasi per-objek (mana yang melempar cahaya, mana yang menerima bayangan) untuk membatasi beban komputasi.

### F — Responsive Rendering
**Pertanyaan:** Apa yang terjadi jika renderer resize tetapi aspect camera tidak diperbarui?
**Jawaban:** Jika ukuran canvas membesar/mengecil (lebar dan tinggi berubah), tetapi proyeksi kamera masih menganggap layar berukuran lama, maka objek-objek di scene akan ditarik melar (distorsi) untuk memenuhi ruang baru yang tidak proporsional dengan aspect awalnya. Bentuk lingkaran mungkin terlihat jadi lonjong, misalnya.

---
*README ini dibuat untuk memenuhi tugas Praktikum Pengenalan Three.js.*
