import React, { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useCoinPrices } from '../hooks/useCoinPrices';
import { NotificationBell } from './NotificationBell';

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
    const color = change >= 0 ? '#00ff00' : '#ff4444';
    return (
      <a key={coin.mint} href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#000', fontWeight: 'bold', textShadow: '0 0 3px #fff', padding: '0 24px', borderRight: '1px solid #ff00ff', textDecoration: 'none', letterSpacing: '1px' }}>
        *** ${coin.ticker} {price && <span style={{ color }}>{change >= 0 ? '+' : ''}{change?.toFixed(1)}%</span>} ***
      </a>
    );
  });

  return (
    <>
      {/* Win95 title bar */}
<style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .blink-online { animation: blink 1s infinite; color: #00ff00; }
        .blink-hot { animation: blink 0.5s infinite; background: #ff0000; color: #ffff00; font-size: 8px; padding: 1px 3px; font-weight: bold; }
      `}</style>
      <div style={{ background: '#000080', padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #00ffff' }}>
        <div style={{ color: '#ffffff', fontSize: '11px', fontFamily: "'Courier New', monospace", fontWeight: 'bold', letterSpacing: '1px' }}>
          THE PRESS v1.0 — Microsoft Internet Explorer 4.0
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {['_', '[]', 'X'].map(b => (
            <div key={b} style={{ width: '16px', height: '14px', background: '#c0c0c0', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', fontSize: '9px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'monospace' }}>{b}</div>
          ))}
        </div>
      </div>

      {/* Marquee ticker */}
      <style>{`
        @keyframes rainbow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
      `}</style>
      <div style={{ background: 'linear-gradient(270deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ffff, #ff00ff, #ff0000)', backgroundSize: '400% 400%', animation: 'rainbow 4s ease infinite', borderTop: '2px solid #fff', borderBottom: '2px solid #444', padding: '4px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', animation: 'ticker 20s linear infinite' }}>
          {tickerItems}{tickerItems}{tickerItems}
        </div>
      </div>

      {/* Main header */}
      <header style={{ background: '#000', color: '#00ff00', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '3px solid #ff00ff' }}>

        {/* Left — status */}
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: '10px', color: '#00ffff', lineHeight: 1.8, flexShrink: 0 }} className="desktop-only">
          <div>&gt; CONNECTING TO SOLANA...</div>
          <div>&gt; CHAIN ID: 41454</div>
          <div>&gt; STATUS: <span style={{ color: '#00ff00', animation: 'blink 1s infinite', display: 'inline-block' }}>ONLINE</span></div>
        </div>

        {/* Center — logo */}
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: '32px', fontWeight: 900, color: '#ff00ff', textShadow: '4px 4px #00ffff', letterSpacing: '6px', lineHeight: 1 }}>
            THE PRESS
          </div>
          <div style={{ fontSize: '9px', color: '#ff00ff', letterSpacing: '4px', animation: 'blink 1s infinite', marginTop: '2px' }}>
            * ON SOLANA *
          </div>
          <div style={{ fontSize: '9px', color: '#00ffff', letterSpacing: '3px', animation: 'blink 1.5s infinite' }}>
            PAY TO TREND &gt;&gt; MEMECOINS ONLY
          </div>
        </div>

        {/* Right — buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
          {publicKey && (
            <button onClick={onPressClick}
              style={{ background: '#ff0000', color: '#ffff00', borderTop: '2px solid #ff8888', borderLeft: '2px solid #ff8888', borderBottom: '2px solid #880000', borderRight: '2px solid #880000', padding: '5px 14px', fontFamily: "'Courier New', monospace", fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
              &gt;&gt; + PRESS POST &lt;&lt;
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotificationBell />
            <WalletMultiButton />
          </div>
        </div>
      </header>


    </>
  );
};