# Aset Elemental Army Run

Semua aset di folder ini berlisensi **CC0 1.0 (domain publik)**: bebas dipakai,
diubah, dan dibagikan untuk keperluan apa pun, tanpa wajib mencantumkan kredit.
Kredit tetap dicantumkan sebagai bentuk apresiasi kepada pembuatnya.

| Folder / file | Sumber | Pembuat | Link |
|---|---|---|---|
| models/city/ (gedung) | City Kit (Commercial) | Kenney | https://kenney.nl/assets/city-kit-commercial |
| models/props/light-square, construction-cone, construction-barrier, traffic-light | City Kit (Roads) | Kenney | https://kenney.nl/assets/city-kit-roads |
| models/props/arch-*, barrier, bomb, pillar | KayKit Platformer Pack | Kay Lousberg | https://kaylousberg.itch.io |
| models/boss/robot.glb | RobotExpressive | Tomás Laulhé (Quaternius), modifikasi Don McCurdy | https://github.com/mrdoob/three.js (examples/models/gltf/RobotExpressive) |
| textures/road/ | Road007 | ambientCG | https://ambientcg.com/view?id=Road007 |
| textures/arena/ | Tiles142 | ambientCG | https://ambientcg.com/view?id=Tiles142 |
| textures/metal/ | Metal049A | ambientCG | https://ambientcg.com/view?id=Metal049A |
| particles/ | Particle Pack | Kenney | https://opengameart.org/content/particle-pack-80-sprites |
| hdr/sky.hdr | Venice Sunset | Poly Haven | https://polyhaven.com/a/venice_sunset |

## Pengolahan yang dilakukan
- Model KayKit `.gltf` + `.bin` + `.png` digabung menjadi satu file `.glb` (gltf-transform).
- Model Kenney `.glb` di-embed ulang agar teksturnya menyatu di dalam file.
- Tekstur ambientCG diperkecil dari 2048 ke 1024 piksel (color, normal GL, roughness, metalness).
- Sprite partikel diperkecil dari 512 ke 128 piksel dan dikonversi ke PNG RGBA.

## Format
- `.glb`: model 3D glTF biner (bisa dibuka di Blender, three.js, Babylon.js, https://gltf-viewer.donmccurdy.com)
- `.jpg`: tekstur PBR (format asli ambientCG)
- `.png`: sprite partikel
- `.hdr`: peta lingkungan untuk pencahayaan
