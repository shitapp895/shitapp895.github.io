import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { firestore } from '../firebase/config';

// Interface for recommended friend
export interface RecommendedFriend {
  uid: string;
  displayName: string;
  email: string;
  mutualFriends: number;
}

// Interface for recommendation cache
interface FriendRecommendationsCache {
  recommendations: RecommendedFriend[];
  lastUpdated: number;
  friendsHash: string; // Hash of friends list to detect changes
  sampledFriends: string[]; // Store which friends were sampled
}

// Cache key in localStorage
const RECOMMENDATIONS_CACHE_KEY = 'friendRecommendationsCache';

// Generate a hash of the friends list to detect changes
function generateFriendsHash(friends: string[]): string {
  return friends.sort().join('|');
}

// Cache the recommendations
function cacheRecommendations(
  recommendations: RecommendedFriend[], 
  allFriends: string[],
  sampledFriends: string[]
): void {
  const cache: FriendRecommendationsCache = {
    recommendations,
    lastUpdated: Date.now(),
    friendsHash: generateFriendsHash(allFriends),
    sampledFriends
  };
  
  localStorage.setItem(RECOMMENDATIONS_CACHE_KEY, JSON.stringify(cache));
}

// Get cached recommendations if valid
function getCachedRecommendations(friends: string[], maxAge = 24 * 60 * 60 * 1000): RecommendedFriend[] | null {
  try {
    const cachedData = localStorage.getItem(RECOMMENDATIONS_CACHE_KEY);
    if (!cachedData) return null;
    
    const cache: FriendRecommendationsCache = JSON.parse(cachedData);
    const currentTime = Date.now();
    const friendsHash = generateFriendsHash(friends);
    
    // Return null if cache is outdated or friends list changed
    if (currentTime - cache.lastUpdated > maxAge || cache.friendsHash !== friendsHash) {
      return null;
    }
    
    return cache.recommendations;
  } catch (error) {
    console.error('Error reading recommendations cache:', error);
    return null;
  }
}

// Calculate friend recommendations based on mutual friends
function calculateRecommendations(
  currentUserId: string, 
  allCurrentUserFriends: string[], 
  friendsOfFriends: Map<string, string[]>
): { uid: string; mutualFriends: number }[] {
  const currentUserFriendsSet = new Set(allCurrentUserFriends);
  const candidatesMap = new Map<string, number>(); // uid -> mutual friends count
  
  // Count mutual friends for each friend-of-friend
  for (const [friendId, friendsFriends] of friendsOfFriends.entries()) {
    for (const potentialFriend of friendsFriends) {
      // Skip if this is the current user or already a friend
      if (potentialFriend === currentUserId || currentUserFriendsSet.has(potentialFriend)) {
        continue;
      }
      
      // Increment mutual friend count
      candidatesMap.set(
        potentialFriend, 
        (candidatesMap.get(potentialFriend) || 0) + 1
      );
    }
  }
  
  // Convert to array and sort by mutual friend count (descending)
  const recommendationsArray = Array.from(candidatesMap.entries())
    .map(([uid, mutualCount]) => ({ uid, mutualFriends: mutualCount }))
    .sort((a, b) => b.mutualFriends - a.mutualFriends);
  
  return recommendationsArray;
}

// Get friend recommendations with sampling to minimize reads
export async function getFriendRecommendations(
  currentUserId: string, 
  limit = 5, 
  maxFriendsToSample = 10
): Promise<RecommendedFriend[]> {
  try {
    // Get current user document
    const userDoc = await getDoc(doc(firestore, 'users', currentUserId));
    if (!userDoc.exists()) {
      throw new Error("User document not found");
    }
    
    const userData = userDoc.data();
    const allCurrentUserFriends = userData.friends || [];
    
    // Check cache first
    const cachedRecommendations = getCachedRecommendations(allCurrentUserFriends);
    if (cachedRecommendations) {
      return cachedRecommendations.slice(0, limit);
    }
    
    // If no friends, return empty array
    if (allCurrentUserFriends.length === 0) {
      return [];
    }
    
    // Sample friends if there are more than the maximum to sample
    let sampledFriends = [...allCurrentUserFriends];
    if (allCurrentUserFriends.length > maxFriendsToSample) {
      // Shuffle the friends array
      const shuffled = [...allCurrentUserFriends].sort(() => 0.5 - Math.random());
      // Take only the first maxFriendsToSample elements
      sampledFriends = shuffled.slice(0, maxFriendsToSample);
    }
    
    // Get sampled friends' data in one batch
    const friendsQuery = query(
      collection(firestore, 'users'),
      where('uid', 'in', sampledFriends)
    );
    
    const friendDocs = await getDocs(friendsQuery);
    
    // Map to store each friend's friends list
    const friendsOfFriends = new Map<string, string[]>();
    
    friendDocs.forEach(doc => {
      const friendData = doc.data();
      const friendId = friendData.uid;
      const friendsFriends = friendData.friends || [];
      friendsOfFriends.set(friendId, friendsFriends);
    });
    
    // Calculate recommendations based on the sample
    const recommendations = calculateRecommendations(
      currentUserId, 
      allCurrentUserFriends, 
      friendsOfFriends
    );
    
    // Fetch details for the top recommendations
    const topRecommendationIds = recommendations
      .slice(0, limit)
      .map(rec => rec.uid);
    
    if (topRecommendationIds.length === 0) {
      return [];
    }
    
    // Get user details for recommendations
    const recommendedUsersQuery = query(
      collection(firestore, 'users'),
      where('uid', 'in', topRecommendationIds)
    );
    
    const recommendedUserDocs = await getDocs(recommendedUsersQuery);
    
    // Map uid to user details
    const userMap = new Map<string, { displayName: string, email: string }>();
    recommendedUserDocs.forEach(doc => {
      const userData = doc.data();
      userMap.set(userData.uid, {
        displayName: userData.displayName,
        email: userData.email
      });
    });
    
    // Build final recommendations with user details
    const finalRecommendations: RecommendedFriend[] = [];
    
    for (const rec of recommendations.slice(0, limit)) {
      const userDetails = userMap.get(rec.uid);
      if (userDetails) {
        finalRecommendations.push({
          uid: rec.uid,
          displayName: userDetails.displayName,
          email: userDetails.email,
          mutualFriends: rec.mutualFriends
        });
      }
    }
    
    // Cache the results
    cacheRecommendations(finalRecommendations, allCurrentUserFriends, sampledFriends);
    
    return finalRecommendations;
  } catch (error) {
    console.error('Error getting friend recommendations:', error);
    throw error;
  }
}

// Add a function to ignore a recommendation (just for UI state management)
export function ignoreRecommendation(recommendationId: string): void {
  try {
    const cachedData = localStorage.getItem(RECOMMENDATIONS_CACHE_KEY);
    if (!cachedData) return;
    
    const cache: FriendRecommendationsCache = JSON.parse(cachedData);
    
    // Filter out the ignored recommendation
    cache.recommendations = cache.recommendations.filter(rec => rec.uid !== recommendationId);
    
    // Update the cache
    localStorage.setItem(RECOMMENDATIONS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error ignoring recommendation:', error);
  }
} 