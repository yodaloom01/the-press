import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import { formatAmount, shortWallet } from '../lib/solana';
import { supabase, recordImpression, likePost, hasLiked, fetchComments, fetchReplies, addComment, subscribeToComments, recordShare, likeComment, hasLikedComment, repressPost, hasRepressed, fetchQuotedPost } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'timeago.js';
import { WalletName, WalletAvatar } from './WalletName';
import { QuotePressModal } from './QuotePressModal';

const mono = { fontFamily: "'Courier New', monospace" };

const RetroBtn = ({ onClick, color = '#888', children, style = {} }) => (
  <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '1px', ...mono, ...style }}>
    {children}
  </button>
);

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
    <div style={{ marginLeft: '28px', marginBottom: '6px', display: 'flex', gap: '6px' }}>
      <WalletAvatar address={reply.wallet_address} size={20} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: '#888', ...mono, marginBottom: '2px' }}>
          <Link to={`/profile/${reply.wallet_address}`} style={{ color: '#00ffff', textDecoration: 'none' }}><WalletName address={reply.wallet_address} /></Link>
          {' // '}{format(reply.created_at)}
        </div>
        <div style={{ fontSize: '11px', color: '#00ff00', lineHeight: 1.4 }}>{reply.content}</div>
        <RetroBtn onClick={handleLike} color={liked ? '#ff4444' : '#555'}>
          [{liked ? '♥' : '♡'} {likeCount > 0 ? likeCount : '0'}]
        </RetroBtn>
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
    <div style={{ marginBottom: '10px', borderLeft: '2px solid #00ffff', paddingLeft: '8px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <WalletAvatar address={comment.wallet_address} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: '#888', ...mono, marginBottom: '2px' }}>
            <Link to={`/profile/${comment.wallet_address}`} style={{ color: '#00ffff', textDecoration: 'none' }}><WalletName address={comment.wallet_address} /></Link>
            {' // '}{format(comment.created_at)}
          </div>
          <div style={{ fontSize: '12px', color: '#00ff00', lineHeight: 1.4 }}>{comment.content}</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <RetroBtn onClick={handleLike} color={liked ? '#ff4444' : '#555'}>
              [{liked ? '♥' : '♡'} {likeCount > 0 ? likeCount : '0'}]
            </RetroBtn>
            {walletAddress && <RetroBtn onClick={() => setShowReplyInput(!showReplyInput)} color="#555">[REPLY]</RetroBtn>}
            {repliesCount > 0 && <RetroBtn onClick={() => setShowReplies(!showReplies)} color="#555">[{showReplies ? 'HIDE' : `${repliesCount} REPLIES`}]</RetroBtn>}
          </div>
        </div>
      </div>

      {showReplyInput && (
        <div style={{ marginLeft: '28px', marginTop: '6px', display: 'flex', gap: '6px' }}>
          <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()}
            placeholder={`> REPLY TO ${shortWallet(comment.wallet_address)}...`}
            style={{ flex: 1, padding: '4px 8px', background: '#000', border: '1px solid #00ffff', fontSize: '11px', color: '#00ff00', outline: 'none', ...mono }} />
          <button onClick={handleReply} disabled={!replyText.trim() || submitting}
            style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '2px 8px', ...mono, fontSize: '10px', cursor: 'pointer', opacity: !replyText.trim() || submitting ? 0.5 : 1 }}>
            POST
          </button>
        </div>
      )}
      {showReplies && replies.map(r => <ReplyItem key={r.id} reply={r} walletAddress={walletAddress} postId={postId} />)}
    </div>
  );
};

export const PostCard = ({ post, onLike, onDelete }) => {
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
  const [showChart, setShowChart] = useState(false);
  const [quotedPost, setQuotedPost] = useState(null);
  const impressionRecorded = useRef(false);
  const cardRef = useRef();

  useEffect(() => {
    if (post.quote_of) fetchQuotedPost(post.quote_of).then(setQuotedPost);
  }, [post.quote_of]);

  useEffect(() => {
    if (impressionRecorded.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
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
          if (entry.target._timer) clearTimeout(entry.target._timer);
        }
      });
    }, { threshold: 0.5 });
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
      if (newComment.parent_id) return;
      setCommentCount(c => c + 1);
      if (showComments) setComments(prev => prev.find(c => c.id === newComment.id) ? prev : [...prev, newComment]);
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
    if (!result.alreadyLiked) { setLiked(true); setLikeCount(c => c + 1); if (onLike) onLike(post.id); }
  };

  const handleComment = async () => {
    if (!walletAddress || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await addComment(post.id, walletAddress, commentText.trim(), post.wallet_address);
      setCommentText('');
      setComments(prev => prev.find(c => c.id === newComment.id) ? prev : [...prev, newComment]);
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
    <div ref={cardRef} style={{ background: '#000', border: '2px solid #00ffff', marginBottom: '10px', animation: 'fadeIn 0.3s ease forwards' }}>

      {/* Win95 title bar */}
      <div style={{ background: '#000080', padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #00ffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <WalletAvatar address={post.wallet_address} size={16} />
          <WalletName address={post.wallet_address} asLink style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffff00', ...mono }} />
          <span style={{ fontSize: '10px', color: '#8888ff', ...mono }}> // {format(post.created_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
         <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ff00ff', animation: 'pulse 2s infinite' }} />
<a href={`https://pump.fun/coin/${post.coin_mint}`} target="_blank" rel="noopener noreferrer"
  style={{ background: '#000', border: '1px solid #ff00ff', color: '#ff00ff', padding: '1px 6px', fontSize: '9px', ...mono, textDecoration: 'none', animation: 'blink 1.5s infinite' }}>
  ** ${post.coin_ticker} **
</a>
<button onClick={() => setShowChart(c => !c)}
  style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '1px 6px', fontSize: '9px', ...mono, cursor: 'pointer' }}>
  {showChart ? '[CLOSE]' : 'CHART'}
</button>
        </div>
      </div>

      {showChart && (
        <div style={{ borderBottom: '1px solid #00ffff' }}>
          <iframe
            src={`https://dexscreener.com/solana/${post.coin_mint}?embed=1&theme=dark`}
            style={{ width: '100%', height: '400px', border: 'none', display: 'block' }}
            title="chart"
          />
        </div>
      )}

      {/* Repressed by banner */}
      {post.repressed_by && (
        <div style={{ padding: '3px 8px', background: '#0d0d0d', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#555', ...mono }}>
          &gt;&gt; REPRESSED BY: <WalletName address={post.repressed_by} asLink style={{ color: '#00ffff', fontSize: '10px', ...mono }} />
        </div>
      )}

      {/* Media */}
      {post.media_url && !showChart && (
        <div style={{ position: 'relative', borderBottom: '1px solid #333' }}>
          {post.media_type === 'video'
            ? <video style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', display: 'block' }} src={post.media_url} controls muted loop playsInline />
            : <img style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', display: 'block' }} src={post.media_url} alt={post.caption || 'press post'} />
          }
          {/* Scanline overlay */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div style={{ padding: '8px 10px', fontSize: '12px', color: '#00ff00', lineHeight: 1.5, borderBottom: '1px solid #111', ...mono }}>
          &gt; {post.caption}
        </div>
      )}

      {/* Quoted post */}
      {quotedPost && (
        <div style={{ margin: '6px 8px', border: '1px solid #333', padding: '6px 8px', background: '#050510' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <WalletAvatar address={quotedPost.wallet_address} size={16} />
            <WalletName address={quotedPost.wallet_address} asLink style={{ fontSize: '10px', fontWeight: 'bold', color: '#00ffff', ...mono }} />
            <span style={{ fontSize: '9px', color: '#555', ...mono }}>{format(quotedPost.created_at)}</span>
            <span style={{ marginLeft: 'auto', background: '#000', border: '1px solid #ff00ff', color: '#ff00ff', padding: '1px 4px', fontSize: '8px', ...mono }}>** ${quotedPost.coin_ticker} **</span>
          </div>
          {quotedPost.media_url && <img src={quotedPost.media_url} alt="" style={{ width: '100%', maxHeight: '80px', objectFit: 'cover', display: 'block', marginBottom: '4px' }} />}
          {quotedPost.caption && <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.4, ...mono }}>&gt; {quotedPost.caption}</div>}
        </div>
      )}

      {/* Reach bar */}
      {reachTarget > 0 && (
        <div style={{ margin: '0 8px 2px' }}>
          <div style={{ height: '4px', background: '#111', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${impressionPct}%`, background: '#ff00ff' }} />
          </div>
        </div>
      )}

      {/* Paid label */}
      <div style={{ fontSize: '9px', color: '#555', padding: '3px 10px 6px', display: 'flex', justifyContent: 'space-between', ...mono }}>
        <span>PAID TO PRESS:</span>
        <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{formatAmount(Number(post.amount_paid))} ${post.coin_ticker}</span>
      </div>

      {/* Stats row */}
      <div style={{ padding: '6px 10px 8px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #111', flexWrap: 'wrap' }}>
        <RetroBtn onClick={handleLike} color={liked ? '#ff4444' : '#555'}>
          [{liked ? '♥' : '♡'} {likeCount}]
        </RetroBtn>
        <RetroBtn onClick={handleRepress} color={repressed ? '#00ff00' : '#555'}>
          [RT {repressCount > 0 ? repressCount : '0'}]
        </RetroBtn>
        <RetroBtn onClick={() => setShowComments(!showComments)} color={showComments ? '#00ffff' : '#555'}>
          [MSG {commentCount}]
        </RetroBtn>
        <span style={{ fontSize: '10px', color: '#555', ...mono }}>
          [VIEWS {formatViews(views)}{reachTarget > 0 && `/${formatViews(reachTarget)}`}]
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <RetroBtn onClick={handleShare} color={copied ? '#00ff00' : '#555'}>
            {copied ? '[COPIED!]' : '[SHARE]'}
          </RetroBtn>
          {walletAddress && <RetroBtn onClick={() => setShowQuoteModal(true)} color="#555">[QUOTE]</RetroBtn>}
          {walletAddress === post.wallet_address && (
            <RetroBtn color="#ff4444" onClick={async () => {
              if (window.confirm('DELETE THIS POST? NO REFUNDS.')) {
                await supabase.from('posts').update({ is_active: false }).eq('id', post.id);
                toast.success('Post deleted');
                if (onDelete) onDelete(post.id);
              }
            }}>
              [DEL]
            </RetroBtn>
          )}
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ borderTop: '2px solid #00ffff', padding: '10px', background: '#000' }}>
          <div style={{ fontSize: '9px', color: '#00ffff', ...mono, marginBottom: '8px', letterSpacing: '2px' }}>** COMMENTS **</div>
          {comments.length === 0 && <div style={{ fontSize: '11px', color: '#444', marginBottom: '10px', ...mono }}>&gt; NO COMMENTS YET — BE THE FIRST</div>}
          {comments.slice(0, visibleComments).map(c => <CommentItem key={c.id} comment={c} walletAddress={walletAddress} postId={post.id} postOwnerWallet={post.wallet_address} />)}
          {comments.length > visibleComments && (
            <RetroBtn onClick={() => setVisibleComments(v => v + 5)} color="#555" style={{ marginBottom: '8px' }}>
              [SHOW {Math.min(5, comments.length - visibleComments)} MORE]
            </RetroBtn>
          )}
          {walletAddress ? (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()}
                placeholder="> TYPE YOUR COMMENT..."
                style={{ flex: 1, padding: '5px 8px', background: '#000', border: '2px solid #00ffff', fontSize: '11px', color: '#00ff00', outline: 'none', ...mono }} />
              <button onClick={handleComment} disabled={!commentText.trim() || submittingComment}
                style={{ background: '#c0c0c0', color: '#000', borderTop: '2px solid #fff', borderLeft: '2px solid #fff', borderBottom: '2px solid #444', borderRight: '2px solid #444', padding: '4px 10px', ...mono, fontSize: '11px', cursor: 'pointer', opacity: !commentText.trim() || submittingComment ? 0.5 : 1, fontWeight: 'bold' }}>
                POST
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#555', marginTop: '8px', ...mono }}>&gt; CONNECT WALLET TO COMMENT</div>
          )}
        </div>
      )}

      {showQuoteModal && <QuotePressModal post={post} onClose={() => setShowQuoteModal(false)} onSuccess={() => setShowQuoteModal(false)} />}
    </div>
  );
};