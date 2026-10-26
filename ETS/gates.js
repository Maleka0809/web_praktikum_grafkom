/**
 * ETS Grafika Komputer - Sistem Gerbang Runner Terpadu (Gate Manager)
 * Fitur:
 * - Klasifikasi Gerbang Acak:
 *   1. Tambah Army (👤 +5, +10, +15)
 *   2. Penggandaan Army (👥 ×2, ×3)
 *   3. Minus Army (👤 -3, -5, -8)
 *   4. Tambah EXP (⭐ +50 EXP, +100 EXP) & Level Up!
 *   5. Minus EXP (🔻 -30 EXP, -50 EXP)
 *   6. Elemen Modifier (💧 +25, ⇄ ⚡ UBAH, ⇄ 🔥 UBAH)
 * - Tata Letak Acak (TIDAK SELALU SEBELAH-SEBELAHAN):
 *   Bisa jalur kiri saja, jalur kanan saja, jalur tengah, atau sepasang pilihan.
 * - Pasukan Army 3D Berlari Mengikuti Karakter Pemimpin di Belakang
 * - Bubble Counter 3D di Atas Kepala Karakter (👥 Pasukan)
 * - Suara Sintesis Retro Web Audio API untuk efek bonus & minus
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class GateManager {
  constructor(scene, mainMesh, cylinderRadius, avatarGroup = null, getAvatarModel = null) {
    this.scene = scene;
    this.mainMesh = mainMesh;
    this.cylinderRadius = cylinderRadius;
    this.avatarGroup = avatarGroup;
    this.getAvatarModel = getAvatarModel;

    this.gateStations = [];
    this.popups = [];
    this.burstParticles = [];

    // Player State
    this.armyCount = 1;
    this.exp = 0;
    this.level = 1;
    this.nextLevelExp = 100;
    this.waterScore = 0;
    this.activeElement = '⚡ LISTRIK';

    // Army Clones Visuals
    this.armyClones = [];
    this.armyMixers = [];
    this.armyHeadBadge = null;
    this.headBadgeScale = 1.0;

    // Web Audio Synthesizer (Tanpa perlu file audio eksternal)
    this.initAudio();

    // Inisialisasi HUD Overlay
    this.initHud();

    // Buat Badge Angka Pasukan di Atas Kepala Avatar
    if (this.avatarGroup) {
      this.initHeadBadge();
    }

    // Bangun 3 stasiun gerbang acak pertama
    this.initStations();
  }

  // -------------------------------------------------------------
  // AUDIO SYNTHESIZER (WEB AUDIO API)
  // -------------------------------------------------------------
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playSound(type) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'positive') {
      // Dua nada ceria naik (Arpeggio)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'negative') {
      // Nada rendah peringatan / buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      osc.start(now);
      osc.stop(now + 0.31);
    } else if (type === 'levelup') {
      // Fanfare gembira
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.09);
      osc.frequency.setValueAtTime(659.25, now + 0.18);
      osc.frequency.setValueAtTime(880, now + 0.27);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.56);
    }
  }

  // -------------------------------------------------------------
  // HUD OVERLAY (STATISTIK LENGKAP)
  // -------------------------------------------------------------
  initHud() {
    let hud = document.getElementById('runnerScoreHud');
    const hudOverlay = document.querySelector('.hud-overlay');
    if (!hud && hudOverlay) {
      hud = document.createElement('div');
      hud.id = 'runnerScoreHud';
      hud.className = 'hud-item';
      hud.style.cssText = 'background: rgba(15, 23, 42, 0.92); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 5px 14px; font-weight: 600; display: flex; gap: 12px; align-items: center; box-shadow: 0 0 14px rgba(56, 189, 248, 0.40); flex-wrap: wrap;';
      hudOverlay.appendChild(hud);
    }
    this.updateHud();
  }

  updateHud() {
    const hud = document.getElementById('runnerScoreHud');
    if (hud) {
      hud.innerHTML = `
        <span>👥 PASUKAN: <span id="hudArmyVal" style="color: #38bdf8; font-weight: 800; font-size: 1.15em;">${this.armyCount}</span></span>
        <span style="color:#64748b;">|</span>
        <span>⭐ LVL: <span style="color: #facc15; font-weight: 800;">${this.level}</span> (<span style="color:#e2e8f0; font-size:0.9em;">EXP: ${this.exp}/${this.nextLevelExp}</span>)</span>
        <span style="color:#64748b;">|</span>
        <span>💧 AIR: <span style="color: #06b6d4; font-weight: 800;">${this.waterScore}</span></span>
        <span style="color:#64748b;">|</span>
        <span>ELEMEN: <span style="color: #f97316; font-weight: 800;">${this.activeElement}</span></span>
      `;
    }
  }

  // -------------------------------------------------------------
  // BUBBLE BADGE DI ATAS KEPALA KARAKTER (COUNT MASTERS STYLE)
  // -------------------------------------------------------------
  initHeadBadge() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    this.badgeCanvas = canvas;
    this.badgeCtx = canvas.getContext('2d');
    this.badgeTexture = new THREE.CanvasTexture(canvas);
    this.badgeTexture.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.SpriteMaterial({
      map: this.badgeTexture,
      transparent: true,
      depthTest: false
    });
    this.armyHeadBadge = new THREE.Sprite(mat);
    this.armyHeadBadge.scale.set(0.18, 0.08, 1.0);
    // +X adalah ke atas normal kepala di koordinat silinder
    this.armyHeadBadge.position.set(0.0, 0.32, 0.0);
    this.avatarGroup.add(this.armyHeadBadge);

    this.drawHeadBadge();
  }

  drawHeadBadge(isPunch = false) {
    if (!this.badgeCtx) return;
    const ctx = this.badgeCtx;
    const w = 256;
    const h = 128;
    ctx.clearRect(0, 0, w, h);

    // Kapsul Pill
    const r = 36;
    const x = 16;
    const y = 16;
    const bw = w - 32;
    const bh = h - 32;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + bw - r, y);
    ctx.arcTo(x + bw, y, x + bw, y + r, r);
    ctx.lineTo(x + bw, y + bh - r);
    ctx.arcTo(x + bw, y + bh, x + bw - r, y + bh, r);
    ctx.lineTo(x + r, y + bh);
    ctx.arcTo(x, y + bh, x, y + bh - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.lineWidth = 10;
    ctx.strokeStyle = isPunch ? '#facc15' : '#38bdf8';
    ctx.stroke();

    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 56px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.fillText(`👥 ${this.armyCount}`, w / 2, h / 2 + 2);

    this.badgeTexture.needsUpdate = true;
    if (isPunch) {
      this.headBadgeScale = 1.35;
    }
  }

  // -------------------------------------------------------------
  // UPDATE VISUAL PASUKAN (COUNT MASTERS CROWD CLUSTER)
  // -------------------------------------------------------------
  syncArmyClones() {
    if (!this.avatarGroup) return;

    // Tampilkan hingga 15 klon 3D pasukan nyata berlari bersama dengan jarak renggang yang jelas
    const targetVisualCount = Math.min(15, Math.max(1, this.armyCount)) - 1;

    // Ambil base model avatar jika tersedia
    const baseModel = (this.getAvatarModel && this.getAvatarModel()) || null;

    // Slot formasi kerumunan berjarak renggang (Count Masters flocking)
    // Melebar ke samping kiri-kanan & mengelilingi pemimpin tanpa menumpuk
    const CLUSTER_OFFSETS = [
      // Flank sayap kiri & kanan sejajar pemimpin
      { x: -0.068, z: -0.015 },
      { x:  0.068, z: -0.015 },
      // Tepat di belakang pemimpin
      { x:  0.000, z: -0.050 },
      // Sayap luar kiri & kanan
      { x: -0.130, z: -0.030 },
      { x:  0.130, z: -0.030 },
      // Baris kedua kiri & kanan
      { x: -0.068, z: -0.072 },
      { x:  0.068, z: -0.072 },
      // Sayap terluar kiri & kanan
      { x: -0.180, z: -0.045 },
      { x:  0.180, z: -0.045 },
      // Baris tengah belakang
      { x:  0.000, z: -0.095 },
      // Baris ketiga kiri & kanan
      { x: -0.125, z: -0.088 },
      { x:  0.125, z: -0.088 },
      // Baris belakang luar
      { x: -0.065, z: -0.118 },
      { x:  0.065, z: -0.118 },
      // Belakang tengah penutup
      { x:  0.000, z: -0.132 }
    ];

    // Jika jumlah kurang, tambahkan klon baru
    while (this.armyClones.length < targetVisualCount && baseModel) {
      const idx = this.armyClones.length;
      let clone = null;
      try {
        clone = SkeletonUtils.clone(baseModel);
      } catch (e) {
        clone = baseModel.clone(true);
      }

      // Ambil slot formasi atau hitung sebaran spiral organik
      let pos;
      if (idx < CLUSTER_OFFSETS.length) {
        pos = CLUSTER_OFFSETS[idx];
      } else {
        const angle = idx * 2.399; // Golden angle spiral
        const dist = 0.08 + Math.floor(idx / 6) * 0.035;
        pos = {
          x: Math.cos(angle) * Math.min(0.18, dist),
          z: -0.045 + Math.sin(angle) * 0.055
        };
      }

      clone.position.set(pos.x, 0.009, pos.z);
      clone.scale.set(0.034, 0.034, 0.034);

      // Pendaran cerah pada pakaian pasukan agar kontras dan memukau di atas aspal
      clone.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = node.material.clone();
          if (node.material.color) {
            node.material.emissive = node.material.color.clone();
            node.material.emissiveIntensity = 0.35;
          }
        }
      });

      // Animasi lari klon pasukan yang hidup & natural
      const anims = baseModel.animations || (baseModel.userData && baseModel.userData.animations);
      if (anims && anims.length > 0) {
        const mixer = new THREE.AnimationMixer(clone);
        const action = mixer.clipAction(anims[0]);
        action.time = Math.random() * 0.7; // variasi langkah alami
        action.play();
        clone.userData.mixer = mixer;
        this.armyMixers.push(mixer);
      }

      this.avatarGroup.add(clone);
      this.armyClones.push(clone);
    }

    // Jika jumlah berkurang (akibat gerbang minus), hapus klon berlebih
    while (this.armyClones.length > targetVisualCount) {
      const removed = this.armyClones.pop();
      if (removed) {
        if (removed.userData && removed.userData.mixer) {
          const mIdx = this.armyMixers.indexOf(removed.userData.mixer);
          if (mIdx !== -1) this.armyMixers.splice(mIdx, 1);
        }
        this.avatarGroup.remove(removed);
      }
    }
  }

  // -------------------------------------------------------------
  // GENERATOR KONFIGURASI GERBANG ACAK (POOL LENGKAP)
  // -------------------------------------------------------------
  getRandomGateConfig(forcePositive = null) {
    const POOL = [
      // 1. TAMBAH ARMY (POSITIF)
      { type: 'army_add', value: 5, icon: '👤', text: '+5', pipeColor: 0x38bdf8, veilColor: 'rgba(56, 189, 248, 0.45)', dotColor: 'rgba(224, 242, 254, 0.95)', borderColor: '#38bdf8', isPositive: true },
      { type: 'army_add', value: 10, icon: '👤', text: '+10', pipeColor: 0x06b6d4, veilColor: 'rgba(6, 182, 212, 0.45)', dotColor: 'rgba(207, 250, 254, 0.95)', borderColor: '#06b6d4', isPositive: true },
      { type: 'army_add', value: 15, icon: '👤', text: '+15', pipeColor: 0x0284c7, veilColor: 'rgba(2, 132, 199, 0.45)', dotColor: 'rgba(224, 242, 254, 0.95)', borderColor: '#0284c7', isPositive: true },

      // 2. PENGGANDAAN ARMY (SUPER POSITIF)
      { type: 'army_multiply', value: 2, icon: '👥', text: '×2', pipeColor: 0x10b981, veilColor: 'rgba(16, 185, 129, 0.45)', dotColor: 'rgba(209, 250, 229, 0.95)', borderColor: '#10b981', isPositive: true },
      { type: 'army_multiply', value: 3, icon: '👥', text: '×3', pipeColor: 0xfacc15, veilColor: 'rgba(250, 204, 21, 0.45)', dotColor: 'rgba(254, 240, 138, 0.95)', borderColor: '#facc15', isPositive: true },

      // 3. MINUS ARMY (NEGATIF / MERAH)
      { type: 'army_sub', value: 3, icon: '👤', text: '-3', pipeColor: 0xef4444, veilColor: 'rgba(239, 68, 68, 0.45)', dotColor: 'rgba(254, 202, 202, 0.95)', borderColor: '#ef4444', isPositive: false },
      { type: 'army_sub', value: 5, icon: '👤', text: '-5', pipeColor: 0xdc2626, veilColor: 'rgba(220, 38, 38, 0.45)', dotColor: 'rgba(254, 202, 202, 0.95)', borderColor: '#dc2626', isPositive: false },
      { type: 'army_sub', value: 8, icon: '👤', text: '-8', pipeColor: 0xb91c1c, veilColor: 'rgba(185, 28, 28, 0.45)', dotColor: 'rgba(254, 202, 202, 0.95)', borderColor: '#b91c1c', isPositive: false },

      // 4. TAMBAH EXP (UNGU / EMAS)
      { type: 'exp_add', value: 50, icon: '⭐', text: '+50 EXP', pipeColor: 0xa855f7, veilColor: 'rgba(168, 85, 247, 0.45)', dotColor: 'rgba(243, 232, 255, 0.95)', borderColor: '#a855f7', isPositive: true },
      { type: 'exp_add', value: 100, icon: '⭐', text: '+100 EXP', pipeColor: 0x8b5cf6, veilColor: 'rgba(139, 92, 246, 0.45)', dotColor: 'rgba(237, 233, 254, 0.95)', borderColor: '#8b5cf6', isPositive: true },

      // 5. MINUS EXP (MERAH MAWAR)
      { type: 'exp_sub', value: 30, icon: '🔻', text: '-30 EXP', pipeColor: 0xf43f5e, veilColor: 'rgba(244, 63, 94, 0.45)', dotColor: 'rgba(255, 228, 230, 0.95)', borderColor: '#f43f5e', isPositive: false },

      // 6. ELEMEN
      { type: 'water_add', value: 25, icon: '💧', text: '+25', pipeColor: 0x38bdf8, veilColor: 'rgba(56, 189, 248, 0.45)', dotColor: 'rgba(224, 242, 254, 0.95)', borderColor: '#38bdf8', isPositive: true },
      { type: 'transform_electro', value: '⚡ LISTRIK', icon: '⇄ ⚡', text: 'UBAH', pipeColor: 0xfacc15, veilColor: 'rgba(250, 204, 21, 0.45)', dotColor: 'rgba(254, 240, 138, 0.95)', borderColor: '#facc15', isPositive: true },
      { type: 'transform_fire', value: '🔥 API', icon: '⇄ 🔥', text: 'UBAH', pipeColor: 0xf97316, veilColor: 'rgba(249, 115, 22, 0.45)', dotColor: 'rgba(254, 215, 170, 0.95)', borderColor: '#f97316', isPositive: true }
    ];

    let candidates = POOL;
    if (forcePositive === true) {
      candidates = POOL.filter((c) => c.isPositive);
    } else if (forcePositive === false) {
      candidates = POOL.filter((c) => !c.isPositive);
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    // Salin objek agar tidak saling mempengaruhi
    return Object.assign({}, picked);
  }

  // -------------------------------------------------------------
  // PEMBUATAN 3D ARCH GATE & BADGE
  // -------------------------------------------------------------
  createBadgeTexture(iconText, mainText, borderColor, bgColor = '#091124') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    const r = 52;
    const x = 14;
    const y = 14;
    const w = 512 - 28;
    const h = 180 - 28;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();

    ctx.lineWidth = 14;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 66px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 26;

    ctx.fillText(`${iconText} ${mainText}`, 256, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  createVeilTexture(themeColor, dotColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 0.70)');
    grad.addColorStop(0.15, themeColor);
    grad.addColorStop(0.80, themeColor);
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.20)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 40; i++) {
      const px = Math.random() * 256;
      const py = Math.random() * 256;
      const pr = Math.random() * 6 + 2.5;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  createSingleGate(config, localX) {
    const gateGroup = new THREE.Group();

    const archRadius = 0.205;
    const legHeight = 0.24;
    const pipeRadius = 0.034;

    const pipeMat = new THREE.MeshStandardMaterial({
      color: config.pipeColor,
      roughness: 0.25,
      metalness: 0.20,
      emissive: config.pipeColor,
      emissiveIntensity: 0.50
    });

    // 1. Tiang Kiri & Kanan
    const legGeo = new THREE.CylinderGeometry(pipeRadius, pipeRadius, legHeight, 20);
    const leftLeg = new THREE.Mesh(legGeo, pipeMat);
    leftLeg.position.set(-archRadius, legHeight / 2, 0);
    gateGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pipeMat);
    rightLeg.position.set(archRadius, legHeight / 2, 0);
    gateGroup.add(rightLeg);

    // 2. Lengkungan Torus
    const torusGeo = new THREE.TorusGeometry(archRadius, pipeRadius, 16, 32, Math.PI);
    const topArch = new THREE.Mesh(torusGeo, pipeMat);
    topArch.position.set(0, legHeight, 0);
    gateGroup.add(topArch);

    // 3. Kaki Tumpuan Padat
    const footMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.60 });
    const footGeo = new THREE.CylinderGeometry(0.048, 0.055, 0.042, 20);
    const leftFoot = new THREE.Mesh(footGeo, footMat);
    leftFoot.position.set(-archRadius, 0.021, 0);
    gateGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, footMat);
    rightFoot.position.set(archRadius, 0.021, 0);
    gateGroup.add(rightFoot);

    // 4. Klem Putih 3 Segmen
    const claspMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.20, metalness: 0.15 });
    [-0.035, 0.0, 0.035].forEach((offsetZ) => {
      const claspGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.028, 20);
      const clasp = new THREE.Mesh(claspGeo, claspMat);
      clasp.rotation.z = Math.PI / 2;
      clasp.position.set(offsetZ, legHeight + archRadius, 0);
      gateGroup.add(clasp);
    });

    // 5. Selaput Energi Transparan
    const veilTex = this.createVeilTexture(config.veilColor, config.dotColor);
    const veilMat = new THREE.MeshBasicMaterial({
      map: veilTex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    const totalHeight = legHeight + archRadius;
    const veilGeo = new THREE.PlaneGeometry(archRadius * 2, totalHeight);
    const veil = new THREE.Mesh(veilGeo, veilMat);
    veil.position.set(0, totalHeight / 2, 0);
    gateGroup.add(veil);

    // 6. Badge Header Kapsul
    const badgeTex = this.createBadgeTexture(config.icon, config.text, config.borderColor);
    const badgeMat = new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: true });
    const badgeSprite = new THREE.Sprite(badgeMat);
    badgeSprite.scale.set(0.48, 0.17, 1.0);
    badgeSprite.position.set(0, totalHeight + 0.14, 0);
    gateGroup.add(badgeSprite);

    gateGroup.position.x = localX;

    return {
      group: gateGroup,
      veil: veil,
      badgeSprite: badgeSprite,
      config: config,
      localX: localX // Local X > 0 = Kiri, Local X < 0 = Kanan, 0 = Tengah
    };
  }

  // -------------------------------------------------------------
  // SPONSOR & TATA LETAK GERBANG ACAK (TIDAK SELALU SEBELAH-SEBELAHAN)
  // -------------------------------------------------------------
  createStation(thetaAngle) {
    const stationWrapper = new THREE.Group();

    // Posisi pada keliling silinder
    const posX = this.cylinderRadius * Math.cos(thetaAngle);
    const posZ = this.cylinderRadius * Math.sin(thetaAngle);

    const xAxis = new THREE.Vector3(0, -1, 0);
    const yAxis = new THREE.Vector3(Math.cos(thetaAngle), 0, Math.sin(thetaAngle));
    const zAxis = new THREE.Vector3(-Math.sin(thetaAngle), 0, Math.cos(thetaAngle));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    stationWrapper.setRotationFromMatrix(basisMat);
    stationWrapper.position.set(posX, 0, posZ);

    // Tentukan pola tata letak acak (Hanya 2 Jalur: Kiri atau Kanan, Tidak Ada Jalur Tengah):
    // 0: Hanya Jalur Kiri (Single Left)
    // 1: Hanya Jalur Kanan (Single Right)
    // 2: Sepasang Pilihan Kiri & Kanan (Choice Pair)
    const patternRand = Math.random();
    const gates = [];

    if (patternRand < 0.30) {
      // 1 Gerbang Jalur Kiri Saja
      const cfg = this.getRandomGateConfig();
      const g = this.createSingleGate(cfg, 0.21);
      stationWrapper.add(g.group);
      gates.push(g);
    } else if (patternRand < 0.60) {
      // 1 Gerbang Jalur Kanan Saja
      const cfg = this.getRandomGateConfig();
      const g = this.createSingleGate(cfg, -0.21);
      stationWrapper.add(g.group);
      gates.push(g);
    } else {
      // 2 Gerbang Sepasang (Pilihan Kiri vs Kanan)
      // Dibuat pilihan menarik: misal satu positif dan satu negatif, atau add vs multiply
      const isDilemma = Math.random() < 0.5;
      let leftCfg, rightCfg;

      if (isDilemma) {
        // Satu positif, satu negatif (Pemain harus memilih dengan lincah!)
        if (Math.random() < 0.5) {
          leftCfg = this.getRandomGateConfig(true);
          rightCfg = this.getRandomGateConfig(false);
        } else {
          leftCfg = this.getRandomGateConfig(false);
          rightCfg = this.getRandomGateConfig(true);
        }
      } else {
        // Dua-duanya positif tapi berbeda jenis (misal Army vs EXP)
        leftCfg = this.getRandomGateConfig(true);
        rightCfg = this.getRandomGateConfig(true);
      }

      const leftGate = this.createSingleGate(leftCfg, 0.21);
      const rightGate = this.createSingleGate(rightCfg, -0.21);
      stationWrapper.add(leftGate.group);
      stationWrapper.add(rightGate.group);
      gates.push(leftGate, rightGate);
    }

    this.mainMesh.add(stationWrapper);

    return {
      wrapper: stationWrapper,
      theta: thetaAngle,
      gates: gates,
      isPassed: false,
      rise: 1.0
    };
  }

  initStations() {
    const playerTheta = Math.asin(0.15 / this.cylinderRadius); // ~0.0577 rad

    // Buat 3 stasiun tersebar merata di depan pemain
    // Stasiun 1: Dekat di depan (~45 derajat)
    // Stasiun 2: Jarak menengah (~95 derajat)
    // Stasiun 3: Di horizon kejauhan (~145 derajat)
    const s1 = this.createStation(playerTheta + 0.80);
    const s2 = this.createStation(playerTheta + 1.70);
    const s3 = this.createStation(playerTheta + 2.60);

    this.gateStations.push(s1, s2, s3);
  }

  // -------------------------------------------------------------
  // FLOATING TEXT POPUP & BURST PARTICLES
  // -------------------------------------------------------------
  createFloatingPopup(text, colorHex, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 130;
    const ctx = canvas.getContext('2d');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 54px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 20;
    ctx.fillText(text, 220, 65);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.72, 0.23, 1);
    sprite.position.copy(position);
    sprite.position.x += 0.38;

    this.scene.add(sprite);

    this.popups.push({
      sprite: sprite,
      life: 0.0,
      maxLife: 1.0,
      baseX: sprite.position.x
    });
  }

  createPassBurst(position, colorHex) {
    const count = 30;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = position.x + 0.15 + (Math.random() - 0.5) * 0.10;
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.15;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.15;

      velocities.push({
        x: 0.50 + Math.random() * 0.60,
        y: (Math.random() - 0.5) * 0.70,
        z: (Math.random() - 0.5) * 0.70
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.042,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.burstParticles.push({
      points: pSystem,
      velocities: velocities,
      life: 0.0,
      maxLife: 0.65
    });
  }

  // -------------------------------------------------------------
  // EKSEKUSI DAMPAK GERBANG (REWARD & PENALTY)
  // -------------------------------------------------------------
  applyGateEffect(config, hitPos) {
    let soundType = 'positive';

    switch (config.type) {
      case 'army_add':
        this.armyCount += config.value;
        this.createFloatingPopup(`+${config.value} 👤 PASUKAN!`, config.borderColor, hitPos);
        this.createPassBurst(hitPos, config.pipeColor);
        soundType = 'positive';
        break;

      case 'army_multiply':
        this.armyCount *= config.value;
        this.createFloatingPopup(`×${config.value} 👥 PENGGANDAAN!`, config.borderColor, hitPos);
        this.createPassBurst(hitPos, config.pipeColor);
        soundType = 'positive';
        break;

      case 'army_sub':
        this.armyCount = Math.max(1, this.armyCount - config.value);
        this.createFloatingPopup(`-${config.value} 👤 PASUKAN!`, config.borderColor, hitPos);
        this.createPassBurst(hitPos, config.pipeColor);
        soundType = 'negative';
        break;

      case 'exp_add':
        this.exp += config.value;
        this.createFloatingPopup(`+${config.value} ⭐ EXP!`, config.borderColor, hitPos);
        this.createPassBurst(hitPos, config.pipeColor);
        soundType = 'positive';

        // Cek Level Up!
        if (this.exp >= this.nextLevelExp) {
          this.level++;
          this.exp -= this.nextLevelExp;
          this.nextLevelExp = this.level * 100;
          this.createFloatingPopup(`🎉 LEVEL UP! (Lv. ${this.level})`, '#facc15', {
            x: hitPos.x + 0.25,
            y: hitPos.y,
            z: hitPos.z
          });
          soundType = 'levelup';
        }
        break;

      case 'exp_sub':
        this.exp = Math.max(0, this.exp - config.value);
        this.createFloatingPopup(`-${config.value} ⭐ EXP!`, config.borderColor, hitPos);
        this.createPassBurst(hitPos, config.pipeColor);
        soundType = 'negative';
        break;

      case 'water_add':
        this.waterScore += config.value;
        this.createFloatingPopup(`+${config.value} 💧 AIR!`, config.borderColor, hitPos);
        this.createPassBurst(hitPos, config.pipeColor);
        soundType = 'positive';
        break;

      case 'transform_electro':
        this.activeElement = '⚡ LISTRIK';
        this.createFloatingPopup('⚡ ELEMEN LISTRIK!', '#facc15', hitPos);
        this.createPassBurst(hitPos, 0xfacc15);
        if (this.onElementChange) this.onElementChange('electro');
        soundType = 'positive';
        break;

      case 'transform_fire':
        this.activeElement = '🔥 API';
        this.createFloatingPopup('🔥 ELEMEN API!', '#f97316', hitPos);
        this.createPassBurst(hitPos, 0xf97316);
        if (this.onElementChange) this.onElementChange('fire');
        soundType = 'positive';
        break;
    }

    this.playSound(soundType);
    this.updateHud();
    this.drawHeadBadge(true);
    this.syncArmyClones();
  }

  // -------------------------------------------------------------
  // UPDATE LOOP FRAME (ANIMASI, COLLISION, EMERGE, DESPAWN)
  // -------------------------------------------------------------
  update(delta, avatarLaneY, isAnimating) {
    const playerTheta = Math.asin(0.15 / this.cylinderRadius); // ~0.0577 rad

    // Animasi bounce badge kepala
    if (this.armyHeadBadge && this.headBadgeScale > 1.0) {
      this.headBadgeScale = THREE.MathUtils.lerp(this.headBadgeScale, 1.0, delta * 8.0);
      this.armyHeadBadge.scale.set(0.18 * this.headBadgeScale, 0.08 * this.headBadgeScale, 1.0);
    }

    // Update Animasi Lari Pasukan Army (Mixers)
    if (isAnimating) {
      for (let i = 0; i < this.armyMixers.length; i++) {
        this.armyMixers[i].update(delta);
      }
    }

    // 1. Update Semua Stasiun Gerbang
    this.gateStations.forEach((st) => {
      let angleDiff = (st.theta - this.mainMesh.rotation.y - playerTheta) % (Math.PI * 2);
      if (angleDiff < 0) angleDiff += Math.PI * 2;

      // A. MUNCUL / KELUAR SEBELUM DILEWATI:
      if (!st.isPassed) {
        if (angleDiff < 1.65) {
          st.wrapper.visible = true;
          st.rise = THREE.MathUtils.lerp(st.rise, 1.0, delta * 5.5);
        } else {
          st.rise = 0.0;
        }

        const curY = (st.rise - 1.0) * 0.65;
        st.gates.forEach((g) => {
          g.group.position.y = curY;
          if (g.veil) {
            const pulse = 0.55 + Math.sin(Date.now() * 0.006) * 0.14;
            g.veil.material.opacity = pulse;
          }
        });
      }

      // B. COLLISION & TERHAPUS SETELAH DILEWATI:
      const isCrossing = (angleDiff <= 0.038 || angleDiff >= Math.PI * 2 - 0.038);
      if (!st.isPassed && isCrossing) {
        st.isPassed = true;

        // Cek gerbang mana yang dilewati pemain berdasarkan avatarLaneY:
        // Local X di wrapper gerbang:
        // Local X = +0.21 adalah Jalur Kiri (avatarLaneY < -0.08)
        // Local X = -0.21 adalah Jalur Kanan (avatarLaneY > 0.08)
        // Local X = 0.0 adalah Jalur Tengah (|avatarLaneY| <= 0.15)
        let hitGate = null;
        let minLaneDist = 999;

        st.gates.forEach((g) => {
          // Konversi local X ke lane Y dunia: local X > 0 -> lane Y < 0
          const gateLaneY = -g.localX;
          const dist = Math.abs(avatarLaneY - gateLaneY);
          if (dist < 0.22 && dist < minLaneDist) {
            minLaneDist = dist;
            hitGate = g;
          }
        });

        // Posisi dunia kontak tabrakan
        const surfaceX = Math.sqrt(this.cylinderRadius * this.cylinderRadius - 0.15 * 0.15);
        const hitPos = new THREE.Vector3(surfaceX, avatarLaneY, 0.15);

        if (hitGate) {
          this.applyGateEffect(hitGate.config, hitPos);
        }

        // DESPAWN / TERHAPUS LANGSUNG SETELAH DILEWATI
        st.wrapper.visible = false;
        st.rise = 0.0;
        st.gates.forEach((g) => (g.group.position.y = -0.70));
      }

      // C. RECYCLE / SPAWN KEMBALI DI KEJAUHAN DENGAN VARIASI BARU:
      if (st.isPassed && angleDiff > Math.PI * 0.50 && angleDiff < Math.PI * 1.80) {
        // Hapus gerbang lama dari wrapper
        while (st.wrapper.children.length > 0) {
          st.wrapper.remove(st.wrapper.children[0]);
        }

        st.isPassed = false;
        // Majukan sudut theta gerbang ke depan di horizon (~2.5 rad / 143 derajat di depan)
        st.theta = (this.mainMesh.rotation.y + playerTheta + 2.50) % (Math.PI * 2);

        // Update posisi & rotasi wrapper
        const posX = this.cylinderRadius * Math.cos(st.theta);
        const posZ = this.cylinderRadius * Math.sin(st.theta);

        const xAxis = new THREE.Vector3(0, -1, 0);
        const yAxis = new THREE.Vector3(Math.cos(st.theta), 0, Math.sin(st.theta));
        const zAxis = new THREE.Vector3(-Math.sin(st.theta), 0, Math.cos(st.theta));
        const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

        st.wrapper.setRotationFromMatrix(basisMat);
        st.wrapper.position.set(posX, 0, posZ);

        // Buat formasi gerbang baru secara acak (Hanya 2 Jalur: Kiri atau Kanan, Tidak Ada Tengah)
        const patternRand = Math.random();
        st.gates = [];

        if (patternRand < 0.30) {
          const cfg = this.getRandomGateConfig();
          const g = this.createSingleGate(cfg, 0.21);
          st.wrapper.add(g.group);
          st.gates.push(g);
        } else if (patternRand < 0.60) {
          const cfg = this.getRandomGateConfig();
          const g = this.createSingleGate(cfg, -0.21);
          st.wrapper.add(g.group);
          st.gates.push(g);
        } else {
          // Pilihan sepasang Kiri & Kanan
          const isDilemma = Math.random() < 0.55;
          let leftCfg, rightCfg;
          if (isDilemma) {
            if (Math.random() < 0.5) {
              leftCfg = this.getRandomGateConfig(true);
              rightCfg = this.getRandomGateConfig(false);
            } else {
              leftCfg = this.getRandomGateConfig(false);
              rightCfg = this.getRandomGateConfig(true);
            }
          } else {
            leftCfg = this.getRandomGateConfig(true);
            rightCfg = this.getRandomGateConfig(true);
          }

          const leftGate = this.createSingleGate(leftCfg, 0.21);
          const rightGate = this.createSingleGate(rightCfg, -0.21);
          st.wrapper.add(leftGate.group);
          st.wrapper.add(rightGate.group);
          st.gates.push(leftGate, rightGate);
        }

        st.rise = 0.0;
        st.gates.forEach((g) => (g.group.position.y = -0.70));
        st.wrapper.visible = true;
      }
    });

    // 2. Update Floating Text Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += delta;
      p.sprite.position.x = p.baseX + p.life * 0.42;
      p.sprite.material.opacity = Math.max(0, 1.0 - (p.life / p.maxLife));

      if (p.life >= p.maxLife) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.popups.splice(i, 1);
      }
    }

    // 3. Update Burst Particles
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const b = this.burstParticles[i];
      b.life += delta;
      const pos = b.points.geometry.attributes.position.array;
      for (let j = 0; j < b.velocities.length; j++) {
        pos[j * 3 + 0] += b.velocities[j].x * delta;
        pos[j * 3 + 1] += b.velocities[j].y * delta;
        pos[j * 3 + 2] += b.velocities[j].z * delta;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = Math.max(0, 1.0 - (b.life / b.maxLife));

      if (b.life >= b.maxLife) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.burstParticles.splice(i, 1);
      }
    }
  }
}
