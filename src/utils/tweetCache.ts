import { Tweet, TimelineCache } from '../models/Tweet';

// Generate a hash of the friends list to detect changes
export function generateFriendsHash(friends: string[]): string {
  return friends.sort().join('|');
}

// Save timeline to cache
export function cacheTimeline(tweets: Tweet[], friends: string[]): void {
  const cache: TimelineCache = {
    tweets,
    lastUpdated: Date.now(),
    friendsHash: generateFriendsHash(friends)
  };
  localStorage.setItem('timeline_cache', JSON.stringify(cache));
}

// Get cached timeline if valid
export function getCachedTimeline(friends: string[], maxAge = 5 * 60 * 1000): Tweet[] | null {
  try {
    const cacheJson = localStorage.getItem('timeline_cache');
    if (!cacheJson) return null;
    
    const cache: TimelineCache = JSON.parse(cacheJson);
    const currentTime = Date.now();
    const friendsHash = generateFriendsHash(friends);
    
    // Return null if cache is outdated or friends list changed
    if (currentTime - cache.lastUpdated > maxAge || cache.friendsHash !== friendsHash) {
      return null;
    }
    
    return cache.tweets;
  } catch (error) {
    console.error('Error retrieving cached timeline:', error);
    return null;
  }
} 