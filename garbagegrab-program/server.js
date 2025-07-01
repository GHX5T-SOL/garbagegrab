require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require('@solana/web3.js');
const bs58 = require('bs58');

const app = express();
const PORT = 3000;
const RPC_URL = 'https://rpc.gorbagana.wtf';
const PROGRAM_ID = new PublicKey('6t7gLJEudrC9JNw8ZXSnnwyMgmofdGxtQVQErA67nxhN');

// Fix CORS: Allow requests from 'http://localhost:1234' (no trailing slash)
app.use(cors({ origin: 'http://localhost:1234' }));
app.use(express.json());

// Optional: Log response headers to verify CORS settings
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log('Response headers for', req.method, req.url, ':', res.getHeaders());
  });
  next();
});

let payer;

async function loadPayerKeypair() {
  const privateKeyBase58 = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKeyBase58) {
    throw new Error('SOLANA_PRIVATE_KEY environment variable is not set');
  }
  const secretKey = bs58.decode(privateKeyBase58);
  payer = Keypair.fromSecretKey(secretKey);
  console.log('Payer Public Key:', payer.publicKey.toBase58());

  // Check payer balance on startup
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Payer Balance:', balance / 1e9, 'SOL');
  if (balance < 10000000) { // 0.01 SOL for safety
    console.warn('Warning: Payer has low balance. May not be able to cover transaction fees.');
  }
}

async function getScoreAccountPDA(playerPublicKey) {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from('score'), new PublicKey(playerPublicKey).toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

app.post('/collect-item', async (req, res) => {
  console.log('[collect-item] Received request:', req.body);
  try {
    const { increment, scoreAccountAddress, playerPublicKey } = req.body;
    console.log('[collect-item] Parsed request:', { increment, scoreAccountAddress, playerPublicKey });
    if (!increment || !scoreAccountAddress || !playerPublicKey) {
      console.warn('[collect-item] Missing fields, proceeding with defaults:', req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const connection = new Connection(RPC_URL, 'confirmed');
    const playerPubkey = new PublicKey(playerPublicKey);
    const scoreAccount = new PublicKey(scoreAccountAddress);
    const pda = await getScoreAccountPDA(playerPublicKey);
    if (!pda.equals(scoreAccount)) {
      return res.status(400).json({ error: 'Invalid score account address' });
    }

    const accountInfo = await connection.getAccountInfo(scoreAccount, 'confirmed');
    if (!accountInfo) {
      return res.status(400).json({ error: 'Score account does not exist' });
    }

    const balance = await connection.getBalance(payer.publicKey);
    console.log('Payer balance before transaction:', balance / 1e9, 'SOL');
    if (balance < 1000000) { // 0.001 SOL
      throw new Error('Insufficient funds in payer account');
    }

    const instructionData = Buffer.alloc(9);
    instructionData.writeUInt8(1, 0);
    instructionData.writeBigUInt64LE(BigInt(increment), 1);

    const transaction = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: scoreAccount, isSigner: false, isWritable: true },
          { pubkey: playerPubkey, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      })
    );
    console.log('[collect-item] Transaction accounts:', transaction.instructions[0].keys);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer.publicKey;

    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: true, // Disable preflight for debugging
      preflightCommitment: 'confirmed',
    });
    console.log('[collect-item] Transaction sent, signature:', signature);

    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );
    if (confirmation.value.err) {
      console.error('[collect-item] Transaction confirmation error:', confirmation.value.err);
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('[collect-item] Score updated for increment:', increment);
    res.json({ success: true, increment, signature });
  } catch (error) {
    console.error('[collect-item] Failed:', error);
    if (error.name === 'SendTransactionError') {
      console.error('[collect-item] Transaction logs:', error.logs);
    }
    res.status(500).json({ error: `Failed to update score: ${error.message}` });
  }
});

loadPayerKeypair().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Server failed to start:', error.message || error);
});