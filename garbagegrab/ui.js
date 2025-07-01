import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

export class UI {
  constructor() {
    this.initElements();
    this.setupBlockchainIntegration();
    this.wallet = null; // Initialize wallet
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
    this.isScoreInitialized = false;
    this.playerName = 'Player';
    this.playerPublicKey = null;
    this.playerPDA = null;
    this.connection = new Connection('https://rpc.gorbagana.wtf', 'confirmed');
    this.programId = new PublicKey('6t7gLJEudrC9JNw8ZXSnnwyMgmofdGxtQVQErA67nxhN');

    // Placeholder wallet addresses for AI opponents
    this.aiWalletAddresses = ['GhXsT..cGD2', 'hGWh3..ghG6'];

    this.connectWalletBtn.addEventListener('click', () => this.connectWallet());
    this.checkExistingWalletConnection();

    // Start leaderboard updates after initialization
    setInterval(() => this.updateLeaderboardFromChain(), 2000);

    console.log('Blockchain integration initialized with RPC: https://rpc.gorbagana.wtf');
  }

  async checkExistingWalletConnection() {
    const wallets = [
      { name: 'Backpack', wallet: window.backpack },
      { name: 'Phantom', wallet: window.phantom?.solana },
      { name: 'Solana', wallet: window.solana },
    ];

    for (const { name, wallet } of wallets) {
      if (wallet) {
        try {
          const response = await wallet.connect({ onlyIfTrusted: true });
          const publicKey = new PublicKey(response.publicKey.toString());
          console.log(`Auto-connected to ${name}:`, publicKey.toBase58());
          await this.handleWalletConnected(publicKey, wallet);
          return;
        } catch (error) {
          console.log(`${name} not auto-connectable:`, error.message);
        }
      }
    }
    console.log('No wallet auto-connectable.');
  }

  async connectWallet() {
    if (this.isWalletConnected) {
      console.log('Wallet already connected:', this.playerName);
      return;
    }

    const wallets = [
      { name: 'Backpack', wallet: window.backpack },
      { name: 'Phantom', wallet: window.phantom?.solana },
      { name: 'Solana', wallet: window.solana },
    ];

    for (const { name, wallet } of wallets) {
      if (wallet) {
        try {
          const response = await wallet.connect();
          const publicKey = new PublicKey(response.publicKey.toString());
          console.log(`Connected to ${name}:`, publicKey.toBase58());
          await this.handleWalletConnected(publicKey, wallet);
          return;
        } catch (error) {
          console.error(`Failed to connect to ${name}:`, error.message || error);
        }
      }
    }
    console.log('No Solana wallet detected.');
    this.showError('Please install a Solana wallet extension like Backpack or Phantom.');
  }

  async handleWalletConnected(publicKey, wallet) {
    this.isWalletConnected = true;
    this.playerPublicKey = publicKey;
    this.wallet = wallet;
    this.playerName = publicKey.toBase58().slice(0, 6) + '...' + publicKey.toBase58().slice(-4);
    this.updateWalletUI();

    // Pass the connected wallet to the Game instance
    if (window.game && wallet) {
      window.game.updateWallet(wallet);
      console.log('Wallet passed to Game instance:', publicKey.toBase58());
    } else {
      console.error('Game instance or wallet not found. Ensure the game is initialized and the wallet is connected.');
    }

    // Derive PDA
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('score'), this.playerPublicKey.toBuffer()],
      this.programId
    );
    this.playerPDA = pda;
    console.log('Player PDA derived:', pda.toBase58());

    // Check and initialize score account
    await this.initializeScoreAccount();
  }

  async initializeScoreAccount() {
    if (!this.wallet || !this.wallet.publicKey) {
      console.error('Wallet not connected');
      this.showError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    const accountInfo = await this.connection.getAccountInfo(this.playerPDA);
    if (accountInfo) {
      this.isScoreInitialized = true;
      console.log('Score account already exists:', this.playerPDA.toBase58());
      return;
    }

    console.log('Score account not found, initializing...');
    const balance = await this.connection.getBalance(this.playerPublicKey);
    console.log('Player wallet balance:', balance / 1e9, 'SOL');
    if (balance < 10000000) { // 0.01 SOL
      console.warn('Insufficient player wallet balance for account initialization (< 0.01 SOL)');
      this.showError('Insufficient funds to initialize score account. Please fund your wallet.');
      return;
    }

    try {
      const instructionData = Buffer.from([0]); // Instruction type 0 for initialization
      const transaction = new Transaction().add(
        new TransactionInstruction({
          keys: [
            { pubkey: this.playerPDA, isSigner: false, isWritable: true },
            { pubkey: this.playerPublicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: this.programId,
          data: instructionData,
        })
      );

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = this.playerPublicKey;

      // Sign and send transaction
      const signedTransaction = await this.wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('Initialization transaction sent, signature:', signature);
      await this.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      this.isScoreInitialized = true;
      console.log('Score account initialized:', this.playerPDA.toBase58());
    } catch (error) {
      console.error('Failed to initialize score account:', error);
      if (error.name === 'SendTransactionError' && error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      this.showError(`Failed to initialize score account: ${error.message}`);
    }
  }

  updateWalletUI() {
    this.connectWalletBtn.textContent = 'WALLET CONNECTED';
    this.connectWalletBtn.style.background = 'linear-gradient(45deg, #00ff00, #00aa00)';
    this.connectWalletBtn.disabled = true;
    this.walletAddress.textContent = this.playerName;
    this.walletStatus.style.display = 'block';
  }

  showError(message) {
    alert(message); // Replace with a custom UI element (e.g., modal) for better UX
  }

  updateHealth(health) {
    const percentage = Math.max(0, health);
    this.healthFill.style.width = percentage + '%';
    this.healthText.textContent = `${Math.round(health)}/100`;

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

  async updateLeaderboardFromChain() {
    if (!this.isScoreInitialized) return;

    const leaderboard = [];

    // Player score
    const playerAccountInfo = await this.connection.getAccountInfo(this.playerPDA);
    const playerScore = playerAccountInfo ? Number(playerAccountInfo.data.readBigUInt64LE(33)) : 0;
    leaderboard.push({ name: 'Player', score: playerScore });

    // AI scores (placeholder PDAs)
    for (let i = 0; i < this.aiWalletAddresses.length; i++) {
      const [aiPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('score'), Buffer.from(`ai_${i}`)],
        this.programId
      );
      const aiAccountInfo = await this.connection.getAccountInfo(aiPDA);
      const aiScore = aiAccountInfo ? Number(aiAccountInfo.data.readBigUInt64LE(33)) : 0;
      leaderboard.push({ name: `TrashBot_${i + 1}`, score: aiScore });
    }

    this.updateLeaderboard(leaderboard);
  }

  updateLeaderboard(leaderboard) {
    this.leaderboardContent.innerHTML = '';

    leaderboard.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = `leaderboard-item rank-${index + 1}`;

      const rank = index + 1;
      const rankText = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

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
addPulseAnimationCSS();