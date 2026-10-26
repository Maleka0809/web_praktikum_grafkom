/**
 * ETS Grafika Komputer - Sistem Gerbang Runner (Gate Multiplier & Element Modifier)
 * Berisi pembuatan 3D Arch Gates, selaput energi, badge teks, animasi spawn/despawn, dan collision detection.
 */

import * as THREE from 'three';

export class GateManager {
  constructor(scene, mainMesh, cylinderRadius) {
    this.scene = scene;
    this.mainMesh = mainMesh;
    this.cylinderRadius = cylinderRadius;
    this.gatePairs = [];
    this.popups = [];
    this.burstParticles = [];
    
    // Player state
    this.waterScore = 0;
    this.activeElement = '⚡ LISTRIK';
    this.onScoreUpdate = null;
    this.onElementChange = null;

    // Inisialisasi HUD score bila belum ada
    this.initHud();

    // Buat 2 pasang gerbang (Foreground & Background di kejauhan)
    this.createGatePairs();
  }

  initHud() {
    let hud = document.getElementById('runnerScoreHud');
    if (!hud) {
      const hudOverlay = document.querySelector('.hud-overlay');
      if (hudOverlay) {
        hud = document.createElement('div');
        hud.id = 'runnerScoreHud';
        hud.className = 'hud-item';
        hud.style.cssText = 'background: rgba(15, 23, 42, 0.92); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 5px 14px; font-weight: 600; display: flex; gap: 12px; align-items: center; box-shadow: 0 0 14px rgba(56, 189, 248, 0.40);';
        hud.innerHTML = `<span>💧 AIR: <span id="hudWaterVal" style="color: #38bdf8; font-weight: 800; font-size: 1.1em;">0</span></span> <span style="color:#64748b;">|</span> <span>ELEMEN: <span id="hudElemVal" style="color: #facc15; font-weight: 800; font-size: 1.1em;">⚡ LISTRIK</span></span>`;
        hudOverlay.appendChild(hud);
      }
    }
  }

  updateHud() {
    const wVal = document.getElementById('hudWaterVal');
    const eVal = document.getElementById('hudElemVal');
    if (wVal) wVal.innerText = this.waterScore;
    if (eVal) eVal.innerText = this.activeElement;
  }

  // Membuat Canvas Texture Badge Capsule Teks di atas gerbang
  createBadgeTexture(iconText, mainText, borderColor, bgColor = '#091124') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    // Gambar Capsule Kapsul
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

    // Background Kapsul
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Border Neon Tebal
    ctx.lineWidth = 14;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Highlight Putih Dalam
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // Tulisan Teks & Ikon
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 70px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 26;

    const fullText = `${iconText} ${mainText}`;
    ctx.fillText(fullText, 256, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // Membuat Tekstur Selaput Energi Transparan di dalam Arch (Frosted Hologram Veil)
  createVeilTexture(themeColor, dotColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);

    // Gradien vertikal kabut energi semi-transparan
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 0.70)');
    grad.addColorStop(0.15, themeColor);
    grad.addColorStop(0.80, themeColor);
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.20)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Partikel berkilau acak di dalam tirai portal (seperti tetesan air / percikan petir)
    for (let i = 0; i < 45; i++) {
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

  // Membuat 1 unit Arch Gate (Lengkungan, Kaki, Badge, dan Selaput Energi)
  createSingleGate(config) {
    const gateGroup = new THREE.Group();

    // Proporsi kartun yang gemuk & pas dengan lebar jalur
    const archRadius = 0.205; // Lebar total 0.41m (pas menutup 1 jalur jalan)
    const legHeight = 0.24;
    const pipeRadius = 0.034; // Pipa tebal bulat ala casual runner

    // Material Pipa Rangka Bercahaya
    const pipeMat = new THREE.MeshStandardMaterial({
      color: config.pipeColor,
      roughness: 0.25,
      metalness: 0.20,
      emissive: config.pipeColor,
      emissiveIntensity: 0.50
    });

    // 1. Tiang Kiri & Kanan (Cylinder)
    const legGeo = new THREE.CylinderGeometry(pipeRadius, pipeRadius, legHeight, 20);
    const leftLeg = new THREE.Mesh(legGeo, pipeMat);
    leftLeg.position.set(-archRadius, legHeight / 2, 0);
    gateGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pipeMat);
    rightLeg.position.set(archRadius, legHeight / 2, 0);
    gateGroup.add(rightLeg);

    // 2. Lengkungan Setengah Lingkaran Atas (Torus)
    const torusGeo = new THREE.TorusGeometry(archRadius, pipeRadius, 16, 32, Math.PI);
    const topArch = new THREE.Mesh(torusGeo, pipeMat);
    topArch.position.set(0, legHeight, 0);
    gateGroup.add(topArch);

    // 3. Kaki Tumpuan Padat Bawah (Foot Pedestals)
    const footMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.35,
      metalness: 0.60
    });
    const footGeo = new THREE.CylinderGeometry(0.048, 0.055, 0.042, 20);
    const leftFoot = new THREE.Mesh(footGeo, footMat);
    leftFoot.position.set(-archRadius, 0.021, 0);
    gateGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, footMat);
    rightFoot.position.set(archRadius, 0.021, 0);
    gateGroup.add(rightFoot);

    // 4. Klem Putih 3 Segmen di Puncak Lengkungan
    const claspMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.20,
      metalness: 0.15
    });
    [-0.035, 0.0, 0.035].forEach((offsetZ) => {
      const claspGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.028, 20);
      const clasp = new THREE.Mesh(claspGeo, claspMat);
      clasp.rotation.z = Math.PI / 2;
      clasp.position.set(offsetZ, legHeight + archRadius, 0);
      gateGroup.add(clasp);
    });

    // 5. Selaput Energi Transparan (Veil Curtain)
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

    // 6. Badge Header Kapsul Teks di Atas Gerbang
    const badgeTex = this.createBadgeTexture(config.icon, config.text, config.borderColor);
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex,
      transparent: true,
      depthTest: true
    });
    const badgeSprite = new THREE.Sprite(badgeMat);
    badgeSprite.scale.set(0.48, 0.17, 1.0);
    badgeSprite.position.set(0, totalHeight + 0.14, 0);
    gateGroup.add(badgeSprite);

    return {
      group: gateGroup,
      veil: veil,
      badgeSprite: badgeSprite,
      config: config
    };
  }

  // Membuat 1 pasang gerbang (Kiri & Kanan) yang terpasang pada silinder
  createPair(thetaAngle, configs) {
    const pairWrapper = new THREE.Group();

    // Posisi pada keliling silinder
    const posX = this.cylinderRadius * Math.cos(thetaAngle);
    const posZ = this.cylinderRadius * Math.sin(thetaAngle);

    // Basis rotasi agar gerbang berdiri tegak lurus di permukaan jalan silinder
    const xAxis = new THREE.Vector3(0, -1, 0);
    const yAxis = new THREE.Vector3(Math.cos(thetaAngle), 0, Math.sin(thetaAngle));
    const zAxis = new THREE.Vector3(-Math.sin(thetaAngle), 0, Math.cos(thetaAngle));
    const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    pairWrapper.setRotationFromMatrix(basisMat);
    pairWrapper.position.set(posX, 0, posZ);

    // Gerbang Jalur Kiri (Y cylinder < 0 -> local X > 0)
    // Diletakkan tepat di tengah jalur kiri (X = +0.21)
    const leftGate = this.createSingleGate(configs.left);
    leftGate.group.position.x = 0.21;
    pairWrapper.add(leftGate.group);

    // Gerbang Jalur Kanan (Y cylinder > 0 -> local X < 0)
    // Diletakkan tepat di tengah jalur kanan (X = -0.21)
    const rightGate = this.createSingleGate(configs.right);
    rightGate.group.position.x = -0.21;
    pairWrapper.add(rightGate.group);

    this.mainMesh.add(pairWrapper);

    return {
      wrapper: pairWrapper,
      theta: thetaAngle,
      leftGate: leftGate,
      rightGate: rightGate,
      isPassed: false,
      rise: 1.0
    };
  }

  createGatePairs() {
    const playerTheta = Math.asin(0.15 / this.cylinderRadius); // ~0.0577 rad

    // Pair 1 (Foreground, mendekati pemain):
    // Kiri: 💧 +21 (Air)
    // Kanan: ⇄ ⚡ UBAH (Listrik)
    const pair1Configs = {
      left: {
        icon: '💧',
        text: '+21',
        type: 'water_add',
        value: 21,
        pipeColor: 0x38bdf8,
        veilColor: 'rgba(56, 189, 248, 0.45)',
        dotColor: 'rgba(224, 242, 254, 0.95)',
        borderColor: '#38bdf8'
      },
      right: {
        icon: '⇄ ⚡',
        text: 'UBAH',
        type: 'transform_electro',
        value: '⚡ LISTRIK',
        pipeColor: 0xfacc15,
        veilColor: 'rgba(250, 204, 21, 0.45)',
        dotColor: 'rgba(254, 240, 138, 0.95)',
        borderColor: '#facc15'
      }
    };

    // Pair 2 (Background, di kejauhan):
    // Kiri: 💧 +35
    // Kanan: ⇄ 🔥 UBAH (Api)
    const pair2Configs = {
      left: {
        icon: '💧',
        text: '+35',
        type: 'water_add',
        value: 35,
        pipeColor: 0x38bdf8,
        veilColor: 'rgba(56, 189, 248, 0.45)',
        dotColor: 'rgba(224, 242, 254, 0.95)',
        borderColor: '#38bdf8'
      },
      right: {
        icon: '⇄ 🔥',
        text: 'UBAH',
        type: 'transform_fire',
        value: '🔥 API',
        pipeColor: 0xf97316,
        veilColor: 'rgba(249, 115, 22, 0.45)',
        dotColor: 'rgba(254, 215, 170, 0.95)',
        borderColor: '#f97316'
      }
    };

    // Pair 1: Sekitar 45 derajat di depan pemain
    const p1 = this.createPair(playerTheta + 0.75, pair1Configs);
    // Pair 2: Sekitar 105 derajat di depan pemain (kejauhan)
    const p2 = this.createPair(playerTheta + 1.85, pair2Configs);

    this.gatePairs.push(p1, p2);
  }

  // Floating 3D Text Popup saat pemain melewati gerbang
  createFloatingPopup(text, colorHex, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 56px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 20;
    ctx.fillText(text, 192, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.68, 0.23, 1);
    sprite.position.copy(position);
    sprite.position.x += 0.38; // Melayang di atas kepala karakter (+X adalah ke atas menjauhi jalan)

    this.scene.add(sprite);

    this.popups.push({
      sprite: sprite,
      life: 0.0,
      maxLife: 1.0,
      baseX: sprite.position.x
    });
  }

  // Efek ledakan partikel saat gerbang ditembus
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
        x: 0.50 + Math.random() * 0.60, // Melambung ke atas (+X)
        y: (Math.random() - 0.5) * 0.70, // Menyebar ke samping
        z: (Math.random() - 0.5) * 0.70  // Menyebar ke depan/belakang
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

  // Update di setiap frame animasi (Loop)
  update(delta, avatarLaneY, isAnimating) {
    const playerTheta = Math.asin(0.15 / this.cylinderRadius); // ~0.0577 rad

    // 1. Update Gerbang (Muncul, Lewat, Terhapus, Reposisi)
    this.gatePairs.forEach((pair) => {
      let angleDiff = (pair.theta - this.mainMesh.rotation.y - playerTheta) % (Math.PI * 2);
      if (angleDiff < 0) angleDiff += Math.PI * 2;

      // A. MUNCUL / KELUAR SEBELUM DILEWATI:
      // Gerbang naik mulus dari dalam aspal saat mendekat dalam radius pandang
      if (!pair.isPassed) {
        if (angleDiff < 1.55) {
          pair.wrapper.visible = true;
          // Gerbang naik tegak mulus (rise dari 0 ke 1)
          pair.rise = THREE.MathUtils.lerp(pair.rise, 1.0, delta * 5.5);
        } else {
          // Terlalu jauh di belakang lengkungan silinder
          pair.rise = 0.0;
        }

        // Posisi Y lokal: 0 adalah permukaan aspal, -0.6 adalah terkubur di bawah jalan
        const curY = (pair.rise - 1.0) * 0.60;
        pair.leftGate.group.position.y = curY;
        pair.rightGate.group.position.y = curY;
      }

      // Animasi pendaran tirai energi di dalam gerbang
      if (pair.leftGate.veil && pair.rightGate.veil) {
        const pulse = 0.55 + Math.sin(Date.now() * 0.006) * 0.14;
        pair.leftGate.veil.material.opacity = pulse;
        pair.rightGate.veil.material.opacity = pulse;
      }

      // B. COLLISION & TERHAPUS SETELAH DILEWATI:
      // Saat gerbang mencapai posisi pemain (angleDiff mendekati 0 atau tepat di depan 0.035)
      const isCrossing = (angleDiff <= 0.035 || angleDiff >= Math.PI * 2 - 0.035);
      if (!pair.isPassed && isCrossing) {
        pair.isPassed = true;

        // Tentukan gerbang mana yang dilewati pemain berdasarkan avatarLaneY:
        // avatarLaneY < 0 -> Jalur Kiri (💧 +21)
        // avatarLaneY >= 0 -> Jalur Kanan (⇄ ⚡ UBAH)
        const isLeft = avatarLaneY < 0;
        const chosenGate = isLeft ? pair.leftGate : pair.rightGate;
        const config = chosenGate.config;

        // Posisi dunia karakter
        const surfaceX = Math.sqrt(this.cylinderRadius * this.cylinderRadius - 0.15 * 0.15);
        const hitPos = new THREE.Vector3(surfaceX, avatarLaneY, 0.15);

        // Eksekusi Efek Gerbang:
        if (config.type === 'water_add') {
          this.waterScore += config.value;
          this.createFloatingPopup(`+${config.value} 💧`, '#38bdf8', hitPos);
          this.createPassBurst(hitPos, 0x38bdf8);
        } else if (config.type === 'transform_electro') {
          this.activeElement = '⚡ LISTRIK';
          this.createFloatingPopup('⚡ ELEMEN LISTRIK!', '#facc15', hitPos);
          this.createPassBurst(hitPos, 0xfacc15);
          if (this.onElementChange) this.onElementChange('electro');
        } else if (config.type === 'transform_fire') {
          this.activeElement = '🔥 API';
          this.createFloatingPopup('🔥 ELEMEN API!', '#f97316', hitPos);
          this.createPassBurst(hitPos, 0xf97316);
          if (this.onElementChange) this.onElementChange('fire');
        }

        this.updateHud();

        // ANIMASI TERHAPUS (Despawn):
        // Gerbang langsung terhapus dari pandangan setelah dilewati!
        pair.wrapper.visible = false;
        pair.rise = 0.0;
        pair.leftGate.group.position.y = -0.65;
        pair.rightGate.group.position.y = -0.65;
      }

      // C. RECYCLE / SPAWN KEMBALI DI KEJAUHAN:
      // Setelah gerbang benar-benar lewat di belakang pemain (angleDiff di belakang pemain)
      if (pair.isPassed && angleDiff > Math.PI * 0.50 && angleDiff < Math.PI * 1.80) {
        pair.isPassed = false;
        // Majukan sudut theta gerbang ke depan di kejauhan (~1.6 rad / 92 derajat di depan)
        pair.theta = (this.mainMesh.rotation.y + playerTheta + 1.65) % (Math.PI * 2);

        // Update posisi & rotasi wrapper silinder
        const posX = this.cylinderRadius * Math.cos(pair.theta);
        const posZ = this.cylinderRadius * Math.sin(pair.theta);

        const xAxis = new THREE.Vector3(0, -1, 0);
        const yAxis = new THREE.Vector3(Math.cos(pair.theta), 0, Math.sin(pair.theta));
        const zAxis = new THREE.Vector3(-Math.sin(pair.theta), 0, Math.cos(pair.theta));
        const basisMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

        pair.wrapper.setRotationFromMatrix(basisMat);
        pair.wrapper.position.set(posX, 0, posZ);

        // Siap muncul kembali dari kejauhan
        pair.rise = 0.0;
        pair.leftGate.group.position.y = -0.65;
        pair.rightGate.group.position.y = -0.65;
        pair.wrapper.visible = true;
      }
    });

    // 2. Update Floating Text Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += delta;
      p.sprite.position.x = p.baseX + p.life * 0.40; // Melayang naik ke atas (+X)
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
