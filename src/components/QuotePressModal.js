import React, { useState, useRef, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { transferSplToken, calculateReach, formatReach, getReachTier } from '../lib/solana';
import { uploadMedia, createPost, supabase } from '../lib/supabase';
import { WalletAvatar, WalletName } from './WalletName';
import { format } from 'timeago.js';
import { formatAmount } from '../lib/solana';

const PRESETS = [100, 1000, 10000, 100000, 1000000];

const lookupToken = async (mintAddress) => {
  let ticker = mintAddress.slice(0, 6).toUpperCase();
  let name = 'Unknown Token';
  let logoURI = null;
  let decimals = 6;
  let priceUsd = 0;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (res.ok) {
      const data = await res.json();
      const pair = data?.pairs?.[0];
      if (pair) {
        ticker = pair.baseToken?.symbol || ticker;
        name = pair.baseToken?.name || name;
        priceUsd = parseFloat(pair.priceUsd) || 0;
        logoURI = pair.info?.imageUrl || null;
      }
    }
  } catch {}
  return { ticker, name, emoji: '🪙', mint: mintAddress, decimals, coingeckoId: null, logoURI, priceUsd };
};

export const QuotePressModal = ({ post, onClose, onSuccess }) => {
  const { publicKey, sendTransaction } = useWallet();
  const [mintInput, setMintInput] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [amount, setAmount] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState('idle');
  const [platformSpend24h, setPlatformSpend24h] = useState(0);
  const fileRef = useRef();

  useEffect(() => {
    const fetchSpend = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('posts').select('amount_paid_usd').gte('created_at', since);
      if (data) {
        const total = data.reduce((sum, p) => sum + Number(p.amount_paid_usd || 0), 0);
        setPlatformSpend24h(total);
      }
    };
    fetchSpend();
  }, []);

  const usdValue = tokenInfo?.priceUsd ? Number(amount || 0) * tokenInfo.priceUsd : 0;
  const reach = calculateReach(Number(amount || 0), tokenInfo?.priceUsd || 0, platformSpend24h);
  const tier = getReachTier(usdValue);

  const handleLookup = async () => {
    if (!mintInput.trim()) return;
    setLookingUp(true);
    setLookupError('');
    setTokenInfo(null);
    try {
      const info = await lookupToken(mintInput.trim());
      setTokenInfo(info);
    } catch (e) {
      setLookupError('Could not find token. Check the mint address and try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!publicKey) return toast.error('Connect your wallet first');
    if (!tokenInfo) return toast.error('Look up a token first');
    if (!amount || Number(amount) <= 0) return toast.error('Enter an amount');
    try {
      let mediaUrl = null;
      let mediaType = null;
      if (file) {
        setStep('uploading');
        mediaUrl = await uploadMedia(file, publicKey.toBase58());
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
      }
      setStep('signing');
      toast('Check your wallet — approve the transaction', { icon: '👛' });
      const signature = await transferSplToken(
        publicKey, sendTransaction,
        { ...tokenInfo, mint: tokenInfo.mint, devnetMint: tokenInfo.mint },
        Number(amount)
      );
      setStep('broadcasting');
      const newPost = await createPost({
        walletAddress: publicKey.toBase58(),
        caption, mediaUrl, mediaType,
        coinTicker: tokenInfo.ticker,
        coinMint: tokenInfo.mint,
        amountPaid: Number(amount),
        amountPaidUsd: usdValue,
        txSignature: signature,
        reachTarget: reach,
        quoteOf: post.id,
      });
      setStep('done');
      toast.success(`Quote pressed! 🗞️`);
      onSuccess(newPost);
      onClose();
    } catch (err) {
      setStep('idle');
      if (err.message?.includes('User rejected')) {
        toast.error('Transaction cancelled');
      } else {
        toast.error('Transaction failed: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const isLoading = step !== 'idle' && step !== 'done';
  const stepLabel = { idle: 'Quote Press →', uploading: 'Uploading...', signing: 'Waiting for wallet...', broadcasting: 'Broadcasting...' }[step];

  const inp = { width: '100%', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Sans', sans-serif" };
  const label = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '7px', fontFamily: "'DM Mono', monospace" };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,9,7,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(2px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700 }}>Quote Press</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px' }}>
          {/* Caption */}
          <div style={{ marginBottom: '14px' }}>
            <span style={label}>Your take</span>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '80px' }} placeholder="Add your commentary..." value={caption} onChange={e => setCaption(e.target.value)} maxLength={280} />
            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginTop: '4px' }}>{caption.length}/280</div>
          </div>

          {/* Optional media */}
          <div style={{ marginBottom: '14px' }}>
            <span style={label}>Image / Video (optional)</span>
            <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', padding: preview ? '0' : '16px', textAlign: 'center', cursor: 'pointer', overflow: 'hidden' }}>
              {preview ? (
                file?.type.startsWith('video') ? <video src={preview} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }} muted /> : <img src={preview} alt="preview" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Click to add image or video</div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Quoted post preview */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', marginBottom: '16px', background: 'var(--paper2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <WalletAvatar address={post.wallet_address} size={24} />
              <WalletName address={post.wallet_address} style={{ fontSize: '12px', fontWeight: 600 }} />
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{format(post.created_at)}</span>
              <span style={{ marginLeft: 'auto', background: 'var(--ink)', color: 'var(--accent)', padding: '2px 7px', borderRadius: '3px', fontFamily: "'DM Mono', monospace", fontSize: '9px' }}>🪙 ${post.coin_ticker}</span>
            </div>
            {post.media_url && <img src={post.media_url} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }} />}
            {post.caption && <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4 }}>{post.caption}</div>}
            <div style={{ fontSize: '10px', color: 'var(--green)', fontFamily: "'DM Mono', monospace", marginTop: '6px' }}>{formatAmount(Number(post.amount_paid))} ${post.coin_ticker} paid</div>
          </div>

          {/* Payment */}
          <div style={{ background: 'var(--ink)', borderRadius: '6px', padding: '16px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase' }}>⬡ Pay to Press</div>
            <span style={{ ...label, color: '#666' }}>Token Mint Address</span>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input type="text" placeholder="Paste any Solana token CA..." value={mintInput} onChange={e => setMintInput(e.target.value)} style={{ flex: 1, background: '#1e1e30', border: '1px solid #333', borderRadius: '4px', padding: '8px 12px', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#f5f0e8', outline: 'none' }} />
              <button onClick={handleLookup} disabled={lookingUp || !mintInput.trim()} style={{ background: 'var(--accent)', color: 'var(--press)', border: 'none', padding: '8px 12px', fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500, borderRadius: '4px', cursor: 'pointer', opacity: lookingUp || !mintInput.trim() ? 0.5 : 1 }}>{lookingUp ? '...' : 'Look Up'}</button>
            </div>
            {lookupError && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#ff6b6b', marginBottom: '10px' }}>{lookupError}</div>}
            {tokenInfo && (
              <div style={{ background: '#1e1e30', border: '1px solid var(--accent)', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tokenInfo.logoURI ? <img src={tokenInfo.logoURI} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} /> : <span>🪙</span>}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f0e8' }}>{tokenInfo.name}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--accent)' }}>${tokenInfo.ticker}</div>
                </div>
                {tokenInfo.priceUsd > 0 && <div style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#aaa' }}>${tokenInfo.priceUsd < 0.0001 ? tokenInfo.priceUsd.toExponential(2) : tokenInfo.priceUsd.toFixed(6)}</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" disabled={!tokenInfo} style={{ flex: 1, background: '#1e1e30', border: '1px solid #333', borderRadius: '4px', padding: '8px 12px', fontFamily: "'DM Mono', monospace", fontSize: '14px', color: '#f5f0e8', outline: 'none', opacity: !tokenInfo ? 0.4 : 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--accent)', padding: '0 10px', background: '#1e1e30', border: '1px solid #333', borderRadius: '4px' }}>{tokenInfo ? `$${tokenInfo.ticker}` : '---'}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {PRESETS.map(p => <button key={p} onClick={() => setAmount(String(p))} disabled={!tokenInfo} style={{ background: '#1e1e30', border: '1px solid #333', color: '#aaa', padding: '4px 10px', fontFamily: "'DM Mono', monospace", fontSize: '10px', borderRadius: '3px', opacity: !tokenInfo ? 0.4 : 1, cursor: tokenInfo ? 'pointer' : 'not-allowed' }}>{p >= 1000000 ? `${p/1000000}M` : p >= 1000 ? `${p/1000}K` : p}</button>)}
            </div>
            {tokenInfo && amount && reach > 0 && (
              <div style={{ background: '#111122', borderRadius: '4px', padding: '10px', marginBottom: '12px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Estimated Reach</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', color: 'var(--accent)', fontWeight: 700 }}>{formatReach(reach)}</div>
              </div>
            )}
            <button onClick={handleSubmit} disabled={isLoading || !tokenInfo || !amount || Number(amount) <= 0} style={{ width: '100%', background: isLoading ? '#555' : 'var(--accent)', color: 'var(--press)', border: 'none', padding: '12px', fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 700, borderRadius: '4px', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading || !tokenInfo || !amount || Number(amount) <= 0 ? 0.6 : 1 }}>{stepLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
