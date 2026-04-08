import React, { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useCoinPrices } from '../hooks/useCoinPrices';
import { NotificationBell } from './NotificationBell';

const styles = {
  header: {
    background: '#08081a',
    color: '#e8e8f0',
    padding: '0 24px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    borderBottom: '1px solid #1a1a3a',
    boxShadow: '0 2px 20px rgba(0,255,255,0.05)',
  },
  logo: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '22px',
    fontWeight: 900,
    letterSpacing: '-0.5px',
    color: '#c8a84b',
    flexShrink: 0,
    cursor: 'pointer',
  },
  logoSpan: { color: '#ffffff' },
  tickerWrap: {
    background: '#050510',
    overflow: 'hidden',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #1a1a3a',
  },
  tickerInner: {
    display: 'flex',
    animation: 'ticker 30s linear infinite',
    whiteSpace: 'nowrap',
  },
  tickerItem: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    color: '#c8a84b',
    padding: '0 24px',
    borderRight: '1px solid #1a1a3a',
    textDecoration: 'none',
  },
};

export const Header = ({ onPressClick }) => {
  const { publicKey } = useWallet();
  const { prices, coins } = useCoinPrices();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const tickerItems = coins.map((coin) => {
    const price = prices[coin.mint];
    const change = price?.change24h;
    const color = change >= 0 ? '#4fffb0' : '#ff6b6b';
    return (
      <a key={coin.mint} href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noopener noreferrer" style={{ ...styles.tickerItem, textDecoration: 'none' }}>
        🪙 ${coin.ticker}{' '}
        {price && <span style={{ color }}>{change >= 0 ? '+' : ''}{change?.toFixed(1)}%</span>}
      </a>
    );
  });

  return (
    <>
      <header style={styles.header}>
   {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={styles.logo} onClick={() => navigate('/')} className="cursor-pointer">
            THE <span style={styles.logoSpan}>PRESS</span>
          </div>
          <a href="https://x.com/ThePressSolana" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '13px', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#00ffff'}
            onMouseLeave={e => e.currentTarget.style.color = '#888'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </div>

        {/* Search bar — center */}
        <div style={{ flex: 1, maxWidth: '400px' }} className="desktop-only">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ position: 'absolute', left: '10px', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              onClick={() => navigate('/search')}
              placeholder="Search posts, @users, $COINS..."
              style={{ width: '100%', padding: '7px 12px 7px 32px', background: '#0f0f28', border: '1px solid #2a2a55', borderRadius: '20px', fontSize: '13px', color: '#e8e8f0', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {publicKey && (
            <button onClick={onPressClick} style={{ background: '#8b1a1a', color: '#fff', border: '1px solid #ff444444', padding: '7px 14px', fontFamily: "'Playfair Display', serif", fontSize: '13px', fontWeight: 700, borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Press
            </button>
          )}
          <NotificationBell />
          <WalletMultiButton />
        </div>
      </header>

      <div style={styles.tickerWrap}>
        <div style={styles.tickerInner}>
          {tickerItems}{tickerItems}{tickerItems}
        </div>
      </div>
    </>
  );
};
