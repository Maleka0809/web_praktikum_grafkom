/**
 * ETS Grafika Komputer - Sistem Monster Sampah Raksasa (Trash Titan Boss Event)
 * Menggunakan aset GLB:
 * 1. flexmusc_sampah.glb (Fase Pamer Otot / Mengintimidasi Kota)
 * 2. swipping_sampah.glb (Fase Menyerang / Mengayunkan Cakar Sampah)
 *
 * Mekanisme:
 * - Muncul otomatis setelah 1 menit (60 detik) berlari
 * - Dilengkapi HUD timer & countdown bahaya
 * - Efek screen-shake & sirine peringatan saat monster tiba
 * - Hadir megah dari kejauhan horizon lalu bertahan di arena tempur (Combat Stance)
 * - Pertarungan epik: Pasukan (Army) pemain menembakkan energi ke arah Monster
 * - Boss berganti fase antara Pamer Otot (Flexing) dan Serangan Cakar (Swiping)
 * - Boss Health Bar (HP) proporsional berdurasi seru ~10 detik
 * - Saat kalah: Hadiah EXP besar (+500 EXP, +10 Pasukan) & perayaan kemenangan!
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class MonsterManager {
  constructor(scene, mainMesh, cylinderRadius, camera, gateManager = null) {
    this.scene = scene;
    this.mainMesh = mainMesh;
    this.cylinderRadius = cylinderRadius;
    this.camera = camera;
    this.gateManager = gateManager;

    // Timer state
    this.runTime = 0.0;
    this.targetSpawnTime = 60.0; // 60 detik (1 menit)
    this.isSpawned = false;
    this.isDefeated = false;
    this.warningActive = false;

    // Boss State
    this.maxHp = 5000;
    this.hp = 5000;
    this.bossTheta = 0.0;
    this.currentDistance = 1.30; // Radian di depan pelari
    this.targetCombatDistance = 0.38; // Jarak arena tempur di depan kamera pelari
    this.phaseTimer = 0.0;
    this.currentPhase = 'flex'; // 'flex' | 'swipe' | 'defeated'

    // 3D Objects & Animations
    this.bossWrapper = new THREE.Group();
    this.mainMesh.add(this.bossWrapper);
    this.bossWrapper.visible = false;

    this.flexModel = null;
    this.flexMixer = null;
    this.flexAction = null;

    this.swipeModel = null;
    this.swipeMixer = null;
    this.swipeAction = null;

    // Projectile & Combat Particles
    this.projectiles = [];
    this.stompParticles = [];
    this.shakeIntensity = 0.0;

    // Audio
    this.initAudio();

    // DOM HUD
    this.initHud();

    // Load Model GLB
    this.loadMonsterModels();
  }

  // -------------------------------------------------------------
  // AUDIO SYNTHESIS UNTUK BOSS
  // -------------------------------------------------------------
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playSfx(type) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'roar') {
      // Raungan monster rendah & bergetar
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.9);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.start(now);
      osc.stop(now + 1.15);
    } else if (type === 'siren') {
      // Sirine tanda bahaya kota
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.linearRampToValueAtTime(720, now + 0.35);
      osc.frequency.linearRampToValueAtTime(480, now + 0.70);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.start(now);
      osc.stop(now + 0.76);
    } else if (type === 'hit') {
      // Tembakan energi mengenai monster
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'victory') {
      // Fanfare kemenangan besar
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.36); // C6
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.start(now);
      osc.stop(now + 0.96);
    }
  }

  // -------------------------------------------------------------
  // HUD TIMER & BOSS HEALTH BAR
  // -------------------------------------------------------------
  initHud() {
    // 1. Timer Lari Menuju Monster (di baris HUD kanan atas)
    let hudOverlay = document.querySelector('.hud-overlay');
    if (hudOverlay && !document.getElementById('bossTimerHud')) {
      const timerItem = document.createElement('div');
      timerItem.id = 'bossTimerHud';
      timerItem.className = 'hud-item';
      timerItem.style.cssText = 'background: rgba(15, 23, 42, 0.90); border: 1.5px solid #f59e0b; border-radius: 8px; padding: 5px 12px; font-weight: 600; display: flex; gap: 8px; align-items: center;';
      timerItem.innerHTML = `⏱️ LARI: <span id="runTimerText" style="color:#facc15; font-weight:800;">00:00</span> <span style="color:#64748b;">|</span> <span id="monsterCountdownBadge" style="color:#38bdf8;">Monster: 60s</span>`;
      hudOverlay.appendChild(timerItem);
    }

    // 2. Boss Health Bar (Mengambang di Atas Tengah Layar)
    if (!document.getElementById('bossHpContainer')) {
      const hpBox = document.createElement('div');
      hpBox.id = 'bossHpContainer';
      hpBox.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 460px;
        max-width: 90vw;
        background: rgba(15, 23, 42, 0.94);
        border: 2px solid #ef4444;
        border-radius: 12px;
        padding: 10px 18px;
        box-shadow: 0 0 28px rgba(239, 68, 68, 0.65);
        z-index: 1000;
        display: none;
        flex-direction: column;
        gap: 6px;
        text-align: center;
        pointer-events: none;
        animation: pulseWarning 1.5s infinite;
      `;
      hpBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 14px; letter-spacing: 0.5px;">
          <span style="color: #f87171;">👾 BOSS: MONSTER SAMPAH KOTA</span>
          <span id="bossHpText" style="color: #fef08a;">5000 / 5000 HP</span>
        </div>
        <div style="width: 100%; height: 16px; background: #334155; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);">
          <div id="bossHpBarFill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b); border-radius: 8px; transition: width 0.15s ease-out;"></div>
        </div>
        <div id="bossSubtitle" style="font-size: 11px; color: #94a3b8;">Kalahkan Monster Sampah bersama Pasukanmu!</div>
      `;
      const canvasWrapper = document.querySelector('.canvas-wrapper') || document.body;
      canvasWrapper.appendChild(hpBox);
    }
  }

  updateHud(delta) {
    const timerText = document.getElementById('runTimerText');
    const badgeText = document.getElementById('monsterCountdownBadge');
    if (timerText) {
      const mins = Math.floor(this.runTime / 60);
      const secs = Math.floor(this.runTime % 60);
      timerText.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    if (badgeText) {
      if (!this.isSpawned && !this.isDefeated) {
        const remaining = Math.max(0, Math.ceil(this.targetSpawnTime - this.runTime));
        badgeText.innerText = `Monster: ${remaining}s`;
        if (remaining <= 5) {
          badgeText.style.color = '#ef4444';
          badgeText.style.fontWeight = 'bold';
        } else {
          badgeText.style.color = '#38bdf8';
        }
      } else if (this.isSpawned && !this.isDefeated) {
        badgeText.innerText = `🚨 BOSS BATTLE!`;
        badgeText.style.color = '#ef4444';
      } else if (this.isDefeated) {
        badgeText.innerText = `🏆 MENANG!`;
        badgeText.style.color = '#10b981';
      }
    }

    // Update HP Bar
    const hpFill = document.getElementById('bossHpBarFill');
    const hpText = document.getElementById('bossHpText');
    if (hpFill && hpText) {
      const pct = Math.max(0, (this.hp / this.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
      hpText.innerText = `${Math.ceil(this.hp)} / ${this.maxHp} HP`;
    }
  }

  // -------------------------------------------------------------
  // LOAD DUA ASET GLB MONSTER SAMPAH
  // -------------------------------------------------------------
  loadMonsterModels() {
    const gltfLoader = new GLTFLoader();

    // 1. Model Flex (Pamer Otot / Mengintimidasi)
    gltfLoader.load('./assets/flexmusc_sampah.glb', (gltf) => {
      this.flexModel = gltf.scene;
      this.prepareMonsterModel(this.flexModel);
      this.bossWrapper.add(this.flexModel);

      if (gltf.animations && gltf.animations.length > 0) {
        this.flexMixer = new THREE.AnimationMixer(this.flexModel);
        this.flexAction = this.flexMixer.clipAction(gltf.animations[0]);
        this.flexAction.play();
      }
      this.flexModel.visible = true;
    });

    // 2. Model Swiping (Menyerang / Mengayunkan Cakar Sampah)
    gltfLoader.load('./assets/swipping_sampah.glb', (gltf) => {
      this.swipeModel = gltf.scene;
      this.prepareMonsterModel(this.swipeModel);
      this.bossWrapper.add(this.swipeModel);

      if (gltf.animations && gltf.animations.length > 0) {
        this.swipeMixer = new THREE.AnimationMixer(this.swipeModel);
        this.swipeAction = this.swipeMixer.clipAction(gltf.animations[0]);
        this.swipeAction.play();
      }
      this.swipeModel.visible = false;
    });

    // Lampu Khusus Boss (Sorotan Keemasan agar Tubuh Monster & Sampahnya Berkilau Jelas)
    const bossLight = new THREE.PointLight(0xffedd5, 3.2, 4.0);
    bossLight.position.set(0, 0.75, -0.60);
    this.bossWrapper.add(bossLight);
  }

  prepareMonsterModel(model) {
    // Skala raksasa: monster sampah bertubuh kekar setinggi ~1.0m (6x lipat karakter pelari)
    const s = 0.46;
    model.scale.set(s, s, s);
    // Putar 180 derajat agar menghadap ke arah pelari & kamera (+Z Mixamo -> -Z basis wrapper)
    model.rotation.y = Math.PI;
    model.position.set(0, 0.015, 0);

    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material = node.material.clone();
          node.material.roughness = 0.40;
          node.material.metalness = 0.20;
          // Pendaran lembut agar warna botol saus, karton susu, dan drum sampah terlihat jelas
          if (node.material.color) {
            node.material.emissive = node.material.color.clone();
            node.material.emissiveIntensity = 0.25;
          }
        }
      }
    });
  }

  // -------------------------------------------------------------
  // SPAWN BOSS KETIKA WAKTU MENCAPAI 1 MENIT (60 DETIK)
  // -------------------------------------------------------------
  spawnMonster() {
    if (this.isSpawned && !this.isDefeated) return;
    this.isSpawned = true;
    this.isDefeated = false;

    // Reset posisi ketinggian model jika sebelumnya tenggelam
    if (this.flexModel) this.flexModel.position.set(0, 0.015, 0);
    if (this.swipeModel) this.swipeModel.position.set(0, 0.015, 0);

    // HP Dinamis disesuaikan dengan ukuran pasukan agar pertarungan berlangsung ~9-10 detik
    const army = this.gateManager ? this.gateManager.armyCount : 1;
    const lvl = this.gateManager ? this.gateManager.level : 1;
    this.maxHp = Math.max(5000, army * 75 + lvl * 250);
    this.hp = this.maxHp;

    // Jarak tempuh bos di depan pemain: mulai dari horizon (~1.30 rad)
    this.currentDistance = 1.30;
    this.phaseTimer = 0.0;
    this.currentPhase = 'flex';

    const playerTheta = Math.asin(0.15 / this.cylinderRadius);
    this.bossTheta = (this.mainMesh.rotation.y + playerTheta + this.currentDistance) % (Math.PI * 2);

    this.updateBossTransform();
    this.bossWrapper.visible = true;

    // Tampilkan HP Container
    const hpBox = document.getElementById('bossHpContainer');
    if (hpBox) hpBox.style.display = 'flex';

    // Putar suara sirine bahaya dan raungan monster
    this.playSfx('siren');
    setTimeout(() => this.playSfx('roar'), 650);

    // Getarkan layar (screen shake)
    this.shakeIntensity = 0.065;

    // Aktifkan model Flex pertama kali
    if (this.flexModel) this.flexModel.visible = true;
    if (this.swipeModel) this.swipeModel.visible = false;
  }

  updateBossTransform() {
    const posX = this.cylinderRadius * Math.cos(this.bossTheta);
    const posZ = this.cylinderRadius * Math.sin(this.bossTheta);

    const xAxis = new THREE.Vector3(0, -1, 0);
    const yAxis = new THREE.Vector3(Math.cos(this.bossTheta), 0, Math.sin(this.bossTheta));
    const zAxis = new THREE.Vector3(-Math.sin(this.bossTheta), 0, Math.cos(this.bossTheta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    this.bossWrapper.setRotationFromMatrix(basisMat);
    // Posisi di tengah jalan (Y = 0) pada permukaan silinder
    this.bossWrapper.position.set(posX, 0.0, posZ);
  }

  // -------------------------------------------------------------
  // PERTARUNGAN: TEMBAKAN ENERGI PASUKAN KE MONSTER
  // -------------------------------------------------------------
  fireArmyProjectiles(avatarLaneY) {
    const surfaceX = Math.sqrt(this.cylinderRadius * this.cylinderRadius - 0.15 * 0.15);
    const startPos = new THREE.Vector3(surfaceX, avatarLaneY, 0.15);

    // Arahkan ke titik tubuh monster
    const bossWorldPos = new THREE.Vector3();
    this.bossWrapper.getWorldPosition(bossWorldPos);

    // Buat orb energi partikel
    const count = 3;
    for (let k = 0; k < count; k++) {
      const geo = new THREE.SphereGeometry(0.045, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.90
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(startPos);
      mesh.position.x += 0.15 + (Math.random() - 0.5) * 0.10;
      mesh.position.y += (Math.random() - 0.5) * 0.25;

      this.scene.add(mesh);
      this.projectiles.push({
        mesh: mesh,
        targetPos: bossWorldPos.clone().add(new THREE.Vector3(0.35, 0, 0)),
        progress: 0.0,
        speed: 3.5 + Math.random() * 1.5
      });
    }
  }

  // -------------------------------------------------------------
  // KEMENANGAN: MONSTER SAMPAH DIKALAHKAN
  // -------------------------------------------------------------
  defeatMonster() {
    if (this.isDefeated) return;
    this.isDefeated = true;
    this.currentPhase = 'defeated';

    this.playSfx('victory');

    // Sembunyikan HP Box
    const hpBox = document.getElementById('bossHpContainer');
    if (hpBox) hpBox.style.display = 'none';

    // Hadiah Kemenangan Besar ke Pemain
    if (this.gateManager) {
      this.gateManager.exp += 500;
      this.gateManager.armyCount += 10;
      this.gateManager.level += 1;
      this.gateManager.updateHud();
      this.gateManager.drawHeadBadge(true);
      this.gateManager.syncArmyClones();

      const surfaceX = Math.sqrt(this.cylinderRadius * this.cylinderRadius - 0.15 * 0.15);
      this.gateManager.createFloatingPopup('🏆 MONSTER SAMPAH DIKALAHKAN! (+500 EXP)', '#facc15', {
        x: surfaceX + 0.35,
        y: 0,
        z: 0.15
      });
    }

    // Ledakan partikel kemenangan
    const bossWorldPos = new THREE.Vector3();
    this.bossWrapper.getWorldPosition(bossWorldPos);
    this.createVictoryBurst(bossWorldPos);

    // Animasi monster tenggelam perlahan ke bawah aspal secara lokal
    let sinkY = 0.015;
    const sinkInterval = setInterval(() => {
      sinkY -= 0.025;
      if (this.flexModel) this.flexModel.position.y = sinkY;
      if (this.swipeModel) this.swipeModel.position.y = sinkY;

      if (sinkY < -1.6) {
        clearInterval(sinkInterval);
        this.bossWrapper.visible = false;
        this.isSpawned = false;
        this.isDefeated = false; // Reset state agar siklus berikutnya dapat berjalan kembali
        if (this.flexModel) this.flexModel.position.set(0, 0.015, 0);
        if (this.swipeModel) this.swipeModel.position.set(0, 0.015, 0);
        // Reset waktu agar monster berikutnya muncul 60 detik lagi
        this.runTime = 0.0;
        this.warningActive = false;
      }
    }, 25);
  }

  createVictoryBurst(pos) {
    const count = 75;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = pos.x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;

      velocities.push({
        x: (Math.random() - 0.5) * 2.0,
        y: 1.0 + Math.random() * 1.5,
        z: (Math.random() - 0.5) * 2.0
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfacc15,
      size: 0.065,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.stompParticles.push({
      points: pSystem,
      velocities: velocities,
      life: 0.0,
      maxLife: 1.5
    });
  }

  // -------------------------------------------------------------
  // UPDATE LOOP FRAME (ANIMASI, TIMER, COMBAT, SHAKE)
  // -------------------------------------------------------------
  update(delta, avatarLaneY, isAnimating) {
    if (!isAnimating) return;

    // 1. Jalankan Timer Lari Menuju 60 Detik (1 Menit)
    if (!this.isSpawned && !this.isDefeated) {
      this.runTime += delta;

      // Peringatan pra-kemunculan di detik 55
      if (this.runTime >= 55.0 && !this.warningActive) {
        this.warningActive = true;
        this.playSfx('siren');
      }

      // Tepat 60 detik -> Monster Sampah Muncul!
      if (this.runTime >= this.targetSpawnTime) {
        this.spawnMonster();
      }
    }

    this.updateHud(delta);

    // 2. Update Animasi Model Mixer
    if (this.flexMixer && this.flexModel && this.flexModel.visible) {
      this.flexMixer.update(delta * 1.2);
    }
    if (this.swipeMixer && this.swipeModel && this.swipeModel.visible) {
      this.swipeMixer.update(delta * 1.2);
    }

    // 3. Logika Pergerakan & Pertarungan Bos
    if (this.isSpawned && !this.isDefeated) {
      const playerTheta = Math.asin(0.15 / this.cylinderRadius);

      // Boss mendekat mulus dari horizon (1.30 rad) menuju Combat Stance (0.38 rad)
      this.currentDistance = THREE.MathUtils.lerp(
        this.currentDistance,
        this.targetCombatDistance,
        delta * 1.2
      );

      // Selaraskan sudut bos agar tetap berdiri tegak di depan pelari
      this.bossTheta = (this.mainMesh.rotation.y + playerTheta + this.currentDistance) % (Math.PI * 2);
      this.updateBossTransform();

      // Pergantian Fase Aksi Monster: Pamer Otot vs Mengayunkan Cakar
      this.phaseTimer += delta;
      if (this.phaseTimer > 2.8) {
        this.phaseTimer = 0.0;
        if (this.currentPhase === 'flex') {
          this.currentPhase = 'swipe';
          if (this.flexModel) this.flexModel.visible = false;
          if (this.swipeModel) this.swipeModel.visible = true;
          this.shakeIntensity = 0.045; // Hentakan gempa saat cakar mengayun
        } else {
          this.currentPhase = 'flex';
          if (this.flexModel) this.flexModel.visible = true;
          if (this.swipeModel) this.swipeModel.visible = false;
          this.playSfx('roar'); // Raungan intimidasi
        }
      }

      // Jika sudah berada di jarak tempur (<= 0.55 rad): Pertarungan Dimulai!
      if (this.currentDistance <= 0.55) {
        // Pasukan Pemain Melakukan Serangan Otomatis Menembak Monster!
        if (Math.random() < 0.45) {
          this.fireArmyProjectiles(avatarLaneY);
        }

        // Hitung DPS seimbang agar pertempuran berlangsung seru ~9-10 detik
        const durationSec = 9.5;
        const dps = (this.maxHp / durationSec) * delta;
        this.hp = Math.max(0, this.hp - dps);

        if (Math.random() < 0.18) {
          this.playSfx('hit');
        }

        // Cek jika Monster Kalah!
        if (this.hp <= 0) {
          this.defeatMonster();
        }
      }
    }

    // 4. Update Peluru Energi Pasukan
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += delta * p.speed;
      p.mesh.position.lerp(p.targetPos, Math.min(1.0, delta * 8.0));

      if (p.progress >= 1.0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Update Partikel Ledakan
    for (let i = this.stompParticles.length - 1; i >= 0; i--) {
      const sp = this.stompParticles[i];
      sp.life += delta;
      const pos = sp.points.geometry.attributes.position.array;
      for (let j = 0; j < sp.velocities.length; j++) {
        pos[j * 3 + 0] += sp.velocities[j].x * delta;
        pos[j * 3 + 1] += sp.velocities[j].y * delta;
        pos[j * 3 + 2] += sp.velocities[j].z * delta;
      }
      sp.points.geometry.attributes.position.needsUpdate = true;
      sp.points.material.opacity = Math.max(0, 1.0 - (sp.life / sp.maxLife));

      if (sp.life >= sp.maxLife) {
        this.scene.remove(sp.points);
        sp.points.geometry.dispose();
        sp.points.material.dispose();
        this.stompParticles.splice(i, 1);
      }
    }

    // 6. Screen Shake
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.lerp(this.shakeIntensity, 0.0, delta * 4.0);
    }
  }
}
