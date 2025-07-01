require('dotenv').config();
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const bs58 = require('bs58');

const RPC_URL = "https://rpc.gorbagana.wtf";
const PROGRAM_ID = new PublicKey('ANY9wA2ivBJbyxVcEwVR5Xu82YuqnaFu6pqU3oP7nwYV');

async function createScoreAccount() {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Load the private key from the environment variable
    const privateKeyBase58 = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKeyBase58) {
      throw new Error('SOLANA_PRIVATE_KEY environment variable is not set');
    }
    const secretKey = bs58.decode(privateKeyBase58);
    const payer = Keypair.fromSecretKey(secretKey);

    console.log('Payer Public Key:', payer.publicKey.toBase58());
    const balance = await connection.getBalance(payer.publicKey);
    console.log('Payer Balance:', balance / 1e9, 'SOL');
    if (balance < 5000) {
      throw new Error('Insufficient funds');
    }

    // Derive the PDA for the score account
    const [pda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('score'), payer.publicKey.toBuffer()],
      PROGRAM_ID
    );
    console.log('Derived PDA for score account:', pda.toBase58());

    // Check if the account already exists
    const accountInfo = await connection.getAccountInfo(pda);
    if (accountInfo) {
      console.log('Score account already exists:', pda.toBase58());
      return;
    }

    // Calculate required space (e.g., 1 byte for score)
    const space = 1;
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    // Create the account with the PDA as the address
    const createAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      basePubkey: payer.publicKey,
      seed: 'score',
      newAccountPubkey: pda,
      lamports,
      space,
      programId: PROGRAM_ID,
    });

    // Instruction to initialize the score account
    const instructionData = Buffer.from([0]); // 0 = initialize
    const initializeIx = new TransactionInstruction({
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    // Build and send the transaction
    const transaction = new Transaction().add(createAccountIx, initializeIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    console.log(`Score account initialized to 0, Signature: ${signature}`);
  } catch (error) {
    console.error('Failed to initialize score account:', error.message || error);
    if (error.logs) {
      console.error('Transaction Logs:', error.logs);
    }
    throw error;
  }
}

createScoreAccount().catch((err) => console.error('Error in execution:', err));