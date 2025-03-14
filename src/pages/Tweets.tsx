import { useState, useEffect, useCallback, useRef } from 'react';
import { FaHeart, FaRegHeart, FaTrash, FaPlus } from 'react-icons/fa';
import { QueryDocumentSnapshot } from 'firebase/firestore';

import { useAuth } from '../contexts/AuthContext';
import { Tweet } from '../models/Tweet';
import { getCachedTimeline } from '../utils/tweetCache';
import { getTimelineTweets, createTweet, toggleLikeTweet, deleteTweet } from '../services/tweetService';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';

// Helper function to safely format tweet dates
const formatTweetDate = (createdAt: any): string => {
  try {
    // Handle null or undefined
    if (!createdAt) return 'Unknown date';
    
    // If it's a Firestore Timestamp with toDate method
    if (typeof createdAt === 'object' && createdAt !== null && typeof createdAt.toDate === 'function') {
      return createdAt.toDate().toLocaleString();
    }
    
    // If it's a number (milliseconds)
    if (typeof createdAt === 'number') {
      return new Date(createdAt).toLocaleString();
    }
    
    // If it's a Date object
    if (createdAt instanceof Date) {
      return createdAt.toLocaleString();
    }
    
    // If it's a string that can be parsed as a date
    if (typeof createdAt === 'string') {
      try {
        return new Date(createdAt).toLocaleString();
      } catch (e) {
        return createdAt; // Return the string directly if it can't be parsed
      }
    }
    
    // For nested objects/timestamps that might have different formats
    if (typeof createdAt === 'object' && createdAt !== null) {
      // If it has seconds and nanoseconds (Firestore timestamp format)
      if ('seconds' in createdAt && 'nanoseconds' in createdAt) {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }
      
      // If it has a timestamp property
      if ('timestamp' in createdAt && createdAt.timestamp) {
        return formatTweetDate(createdAt.timestamp); // Recursively format the timestamp
      }
    }
    
    // Last fallback - convert to string but handle [object Object]
    const stringValue = String(createdAt);
    return stringValue === '[object Object]' ? 'Unknown date' : stringValue;
  } catch (error) {
    console.error('Error formatting date:', error, 'Value was:', createdAt);
    return 'Invalid date';
  }
};

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
  const [lastAutoRefresh, setLastAutoRefresh] = useState(0);

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
        const cachedData = getCachedTimeline(friends);
        if (cachedData && cachedData.tweets.length > 0) {
          setTweets(cachedData.tweets);
          setLoading(false);
          
          // Only auto-refresh if it's been more than 5 minutes since the last refresh
          const now = Date.now();
          if (now - lastAutoRefresh > 5 * 60 * 1000) {
            setLastAutoRefresh(now);
            // Quietly check for updates in the background
            setTimeout(() => {
              loadTweets(true).catch(console.error);
            }, 2000); // Wait 2 seconds to avoid immediate reload
          }
          return;
        }
      }
      
      // Load from Firestore
      const result = await getTimelineTweets(currentUser.uid, friends);
      
      setTweets(result.tweets);
      setLastDoc(result.lastDoc);
      setHasMore(result.tweets.length === 5);
      
    } catch (err: any) {
      console.error('Error loading tweets:', err);
      setError(err.message || 'Failed to load tweets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, friends, tweets.length, lastAutoRefresh]);

  // Load more tweets when scrolling
  const loadMoreTweets = useCallback(async () => {
    if (!currentUser || !lastDoc || !hasMore || loadingMore) return;
    
    try {
      setLoadingMore(true);
      
      const result = await getTimelineTweets(currentUser.uid, friends, lastDoc);
      
      if (result.tweets.length > 0) {
        setTweets(prev => [...prev, ...result.tweets]);
        setLastDoc(result.lastDoc);
        setHasMore(result.tweets.length === 5);
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
      
      // Refresh the timeline after posting a new tweet
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
        <h1 className="text-2xl font-bold mb-6">Shwitter</h1>
        
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
                    {formatTweetDate(tweet.createdAt)}
                  </div>
                </div>
                
                <div className="my-3 text-gray-900">{tweet.content}</div>
                
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