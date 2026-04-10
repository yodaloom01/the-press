import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '../components/Header';
import { PostCard } from '../components/PostCard';
import { PressModal } from '../components/PressModal';
import { supabase, fetchProfile, updateProfile, uploadAvatar, followUser, unfollowUser, isFollowing, getFollowCounts, getUserNumber } from '../lib/supabase';
import { shortWallet, formatAmount } from '../lib/solana';
import { clearNameCache } from '../hooks/useSolanaName';
import { FollowListModal } from '../components/FollowListModal';
import toast from 'react-hot-toast';

const TraderProfile = ({ wallet, stats, profile }) => {
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAI = async () => {
      if (!stats.totalPosts) { setLoading(false); return; }
      try {
        // Check cache first
        const { data: cached } = await supabase
          .from('trader_profiles')
          .select('*')
          .eq('wallet_address', wallet)
          .single();

        const isStale = !cached ||
          (new Date() - new Date(cached.updated_at)) > 24 * 60 * 60 * 1000;

        if (cached && !isStale) {
          setAiSummary(cached.ai_summary);
          setLoading(false);
          return;
        }

        // Calculate loyalty metrics
        const uniqueCoins = stats.coinsUsed.length;
        const totalPosts = stats.totalPosts;
        const avgSpendPerPost = stats.totalPaid / totalPosts;
        const topCoin = stats.coinsUsed[0] || 'unknown';
        const loyaltyRatio = uniqueCoins / totalPosts;
        const isLoyal = loyaltyRatio <= 0.4;

        const prompt = `You are writing a one line trader personality summary for someone on The Press — a Solana platform where people pay memecoins to boost posts.

Write 1-2 punchy sentences (max 25 words total) that capture their personality and loyalty score. Be funny, sharp and specific to their coins. No generic crypto talk.

Their stats:
- Total posts: ${totalPosts}
- Total spent: $${stats.totalPaid.toFixed(2)}
- Average spend per post: $${avgSpendPerPost.toFixed(2)}
- Unique coins used: ${uniqueCoins}
- Coins used: ${stats.coinsUsed.join(', ')}
- Favorite coin: $${topCoin}
- Loyalty score: ${Math.round((1 - loyaltyRatio) * 10)}/10 — ${isLoyal ? `Loyal maxi, keeps posting the same coins (${uniqueCoins} coins across ${totalPosts} posts)` : `Coin hopper, new coin every post (${uniqueCoins} different coins across ${totalPosts} posts)`}

Respond with ONLY the sentence. No quotes. No explanation.`;

       const aiRes = await fetch('/api/ai-summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt })
});
        const aiData = await aiRes.json();
        const summary = aiData.content?.[0]?.text || '';

        // Save to cache
        await supabase.from('trader_profiles').upsert({
          wallet_address: wallet,
          ai_summary: summary,
          updated_at: new Date().toISOString(),
        });

        setAiSummary(summary);
      } catch (err) {
        console.error('AI summary error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAI();
  }, [wallet, stats]);

  if (!stats.totalPosts) return null;

  return (
    <div style={{ background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
        📊 FIELD ASSESSMENT
      </div>
      {loading ? (
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)' }}>
          Analyzing...
        </div>
      ) : aiSummary ? (
        <div style={{ 
          fontFamily: "'DM Mono', monospace", 
          fontSize: '12px', 
          color: '#00ff88', 
          background: '#000', 
          padding: '12px', 
          borderRadius: '4px',
          border: '1px solid #00ff8844',
          lineHeight: 1.8,
          letterSpacing: '0.5px'
        }}>
          <span style={{ color: '#555' }}>{'> INITIALIZING SCAN...'}</span><br/>
          <span style={{ color: '#555' }}>{'> WALLET ANALYZED'}</span><br/>
          <span style={{ color: '#00ff88' }}>{'> FIELD_ASSESSMENT.exe'}</span><br/>
          <span style={{ color: '#fff' }}>{aiSummary}</span>
        </div>
      ) : null}
    </div>
  );
};

export const Profile = () => {
  const { wallet } = useParams();
  const { publicKey } = useWallet();
  const isOwner = publicKey?.toBase58() === wallet;
  const fileRef = useRef();

  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ totalPaid: 0, totalPosts: 0, totalViews: 0, coinsUsed: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followLoading, setFollowLoading] = useState(false);
  const [followModal, setFollowModal] = useState(null);
  const [showPressModal, setShowPressModal] = useState(false);
  const [userNumber, setUserNumber] = useState(null); // 'followers' | 'following' | null
  const [mutuals, setMutuals] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [profileData, postsData] = await Promise.all([
        fetchProfile(wallet),
        supabase.from('posts').select('*').eq('wallet_address', wallet).order('created_at', { ascending: false }).then(r => r.data),
      ]);
      setProfile(profileData);
      getUserNumber(wallet).then(setUserNumber);
      const counts = await getFollowCounts(wallet);
      setFollowCounts(counts);
      if (publicKey && !isOwner) {
        const following = await isFollowing(publicKey.toBase58(), wallet);
        setFollowing(following);
      // Fetch mutuals
        const { data: myFollowing } = await supabase
          .from('follows')
          .select('following_wallet')
          .eq('follower_wallet', publicKey.toBase58());
        
        if (myFollowing && myFollowing.length > 0) {
          const myFollowingWallets = myFollowing.map(f => f.following_wallet);
          const { data: mutualData } = await supabase
            .from('follows')
            .select('follower_wallet')
            .eq('following_wallet', wallet)
            .in('follower_wallet', myFollowingWallets);
          
          if (mutualData && mutualData.length > 0) {
            setMutuals(mutualData.map(m => m.follower_wallet));
          }
        }
      }
      if (postsData) {
        setPosts(postsData);
        const coinsUsed = [...new Set(postsData.map(p => p.coin_ticker))];
        setStats({
          totalPosts: postsData.length,
          totalPaid: postsData.reduce((sum, p) => sum + Number(p.amount_paid_usd || 0), 0),
          totalViews: postsData.reduce((sum, p) => sum + Number(p.views || 0), 0),
          coinsUsed,
        });
      }
      setLoading(false);
    };
    load();
  }, [wallet]);

  const handleFollow = async () => {
    if (!publicKey) return;
    setFollowLoading(true);
    if (following) {
      await unfollowUser(publicKey.toBase58(), wallet);
      setFollowing(false);
      setFollowCounts(c => ({ ...c, followers: c.followers - 1 }));
    } else {
      await followUser(publicKey.toBase58(), wallet);
      setFollowing(true);
      setFollowCounts(c => ({ ...c, followers: c.followers + 1 }));
    }
    setFollowLoading(false);
  };

  const startEditing = () => {
    setEditUsername(profile?.username || '');
    setEditBio(profile?.bio || '');
    setAvatarPreview(null);
    setAvatarFile(null);
    setEditing(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!publicKey) return;
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile, wallet);
      }
      const result = await updateProfile(wallet, {
        username: editUsername.trim() || undefined,
        bio: editBio.trim() || undefined,
        avatarUrl,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        setProfile(result.data);
        clearNameCache(wallet);
        setEditing(false);
        toast.success('Profile updated!');
      }
    } catch (err) {
      toast.error('Failed to save profile');
    }
    setSaving(false);
  };

  const displayName = profile?.username ? `@${profile.username}` : shortWallet(wallet);
  const avatarUrl = avatarPreview || profile?.avatar_url;

  const statCard = (label, value) => (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700 }}>{value}</div>
    </div>
  );

  return (
    <>
      <Header onPressClick={() => setShowPressModal(true)} />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px', position: 'relative', zIndex: 1 }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)', marginBottom: '20px', textDecoration: 'none' }}>
          ← Back to The Press
        </Link>

        {/* Profile header */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--press)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', overflow: 'hidden', border: '2px solid var(--border)' }}>
              {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🗞️'}
            </div>
            {editing && (
              <>
                <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                  ✏️
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </>
            )}
          </div>

          {/* Name and bio */}
          <div style={{ flex: 1 }}>
            {editing ? (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--paper2)', border: '1px solid var(--border)', borderRadius: '4px 0 0 4px', padding: '0 8px', fontSize: '13px', color: 'var(--muted)', borderRight: 'none' }}>@</div>
                  <input
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
                    placeholder="username"
                    maxLength={20}
                    style={{ flex: 1, padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0 4px 4px 0', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Mono', monospace" }}
                  />
                </div>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Bio (optional)"
                  maxLength={160}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Sans', sans-serif", resize: 'none', height: '60px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent)', color: 'var(--press)', border: 'none', padding: '7px 16px', borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '7px 16px', borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '11px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700 }}>{displayName}</div>
                {userNumber && (
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#9944ff', marginTop: '2px', letterSpacing: '1px' }}>
                    Presser #{userNumber}
                  </div>
                )}
                {profile?.bio && <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>{profile.bio}</div>}
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginTop: '4px', opacity: 0.6 }}>{wallet}</div>
                {isOwner && (
                  <button onClick={startEditing} style={{ marginTop: '8px', background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '0.5px' }}>
                    ✏️ Edit Profile
                  </button>
                )}
                {!isOwner && publicKey && (
                  <button onClick={handleFollow} disabled={followLoading} style={{ marginTop: '8px', background: following ? 'none' : 'var(--accent)', color: following ? 'var(--muted)' : 'var(--press)', border: `1px solid ${following ? 'var(--border)' : 'var(--accent)'}`, padding: '5px 16px', borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '10px', cursor: 'pointer', fontWeight: 500 }}>
                    {followLoading ? '...' : following ? 'Following' : 'Follow'}
                  </button>
                )}
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                  <button onClick={() => setFollowModal('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{followCounts.followers}</span> followers
                  </button>
                  <button onClick={() => setFollowModal('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{followCounts.following}</span> following
                  </button>
                </div>
             {mutuals.length > 0 && (
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginTop: '6px' }}>
                    👥 Followed by{' '}
                    {mutuals.slice(0, 2).map((m, i) => (
                      <span key={m}>
                        <Link to={`/profile/${m}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                          {shortWallet(m)}
                        </Link>
                        {i < Math.min(mutuals.length, 2) - 1 ? ', ' : ''}
                      </span>
                    ))}
                    {mutuals.length > 2 && ` and ${mutuals.length - 2} others you follow`}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {statCard('Posts Pressed', stats.totalPosts)}
          {statCard('Total Spent', `$${stats.totalPaid.toFixed(2)}`)}
          {statCard('Total Views', formatAmount(stats.totalViews))}
        </div>

        {/* Coins used */}
        {stats.coinsUsed.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Coins Used to Press</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {stats.coinsUsed.map(coin => (
                <div key={coin} style={{ background: 'var(--ink)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '3px', fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500 }}>
                  🪙 ${coin}
                </div>
              ))}
            </div>
          </div>
        )}
  {/* Trader Profile */}
        <TraderProfile wallet={wallet} stats={stats} profile={profile} />        
{/* Posts */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: '13px' }}>Loading posts...</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>No posts pressed yet.</div>
        ) : (
         posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {followModal && (
        <FollowListModal
          wallet={wallet}
          type={followModal}
          count={followModal === 'followers' ? followCounts.followers : followCounts.following}
          onClose={() => setFollowModal(null)}
        />
      )}
      {showPressModal && (
        <PressModal
          onClose={() => setShowPressModal(false)}
          onSuccess={() => setShowPressModal(false)}
        />
      )}
    </>
  );
};
