// ============================================================
// THE PRESS — PressModal Component
// Full pay-to-post flow with real on-chain SPL token transfer
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

import { transferSplToken, calculateReach, formatReach, getReachTier } from '../lib/solana';
import { uploadMedia, createPost, supabase } from '../lib/supabase';
import { getMint } from '@solana/spl-token';
import { PublicKey, Connection } from '@solana/web3.js';

const PRESETS = [100, 1000, 10000, 100000, 1000000];

// Lookup any SPL token by mint address using DexScreener + Helius DAS fallback
const lookupToken = async (mintAddress) => {
  let ticker = mintAddress.slice(0, 6).toUpperCase();
  let name = 'Unknown Token';
  let logoURI = null;
  let decimals = 6;
  let priceUsd = 0;

  // Try DexScreener first
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

  // Try Helius DAS as fallback for metadata
  if (name === 'Unknown Token') {
    try {
      const rpc = process.env.REACT_APP_RPC_ENDPOINT;
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-lookup',
          method: 'getAsset',
          params: { id: mintAddress },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const asset = data?.result;
        if (asset) {
          ticker = asset.content?.metadata?.symbol || ticker;
          name = asset.content?.metadata?.name || name;
          logoURI = asset.content?.links?.image || asset.content?.files?.[0]?.uri || null;
        }
      }
    } catch {}
  }

  // Try to get decimals from on-chain
  try {
  const conn = getConnection();
  const mintInfo = await getMint(conn, new PublicKey(mintAddress));
  decimals = mintInfo.decimals;
} catch {}
  // Always return something — never throw
  return { ticker, name, emoji: '🪙', mint: mintAddress, decimals, coingeckoId: null, logoURI, priceUsd };
};

export const PressModal = ({ onClose, onSuccess }) => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

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
  const [livePrice, setLivePrice] = useState(0);
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

  // Fetch live price independently when amount changes — never affects token lookup
  useEffect(() => {
    if (!tokenInfo?.mint || !amount) { setLivePrice(0); return; }
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenInfo.mint}`);
        if (res.ok) {
          const data = await res.json();
          const pair = data?.pairs?.[0];
          if (pair?.priceUsd) { setLivePrice(parseFloat(pair.priceUsd)); return; }
        }
      } catch {}
      setLivePrice(0);
    };
    fetchPrice();
  }, [amount, tokenInfo?.mint]);

  const effectivePrice = livePrice || tokenInfo?.priceUsd || 0;
  const usdValue = effectivePrice ? Number(amount || 0) * effectivePrice : 0;
  const reach = calculateReach(Number(amount || 0), effectivePrice, platformSpend24h);
  const tier = getReachTier(usdValue);

  const handleLookup = async () => {
    if (!mintInput.trim()) return;
    setLookingUp(true);
    setLookupError('');
    setTokenInfo(null);
    try {
      const info = await lookupToken(mintInput.trim());
      // Try to get price from CoinGecko or Jupiter
   
      setTokenInfo(info);
    } catch (e) {
      setLookupError(e.message);
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
        publicKey,
        sendTransaction,
        { ...tokenInfo, mint: tokenInfo.mint, devnetMint: tokenInfo.mint },
        Number(amount)
      );

      setStep('broadcasting');

      const post = await createPost({
        walletAddress: publicKey.toBase58(),
        caption,
        mediaUrl,
        mediaType,
        coinTicker: tokenInfo.ticker,
        coinMint: tokenInfo.mint,
        amountPaid: Number(amount),
        amountPaidUsd: usdValue,
        txSignature: signature,
        reachTarget: reach,
        coinPriceAtPost: effectivePrice,
      });

      setStep('done');
      toast.success(`Pressed! ${amount} $${tokenInfo.ticker} paid. 🗞️`);
      onSuccess(post);
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
  const stepLabel = {
    idle: `Press It to the World →`,
    uploading: 'Uploading media...',
    signing: 'Waiting for wallet signature...',
    broadcasting: 'Broadcasting to Solana...',
  }[step];

  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(10,9,7,0.8)',
    zIndex: 200, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: '20px', backdropFilter: 'blur(2px)',
  };
  const modal = {
    background: 'var(--paper)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '100%', maxWidth: '540px',
    maxHeight: '90vh', overflowY: 'auto',
  };
  const inp = {
    width: '100%', padding: '10px 12px',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '14px', color: 'var(--text)',
    outline: 'none', fontFamily: "'DM Sans', sans-serif",
  };
  const label = {
    display: 'block', fontSize: '11px',
    fontWeight: 600, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    marginBottom: '7px', fontFamily: "'DM Mono', monospace",
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>

        {/* Modal Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 700 }}>
            Press a Post
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Upload zone */}
          <div style={{ marginBottom: '18px' }}>
            <span style={label}>Meme / Image / Video</span>
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '6px', padding: preview ? '0' : '32px',
                textAlign: 'center', cursor: 'pointer',
                overflow: 'hidden', transition: 'border-color 0.15s',
              }}
            >
              {preview ? (
                file?.type.startsWith('video') ? (
                  <video src={preview} style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} muted />
                ) : (
                  <img src={preview} alt="preview" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} />
                )
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Click to upload or drag & drop</div>
                  <div style={{ fontSize: '11px', color: 'var(--border)', marginTop: '4px', fontFamily: "'DM Mono', monospace" }}>
                    JPG · PNG · GIF · MP4 · Max 50MB
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Caption */}
          <div style={{ marginBottom: '18px' }}>
            <span style={label}>Caption</span>
            <textarea
              style={{ ...inp, resize: 'vertical', minHeight: '72px' }}
              placeholder="What does this meme mean to you..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {/* Payment section */}
          <div style={{ background: 'var(--ink)', borderRadius: '6px', padding: '18px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: 'var(--accent)', marginBottom: '14px', textTransform: 'uppercase' }}>
              ⬡ Pay to Press — Solana SPL Token
            </div>

            {/* Token lookup */}
            <span style={{ ...label, color: '#666' }}>SPL Token Mint Address</span>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Paste any Solana token mint address..."
                value={mintInput}
                onChange={(e) => setMintInput(e.target.value)}
                style={{
                  flex: 1, background: '#1e1e30',
                  border: '1px solid #333', borderRadius: '4px',
                  padding: '9px 12px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '11px', color: '#f5f0e8', outline: 'none',
                }}
              />
              <button
                onClick={handleLookup}
                disabled={lookingUp || !mintInput.trim()}
                style={{
                  background: 'var(--accent)', color: 'var(--press)',
                  border: 'none', padding: '9px 14px',
                  fontFamily: "'DM Mono', monospace", fontSize: '11px',
                  fontWeight: 500, borderRadius: '4px', cursor: 'pointer',
                  opacity: lookingUp || !mintInput.trim() ? 0.5 : 1,
                }}
              >
                {lookingUp ? '...' : 'Look Up'}
              </button>
            </div>

            {lookupError && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#ff6b6b', marginBottom: '10px' }}>
                {lookupError}
              </div>
            )}

            {tokenInfo && (
              <div style={{ background: '#1e1e30', border: '1px solid var(--accent)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {tokenInfo.logoURI && <img src={tokenInfo.logoURI} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />}
                {!tokenInfo.logoURI && <span style={{ fontSize: '22px' }}>🪙</span>}
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#f5f0e8' }}>{tokenInfo.name}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--accent)' }}>${tokenInfo.ticker}</div>
                </div>
                {tokenInfo.priceUsd > 0 && (
                  <div style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#aaa' }}>
                    ${tokenInfo.priceUsd < 0.0001 ? tokenInfo.priceUsd.toExponential(2) : tokenInfo.priceUsd.toFixed(6)}
                  </div>
                )}
                {tokenInfo.priceUsd === 0 && (
                  <div style={{ marginLeft: 'auto', fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#555' }}>
                    price unavailable
                  </div>
                )}
              </div>
            )}

            {/* Amount input */}
            <span style={{ ...label, color: '#666' }}>Amount to pay</span>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                disabled={!tokenInfo}
                style={{
                  flex: 1, background: '#1e1e30',
                  border: '1px solid #333', borderRadius: '4px',
                  padding: '9px 12px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '14px', color: '#f5f0e8', outline: 'none',
                  opacity: !tokenInfo ? 0.4 : 1,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--accent)', padding: '0 10px', background: '#1e1e30', border: '1px solid #333', borderRadius: '4px' }}>
                {tokenInfo ? `$${tokenInfo.ticker}` : '---'}
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  disabled={!tokenInfo}
                  style={{
                    background: '#1e1e30', border: '1px solid #333',
                    color: '#aaa', padding: '5px 10px',
                    fontFamily: "'DM Mono', monospace", fontSize: '10px',
                    borderRadius: '3px', transition: 'all 0.15s',
                    opacity: !tokenInfo ? 0.4 : 1,
                  }}
                >
                  {p >= 1000000 ? `${p / 1000000}M` : p >= 1000 ? `${p / 1000}K` : p}
                </button>
              ))}
            </div>

            {/* USD value */}
            {tokenInfo && amount && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#555', marginBottom: '14px' }}>
                {tokenInfo.priceUsd > 0
                  ? <span style={{ color: tier.color }}>≈ ${usdValue.toFixed(4)} USD · {tier.label}</span>
                  : <span style={{ color: '#555' }}>Price unavailable — reach based on token amount only</span>
                }
              </div>
            )}

            {/* Reach preview */}
            {reach > 0 && (
              <div style={{ background: '#111122', borderRadius: '4px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Estimated Reach
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', color: 'var(--accent)', fontWeight: 700, textAlign: 'center' }}>
                  {formatReach(reach)}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#555', textAlign: 'center', marginTop: '4px' }}>
                  impressions
                </div>
              </div>
            )}

            {/* Coin badge preview */}
            {tokenInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#666' }}>
                <span style={{ color: '#aaa' }}>Your post will show:</span>
                <span style={{ background: '#1e1e30', border: '1px solid #333', padding: '3px 8px', borderRadius: '3px', color: 'var(--accent)' }}>
                  🪙 ${tokenInfo.ticker}
                </span>
                <span>on every impression</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !amount || Number(amount) <= 0}
              style={{
                width: '100%',
                background: isLoading ? '#555' : 'var(--accent)',
                color: 'var(--press)',
                border: 'none', padding: '13px',
                fontFamily: "'Playfair Display', serif",
                fontSize: '16px', fontWeight: 700,
                borderRadius: '4px', letterSpacing: '0.5px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
                opacity: isLoading || !amount || Number(amount) <= 0 ? 0.6 : 1,
              }}
            >
              {stepLabel}
            </button>

            {step === 'signing' && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#666' }}>
                Check your Phantom / Solflare wallet to approve
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
