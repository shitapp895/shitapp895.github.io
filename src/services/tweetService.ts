import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  Timestamp,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { Tweet } from '../models/Tweet';
import { cacheTimeline } from '../utils/tweetCache';

const TWEETS_COLLECTION = 'tweets';
const TWEETS_PER_PAGE = 5;

// Create a new tweet
export async function createTweet(tweet: Omit<Tweet, 'id' | 'likes' | 'likedBy'>): Promise<string> {
  try {
    const tweetData = {
      ...tweet,
      createdAt: Timestamp.now(),
      likes: 0,
      likedBy: []
    };
    
    const docRef = await addDoc(collection(firestore, TWEETS_COLLECTION), tweetData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating tweet:', error);
    throw error;
  }
}

// Get tweets for timeline (from user and their friends)
export async function getTimelineTweets(currentUserId: string, friends: string[], lastDoc?: QueryDocumentSnapshot): Promise<{ tweets: Tweet[], lastDoc?: QueryDocumentSnapshot }> {
  try {
    // Include the current user to see their own tweets
    const authors = [...friends, currentUserId];
    
    let timelineQuery;
    
    if (lastDoc) {
      // Pagination query
      timelineQuery = query(
        collection(firestore, TWEETS_COLLECTION),
        where('authorId', 'in', authors),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(TWEETS_PER_PAGE)
      );
    } else {
      // Initial query
      timelineQuery = query(
        collection(firestore, TWEETS_COLLECTION),
        where('authorId', 'in', authors),
        orderBy('createdAt', 'desc'),
        limit(TWEETS_PER_PAGE)
      );
    }
    
    const tweetsSnapshot = await getDocs(timelineQuery);
    const lastVisible = tweetsSnapshot.docs[tweetsSnapshot.docs.length - 1];
    
    const tweets = tweetsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tweet[];
    
    // Cache the results if it's the initial load
    if (!lastDoc) {
      cacheTimeline(tweets, friends);
    }
    
    return { 
      tweets, 
      lastDoc: lastVisible
    };
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
    
    await deleteDoc(tweetRef);
  } catch (error) {
    console.error('Error deleting tweet:', error);
    throw error;
  }
} 