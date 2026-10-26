import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const MODEL_PATH = {
  fire: './assets/firerun.glb',
  water: './assets/waterun.glb',
  electro: './assets/electrorun.glb'
};
const loader = new GLTFLoader();
const modelCache = new Map();

function loadModel(element) {
  if (!modelCache.has(element)) {
    modelCache.set(element, new Promise((resolve, reject) => {
      loader.load(MODEL_PATH[element], resolve, undefined, reject);
    }).catch((error) => {
      modelCache.delete(element);
      throw error;
    }));
  }
  return modelCache.get(element);
}

// Swap the leader and rebuild followers from the same animated model.
export function changeArmyElement(gateManager, avatarGroup, currentAvatar, element, onReady) {
  const request = (gateManager.elementRequest || 0) + 1;
  gateManager.elementRequest = request;
  loadModel(element).then((gltf) => {
    if (request !== gateManager.elementRequest) return;
    const model = cloneSkeleton(gltf.scene);
    model.scale.set(0.038, 0.038, 0.038);
    model.position.set(0, 0.009, 0);
    model.animations = gltf.animations;
    model.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.material = node.material.clone();
      if (node.material.color) {
        node.material.emissive = node.material.color.clone();
        node.material.emissiveIntensity = 0.3;
      }
    });
    if (currentAvatar) avatarGroup.remove(currentAvatar);
    avatarGroup.add(model);
    const mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
    const action = mixer ? mixer.clipAction(gltf.animations[0]) : null;
    if (action) action.play();
    gateManager.clearArmyClones();
    onReady(model, mixer, action);
    gateManager.syncArmyClones();
  }).catch((error) => console.warn(`Gagal memuat avatar ${element}:`, error));
}
