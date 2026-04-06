import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { setUsername, fetchProfile } from '../lib/supabase';
import { clearNameCache } from '../hooks/useSolanaName';

export const UsernameModal = ({ onClose, onSuccess }) => {
  const { publicKey } = useWallet();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState('');

  useEffect(() => {
    if (publicKey) {
      fetchProfile(publicKey.toBase58()).then(p => {
        if (p?.username) setCurrent(p.username);
      });
    }
  }, [publicKey]);

  const handleSubmit = async () => {
    if (!publicKey) return;
    const trimmed = input.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!trimmed) return setError('Username cannot be empty');
    if (trimmed.length < 3) return setError('Must be at least 3 characters');
    if (trimmed.length > 20) return setError('Must be 20 characters or less');

    setLoading(true);
    setError('');
    const result = await setUsername(publicKey.toBase58(), trimmed);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      clearNameCache(publicKey.toBase58());
      onSuccess(`@${trimmed}`);
      onClose();
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(10,9,7,0.8)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', backdropFilter: 'blur(2px)',
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '400px', padding: '0' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 700 }}>Set Your Username</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {current && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>
              Current username: <span style={{ color: 'var(--accent)' }}>@{current}</span>
            </div>
          )}

          <div style={{ marginBottom: '8px', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Choose a username
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--paper2)', border: '1px solid var(--border)', borderRadius: '4px 0 0 4px', padding: '0 10px', fontSize: '14px', color: 'var(--muted)', borderRight: 'none' }}>@</div>
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="cumwhale"
              maxLength={20}
              style={{ flex: 1, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0 4px 4px 0', fontSize: '14px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Mono', monospace" }}
            />
          </div>

          {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '12px', fontFamily: "'DM Mono', monospace" }}>{error}</div>}

          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
            Letters, numbers, and underscores only. 3–20 characters. Shown everywhere instead of your wallet address.
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            style={{ width: '100%', background: 'var(--accent)', color: 'var(--press)', border: 'none', padding: '12px', fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 700, borderRadius: '4px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.6 : 1 }}
          >
            {loading ? 'Saving...' : 'Set Username'}
          </button>
        </div>
      </div>
    </div>
  );
};
