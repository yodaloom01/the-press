import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Upload media ──────────────────────────────────────────────
export const uploadMedia = async (file, walletAddress) => {
  const ext = file.name.split('.').pop();
  const filename = `${walletAddress}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('press-media')
    .upload(filename, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('press-media').getPublicUrl(data.path);
  return urlData.publicUrl;
};

// ── Create post ───────────────────────────────────────────────
export const createPost = async ({
  walletAddress, caption, mediaUrl, mediaType,
  coinTicker, coinMint, amountPaid, amountPaidUsd, txSignature, reachTarget, quoteOf,
}) => {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      wallet_address: walletAddress, caption,
      media_url: mediaUrl, media_type: mediaType,
      coin_ticker: coinTicker, coin_mint: coinMint,
      amount_paid: amountPaid, amount_paid_usd: amountPaidUsd,
      tx_signature: txSignature, reach_target: reachTarget,
      quote_of: quoteOf || null,
    })
    .select().single();
  if (error) throw error;
  try {
    await supabase.rpc('upsert_coin_stats', { p_ticker: coinTicker, p_mint: coinMint, p_amount: amountPaid });
  } catch {}
  return data;
};

// ── Trending score ────────────────────────────────────────────
const getTrendingScore = (post) => {
  const shares = Number(post.shares) || 0;
  const likes = Number(post.likes) || 0;
  const comments = Number(post.comments_count) || 0;
  const views = Number(post.views) || 0;
  const hoursAgo = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
  const engagement = (shares * 10) + (likes * 3) + (comments * 5) + (views * 1);
  return engagement / Math.pow(hoursAgo + 2, 1.5);
};

// ── Fetch feed posts ──────────────────────────────────────────
export const fetchPosts = async (sortBy = 'weighted', limit = 20) => {
  const { data, error } = await supabase
    .from('posts').select('*').eq('is_active', true).limit(limit * 2);
  if (error) throw error;
  const posts = data || [];
  if (sortBy === 'weighted') {
    return posts.sort((a, b) => {
      const aRemaining = Math.max(0, Number(a.reach_target) - Number(a.views));
      const bRemaining = Math.max(0, Number(b.reach_target) - Number(b.views));
      if (bRemaining !== aRemaining) return bRemaining - aRemaining;
      return Number(b.amount_paid_usd) - Number(a.amount_paid_usd);
    }).slice(0, limit);
  }
  if (sortBy === 'trending') return posts.sort((a, b) => getTrendingScore(b) - getTrendingScore(a)).slice(0, limit);
  if (sortBy === 'amount_paid_usd') return posts.sort((a, b) => Number(b.amount_paid_usd) - Number(a.amount_paid_usd)).slice(0, limit);
  if (sortBy === 'created_at') return posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  return posts.slice(0, limit);
};

// ── Fetch single post ─────────────────────────────────────────
export const fetchPost = async (id) => {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const fetchQuotedPost = async (id) => {
  if (!id) return null;
  const { data } = await supabase.from('posts').select('*').eq('id', id).single();
  return data || null;
};

// ── Record impression ─────────────────────────────────────────
export const recordImpression = async (postId, walletAddress) => {
  try {
    // Check if this wallet already viewed this post
    if (walletAddress) {
      const { data: existing } = await supabase
        .from('impressions')
        .select('id')
        .eq('post_id', postId)
        .eq('wallet_address', walletAddress)
        .single();
      if (existing) return; // already counted
      await supabase.from('impressions').insert({ post_id: postId, wallet_address: walletAddress });
    } else {
      // Anonymous visitor — still count but no wallet
      await supabase.from('impressions').insert({ post_id: postId });
    }
    await supabase.rpc('increment_views', { post_id: postId });
  } catch {}
};

// ── Record share ──────────────────────────────────────────────
export const recordShare = async (postId) => {
  try { await supabase.rpc('increment_shares', { post_id: postId }); } catch {}
};

// ── Like a post ───────────────────────────────────────────────
export const likePost = async (postId, walletAddress, postOwnerWallet) => {
  const { data: existing } = await supabase
    .from('likes').select('id').eq('post_id', postId).eq('wallet_address', walletAddress).single();
  if (existing) return { alreadyLiked: true };
  await supabase.from('likes').insert({ post_id: postId, wallet_address: walletAddress });
  await supabase.rpc('increment_likes', { post_id: postId, wallet: walletAddress });
  if (postOwnerWallet && postOwnerWallet !== walletAddress) {
    await createNotification({ recipientWallet: postOwnerWallet, senderWallet: walletAddress, type: 'like_post', postId });
  }
  return { alreadyLiked: false };
};

// ── Check if liked ────────────────────────────────────────────
export const hasLiked = async (postId, walletAddress) => {
  if (!walletAddress) return false;
  const { data } = await supabase.from('likes').select('id').eq('post_id', postId).eq('wallet_address', walletAddress).single();
  return !!data;
};

// ── Comments ──────────────────────────────────────────────────
export const fetchComments = async (postId) => {
  const { data, error } = await supabase
    .from('comments').select('*').eq('post_id', postId).is('parent_id', null)
    .order('likes', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchReplies = async (commentId) => {
  const { data, error } = await supabase
    .from('comments').select('*').eq('parent_id', commentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const addComment = async (postId, walletAddress, content, postOwnerWallet, parentId = null, parentOwnerWallet = null) => {
  const { data, error } = await supabase
    .from('comments').insert({ post_id: postId, wallet_address: walletAddress, content, parent_id: parentId })
    .select().single();
  if (error) throw error;
  if (parentId) {
    const { data: parent } = await supabase.from('comments').select('replies_count').eq('id', parentId).single();
    await supabase.from('comments').update({ replies_count: (Number(parent?.replies_count) || 0) + 1 }).eq('id', parentId);
    if (parentOwnerWallet && parentOwnerWallet !== walletAddress) {
      await createNotification({ recipientWallet: parentOwnerWallet, senderWallet: walletAddress, type: 'reply', postId, commentId: data.id });
    }
  } else {
    await supabase.rpc('increment_comments_count', { post_id: postId });
    if (postOwnerWallet && postOwnerWallet !== walletAddress) {
      await createNotification({ recipientWallet: postOwnerWallet, senderWallet: walletAddress, type: 'comment', postId, commentId: data.id });
    }
  }
  return data;
};

export const subscribeToComments = (postId, callback) => {
  const channel = supabase
    .channel(`comments-${postId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
      (payload) => callback(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
};

// ── Comment likes ─────────────────────────────────────────────
export const likeComment = async (commentId, walletAddress, commentOwnerWallet, postId) => {
  const { data: existing } = await supabase
    .from('comment_likes').select('id').eq('comment_id', commentId).eq('wallet_address', walletAddress).single();
  if (existing) return { alreadyLiked: true };
  await supabase.from('comment_likes').insert({ comment_id: commentId, wallet_address: walletAddress });
  const { data: comment } = await supabase.from('comments').select('likes').eq('id', commentId).single();
  await supabase.from('comments').update({ likes: (Number(comment?.likes) || 0) + 1 }).eq('id', commentId);
  if (commentOwnerWallet && commentOwnerWallet !== walletAddress) {
    await createNotification({ recipientWallet: commentOwnerWallet, senderWallet: walletAddress, type: 'like_comment', postId, commentId });
  }
  return { alreadyLiked: false };
};

export const hasLikedComment = async (commentId, walletAddress) => {
  if (!walletAddress) return false;
  const { data } = await supabase.from('comment_likes').select('id').eq('comment_id', commentId).eq('wallet_address', walletAddress).single();
  return !!data;
};

// ── Profiles / Usernames ──────────────────────────────────────
export const fetchProfile = async (walletAddress) => {
  const { data } = await supabase.from('profiles').select('*').eq('wallet_address', walletAddress).single();
  return data || null;
};

export const setUsername = async (walletAddress, username) => {
  const { data: existing } = await supabase
    .from('profiles').select('wallet_address').eq('username', username.toLowerCase()).single();
  if (existing && existing.wallet_address !== walletAddress) {
    return { error: 'Username already taken' };
  }
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ wallet_address: walletAddress, username: username.toLowerCase(), updated_at: new Date().toISOString() })
    .select().single();
  if (error) return { error: error.message };
  return { data };
};

export const updateProfile = async (walletAddress, { username, bio, avatarUrl }) => {
  const updates = { wallet_address: walletAddress, updated_at: new Date().toISOString() };
  if (username !== undefined) {
    // Check username not taken
    if (username) {
      const { data: existing } = await supabase
        .from('profiles').select('wallet_address').eq('username', username.toLowerCase()).single();
      if (existing && existing.wallet_address !== walletAddress) {
        return { error: 'Username already taken' };
      }
      updates.username = username.toLowerCase();
    }
  }
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

  const { data, error } = await supabase
    .from('profiles').upsert(updates).select().single();
  if (error) return { error: error.message };
  return { data };
};

export const uploadAvatar = async (file, walletAddress) => {
  const ext = file.name.split('.').pop();
  const filename = `avatars/${walletAddress}.${ext}`;
  const { data, error } = await supabase.storage
    .from('press-media')
    .upload(filename, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('press-media').getPublicUrl(data.path);
  return urlData.publicUrl;
};

export const fetchUsernameByWallet = async (walletAddress) => {
  const { data } = await supabase.from('profiles').select('username').eq('wallet_address', walletAddress).single();
  return data?.username || null;
};

// ── Notifications ─────────────────────────────────────────────
export const createNotification = async ({ recipientWallet, senderWallet, type, postId, commentId }) => {
  try {
    await supabase.from('notifications').insert({
      recipient_wallet: recipientWallet,
      sender_wallet: senderWallet,
      type,
      post_id: postId || null,
      comment_id: commentId || null,
    });
  } catch {}
};

export const fetchNotifications = async (walletAddress) => {
  const { data, error } = await supabase
    .from('notifications').select('*')
    .eq('recipient_wallet', walletAddress)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
};

export const markNotificationsRead = async (walletAddress) => {
  await supabase.from('notifications')
    .update({ read: true })
    .eq('recipient_wallet', walletAddress)
    .eq('read', false);
};

export const subscribeToNotifications = (walletAddress, callback) => {
  const channel = supabase
    .channel(`notifications-${walletAddress}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_wallet=eq.${walletAddress}` },
      (payload) => callback(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
};

// ── Real-time new posts ───────────────────────────────────────
export const subscribeToNewPosts = (callback) => {
  const channel = supabase
    .channel('new-posts')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'posts' },
      (payload) => callback(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
};

// ── Follows ───────────────────────────────────────────────────
export const followUser = async (followerWallet, followingWallet) => {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_wallet: followerWallet, following_wallet: followingWallet });
  if (!error) {
    await createNotification({ recipientWallet: followingWallet, senderWallet: followerWallet, type: 'follow', postId: null, commentId: null });
  }
  return !error;
};

export const unfollowUser = async (followerWallet, followingWallet) => {
  await supabase.from('follows')
    .delete()
    .eq('follower_wallet', followerWallet)
    .eq('following_wallet', followingWallet);
};

export const isFollowing = async (followerWallet, followingWallet) => {
  const { data } = await supabase.from('follows').select('id')
    .eq('follower_wallet', followerWallet).eq('following_wallet', followingWallet).single();
  return !!data;
};

export const getFollowCounts = async (walletAddress) => {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact' }).eq('following_wallet', walletAddress),
    supabase.from('follows').select('id', { count: 'exact' }).eq('follower_wallet', walletAddress),
  ]);
  return { followers: followers.count || 0, following: following.count || 0 };
};

export const getFollowingList = async (walletAddress) => {
  const { data } = await supabase.from('follows').select('following_wallet').eq('follower_wallet', walletAddress);
  return (data || []).map(r => r.following_wallet);
};

// ── Represses ─────────────────────────────────────────────────
export const repressPost = async (postId, walletAddress, postOwnerWallet) => {
  const { data: existing } = await supabase.from('represses').select('id')
    .eq('post_id', postId).eq('wallet_address', walletAddress).single();
  if (existing) {
    // Un-repress
    await supabase.from('represses').delete().eq('post_id', postId).eq('wallet_address', walletAddress);
    const { data: post } = await supabase.from('posts').select('repress_count').eq('id', postId).single();
    await supabase.from('posts').update({ repress_count: Math.max(0, (Number(post?.repress_count) || 0) - 1) }).eq('id', postId);
    return { repressed: false };
  }
  await supabase.from('represses').insert({ post_id: postId, wallet_address: walletAddress });
  const { data: post } = await supabase.from('posts').select('repress_count').eq('id', postId).single();
  await supabase.from('posts').update({ repress_count: (Number(post?.repress_count) || 0) + 1 }).eq('id', postId);
  if (postOwnerWallet && postOwnerWallet !== walletAddress) {
    await createNotification({ recipientWallet: postOwnerWallet, senderWallet: walletAddress, type: 'repress', postId });
  }
  return { repressed: true };
};

export const hasRepressed = async (postId, walletAddress) => {
  if (!walletAddress) return false;
  const { data } = await supabase.from('represses').select('id')
    .eq('post_id', postId).eq('wallet_address', walletAddress).single();
  return !!data;
};

// ── Following feed ────────────────────────────────────────────
export const fetchFollowingPosts = async (walletAddress, limit = 20) => {
  const following = await getFollowingList(walletAddress);
  if (!following.length) return [];

  // Get posts created by people you follow
  const { data: createdPosts } = await supabase.from('posts').select('*')
    .in('wallet_address', following).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(limit);

  // Get posts repressed by people you follow
  const { data: repressData } = await supabase.from('represses').select('post_id, wallet_address, created_at')
    .in('wallet_address', following)
    .order('created_at', { ascending: false }).limit(limit);

  let repressedPosts = [];
  if (repressData && repressData.length > 0) {
    const postIds = [...new Set(repressData.map(r => r.post_id))];
    const { data: rPosts } = await supabase.from('posts').select('*')
      .in('id', postIds).eq('is_active', true);

    // Attach who repressed it so we can show "repressed by @x"
    repressedPosts = (rPosts || []).map(post => {
      const repress = repressData.find(r => r.post_id === post.id);
      return {
        ...post,
        repressed_by: repress?.wallet_address,
        repress_time: repress?.created_at,
      };
    });
  }

  // Merge, deduplicate, sort by most recent activity
  const allPosts = [...(createdPosts || []), ...repressedPosts];
  const seen = new Set();
  const deduped = allPosts.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return deduped.sort((a, b) => {
    const aTime = a.repress_time || a.created_at;
    const bTime = b.repress_time || b.created_at;
    return new Date(bTime) - new Date(aTime);
  }).slice(0, limit);
};

// ── Quote post ────────────────────────────────────────────────
export const createQuotePost = async ({ walletAddress, caption, mediaUrl, mediaType, coinTicker, coinMint, amountPaid, amountPaidUsd, txSignature, reachTarget, quoteOf }) => {
  const { data, error } = await supabase.from('posts').insert({
    wallet_address: walletAddress, caption,
    media_url: mediaUrl, media_type: mediaType,
    coin_ticker: coinTicker, coin_mint: coinMint,
    amount_paid: amountPaid, amount_paid_usd: amountPaidUsd,
    tx_signature: txSignature, reach_target: reachTarget,
    quote_of: quoteOf,
  }).select().single();
  if (error) throw error;
  return data;
};

// ── User Registry ─────────────────────────────────────────────
export const registerUser = async (walletAddress) => {
  try {
    const { data: existing } = await supabase
      .from('users').select('user_number').eq('wallet_address', walletAddress).single();
    if (existing) return existing.user_number;
    const { data } = await supabase
      .from('users').insert({ wallet_address: walletAddress }).select('user_number').single();
    return data?.user_number || null;
  } catch {}
  return null;
};

export const getUserNumber = async (walletAddress) => {
  try {
    const { data } = await supabase
      .from('users').select('user_number').eq('wallet_address', walletAddress).single();
    return data?.user_number || null;
  } catch {}
  return null;
};

export const getTotalUsers = async () => {
  try {
    const { count } = await supabase
      .from('users').select('*', { count: 'exact', head: true });
    return count || 0;
  } catch {}
  return 0;
};
