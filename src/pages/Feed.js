// ============================================================
// THE PRESS — Feed Page
// Main page: sidebar, post feed, trending panel
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { PostCard } from '../components/PostCard';
import { PressModal } from '../components/PressModal';
import { fetchPosts, subscribeToNewPosts, fetchFollowingPosts, supabase, getTotalUsers } from '../lib/supabase';
import { shortWallet } from '../lib/solana';
import { useCoinPrices } from '../hooks/useCoinPrices';

const TreasuryBalance = () => {
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletValue = async () => {
      try {
        const rpc = 'https://mainnet.helius-rpc.com/?api-key=56557c79-1e29-43da-a73f-1b8f58e3140a';
        
        // Get all token accounts for platform wallet
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'treasury',
            method: 'getTokenAccountsByOwner',
            params: [
              '3be48KfHNFmQwn9DQqfYYDhXPrs5xQVzgF9sNW6YQYzx',
              { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { encoding: 'jsonParsed' }
            ]
          })
        });

        const data = await res.json();
        const accounts = data?.result?.value || [];

        // Get all mint addresses and amounts
        const tokens = accounts
          .map(a => ({
            mint: a.account.data.parsed.info.mint,
            amount: Number(a.account.data.parsed.info.tokenAmount.uiAmount) || 0
          }))
          .filter(t => t.amount > 0);

        if (tokens.length === 0) { setTotal(0); setLoading(false); return; }

        // Fetch prices from DexScreener
        const mints = tokens.map(t => t.mint).join(',');
        const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
        const priceData = await priceRes.json();

        // Build price map
        const priceMap = {};
        (priceData.pairs || []).forEach(pair => {
          const mint = pair.baseToken?.address;
          if (mint && !priceMap[mint]) {
            priceMap[mint] = parseFloat(pair.priceUsd) || 0;
          }
        });

        // Calculate total USD value
        const totalValue = tokens.reduce((sum, t) => {
          const price = priceMap[t.mint] || 0;
          return sum + (t.amount * price);
        }, 0);

        setTotal(totalValue);
      } catch (err) {
        console.error('Treasury fetch error:', err);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletValue();
    const interval = setInterval(fetchWalletValue, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatted = total === null ? '...' : total >= 1000000
    ? `$${(total / 1000000).toFixed(2)}M`
    : total >= 1000
    ? `$${(total / 1000).toFixed(2)}K`
    : `$${total?.toFixed(2)}`;

  return (
    <div style={{ marginTop: '20px', padding: '16px 14px', background: '#080814', borderRadius: '6px', border: '1px solid #1e1e40', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#00ffff', opacity: 0.6 }} />
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>
        Treasury
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '38px', fontWeight: 900, color: loading ? '#333355' : '#00ff88', letterSpacing: '-1px', lineHeight: 1, marginBottom: '6px', transition: 'color 0.5s' }}>
        {loading ? '...' : formatted}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#333355', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Live wallet value
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#c8a84b', opacity: 0.3 }} />
    </div>
  );
};

const UserCount = () => {
  const [total, setTotal] = useState(null);

  useEffect(() => {
    getTotalUsers().then(setTotal);
    const interval = setInterval(() => getTotalUsers().then(setTotal), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ marginTop: '10px', padding: '12px 14px', background: '#080814', borderRadius: '6px', border: '1px solid #1e1e40', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#9944ff', opacity: 0.6 }} />
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#ffffff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
        Total Users
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 900, color: '#9944ff', letterSpacing: '-1px', lineHeight: 1 }}>
        {total === null ? '...' : total.toLocaleString()}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#9944ff', opacity: 0.2 }} />
    </div>
  );
};

const SORT_OPTIONS = [
  { key: 'weighted', label: '⭐ For You' },
  { key: 'following', label: '👥 Following' },
  { key: 'trending', label: '🔥 Trending' },
  { key: 'created_at', label: 'New' },
  { key: 'amount_paid_usd', label: '💸 Most Expensive' },
];

export const Feed = () => {
  const { publicKey } = useWallet();
  const { prices, coins } = useCoinPrices();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [showModal, setShowModal] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (sort === 'following' && publicKey) {
        data = await fetchFollowingPosts(publicKey.toBase58());
      } else {
        data = await fetchPosts(sort);
      }
      setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sort, publicKey]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Real-time new posts
  useEffect(() => {
    const unsub = subscribeToNewPosts((newPost) => {
      setPosts((prev) => [newPost, ...prev]);
    });
    return unsub;
  }, []);

  const handlePostSuccess = (post) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleLike = (postId) => {
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, likes: Number(p.likes) + 1 } : p)
    );
  };

  const layout = {
    display: 'grid',
    gridTemplateColumns: '220px 1fr 260px',
    gap: 0,
    maxWidth: '1100px',
    margin: '0 auto',
    minHeight: 'calc(100vh - 84px)',
    position: 'relative', zIndex: 1,
  };

  return (
    <>
      <Header onPressClick={() => setShowModal(true)} />

      <div style={layout}>
        {/* Sidebar */}
        <aside style={{ padding: '20px 14px', borderRight: '1px solid var(--border)', position: 'sticky', top: '84px', height: 'calc(100vh - 84px)', overflowY: 'auto' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>Navigate</div>
          {[
            { icon: '📰', label: 'Front Page', action: () => setSort('weighted') },
            { icon: '👥', label: 'Following', action: () => setSort('following') },
            { icon: '🔥', label: 'Trending', action: () => setSort('trending') },
            { icon: '💰', label: 'Top Paid', action: () => setSort('amount_paid_usd') },
            { icon: '🔍', label: 'Search', action: () => navigate('/search') },
            { icon: '👤', label: 'Profile', action: () => publicKey && navigate(`/profile/${publicKey.toBase58()}`) },
          ].map((item) => (
            <div key={item.label} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, marginBottom: '2px', transition: 'background 0.1s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}

          {publicKey && (
            <button
              onClick={() => setShowModal(true)}
              style={{ width: '100%', background: 'var(--accent2)', color: '#fff', border: 'none', padding: '11px', fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 700, borderRadius: '4px', marginTop: '16px', cursor: 'pointer', letterSpacing: '0.3px' }}
            >
              + Press a Post
            </button>
          )}

          <TreasuryBalance />
          <UserCount />
        </aside>

        {/* Feed */}
        <main style={{ padding: '20px', borderRight: '1px solid var(--border)' }}>
          {/* Sort tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', background: 'none',
                  border: 'none', borderBottom: `2px solid ${sort === opt.key ? 'var(--accent2)' : 'transparent'}`,
                  color: sort === opt.key ? 'var(--text)' : 'var(--muted)',
                  transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: '13px' }}>
              Loading the press...
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗞️</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '8px' }}>
                {sort === 'following' ? 'No posts from people you follow' : 'Nothing printed yet'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '14px' }}>
                {sort === 'following' ? 'Follow some people to see their posts here' : 'Be the first to press a post'}
              </div>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))} />
            ))
          )}
        </main>

        {/* Right panel */}
        <aside style={{ padding: '20px 14px', position: 'sticky', top: '84px', height: 'calc(100vh - 84px)', overflowY: 'auto' }}>

          {/* Trending coins */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
              Coins on The Press
            </div>
            {coins.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>No coins yet</div>
            )}
            {coins.map((coin) => {
              const price = prices[coin.mint];
              const change = price?.change24h;
              const isUp = change >= 0;
              return (
                <a key={coin.mint} href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '6px', textDecoration: 'none', color: 'var(--text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--paper2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>🪙</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>${coin.ticker}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)' }}>{coin.mint.slice(0, 6)}...{coin.mint.slice(-4)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                      {change !== undefined ? `${isUp ? '+' : ''}${change.toFixed(1)}%` : '...'}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)' }}>
                      ${price?.usd < 0.0001 ? price?.usd?.toExponential(2) : price?.usd?.toFixed(6) || '...'}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* The Pizza Moment */}
         <div style={{ background: 'var(--ink)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--accent)', letterSpacing: '1.5px', marginBottom: '8px' }}>
              🗞️ HOW IT WORKS
            </div>
            <div style={{ fontSize: '11px', color: '#aaa', lineHeight: 1.7 }}>
              The Press runs on attention — paid for with memecoins.
              <br /><br />
              Find a coin you believe in. Paste its mint address, set your amount, and press your post. The more you spend, the more impressions your post earns.
              <br /><br />
              But spending alone doesn't make you viral. Posts that earn real likes, comments, and represses climb the trending feed fast. Pay to get seen. Earn your way to the top.
              <br /><br />
              <span style={{ color: 'var(--accent)' }}>Oil powered the industrial age. Memecoins power the attention age.</span>
            </div>
          </div>        </aside>
      </div>

    {showModal && (
        <PressModal
          onClose={() => setShowModal(false)}
          onSuccess={handlePostSuccess}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav">
        <div onClick={() => setSort('weighted')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', color: sort === 'weighted' ? 'var(--accent)' : 'var(--muted)', fontSize: '10px' }}>
          <span style={{ fontSize: '20px' }}>📰</span>
          <span>Feed</span>
        </div>
        <div onClick={() => setSort('trending')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', color: sort === 'trending' ? 'var(--accent)' : 'var(--muted)', fontSize: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔥</span>
          <span>Trending</span>
        </div>
        {publicKey && (
          <div onClick={() => setShowModal(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '10px' }}>
            <div style={{ width: '44px', height: '44px', background: 'var(--accent2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginTop: '-20px', border: '3px solid var(--press)' }}>+</div>
            <span style={{ color: 'var(--muted)' }}>Press</span>
          </div>
        )}
        <div onClick={() => navigate('/search')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', color: 'var(--muted)', fontSize: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔍</span>
          <span>Search</span>
        </div>
        <div onClick={() => publicKey && navigate(`/profile/${publicKey.toBase58()}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', color: 'var(--muted)', fontSize: '10px' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <span>Profile</span>
        </div>
      </div>    </>
  );
};
