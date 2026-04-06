import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { WalletAvatar, WalletName } from './WalletName';

export const FollowListModal = ({ wallet, type, count, onClose }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let wallets = [];
      if (type === 'followers') {
        const { data } = await supabase.from('follows').select('follower_wallet').eq('following_wallet', wallet);
        wallets = (data || []).map(r => r.follower_wallet);
      } else {
        const { data } = await supabase.from('follows').select('following_wallet').eq('follower_wallet', wallet);
        wallets = (data || []).map(r => r.following_wallet);
      }
      setList(wallets);
      setLoading(false);
    };
    load();
  }, [wallet, type]);

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(10,9,7,0.8)',
    zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', backdropFilter: 'blur(2px)',
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '380px', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700 }}>
            {count} {type === 'followers' ? 'Followers' : 'Following'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: '13px' }}>Loading...</div>
          ) : list.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </div>
          ) : (
            list.map(w => (
              <Link
                key={w}
                to={`/profile/${w}`}
                onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--paper2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <WalletAvatar address={w} size={38} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    <WalletName address={w} />
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {w.slice(0, 6)}...{w.slice(-4)}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
