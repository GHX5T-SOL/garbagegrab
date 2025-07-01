require('dotenv').config();
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require('@solana/web3.js');
const bs58 = require('bs58');

const RPC_URL = 'https://rpc.gorbagana.wtf';
const PROGRAM_ID = new PublicKey('6t7gLJEudrC9JNw8ZXSnnwyMgmofdGxtQVQErA67nxhN');

let payer; // Global payer keypair to reuse across functions

// Load payer keypair once at startup
async function loadPayerKeypair() {
  try {
    const privateKeyBase58 = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKeyBase58) {
      throw new Error('SOLANA_PRIVATE_KEY environment variable is not set');
    }
    const secretKey = bs58.decode(privateKeyBase58);
    payer = Keypair.fromSecretKey(secretKey);
    console.log('Payer Public Key:', payer.publicKey.toBase58());
  } catch (error) {
    console.error('Failed to load payer keypair:', error.message || error);
    process.exit(1);
  }
}

// Function to derive PDA for a player's score account
async function getScoreAccountPDA(payerPublicKey) {
  const [scoreAccountPDA, bump] = await PublicKey.findProgramAddress(
    [Buffer.from('score'), payerPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return scoreAccountPDA;
}

// Function to initialize the score account if it doesn't exist
async function initializeScoreAccount(scoreAccountPDA, connection) {
  const accountInfo = await connection.getAccountInfo(scoreAccountPDA);
  if (accountInfo === null) {
    console.log('Initializing score account...');
    const instructionData = Buffer.from([0]); // Instruction type 0 for initialization
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: scoreAccountPDA, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });
    const transaction = new Transaction().add(instruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer.publicKey;
    const signature = await connection.sendTransaction(transaction, [payer], { skipPreflight: true });
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    console.log(`Score account initialized: ${scoreAccountPDA.toBase58()}, Signature: ${signature}`);
  } else {
    console.log('Score account already exists:', scoreAccountPDA.toBase58());
  }
}

// Function to get the current score from the score account
async function getScore(payerPublicKey, connection) {
  const scoreAccountPDA = await getScoreAccountPDA(payerPublicKey);
  const accountInfo = await connection.getAccountInfo(scoreAccountPDA);
  if (accountInfo && accountInfo.data.length >= 41 && accountInfo.data[0] === 1) {
    const score = accountInfo.data.readBigUInt64LE(33); // Score starts at offset 33 (after 1 byte is_initialized + 32 bytes player)
    console.log(`Current score: ${score}`);
    return score;
  } else {
    console.log('Score account does not exist or is not initialized');
    return 0;
  }
}

// Function to submit the score for a collected item with retry mechanism
async function submitScore(itemType, retries = 3) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const scoreAccountPDA = await getScoreAccountPDA(payer.publicKey);

  // Ensure the score account is initialized
  await initializeScoreAccount(scoreAccountPDA, connection);

  const scores = {
    'gold_coin': 10,
    'usb_drive': 25,
    'laptop': 50
  };
  const scoreIncrement = scores[itemType];
  if (!scoreIncrement) throw new Error(`Unknown item type: ${itemType}`);

  // Prepare instruction data: 1 byte for instruction type (1 for update), 8 bytes for score increment
  const instructionData = Buffer.alloc(9);
  instructionData.writeUInt8(1, 0); // Instruction type 1 for score update
  instructionData.writeBigUInt64LE(BigInt(scoreIncrement), 1);

  // Create transaction instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: scoreAccountPDA, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payer.publicKey;

  let attempt = 0;
  while (attempt < retries) {
    try {
      const signature = await connection.sendTransaction(transaction, [payer], { skipPreflight: true });
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`Score updated: +${scoreIncrement} points for ${itemType}, Signature: ${signature}`);
      console.log(`Score account PDA: ${scoreAccountPDA.toBase58()}`);
      return signature;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message || error);
      attempt++;
      if (attempt >= retries) {
        throw new Error(`Failed to submit score after ${retries} attempts: ${error.message || error}`);
      }
    }
  }
}

// Function to collect an item and update the score
async function collectItem(itemType) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const signature = await submitScore(itemType);
    console.log(`Collected ${itemType}, signature: ${signature}`);
    await getScore(payer.publicKey, connection); // Verify the updated score
  } catch (error) {
    console.error(`Failed to submit score for ${itemType}:`, error.message || error);
  }
}

// Load payer keypair once and run example
loadPayerKeypair().then(() => {
  // Example usage: Collect a gold coin
  collectItem('gold_coin').catch(console.error);
}).catch(console.error);