// ============================================================
// THE PRESS — useCoinPrices Hook
// Pulls recently used coins from posts, fetches live prices
// from DexScreener (covers all pump.fun tokens)
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useCoinPrices = () => {
  const [prices, setPrices] = useState({});
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPrices = async () => {
    try {
     // Get top coins by ad spend in last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: posts } = await supabase
        .from('posts')
        .select('coin_ticker, coin_mint, amount_paid_usd')
        .eq('is_active', true)
        .gte('created_at', since)
        .limit(100);

      if (!posts || posts.length === 0) return;

      // Deduplicate by mint address
      const seen = new Set();
      const uniqueCoins = [];
      posts.forEach(p => {
        if (p.coin_mint && !seen.has(p.coin_mint)) {
          seen.add(p.coin_mint);
          uniqueCoins.push({ ticker: p.coin_ticker, mint: p.coin_mint, spent: Number(p.amount_paid_usd || 0) });
        }
      });

      // Take up to 10 most recent unique coins
      // Sort by total spend descending, take top 10
      const spendMap = {};
      posts.forEach(p => {
        const key = p.coin_mint;
        if (!spendMap[key]) spendMap[key] = { ticker: p.coin_ticker, mint: p.coin_mint, totalSpent: 0 };
        spendMap[key].totalSpent += Number(p.amount_paid_usd || 0);
      });
      const topCoins = Object.values(spendMap)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // Fetch prices from DexScreener for all mints at once
      const mints = topCoins.map(c => c.mint).join(',');
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
      if (!res.ok) return;
      const data = await res.json();

      // Build price map by mint address
      const priceMap = {};
      const validCoins = [];

      topCoins.forEach(coin => {
        // Find the pair with the highest liquidity for this mint
        const pairs = (data.pairs || []).filter(p =>
          p.baseToken?.address?.toLowerCase() === coin.mint.toLowerCase()
        );

        if (pairs.length > 0) {
          // Sort by liquidity and take the best pair
          const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          const price = parseFloat(best.priceUsd) || 0;
          const change = parseFloat(best.priceChange?.h24) || 0;

          if (price > 0) {
            priceMap[coin.mint] = {
              ticker: coin.ticker,
              usd: price,
              change24h: change,
            };
            validCoins.push(coin);
          }
        }
      });

      setPrices(priceMap);
      setCoins(validCoins.filter(c => priceMap[c.mint]));
    } catch (err) {
      console.error('Price fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  return { prices, coins, loading };
};
