import React, { useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { PostCard } from '../components/PostCard';
import { WalletAvatar, WalletName } from '../components/WalletName';
import { supabase } from '../lib/supabase';
import { shortWallet } from '../lib/solana';

export const Search = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState({ posts: [], users: [], coins: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    const raw = q.trim();
    const searchTerm = raw.toLowerCase().replace('@', '').replace('$', '');

    // Detect if it looks like a Solana address (32-44 chars, base58)
    const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw);

    const [postsRes, usersRes, coinsRes, mintRes, walletRes] = await Promise.all([
      // Search posts by caption
      supabase.from('posts').select('*').ilike('caption', `%${searchTerm}%`).eq('is_active', true).order('created_at', { ascending: false }).limit(10),
      // Search users by username
      supabase.from('profiles').select('*').ilike('username', `%${searchTerm}%`).limit(10),
      // Search posts by coin ticker
      supabase.from('posts').select('*').ilike('coin_ticker', `%${searchTerm}%`).eq('is_active', true).order('amount_paid_usd', { ascending: false }).limit(10),
      // If looks like a Solana address, search by coin_mint
      isSolanaAddress ? supabase.from('posts').select('*').eq('coin_mint', raw).eq('is_active', true).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
      // If looks like a Solana address, search by wallet_address
      isSolanaAddress ? supabase.from('profiles').select('*').eq('wallet_address', raw).limit(1) : Promise.resolve({ data: [] }),
    ]);

    // Group by mint address (not ticker) to prevent vampire attacks
    const coinMints = {};
    [...(coinsRes.data || []), ...(mintRes.data || [])].forEach(p => {
      const key = p.coin_mint || p.coin_ticker;
      if (!coinMints[key]) coinMints[key] = { ticker: p.coin_ticker, mint: p.coin_mint, postCount: 0, totalPaid: 0 };
      coinMints[key].postCount++;
      coinMints[key].totalPaid += Number(p.amount_paid_usd || 0);
    });

    // Sort by total spent descending so the real coin with more spend shows first
    const sortedCoins = Object.values(coinMints).sort((a, b) => b.totalPaid - a.totalPaid);

    // Merge post results — caption matches + mint matches
    const allPosts = [...(postsRes.data || []), ...(mintRes.data || [])];
    const seenPosts = new Set();
    const dedupedPosts = allPosts.filter(p => {
      if (seenPosts.has(p.id)) return false;
      seenPosts.add(p.id);
      return true;
    });

    // Merge user results — username matches + wallet matches
    const allUsers = [...(usersRes.data || []), ...(walletRes.data || [])];
    const seenUsers = new Set();
    const dedupedUsers = allUsers.filter(u => {
      if (seenUsers.has(u.wallet_address)) return false;
      seenUsers.add(u.wallet_address);
      return true;
    });

    setResults({ posts: dedupedPosts, users: dedupedUsers, coins: sortedCoins });
    setLoading(false);
  }, []);

  // Auto-search if query comes from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, [searchParams, handleSearch]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  const hasResults = results.posts.length > 0 || results.users.length > 0 || results.coins.length > 0;

  return (
    <>
      <Header onPressClick={() => {}} />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 20px', position: 'relative', zIndex: 1 }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginBottom: '20px', textDecoration: 'none' }}>
          ← Back to The Press
        </Link>

        {/* Search box */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search posts, @usernames, $COINS..."
            autoFocus
            style={{ flex: 1, padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '15px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
          />
          <button onClick={() => handleSearch(query)} style={{ background: 'var(--accent2)', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '6px', fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            Search
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: '13px' }}>Searching...</div>}

        {!loading && searched && !hasResults && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', marginBottom: '8px' }}>No results found</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Try a different search term</div>
          </div>
        )}

        {!loading && hasResults && (
          <>
            {/* Users */}
            {results.users.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>People</div>
                {results.users.map(u => (
                  <Link key={u.wallet_address} to={`/profile/${u.wallet_address}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
                    <WalletAvatar address={u.wallet_address} size={40} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>@{u.username}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>{shortWallet(u.wallet_address)}</div>
                      {u.bio && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{u.bio}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Coins */}
            {results.coins.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Coins</div>
                {results.coins.map(c => (
                  <div key={c.mint || c.ticker} onClick={() => { setQuery(c.mint || c.ticker); handleSearch(c.mint || c.ticker); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--paper2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🪙</div>
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>${c.ticker}</div>
                        {c.mint && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', marginTop: '1px' }}>{c.mint.slice(0, 8)}...{c.mint.slice(-6)}</div>}
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{c.postCount} post{c.postCount !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--green)' }}>${c.totalPaid.toFixed(2)} total spent</div>
                  </div>
                ))}
              </div>
            )}

            {/* Posts */}
            {results.posts.length > 0 && (
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>Posts</div>
                {results.posts.map(post => <PostCard key={post.id} post={post} />)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
