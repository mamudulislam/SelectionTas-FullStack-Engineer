'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { postsAPI } from '@/lib/api';
import Link from 'next/link';

interface PostData {
  id: string;
  content: string;
  image_url?: string;
  privacy: 'public' | 'private';
  user: {
    id: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  likesCount?: number;
  isLiked?: boolean;
  likers?: Array<any>;
  commentsCount?: number;
}

interface CommentData {
  id: string;
  content: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  likesCount?: number;
  isLiked?: boolean;
  likers?: Array<any>;
  repliesCount?: number;
}

interface ReplyData {
  id: string;
  content: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  likesCount?: number;
  isLiked?: boolean;
  likers?: Array<any>;
}

export default function FeedPage() {
  const router = useRouter();
  const { user, logout, loading: authLoading, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [postContent, setPostContent] = useState('');
  const [postPrivacy, setPostPrivacy] = useState<'public' | 'private'>('public');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [hoveredReplyId, setHoveredReplyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [postComments, setPostComments] = useState<{ [postId: string]: CommentData[] }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [replyInputs, setReplyInputs] = useState<{ [commentId: string]: string }>({});
  const [showReplies, setShowReplies] = useState<Set<string>>(new Set());
  const [commentReplies, setCommentReplies] = useState<{ [commentId: string]: ReplyData[] }>({});
  const [currentPage, setCurrentPage] = useState(1);

  // UI States
  const [showNotifyDrop, setShowNotifyDrop] = useState(false);
  const [showProfileDrop, setShowProfileDrop] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Likers Modal States
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [selectedLikers, setSelectedLikers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [likersModalTitle, setLikersModalTitle] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      fetchPosts();
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle clicking outside to close popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hoveredPostId && !(event.target as Element).closest('._reaction_panel, ._feed_reaction')) {
        setHoveredPostId(null);
      }
      if (hoveredCommentId && !(event.target as Element).closest('._reaction_panel, li')) {
        setHoveredCommentId(null);
      }
      if (hoveredReplyId && !(event.target as Element).closest('._reaction_panel, span')) {
        setHoveredReplyId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [hoveredPostId, hoveredCommentId, hoveredReplyId]);

  const fetchPosts = async (page = 1) => {
    try {
      setLoading(true);
      const response = await postsAPI.getPosts(page, 10);
      setPosts(response.data.data || []);
      setCurrentPage(page);
      setError('');
    } catch (err: any) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) {
      setError('Please write something in your post');
      return;
    }

    try {
      setPosting(true);
      setError('');
      const formData = new FormData();
      formData.append('content', postContent);
      formData.append('privacy', postPrivacy);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      await postsAPI.createPost(formData);
      setPostContent('');
      setPostPrivacy('public');
      setSelectedImage(null);
      setImagePreview('');
      fetchPosts(1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const toggleLikePost = async (postId: string, action?: 'like' | 'unlike') => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isCurrentlyLiked = post.isLiked;
    const previousLikesCount = post.likesCount || 0;
    const previousLikers = post.likers || [];

    if (action === 'like' && isCurrentlyLiked) return;
    if (action === 'unlike' && !isCurrentlyLiked) return;

    // If action is provided, we use it directly; otherwise we toggle (the main button's behavior)
    const wantLiked = action === 'like' ? true : (action === 'unlike' ? false : !isCurrentlyLiked);


    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const currentLikesCount = p.likesCount || 0;
        const currentLikers = p.likers || [];
        return {
          ...p,
          isLiked: wantLiked,
          likesCount: wantLiked ? (currentLikesCount + 1) : Math.max(0, currentLikesCount - 1),
          likers: wantLiked
            ? [...currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id), { id: user?.id, first_name: user?.firstName, last_name: user?.lastName }]
            : currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id)
        };
      }
      return p;
    }));

    try {
      const response = await postsAPI.likePost(postId, action);

      // Handle both nested and flat response structures
      let likedValue: boolean;
      let countValue: number;

      if (response.data && typeof response.data === 'object') {
        // Check if response.data has liked property directly
        if ('liked' in response.data) {
          likedValue = response.data.liked;
          countValue = response.data.count || 0;
        } else {
          // Fallback: use the action to determine the liked value
          likedValue = action === 'unlike' ? false : (action === 'like' ? true : false);
          countValue = 0;
        }
      } else {
        // Fallback
        likedValue = action === 'unlike' ? false : (action === 'like' ? true : false);
        countValue = 0;
      }

      // Force update to ensure it's reflected in UI
      setPosts(prev => {
        const updated = prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isLiked: likedValue,
              likesCount: countValue
            };
          }
          return p;
        });
        return updated;
      });
    } catch (err) {
      // Rollback on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isLiked: isCurrentlyLiked,
            likesCount: previousLikesCount,
            likers: previousLikers
          };
        }
        return p;
      }));
    }
  };

  const toggleLikeComment = async (postId: string, commentId: string, action?: 'like' | 'unlike') => {
    const comments = postComments[postId] || [];
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const isCurrentlyLiked = comment.isLiked;
    const wantLiked = action === 'like' ? true : (action === 'unlike' ? false : !isCurrentlyLiked);

    if (!action && wantLiked === isCurrentlyLiked) return;

    // Optimistic UI update using functional update
    setPostComments(prev => {
      const currentComments = prev[postId] || [];
      const updatedComments = currentComments.map(c => {
        if (c.id === commentId) {
          const currentLikesCount = c.likesCount || 0;
          const currentLikers = c.likers || [];
          return {
            ...c,
            isLiked: wantLiked,
            likesCount: wantLiked ? (currentLikesCount + 1) : Math.max(0, currentLikesCount - 1),
            likers: wantLiked
              ? [...currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id), { id: user?.id, first_name: user?.firstName, last_name: user?.lastName }]
              : currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id)
          };
        }
        return c;
      });
      return { ...prev, [postId]: updatedComments };
    });

    try {
      const response = await postsAPI.likeComment(postId, commentId, action);
      // Final sync with backend
      setPostComments(prev => {
        const currentComments = prev[postId] || [];
        const updatedComments = currentComments.map(c => {
          if (c.id === commentId) {
            const currentLikers = c.likers || [];
            const updatedLikers = response.data.liked
              ? [...currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id), { id: user?.id, first_name: user?.firstName, last_name: user?.lastName }]
              : currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id);
            return { ...c, isLiked: response.data.liked, likesCount: response.data.count, likers: updatedLikers };
          }
          return c;
        });
        return { ...prev, [postId]: updatedComments };
      });
    } catch (err) {
      // Rollback
      setPostComments(prev => ({ ...prev, [postId]: comments }));
      console.error('Error liking comment:', err);
    }
  };

  const toggleLikeReply = async (postId: string, commentId: string, replyId: string, action?: 'like' | 'unlike') => {
    const replies = commentReplies[commentId] || [];
    const reply = replies.find(r => r.id === replyId);
    if (!reply) return;

    const isCurrentlyLiked = reply.isLiked;
    const wantLiked = action === 'like' ? true : (action === 'unlike' ? false : !isCurrentlyLiked);

    if (!action && wantLiked === isCurrentlyLiked) return;

    const shouldUnlike = !wantLiked;
    const previousLikesCount = reply.likesCount || 0;
    const previousLikers = reply.likers || [];

    // Optimistic UI update using functional update
    setCommentReplies(prev => {
      const currentReplies = prev[commentId] || [];
      const updatedReplies = currentReplies.map(r => {
        if (r.id === replyId) {
          return {
            ...r,
            isLiked: wantLiked,
            likesCount: wantLiked ? (previousLikesCount + 1) : Math.max(0, previousLikesCount - 1),
            likers: wantLiked
              ? [...previousLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id), { id: user?.id, first_name: user?.firstName, last_name: user?.lastName }]
              : previousLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id)
          };
        }
        return r;
      });
      return { ...prev, [commentId]: updatedReplies };
    });

    try {
      const response = await postsAPI.likeReply(postId, commentId, replyId, action);
      // Final sync with backend
      setCommentReplies(prev => {
        const currentReplies = prev[commentId] || [];
        const updatedReplies = currentReplies.map(r => {
          if (r.id === replyId) {
            const currentLikers = r.likers || [];
            const updatedLikers = response.data.liked
              ? [...currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id), { id: user?.id, first_name: user?.firstName, last_name: user?.lastName }]
              : currentLikers.filter((l: any) => l.user_id !== user?.id && l.id !== user?.id);
            return { ...r, isLiked: response.data.liked, likesCount: response.data.count, likers: updatedLikers };
          }
          return r;
        });
        return { ...prev, [commentId]: updatedReplies };
      });
    } catch (err) {
      setCommentReplies(prev => ({ ...prev, [commentId]: replies }));
      console.error('Error liking reply:', err);
    }
  };

  const addComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content?.trim()) return;

    try {
      await postsAPI.addComment(postId, content);
      setCommentInputs({ ...commentInputs, [postId]: '' });
      await loadComments(postId);
      fetchPosts(currentPage);
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const response = await postsAPI.getComments(postId);
      setPostComments({ ...postComments, [postId]: response.data });
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  };

  const toggleComments = async (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      if (!postComments[postId]) {
        await loadComments(postId);
      }
    }
    setExpandedComments(newExpanded);
  };

  const addReply = async (postId: string, commentId: string) => {
    const content = replyInputs[commentId];
    if (!content?.trim()) return;

    try {
      await postsAPI.addReply(postId, commentId, content);
      setReplyInputs({ ...replyInputs, [commentId]: '' });
      await loadReplies(postId, commentId);
    } catch (err) {
      console.error('Error adding reply:', err);
    }
  };

  const loadReplies = async (postId: string, commentId: string) => {
    try {
      const response = await postsAPI.getReplies(postId, commentId);
      setCommentReplies({ ...commentReplies, [commentId]: response.data });
    } catch (err) {
      console.error('Error loading replies:', err);
    }
  };

  const toggleShowReplies = async (postId: string, commentId: string) => {
    const newShowReplies = new Set(showReplies);
    if (newShowReplies.has(commentId)) {
      newShowReplies.delete(commentId);
    } else {
      newShowReplies.add(commentId);
      if (!commentReplies[commentId]) {
        await loadReplies(postId, commentId);
      }
    }
    setShowReplies(newShowReplies);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0)}${lastName?.charAt(0)}`.toUpperCase();
  };

  const formatTimeAgo = (createdAt: string) => {
    const now = new Date();
    const postDate = new Date(createdAt);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const openLikersModal = (likers: any[], title: string) => {
    setSelectedLikers(likers);
    setLikersModalTitle(title);
    setShowLikersModal(true);
  };

  if (authLoading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`_layout _layout_main_wrapper ${darkMode ? '_dark_wrapper' : ''}`}>
      <div className="_main_layout">
        {/* Switching Btn Start */}
        <div className="_layout_mode_swithing_btn">
          <button type="button" className="_layout_swithing_btn_link" onClick={() => setDarkMode(!darkMode)}>
            <div className={`_layout_swithing_btn ${darkMode ? 'active' : ''}`}>
              <div className="_layout_swithing_btn_round"></div>
            </div>
            <div className="_layout_change_btn_ic1">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="16" fill="none" viewBox="0 0 11 16">
                <path fill="#fff" d="M2.727 14.977l.04-.498-.04.498zm-1.72-.49l.489-.11-.489.11zM3.232 1.212L3.514.8l-.282.413zM9.792 8a6.5 6.5 0 00-6.5-6.5v-1a7.5 7.5 0 017.5 7.5h-1zm-6.5 6.5a6.5 6.5 0 006.5-6.5h1a7.5 7.5 0 01-7.5 7.5v-1zm-.525-.02c.173.013.348.02.525.02v1c-.204 0-.405-.008-.605-.024l.08-.997zm-.261-1.83A6.498 6.498 0 005.792 7h1a7.498 7.498 0 01-3.791 6.52l-.495-.87zM5.792 7a6.493 6.493 0 00-2.841-5.374L3.514.8A7.493 7.493 0 016.792 7h-1zm-3.105 8.476c-.528-.042-.985-.077-1.314-.155-.316-.075-.746-.242-.854-.726l.977-.217c-.028-.124-.145-.09.106-.03.237.056.6.086 1.165.131l-.08.997zm.314-1.956c-.622.354-1.045.596-1.31.792a.967.967 0 00-.204.185c-.01.013.027-.038.009-.12l-.977.218a.836.836 0 01.144-.666c.112-.162.27-.3.433-.42.324-.24.814-.519 1.41-.858L3 13.52zM3.292 1.5a.391.391 0 00.374-.285A.382.382 0 003.514.8l-.563.826A.618.618 0 012.702.95a.609.609 0 01.59-.45v1z" />
              </svg>
            </div>
            <div className="_layout_change_btn_ic2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4.389" stroke="#fff" transform="rotate(-90 12 12)" />
                <path stroke="#fff" strokeLinecap="round" d="M3.444 12H1M23 12h-2.444M5.95 5.95L4.222 4.22M19.778 19.779L18.05 18.05M12 3.444V1M12 23v-2.445M18.05 5.95l1.728-1.729M4.222 19.779L5.95 18.05" />
              </svg>
            </div>
          </button>
        </div>
        {/* Switching Btn End */}

        {/* Desktop Menu Start */}
        <nav className="navbar navbar-expand-lg navbar-light _header_nav _padd_t10">
          <div className="container _custom_container">
            <div className="_logo_wrap">
              <Link className="navbar-brand" href="/feed">
                <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
              </Link>
            </div>
            <button className="navbar-toggler bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarSupportedContent">
              <div className="_header_form ms-auto">
                <form className="_header_form_grp">
                  <svg className="_header_form_svg" xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 17 17">
                    <circle cx="7" cy="7" r="6" stroke="#666" />
                    <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3" />
                  </svg>
                  <input className="form-control me-2 _inpt1" type="search" placeholder="input search text" aria-label="Search" />
                </form>
              </div>
              <ul className="navbar-nav mb-2 mb-lg-0 _header_nav_list ms-auto _mar_r8">
                <li className="nav-item _header_nav_item">
                  <Link className="nav-link _header_nav_link_active _header_nav_link" aria-current="page" href="/feed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="21" fill="none" viewBox="0 0 18 21">
                      <path className="_home_active" stroke="#000" strokeWidth="1.5" strokeOpacity=".6" d="M1 9.924c0-1.552 0-2.328.314-3.01.313-.682.902-1.187 2.08-2.196l1.143-.98C6.667 1.913 7.732 1 9 1c1.268 0 2.333.913 4.463 2.738l1.142.98c1.179 1.01 1.768 1.514 2.081 2.196.314.682.314 1.458.314 3.01v4.846c0 2.155 0 3.233-.67 3.902-.669.67-1.746.67-3.901.67H5.57c-2.155 0-3.232 0-3.902-.67C1 18.002 1 16.925 1 14.77V9.924z" />
                      <path className="_home_active" stroke="#000" strokeOpacity=".6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.857 19.341v-5.857a1 1 0 00-1-1H7.143a1 1 0 00-1 1v5.857" />
                    </svg>
                  </Link>
                </li>
                <li className="nav-item _header_nav_item">
                  <Link className="nav-link _header_nav_link" aria-current="page" href="#">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="20" fill="none" viewBox="0 0 26 20">
                      <path fill="#000" fillOpacity=".6" fillRule="evenodd" d="M12.79 12.15h.429c2.268.015 7.45.243 7.45 3.732 0 3.466-5.002 3.692-7.415 3.707h-.894c-2.268-.015-7.452-.243-7.452-3.727 0-3.47 5.184-3.697 7.452-3.711l.297-.001h.132zm0 1.75c-2.792 0-6.12.34-6.12 1.962 0 1.585 3.13 1.955 5.864 1.976l.255.002c2.792 0 6.118-.34 6.118-1.958 0-1.638-3.326-1.982-6.118-1.982zm9.343-2.224c2.846.424 3.444 1.751 3.444 2.79 0 .636-.251 1.794-1.931 2.43a.882.882 0 01-1.137-.506.873.873 0 01.51-1.13c.796-.3.796-.633.796-.793 0-.511-.654-.868-1.944-1.06a.878.878 0 01-.741-.996.886.886 0 011.003-.735zm-17.685.735a.878.878 0 01-.742.997c-1.29.19-1.944.548-1.944 1.059 0 .16 0 .491.798.793a.873.873 0 01-.314 1.693.897.897 0 01-.313-.057C.25 16.259 0 15.1 0 14.466c0-1.037.598-2.366 3.446-2.79.485-.06.929.257 1.002.735zM12.789 0c2.96 0 5.368 2.392 5.368 5.33 0 2.94-2.407 5.331-5.368 5.331h-.031a5.329 5.329 0 01-3.782-1.57 5.253 5.253 0 01-1.553-3.764C7.423 2.392 9.83 0 12.789 0zm0 1.75c-1.987 0-3.604 1.607-3.604 3.58a3.526 3.526 0 001.04 2.527 3.58 3.58 0 002.535 1.054l.03.875v-.875c1.987 0 3.605-1.605 3.605-3.58S14.777 1.75 12.789 1.75zm7.27-.607a4.222 4.222 0 013.566 4.172c-.004 2.094-1.58 3.89-3.665 4.181a.88.88 0 01-.994-.745.875.875 0 01.75-.989 2.494 2.494 0 002.147-2.45 2.473 2.473 0 00-2.09-2.443.876.876 0 01-.726-1.005.881.881 0 011.013-.721zm-13.528.72a.876.876 0 01-.726 1.006 2.474 2.474 0 00-2.09 2.446A2.493 2.493 0 005.86 7.762a.875.875 0 11-.243 1.734c-2.085-.29-3.66-2.087-3.664-4.179 0-2.082 1.5-3.837 3.566-4.174a.876.876 0 011.012.72z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </li>
                <li className="nav-item _header_nav_item">
                  <span className="nav-link _header_nav_link _header_notify_btn" onClick={() => setShowNotifyDrop(!showNotifyDrop)} style={{ cursor: 'pointer' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" fill="none" viewBox="0 0 20 22">
                      <path fill="#000" fillOpacity=".6" fillRule="evenodd" d="M7.547 19.55c.533.59 1.218.915 1.93.915.714 0 1.403-.324 1.938-.916a.777.777 0 011.09-.056c.318.284.344.77.058 1.084-.832.917-1.927 1.423-3.086 1.423h-.002c-1.155-.001-2.248-.506-3.077-1.424a.762.762 0 01.057-1.083.774.774 0 011.092.057zM9.527 0c4.58 0 7.657 3.543 7.657 6.85 0 1.702.436 2.424.899 3.19.457.754.976 1.612.976 3.233-.36 4.14-4.713 4.478-9.531 4.478-4.818 0-9.172-.337-9.528-4.413-.003-1.686.515-2.544.973-3.299l.161-.27c.398-.679.737-1.417.737-2.918C1.871 3.543 4.948 0 9.528 0zm0 1.535c-3.6 0-6.11 2.802-6.11 5.316 0 2.127-.595 3.11-1.12 3.978-.422.697-.755 1.247-.755 2.444.173 1.93 1.455 2.944 7.986 2.944 6.494 0 7.817-1.06 7.988-3.01-.003-1.13-.336-1.681-.757-2.378-.526-.868-1.12-1.851-1.12-3.978 0-2.514-2.51-5.316-6.111-5.316z" clipRule="evenodd" />
                    </svg>
                    <span className="_counting">6</span>
                    <div className={`_notification_dropdown ${showNotifyDrop ? 'show' : ''}`} style={{ display: showNotifyDrop ? 'block' : 'none' }}>
                      <div className="_notifications_content">
                        <h4 className="_notifications_content_title">Notifications</h4>
                      </div>
                      <div className="_notifications_drop_box">
                        <div className="_notifications_all">
                          <div className="_notification_box">
                            <div className="_notification_txt">
                              <p className="_notification_para">No new notifications</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </span>
                </li>
              </ul>
              <div className="_header_nav_profile" onClick={() => setShowProfileDrop(!showProfileDrop)} style={{ cursor: 'pointer' }}>
                <div className="_header_nav_profile_image">
                  <div className="_nav_profile_img" style={{ background: '#e4e6eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {user && getInitials(user.firstName, user.lastName)}
                  </div>
                </div>
                <div className="_header_nav_dropdown">
                  <p className="_header_nav_para">{user?.firstName} {user?.lastName}</p>
                  <button className="_header_nav_dropdown_btn _dropdown_toggle" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" fill="none" viewBox="0 0 10 6">
                      <path fill="#112032" d="M5 5l.354.354L5 5.707l-.354-.353L5 5zm4.354-3.646l-4 4-.708-.708 4-4 .708.708zm-4.708 4l-4-4 .708-.708 4 4-.708.708z" />
                    </svg>
                  </button>
                </div>
                <div className={`_nav_profile_dropdown _profile_dropdown ${showProfileDrop ? 'show' : ''}`} style={{ display: showProfileDrop ? 'block' : 'none' }}>
                  <div className="_nav_profile_dropdown_info">
                    <div className="_nav_profile_dropdown_info_txt">
                      <h4 className="_nav_dropdown_title">{user?.firstName} {user?.lastName}</h4>
                      <Link href="#" className="_nav_drop_profile">View Profile</Link>
                    </div>
                  </div>
                  <hr />
                  <ul className="_nav_dropdown_list">
                    <li className="_nav_dropdown_list_item">
                      <a onClick={handleLogout} className="_nav_dropdown_link" style={{ cursor: 'pointer' }}>
                        <div className="_nav_drop_info">Log Out</div>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </nav>
        {/* Desktop Menu End */}

        {/* Mobile Menu Start */}
        <div className="_header_mobile_menu">
          <div className="_header_mobile_menu_wrap">
            <div className="container">
              <div className="_header_mobile_menu">
                <div className="row">
                  <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                    <div className="_header_mobile_menu_top_inner">
                      <div className="_header_mobile_menu_logo">
                        <Link href="/feed" className="_mobile_logo_link">
                          <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
                        </Link>
                      </div>
                      <div className="_header_mobile_menu_right">
                        <form className="_header_form_grp">
                          <Link href="#0" className="_header_mobile_search">
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 17 17">
                              <circle cx="7" cy="7" r="6" stroke="#666" />
                              <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3" />
                            </svg>
                          </Link>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile Menu End */}

        {/* Mobile Bottom Navigation */}
        <div className="_mobile_navigation_bottom_wrapper">
          <div className="_mobile_navigation_bottom_wrap">
            <div className="conatiner">
              <div className="row">
                <div className="col-xl-12 col-lg-12 col-md-12">
                  <ul className="_mobile_navigation_bottom_list">
                    <li className="_mobile_navigation_bottom_item">
                      <Link href="/feed" className="_mobile_navigation_bottom_link _mobile_navigation_bottom_link_active">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="27" fill="none" viewBox="0 0 24 27">
                          <path className="_mobile_svg" fill="#000" fillOpacity=".6" stroke="#666666" strokeWidth="1.5" d="M1 13.042c0-2.094 0-3.141.431-4.061.432-.92 1.242-1.602 2.862-2.965l1.571-1.321C8.792 2.232 10.256 1 12 1c1.744 0 3.208 1.232 6.136 3.695l1.572 1.321c1.62 1.363 2.43 2.044 2.86 2.965.432.92.432 1.967.432 4.06v6.54c0 2.908 0 4.362-.92 5.265-.921.904-2.403.904-5.366.904H7.286c-2.963 0-4.445 0-5.365-.904C1 23.944 1 22.49 1 19.581v-6.54z" />
                          <path fill="#fff" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.07 18.497h5.857v7.253H9.07v-7.253z" />
                        </svg>
                      </Link>
                    </li>
                    <li className="_mobile_navigation_bottom_item">
                      <Link href="#" className="_mobile_navigation_bottom_link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="27" height="20" fill="none" viewBox="0 0 27 20">
                          <path className="_dark_svg" fill="#000" fillOpacity=".6" fillRule="evenodd" d="M13.334 12.405h.138l.31.001c2.364.015 7.768.247 7.768 3.81 0 3.538-5.215 3.769-7.732 3.784h-.932c-2.364-.015-7.77-.247-7.77-3.805 0-3.543 5.405-3.774 7.77-3.789l.31-.001h.138zm0 1.787c-2.91 0-6.38.348-6.38 2.003 0 1.619 3.263 1.997 6.114 2.018l.266.001c2.91 0 6.379-.346 6.379-1.998 0-1.673-3.469-2.024-6.38-2.024zm9.742-2.27c2.967.432 3.59 1.787 3.59 2.849 0 .648-.261 1.83-2.013 2.48a.953.953 0 01-.327.058.919.919 0 01-.858-.575.886.886 0 01.531-1.153c.83-.307.83-.647.83-.81 0-.522-.682-.886-2.027-1.082a.9.9 0 01-.772-1.017c.074-.488.54-.814 1.046-.75zm-18.439.75a.9.9 0 01-.773 1.017c-1.345.196-2.027.56-2.027 1.082 0 .163 0 .501.832.81a.886.886 0 01.531 1.153.92.92 0 01-.858.575.953.953 0 01-.327-.058C.262 16.6 0 15.418 0 14.77c0-1.06.623-2.417 3.592-2.85.506-.061.97.263 1.045.751zM13.334 0c3.086 0 5.596 2.442 5.596 5.442 0 3.001-2.51 5.443-5.596 5.443H13.3a5.616 5.616 0 01-3.943-1.603A5.308 5.308 0 017.74 5.439C7.739 2.442 10.249 0 13.334 0zm0 1.787c-2.072 0-3.758 1.64-3.758 3.655-.003.977.381 1.89 1.085 2.58a3.772 3.772 0 002.642 1.076l.03.894v-.894c2.073 0 3.76-1.639 3.76-3.656 0-2.015-1.687-3.655-3.76-3.655zm7.58-.62c2.153.344 3.717 2.136 3.717 4.26-.004 2.138-1.647 3.972-3.82 4.269a.911.911 0 01-1.036-.761.897.897 0 01.782-1.01c1.273-.173 2.235-1.248 2.237-2.501 0-1.242-.916-2.293-2.179-2.494a.897.897 0 01-.756-1.027.917.917 0 011.055-.736zM6.81 1.903a.897.897 0 01-.757 1.027C4.79 3.13 3.874 4.182 3.874 5.426c.002 1.251.963 2.327 2.236 2.5.503.067.853.519.783 1.008a.912.912 0 01-1.036.762c-2.175-.297-3.816-2.131-3.82-4.267 0-2.126 1.563-3.918 3.717-4.262.515-.079.972.251 1.055.736z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile Bottom Navigation End */}

        <div className="container _custom_container">
          <div className="_layout_inner_wrap">
            <div className="row">
              {/* Left Sidebar */}
              <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                <div className="_layout_left_sidebar_wrap">
                  <div className="_layout_left_sidebar_inner">
                    <div className="_left_inner_area_explore _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <h4 className="_left_inner_area_explore_title _title5 _mar_b24">Explore</h4>
                      <ul className="_left_inner_area_explore_list">
                        <li className="_left_inner_area_explore_item _explore_item">
                          <Link href="/feed" className="_left_inner_area_explore_link">Home</Link>
                        </li>
                        <li className="_left_inner_area_explore_item">
                          <Link href="#" className="_left_inner_area_explore_link">Explore</Link>
                        </li>
                        <li className="_left_inner_area_explore_item">
                          <Link href="#" className="_left_inner_area_explore_link">Groups</Link>
                        </li>
                        <li className="_left_inner_area_explore_item">
                          <Link href="#" className="_left_inner_area_explore_link">Settings</Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="_layout_left_sidebar_inner">
                    <div className="_left_inner_area_suggest _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <div className="_left_inner_area_suggest_content _mar_b24">
                        <h4 className="_left_inner_area_suggest_content_title _title5">Suggested People</h4>
                        <span className="_left_inner_area_suggest_content_txt">
                          <Link className="_left_inner_area_suggest_content_txt_link" href="#0">See All</Link>
                        </span>
                      </div>
                      <div className="_left_inner_area_suggest_info">
                        <div className="_left_inner_area_suggest_info_box">
                          <div className="_left_inner_area_suggest_info_image">
                            <img src="/assets/images/people1.png" alt="Image" className="_info_img" />
                          </div>
                          <div className="_left_inner_area_suggest_info_txt">
                            <h4 className="_left_inner_area_suggest_info_title">Steve Jobs</h4>
                            <p className="_left_inner_area_suggest_info_para">CEO of Apple</p>
                          </div>
                        </div>
                        <div className="_left_inner_area_suggest_info_link"> <Link href="#0" className="_info_link">Connect</Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Section */}
              <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                <div className="_layout_middle_wrap">
                  <div className="_layout_middle_inner">
                    {/* For Desktop Stories */}
                    <div className="_feed_inner_ppl_card _mar_b16">
                      <div className="_feed_inner_story_arrow">
                        <button type="button" className="_feed_inner_story_arrow_btn">
                          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="8" fill="none" viewBox="0 0 9 8">
                            <path fill="#fff" d="M8 4l.366-.341.318.341-.318.341L8 4zm-7 .5a.5.5 0 010-1v1zM5.566.659l2.8 3-.732.682-2.8-3L5.566.66zm2.8 3.682l-2.8 3-.732-.682 2.8-3 .732.682zM8 4.5H1v-1h7v1z" />
                          </svg>
                        </button>
                      </div>
                      <div className="row">
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                          <div className="_feed_inner_profile_story _b_radious6 ">
                            <div className="_feed_inner_profile_story_image">
                              <img src="/assets/images/card_ppl1.png" alt="Image" className="_profile_story_img" />
                              <div className="_feed_inner_story_txt">
                                <div className="_feed_inner_story_btn">
                                  <button className="_feed_inner_story_btn_link">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 10 10">
                                      <path stroke="#fff" strokeLinecap="round" d="M.5 4.884h9M4.884 9.5v-9" />
                                    </svg>
                                  </button>
                                </div>
                                <p className="_feed_inner_story_para">Your Story</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                          <div className="_feed_inner_public_story _b_radious6">
                            <div className="_feed_inner_public_story_image">
                              <img src="/assets/images/card_ppl2.png" alt="Image" className="_public_story_img" />
                              <div className="_feed_inner_pulic_story_txt">
                                <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                              </div>
                              <div className="_feed_inner_public_mini">
                                <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_mobile_none">
                          <div className="_feed_inner_public_story _b_radious6">
                            <div className="_feed_inner_public_story_image">
                              <img src="/assets/images/card_ppl3.png" alt="Image" className="_public_story_img" />
                              <div className="_feed_inner_pulic_story_txt">
                                <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                              </div>
                              <div className="_feed_inner_public_mini">
                                <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_none">
                          <div className="_feed_inner_public_story _b_radious6">
                            <div className="_feed_inner_public_story_image">
                              <img src="/assets/images/card_ppl4.png" alt="Image" className="_public_story_img" />
                              <div className="_feed_inner_pulic_story_txt">
                                <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                              </div>
                              <div className="_feed_inner_public_mini">
                                <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* For Mobile Stories */}
                    <div className="_feed_inner_ppl_card_mobile _mar_b16">
                      <div className="_feed_inner_ppl_card_area">
                        <ul className="_feed_inner_ppl_card_area_list">
                          <li className="_feed_inner_ppl_card_area_item">
                            <Link href="#0" className="_feed_inner_ppl_card_area_link">
                              <div className="_feed_inner_ppl_card_area_story">
                                <img src="/assets/images/mobile_story_img.png" alt="Image" className="_card_story_img" />
                                <div className="_feed_inner_ppl_btn">
                                  <button className="_feed_inner_ppl_btn_link" type="button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12">
                                      <path stroke="#fff" strokeLinecap="round" strokeLinejoin="round" d="M6 2.5v7M2.5 6h7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <p className="_feed_inner_ppl_card_area_link_txt">Your Story</p>
                            </Link>
                          </li>
                          {/* More mobile stories... */}
                        </ul>
                      </div>
                    </div>

                    {/* Create Post */}
                    <div className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                      <div className="_feed_inner_text_area_box">
                        <div className="_feed_inner_text_area_box_image">
                          <img src="/assets/images/txt_img.png" alt="Image" className="_txt_img" />
                        </div>
                        <div className="form-floating _feed_inner_text_area_box_form">
                          <textarea
                            className="form-control _textarea"
                            placeholder="Leave a comment here"
                            id="floatingTextarea"
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            disabled={posting}
                          ></textarea>
                          <label className="_feed_textarea_label" htmlFor="floatingTextarea">Write something ...
                            <svg xmlns="http://www.w3.org/2000/svg" width="23" height="24" fill="none" viewBox="0 0 23 24">
                              <path fill="#666" d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z" />
                            </svg>
                          </label>
                        </div>
                      </div>

                      {imagePreview && (
                        <div className="_mar_t16" style={{ position: 'relative' }}>
                          <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: '6px' }} />
                          <button
                            onClick={() => { setSelectedImage(null); setImagePreview(''); }}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px' }}
                          >×</button>
                        </div>
                      )}

                      <div className="_feed_inner_text_area_bottom _mar_t16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <input
                            type="file"
                            id="post-image"
                            accept="image/*"
                            onChange={handleImageSelect}
                            style={{ display: 'none' }}
                          />
                          <div className="_feed_inner_text_area_item">
                            <button type="button" onClick={() => document.getElementById('post-image')?.click()} className="_feed_inner_text_area_bottom_photo_link" style={{ background: 'none', border: 'none', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="20" fill="none" viewBox="0 0 22 20">
                                <path fill="#666" d="M19.333 2.5h-2.144l-.873-1.455A1.666 1.666 0 0014.889 0H7.11a1.666 1.666 0 00-1.427 1.045L4.811 2.5H2.667C1.194 2.5 0 3.694 0 5.167v12.166C0 18.806 1.194 20 2.667 20h16.666C20.806 20 22 18.806 22 17.333V5.167C22 3.694 20.806 2.5 19.333 2.5zM11 15.833a5 5 0 110-10 5 5 0 010 10zm0-8.333a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666z" />
                              </svg> Photo
                            </button>
                          </div>
                          <select
                            value={postPrivacy}
                            onChange={(e) => setPostPrivacy(e.target.value as 'public' | 'private')}
                            style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '2px 10px', fontSize: '14px' }}
                          >
                            <option value="public">🌐 Public</option>
                            <option value="private">🔒 Private</option>
                          </select>
                        </div>
                        <div className="_feed_inner_text_area_btn">
                          <button
                            type="button"
                            className="_feed_inner_text_area_btn_link"
                            onClick={handleCreatePost}
                            disabled={posting}
                            style={{ background: '#377DFF', color: 'white', border: 'none', padding: '8px 25px', borderRadius: '6px', fontWeight: '500' }}
                          >
                            {posting ? 'Posting...' : 'Post'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Posts List */}
                    {loading ? (
                      <div className="loading"><div className="spinner"></div></div>
                    ) : posts.length === 0 ? (
                      <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16" style={{ textAlign: 'center' }}>
                        <p>No posts yet. Be the first to share something!</p>
                      </div>
                    ) : (
                      posts.map((post) => (
                        <div key={post.id} className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
                          <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                            <div className="_feed_inner_timeline_post_top">
                              <div className="_feed_inner_timeline_post_box">
                                <div className="_feed_inner_timeline_post_box_image">
                                  <div style={{ width: '45px', height: '45px', background: '#e4e6eb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                    {getInitials(post.user.first_name, post.user.last_name)}
                                  </div>
                                </div>
                                <div className="_feed_inner_timeline_post_box_txt">
                                  <h4 className="_feed_inner_timeline_post_box_title">{post.user.first_name} {post.user.last_name}</h4>
                                  <p className="_feed_inner_timeline_post_box_para">
                                    {formatTimeAgo(post.created_at)} . <span>{post.privacy === 'public' ? 'Public' : 'Private'}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="_feed_inner_timeline_post_title" style={{ margin: '15px 0', fontSize: '16px', color: '#000' }}>
                              {post.content}
                            </div>
                            {post.image_url && (
                              <div className="_feed_inner_timeline_image">
                                <img src={post.image_url} alt="Post" style={{ width: '100%', borderRadius: '6px' }} />
                              </div>
                            )}
                          </div>

                          <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26 _mar_t16">
                            <div className="_feed_inner_timeline_total_reacts_txt">
                              <p className="_feed_inner_timeline_total_reacts_para1" style={{ cursor: 'pointer' }} onClick={() => toggleComments(post.id)}>
                                <span>{post.likesCount || 0}</span> Likes . <span>{post.commentsCount || 0}</span> Comments
                              </p>
                              {post.likers && post.likers.length > 0 && (
                                <p 
                                  className="_feed_inner_timeline_total_reacts_para2" 
                                  style={{ fontSize: '12px', color: '#377DFF', marginTop: '5px', cursor: 'pointer', fontWeight: '500' }}
                                  onClick={() => openLikersModal(post.likers || [], 'Liked by')}
                                >
                                  Liked by {post.likers.slice(0, 3).map((l: any) => l.first_name).join(', ')}{post.likers.length > 3 ? ` and ${post.likers.length - 3} others` : ''}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="_feed_inner_timeline_reaction"
                            style={{ position: 'relative', flex: 1, display: 'flex' }}
                          >
                            <div className={`_reaction_panel ${hoveredPostId === post.id ? 'show' : ''}`}
                              style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 10px)',
                                left: '50%',
                                transform: `translateX(-50%) ${hoveredPostId === post.id ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.8)'}`,
                                background: 'white',
                                borderRadius: '40px',
                                padding: '8px 16px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                                display: 'flex',
                                gap: '12px',
                                opacity: hoveredPostId === post.id ? 1 : 0,
                                visibility: hoveredPostId === post.id ? 'visible' : 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                zIndex: 9999,
                                border: '1px solid #f0f2f5',
                                width: 'max-content',
                                pointerEvents: hoveredPostId === post.id ? 'auto' : 'none'
                              }}>
                              {/* Arrow pointing down */}
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '8px solid transparent',
                                borderRight: '8px solid transparent',
                                borderTop: '8px solid white',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                              }}></div>
                              <div className="_reaction_option"
                                onClick={(e) => { e.stopPropagation(); toggleLikePost(post.id, 'like'); setHoveredPostId(null); }}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s', background: post.isLiked ? '#f4f8ff' : '#e8f7e8' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#e7f3ff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = post.isLiked ? '#f4f8ff' : '#e8f7e8'; }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={post.isLiked ? '#1f7af5' : '#377DFF'}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: post.isLiked ? '#1f7af5' : '#377DFF' }}>Like</span>
                              </div>
                              <div className="_reaction_option"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLikePost(post.id, 'unlike');
                                  setHoveredPostId(null);
                                }}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s', background: post.isLiked ? '#ffefef' : '#fff1f1' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#ffd6dc'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = post.isLiked ? '#ffefef' : '#fff1f1'; }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={post.isLiked ? '#e0245e' : '#a23f4b'}><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3z" /></svg>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e0245e' }}>Unlike</span>
                              </div>
                            </div>
                            <button
                              className={`_feed_reaction ${post.isLiked ? '_feed_reaction_active' : ''}`}
                              onClick={() => {
                                // Toggle popup visibility on click
                                setHoveredPostId(hoveredPostId === post.id ? null : post.id);
                              }}
                              style={{
                                flex: 1,
                                background: 'none',
                                border: 'none',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                position: 'relative'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f0f2f5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
                                fill={post.isLiked ? "currentColor" : "none"}
                                stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                                style={{
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  transform: post.isLiked ? 'scale(1.1)' : 'scale(1)'
                                }}
                              >
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                              </svg>
                              <span style={{ fontWeight: post.isLiked ? '800' : '600', fontSize: '15px', color: post.isLiked ? '#377DFF' : '#666' }}>
                                {post.isLiked ? 'Liked' : 'Unliked'}
                              </span>
                            </button>
                            <button
                              className="_feed_reaction"
                              onClick={() => toggleComments(post.id)}
                              style={{ flex: 1, background: 'none', border: 'none', padding: '10px', color: '#666' }}
                            >
                              💬 Comment
                            </button>
                          </div>

                          {/* Comments Section */}
                          {expandedComments.has(post.id) && (
                            <div className="_feed_inner_timeline_cooment_area _padd_r24 _padd_l24 _mar_t16">
                              <div className="_feed_inner_comment_box">
                                <div className="_feed_inner_comment_box_form">
                                  <div className="_feed_inner_comment_box_content">
                                    <textarea
                                      className="form-control _comment_textarea"
                                      placeholder="Write a comment..."
                                      value={commentInputs[post.id] || ''}
                                      onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          addComment(post.id);
                                        }
                                      }}
                                    ></textarea>
                                  </div>
                                </div>
                              </div>

                              <div className="_timline_comment_main _mar_t16">
                                {postComments[post.id]?.map((comment) => (
                                  <div key={comment.id} className="_comment_main _mar_b16" style={{ display: 'flex', gap: '10px' }}>
                                    <div className="_comment_image">
                                      <div style={{ width: '35px', height: '35px', background: '#e4e6eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                        {getInitials(comment.user.first_name, comment.user.last_name)}
                                      </div>
                                    </div>
                                    <div className="_comment_area" style={{ flex: 1 }}>
                                      <div className="_comment_details" style={{ background: '#f0f2f5', padding: '10px', borderRadius: '12px' }}>
                                        <h4 className="_comment_name_title" style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
                                          {comment.user.first_name} {comment.user.last_name}
                                        </h4>
                                        <p className="_comment_status_text" style={{ fontSize: '14px', margin: '5px 0' }}>{comment.content}</p>
                                      </div>
                                      <div className="_comment_reply" style={{ marginTop: '5px' }}>
                                        <ul className="_comment_reply_list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '15px', fontSize: '12px', color: '#666' }}>
                                          <li
                                            style={{
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              color: (comment.isLiked ? '#377DFF' : '#666'),
                                              fontWeight: comment.isLiked ? '800' : '600',
                                              transition: 'all 0.2s ease',
                                              position: 'relative'
                                            }}
                                            onClick={() => setHoveredCommentId(hoveredCommentId === comment.id ? null : comment.id)}
                                          >
                                            <div className={`_reaction_panel ${hoveredCommentId === comment.id ? 'show' : ''}`}
                                              style={{
                                                position: 'absolute',
                                                bottom: 'calc(100% + 10px)',
                                                left: '50%',
                                                transform: `translateX(-50%) ${hoveredCommentId === comment.id ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.8)'}`,
                                                background: 'white',
                                                borderRadius: '40px',
                                                padding: '8px 16px',
                                                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                                                display: 'flex',
                                                gap: '12px',
                                                opacity: hoveredCommentId === comment.id ? 1 : 0,
                                                visibility: hoveredCommentId === comment.id ? 'visible' : 'hidden',
                                                transition: 'all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                                zIndex: 9999,
                                                border: '1px solid #f0f2f5',
                                                width: 'max-content',
                                                pointerEvents: hoveredCommentId === comment.id ? 'auto' : 'none'
                                              }}>
                                              <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: 0,
                                                height: 0,
                                                borderLeft: '8px solid transparent',
                                                borderRight: '8px solid transparent',
                                                borderTop: '8px solid white',
                                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                              }}></div>
                                              <div className="_reaction_option"
                                                onClick={(e) => { e.stopPropagation(); toggleLikeComment(post.id, comment.id, 'like'); setHoveredCommentId(null); }}
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s', background: comment.isLiked ? '#f4f8ff' : '#e8f7e8' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#e7f3ff'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = comment.isLiked ? '#f4f8ff' : '#e8f7e8'; }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={comment.isLiked ? '#1f7af5' : '#377DFF'}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: comment.isLiked ? '#1f7af5' : '#377DFF' }}>Like</span>
                                              </div>
                                              <div className="_reaction_option"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleLikeComment(post.id, comment.id, 'unlike');
                                                  setHoveredCommentId(null);
                                                }}
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s', background: comment.isLiked ? '#ffefef' : '#fff1f1' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#ffd6dc'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = comment.isLiked ? '#ffefef' : '#fff1f1'; }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={comment.isLiked ? '#e0245e' : '#a23f4b'}><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3z" /></svg>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e0245e' }}>Unlike</span>
                                              </div>
                                            </div>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                                              fill={comment.isLiked ? "currentColor" : "none"}
                                              stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                                              style={{ transition: 'all 0.2s ease' }}
                                            >
                                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                            </svg>
                                            <span style={{ fontWeight: comment.isLiked ? '800' : '600', fontSize: '12px', color: comment.isLiked ? '#377DFF' : '#666' }}>
                                              {comment.isLiked ? 'Liked' : 'Unliked'}
                                            </span>
                                          </li>
                                          <li style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleShowReplies(post.id, comment.id)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7l1.1.2" />
                                              <path d="m21 3-9 9" />
                                              <path d="m15 3 6 0 0 6" />
                                            </svg>
                                            Reply ({comment.repliesCount || 0})
                                          </li>
                                          <li>{formatTimeAgo(comment.created_at)}</li>
                                        </ul>
                                        {comment.likers && comment.likers.length > 0 && (
                                          <p 
                                            style={{ fontSize: '11px', color: '#377DFF', marginTop: '3px', cursor: 'pointer', fontWeight: '500' }}
                                            onClick={() => openLikersModal(comment.likers || [], comment.user.first_name + " " + comment.user.last_name + "'s comment - Liked by")}
                                          >
                                            Liked by {comment.likers.slice(0, 2).map((l: any) => l.first_name).join(', ')}{comment.likers.length > 2 ? ` +${comment.likers.length - 2}` : ''}
                                          </p>
                                        )}
                                      </div>

                                      {/* Replies Section */}
                                      {showReplies.has(comment.id) && (
                                        <div className="_replies_section _mar_t8" style={{ marginLeft: '20px' }}>
                                          {commentReplies[comment.id]?.map((reply) => (
                                            <div key={reply.id} className="_reply_item _mar_b8" style={{ display: 'flex', gap: '8px' }}>
                                              <div style={{ width: '25px', height: '25px', background: '#e4e6eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                                                {getInitials(reply.user.first_name, reply.user.last_name)}
                                              </div>
                                              <div style={{ flex: 1 }}>
                                                <div style={{ background: '#f0f2f5', padding: '8px', borderRadius: '10px' }}>
                                                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>{reply.user.first_name} {reply.user.last_name}</h4>
                                                  <p style={{ fontSize: '12px', margin: '3px 0' }}>{reply.content}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#666', marginTop: '5px' }}>
                                                  <span
                                                    style={{
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px',
                                                      color: (reply.isLiked ? '#377DFF' : '#666'),
                                                      fontWeight: reply.isLiked ? '800' : '600',
                                                      transition: 'all 0.2s ease',
                                                      position: 'relative'
                                                    }}
                                                    onClick={() => setHoveredReplyId(hoveredReplyId === reply.id ? null : reply.id)}
                                                  >
                                                    <div className={`_reaction_panel ${hoveredReplyId === reply.id ? 'show' : ''}`}
                                                      style={{
                                                        position: 'absolute',
                                                        bottom: 'calc(100% + 8px)',
                                                        left: '50%',
                                                        transform: `translateX(-50%) ${hoveredReplyId === reply.id ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.8)'}`,
                                                        background: 'white',
                                                        borderRadius: '30px',
                                                        padding: '6px 12px',
                                                        boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
                                                        display: 'flex',
                                                        gap: '10px',
                                                        opacity: hoveredReplyId === reply.id ? 1 : 0,
                                                        visibility: hoveredReplyId === reply.id ? 'visible' : 'hidden',
                                                        transition: 'all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                                        zIndex: 9999,
                                                        border: '1px solid #f0f2f5',
                                                        width: 'max-content',
                                                        pointerEvents: hoveredReplyId === reply.id ? 'auto' : 'none'
                                                      }}>
                                                      <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        width: 0,
                                                        height: 0,
                                                        borderLeft: '6px solid transparent',
                                                        borderRight: '6px solid transparent',
                                                        borderTop: '6px solid white',
                                                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                                      }}></div>
                                                      <div className="_reaction_option"
                                                        onClick={(e) => { e.stopPropagation(); toggleLikeReply(post.id, comment.id, reply.id, 'like'); setHoveredReplyId(null); }}
                                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '15px', transition: 'all 0.2s', background: reply.isLiked ? '#f4f8ff' : '#e8f7e8' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#e7f3ff'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = reply.isLiked ? '#f4f8ff' : '#e8f7e8'; }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={reply.isLiked ? '#1f7af5' : '#377DFF'}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: reply.isLiked ? '#1f7af5' : '#377DFF' }}>Like</span>
                                                      </div>
                                                      <div className="_reaction_option"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          toggleLikeReply(post.id, comment.id, reply.id, 'unlike');
                                                          setHoveredReplyId(null);
                                                        }}
                                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '15px', transition: 'all 0.2s', background: reply.isLiked ? '#ffefef' : '#fff1f1' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#ffd6dc'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = reply.isLiked ? '#ffefef' : '#fff1f1'; }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={reply.isLiked ? '#e0245e' : '#a23f4b'}><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3z" /></svg>
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#e0245e' }}>Unlike</span>
                                                      </div>
                                                    </div>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                                                      fill={reply.isLiked ? "currentColor" : "none"}
                                                      stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                                                      style={{ transition: 'all 0.2s ease' }}
                                                    >
                                                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                    </svg>
                                                    <span style={{ fontWeight: reply.isLiked ? '800' : '600', fontSize: '10px', color: reply.isLiked ? '#377DFF' : '#666' }}>
                                                      {reply.isLiked ? 'Liked' : 'Unliked'}
                                                    </span>
                                                  </span>
                                                  <span>{formatTimeAgo(reply.created_at)}</span>
                                                </div>
                                                {reply.likers && reply.likers.length > 0 && (
                                                  <p 
                                                    style={{ fontSize: '9px', color: '#377DFF', marginTop: '2px', cursor: 'pointer', fontWeight: '500' }}
                                                    onClick={() => openLikersModal(reply.likers || [], reply.user.first_name + " " + reply.user.last_name + "'s reply - Liked by")}
                                                  >
                                                    {reply.likers.slice(0, 2).map((l: any) => l.first_name).join(', ')}{reply.likers.length > 2 ? ` +${reply.likers.length - 2}` : ''}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                          <div className="_reply_input _mar_t8">
                                            <input
                                              type="text"
                                              className="form-control"
                                              placeholder="Write a reply..."
                                              style={{ fontSize: '12px', height: '30px' }}
                                              value={replyInputs[comment.id] || ''}
                                              onChange={(e) => setReplyInputs({ ...replyInputs, [comment.id]: e.target.value })}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  addReply(post.id, comment.id);
                                                }
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {/* Pagination Buttons */}
                    {!loading && posts.length > 0 && (
                      <div className="_feed_pagination _mar_t24 _mar_b24" style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                        <button
                          onClick={() => fetchPosts(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="_pagination_btn"
                          style={{
                            padding: '8px 16px',
                            background: currentPage === 1 ? '#e4e6eb' : '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            color: '#333',
                            fontWeight: '500'
                          }}
                        >
                          &larr; Previous
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', fontWeight: '500' }}>Page {currentPage}</span>
                        <button
                          onClick={() => fetchPosts(currentPage + 1)}
                          className="_pagination_btn"
                          style={{
                            padding: '8px 16px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#333',
                            fontWeight: '500'
                          }}
                        >
                          Next &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                <div className="_layout_right_sidebar_wrap">
                  <div className="_layout_right_sidebar_inner">
                    <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                      <h4 className="_title5 _mar_b16">Suggested People</h4>
                      <div className="_right_inner_area_info_ppl">
                        <div className="_left_inner_area_suggest_info">
                          <div className="_left_inner_area_suggest_info_box">
                            <div className="_left_inner_area_suggest_info_image">
                              <img src="/assets/images/people1.png" alt="Image" className="_info_img" />
                            </div>
                            <div className="_left_inner_area_suggest_info_txt">
                              <h4 className="_left_inner_area_suggest_info_title">Steve Jobs</h4>
                              <p className="_left_inner_area_suggest_info_para">CEO of Apple</p>
                            </div>
                          </div>
                          <div className="_left_inner_area_suggest_info_link"> <Link href="#0" className="_info_link">Connect</Link>
                          </div>
                        </div>
                        <div className="_left_inner_area_suggest_info">
                          <div className="_left_inner_area_suggest_info_box">
                            <div className="_left_inner_area_suggest_info_image">
                              <img src="/assets/images/people2.png" alt="Image" className="_info_img" />
                            </div>
                            <div className="_left_inner_area_suggest_info_txt">
                              <h4 className="_left_inner_area_suggest_info_title">Ryan Roslansky</h4>
                              <p className="_left_inner_area_suggest_info_para">CEO of Linkedin</p>
                            </div>
                          </div>
                          <div className="_left_inner_area_suggest_info_link"> <Link href="#0" className="_info_link">Connect</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/* Likers Modal */}
    {showLikersModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }} onClick={() => setShowLikersModal(false)}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '0',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '500px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }} onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e4e6eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#333' }}>
              {likersModalTitle}
            </h3>
            <button
              onClick={() => setShowLikersModal(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#999'
              }}
            >
              ×
            </button>
          </div>

          {/* Modal Body - Likers List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 0'
          }}>
            {selectedLikers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                No likers yet
              </div>
            ) : (
              selectedLikers.map((liker, index) => (
                <div
                  key={liker.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: index < selectedLikers.length - 1 ? '1px solid #f0f2f5' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f2f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#377DFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {getInitials(liker.first_name, liker.last_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#333'
                    }}>
                      {liker.first_name} {liker.last_name}
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: '12px',
                      color: '#999'
                    }}>
                      @{liker.first_name.toLowerCase()}{liker.last_name.toLowerCase()}
                    </p>
                  </div>
                  <button style={{
                    background: 'none',
                    border: '1px solid #377DFF',
                    color: '#377DFF',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#377DFF';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = '#377DFF';
                  }}>
                    View
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
