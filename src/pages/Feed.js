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
    const load = async () => {
      const { data } = await supabase
        .from('posts')
        .select('amount_paid_usd')
        .eq('is_active', true);
      if (data) {
        const sum = data.reduce((acc, p) => acc + Number(p.amount_paid_usd || 0), 0);
        setTotal(sum);
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatted = total === null ? '...' : total >= 1000000
    ? `$${(total / 1000000).toFixed(2)}M`
    : total >= 1000
    ? `$${(total / 1000).toFixed(2)}K`
    : `$${total.toFixed(2)}`;

  return (
    <div style={{ marginTop: '20px', padding: '16px 14px', background: '#080814', borderRadius: '6px', border: '1px solid #1e1e40', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#00ffff', opacity: 0.6 }} />
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#444466', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>
        Treasury
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '38px', fontWeight: 900, color: loading ? '#333355' : '#c8a84b', letterSpacing: '-1px', lineHeight: 1, marginBottom: '6px', transition: 'color 0.5s' }}>
        {loading ? '...' : formatted}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#333355', letterSpacing: '2px', textTransform: 'uppercase' }}>
        All-time ad spend
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
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#444466', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
        Pressers
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 900, color: '#9944ff', letterSpacing: '-1px', lineHeight: 1 }}>
        {total === null ? '...' : total.toLocaleString()}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#9944ff', opacity: 0.2 }} />
    </div>
  );
};
  { key: 'weighted', label: '⭐ For You' },
  { key: 'following', label: '👥 Following' },
  { key: 'trending', label: '🔥 Trending' },
  { key: 'created_at', label: 'New' },
  { key: 'amount_paid_usd', label: '💸 Most Expensive' },
];

export const Feed = () => {
  const { publicKey } = useWallet();
  const { prices } = useCoinPrices();
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
              <PostCard key={post.id} post={post} onLike={handleLike} />
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
              🍕 THE PRESS MOMENT
            </div>
            <div style={{ fontSize: '11px', color: '#aaa', lineHeight: 1.7 }}>
              In 2010, someone paid 10,000 Bitcoin for two pizzas. At the time, it seemed like nothing. Years later, it became the most famous transaction in crypto history — not because of the pizza, but because of what that Bitcoin became worth.
              <br /><br />
              Somewhere on The Press, someone is going to spend an absurd amount of a coin nobody's heard of — just to post a meme. That meme is going to be so funny, so perfectly timed, that it spreads everywhere. And when people ask why that coin is pumping, someone is going to find <em>that post</em>.
              <br /><br />
              <span style={{ color: 'var(--accent)' }}>That post is already out there. It just hasn't been pressed yet.</span>
            </div>
          </div>
        </aside>
      </div>

      {showModal && (
        <PressModal
          onClose={() => setShowModal(false)}
          onSuccess={handlePostSuccess}
        />
      )}
    </>
  );
};
