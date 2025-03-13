import { useState, useEffect, useCallback, useRef } from 'react';
import { FaHeart, FaRegHeart, FaTrash, FaPlus, FaGlobeAmericas, FaUserFriends } from 'react-icons/fa';
import { QueryDocumentSnapshot } from 'firebase/firestore';

import { useAuth } from '../contexts/AuthContext';
import { Tweet } from '../models/Tweet';
import { getCachedTimeline } from '../utils/tweetCache';
import { getTimelineTweets, createTweet, toggleLikeTweet, deleteTweet } from '../services/tweetService';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';

const Tweets = () => {
  const { currentUser, userData } = useAuth();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTweetContent, setNewTweetContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [friends, setFriends] = useState<string[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUser) return;
      
      try {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userDocRef);
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setFriends(userData.friends || []);
        }
      } catch (err) {
        console.error('Error loading friends:', err);
        setError('Failed to load friends list');
      }
    };
    
    loadFriends();
  }, [currentUser]);

  // Load tweets
  const loadTweets = useCallback(async (forceRefresh = false) => {
    if (!currentUser) return;
    
    try {
      setError(null);
      
      if (forceRefresh) {
        setRefreshing(true);
      } else if (!tweets.length) {
        setLoading(true);
      }
      
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedTweets = getCachedTimeline(friends);
        if (cachedTweets && cachedTweets.length > 0) {
          setTweets(cachedTweets);
          setLoading(false);
          
          // Refresh in background after showing cached results
          setTimeout(() => {
            loadTweets(true).catch(console.error);
          }, 100);
          return;
        }
      }
      
      // Load from Firestore
      const result = await getTimelineTweets(currentUser.uid, friends);
      
      setTweets(result.tweets);
      setLastDoc(result.lastDoc);
      setHasMore(result.tweets.length === 5); // Changed from 20 to 5
      
    } catch (err: any) {
      console.error('Error loading tweets:', err);
      setError(err.message || 'Failed to load tweets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, friends, tweets.length]);

  // Load more tweets when scrolling
  const loadMoreTweets = useCallback(async () => {
    if (!currentUser || !lastDoc || !hasMore || loadingMore) return;
    
    try {
      setLoadingMore(true);
      
      const result = await getTimelineTweets(currentUser.uid, friends, lastDoc);
      
      if (result.tweets.length > 0) {
        setTweets(prev => [...prev, ...result.tweets]);
        setLastDoc(result.lastDoc);
        setHasMore(result.tweets.length === 5); // Changed from 20 to 5
      } else {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error('Error loading more tweets:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser, friends, lastDoc, hasMore, loadingMore]);

  // Setup intersection observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreTweets();
        }
      },
      { threshold: 0.5 }
    );
    
    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }
    
    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [loadMoreTweets, hasMore, loadingMore]);

  // Initial load
  useEffect(() => {
    if (currentUser && friends.length >= 0) {
      loadTweets();
    }
  }, [currentUser, friends, loadTweets]);

  // Post a new tweet
  const handlePostTweet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !newTweetContent.trim()) return;
    
    try {
      setPosting(true);
      
      await createTweet({
        authorId: currentUser.uid,
        authorName: userData?.displayName || 'Anonymous',
        content: newTweetContent.trim(),
        isPublic: false
      });
      
      setNewTweetContent('');
      
      // Refresh the timeline
      loadTweets(true);
      
    } catch (err: any) {
      console.error('Error posting tweet:', err);
      setError(err.message || 'Failed to post tweet');
    } finally {
      setPosting(false);
    }
  };

  // Like or unlike a tweet
  const handleToggleLike = async (tweetId: string) => {
    if (!currentUser) return;
    
    try {
      await toggleLikeTweet(tweetId, currentUser.uid);
      
      // Update tweets state optimistically
      setTweets(prev => prev.map(tweet => {
        if (tweet.id === tweetId) {
          const isLiked = tweet.likedBy.includes(currentUser.uid);
          return {
            ...tweet,
            likes: isLiked ? tweet.likes - 1 : tweet.likes + 1,
            likedBy: isLiked 
              ? tweet.likedBy.filter(id => id !== currentUser.uid)
              : [...tweet.likedBy, currentUser.uid]
          };
        }
        return tweet;
      }));
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  // Delete a tweet
  const handleDeleteTweet = async (tweetId: string) => {
    if (!currentUser) return;
    
    try {
      await deleteTweet(tweetId, currentUser.uid);
      
      // Remove from state
      setTweets(prev => prev.filter(tweet => tweet.id !== tweetId));
    } catch (err: any) {
      console.error('Error deleting tweet:', err);
      setError(err.message || 'Failed to delete tweet');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">Tweet Feed</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Post new tweet form */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <form onSubmit={handlePostTweet}>
            <textarea
              className="w-full p-3 border rounded mb-3 text-gray-900 placeholder-gray-500"
              placeholder="What's happening?"
              value={newTweetContent}
              onChange={e => setNewTweetContent(e.target.value)}
              rows={3}
              maxLength={280}
              disabled={posting}
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-sm text-gray-500">
                  {newTweetContent.length}/280
                </div>
              </div>
              
              <button
                type="submit"
                className="btn btn-primary flex items-center"
                disabled={!newTweetContent.trim() || posting}
              >
                <FaPlus className="mr-1" />
                Post
              </button>
            </div>
          </form>
        </div>
        
        {/* Refresh button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => loadTweets(true)}
            className="text-primary hover:text-primary-dark"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {/* Tweets list */}
        {loading ? (
          <div className="text-center p-8">Loading tweets...</div>
        ) : tweets.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <p>No tweets yet! Be the first to post or follow some friends.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tweets.map(tweet => (
              <div key={tweet.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between">
                  <div className="font-bold">{tweet.authorName}</div>
                  <div className="text-gray-500 text-sm">
                    {typeof tweet.createdAt === 'number'
                      ? new Date(tweet.createdAt).toLocaleString()
                      : new Date(tweet.createdAt.toDate()).toLocaleString()}
                  </div>
                </div>
                
                <div className="my-3">{tweet.content}</div>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center">
                    <button 
                      onClick={() => tweet.id && handleToggleLike(tweet.id)}
                      className="flex items-center text-gray-500 hover:text-red-500"
                    >
                      {currentUser && tweet.likedBy.includes(currentUser.uid) ? (
                        <FaHeart className="text-red-500 mr-1" />
                      ) : (
                        <FaRegHeart className="mr-1" />
                      )}
                      <span>{tweet.likes}</span>
                    </button>
                  </div>
                  
                  {currentUser && tweet.authorId === currentUser.uid && (
                    <button
                      onClick={() => tweet.id && handleDeleteTweet(tweet.id)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {/* Load more trigger */}
            <div ref={observerTarget} className="h-10 flex justify-center">
              {loadingMore && <div>Loading more...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tweets; 