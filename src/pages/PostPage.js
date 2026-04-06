// ============================================================
// THE PRESS — PostPage
// Shareable link page for individual posts
// Shows coin sponsorship in meta tags + page
// ============================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { PostCard } from '../components/PostCard';
import { fetchPost } from '../lib/supabase';
import { shortWallet } from '../lib/solana';

export const PostPage = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPost(id)
      .then(data => {
        setPost(data);
        // Update page title and meta for sharing
        document.title = `$${data.coin_ticker} sponsored this meme — The Press`;
        // Update og:description meta tag dynamically
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'description';
          document.head.appendChild(meta);
        }
        meta.content = `${data.caption || 'A meme'} — Sponsored by $${data.coin_ticker} on The Press. Paid ${data.amount_paid} $${data.coin_ticker} to press this.`;
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <>
      <Header onPressClick={() => {}} />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 20px', position: 'relative', zIndex: 1 }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginBottom: '20px', textDecoration: 'none' }}>
          ← Back to The Press
        </Link>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: '13px' }}>
            Loading post...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗞️</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', marginBottom: '8px' }}>Post not found</div>
          </div>
        )}

        {post && (
          <>
            {/* Coin sponsorship banner */}
            <div style={{ background: 'var(--ink)', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#666', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  This meme was sponsored by
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: 'var(--accent)', fontWeight: 700 }}>
                  ${post.coin_ticker}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#666', marginBottom: '4px' }}>pressed by</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#aaa' }}>{shortWallet(post.wallet_address)}</div>
              </div>
            </div>

            <PostCard post={post} />

            {/* Share info */}
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--paper2)', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', letterSpacing: '1px', marginBottom: '6px' }}>SHARE THIS POST</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', wordBreak: 'break-all' }}>
                {window.location.href}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                When you share this link, it shows that <strong>${post.coin_ticker}</strong> is sponsoring this meme.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
