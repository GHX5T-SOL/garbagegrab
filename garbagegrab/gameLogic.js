import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

// Gorbagana Testnet configuration
const PROGRAM_ID = new PublicKey('6t7gLJEudrC9JNw8ZXSnnwyMgmofdGxtQVQErA67nxhN');
const connection = new Connection('https://rpc.gorbagana.wtf', 'confirmed');

export class GameLogic {
  constructor(scene, player, sceneManager, camera, wallet) {
    this.scene = scene;
    this.player = player;
    this.sceneManager = sceneManager;
    this.camera = camera;
    this.wallet = wallet;
    this.score = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.collectibles = [];
    this.aiMechs = [];
    this.monster = null;
    this.aiScores = [
      { name: 'TrashBot_1', score: 0 },
      { name: 'TrashBot_2', score: 0 }
    ];
    this.scoreAccountReady = false; // Flag to track score account initialization
  }

  async init() {
    await this.initializeScoreAccount();
    await this.createCollectibles();
    await this.createAIMechs();
    await this.createMonster();
  }

  async getScoreAccountPDA() {
    if (!this.wallet || !this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    const [scoreAccountPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('score'), this.wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    return scoreAccountPDA;
  }

  async initializeScoreAccount() {
    if (!this.wallet || !this.wallet.publicKey) {
      console.warn('Wallet not connected, skipping score account initialization', {
        wallet: this.wallet,
        publicKey: this.wallet?.publicKey?.toBase58()
      });
      this.scoreAccountReady = false; // Ensure flag is set to false
      return;
    }
    try {
      // Check wallet balance
      const balance = await connection.getBalance(this.wallet.publicKey);
      console.log(`Wallet balance: ${balance / 1e9} SOL (PublicKey: ${this.wallet.publicKey.toBase58()})`);
      if (balance < 10000000) { // 0.01 SOL
        console.warn('Insufficient wallet balance for account initialization (< 0.01 SOL)');
      }

      const scoreAccountPDA = await this.getScoreAccountPDA();
      console.log('Attempting to fetch score account:', scoreAccountPDA.toBase58());
      
      let accountInfo = await connection.getAccountInfo(scoreAccountPDA, 'confirmed');
      if (!accountInfo) {
        console.log('Score account does not exist, initializing...');
        const instructionData = Buffer.from([0]); // Instruction type 0 for initialization
        const transaction = new Transaction().add(
          new TransactionInstruction({
            keys: [
              { pubkey: scoreAccountPDA, isSigner: false, isWritable: true },
              { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: instructionData,
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = this.wallet.publicKey;

        // Sign and send transaction
        const signedTransaction = await this.wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        console.log('Initialization transaction sent:', signature);
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        console.log('Score account initialized:', scoreAccountPDA.toBase58());
      } else {
        console.log('Score account already exists:', scoreAccountPDA.toBase58());
      }
      this.scoreAccountReady = true; // Mark score account as ready
    } catch (error) {
      console.error('Failed to initialize score account:', error.message || error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      this.scoreAccountReady = false; // Ensure flag is set to false on failure
      // Don't throw to allow game to continue with local scoring
    }
  }

  async updateScoreOnChain(itemType) {
    if (!this.wallet || !this.wallet.publicKey) {
      console.warn('Wallet not connected, skipping score update');
      return;
    }
    try {
      const incrementMap = { coin: 10, usb: 25, laptop: 50 };
      const increment = incrementMap[itemType] || 0;
      if (increment === 0) {
        console.warn(`Unknown item type: ${itemType}`);
        return;
      }
      const scoreAccountPDA = await this.getScoreAccountPDA();
      console.log(`Updating score with increment: ${increment}, PDA: ${scoreAccountPDA.toBase58()}`);
      const requestBody = {
        increment,
        scoreAccountAddress: scoreAccountPDA.toBase58(),
        playerPublicKey: this.wallet.publicKey.toBase58()
      };
      console.log('Sending /collect-item request:', requestBody);
      const response = await fetch('http://localhost:3000/collect-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }
      console.log(`Score updated via server with increment: ${increment}`, data);
    } catch (error) {
      console.error('Failed to update score via server:', error.message || error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      // Log error but don't throw to ensure local score persists
    }
  }

  reset() {
    this.score = 0;
    this.health = this.maxHealth;
    this.aiScores.forEach(ai => ai.score = 0);
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
    this.createCollectibles().catch(console.warn);
    this.aiMechs.forEach(ai => {
      ai.position.set(
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30
      );
      ai.userData.target = null;
    });
    if (this.monster) {
      this.monster.position.set(
        (Math.random() - 0.5) * 20,
        this.monster.baseHeight,
        (Math.random() - 0.5) * 20
      );
      this.monster.state = 'wander';
      this.monster.target = null;
      this.monster.hoverOffset = Math.random() * Math.PI * 2;
    }
    this.initializeScoreAccount().catch(error => {
      console.warn('Failed to reset score account:', error.message || error);
    });
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
    const config = this.getCollectibleConfig(type);
    const main = new THREE.Mesh(config.geometry, config.material(type));
    group.add(main);
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
      },
    };
    return configs[type.type] || {
      geometry: new THREE.SphereGeometry(0.3, 8, 6),
      material: (t) => new THREE.MeshLambertMaterial({
        color: t.color, emissive: t.color, emissiveIntensity: 0.3
      }),
      details: []
    };
  }

  createDataStreamDetails() {
    const details = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      details.push({
        geometry: new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4),
        material: () => new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x0088ff,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.8,
          metalness: 0.1,
          roughness: 0.1
        }),
        position: new THREE.Vector3(Math.cos(angle) * 0.3, 0.3, Math.sin(angle) * 0.3),
        rotation: new THREE.Euler(0, 0, angle)
      });
    }
    for (let i = 0; i < 6; i++) {
      details.push({
        geometry: new THREE.SphereGeometry(0.03, 6, 4),
        material: () => new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x0088ff,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.7,
          metalness: 0.1,
          roughness: 0.1
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
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
          loader.load(mechAssets[i], resolve, undefined, reject);
        });
        const model = gltf.scene;
        model.scale.set(0.7, 0.7, 0.7);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.emissive = new THREE.Color(i === 0 ? 0x440000 : 0x004400);
              child.material.emissiveIntensity = 0.3;
            }
          }
        });
        aiMech.add(model);
        if (gltf.animations && gltf.animations.length > 0) {
          aiMech.userData.mixer = new THREE.AnimationMixer(model);
          aiMech.userData.animations = {};
          gltf.animations.forEach((clip) => {
            aiMech.userData.animations[clip.name] = aiMech.userData.mixer.clipAction(clip);
          });
          if (aiMech.userData.animations['RobotArmature|Idle']) {
            aiMech.userData.animations['RobotArmature|Idle'].play();
          }
        }
      } catch (error) {
        console.warn(`Failed to load AI mech model ${i}:`, error);
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
      3.5,
      (Math.random() - 0.5) * 20
    );
    await this.loadMonsterModel();
    this.monster.speed = 2;
    this.monster.state = 'wander';
    this.monster.target = null;
    this.monster.detectionRadius = 8;
    this.monster.wanderTime = 0;
    this.monster.baseHeight = 3.5;
    this.monster.hoverAmplitude = 0.8;
    this.monster.hoverFrequency = 2.0;
    this.monster.hoverOffset = Math.random() * Math.PI * 2;
    this.monster.wanderDirection = new THREE.Vector3(
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    ).normalize();
    this.monster.currentVelocity = new THREE.Vector3();
    this.monster.previousVelocity = new THREE.Vector3();
    this.monster.banking = { x: 0, z: 0 };
    this.monster.targetBanking = { x: 0, z: 0 };
    this.monster.bankingSpeed = 4.0;
    this.monster.maxBankAngle = Math.PI * 0.25;
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
        const gltf = await new Promise((resolve, reject) => {
          loader.load(assetUrl, resolve, undefined, reject);
        });
        const model = gltf.scene;
        model.scale.set(1.2, 1.2, 1.2);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.emissive = new THREE.Color(0x4400aa);
              child.material.emissiveIntensity = 0.3;
            }
          }
        });
        this.monster.add(model);
        if (gltf.animations && gltf.animations.length > 0) {
          this.monster.mixer = new THREE.AnimationMixer(model);
          this.monster.animations = {};
          gltf.animations.forEach((clip) => {
            this.monster.animations[clip.name] = this.monster.mixer.clipAction(clip);
          });
          if (this.monster.animations['CharacterArmature|Flying_Idle']) {
            this.monster.animations['CharacterArmature|Flying_Idle'].play();
            this.monster.currentAnimation = 'flying_idle';
          }
        }
        console.log('Glub Evolved monster model loaded successfully');
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Monster loading attempt ${attempt} failed:`, error.message || error);
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          console.log(`Retrying monster loading in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    console.error('All retries failed for Glub Evolved monster:', lastError);
    this.createFallbackMonster();
  }

  createFallbackMonster() {
    console.log('Creating fallback monster geometry');
    const bodyGeometry = new THREE.SphereGeometry(0.8, 8, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: 0x4400aa,
      emissive: 0x2200aa,
      emissiveIntensity: 0.4
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    const wingGeometry = new THREE.ConeGeometry(0.4, 1.2, 6);
    const wingMaterial = new THREE.MeshLambertMaterial({
      color: 0x6600cc,
      emissive: 0x4400aa,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.8
    });
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.8, 0.2, 0);
    leftWing.rotation.z = Math.PI / 4;
    leftWing.castShadow = true;
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.8, 0.2, 0);
    rightWing.rotation.z = -Math.PI / 4;
    rightWing.castShadow = true;
    this.monster.add(body);
    this.monster.add(leftWing);
    this.monster.add(rightWing);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  update(deltaTime) {
    if (!this.scoreAccountReady) {
      console.warn('Score account not ready, game updates proceeding with local scoring');
    }
    this.collectibles.forEach(item => {
      if (!item.collected) {
        item.mesh.rotation.y += deltaTime * 2;
        item.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + item.floatOffset) * 0.2;
      }
    });
    this.updateAIMechs(deltaTime);
    this.updateMonster(deltaTime);
    this.checkCollisions();
  }

  updateAIMechs(deltaTime) {
    this.aiMechs.forEach((ai, index) => {
      if (ai.userData.mixer) {
        ai.userData.mixer.update(deltaTime);
      }
      ai.userData.lastTargetSearch += deltaTime;
      if (ai.userData.lastTargetSearch > 0.5) {
        ai.userData.lastTargetSearch = 0;
        ai.userData.target = this.findNearestCollectible(ai.position);
      }
      if (ai.userData.target && !ai.userData.target.collected) {
        const direction = new THREE.Vector3()
          .subVectors(ai.userData.target.mesh.position, ai.position)
          .normalize();
        ai.position.add(direction.multiplyScalar(ai.userData.speed * deltaTime));
        ai.lookAt(ai.userData.target.mesh.position);
        if (ai.position.distanceTo(ai.userData.target.mesh.position) < 1) {
          this.collectItem(ai.userData.target, index);
        }
      } else {
        const wanderDirection = new THREE.Vector3(
          Math.random() - 0.5,
          0,
          Math.random() - 0.5
        ).normalize();
        ai.position.add(wanderDirection.multiplyScalar(ai.userData.speed * 0.5 * deltaTime));
      }
      const bounds = this.sceneManager?.arenaSize || 18;
      ai.position.x = Math.max(-bounds, Math.min(bounds, ai.position.x));
      ai.position.z = Math.max(-bounds, Math.min(bounds, ai.position.z));
    });
  }

  updateMonster(deltaTime) {
    if (!this.monster) return;
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
    this.monster.previousVelocity.copy(this.monster.currentVelocity);
    if (this.monster.state === 'chase' && this.monster.target) {
      const targetPosition = this.monster.target.position.clone();
      targetPosition.y += 2;
      const direction = new THREE.Vector3()
        .subVectors(targetPosition, this.monster.position)
        .normalize();
      const movement = direction.clone().multiplyScalar(this.monster.speed * 2 * deltaTime);
      this.monster.position.add(movement);
      this.monster.currentVelocity.copy(direction).multiplyScalar(this.monster.speed * 2);
      this.monster.lookAt(this.monster.target.position);
      if (playerDistance < 1.5) {
        this.damagePlayer(20);
        this.switchMonsterAnimation('headbutt');
        this.monster.position.add(direction.multiplyScalar(-3));
      }
    } else {
      this.monster.wanderTime += deltaTime;
      if (this.monster.wanderTime > 3) {
        this.monster.wanderTime = 0;
        this.monster.wanderDirection = new THREE.Vector3(
          Math.random() - 0.5,
          0,
          Math.random() - 0.5
        ).normalize();
      }
      const movement = this.monster.wanderDirection.clone().multiplyScalar(this.monster.speed * deltaTime);
      this.monster.position.add(movement);
      this.monster.currentVelocity.copy(this.monster.wanderDirection).multiplyScalar(this.monster.speed);
    }
    const time = Date.now() * 0.001;
    const hoverY = this.monster.baseHeight + 
      Math.sin(time * this.monster.hoverFrequency + this.monster.hoverOffset) * 
      this.monster.hoverAmplitude;
    this.monster.position.y = hoverY;
    const bounds = this.sceneManager?.arenaSize || 18;
    this.monster.position.x = Math.max(-bounds, Math.min(bounds, this.monster.position.x));
    this.monster.position.z = Math.max(-bounds, Math.min(bounds, this.monster.position.z));
    this.updateMonsterBanking(deltaTime);
  }

  checkCollisions() {
    this.collectibles.forEach(item => {
      if (!item.collected && this.player.position.distanceTo(item.mesh.position) < 1) {
        this.collectItem(item, -1);
      }
    });
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
    if (item.mixer) {
      item.mixer.stopAllAction();
      item.mixer.uncacheRoot(item.mixer.getRoot());
      item.mixer = null;
    }
    console.log(`Collected ${item.type} worth ${item.value} points`);
    if (collectorId === -1) {
      // Player collected the item
      this.score += item.value; // Update local score immediately
      this.updateScoreOnChain(item.type).catch(error => {
        console.error('Failed to update score on-chain:', error.message || error);
        // Log error but don't revert local score update
      });
    } else {
      this.aiScores[collectorId].score += item.value;
    }
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

  getCollectibleColor(type) {
    const colorMap = {
      coin: 0xffd700,
      usb: 0x0088ff,
      laptop: 0xc0c0c0
    };
    return colorMap[type] || 0xffffff;
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
    const velocityChange = new THREE.Vector3()
      .subVectors(this.monster.currentVelocity, this.monster.previousVelocity);
    this.monster.targetBanking.z = -velocityChange.x * 0.3;
    this.monster.targetBanking.x = velocityChange.z * 0.2;
    this.monster.targetBanking.z = Math.max(-this.monster.maxBankAngle, 
      Math.min(this.monster.maxBankAngle, this.monster.targetBanking.z));
    this.monster.targetBanking.x = Math.max(-this.monster.maxBankAngle * 0.5, 
      Math.min(this.monster.maxBankAngle * 0.5, this.monster.targetBanking.x));
    this.monster.banking.z += (this.monster.targetBanking.z - this.monster.banking.z) * this.monster.bankingSpeed * deltaTime;
    this.monster.banking.x += (this.monster.targetBanking.x - this.monster.banking.x) * this.monster.bankingSpeed * deltaTime;
    if (this.monster.children.length > 0) {
      const model = this.monster.children[0];
      if (model) {
        model.rotation.x = this.monster.banking.x;
        model.rotation.z = this.monster.banking.z;
        const speed = this.monster.currentVelocity.length();
        if (speed > 1) {
          const flopIntensity = Math.min(1, speed / 8) * 0.1;
          const flopFrequency = speed * 2;
          const flopOffset = Math.sin(Date.now() * 0.01 * flopFrequency) * flopIntensity;
          model.rotation.x += flopOffset;
        }
      }
    }
  }
}