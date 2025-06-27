/**
 * Garbage Grab - Main Entry Point
 * 
 * This is the main JavaScript file that initializes the entire game.
 * It sets up the game instance, handles DOM events, and manages the
 * game lifecycle (start, restart, cleanup).
 * 
 * Dependencies:
 * - Three.js: 3D graphics engine
 * - ./rosieControls.js: Player input and camera controls
 * - ./game.js: Core game logic and state management
 * 
 * Usage:
 * This file is loaded as a module in index.html and automatically
 * initializes the game when the DOM is ready.
 */
import * as THREE from 'three';
import { PlayerController, ThirdPersonCameraController } from './rosieControls.js';
import { Game } from './game.js';
// Global game instance - maintains the current game state
let game = null;
/**
 * Global function to start the game
 * Called from the start screen UI button
 * Hides the start screen and begins gameplay
 */
window.startGame = function() {
  console.log('Starting new game...');
  document.getElementById('startScreen').style.display = 'none';
  if (game) {
    game.start();
  }
};
/**
 * Global function to restart the game
 * Called from the game over screen UI button
 * Resets game state and begins a new session
 */
window.restartGame = function() {
  console.log('Restarting game...');
  document.getElementById('gameOverScreen').style.display = 'none';
  if (game) {
    game.restart();
  }
};
/**
 * Initialize the game instance
 * Creates the main Game object and sets up the render container
 * This function is called once when the page loads
 */
function init() {
  console.log('Initializing Garbage Grab game...');
  
  // Get the main game container element
  const container = document.getElementById('gameContainer');
  if (!container) {
    console.error('Game container not found! Make sure index.html has a #gameContainer element.');
    return;
  }
  
  // Create the main game instance
  try {
    game = new Game(container);
    console.log('Game initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize game:', error);
    // Could show an error message to the user here
  }
}
/**
 * Application startup
 * Waits for DOM to be ready before initializing the game
 * Supports both synchronous and asynchronous loading
 */
if (document.readyState === 'loading') {
  // DOM is still loading, wait for it
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM is already loaded, initialize immediately
  init();
}
/**
 * Handle page unload/refresh
 * Clean up resources when the user leaves the page
 */
window.addEventListener('beforeunload', () => {
  if (game) {
    console.log('Cleaning up game resources...');
    // The game's cleanup method will handle resource disposal
  }
});
/**
 * Handle visibility changes (tab switching, minimizing)
 * Pause/resume game when tab becomes inactive/active
 */
document.addEventListener('visibilitychange', () => {
  if (game) {
    if (document.hidden) {
      console.log('Game paused (tab hidden)');
      // Could pause background music or reduce update frequency
    } else {
      console.log('Game resumed (tab visible)');
      // Resume normal operation
    }
  }
});