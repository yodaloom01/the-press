// ============================================================
// THE PRESS — useProfile Hook
// Fetches and caches profile data (username + avatar) per wallet
// ============================================================

import { useState, useEffect } from 'react';
import { fetchProfile } from '../lib/supabase';
import { shortWallet } from '../lib/solana';

const profileCache = {};

export const useProfile = (walletAddress) => {
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState(shortWallet(walletAddress));

  useEffect(() => {
    if (!walletAddress) return;

    if (profileCache[walletAddress]) {
      setProfile(profileCache[walletAddress]);
      setDisplayName(profileCache[walletAddress].username ? `@${profileCache[walletAddress].username}` : shortWallet(walletAddress));
      return;
    }

    fetchProfile(walletAddress).then(data => {
      profileCache[walletAddress] = data || {};
      setProfile(data);
      setDisplayName(data?.username ? `@${data.username}` : shortWallet(walletAddress));
    });
  }, [walletAddress]);

  return { profile, displayName };
};

export const clearProfileCache = (walletAddress) => {
  delete profileCache[walletAddress];
};
