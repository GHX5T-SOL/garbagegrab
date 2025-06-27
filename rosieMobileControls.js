/**
 * Mobile Controls - Handles all mobile-specific input and UI
 * Works by simulating keyboard/mouse events to integrate with existing desktop controls
 */

/**
 * Utility functions for mobile detection and UI management
 */
const MobileUtils = {
  isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },
  createMobileUI() {
    const container = document.createElement('div');
    container.id = 'mobile-game-controls';
    container.style.cssText = `
      position: fixed; width: 100%; height: 100%;
      pointer-events: none; z-index: 1000;
    `;
    const joystickContainer = document.createElement('div');
    joystickContainer.id = 'virtual-joystick';
    joystickContainer.style.cssText = `
      position: absolute; bottom: 20px; left: 20px;
      width: 100px; height: 100px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%; pointer-events: auto;
    `;
    const joystickKnob = document.createElement('div');
    joystickKnob.id = 'virtual-joystick-knob';
    joystickKnob.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      width: 30px; height: 30px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 50%; transform: translate(-50%, -50%);
    `;
    joystickContainer.appendChild(joystickKnob);
    const jumpButton = document.createElement('div');
    jumpButton.id = 'jump-button';
    jumpButton.style.cssText = `
      position: absolute; bottom: 20px; right: 20px;
      width: 60px; height: 60px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%; pointer-events: auto;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 12px;
    `;
    jumpButton.textContent = 'JUMP';
    container.appendChild(joystickContainer);
    container.appendChild(jumpButton);
    return { container, joystickContainer, joystickKnob, jumpButton };
  },

  removeMobileUI() {
    const existing = document.getElementById('mobile-game-controls');
    if (existing) {
      existing.remove();
    }
  }
};

/**
 * VirtualJoystick - Handles virtual joystick input for mobile
 */
class VirtualJoystick {
  constructor(container, knob, onInputChange) {
    this.container = container;
    this.knob = knob;
    this.onInputChange = onInputChange;
    this.isActive = false;
    this.maxDistance = 35;
    this.currentPos = { x: 0, y: 0 };
    
    this.setupEvents();
  }
  setupEvents() {
    this.container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isActive = true;
    });
    this.container.addEventListener('touchmove', (e) => {
      if (!this.isActive) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const rect = this.container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = touch.clientX - centerX;
      const deltaY = touch.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance <= this.maxDistance) {
        this.knob.style.transform = `translate(${deltaX - 15}px, ${deltaY - 15}px)`;
        this.currentPos.x = deltaX / this.maxDistance;
        this.currentPos.y = deltaY / this.maxDistance;
      } else {
        const angle = Math.atan2(deltaY, deltaX);
        const limitedX = Math.cos(angle) * this.maxDistance;
        const limitedY = Math.sin(angle) * this.maxDistance;
        
        this.knob.style.transform = `translate(${limitedX - 15}px, ${limitedY - 15}px)`;
        this.currentPos.x = limitedX / this.maxDistance;
        this.currentPos.y = limitedY / this.maxDistance;
      }
      
      this.onInputChange({
        x: this.currentPos.x,
        y: -this.currentPos.y
      });
    });
    this.container.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isActive = false;
      this.knob.style.transform = 'translate(-15px, -15px)';
      this.currentPos = { x: 0, y: 0 };
      this.onInputChange({ x: 0, y: 0 });
    });
  }
}

/**
 * MobileControls - Handles mobile player movement controls only
 */
class MobileControls {
  constructor(controller) {
    this.controller = controller;
    this.isMobile = MobileUtils.isMobile();
    
    // Only initialize on mobile devices and for player controllers
    if (!this.isMobile) {
      return;
    }

    this.mobileUI = null;
    this.virtualJoystick = null;
    this.currentInput = { x: 0, y: 0 };

    this.setupPlayerControls();
  }

  setupPlayerControls() {
    // Create mobile UI
    this.mobileUI = MobileUtils.createMobileUI();
    document.body.appendChild(this.mobileUI.container);

    // Setup virtual joystick
    this.virtualJoystick = new VirtualJoystick(
      this.mobileUI.joystickContainer,
      this.mobileUI.joystickKnob,
      (input) => this.handleJoystickInput(input)
    );

    // Setup jump button
    this.setupJumpButton();
  }

  setupJumpButton() {
    this.mobileUI.jumpButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.controller.keys['Space'] = true;
      this.mobileUI.jumpButton.style.background = 'rgba(255, 255, 255, 0.5)';
    });
    
    this.mobileUI.jumpButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.controller.keys['Space'] = false;
      this.mobileUI.jumpButton.style.background = 'rgba(255, 255, 255, 0.3)';
    });
  }

  handleJoystickInput(input) {
    this.currentInput = input;
    
    // Clear all movement keys first
    this.controller.keys['KeyW'] = false;
    this.controller.keys['KeyS'] = false;
    this.controller.keys['KeyA'] = false;
    this.controller.keys['KeyD'] = false;

    // Set keys based on joystick input (with deadzone)
    const deadzone = 0.1;
    
    if (Math.abs(input.y) > deadzone) {
      if (input.y > 0) {
        this.controller.keys['KeyW'] = true; // Forward
      } else {
        this.controller.keys['KeyS'] = true; // Backward
      }
    }
    
    if (Math.abs(input.x) > deadzone) {
      if (input.x > 0) {
        this.controller.keys['KeyD'] = true; // Right
      } else {
        this.controller.keys['KeyA'] = true; // Left
      }
    }
  }

  destroy() {
    if (!this.isMobile) return;
    
    // Remove the mobile UI
    MobileUtils.removeMobileUI();
  }
}

export { MobileControls };