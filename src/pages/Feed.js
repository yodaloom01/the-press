import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { PostCard } from '../components/PostCard';
import { PressModal } from '../components/PressModal';
import { fetchPosts, subscribeToNewPosts, fetchFollowingPosts, supabase, getTotalUsers } from '../lib/supabase';
import { shortWallet } from '../lib/solana';
import { useCoinPrices } from '../hooks/useCoinPrices';

const win95Box = {
  background: '#000',
  border: '2px solid #00ffff',
  padding: '8px',
  marginBottom: '8px',
};

const win95Btn = {
  background: '#c0c0c0',
  color: '#000',
  borderTop: '2px solid #fff',
  borderLeft: '2px solid #fff',
  borderBottom: '2px solid #444',
  borderRight: '2px solid #444',
  padding: '3px 10px',
  fontFamily: "'Courier New', monospace",
  fontSize: '11px',
  cursor: 'pointer',
  letterSpacing: '1px',
  display: 'block',
  width: '100%',
  textAlign: 'left',
  marginBottom: '2px',
};

const TreasuryBalance = () => {
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletValue = async () => {
      try {
        const rpc = 'https://mainnet.helius-rpc.com/?api-key=56557c79-1e29-43da-a73f-1b8f58e3140a';
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 'treasury',
            method: 'getTokenAccountsByOwner',
            params: ['3be48KfHNFmQwn9DQqfYYDhXPrs5xQVzgF9sNW6YQYzx', { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }]
          })
        });
        const data = await res.json();
        const accounts = data?.result?.value || [];
        const tokens = accounts.map(a => ({ mint: a.account.data.parsed.info.mint, amount: Number(a.account.data.parsed.info.tokenAmount.uiAmount) || 0 })).filter(t => t.amount > 0);
        if (tokens.length === 0) { setTotal(0); setLoading(false); return; }
        const mints = tokens.map(t => t.mint).join(',');
        const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
        const priceData = await priceRes.json();
        const priceMap = {};
        (priceData.pairs || []).forEach(pair => { const mint = pair.baseToken?.address; if (mint && !priceMap[mint]) priceMap[mint] = parseFloat(pair.priceUsd) || 0; });
        const totalValue = tokens.reduce((sum, t) => sum + (t.amount * (priceMap[t.mint] || 0)), 0);
        setTotal(totalValue);
      } catch (err) { setTotal(0); }
      finally { setLoading(false); }
    };
    fetchWalletValue();
    const interval = setInterval(fetchWalletValue, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatted = total === null ? '...' : total >= 1000000 ? `$${(total/1000000).toFixed(2)}M` : total >= 1000 ? `$${(total/1000).toFixed(2)}K` : `$${total?.toFixed(2)}`;

  return (
    <div style={{ ...win95Box, border: '2px solid #00ffff', textAlign: 'center', marginTop: '10px' }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#00ffff', letterSpacing: '3px', marginBottom: '6px', animation: 'blink 2s infinite' }}>
        ** TREASURY **
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '32px', fontWeight: 900, color: loading ? '#333' : '#00ff00', letterSpacing: '-1px', textShadow: loading ? 'none' : '0 0 10px #00ff00' }}>
        {loading ? '...' : formatted}
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#004400', letterSpacing: '2px', animation: 'blink 2s infinite' }}>
        LIVE WALLET VALUE
      </div>
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
    <div style={{ ...win95Box, border: '2px solid #ff00ff', textAlign: 'center', marginTop: '6px' }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ff00ff', letterSpacing: '3px', marginBottom: '4px' }}>
        PRESSERS ONLINE
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '26px', fontWeight: 900, color: '#ff00ff' }}>
        {total === null ? '...' : total.toLocaleString()}
      </div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#440044' }}>
        TOTAL USERS
      </div>
    </div>
  );
};

const SORT_OPTIONS = [
  { key: 'weighted', label: '[FOR YOU]' },
  { key: 'following', label: '[FOLLOWING]' },
  { key: 'trending', label: '[TRENDING]' },
  { key: 'created_at', label: '[NEW]' },
  { key: 'amount_paid_usd', label: '[TOP $$$]' },
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [sort, publicKey]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    const unsub = subscribeToNewPosts((newPost) => setPosts((prev) => [newPost, ...prev]));
    return unsub;
  }, []);

  const handlePostSuccess = (post) => setPosts((prev) => [post, ...prev]);
  const handleLike = (postId) => setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes: Number(p.likes) + 1 } : p));

  return (
    <>
      <Header onPressClick={() => setShowModal(true)} />

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', maxWidth: '1100px', margin: '0 auto', minHeight: 'calc(100vh - 84px)', position: 'relative', zIndex: 1 }} className="feed-grid">

        {/* Left Sidebar */}
        <aside style={{ padding: '12px 8px', borderRight: '2px solid #00ffff', position: 'sticky', top: '84px', height: 'calc(100vh - 84px)', overflowY: 'auto', background: '#000' }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ff00ff', letterSpacing: '2px', borderBottom: '1px solid #ff00ff', paddingBottom: '4px', marginBottom: '8px' }}>
            ** NAVIGATE **
          </div>

          {[
            { icon: '>', label: '[HOME PAGE]', action: () => setSort('weighted') },
            { icon: '>', label: '[FOLLOWING]', action: () => setSort('following') },
            { icon: '>', label: '[TRENDING]', action: () => setSort('trending') },
            { icon: '>', label: '[TOP PAID]', action: () => setSort('amount_paid_usd') },
            { icon: '>', label: '[SEARCH]', action: () => navigate('/search') },
            { icon: '>', label: '[MY PROFILE]', action: () => publicKey && navigate(`/profile/${publicKey.toBase58()}`) },
            { icon: '>', label: '[GUESTBOOK]', action: () => {} },
          ].map((item) => (
            <div key={item.label} onClick={item.action}
              style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#00ff00', padding: '5px 6px', cursor: 'pointer', border: '1px solid transparent', marginBottom: '2px', letterSpacing: '0.5px' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#001a00'; e.currentTarget.style.borderColor = '#00ff00'; e.currentTarget.style.color = '#ffff00'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#00ff00'; }}
            >
              {item.icon} {item.label}
            </div>
          ))}

          {publicKey && (
            <button onClick={() => setShowModal(true)}
              style={{ width: '100%', background: '#ff0000', color: '#ffff00', borderTop: '2px solid #ff8888', borderLeft: '2px solid #ff8888', borderBottom: '2px solid #880000', borderRight: '2px solid #880000', padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px', marginTop: '10px', textAlign: 'center' }}>
              &gt;&gt; + PRESS POST &lt;&lt;
            </button>
          )}

          <TreasuryBalance />
          <UserCount />

          <div style={{ marginTop: '10px', border: '1px solid #444', padding: '6px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ffff00', marginBottom: '4px' }}>** BEST VIEWED **</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#444' }}>NETSCAPE 4.0<br/>800x600 RES<br/>56K MODEM</div>
          </div>

<div style={{ marginTop: '10px', border: '2px solid #c0c0c0', background: '#c0c0c0' }}>
  <div style={{ background: '#000080', padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ color: '#fff', fontSize: '9px', fontFamily: "'Courier New', monospace", fontWeight: 'bold' }}>WINAMP.EXE</div>
    <div style={{ display: 'flex', gap: '2px' }}>
      {['_','X'].map(b => <div key={b} style={{ width: '14px', height: '12px', background: '#c0c0c0', borderTop: '1px solid #fff', borderLeft: '1px solid #fff', borderBottom: '1px solid #444', borderRight: '1px solid #444', fontSize: '8px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{b}</div>)}
    </div>
  </div>
  <div style={{ background: '#000', padding: '6px', borderTop: '1px solid #444' }}>
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#00ff00', marginBottom: '4px', animation: 'blink 2s infinite' }}>
      &gt;&gt; THE PRESS FM &lt;&lt;
    </div>
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ff00ff', marginBottom: '6px' }}>
      NOW PLAYING: PeptideGooner.MP3
    </div>
   <audio id="press-audio" src={process.env.PUBLIC_URL + '/peptidegooner.mp3'} loop style={{ display: 'none' }} />
    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
      {[
        { label: '|◄◄', id: 'rew' },
        { label: '► PLAY', id: 'play' },
        { label: '■ STOP', id: 'stop' },
        { label: '►►|', id: 'fwd' },
      ].map(btn => (
        <button key={btn.id}
          onClick={() => {
            const audio = document.getElementById('press-audio');
            if (btn.id === 'play') audio.play();
            if (btn.id === 'stop') audio.pause();
          }}
          style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '2px 4px', fontFamily: "'Courier New', monospace", fontSize: '9px', cursor: 'pointer', fontWeight: 'bold' }}>
          {btn.label}
        </button>
      ))}
    </div>
  </div>
</div>


        </aside>



        {/* Feed */}
        <main style={{ padding: '12px', borderRight: '2px solid #ff00ff', background: '#000' }}>
{/* Sort tabs — Win95 style */}
<div style={{ display: 'flex', gap: '3px', background: '#c0c0c0', padding: '4px 6px', marginBottom: '12px', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', flexWrap: 'wrap' }}>
  {SORT_OPTIONS.map((opt) => (
    <button key={opt.key} onClick={() => setSort(opt.key)}
      style={{ background: '#c0c0c0', color: '#000', borderTop: sort === opt.key ? '2px solid #444' : '2px solid #fff', borderLeft: sort === opt.key ? '2px solid #444' : '2px solid #fff', borderBottom: sort === opt.key ? '2px solid #fff' : '2px solid #444', borderRight: sort === opt.key ? '2px solid #fff' : '2px solid #444', padding: '3px 10px', fontFamily: "'Courier New', monospace", fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '0.5px' }}>
      {opt.label}{opt.key === 'trending' && <span className="blink-hot" style={{ marginLeft: '4px' }}>HOT</span>}
    </button>
  ))}
</div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#00ff00', fontFamily: "'Courier New', monospace", fontSize: '12px', animation: 'blink 1s infinite' }}>
              &gt; LOADING THE PRESS..._
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', fontFamily: "'Courier New', monospace" }}>
              <div style={{ fontSize: '12px', color: '#00ff00', marginBottom: '8px' }}>&gt; NO POSTS FOUND</div>
              <div style={{ fontSize: '10px', color: '#444' }}>BE THE FIRST TO PRESS A POST</div>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))} />
            ))
          )}
        </main>

{/* Right Sidebar */}
        <aside style={{ padding: '12px 8px', position: 'sticky', top: '84px', height: 'calc(100vh - 84px)', overflowY: 'auto', background: '#000' }}>

          {/* Win95 Hot Coins Window */}
          <div style={{ border: '2px solid #000', background: '#c0c0c0', marginBottom: '8px' }}>
            <div style={{ background: '#000080', padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: '11px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>** HOT COINS **</span>
              <div style={{ width: '14px', height: '12px', background: '#c0c0c0', borderTop: '1px solid #fff', borderLeft: '1px solid #fff', borderBottom: '1px solid #444', borderRight: '1px solid #444', fontSize: '9px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>X</div>
            </div>
            {coins.length === 0 ? (
              <>
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '28px' }}>🖥️</div>
                  <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#000' }}>Not found.</div>
                </div>
                <div style={{ padding: '6px', textAlign: 'center', borderTop: '1px solid #808080' }}>
                  <button style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '2px 20px', fontFamily: 'Arial, sans-serif', fontSize: '12px', cursor: 'pointer', minWidth: '60px' }}>Ok</button>
                </div>
              </>
            ) : (
              <div style={{ background: '#fff', margin: '4px', border: '1px inset #808080' }}>
                {coins.map((coin) => {
                  const price = prices[coin.mint];
                  const change = price?.change24h;
                  const isUp = change >= 0;
                  return (
                    <a key={coin.mint} href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #c0c0c0', textDecoration: 'none', background: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#000080'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div>
                        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', fontWeight: 'bold' }}>${coin.ticker}</div>
                        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#808080' }}>{coin.mint.slice(0,6)}...{coin.mint.slice(-4)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', fontWeight: 'bold', color: isUp ? '#008000' : '#ff0000' }}>
                          {change !== undefined ? `${isUp ? '+' : ''}${change.toFixed(1)}%` : '...'}
                        </div>
                        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#808080' }}>
                          ${price?.usd < 0.0001 ? price?.usd?.toExponential(2) : price?.usd?.toFixed(6) || '...'}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ ...win95Box, border: '2px solid #ffff00', marginTop: '12px' }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ffff00', letterSpacing: '2px', marginBottom: '6px', animation: 'blink 2s infinite' }}>
              *** HOW IT WORKS ***
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#888', lineHeight: 1.7 }}>
              1. CONNECT WALLET<br/>
              2. PICK A SOLANA COIN<br/>
              3. PAY TO POST<br/>
              4. MORE $ = MORE VIEWS<br/><br/>
              <span style={{ color: '#ff00ff' }}>OIL POWERED THE INDUSTRIAL AGE. MEMECOINS POWER THE ATTENTION AGE.</span>
            </div>
          </div>

          <div style={{ marginTop: '8px', border: '2px solid #ff00ff', padding: '6px', background: '#000', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ff00ff', animation: 'blink 1s infinite', marginBottom: '4px' }}>** TOP PRESSERS **</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#ffff00' }}>THIS WEEK</div>
          </div>

        </aside>

      {showModal && (
        <PressModal onClose={() => setShowModal(false)} onSuccess={handlePostSuccess} />
      )}

     {/* Mobile Bottom Nav */}
      <div className="mobile-nav" style={{ background: '#c0c0c0', borderTop: '3px solid #fff', padding: '4px 8px', gap: '4px' }}>
       {[
          { icon: '📰', label: 'FEED', action: () => setSort('weighted') },
          { icon: '🔥', label: 'HOT', action: () => setSort('trending') },
          { icon: '+', label: 'PRESS', action: () => setShowModal(true), isPress: true },
          { icon: '🔍', label: 'FIND', action: () => navigate('/search') },
          { icon: '👤', label: publicKey ? 'ME' : 'LOGIN', action: () => publicKey ? navigate(`/profile/${publicKey.toBase58()}`) : document.querySelector('.wallet-adapter-button')?.click() },
        ].map((item) => (          <button key={item.label} onClick={item.action}
            style={{ background: item.isPress ? '#ff0000' : '#c0c0c0', color: item.isPress ? '#ffff00' : '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '4px 6px', fontFamily: "'Courier New', monospace", fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      </div>
    </>
  );
};