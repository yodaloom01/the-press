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
import { WalletName } from '../components/WalletName';
import toast from 'react-hot-toast';

const mono = { fontFamily: "'Courier New', monospace" };

const ReactionBar = ({ targetWallet, viewerWallet }) => {
  const [reactions, setReactions] = useState({ '🚀': 0, '✅': 0, '💩': 0, '🖕': 0 });
  const [myReaction, setMyReaction] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('profile_reactions')
        .select('emoji, reactor_wallet')
        .eq('target_wallet', targetWallet);
      
      if (data) {
        const counts = { '🚀': 0, '✅': 0, '💩': 0, '🖕': 0 };
        data.forEach(r => { if (counts[r.emoji] !== undefined) counts[r.emoji]++; });
        setReactions(counts);
        if (viewerWallet) {
          const mine = data.find(r => r.reactor_wallet === viewerWallet);
          if (mine) setMyReaction(mine.emoji);
        }
      }
    };
    load();
  }, [targetWallet, viewerWallet]);

  const handleReact = async (emoji) => {
    if (!viewerWallet || viewerWallet === targetWallet) return;
    
    const prev = myReaction;
    setMyReaction(emoji);
    setReactions(r => ({
      ...r,
      ...(prev ? { [prev]: Math.max(0, r[prev] - 1) } : {}),
      [emoji]: r[emoji] + 1,
    }));

    await supabase.from('profile_reactions').upsert({
      reactor_wallet: viewerWallet,
      target_wallet: targetWallet,
      emoji,
    }, { onConflict: 'reactor_wallet,target_wallet' });
  };

  return (
    <div style={{ border: '2px solid #ff00ff', background: '#000', padding: '8px', marginBottom: '12px' }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#ff00ff', letterSpacing: '2px', marginBottom: '8px' }}>
        ** PRESS RATING **
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['🚀', '✅', '💩', '🖕'].map(emoji => (
          <button key={emoji} onClick={() => handleReact(emoji)}
            style={{ background: myReaction === emoji ? '#ff00ff' : '#c0c0c0', color: myReaction === emoji ? '#fff' : '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '4px 10px', fontFamily: "'Courier New', monospace", fontSize: '16px', cursor: viewerWallet && viewerWallet !== targetWallet ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {emoji} <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{reactions[emoji]}</span>
          </button>
        ))}
      </div>
      {!viewerWallet && <div style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#555', marginTop: '6px' }}>&gt; CONNECT WALLET TO RATE</div>}
      {viewerWallet === targetWallet && <div style={{ fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#555', marginTop: '6px' }}>&gt; CANNOT RATE YOURSELF</div>}
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
  const [userNumber, setUserNumber] = useState(null);
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
        const { data: myFollowing } = await supabase
          .from('follows').select('following_wallet').eq('follower_wallet', publicKey.toBase58());
        if (myFollowing && myFollowing.length > 0) {
          const myFollowingWallets = myFollowing.map(f => f.following_wallet);
          const { data: mutualData } = await supabase
            .from('follows').select('follower_wallet').eq('following_wallet', wallet).in('follower_wallet', myFollowingWallets);
          if (mutualData && mutualData.length > 0) setMutuals(mutualData.map(m => m.follower_wallet));
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
      if (avatarFile) avatarUrl = await uploadAvatar(avatarFile, wallet);
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

  const statCard = (label, value, color = '#00ff00') => (
    <div style={{ background: '#000', border: '2px solid #00ffff', padding: '10px', textAlign: 'center' }}>
      <div style={{ ...mono, fontSize: '8px', color: '#ff00ff', letterSpacing: '2px', marginBottom: '6px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ ...mono, fontSize: '22px', fontWeight: 900, color }}>{value}</div>
    </div>
  );

  return (
    <>
      <Header onPressClick={() => setShowPressModal(true)} />
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px', position: 'relative', zIndex: 1 }}>

        {/* Back link */}
        <Link to="/" style={{ ...mono, fontSize: '11px', color: '#00ffff', display: 'inline-block', marginBottom: '12px', textDecoration: 'none' }}>
          &lt;-- BACK TO THE PRESS
        </Link>

        {/* Profile window */}
        <div style={{ border: '2px solid #00ffff', background: '#000', marginBottom: '12px' }}>
          {/* Win95 title bar */}
          <div style={{ background: '#000080', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #00ffff' }}>
            <span style={{ ...mono, fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
              PRESSER_PROFILE.EXE — {displayName}
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {['_', 'X'].map(b => (
                <div key={b} style={{ width: '14px', height: '12px', background: '#c0c0c0', borderTop: '1px solid #fff', borderLeft: '1px solid #fff', borderBottom: '1px solid #444', borderRight: '1px solid #444', fontSize: '8px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{b}</div>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '72px', height: '72px', border: '3px solid #ff00ff', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🗞️'}
              </div>
              {editing && (
                <>
                  <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', background: '#ff00ff', border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✏️
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              {editing ? (
                <>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                    <span style={{ ...mono, fontSize: '12px', color: '#00ffff', padding: '4px 6px', background: '#000', border: '1px solid #00ffff' }}>@</span>
                    <input value={editUsername}
                      onChange={e => setEditUsername(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
                      placeholder="USERNAME"
                      maxLength={20}
                      style={{ flex: 1, padding: '4px 8px', background: '#000', border: '2px solid #00ffff', ...mono, fontSize: '12px', color: '#00ff00', outline: 'none' }} />
                  </div>
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                    placeholder="BIO (OPTIONAL)"
                    maxLength={160}
                    style={{ width: '100%', padding: '6px 8px', background: '#000', border: '2px solid #00ffff', ...mono, fontSize: '11px', color: '#00ff00', outline: 'none', resize: 'none', height: '50px', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={handleSave} disabled={saving}
                      style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '3px 12px', ...mono, fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'SAVING...' : '[SAVE]'}
                    </button>
                    <button onClick={() => setEditing(false)}
                      style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '3px 12px', ...mono, fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      [CANCEL]
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ ...mono, fontSize: '18px', fontWeight: 900, color: '#ff00ff', textShadow: '2px 2px #00ffff' }}>{displayName}</div>
                  {userNumber && (
                    <div style={{ ...mono, fontSize: '9px', color: '#ffff00', letterSpacing: '2px', animation: 'blink 2s infinite', marginTop: '2px' }}>
                      ** PRESSER #{userNumber} **
                    </div>
                  )}
                  {profile?.bio && <div style={{ ...mono, fontSize: '11px', color: '#888', marginTop: '4px', lineHeight: 1.5 }}>&gt; {profile.bio}</div>}
                  <div style={{ ...mono, fontSize: '9px', color: '#333', marginTop: '4px' }}>{wallet}</div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {isOwner && (
                      <button onClick={startEditing}
                        style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '2px 10px', ...mono, fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        [EDIT PROFILE]
                      </button>
                    )}
                    {!isOwner && publicKey && (
                      <button onClick={handleFollow} disabled={followLoading}
                        style={{ background: following ? '#c0c0c0' : '#ff0000', color: following ? '#000' : '#ffff00', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '2px 10px', ...mono, fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {followLoading ? '...' : following ? '[FOLLOWING]' : '[+ FOLLOW]'}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button onClick={() => setFollowModal('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...mono, fontSize: '10px', color: '#888' }}>
                      <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{followCounts.followers}</span> FOLLOWERS
                    </button>
                    <button onClick={() => setFollowModal('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...mono, fontSize: '10px', color: '#888' }}>
                      <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{followCounts.following}</span> FOLLOWING
                    </button>
                  </div>

                  {mutuals.length > 0 && (
                    <div style={{ ...mono, fontSize: '10px', color: '#888', marginTop: '6px' }}>
                      &gt; FOLLOWED BY{' '}
                      {mutuals.slice(0, 2).map((m, i) => (
                        <span key={m}>
                          <Link to={`/profile/${m}`} style={{ color: '#00ffff', textDecoration: 'none' }}>
                            <WalletName address={m} />
                          </Link>
                          {i < Math.min(mutuals.length, 2) - 1 ? ', ' : ''}
                        </span>
                      ))}
                      {mutuals.length > 2 && ` AND ${mutuals.length - 2} OTHERS`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
          {statCard('POSTS PRESSED', stats.totalPosts, '#00ff00')}
          {statCard('TOTAL SPENT', `$${stats.totalPaid.toFixed(2)}`, '#ffff00')}
          {statCard('TOTAL VIEWS', formatAmount(stats.totalViews), '#ff00ff')}
        </div>

        {/* Coins used */}
        {stats.coinsUsed.length > 0 && (
          <div style={{ border: '2px solid #ff00ff', background: '#000', padding: '8px', marginBottom: '12px' }}>
            <div style={{ ...mono, fontSize: '8px', color: '#ff00ff', letterSpacing: '2px', marginBottom: '8px' }}>** COINS USED TO PRESS **</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {stats.coinsUsed.map(coin => (
                <div key={coin} style={{ background: '#000', border: '1px solid #ff00ff', color: '#ff00ff', padding: '3px 8px', ...mono, fontSize: '10px', fontWeight: 'bold' }}>
                  ** ${coin} **
                </div>
              ))}
            </div>
          </div>
        )}
{/* Reaction Bar */}
<ReactionBar targetWallet={wallet} viewerWallet={publicKey?.toBase58()} />

        {/* Posts */}
        <div style={{ border: '2px solid #00ffff', background: '#000', marginBottom: '12px' }}>
          <div style={{ background: '#000080', padding: '2px 8px', borderBottom: '1px solid #00ffff' }}>
            <span style={{ ...mono, fontSize: '10px', color: '#ffff00', fontWeight: 'bold' }}>** PRESSED POSTS **</span>
          </div>
          <div style={{ padding: '8px' }}>
            {loading ? (
              <div style={{ ...mono, fontSize: '12px', color: '#00ff00', padding: '20px', textAlign: 'center', animation: 'blink 1s infinite' }}>
                &gt; LOADING POSTS..._
              </div>
            ) : posts.length === 0 ? (
              <div style={{ ...mono, fontSize: '11px', color: '#444', padding: '20px', textAlign: 'center' }}>
                &gt; NO POSTS PRESSED YET
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))} />)
            )}
          </div>
        </div>
      </div>

      {followModal && (
        <FollowListModal wallet={wallet} type={followModal}
          count={followModal === 'followers' ? followCounts.followers : followCounts.following}
          onClose={() => setFollowModal(null)} />
      )}
      {showPressModal && (
        <PressModal onClose={() => setShowPressModal(false)} onSuccess={() => setShowPressModal(false)} />
      )}
    </>
  );
};
