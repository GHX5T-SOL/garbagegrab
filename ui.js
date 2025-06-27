export class UI {
  constructor() {
    this.initElements();
    this.setupBlockchainIntegration();
  }
  
  initElements() {
    this.healthFill = document.getElementById('healthFill');
    this.healthText = document.getElementById('healthText');
    this.timerText = document.getElementById('timerText');
    this.scoreText = document.getElementById('scoreText');
    this.leaderboardContent = document.getElementById('leaderboardContent');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.finalScore = document.getElementById('finalScore');
    this.timeSurvived = document.getElementById('timeSurvived');
    
    // Blockchain elements
    this.connectWalletBtn = document.getElementById('connectWalletBtn');
    this.walletStatus = document.getElementById('walletStatus');
    this.walletAddress = document.getElementById('walletAddress');
  }
  
  setupBlockchainIntegration() {
    this.isWalletConnected = false;
    this.playerName = 'Player';
    
    // Placeholder wallet addresses for AI opponents
    this.aiWalletAddresses = [
      'GhXsT..cGD2',
      'hGWh3..ghG6'
    ];
    
    this.connectWalletBtn.addEventListener('click', () => {
      this.connectWallet();
    });
  }
  
  connectWallet() {
    if (this.isWalletConnected) return;
    
    // Simulate wallet connection
    console.log('Wallet connected');
    this.isWalletConnected = true;
    this.playerName = 'Ghxst.gor';
    
    // Update UI
    this.connectWalletBtn.textContent = 'WALLET CONNECTED';
    this.connectWalletBtn.style.background = 'linear-gradient(45deg, #00ff00, #00aa00)';
    this.connectWalletBtn.disabled = true;
    
    this.walletAddress.textContent = 'Ghxst..gor';
    this.walletStatus.style.display = 'block';
  }
  
  updateHealth(health) {
    const percentage = Math.max(0, health);
    this.healthFill.style.width = percentage + '%';
    this.healthText.textContent = `${Math.round(health)}/100`;
    
    // Change color based on health
    if (health > 60) {
      this.healthFill.style.background = 'linear-gradient(90deg, #00ff00, #88ff00)';
    } else if (health > 30) {
      this.healthFill.style.background = 'linear-gradient(90deg, #ffff00, #ff8800)';
    } else {
      this.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4400)';
    }
  }
  
  updateTimer(timeRemaining) {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    this.timerText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Change color when time is running out
    if (timeRemaining < 60) {
      this.timerText.style.color = '#ff0000';
      this.timerText.style.animation = 'pulse 1s infinite';
    } else if (timeRemaining < 120) {
      this.timerText.style.color = '#ffff00';
    } else {
      this.timerText.style.color = '#ff00ff';
      this.timerText.style.animation = 'none';
    }
  }
  
  updateScore(score) {
    this.scoreText.textContent = score.toString();
  }
  
  updateLeaderboard(leaderboard) {
    this.leaderboardContent.innerHTML = '';
    
    leaderboard.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = `leaderboard-item rank-${index + 1}`;
      
      const rank = index + 1;
      const rankText = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      
      // Display player name or wallet address
      let displayName = player.name;
      if (player.name === 'Player') {
        displayName = this.playerName;
      } else if (player.name.startsWith('TrashBot_')) {
        const botIndex = parseInt(player.name.split('_')[1]) - 1;
        displayName = this.aiWalletAddresses[botIndex] || player.name;
      }
      
      item.innerHTML = `
        <span>${rankText} ${displayName}</span>
        <span>${player.score}</span>
      `;
      
      this.leaderboardContent.appendChild(item);
    });
  }
  
  showGameOver(finalScore, timeElapsed) {
    this.finalScore.textContent = finalScore;
    
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = Math.floor(timeElapsed % 60);
    this.timeSurvived.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    this.gameOverScreen.style.display = 'block';
  }
}

// Add pulse animation to CSS
const addPulseAnimationCSS = () => {
  if (!document.querySelector('#pulseAnimation')) {
    const style = document.createElement('style');
    style.id = 'pulseAnimation';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
};
// Initialize CSS when UI is created
addPulseAnimationCSS();