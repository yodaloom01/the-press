// ============================================================
// THE PRESS — Solana Utilities
// Handles SPL token transfers, coin registry, reach calculation
// ============================================================
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getMint,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// ── Network ──────────────────────────────────────────────────
export const NETWORK = process.env.REACT_APP_SOLANA_NETWORK || 'devnet';
export const RPC_ENDPOINT =
  process.env.REACT_APP_RPC_ENDPOINT || clusterApiUrl(NETWORK);

export const getConnection = () => new Connection(RPC_ENDPOINT, 'confirmed');

// ── Platform wallet (receives payments) ──────────────────────
export const PLATFORM_WALLET = new PublicKey(
  process.env.REACT_APP_PLATFORM_WALLET ||
    '11111111111111111111111111111111' // placeholder
);

// ── SPL Memecoins on Solana ───────────────────────────────────
// Mainnet mint addresses for popular SPL memecoins
export const SUPPORTED_COINS = [
  {
    ticker: 'BONK',
    name: 'Bonk',
    emoji: '🐕',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // mainnet
    devnetMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // devnet placeholder
    decimals: 5,
    coingeckoId: 'bonk',
  },
  {
    ticker: 'WIF',
    name: 'dogwifhat',
    emoji: '🐶',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // mainnet
    devnetMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 6,
    coingeckoId: 'dogwifcoin',
  },
  {
    ticker: 'PEPE',
    name: 'Pepe',
    emoji: '🐸',
    mint: 'F5HpMFAdVWiuuiPwPek5Dh9SEM4AQLB2bkuKnEkM9hx', // mainnet
    devnetMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 6,
    coingeckoId: 'pepe',
  },
  {
    ticker: 'POPCAT',
    name: 'Popcat',
    emoji: '😺',
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // mainnet
    devnetMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 9,
    coingeckoId: 'popcat',
  },
  {
    ticker: 'BOME',
    name: 'Book of Meme',
    emoji: '📖',
    mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', // mainnet
    devnetMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 6,
    coingeckoId: 'book-of-meme',
  },
  {
    ticker: 'MOODENG',
    name: 'Moo Deng',
    emoji: '🦛',
    mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY', // mainnet
    devnetMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    decimals: 6,
    coingeckoId: 'moo-deng',
  },
];

export const getCoinByTicker = (ticker) =>
  SUPPORTED_COINS.find((c) => c.ticker === ticker);

export const getCoinMint = (coin) =>
  NETWORK === 'mainnet-beta' ? coin.mint : coin.devnetMint;

// ── Reach Calculation ─────────────────────────────────────────
// Base multiplier: $1 USD = 100,000 reach
// Logarithmic scaling so large spends don't break UI
export const calculateReach = (amountTokens, priceUsd) => {
  const usdValue = amountTokens * priceUsd;
  if (usdValue <= 0) return 0;
  const base = 100000;
  const reach = Math.round(base * usdValue * (1 + Math.log10(usdValue + 1)));
  return reach;
};

export const formatReach = (reach) => {
  if (reach >= 1_000_000) return `${(reach / 1_000_000).toFixed(1)}M`;
  if (reach >= 1_000) return `${(reach / 1_000).toFixed(1)}K`;
  return reach.toString();
};

export const getReachTier = (usdValue) => {
  if (usdValue >= 10000) return { label: '🚨 Pizza Tier — LEGENDARY', color: '#c8a84b' };
  if (usdValue >= 1000) return { label: '🔥 Viral Tier', color: '#ff6b35' };
  if (usdValue >= 100) return { label: '📡 National Reach', color: '#4fffb0' };
  if (usdValue >= 10) return { label: '🏙 City Reach', color: '#87ceeb' };
  if (usdValue >= 1) return { label: '🏘 Local Reach', color: '#aaa' };
  return { label: '🌱 Micro — OG Supporter', color: '#888' };
};

// ── Token Balance ─────────────────────────────────────────────
export const getTokenBalance = async (walletPublicKey, mintAddress) => {
  try {
    const connection = getConnection();
    const mint = new PublicKey(mintAddress);
    const ata = await getAssociatedTokenAddress(mint, walletPublicKey);
    const account = await getAccount(connection, ata);
    const mintInfo = await getMint(connection, mint);
    return Number(account.amount) / Math.pow(10, mintInfo.decimals);
  } catch {
    return 0;
  }
};

// ── SPL Token Transfer ────────────────────────────────────────
// Transfers SPL tokens from user wallet → platform wallet
// Returns the transaction signature
export const transferSplToken = async (
  walletPublicKey,
  sendTransaction,
  coin,
  amount
) => {
  try {
    const connection = getConnection();
    const mintAddress = new PublicKey(coin.mint);
    
    const mintAccountInfo = await connection.getAccountInfo(mintAddress);
    const tokenProgramId = mintAccountInfo.owner;
    
    console.log('Token Program:', tokenProgramId.toBase58());
    
    const decimals = coin.decimals || 6;
    const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

    const fromAta = await getAssociatedTokenAddress(
      mintAddress, walletPublicKey, false, tokenProgramId
    );
    const toAta = await getAssociatedTokenAddress(
      mintAddress, PLATFORM_WALLET, false, tokenProgramId
    );

    console.log('FROM:', fromAta.toBase58());
    console.log('TO:', toAta.toBase58());
    console.log('AMOUNT:', rawAmount.toString());
    console.log('DECIMALS:', decimals);

    const transaction = new Transaction();

    try {
      await getAccount(connection, toAta, 'confirmed', tokenProgramId);
      console.log('Platform ATA exists');
    } catch {
      console.log('Creating platform ATA...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPublicKey,
          toAta,
          PLATFORM_WALLET,
          mintAddress,
          tokenProgramId
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        fromAta,
        toAta,
        walletPublicKey,
        rawAmount,
        [],
        tokenProgramId
      )
    );

   const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;

  const signature = await sendTransaction(transaction, connection, { 
    skipPreflight: true,
    preflightCommitment: 'finalized',
  });    

    console.log('Signature:', signature);
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return signature;
  } catch (err) {
    console.error('FULL ERROR:', err);
    console.error('MESSAGE:', err.message);
    throw err;
  }
};
  
// ── Shorten wallet address ────────────────────────────────────
export const shortWallet = (address) =>
  address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';

// ── Format token amounts ──────────────────────────────────────
export const formatAmount = (n) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
};
