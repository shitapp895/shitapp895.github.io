import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  updateDoc, 
  doc, 
  getDoc,
  Timestamp,
  startAfter,
  QueryDocumentSnapshot,
  writeBatch
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { Tweet, TweetActivity } from '../models/Tweet';
import { cacheTimeline, getCachedTimeline } from '../utils/tweetCache';

const TWEETS_COLLECTION = 'tweets';
const TWEET_ACTIVITY_COLLECTION = 'tweetActivity';
const TWEETS_PER_PAGE = 5;

// Create a new tweet
export async function createTweet(tweet: Omit<Tweet, 'id' | 'likes' | 'likedBy' | 'createdAt'>): Promise<string> {
  try {
    const tweetData = {
      ...tweet,
      createdAt: Timestamp.now(),
      likes: 0,
      likedBy: []
    };
    
    // Use a batch write to create both the tweet and activity log entry
    const batch = writeBatch(firestore);
    
    // Add the tweet
    const tweetRef = doc(collection(firestore, TWEETS_COLLECTION));
    batch.set(tweetRef, tweetData);
    
    // Create activity log entry
    const activityData: Omit<TweetActivity, 'id'> = {
      userId: tweet.authorId,
      tweetId: tweetRef.id,
      timestamp: Timestamp.now()
    };
    
    const activityRef = doc(collection(firestore, TWEET_ACTIVITY_COLLECTION));
    batch.set(activityRef, activityData);
    
    // Commit the batch
    await batch.commit();
    
    return tweetRef.id;
  } catch (error) {
    console.error('Error creating tweet:', error);
    throw error;
  }
}

// Get recent tweet activity for a user's friends
export async function getRecentTweetActivity(
  friendIds: string[],
  lastTimestamp?: number
): Promise<TweetActivity[]> {
  try {
    if (!friendIds || friendIds.length === 0) return [];
    
    const allActivityDocs: TweetActivity[] = [];
    
    // Process friends in batches of 10 (Firestore 'in' query limit)
    for (let i = 0; i < friendIds.length; i += 10) {
      const batchFriendIds = friendIds.slice(i, i + 10);
      
      // Create a query to find recent activity from this batch of friends
      let batchActivityQuery;
      
      if (lastTimestamp) {
        // Only get activity newer than the last loaded
        const lastDate = new Date(lastTimestamp);
        batchActivityQuery = query(
          collection(firestore, TWEET_ACTIVITY_COLLECTION),
          where('userId', 'in', batchFriendIds),
          where('timestamp', '>', Timestamp.fromDate(lastDate)),
          orderBy('timestamp', 'desc'),
          limit(50) // Get a reasonable batch of activity
        );
      } else {
        // Get the most recent activity
        batchActivityQuery = query(
          collection(firestore, TWEET_ACTIVITY_COLLECTION),
          where('userId', 'in', batchFriendIds),
          orderBy('timestamp', 'desc'),
          limit(50) // Get a reasonable batch of activity
        );
      }
      
      const activitySnapshot = await getDocs(batchActivityQuery);
      
      // Add the results from this batch
      activitySnapshot.docs.forEach(doc => {
        allActivityDocs.push({
          id: doc.id,
          ...doc.data()
        } as TweetActivity);
      });
    }
    
    // Sort all activities by timestamp (newest first)
    allActivityDocs.sort((a, b) => {
      // Safely handle timestamp comparison
      const timeA = a.timestamp && typeof a.timestamp.toMillis === 'function' 
        ? a.timestamp.toMillis() 
        : (typeof a.timestamp === 'number' ? a.timestamp : 0);
      
      const timeB = b.timestamp && typeof b.timestamp.toMillis === 'function' 
        ? b.timestamp.toMillis() 
        : (typeof b.timestamp === 'number' ? b.timestamp : 0);
      
      return timeB - timeA;
    });
    
    // Limit to 50 most recent activities overall
    return allActivityDocs.slice(0, 50);
  } catch (error) {
    console.error('Error fetching recent tweet activity:', error);
    throw error;
  }
}

// Get tweets by IDs (for efficient loading)
export async function getTweetsByIds(tweetIds: string[]): Promise<Tweet[]> {
  try {
    if (!tweetIds || tweetIds.length === 0) return [];
    
    // Firebase has a limit of 10 items for 'in' queries
    // So we need to batch our requests if we have more than 10 ids
    const tweets: Tweet[] = [];
    
    // Process in batches of 10
    for (let i = 0; i < tweetIds.length; i += 10) {
      const batchIds = tweetIds.slice(i, i + 10);
      
      const tweetQuery = query(
        collection(firestore, TWEETS_COLLECTION),
        where('__name__', 'in', batchIds)
      );
      
      const tweetSnapshot = await getDocs(tweetQuery);
      
      // Add the tweets from this batch
      tweetSnapshot.forEach(doc => {
        tweets.push({
          id: doc.id,
          ...doc.data()
        } as Tweet);
      });
    }
    
    // Sort tweets by created date (newest first)
    return tweets.sort((a, b) => {
      // Convert to milliseconds for comparison
      const timeA = typeof a.createdAt === 'number' 
        ? a.createdAt 
        : (a.createdAt && typeof a.createdAt.toMillis === 'function' 
            ? a.createdAt.toMillis() 
            : 0);
      
      const timeB = typeof b.createdAt === 'number' 
        ? b.createdAt 
        : (b.createdAt && typeof b.createdAt.toMillis === 'function' 
            ? b.createdAt.toMillis() 
            : 0);
      
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error fetching tweets by ids:', error);
    throw error;
  }
}

// Get tweets for timeline (from user and their friends)
export async function getTimelineTweets(
  currentUserId: string, 
  friends: string[], 
  lastDoc?: QueryDocumentSnapshot
): Promise<{ tweets: Tweet[], lastDoc?: QueryDocumentSnapshot }> {
  try {
    // Check for cached timeline first
    const cachedTimeline = getCachedTimeline(friends);
    
    if (cachedTimeline && !lastDoc) {
      // We have a cache, now check for new activity since the last load
      const lastLoadedActivity = cachedTimeline.lastLoadedActivity || 0;
      const latestActivity = await getRecentTweetActivity(
        [...friends, currentUserId], 
        lastLoadedActivity
      );
      
      if (latestActivity.length === 0) {
        // No new activity, return cached tweets
        return { tweets: cachedTimeline.tweets };
      }
      
      // Get the new tweets 
      const newTweetIds = latestActivity.map(activity => activity.tweetId);
      const newTweets = await getTweetsByIds(newTweetIds);
      
      // Update cache with the new tweets merged with existing ones
      const allTweets = [...newTweets, ...cachedTimeline.tweets];
      
      // Remove duplicates based on id
      const uniqueTweets = allTweets.filter((tweet, index, self) => 
        index === self.findIndex(t => t.id === tweet.id)
      );
      
      // Sort by date
      uniqueTweets.sort((a, b) => {
        // Safely handle different timestamp formats
        const timeA = typeof a.createdAt === 'number' 
          ? a.createdAt 
          : (a.createdAt && typeof a.createdAt.toMillis === 'function' 
              ? a.createdAt.toMillis() 
              : 0);
        
        const timeB = typeof b.createdAt === 'number' 
          ? b.createdAt 
          : (b.createdAt && typeof b.createdAt.toMillis === 'function' 
              ? b.createdAt.toMillis() 
              : 0);
        
        return timeB - timeA;
      });
      
      // Get the latest activity timestamp
      const lastActivityTimestamp = latestActivity.length > 0 
        ? latestActivity[0].timestamp.toMillis()
        : lastLoadedActivity;
      
      // Cache the updated timeline
      cacheTimeline(uniqueTweets, friends, lastActivityTimestamp);
      
      // Return the first page of tweets
      return { 
        tweets: uniqueTweets.slice(0, TWEETS_PER_PAGE),
        // Use the last doc reference if we need pagination
        lastDoc: lastDoc
      };
    } else if (lastDoc) {
      // This is a pagination request, use the traditional method
      // Include the current user to see their own tweets
      const authors = [...friends, currentUserId];
      
      const timelineQuery = query(
        collection(firestore, TWEETS_COLLECTION),
        where('authorId', 'in', authors),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(TWEETS_PER_PAGE)
      );
      
      const tweetsSnapshot = await getDocs(timelineQuery);
      const lastVisible = tweetsSnapshot.docs[tweetsSnapshot.docs.length - 1];
      
      const paginatedTweets = tweetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tweet[];
      
      return { 
        tweets: paginatedTweets, 
        lastDoc: lastVisible
      };
    } else {
      // No cache or forced refresh, load the full timeline
      // First, get the recent activity to know which tweets to fetch
      const recentActivity = await getRecentTweetActivity(
        [...friends, currentUserId]
      );
      
      if (recentActivity.length === 0) {
        // No activity, return empty array
        return { tweets: [] };
      }
      
      // Get the tweets from the activity
      const tweetIds = recentActivity.map(activity => activity.tweetId);
      const tweets = await getTweetsByIds(tweetIds);
      
      // Get the latest activity timestamp
      const lastActivityTimestamp = recentActivity.length > 0 
        ? recentActivity[0].timestamp.toMillis()
        : Date.now();
      
      // Cache the timeline
      cacheTimeline(tweets, friends, lastActivityTimestamp);
      
      // Return the first page
      return {
        tweets: tweets.slice(0, TWEETS_PER_PAGE),
        lastDoc: undefined // No pagination for now
      };
    }
  } catch (error) {
    console.error('Error fetching timeline tweets:', error);
    throw error;
  }
}

// Like or unlike a tweet
export async function toggleLikeTweet(tweetId: string, userId: string): Promise<void> {
  try {
    const tweetRef = doc(firestore, TWEETS_COLLECTION, tweetId);
    const tweetSnap = await getDoc(tweetRef);
    
    if (!tweetSnap.exists()) {
      throw new Error('Tweet not found');
    }
    
    const tweetData = tweetSnap.data() as Tweet;
    const likedBy = tweetData.likedBy || [];
    
    if (likedBy.includes(userId)) {
      // Unlike the tweet
      await updateDoc(tweetRef, {
        likedBy: likedBy.filter(id => id !== userId),
        likes: tweetData.likes - 1
      });
    } else {
      // Like the tweet
      await updateDoc(tweetRef, {
        likedBy: [...likedBy, userId],
        likes: tweetData.likes + 1
      });
    }
  } catch (error) {
    console.error('Error toggling tweet like:', error);
    throw error;
  }
}

// Delete a tweet (only by owner)
export async function deleteTweet(tweetId: string, userId: string): Promise<void> {
  try {
    const tweetRef = doc(firestore, TWEETS_COLLECTION, tweetId);
    const tweetSnap = await getDoc(tweetRef);
    
    if (!tweetSnap.exists()) {
      throw new Error('Tweet not found');
    }
    
    const tweetData = tweetSnap.data();
    
    if (tweetData.authorId !== userId) {
      throw new Error('Not authorized to delete this tweet');
    }
    
    // Use a batch to delete both the tweet and its activity entry
    const batch = writeBatch(firestore);
    
    // Delete the tweet
    batch.delete(tweetRef);
    
    // Find and delete the activity entry
    const activityQuery = query(
      collection(firestore, TWEET_ACTIVITY_COLLECTION),
      where('tweetId', '==', tweetId)
    );
    
    const activitySnapshot = await getDocs(activityQuery);
    activitySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting tweet:', error);
    throw error;
  }
} 