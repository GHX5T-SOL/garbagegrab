import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // Updated path

export class SceneManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.setupAudio();
    this.setupLighting();
    this.createArena();
    this.initObstacles();
  }
  
  setupAudio() {
    // Create audio listener
    this.audioListener = new THREE.AudioListener();
    
    // Create audio loader
    this.audioLoader = new THREE.AudioLoader();
    
    // Audio cache for sound effects
    this.audioCache = {};
    
    // Simple audio context for basic effects
    this.initBasicAudio();
  }
  
  initBasicAudio() {
    console.log('Basic audio system initialized');
  }
  
  // Basic sound effect placeholders - no synthetic generation
  playSpikeTrapSound(position) {
    console.log('Spike trap activated at:', position);
  }
  
  playHitSound() {
    console.log('Hit sound effect');
  }
  
  playStartupSound() {
    console.log('Game started');
  }
  
  playBackgroundMusic() {
    console.log('Background music started');
  }
  
  stopBackgroundMusic() {
    console.log('Background music stopped');
  }
  
  setBackgroundMusicVolume(volume) {
    console.log('Volume set to:', volume);
  }
  
  async initObstacles() {
    try {
      await this.createObstacles();
      await this.createSpikeTraps();
    } catch (error) {
      console.warn('Failed to initialize obstacles:', error);
    }
  }
  
  setupLighting() {
    // Ambient light for overall cyberpunk mood
    const ambientLight = new THREE.AmbientLight(0x220044, 0.4);
    this.scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0x4488ff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    this.scene.add(directionalLight);
    
    // Neon accent lights
    const neonLight1 = new THREE.PointLight(0xff0088, 1, 20);
    neonLight1.position.set(-15, 5, -15);
    this.scene.add(neonLight1);
    
    const neonLight2 = new THREE.PointLight(0x00ffff, 1, 20);
    neonLight2.position.set(15, 5, 15);
    this.scene.add(neonLight2);
    
    const neonLight3 = new THREE.PointLight(0x88ff00, 1, 20);
    neonLight3.position.set(-15, 5, 15);
    this.scene.add(neonLight3);
  }
  
  createArena() {
    // Grid floor
    const gridSize = 40;
    const gridDivisions = 40;
    
    // Main floor
    const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x001122,
      transparent: true,
      opacity: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Grid lines
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00ffff, 0x004488);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.6;
    this.scene.add(gridHelper);
    
    // Arena walls (invisible bounds)
    this.arenaSize = gridSize / 2 - 2;
  }
  
  async createObstacles() {
    // Simple junk piles (basic geometry only)
    const junkPositions = [
      { x: -8, z: -8 }, { x: 8, z: -8 }, { x: -8, z: 8 }, { x: 8, z: 8 },
      { x: -12, z: 0 }, { x: 12, z: 0 }, { x: 0, z: -12 }, { x: 0, z: 12 }
    ];
    
    this.junkPiles = [];
    for (const pos of junkPositions) {
      const junkPile = this.createSimpleJunk();
      junkPile.position.set(pos.x, 0, pos.z);
      this.scene.add(junkPile);
      this.junkPiles.push(junkPile);
    }
  }
  
  createSimpleJunk() {
    const group = new THREE.Group();
    
    // Create 3-5 simple boxes as junk
    for (let i = 0; i < 3 + Math.random() * 3; i++) {
      const size = 0.5 + Math.random() * 1;
      const geometry = new THREE.BoxGeometry(size, size * 0.5, size);
      const material = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color().setHSL(0.6, 0.3, 0.2 + Math.random() * 0.3),
        emissive: new THREE.Color(0x002244),
        emissiveIntensity: 0.1
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(
        (Math.random() - 0.5) * 2,
        size * 0.25,
        (Math.random() - 0.5) * 2
      );
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      group.add(mesh);
    }
    
    return group;
  }
  
  createSpikeTraps() {
    this.spikeTraps = [];
    const trapPositions = [
      { x: -5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }, { x: 5, z: -5 },
      { x: -10, z: -3 }, { x: 10, z: 3 }, { x: -3, z: -10 }, { x: 3, z: 10 }
    ];
    
    for (const pos of trapPositions) {
      const trap = this.createSimpleSpikeTrap();
      trap.position.set(pos.x, 0, pos.z);
      this.scene.add(trap);
      this.spikeTraps.push({
        mesh: trap,
        mixer: null,
        animations: {},
        position: new THREE.Vector3(pos.x, 0, pos.z),
        active: true,
        cooldown: 0,
        isActivated: false
      });
    }
  }
  
  createSimpleSpikeTrap() {
    const group = new THREE.Group();
    
    // Base
    const baseGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1);
    const baseMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x444444,
      emissive: 0x440000,
      emissiveIntensity: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    // Spikes
    for (let i = 0; i < 6; i++) {
      const spikeGeometry = new THREE.ConeGeometry(0.1, 1, 6);
      const spikeMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x666666,
        emissive: 0x440000,
        emissiveIntensity: 0.3
      });
      const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
      
      const angle = (i / 6) * Math.PI * 2;
      spike.position.set(
        Math.cos(angle) * 0.3,
        0.5,
        Math.sin(angle) * 0.3
      );
      spike.castShadow = true;
      group.add(spike);
    }
    
    return group;
  }
  
  isInBounds(position) {
    return Math.abs(position.x) < this.arenaSize && Math.abs(position.z) < this.arenaSize;
  }
  
  checkCollisionWithObstacles(position, radius = 1) {
    if (!this.junkPiles) return false;
    
    // Check junk piles
    for (const junk of this.junkPiles) {
      const distance = position.distanceTo(junk.position);
      if (distance < radius + 1.5) {
        return true;
      }
    }
    return false;
  }
  
  checkSpikeTraps(position, radius = 1) {
    if (!this.spikeTraps) return [];
    
    const activatedTraps = [];
    
    for (const trap of this.spikeTraps) {
      if (trap.cooldown > 0) {
        trap.cooldown -= 0.016; // Approximate delta time
        continue;
      }
      
      const distance = position.distanceTo(trap.position);
      if (distance < radius + 0.8) {
        activatedTraps.push(trap);
        trap.cooldown = 3; // 3 second cooldown
        trap.isActivated = true;
        
        // Play sound effect
        this.playSpikeTrapSound(trap.position);
        
        // Simple spike animation
        if (trap.mesh && trap.mesh.children) {
          trap.mesh.children.forEach((child, index) => {
            if (index > 0) { // Skip base
              child.position.y = 1.2;
              // Return to original position after animation
              setTimeout(() => {
                child.position.y = 0.5;
              }, 500);
            }
          });
        }
      }
    }
    
    return activatedTraps;
  }
  
  update(deltaTime) {
    // Basic spike trap updates (no complex animations)
  }
  
  cleanup() {
    // Clean up spike traps
    if (this.spikeTraps) {
      this.spikeTraps.forEach(trap => {
        if (trap.mesh && trap.mesh.parent) {
          this.scene.remove(trap.mesh);
        }
      });
      this.spikeTraps = [];
    }
    
    // Clean up junk piles
    if (this.junkPiles) {
      this.junkPiles.forEach(junk => {
        if (junk.parent) {
          this.scene.remove(junk);
        }
      });
      this.junkPiles = [];
    }
  }
}