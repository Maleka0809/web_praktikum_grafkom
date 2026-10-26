/**
 * ETS Grafika Komputer - Sistem Final Boss Event (1 Menit Lari & Evaluasi EXP)
 * Mendukung 3 Arena:
 * 1. Kota Metropolitan ('city'):
 *    - flexmusc_sampah.glb (Pamer Otot / Intimidasi)
 *    - swipping_sampah.glb (Serangan Cakar Sampah)
 * 2. Hutan Malam Kebakaran ('forest'):
 *    - idle_lava.glb (Idle Golem Lahar Api)
 *    - swipping_lava.glb (Serangan Hentakan Lahar)
 * 3. Kota Futuristik Malam ('cyber' / 'robot'):
 *    - idle_robot.glb (Idle Mecha Robot)
 *    - attack_robot.glb (Serangan Senjata / Pukulan Mecha)
 *    - dying_robot.glb (Animasi Roboh Mati saat Dikalahkan)
 *
 * Mekanisme:
 * - Waktu lari tepat 1 menit (60 detik)
 * - Tepat 60 detik: "Udahan Larinya" -> Putaran jalan & animasi lari berhenti
 * - Final Boss muncul di depan jalan
 * - Evaluasi EXP:
 *   - Jika EXP >= Target (300 EXP): MENANG! Boss dikalahkan & cutscene pemulihan lingkungan aktif.
 *     * Kota 2: Mati lampu jadi nyala (cyberpunk power grid pulih)
 *     * Hutan: Kebakaran hutan padam (hutan kembali hijau asri & sejuk)
 *     * Kota: Banjir surut menyusut ke drainase kota
 *   - Jika EXP < Target (300 EXP): KALAH! Boss menyerang & game over.
 * - Tombol "Main Lagi (Restart)" & "Pilih Lingkungan Lain".
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class MonsterManager {
  constructor(scene, mainMesh, cylinderRadius, camera, gateManager = null, arenaType = 'city', onRaceEnd = null, onRestart = null, onVictoryCutscene = null) {
    this.scene = scene;
    this.mainMesh = mainMesh;
    this.cylinderRadius = cylinderRadius;
    this.camera = camera;
    this.gateManager = gateManager;
    this.arenaType = arenaType; // 'city' | 'forest' | 'cyber'
    this.onRaceEnd = onRaceEnd;
    this.onRestart = onRestart;
    this.onVictoryCutscene = onVictoryCutscene;

    // Timer & Target State
    this.runTime = 0.0;
    this.targetSpawnTime = 60.0; // 60 detik (1 menit)
    this.targetExp = 300; // Syarat minimal EXP untuk mengalahkan Boss
    this.isSpawned = false;
    this.isDefeated = false;
    this.warningActive = false;
    this.isBattleFinished = false;

    // Konfigurasi Tema Arena
    if (this.arenaType === 'forest') {
      this.bossName = '🌋 FINAL BOSS: MONSTER LAVA HUTAN';
      this.bossSub = 'Kalahkan Monster Lava dengan Mengumpulkan Min. 300 EXP!';
      this.modelPath1 = './assets/idle_lava.glb';
      this.modelPath2 = './assets/swipping_lava.glb';
      this.modelPathDying = null;
      this.modelScale = 0.35;
      this.lightColor = 0xff6600;
    } else if (this.arenaType === 'cyber' || this.arenaType === 'robot') {
      this.bossName = '🤖 FINAL BOSS: CYBER MECHA ROBOT';
      this.bossSub = 'Kalahkan Mecha Robot dengan Mengumpulkan Min. 300 EXP!';
      this.modelPath1 = './assets/idle_robot.glb';
      this.modelPath2 = './assets/attack_robot.glb';
      this.modelPathDying = './assets/dying_robot.glb';
      this.modelScale = 5.8;
      this.lightColor = 0xa855f7;
    } else {
      this.bossName = '👾 FINAL BOSS: MONSTER SAMPAH KOTA';
      this.bossSub = 'Kalahkan Monster Sampah dengan Mengumpulkan Min. 300 EXP!';
      this.modelPath1 = './assets/flexmusc_sampah.glb';
      this.modelPath2 = './assets/swipping_sampah.glb';
      this.modelPathDying = null;
      this.modelScale = 0.46;
      this.lightColor = 0xffedd5;
    }

    // Boss State
    this.maxHp = 5000;
    this.hp = 5000;
    this.bossTheta = 0.0;
    this.currentDistance = 0.44; // Radian di depan pelari
    this.targetCombatDistance = 0.40; // Jarak arena tempur di depan kamera pelari
    this.phaseTimer = 0.0;
    this.currentPhase = 'model1'; // 'model1' | 'model2' | 'finished'

    // 3D Objects & Animations
    this.bossWrapper = new THREE.Group();
    this.scene.add(this.bossWrapper);
    this.bossWrapper.visible = false;

    this.firstModel = null;
    this.firstMixer = null;
    this.firstAction = null;

    this.secondModel = null;
    this.secondMixer = null;
    this.secondAction = null;

    this.dyingModel = null;
    this.dyingMixer = null;
    this.dyingAction = null;

    // Projectile & Combat Particles
    this.projectiles = [];
    this.stompParticles = [];
    this.shakeIntensity = 0.0;

    // Audio
    this.initAudio();

    // DOM HUD & Result Modal
    this.initHud();
    this.initResultModal();

    // Load Model GLB
    this.loadMonsterModels();
  }

  // -------------------------------------------------------------
  // AUDIO SYNTHESIS UNTUK BOSS & RESULT
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
      osc.type = 'sawtooth';
      const startFreq = (this.arenaType === 'forest') ? 80 : (this.arenaType === 'cyber' || this.arenaType === 'robot') ? 140 : 95;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.95);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.start(now);
      osc.stop(now + 1.25);
    } else if (type === 'siren') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(700, now + 0.35);
      osc.frequency.linearRampToValueAtTime(440, now + 0.70);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.start(now);
      osc.stop(now + 0.76);
    } else if (type === 'hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'victory') {
      // Fanfare Megah Kemenangan
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.14); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.28); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.42); // C6
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      osc.start(now);
      osc.stop(now + 1.35);
    } else if (type === 'defeat') {
      // Suara Gong Kekalahan
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.8);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.start(now);
      osc.stop(now + 1.15);
    }
  }

  // -------------------------------------------------------------
  // HUD TIMER & BOSS HEALTH BAR
  // -------------------------------------------------------------
  initHud() {
    let hudOverlay = document.querySelector('.hud-overlay');
    if (hudOverlay && !document.getElementById('bossTimerHud')) {
      const timerItem = document.createElement('div');
      timerItem.id = 'bossTimerHud';
      timerItem.className = 'hud-item';
      timerItem.style.cssText = 'background: rgba(15, 23, 42, 0.90); border: 1.5px solid #f59e0b; border-radius: 8px; padding: 5px 12px; font-weight: 600; display: flex; gap: 8px; align-items: center;';
      timerItem.innerHTML = `⏱️ LARI: <span id="runTimerText" style="color:#facc15; font-weight:800;">00:00</span> <span style="color:#64748b;">|</span> <span id="monsterCountdownBadge" style="color:#38bdf8;">Syarat: 300 EXP</span>`;
      hudOverlay.appendChild(timerItem);
    }

    if (!document.getElementById('bossHpContainer')) {
      const hpBox = document.createElement('div');
      hpBox.id = 'bossHpContainer';
      hpBox.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 480px;
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
          <span style="color: #f87171;">${this.bossName}</span>
          <span id="bossHpText" style="color: #fef08a;">5000 / 5000 HP</span>
        </div>
        <div style="width: 100%; height: 16px; background: #334155; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);">
          <div id="bossHpBarFill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b); border-radius: 8px; transition: width 0.15s ease-out;"></div>
        </div>
        <div id="bossSubtitle" style="font-size: 11px; color: #94a3b8;">${this.bossSub}</div>
      `;
      const canvasWrapper = document.querySelector('.canvas-wrapper') || document.body;
      canvasWrapper.appendChild(hpBox);
    }
  }

  // -------------------------------------------------------------
  // MODAL HASIL AKHIR (MENANG / KALAH)
  // -------------------------------------------------------------
  initResultModal() {
    if (document.getElementById('finalResultModal')) return;

    const modal = document.createElement('div');
    modal.id = 'finalResultModal';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(10, 15, 29, 0.88);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div id="resultCard" style="
        background: rgba(15, 23, 42, 0.98);
        border-radius: 20px;
        padding: 30px 36px;
        max-width: 520px;
        width: 100%;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 18px;
        box-shadow: 0 0 50px rgba(0,0,0,0.8);
      ">
        <div id="resultIcon" style="font-size: 58px; line-height: 1;">🏆</div>
        <div>
          <h2 id="resultTitle" style="font-size: 26px; font-weight: 800; margin: 0 0 8px; color: #facc15;">KEMENANGAN TELAH DIRAIH!</h2>
          <p id="resultDesc" style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;">Final Boss Berhasil Dikalahkan!</p>
        </div>

        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">⭐ EXP Kamu</div>
            <div id="resultExpText" style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-top: 4px;">0 / 300</div>
          </div>
          <div style="width: 1px; background: rgba(255,255,255,0.1);"></div>
          <div>
            <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">👥 Pasukan</div>
            <div id="resultArmyText" style="font-size: 20px; font-weight: 800; color: #facc15; margin-top: 4px;">1</div>
          </div>
          <div style="width: 1px; background: rgba(255,255,255,0.1);"></div>
          <div>
            <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">⏱️ Waktu</div>
            <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 4px;">01:00</div>
          </div>
        </div>

        <div id="resultFeedback" style="font-size: 13px; color: #cbd5e1; line-height: 1.5;"></div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 6px; flex-wrap: wrap;">
          <button id="btnRestartGame" style="
            background: linear-gradient(135deg, #0284c7, #38bdf8);
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
          ">🔄 Main Lagi (Restart)</button>

          <a href="./index.html" style="
            background: rgba(30, 41, 59, 0.9);
            color: #cbd5e1;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
          ">🏛️ Pilih Lingkungan Lain</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnRestartGame').addEventListener('click', () => {
      this.restartGame();
    });
  }

  showResultModal(isWin, currentExp, armyCount) {
    const modal = document.getElementById('finalResultModal');
    const card = document.getElementById('resultCard');
    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const desc = document.getElementById('resultDesc');
    const expText = document.getElementById('resultExpText');
    const armyText = document.getElementById('resultArmyText');
    const feedback = document.getElementById('resultFeedback');

    if (!modal) return;

    expText.innerText = `${currentExp} / ${this.targetExp}`;
    armyText.innerText = `${armyCount}`;

    if (isWin) {
      card.style.border = '2px solid #facc15';
      card.style.boxShadow = '0 0 45px rgba(250, 204, 21, 0.45)';
      icon.innerText = '🏆';
      title.innerText = 'KEMENANGAN TELAH DIRAIH!';
      title.style.color = '#facc15';
      desc.innerText = `${this.bossName.replace(/^[^\w]+/, '')} Berhasil Dikalahkan!`;

      let cutsceneInfo = '';
      if (this.arenaType === 'cyber' || this.arenaType === 'robot') {
        cutsceneInfo = 'Daya kota cyberpunk telah pulih: lampu jalan & gedung menyala terang benderang!';
      } else if (this.arenaType === 'forest') {
        cutsceneInfo = 'Kobaran api kebakaran hutan padam: pepohonan kembali hijau asri & udara sejuk!';
      } else {
        cutsceneInfo = 'Banjir bandang surut menyusut: jalanan kota kembali bersih dan kering!';
      }

      feedback.innerHTML = `Hebat sekali! Pasukanmu berhasil mengumpulkan <b>${currentExp} EXP</b> (melampaui target ${this.targetExp} EXP) dan menumbangkan Final Boss!<br><span style="color:#38bdf8; font-weight:600; display:inline-block; margin-top:6px;">✨ ${cutsceneInfo}</span>`;
    } else {
      card.style.border = '2px solid #ef4444';
      card.style.boxShadow = '0 0 45px rgba(239, 68, 68, 0.50)';
      icon.innerText = '💀';
      title.innerText = 'EXP BELUM CUKUP!';
      title.style.color = '#f87171';
      desc.innerText = `Kamu Terhempas Oleh Serangan ${this.bossName.replace(/^[^\w]+/, '')}!`;
      feedback.innerHTML = `EXP kamu hanya <b>${currentExp} EXP</b> (kurang <b>${this.targetExp - currentExp} EXP</b> lagi untuk menang). Lewati gerbang +EXP dan penggandaan pasukan untuk memperkuat karaktermu!`;
    }

    modal.style.display = 'flex';
  }

  restartGame() {
    const modal = document.getElementById('finalResultModal');
    if (modal) modal.style.display = 'none';

    const hpBox = document.getElementById('bossHpContainer');
    if (hpBox) hpBox.style.display = 'none';

    this.runTime = 0.0;
    this.isSpawned = false;
    this.isDefeated = false;
    this.warningActive = false;
    this.isBattleFinished = false;
    this.bossWrapper.visible = false;
    if (this.firstModel) this.firstModel.position.set(0, 0.015, 0);
    if (this.secondModel) this.secondModel.position.set(0, 0.015, 0);
    if (this.dyingModel) {
      this.dyingModel.position.set(0, 0.015, 0);
      this.dyingModel.visible = false;
    }

    // Reset Gate Manager
    if (this.gateManager) {
      this.gateManager.exp = 0;
      this.gateManager.armyCount = 1;
      this.gateManager.level = 1;
      this.gateManager.updateHud();
      this.gateManager.drawHeadBadge(true);
      this.gateManager.syncArmyClones();
    }

    // Panggil callback restart arena utama
    if (this.onRestart) {
      this.onRestart();
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
      if (!this.isSpawned && !this.isBattleFinished) {
        const remaining = Math.max(0, Math.ceil(this.targetSpawnTime - this.runTime));
        badgeText.innerText = `Boss: ${remaining}s (Syarat: ${this.targetExp} EXP)`;
        if (remaining <= 5) {
          badgeText.style.color = '#ef4444';
          badgeText.style.fontWeight = 'bold';
        } else {
          badgeText.style.color = '#38bdf8';
        }
      } else if (this.isSpawned && !this.isBattleFinished) {
        badgeText.innerText = `🚨 FINAL BOSS!`;
        badgeText.style.color = '#ef4444';
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
  // LOAD ASET GLB MONSTER (IDLE, ATTACK & DYING)
  // -------------------------------------------------------------
  loadMonsterModels() {
    const gltfLoader = new GLTFLoader();

    // 1. Model Pertama (Flex / Idle)
    gltfLoader.load(this.modelPath1, (gltf) => {
      this.firstModel = gltf.scene;
      this.prepareMonsterModel(this.firstModel);
      this.bossWrapper.add(this.firstModel);

      if (gltf.animations && gltf.animations.length > 0) {
        this.firstMixer = new THREE.AnimationMixer(this.firstModel);
        this.firstAction = this.firstMixer.clipAction(gltf.animations[0]);
        this.firstAction.play();
      }
      this.firstModel.visible = true;
    });

    // 2. Model Kedua (Swiping / Attack)
    gltfLoader.load(this.modelPath2, (gltf) => {
      this.secondModel = gltf.scene;
      this.prepareMonsterModel(this.secondModel);
      this.bossWrapper.add(this.secondModel);

      if (gltf.animations && gltf.animations.length > 0) {
        this.secondMixer = new THREE.AnimationMixer(this.secondModel);
        this.secondAction = this.secondMixer.clipAction(gltf.animations[0]);
        this.secondAction.play();
      }
      this.secondModel.visible = false;
    });

    // 3. Model Ketiga (Dying Model - Khusus Robot)
    if (this.modelPathDying) {
      gltfLoader.load(this.modelPathDying, (gltf) => {
        this.dyingModel = gltf.scene;
        this.prepareMonsterModel(this.dyingModel);
        this.bossWrapper.add(this.dyingModel);

        if (gltf.animations && gltf.animations.length > 0) {
          this.dyingMixer = new THREE.AnimationMixer(this.dyingModel);
          this.dyingAction = this.dyingMixer.clipAction(gltf.animations[0]);
          this.dyingAction.setLoop(THREE.LoopOnce);
          this.dyingAction.clampWhenFinished = true;
        }
        this.dyingModel.visible = false;
      });
    }

    // Lampu Khusus Boss (Sorotan Keemasan / Lahar / Neon Robot)
    const bossLight = new THREE.PointLight(this.lightColor, 3.8, 5.0);
    bossLight.position.set(0, 0.75, -0.60);
    this.bossWrapper.add(bossLight);
  }

  prepareMonsterModel(model) {
    const s = this.modelScale;
    model.scale.set(s, s, s);
    // Putar 180 derajat agar menghadap ke arah pelari & kamera
    model.rotation.y = Math.PI;
    model.position.set(0, 0.015, 0);

    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material = node.material.clone();
          if (this.arenaType === 'cyber' || this.arenaType === 'robot') {
            node.material.roughness = 0.35;
            node.material.metalness = 0.70;
            node.material.emissive = new THREE.Color(0xa855f7);
            node.material.emissiveIntensity = 0.40;
          } else if (this.arenaType === 'forest') {
            node.material.roughness = 0.40;
            node.material.metalness = 0.20;
            node.material.emissive = new THREE.Color(0xff4400);
            node.material.emissiveIntensity = 0.35;
          } else {
            node.material.roughness = 0.40;
            node.material.metalness = 0.20;
            if (node.material.color) {
              node.material.emissive = node.material.color.clone();
              node.material.emissiveIntensity = 0.25;
            }
          }
        }
      }
    });
  }

  // Helper untuk pengujian cepat kemenangan Boss & Cutscene
  triggerTestVictory() {
    if (this.gateManager) {
      this.gateManager.exp = Math.max(this.gateManager.exp, 350);
      this.gateManager.armyCount = Math.max(this.gateManager.armyCount, 10);
      this.gateManager.updateHud();
      this.gateManager.drawHeadBadge(true);
      this.gateManager.syncArmyClones();
    }
    this.spawnMonster();
  }

  // -------------------------------------------------------------
  // SPAWN BOSS KETIKA 1 MENIT: "UDAHAN LARINYA" & EVALUASI EXP
  // -------------------------------------------------------------
  spawnMonster() {
    if (this.isSpawned && !this.isDefeated) return;
    this.isSpawned = true;
    this.isDefeated = false;
    this.isBattleFinished = false;

    // "Udahan Larinya" -> Hentikan putaran silinder & lari karakter!
    if (this.onRaceEnd) {
      this.onRaceEnd();
    }

    if (this.firstModel) {
      this.firstModel.position.set(0, 0.015, 0);
      this.firstModel.visible = true;
    }
    if (this.secondModel) {
      this.secondModel.position.set(0, 0.015, 0);
      this.secondModel.visible = false;
    }
    if (this.dyingModel) {
      this.dyingModel.position.set(0, 0.015, 0);
      this.dyingModel.visible = false;
    }

    const army = this.gateManager ? this.gateManager.armyCount : 1;
    const lvl = this.gateManager ? this.gateManager.level : 1;
    this.maxHp = Math.max(5000, army * 75 + lvl * 250);
    this.hp = this.maxHp;

    // Bos hadir di depan pelari (0.44 rad)
    this.currentDistance = 0.44;
    this.phaseTimer = 0.0;
    this.currentPhase = 'model1';

    const playerTheta = Math.asin(0.15 / this.cylinderRadius);
    this.bossTheta = (playerTheta + this.currentDistance) % (Math.PI * 2);

    this.updateBossTransform();
    this.bossWrapper.visible = true;

    // Tampilkan HP Container
    const hpBox = document.getElementById('bossHpContainer');
    if (hpBox) hpBox.style.display = 'flex';

    this.playSfx('siren');
    setTimeout(() => this.playSfx('roar'), 600);

    this.shakeIntensity = 0.065;

    // Eksekusi Konfrontasi Berdasarkan Syarat EXP (Durasi tatap muka epik 4.5 detik):
    setTimeout(() => {
      this.resolveBattleOutcome();
    }, 4500);
  }

  updateBossTransform() {
    const posX = this.cylinderRadius * Math.cos(this.bossTheta);
    const posZ = this.cylinderRadius * Math.sin(this.bossTheta);

    const xAxis = new THREE.Vector3(0, -1, 0);
    const yAxis = new THREE.Vector3(Math.cos(this.bossTheta), 0, Math.sin(this.bossTheta));
    const zAxis = new THREE.Vector3(-Math.sin(this.bossTheta), 0, Math.cos(this.bossTheta));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    this.bossWrapper.setRotationFromMatrix(basisMat);
    this.bossWrapper.position.set(posX, 0.0, posZ);
  }

  // -------------------------------------------------------------
  // RESOLUSI HASIL AKHIR: MENANG ATAU KALAH
  // -------------------------------------------------------------
  resolveBattleOutcome() {
    if (this.isBattleFinished) return;
    this.isBattleFinished = true;

    const currentExp = this.gateManager ? this.gateManager.exp : 0;
    const armyCount = this.gateManager ? this.gateManager.armyCount : 1;
    const isWin = currentExp >= this.targetExp;

    if (isWin) {
      // 🏆 PEMAIN MENANG!
      // Kurangi HP Boss hingga 0
      let drainHp = this.hp;
      const hpInterval = setInterval(() => {
        drainHp -= this.maxHp * 0.12;
        this.hp = Math.max(0, drainHp);
        if (this.hp <= 0) {
          clearInterval(hpInterval);
          this.defeatMonster(currentExp, armyCount);
        }
      }, 50);
    } else {
      // 💀 PEMAIN KALAH!
      // Boss melakukan serangan cakar / laser mematikan
      if (this.firstModel) this.firstModel.visible = false;
      if (this.secondModel) this.secondModel.visible = true;
      if (this.dyingModel) this.dyingModel.visible = false;

      this.playSfx('roar');
      this.playSfx('defeat');
      this.shakeIntensity = 0.09;

      setTimeout(() => {
        const hpBox = document.getElementById('bossHpContainer');
        if (hpBox) hpBox.style.display = 'none';
        this.showResultModal(false, currentExp, armyCount);
      }, 1500);
    }
  }

  // -------------------------------------------------------------
  // PERTARUNGAN: TEMBAKAN ENERGI PASUKAN KE MONSTER
  // -------------------------------------------------------------
  fireArmyProjectiles(avatarLaneY) {
    const surfaceX = Math.sqrt(this.cylinderRadius * this.cylinderRadius - 0.15 * 0.15);
    const startPos = new THREE.Vector3(surfaceX, avatarLaneY, 0.15);

    const bossWorldPos = new THREE.Vector3();
    this.bossWrapper.getWorldPosition(bossWorldPos);

    const pColor = (this.arenaType === 'forest') ? 0xf97316 : (this.arenaType === 'cyber' || this.arenaType === 'robot') ? 0xc084fc : 0x38bdf8;

    const count = 3;
    for (let k = 0; k < count; k++) {
      const geo = new THREE.SphereGeometry(0.045, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: pColor,
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
  // KEMENANGAN: MONSTER DIKALAHKAN & CUTSCENE PEMULIHAN
  // -------------------------------------------------------------
  defeatMonster(currentExp, armyCount) {
    if (this.isDefeated) return;
    this.isDefeated = true;
    this.currentPhase = 'finished';

    this.playSfx('victory');

    const hpBox = document.getElementById('bossHpContainer');
    if (hpBox) hpBox.style.display = 'none';

    const bossWorldPos = new THREE.Vector3();
    this.bossWrapper.getWorldPosition(bossWorldPos);
    this.createVictoryBurst(bossWorldPos);

    // Aktifkan Cutscene Pemulihan Lingkungan Segera!
    if (this.onVictoryCutscene) {
      try {
        this.onVictoryCutscene();
      } catch (err) {
        console.warn('Error during onVictoryCutscene:', err);
      }
    }

    // Jika Arena Robot (Kota 2): Jalankan scene dying robot
    if ((this.arenaType === 'cyber' || this.arenaType === 'robot') && this.dyingModel) {
      if (this.firstModel) this.firstModel.visible = false;
      if (this.secondModel) this.secondModel.visible = false;
      this.dyingModel.visible = true;
      this.dyingModel.position.set(0, 0.015, 0);

      if (this.dyingAction) {
        this.dyingAction.reset();
        this.dyingAction.setLoop(THREE.LoopOnce);
        this.dyingAction.clampWhenFinished = true;
        this.dyingAction.play();
      }

      this.shakeIntensity = 0.075;

      // Beri jeda 2.5 detik agar animasi roboh dying robot selesai dinikmati
      setTimeout(() => {
        this.showResultModal(true, currentExp, armyCount);
      }, 2500);
      return;
    }

    // Untuk Arena Kota & Hutan: Animasi monster tenggelam perlahan ke bawah aspal
    let sinkY = 0.015;
    const sinkInterval = setInterval(() => {
      sinkY -= 0.025;
      if (this.firstModel) this.firstModel.position.y = sinkY;
      if (this.secondModel) this.secondModel.position.y = sinkY;

      if (sinkY < -1.6) {
        clearInterval(sinkInterval);
        this.bossWrapper.visible = false;
        this.isSpawned = false;
        // Tampilkan Modal Kemenangan
        this.showResultModal(true, currentExp, armyCount);
      }
    }, 25);
  }

  createVictoryBurst(pos) {
    const count = 95;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = pos.x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;

      velocities.push({
        x: (Math.random() - 0.5) * 2.2,
        y: 1.0 + Math.random() * 1.8,
        z: (Math.random() - 0.5) * 2.2
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: (this.arenaType === 'cyber' || this.arenaType === 'robot') ? 0x38bdf8 : 0xfacc15,
      size: 0.075,
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
      maxLife: 1.8
    });
  }

  // -------------------------------------------------------------
  // UPDATE LOOP FRAME
  // -------------------------------------------------------------
  update(delta, avatarLaneY, isAnimating) {
    // 1. Jalankan Timer Lari Menuju 60 Detik (1 Menit)
    if (isAnimating && !this.isSpawned && !this.isBattleFinished) {
      this.runTime += delta;

      if (this.runTime >= 55.0 && !this.warningActive) {
        this.warningActive = true;
        this.playSfx('siren');
      }

      // Tepat 60 detik -> Udahan Larinya & Final Boss Datang!
      if (this.runTime >= this.targetSpawnTime) {
        this.spawnMonster();
      }
    }

    this.updateHud(delta);

    // 2. Update Animasi Model Mixer
    if (this.firstMixer && this.firstModel && this.firstModel.visible) {
      this.firstMixer.update(delta * 1.2);
    }
    if (this.secondMixer && this.secondModel && this.secondModel.visible) {
      this.secondMixer.update(delta * 1.2);
    }
    if (this.dyingMixer && this.dyingModel && this.dyingModel.visible) {
      this.dyingMixer.update(delta * 1.0);
    }

    // 3. Logika Pergerakan & Fase Aksi Boss Saat Aktif
    if (this.isSpawned && !this.isDefeated) {
      const playerTheta = Math.asin(0.15 / this.cylinderRadius);

      this.currentDistance = THREE.MathUtils.lerp(
        this.currentDistance,
        this.targetCombatDistance,
        delta * 1.5
      );

      this.bossTheta = (playerTheta + this.currentDistance) % (Math.PI * 2);
      this.updateBossTransform();

      if (!this.isBattleFinished) {
        this.phaseTimer += delta;
        if (this.phaseTimer > 2.2) {
          this.phaseTimer = 0.0;
          if (this.currentPhase === 'model1') {
            this.currentPhase = 'model2';
            if (this.firstModel) this.firstModel.visible = false;
            if (this.secondModel) this.secondModel.visible = true;
            this.shakeIntensity = 0.045;
          } else {
            this.currentPhase = 'model1';
            if (this.firstModel) this.firstModel.visible = true;
            if (this.secondModel) this.secondModel.visible = false;
            this.playSfx('roar');
          }
        }

        // Tembakan orbs pasukan ke arah tubuh boss
        if (Math.random() < 0.40) {
          this.fireArmyProjectiles(avatarLaneY);
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
