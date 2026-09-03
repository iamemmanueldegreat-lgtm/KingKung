import { db } from './firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'kortex_read_topics';

/**
 * Get the list of read topic IDs from localStorage.
 */
export function getReadTopicsLocal(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to read topics from localStorage', e);
    return [];
  }
}

/**
 * Save read topic ID to local storage & broadcast event for reactive UI updates.
 */
export function markTopicAsRead(topicId: string, userId?: string): void {
  if (!topicId) return;

  try {
    const existing = getReadTopicsLocal();
    if (!existing.includes(topicId)) {
      const updated = [...existing, topicId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('read_topics_updated', { detail: { topicId, allRead: updated } }));
    }
  } catch (e) {
    console.warn('Failed to save read topic locally', e);
  }

  // Asynchronously sync with Firestore user profile if logged in
  if (userId) {
    try {
      const userRef = doc(db, 'users', userId);
      updateDoc(userRef, {
        read_topics: arrayUnion(topicId),
      }).catch(err => {
        console.warn('Non-fatal error updating read_topics in Firestore:', err);
      });
    } catch (e) {
      console.warn('Error queuing read_topics update', e);
    }
  }
}

/**
 * Check if a topic is marked as read.
 */
export function isTopicRead(topicId: string, firestoreReadTopics?: string[]): boolean {
  if (!topicId) return false;
  if (firestoreReadTopics && firestoreReadTopics.includes(topicId)) {
    return true;
  }
  const localList = getReadTopicsLocal();
  return localList.includes(topicId);
}
