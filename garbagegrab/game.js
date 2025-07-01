import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PlayerController, ThirdPersonCameraController } from './rosieControls.js';
import { SceneManager } from './sceneManager.js';
import { GameLogic } from './gameLogic.js';
import { UI } from './ui.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.gameState = 'menu'; // menu, playing, gameOver
    this.gameTime = 300; // 5 minutes in seconds
    this.currentTime = this.gameTime;
    
    // Initialize core systems
    this.initRenderer();
    this.initScene();
    this.initPlayer();
    this.initControllers();
    
    // Initialize game systems
    this.sceneManager = new SceneManager(this.scene, this.camera);
    
    // Connect audio listener to camera after scene manager is created
    if (this.sceneManager.audioListener) {
      this.camera.add(this.sceneManager.audioListener);
    }
    
    // Initialize UI
    this.ui = new UI();
    
    // Initialize GameLogic with wallet from UI
    this.gameLogic = new GameLogic(this.scene, this.player, this.sceneManager, this.camera, window.backpack);
    
    // Listen for wallet connection changes
    if (this.ui.connectWalletBtn) {
      this.ui.connectWalletBtn.addEventListener('click', () => {
        this.updateWallet(window.backpack); // Update wallet immediately
      });
    }
    
    // Start render loop
    this.clock = new THREE.Clock();
    this.animate();
  }
  
  async init() {
    try {
      await this.gameLogic.init(); // Ensure game logic (including blockchain) is fully initialized
      console.log('GameLogic initialized, score account ready:', this.gameLogic.scoreAccountReady);
    } catch (error) {
      console.error('Failed to initialize game logic:', error);
      this.ui.showError('Failed to initialize the game. Please try again later.');
      // Allow game to proceed with local scoring
    }
  }
  
  updateWallet(wallet) {
    try {
      this.gameLogic.wallet = wallet;
      console.log('Updated GameLogic wallet:', wallet?.publicKey?.toBase58() || 'No wallet connected');
      // Re-initialize score account after wallet connection
      this.gameLogic.initializeScoreAccount().catch(error => {
        console.error('Error re-initializing score account:', error.message || error);
      });
    } catch (error) {
      console.error('Error updating wallet:', error);
    }
  }
  
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000011);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
  
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000033, 10, 100);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, 10);
    
    // Audio listener will be added after scene manager is created
  }
  
  initPlayer() {
    // Create player mech
    this.player = new THREE.Group();
    this.player.position.set(0, 0.5, 0);
    this.scene.add(this.player);
    
    // Load player model
    this.loadPlayerModel();
  }
  
  loadPlayerModel() {
    try {
      const loader = new GLTFLoader();
      loader.load(
        'https://play.rosebud.ai/assets/Mech-D5Ww2Jdo42.glb?zjzc',
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(0.8, 0.8, 0.8);
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.emissive = new THREE.Color(0x002244);
                child.material.emissiveIntensity = 0.2;
              }
            }
          });
          
          this.player.add(model);
          
          // Store animations
          this.playerMixer = new THREE.AnimationMixer(model);
          this.playerAnimations = {};
          
          if (gltf.animations && gltf.animations.length > 0) {
            gltf.animations.forEach((clip) => {
              this.playerAnimations[clip.name] = this.playerMixer.clipAction(clip);
            });
            
            if (this.playerAnimations['RobotArmature|Idle']) {
              this.playerAnimations['RobotArmature|Idle'].play();
            }
          }
          
          console.log('Player model loaded successfully');
        },
        undefined,
        (error) => {
          console.warn('Failed to load player model:', error);
          this.createFallbackPlayer();
        }
      );
    } catch (error) {
      console.warn('Error loading player model:', error);
      this.createFallbackPlayer();
    }
  }
  
  createFallbackPlayer() {
    const geometry = new THREE.BoxGeometry(1, 1.5, 1);
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x0088ff,
      emissive: 0x002244,
      emissiveIntensity: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.player.add(mesh);
  }
  
  initControllers() {
    this.playerController = new PlayerController(this.player, {
      moveSpeed: 8,
      jumpForce: 0,
      gravity: 0,
      groundLevel: 0.5
    });
    
    this.cameraController = new ThirdPersonCameraController(
      this.camera, 
      this.player, 
      this.renderer.domElement,
      {
        distance: 12,
        height: 8,
        rotationSpeed: 0.003
      }
    );
  }
  
  startGame() {
    // Start the game immediately, using local scoring if score account isn't ready
    console.log('Starting game, score account ready:', this.gameLogic.scoreAccountReady);
    if (!this.gameLogic.scoreAccountReady) {
      console.warn('Score account not initialized, using local scoring');
      this.ui.showError('Score account not initialized, scores will be local only');
    }
    this.gameState = 'playing';
    this.currentTime = this.gameTime;
    this.gameLogic.reset();
    this.ui.updateScore(0);
    this.ui.updateHealth(100);
    if (this.sceneManager) {
      this.sceneManager.playStartupSound();
      this.sceneManager.playBackgroundMusic();
    }
    console.log('Game started successfully.');
  }
  
  restart() {
    // Clean up existing resources before restarting
    this.cleanupResources();
    this.startGame();
  }
  
  cleanupResources() {
    // Clean up player animations
    if (this.playerMixer) {
      this.playerMixer.stopAllAction();
      this.playerMixer = null;
    }
    
    this.playerAnimations = {};
    this.currentAnimation = null;
    
    // Clean up controllers
    if (this.playerController) {
      this.playerController.destroy();
    }
    
    if (this.cameraController) {
      this.cameraController.destroy();
    }
    
    // Clean up game systems
    if (this.gameLogic) {
      this.gameLogic.cleanup();
    }
    
    if (this.sceneManager) {
      this.sceneManager.cleanup();
    }
    
    // Reset game state
    this.gameState = 'menu';
    this.currentTime = this.gameTime;
    
    // Re-initialize controllers after cleanup
    this.initControllers();
  }
  
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    
    if (this.gameState === 'playing') {
      // Update game timer
      this.currentTime -= deltaTime;
      if (this.currentTime <= 0) {
        this.endGame();
      }
      
      // Update controllers
      const cameraRotation = this.cameraController.update();
      this.playerController.update(deltaTime, cameraRotation);
      
      // Update player animations
      if (this.playerMixer) {
        this.playerMixer.update(deltaTime);
        this.updatePlayerAnimation();
      }
      
      // Update game logic
      this.gameLogic.update(deltaTime);
      
      // Update scene manager
      this.sceneManager.update(deltaTime);
      
      // Update UI with debug logging
      console.log('Updating UI with score:', this.gameLogic.score);
      this.ui.updateTimer(this.currentTime);
      this.ui.updateScore(this.gameLogic.score);
      this.ui.updateHealth(this.gameLogic.health);
      this.ui.updateLeaderboard(this.gameLogic.getLeaderboard());
      
      // Check game over conditions
      if (this.gameLogic.health <= 0) {
        this.endGame();
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  updatePlayerAnimation() {
    if (!this.playerAnimations || Object.keys(this.playerAnimations).length === 0) return;
    
    const isMoving = Math.abs(this.playerController.velocity.x) > 0.1 || 
                    Math.abs(this.playerController.velocity.z) > 0.1;
    
    if (isMoving && this.playerAnimations['RobotArmature|Run']) {
      if (!this.currentAnimation || this.currentAnimation !== 'run') {
        this.switchAnimation('run');
      }
    } else if (this.playerAnimations['RobotArmature|Idle']) {
      if (!this.currentAnimation || this.currentAnimation !== 'idle') {
        this.switchAnimation('idle');
      }
    }
  }
  
  switchAnimation(type) {
    if (!this.playerAnimations) return;
    
    if (this.currentAnimation) {
      const current = this.playerAnimations[`RobotArmature|${this.currentAnimation === 'run' ? 'Run' : 'Idle'}`];
      if (current) current.fadeOut(0.2);
    }
    
    const next = this.playerAnimations[`RobotArmature|${type === 'run' ? 'Run' : 'Idle'}`];
    if (next) {
      next.reset().fadeIn(0.2).play();
    }
    
    this.currentAnimation = type;
  }
  
  endGame() {
    this.gameState = 'gameOver';
    const timeElapsed = this.gameTime - this.currentTime;
    
    // Stop background music when game ends
    if (this.sceneManager) {
      this.sceneManager.stopBackgroundMusic();
    }
    
    this.ui.showGameOver(this.gameLogic.score, timeElapsed);
  }
}