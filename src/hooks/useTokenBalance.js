// ============================================================
// THE PRESS — useTokenBalance Hook
// Fetches user's SPL token balance for a given coin
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getTokenBalance, getCoinMint } from '../lib/solana';

export const useTokenBalance = (coin) => {
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey || !coin) return;
    setLoading(true);
    try {
      const mintAddress = getCoinMint(coin);
      const bal = await getTokenBalance(new PublicKey(publicKey), mintAddress);
      setBalance(bal);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [publicKey, coin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
};
