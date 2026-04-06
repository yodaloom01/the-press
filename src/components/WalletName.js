import React from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';

export const WalletAvatar = ({ address, size = 32 }) => {
  const { profile, displayName } = useProfile(address);
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: 'var(--press)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${size * 0.4}px`, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: 'var(--accent)', fontFamily: "'DM Mono', monospace", fontSize: `${size * 0.35}px` }}>{initials}</span>
      }
    </div>
  );
};

export const WalletName = ({ address, asLink = false, style = {} }) => {
  const { displayName } = useProfile(address);

  if (asLink) {
    return (
      <Link
        to={`/profile/${address}`}
        style={{ textDecoration: 'none', color: 'var(--text)', ...style }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.color = style.color || 'var(--text)'}
      >
        {displayName}
      </Link>
    );
  }

  return <span style={style}>{displayName}</span>;
};
