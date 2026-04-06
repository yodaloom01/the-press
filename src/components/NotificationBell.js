import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import { fetchNotifications, markNotificationsRead, subscribeToNotifications } from '../lib/supabase';
import { format } from 'timeago.js';
import { WalletAvatar, WalletName } from './WalletName';

const NOTIF_LABELS = {
  like_post: '❤️ liked your post',
  comment: '💬 commented on your post',
  like_comment: '❤️ liked your comment',
  reply: '↩️ replied to your comment',
};

export const NotificationBell = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!walletAddress) return;
    fetchNotifications(walletAddress).then(data => {
      setNotifications(data);
      setUnread(data.filter(n => !n.read).length);
    });
    const unsub = subscribeToNotifications(walletAddress, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnread(c => c + 1);
    });
    return unsub;
  }, [walletAddress]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unread > 0 && walletAddress) {
      await markNotificationsRead(walletAddress);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    }
  };

  if (!walletAddress) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f0e8', position: 'relative', padding: '4px', display: 'flex', alignItems: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: '16px', height: '16px', background: 'var(--accent2)', borderRadius: '50%', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '36px', right: 0, width: '320px', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 300, maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 700 }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No notifications yet</div>
          ) : (
            notifications.map(n => (
              <Link
                key={n.id}
                to={n.post_id ? `/post/${n.post_id}` : '/'}
                onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--paper2)', textDecoration: 'none', color: 'var(--text)' }}
              >
                <WalletAvatar address={n.sender_wallet} size={28} />
                <div>
                  <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600 }}><WalletName address={n.sender_wallet} /></span>{' '}
                    {NOTIF_LABELS[n.type] || n.type}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginTop: '2px' }}>
                    {format(n.created_at)}
                  </div>
                </div>
                {!n.read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', marginLeft: 'auto', marginTop: '4px', flexShrink: 0 }} />}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
};
