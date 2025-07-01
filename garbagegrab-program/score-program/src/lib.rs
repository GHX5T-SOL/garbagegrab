use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    program::{invoke_signed},
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
    program_pack::{IsInitialized},
};

// Define the score account structure
#[derive(Clone, Copy, Debug)]
pub struct ScoreAccount {
    pub is_initialized: bool,
    pub player: Pubkey,
    pub score: u64,
}

impl ScoreAccount {
    pub const LEN: usize = 1 + 32 + 8; // 1 byte is_initialized, 32 bytes player pubkey, 8 bytes score
}

impl IsInitialized for ScoreAccount {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

// Maximum allowed score as a constant for readability and maintainability
const MAX_SCORE: u64 = 1_000_000;

// Define the entrypoint
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let score_account = next_account_info(accounts_iter)?;
    let player = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    // Derive the Program-Derived Address (PDA) using "score" seed and player's public key
    let (pda, bump) = Pubkey::find_program_address(&[b"score", player.key.as_ref()], program_id);
    if pda != *score_account.key {
        msg!("Invalid score account PDA: expected {}, found {}", pda, score_account.key);
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the account is already initialized with an immutable borrow
    let is_initialized = {
        let data = score_account.try_borrow_data()?;
        data.len() == ScoreAccount::LEN && data[0] == 1
    };

    // Process instructions based on the first byte of instruction_data
    match instruction_data[0] {
        0 => {
            // Instruction 0: Initialize the score account
            if is_initialized {
                msg!("Account already initialized");
                return Err(ProgramError::AccountAlreadyInitialized);
            }

            // Calculate space and lamports required for the account
            let space = ScoreAccount::LEN;
            let lamports = Rent::get()?.minimum_balance(space);

            // Create the account using the system program
            let create_account_ix = system_instruction::create_account(
                player.key,
                score_account.key,
                lamports,
                space as u64,
                program_id,
            );

            // Invoke the create account instruction with PDA seeds
            invoke_signed(
                &create_account_ix,
                &[player.clone(), score_account.clone(), system_program.clone()],
                &[&[b"score", player.key.as_ref(), &[bump]]],
            )?;

            // Now, borrow the account data mutably to initialize it
            let mut score_data = score_account.try_borrow_mut_data()?;
            score_data[0] = 1; // Set is_initialized to true
            score_data[1..33].copy_from_slice(player.key.as_ref()); // Store player pubkey
            score_data[33..41].copy_from_slice(&0u64.to_le_bytes()); // Set initial score to 0
            msg!("Score account initialized for player: {}", player.key);
        }
        1 => {
            // Instruction 1: Update the score by adding an increment
            if !is_initialized {
                msg!("Account not initialized");
                return Err(ProgramError::UninitializedAccount);
            }

            // Borrow the account data mutably for updates
            let mut score_data = score_account.try_borrow_mut_data()?;

            // Read the current score from the account data
            let current_score = u64::from_le_bytes(score_data[33..41].try_into().unwrap());

            // Check if the current score exceeds the maximum allowed value
            if current_score > MAX_SCORE {
                msg!("Score too large: {}", current_score);
                return Err(ProgramError::InvalidAccountData);
            }

            // Validate instruction data length (1 byte instruction + 8 bytes increment)
            if instruction_data.len() < 9 {
                msg!("Invalid instruction data: expected at least 9 bytes");
                return Err(ProgramError::InvalidInstructionData);
            }

            // Read the increment from instruction data
            let increment = u64::from_le_bytes(instruction_data[1..9].try_into().unwrap());

            // Safely add increment to current score, checking for overflow
            let new_score = current_score
                .checked_add(increment)
                .ok_or(ProgramError::InvalidAccountData)?;

            // Update the score in the account data
            score_data[33..41].copy_from_slice(&new_score.to_le_bytes());
            msg!("Score updated for player {}: {} -> {}", player.key, current_score, new_score);
        }
        _ => {
            // Handle invalid instructions
            msg!("Invalid instruction: {}", instruction_data[0]);
            return Err(ProgramError::InvalidInstructionData);
        }
    }

    Ok(())
}