import { Timestamp } from 'firebase/firestore';

export interface Tweet {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp | number;
  likes: number;
  likedBy: string[];
  media?: string[];
  isPublic: boolean;
}

export interface TimelineCache {
  tweets: Tweet[];
  lastUpdated: number;
  friendsHash: string; // Hash of friends list to detect changes
} 