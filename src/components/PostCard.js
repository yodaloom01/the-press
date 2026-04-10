import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import { formatAmount, shortWallet } from '../lib/solana';
import { recordImpression, likePost, hasLiked, fetchComments, fetchReplies, addComment, subscribeToComments, recordShare, likeComment, hasLikedComment, repressPost, hasRepressed, fetchQuotedPost } from '../lib/supabase';
import { format } from 'timeago.js';
import { WalletName, WalletAvatar } from './WalletName';
import { QuotePressModal } from './QuotePressModal';

const ReplyItem = ({ reply, walletAddress, postId }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Number(reply.likes) || 0);

  useEffect(() => {
    if (walletAddress) hasLikedComment(reply.id, walletAddress).then(setLiked);
  }, [reply.id, walletAddress]);

  const handleLike = async () => {
    if (!walletAddress || liked) return;
    const result = await likeComment(reply.id, walletAddress, reply.wallet_address, postId);
    if (!result.alreadyLiked) { setLiked(true); setLikeCount(c => c + 1); }
  };

  return (
    <div style={{ marginLeft: '34px', marginBottom: '8px', display: 'flex', gap: '8px' }}>
      <WalletAvatar address={reply.wallet_address} size={22} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: '2px' }}>
          <Link to={`/profile/${reply.wallet_address}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}><WalletName address={reply.wallet_address} /></Link>
          {' · '}{format(reply.created_at)}
        </div>
        <div style={{ fontSize: '12px', lineHeight: 1.4 }}>{reply.content}</div>
        <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', fontSize: '10px', color: liked ? 'var(--accent2)' : 'var(--muted)', background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer', padding: 0 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          {likeCount > 0 ? likeCount : ''}
        </button>
      </div>
    </div>
  );
};

const CommentItem = ({ comment, walletAddress, postId, postOwnerWallet }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Number(comment.likes) || 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesCount, setRepliesCount] = useState(Number(comment.replies_count) || 0);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (walletAddress) hasLikedComment(comment.id, walletAddress).then(setLiked);
  }, [comment.id, walletAddress]);

  useEffect(() => {
    if (!showReplies) return;
    fetchReplies(comment.id).then(setReplies);
  }, [showReplies, comment.id]);

  const handleLike = async () => {
    if (!walletAddress || liked) return;
    const result = await likeComment(comment.id, walletAddress, comment.wallet_address, postId);
    if (!result.alreadyLiked) { setLiked(true); setLikeCount(c => c + 1); }
  };

  const handleReply = async () => {
    if (!walletAddress || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const newReply = await addComment(postId, walletAddress, replyText.trim(), postOwnerWallet, comment.id, comment.wallet_address);
      setReplies(prev => [...prev, newReply]);
      setRepliesCount(c => c + 1);
      setReplyText('');
      setShowReplies(true);
      setShowReplyInput(false);
    } catch {}
    setSubmitting(false);
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <WalletAvatar address={comment.wallet_address} size={26} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: '2px' }}>
            <Link to={`/profile/${comment.wallet_address}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}><WalletName address={comment.wallet_address} /></Link>
            {' · '}{format(comment.created_at)}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{comment.content}</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
            <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: liked ? 'var(--accent2)' : 'var(--muted)', background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer', padding: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              {likeCount > 0 ? likeCount : ''}
            </button>
            {walletAddress && (
              <button onClick={() => setShowReplyInput(!showReplyInput)} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Mono', monospace" }}>
                Reply
              </button>
            )}
            {repliesCount > 0 && (
              <button onClick={() => setShowReplies(!showReplies)} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Mono', monospace" }}>
                {showReplies ? 'Hide' : `${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {showReplyInput && (
        <div style={{ marginLeft: '34px', marginTop: '8px', display: 'flex', gap: '8px' }}>
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReply()}
            placeholder={`Reply to ${shortWallet(comment.wallet_address)}...`}
            style={{ flex: 1, padding: '6px 10px', background: 'var(--paper2)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
          />
          <button onClick={handleReply} disabled={!replyText.trim() || submitting} style={{ background: 'var(--accent)', color: 'var(--press)', border: 'none', padding: '6px 10px', borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, cursor: 'pointer', opacity: !replyText.trim() || submitting ? 0.5 : 1 }}>
            Post
          </button>
        </div>
      )}

      {showReplies && replies.map(r => <ReplyItem key={r.id} reply={r} walletAddress={walletAddress} postId={postId} />)}
    </div>
  );
};

export const PostCard = ({ post, onLike }) => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Number(post.likes) || 0);
  const [repressed, setRepressed] = useState(false);
  const [repressCount, setRepressCount] = useState(Number(post.repress_count) || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(Number(post.comments_count) || 0);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [views, setViews] = useState(Number(post.views) || 0);
  const [visibleComments, setVisibleComments] = useState(5);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quotedPost, setQuotedPost] = useState(null);
  const impressionRecorded = useRef(false);
  const cardRef = useRef();

  useEffect(() => {
    if (post.quote_of) {
      fetchQuotedPost(post.quote_of).then(setQuotedPost);
    }
  }, [post.quote_of]);

  useEffect(() => {
    if (impressionRecorded.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Post is at least 50% visible — start 1 second timer
            const timer = setTimeout(() => {
              if (!impressionRecorded.current) {
                impressionRecorded.current = true;
                recordImpression(post.id, walletAddress);
                setViews(v => v + 1);
                observer.disconnect();
              }
            }, 1000);
            entry.target._timer = timer;
          } else {
            // Post scrolled out before 1 second — cancel timer
            if (entry.target._timer) {
              clearTimeout(entry.target._timer);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post.id, walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      hasLiked(post.id, walletAddress).then(setLiked);
      hasRepressed(post.id, walletAddress).then(setRepressed);
    }
  }, [post.id, walletAddress]);

  useEffect(() => {
    const unsub = subscribeToComments(post.id, (newComment) => {
      if (newComment.parent_id) return; // ignore replies for top-level count
      setCommentCount(c => c + 1);
      if (showComments) {
        setComments(prev => {
          if (prev.find(c => c.id === newComment.id)) return prev;
          return [...prev, newComment];
        });
      }
    });
    return unsub;
  }, [post.id, showComments]);

  useEffect(() => {
    if (!showComments) return;
    fetchComments(post.id).then(setComments);
  }, [showComments, post.id]);

  const handleLike = async () => {
    if (!walletAddress || liked) return;
    const result = await likePost(post.id, walletAddress, post.wallet_address);
    if (!result.alreadyLiked) {
      setLiked(true);
      setLikeCount(c => c + 1);
      if (onLike) onLike(post.id);
    }
  };

  const handleComment = async () => {
    if (!walletAddress || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await addComment(post.id, walletAddress, commentText.trim(), post.wallet_address);
      setCommentText('');
      setComments(prev => {
        if (prev.find(c => c.id === newComment.id)) return prev;
        return [...prev, newComment];
      });
      setCommentCount(c => c + 1);
    } catch {}
    setSubmittingComment(false);
  };

  const handleRepress = async () => {
    if (!walletAddress) return;
    const result = await repressPost(post.id, walletAddress, post.wallet_address);
    setRepressed(result.repressed);
    setRepressCount(c => result.repressed ? c + 1 : c - 1);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    recordShare(post.id);
  };

  const reachTarget = Number(post.reach_target) || 0;
  const remainingImpressions = Math.max(0, reachTarget - views);
  const impressionPct = reachTarget > 0 ? Math.min(100, (views / reachTarget) * 100) : 0;
  const formatViews = (n) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : n.toString();

  return (
    <div ref={cardRef} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '16px', overflow: 'hidden', animation: 'fadeIn 0.3s ease forwards' }}>

      {/* Repressed by banner */}
      {post.repressed_by && (
        <div style={{ padding: '6px 14px', background: 'var(--paper2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          <WalletName address={post.repressed_by} asLink style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: "'DM Mono', monospace" }} />
          <span>repressed</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WalletAvatar address={post.wallet_address} size={32} />
          <div>
            <WalletName address={post.wallet_address} asLink style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }} />
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{format(post.created_at)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--ink)', color: 'var(--accent)', padding: '4px 9px', borderRadius: '3px', fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500 }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
          <a href={`https://pump.fun/coin/${post.coin_mint}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>🪙 ${post.coin_ticker}</a>
        </div>
      </div>

      {/* Media */}
      {post.media_url && (
        post.media_type === 'video'
          ? <video style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', display: 'block', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} src={post.media_url} controls muted loop playsInline />
          : <img style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', display: 'block', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} src={post.media_url} alt={post.caption || 'press post'} />
      )}

      {/* Caption */}
      {post.caption && <div style={{ padding: '10px 14px', fontSize: '14px', lineHeight: 1.5 }}>{post.caption}</div>}

      {/* Quoted post preview */}
      {quotedPost && (
        <div style={{ margin: '0 14px 10px', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', background: 'var(--paper2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <WalletAvatar address={quotedPost.wallet_address} size={20} />
            <WalletName address={quotedPost.wallet_address} asLink style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }} />
            <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{format(quotedPost.created_at)}</span>
            <span style={{ marginLeft: 'auto', background: 'var(--ink)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '3px', fontFamily: "'DM Mono', monospace", fontSize: '9px' }}>🪙 ${quotedPost.coin_ticker}</span>
          </div>
          {quotedPost.media_url && <img src={quotedPost.media_url} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px', display: 'block' }} />}
          {quotedPost.caption && <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4 }}>{quotedPost.caption}</div>}
        </div>
      )}

      {/* Impression bar */}
      {reachTarget > 0 && (
        <div style={{ margin: '0 14px 4px' }}>
          <div style={{ height: '3px', background: 'var(--paper2)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${impressionPct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius: '2px' }} />
          </div>
        </div>
      )}

      {/* Paid label */}
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--muted)', padding: '4px 14px 8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Paid to press</span>
        <span style={{ color: 'var(--green)', fontWeight: 500 }}>{formatAmount(Number(post.amount_paid))} ${post.coin_ticker}</span>
      </div>

      {/* Stats row */}
      <div style={{ padding: '8px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: liked ? 'var(--accent2)' : 'var(--muted)', background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {likeCount}
          </button>
          <button onClick={handleRepress} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: repressed ? 'var(--green)' : 'var(--muted)', background: 'none', border: 'none', cursor: walletAddress ? 'pointer' : 'default', padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            {repressCount > 0 ? repressCount : ''}
          </button>
          <button onClick={() => setShowComments(!showComments)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: showComments ? 'var(--text)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {commentCount}
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {formatViews(views)}
            {reachTarget > 0 && <span style={{ color: remainingImpressions > 0 ? 'var(--green)' : 'var(--muted)', fontSize: '10px' }}>/{formatViews(reachTarget)}</span>}
          </span>
        </div>
        <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: copied ? 'var(--green)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>
          {copied ? '✓ Copied!' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share</>}
        </button>
        {walletAddress && (
          <button onClick={() => setShowQuoteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>
            Quote
          </button>
        )}
{walletAddress === post.wallet_address && (
  <button onClick={async () => {
    if (window.confirm('Delete this post? No refunds.')) {
      await supabase.from('posts').update({ is_active: false }).eq('id', post.id);
      toast.success('Post deleted');
    }
  }} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#ff4466', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace", padding: 0 }}>
    🗑 Delete
  </button>
)}
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
          {comments.length === 0 && <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px', fontStyle: 'italic' }}>No comments yet — be the first</div>}
          {comments.slice(0, visibleComments).map(c => <CommentItem key={c.id} comment={c} walletAddress={walletAddress} postId={post.id} postOwnerWallet={post.wallet_address} />)}
          {comments.length > visibleComments && (
            <button
              onClick={() => setVisibleComments(v => v + 5)}
              style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: "'DM Mono', monospace", marginBottom: '8px' }}
            >
              Show {Math.min(5, comments.length - visibleComments)} more comment{Math.min(5, comments.length - visibleComments) !== 1 ? 's' : ''}
            </button>
          )}
          {visibleComments > 5 && comments.length <= visibleComments && (
            <button
              onClick={() => setVisibleComments(5)}
              style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: "'DM Mono', monospace", marginBottom: '8px' }}
            >
              Show less
            </button>
          )}
          {walletAddress ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} placeholder="Add a comment..." style={{ flex: 1, padding: '7px 10px', background: 'var(--paper2)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
              <button onClick={handleComment} disabled={!commentText.trim() || submittingComment} style={{ background: 'var(--accent)', color: 'var(--press)', border: 'none', padding: '7px 12px', borderRadius: '4px', fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500, cursor: 'pointer', opacity: !commentText.trim() || submittingComment ? 0.5 : 1 }}>Post</button>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>Connect wallet to comment</div>
          )}
        </div>
      )}

      {showQuoteModal && (
        <QuotePressModal
          post={post}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={() => setShowQuoteModal(false)}
        />
      )}
    </div>
  );
};
