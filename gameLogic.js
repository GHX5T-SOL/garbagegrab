import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class GameLogic {
  constructor(scene, player, sceneManager, camera) {
    this.scene = scene;
    this.player = player;
    this.sceneManager = sceneManager;
    this.camera = camera;
    this.score = 0;
    this.health = 100;
    this.maxHealth = 100;
    
    // Game entities
    this.collectibles = [];
    this.aiMechs = [];
    this.monster = null;
    
    // AI scores
    this.aiScores = [
      { name: 'TrashBot_1', score: 0 },
      { name: 'TrashBot_2', score: 0 }
    ];
    
    this.init();
  }
  
  async init() {
    await this.createCollectibles();
    await this.createAIMechs();
    await this.createMonster();
  }
  
  reset() {
    this.score = 0;
    this.health = this.maxHealth;
    this.aiScores.forEach(ai => ai.score = 0);
    
    // Reset collectibles with proper cleanup
    this.collectibles.forEach(item => {
      if (item.mesh.parent) {
        this.scene.remove(item.mesh);
      }
      // Clean up any animation mixers
      if (item.mixer) {
        item.mixer.stopAllAction();
        item.mixer.uncacheRoot(item.mixer.getRoot());
        item.mixer = null;
      }
    });
    this.collectibles = [];
    this.createCollectibles().catch(console.warn);
    
    // Reset AI positions
    this.aiMechs.forEach(ai => {
      ai.position.set(
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30
      );
      ai.userData.target = null;
    });
    
    // Reset monster
    if (this.monster) {
      this.monster.position.set(
        (Math.random() - 0.5) * 20,
        this.monster.baseHeight,
        (Math.random() - 0.5) * 20
      );
      this.monster.state = 'wander';
      this.monster.target = null;
      this.monster.hoverOffset = Math.random() * Math.PI * 2; // New random phase
    }
  }
  
  async createCollectibles() {
    const collectibleTypes = [
      { type: 'coin', value: 10, color: 0xffd700, count: 15 },
      { type: 'usb', value: 25, color: 0x0088ff, count: 8 },
      { type: 'laptop', value: 50, color: 0xc0c0c0, count: 5 }
    ];
    
    for (const type of collectibleTypes) {
      for (let i = 0; i < type.count; i++) {
        const collectible = await this.createCollectible(type);
        this.collectibles.push(collectible);
        this.scene.add(collectible.mesh);
      }
    }
  }
  
  async createCollectible(type) {
    const mesh = await this.createCollectibleMesh(type);
    mesh.castShadow = true;
    
    // Position randomly
    let position;
    let attempts = 0;
    do {
      position = new THREE.Vector3(
        (Math.random() - 0.5) * 35,
        0.5,
        (Math.random() - 0.5) * 35
      );
      attempts++;
    } while (this.sceneManager && this.sceneManager.checkCollisionWithObstacles(position) && attempts < 20);
    
    mesh.position.copy(position);
    
    return {
      mesh,
      type: type.type,
      value: type.value,
      floatOffset: Math.random() * Math.PI * 2,
      collected: false
    };
  }
  
  async createCollectibleMesh(type) {
    // Try to load mech model for high-value items first
    if (type.type === 'laptop') {
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
          loader.load('https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?vU5V', resolve, undefined, reject);
        });
        
        return this.createMechCollectible(gltf.scene, type);
      } catch (error) {
        console.warn('Failed to load mini-mech model, using fallback');
      }
    }
    
    // Create detailed geometry collectibles
    return this.createGeometryCollectible(type);
  }
  
  createMechCollectible(model, type) {
    const group = new THREE.Group();
    
    model.scale.set(0.3, 0.3, 0.3);
    model.rotation.y = Math.PI;
    
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.emissive = new THREE.Color(type.color);
          child.material.emissiveIntensity = 0.4;
          child.material.metalness = 0.9;
          child.material.roughness = 0.3;
        }
      }
    });
    
    group.add(model);
    
    // Add base and energy field
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: type.color,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
      })
    );
    base.position.y = -0.15;
    group.add(base);
    
    const field = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 8),
      new THREE.MeshBasicMaterial({
        color: type.color,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide
      })
    );
    group.add(field);
    
    return group;
  }
  
  createGeometryCollectible(type) {
    const group = new THREE.Group();
    const config = this.getCollectibleConfig(type.type);
    
    // Main shape
    const main = new THREE.Mesh(config.geometry, config.material(type));
    group.add(main);
    
    // Add type-specific details
    config.details.forEach(detail => {
      const mesh = new THREE.Mesh(detail.geometry, detail.material(type));
      if (detail.position) mesh.position.copy(detail.position);
      if (detail.rotation) mesh.rotation.copy(detail.rotation);
      group.add(mesh);
    });
    
    return group;
  }
  
  getCollectibleConfig(type) {
    const configs = {
      coin: {
        geometry: new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16),
        material: (t) => new THREE.MeshStandardMaterial({
          color: t.color, emissive: t.color, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2
        }),
        details: [
          {
            geometry: new THREE.RingGeometry(0.15, 0.25, 8),
            material: () => new THREE.MeshBasicMaterial({
              color: 0x00ffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide
            }),
            position: new THREE.Vector3(0, 0.05, 0),
            rotation: new THREE.Euler(-Math.PI / 2, 0, 0)
          },
          {
            geometry: new THREE.SphereGeometry(0.1, 8, 6),
            material: () => new THREE.MeshBasicMaterial({
              color: 0xffffff, transparent: true, opacity: 0.9
            }),
            position: new THREE.Vector3(0, 0.05, 0)
          }
        ]
      },
      usb: {
        geometry: new THREE.OctahedronGeometry(0.4),
        material: (t) => new THREE.MeshStandardMaterial({
          color: t.color, emissive: t.color, emissiveIntensity: 0.5, 
          transparent: true, opacity: 0.8, metalness: 0.1, roughness: 0.1
        }),
        details: this.createDataStreamDetails()
      },
      laptop: {
        geometry: new THREE.BoxGeometry(0.8, 0.08, 0.6),
        material: () => new THREE.MeshStandardMaterial({
          color: 0x333333, metalness: 0.7, roughness: 0.3
        }),
        details: [
          {
            geometry: new THREE.BoxGeometry(0.75, 0.5, 0.03),
            material: (t) => new THREE.MeshStandardMaterial({
              color: 0x000000, emissive: t.color, emissiveIntensity: 0.6
            }),
            position: new THREE.Vector3(0, 0.3, -0.28),
            rotation: new THREE.Euler(-Math.PI * 0.4, 0, 0)
          }
        ]
      }
    };
    
    return configs[type] || {
      geometry: new THREE.SphereGeometry(0.3, 8, 6),
      material: (t) => new THREE.MeshLambertMaterial({
        color: t.color, emissive: t.color, emissiveIntensity: 0.3
      }),
      details: []
    };
  }
  
  createDataStreamDetails() {
    const details = [];
    
    // Data streams
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      details.push({
        geometry: new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4),
        material: () => new THREE.MeshBasicMaterial({
          color: 0x00ffff, emissive: 0x0088ff, emissiveIntensity: 0.8
        }),
        position: new THREE.Vector3(Math.cos(angle) * 0.3, 0.3, Math.sin(angle) * 0.3),
        rotation: new THREE.Euler(0, 0, angle)
      });
    }
    
    // Floating particles
    for (let i = 0; i < 6; i++) {
      details.push({
        geometry: new THREE.SphereGeometry(0.03, 6, 4),
        material: () => new THREE.MeshBasicMaterial({
          color: 0x00ffff, transparent: true, opacity: 0.7
        }),
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          Math.random() * 0.6 + 0.1,
          (Math.random() - 0.5) * 0.8
        )
      });
    }
    
    return details;
  }
  
  async createAIMechs() {
    const mechAssets = [
      'https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?JhXI',
      'https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?vU5V'
    ];
    for (let i = 0; i < 2; i++) {
      const aiMech = new THREE.Group();
      aiMech.position.set(
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30
      );
      
      // Load GLTF model for AI mech
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
          loader.load(
            mechAssets[i],
            resolve,
            undefined,
            reject
          );
        });
        
        const model = gltf.scene;
        model.scale.set(0.7, 0.7, 0.7);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Add AI-specific coloring
            if (child.material) {
              child.material.emissive = new THREE.Color(i === 0 ? 0x440000 : 0x004400);
              child.material.emissiveIntensity = 0.3;
            }
          }
        });
        
        aiMech.add(model);
        
        // Store animations if available
        if (gltf.animations && gltf.animations.length > 0) {
          aiMech.userData.mixer = new THREE.AnimationMixer(model);
          aiMech.userData.animations = {};
          
          gltf.animations.forEach((clip) => {
            aiMech.userData.animations[clip.name] = aiMech.userData.mixer.clipAction(clip);
          });
          
          // Start idle animation
          if (aiMech.userData.animations['RobotArmature|Idle']) {
            aiMech.userData.animations['RobotArmature|Idle'].play();
          }
        }
        
      } catch (error) {
        console.warn(`Failed to load AI mech model ${i}:`, error);
        // Fallback to basic geometry
        const geometry = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        const material = new THREE.MeshLambertMaterial({
          color: i === 0 ? 0xff4400 : 0x00ff44,
          emissive: i === 0 ? 0x441100 : 0x001144,
          emissiveIntensity: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        aiMech.add(mesh);
      }
      
      // AI properties
      aiMech.userData = aiMech.userData || {};
      aiMech.userData.speed = 3 + Math.random() * 2;
      aiMech.userData.target = null;
      aiMech.userData.lastTargetSearch = 0;
      aiMech.userData.id = i;
      
      this.aiMechs.push(aiMech);
      this.scene.add(aiMech);
    }
  }
  
  async createMonster() {
    this.monster = new THREE.Group();
    this.monster.position.set(
      (Math.random() - 0.5) * 20,
      3.5, // Flying height - hover well above ground
      (Math.random() - 0.5) * 20
    );
    
    // Load Glub Evolved GLTF model with retry logic
    await this.loadMonsterModel();
    
    // Monster AI properties
    this.monster.speed = 2;
    this.monster.state = 'wander'; // wander, chase
    this.monster.target = null;
    this.monster.detectionRadius = 8;
    this.monster.wanderTime = 0;
    this.monster.baseHeight = 3.5; // Base flying height
    this.monster.hoverAmplitude = 0.8; // How much it bobs up and down
    this.monster.hoverFrequency = 2.0; // How fast it bobs
    this.monster.hoverOffset = Math.random() * Math.PI * 2; // Random phase offset
    this.monster.wanderDirection = new THREE.Vector3(
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    ).normalize();
    
    // Banking and tilting properties for realistic flying
    this.monster.currentVelocity = new THREE.Vector3();
    this.monster.previousVelocity = new THREE.Vector3();
    this.monster.banking = { x: 0, z: 0 }; // Current banking angles
    this.monster.targetBanking = { x: 0, z: 0 }; // Target banking angles
    this.monster.bankingSpeed = 4.0; // How fast banking transitions happen
    this.monster.maxBankAngle = Math.PI * 0.25; // Maximum banking angle (45 degrees)
    
    this.scene.add(this.monster);
  }
  
  async loadMonsterModel() {
    const maxRetries = 3;
    const timeoutMs = 12000;
    const assetUrl = 'https://play.rosebud.ai/assets/Glub Evolved.glb?Qhxz';
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Loading Glub Evolved monster model (attempt ${attempt}/${maxRetries})`);
        
        const loader = new GLTFLoader();
        const gltf = await this.loadGLTFWithRetry(
          loader, 
          assetUrl,
          timeoutMs
        );
        
        const model = gltf.scene;
        model.scale.set(1.2, 1.2, 1.2);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Enhance the Glub Evolved's menacing appearance
            if (child.material) {
              child.material.emissive = new THREE.Color(0x4400aa);
              child.material.emissiveIntensity = 0.3;
            }
          }
        });
        
        this.monster.add(model);
        
        // Store animations if available
        if (gltf.animations && gltf.animations.length > 0) {
          this.monster.mixer = new THREE.AnimationMixer(model);
          this.monster.animations = {};
          
          gltf.animations.forEach((clip) => {
            this.monster.animations[clip.name] = this.monster.mixer.clipAction(clip);
          });
          
          // Start flying idle animation
          if (this.monster.animations['CharacterArmature|Flying_Idle']) {
            this.monster.animations['CharacterArmature|Flying_Idle'].play();
            this.monster.currentAnimation = 'flying_idle';
          }
        }
        
        console.log('Glub Evolved monster model loaded successfully');
        return; // Success - exit retry loop
        
      } catch (error) {
        lastError = error;
        console.warn(`Monster loading attempt ${attempt} failed:`, error.message || error);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          console.log(`Retrying monster loading in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    // All retries failed - use fallback
    console.error('Failed to load Glub Evolved monster after all retries:', lastError);
    this.createFallbackMonster();
  }
  
  createFallbackMonster() {
    console.log('Creating fallback monster geometry');
    
    // Create a more detailed fallback monster
    const bodyGeometry = new THREE.SphereGeometry(0.8, 8, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: 0x4400aa,
      emissive: 0x2200aa,
      emissiveIntensity: 0.4
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    
    // Add wing-like appendages for visual distinction
    const wingGeometry = new THREE.ConeGeometry(0.4, 1.2, 6);
    const wingMaterial = new THREE.MeshLambertMaterial({
      color: 0x6600cc,
      emissive: 0x4400aa,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.8
    });
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.8, 0.2, 0);
    leftWing.rotation.z = Math.PI / 4;
    leftWing.castShadow = true;
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.8, 0.2, 0);
    rightWing.rotation.z = -Math.PI / 4;
    rightWing.castShadow = true;
    
    this.monster.add(body);
    this.monster.add(leftWing);
    this.monster.add(rightWing);
  }
  
  update(deltaTime) {
    // Animate collectibles
    this.collectibles.forEach(item => {
      if (!item.collected) {
        item.mesh.rotation.y += deltaTime * 2;
        item.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + item.floatOffset) * 0.2;
      }
    });
    
    // Update AI mechs
    this.updateAIMechs(deltaTime);
    
    // Update monster
    this.updateMonster(deltaTime);
    
    // Check collisions
    this.checkCollisions();
  }
  
  updateAIMechs(deltaTime) {
    this.aiMechs.forEach((ai, index) => {
      // Simple animation update
      if (ai.userData.mixer) {
        ai.userData.mixer.update(deltaTime);
      }
      
      // Find nearest collectible
      ai.userData.lastTargetSearch += deltaTime;
      if (ai.userData.lastTargetSearch > 0.5) {
        ai.userData.lastTargetSearch = 0;
        ai.userData.target = this.findNearestCollectible(ai.position);
      }
      
      // Move towards target
      if (ai.userData.target && !ai.userData.target.collected) {
        const direction = new THREE.Vector3()
          .subVectors(ai.userData.target.mesh.position, ai.position)
          .normalize();
        
        ai.position.add(direction.multiplyScalar(ai.userData.speed * deltaTime));
        ai.lookAt(ai.userData.target.mesh.position);
        
        // Check if reached target
        if (ai.position.distanceTo(ai.userData.target.mesh.position) < 1) {
          this.collectItem(ai.userData.target, index);
        }
      } else {
        // Wander randomly
        const wanderDirection = new THREE.Vector3(
          Math.random() - 0.5,
          0,
          Math.random() - 0.5
        ).normalize();
        ai.position.add(wanderDirection.multiplyScalar(ai.userData.speed * 0.5 * deltaTime));
      }
      
      // Keep in bounds - use scene manager arena bounds if available
      const bounds = this.sceneManager?.arenaSize || 18;
      ai.position.x = Math.max(-bounds, Math.min(bounds, ai.position.x));
      ai.position.z = Math.max(-bounds, Math.min(bounds, ai.position.z));
    });
  }
  
  updateMonster(deltaTime) {
    if (!this.monster) return;
    
    // Update monster animations
    if (this.monster.mixer) {
      this.monster.mixer.update(deltaTime);
    }
    
    const playerDistance = this.monster.position.distanceTo(this.player.position);
    
    if (playerDistance < this.monster.detectionRadius && this.monster.state === 'wander') {
      this.monster.state = 'chase';
      this.monster.target = this.player;
      this.switchMonsterAnimation('fast_flying');
    } else if (playerDistance > this.monster.detectionRadius * 1.5 && this.monster.state === 'chase') {
      this.monster.state = 'wander';
      this.monster.target = null;
      this.switchMonsterAnimation('flying_idle');
    }
    
    // Store previous position for velocity calculation
    this.monster.previousVelocity.copy(this.monster.currentVelocity);
    
    if (this.monster.state === 'chase' && this.monster.target) {
      // Chase player - fly towards them
      const targetPosition = this.monster.target.position.clone();
      targetPosition.y += 2; // Fly slightly above player
      
      const direction = new THREE.Vector3()
        .subVectors(targetPosition, this.monster.position)
        .normalize();
      
      // Calculate movement vector for this frame
      const movement = direction.clone().multiplyScalar(this.monster.speed * 2 * deltaTime);
      this.monster.position.add(movement);
      
      // Store current velocity for banking calculations
      this.monster.currentVelocity.copy(direction).multiplyScalar(this.monster.speed * 2);
      
      this.monster.lookAt(this.monster.target.position);
      
      // Check collision with player
      if (playerDistance < 1.5) {
        this.damagePlayer(20);
        this.switchMonsterAnimation('headbutt');
        // Knockback monster
        this.monster.position.add(direction.multiplyScalar(-3));
      }
    } else {
      // Wander - fly around randomly
      this.monster.wanderTime += deltaTime;
      if (this.monster.wanderTime > 3) {
        this.monster.wanderTime = 0;
        this.monster.wanderDirection = new THREE.Vector3(
          Math.random() - 0.5,
          0,
          Math.random() - 0.5
        ).normalize();
      }
      
      // Calculate movement vector for this frame
      const movement = this.monster.wanderDirection.clone().multiplyScalar(this.monster.speed * deltaTime);
      this.monster.position.add(movement);
      
      // Store current velocity for banking calculations
      this.monster.currentVelocity.copy(this.monster.wanderDirection).multiplyScalar(this.monster.speed);
    }
    
    // Apply hovering motion - continuous floating up and down
    const time = Date.now() * 0.001; // Convert to seconds
    const hoverY = this.monster.baseHeight + 
                   Math.sin(time * this.monster.hoverFrequency + this.monster.hoverOffset) * 
                   this.monster.hoverAmplitude;
    this.monster.position.y = hoverY;
    
    // Keep monster in bounds (but allow flying height)
    const bounds = this.sceneManager?.arenaSize || 18;
    this.monster.position.x = Math.max(-bounds, Math.min(bounds, this.monster.position.x));
    this.monster.position.z = Math.max(-bounds, Math.min(bounds, this.monster.position.z));
    
    // Calculate banking angles based on velocity change
    this.updateMonsterBanking(deltaTime);
  }
  
  checkCollisions() {
    // Check player collectible collision
    this.collectibles.forEach(item => {
      if (!item.collected && this.player.position.distanceTo(item.mesh.position) < 1) {
        this.collectItem(item, -1); // -1 for player
      }
    });
    
    // Check spike trap collisions
    if (this.sceneManager) {
      const activatedTraps = this.sceneManager.checkSpikeTraps(this.player.position);
      if (activatedTraps.length > 0) {
        const damage = 25;
        this.damagePlayer(damage);
      }
    }
  }
  
  collectItem(item, collectorId) {
    if (item.collected) return;
    
    item.collected = true;
    this.scene.remove(item.mesh);
    
    // Clean up animation mixer if it exists
    if (item.mixer) {
      item.mixer.stopAllAction();
      item.mixer.uncacheRoot(item.mixer.getRoot());
      item.mixer = null;
    }
    
    // Simple collection feedback
    console.log(`Collected ${item.type} worth ${item.value} points`);
    
    if (collectorId === -1) {
      // Player collected
      this.score += item.value;
    } else {
      // AI collected - check if collectorId is valid
      if (collectorId >= 0 && collectorId < this.aiScores.length) {
        this.aiScores[collectorId].score += item.value;
      }
    }
    
    // Respawn collectible after delay
    setTimeout(async () => {
      if (this.collectibles.includes(item)) {
        try {
          const newCollectible = await this.createCollectible({
            type: item.type,
            value: item.value,
            color: this.getCollectibleColor(item.type)
          });
          
          const index = this.collectibles.indexOf(item);
          this.collectibles[index] = newCollectible;
          this.scene.add(newCollectible.mesh);
        } catch (error) {
          console.warn('Failed to respawn collectible:', error);
        }
      }
    }, 5000 + Math.random() * 5000);
  }
  
  
  damagePlayer(amount) {
    this.health = Math.max(0, this.health - amount);
    
    // Basic damage feedback
    if (this.sceneManager) {
      this.sceneManager.playHitSound();
    }
    console.log(`Player took ${amount} damage, health now: ${this.health}`);
  }
  
  findNearestCollectible(position) {
    let nearest = null;
    let nearestDistance = Infinity;
    
    this.collectibles.forEach(item => {
      if (!item.collected) {
        const distance = position.distanceTo(item.mesh.position);
        if (distance < nearestDistance) {
          nearest = item;
          nearestDistance = distance;
        }
      }
    });
    
    return nearest;
  }
  
  switchMonsterAnimation(type) {
    if (!this.monster.animations) return;
    
    if (this.monster.currentAnimation) {
      const currentAnimName = this.getMonsterAnimationName(this.monster.currentAnimation);
      const current = this.monster.animations[currentAnimName];
      if (current) current.fadeOut(0.3);
    }
    
    const nextAnimName = this.getMonsterAnimationName(type);
    const next = this.monster.animations[nextAnimName];
    if (next) {
      next.reset().fadeIn(0.3).play();
    }
    
    this.monster.currentAnimation = type;
  }
  getMonsterAnimationName(type) {
    const animMap = {
      'flying_idle': 'CharacterArmature|Flying_Idle',
      'fast_flying': 'CharacterArmature|Fast_Flying',
      'headbutt': 'CharacterArmature|Headbutt',
      'death': 'CharacterArmature|Death'
    };
    return animMap[type] || 'CharacterArmature|Flying_Idle';
  }
  
  getLeaderboard() {
    const leaderboard = [
      { name: 'Player', score: this.score },
      ...this.aiScores
    ];
    
    return leaderboard.sort((a, b) => b.score - a.score);
  }
  
  updateMonsterBanking(deltaTime) {
    if (!this.monster) return;
    
    // Calculate velocity change for banking
    const velocityChange = new THREE.Vector3()
      .subVectors(this.monster.currentVelocity, this.monster.previousVelocity);
    
    // Calculate target banking angles based on velocity change
    // Banking around Z-axis (roll) for left/right turns
    this.monster.targetBanking.z = -velocityChange.x * 0.3; // Negative for proper banking direction
    
    // Banking around X-axis (pitch) for speed changes and up/down movement
    this.monster.targetBanking.x = velocityChange.z * 0.2; // Pitch forward when accelerating forward
    
    // Clamp banking angles to maximum values
    this.monster.targetBanking.z = Math.max(-this.monster.maxBankAngle, 
                                           Math.min(this.monster.maxBankAngle, this.monster.targetBanking.z));
    this.monster.targetBanking.x = Math.max(-this.monster.maxBankAngle * 0.5, 
                                           Math.min(this.monster.maxBankAngle * 0.5, this.monster.targetBanking.x));
    
    // Smoothly interpolate to target banking angles
    this.monster.banking.z += (this.monster.targetBanking.z - this.monster.banking.z) * this.monster.bankingSpeed * deltaTime;
    this.monster.banking.x += (this.monster.targetBanking.x - this.monster.banking.x) * this.monster.bankingSpeed * deltaTime;
    
    // Apply banking rotation to the monster model
    if (this.monster.children.length > 0) {
      const model = this.monster.children[0]; // Get the first child (the loaded model)
      if (model) {
        // Apply banking on top of existing rotation
        model.rotation.x = this.monster.banking.x;
        model.rotation.z = this.monster.banking.z;
        
        // Add subtle wing-flapping effect during fast movement
        const speed = this.monster.currentVelocity.length();
        if (speed > 1) {
          const flapIntensity = Math.min(1, speed / 8) * 0.1;
          const flapFrequency = speed * 2;
          const flapOffset = Math.sin(Date.now() * 0.01 * flapFrequency) * flapIntensity;
          model.rotation.x += flapOffset;
        }
      }
    }
  }
  
  getCollectibleColor(type) {
    switch (type) {
      case 'coin': return 0xffd700;
      case 'usb': return 0x0088ff;
      case 'laptop': return 0xc0c0c0;
      default: return 0xffffff;
    }
  }
  
  // Helper method for loading GLTF with timeout and retry support
  loadGLTFWithRetry(loader, url, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Asset loading timeout after ${timeoutMs}ms: ${url}`));
      }, timeoutMs);
      
      loader.load(
        url,
        (gltf) => {
          clearTimeout(timeoutId);
          if (!gltf || !gltf.scene) {
            reject(new Error(`Invalid GLTF data received from: ${url}`));
            return;
          }
          resolve(gltf);
        },
        (progress) => {
          // Optional: Log loading progress for debugging
          if (progress.lengthComputable) {
            const percentComplete = (progress.loaded / progress.total) * 100;
            console.log(`Loading ${url}: ${percentComplete.toFixed(1)}%`);
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          const errorMessage = error?.message || `Failed to load asset: ${url}`;
          reject(new Error(errorMessage));
        }
      );
    });
  }
  
  // Helper method for delays in retry logic
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Cleanup method to properly dispose of resources
  cleanup() {
    // Clean up collectibles
    this.collectibles.forEach(item => {
      if (item.mesh.parent) {
        this.scene.remove(item.mesh);
      }
      if (item.mixer) {
        item.mixer.stopAllAction();
        item.mixer.uncacheRoot(item.mixer.getRoot());
        item.mixer = null;
      }
    });
    this.collectibles = [];
    
    // Clean up AI mechs
    this.aiMechs.forEach(ai => {
      if (ai.parent) {
        this.scene.remove(ai);
      }
      if (ai.userData.mixer) {
        ai.userData.mixer.stopAllAction();
        ai.userData.mixer.uncacheRoot(ai.userData.mixer.getRoot());
        ai.userData.mixer = null;
      }
    });
    this.aiMechs = [];
    
    // Clean up monster
    if (this.monster) {
      if (this.monster.parent) {
        this.scene.remove(this.monster);
      }
      if (this.monster.mixer) {
        this.monster.mixer.stopAllAction();
        this.monster.mixer.uncacheRoot(this.monster.mixer.getRoot());
        this.monster.mixer = null;
      }
      this.monster = null;
    }
  }
}