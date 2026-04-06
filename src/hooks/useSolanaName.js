import { useState, useEffect } from 'react';
import { shortWallet } from '../lib/solana';
import { fetchUsernameByWallet } from '../lib/supabase';

const cache = {};

export const resolveSolName = async (walletAddress) => {
  if (!walletAddress) return shortWallet(walletAddress);
  if (cache[walletAddress] !== undefined) return cache[walletAddress];

  // Check for Press username first
  try {
    const username = await fetchUsernameByWallet(walletAddress);
    if (username) {
      const result = `@${username}`;
      cache[walletAddress] = result;
      return result;
    }
  } catch {}

  // Fall back to short wallet
  const result = shortWallet(walletAddress);
  cache[walletAddress] = result;
  return result;
};

export const useSolanaName = (walletAddress) => {
  const [name, setName] = useState(shortWallet(walletAddress));

  useEffect(() => {
    if (!walletAddress) return;
    if (cache[walletAddress] !== undefined) {
      setName(cache[walletAddress]);
      return;
    }
    resolveSolName(walletAddress).then(setName);
  }, [walletAddress]);

  return name;
};

// Call this to clear cache for a wallet after username update
export const clearNameCache = (walletAddress) => {
  delete cache[walletAddress];
};
