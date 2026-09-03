import { db } from './firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import type { UserProfile } from '../types';

export const FREE_LIMITS = {
  CHAT_MESSAGES: 10,
  TOPICS: 2,
} as const;

export function getFreeChatUsed(user: UserProfile | null): number {
  return user?.free_chat_used ?? 0;
}

export function getFreeTopicsUnlocked(user: UserProfile | null): string[] {
  return user?.free_topics_unlocked ?? [];
}

export function canSendChat(user: UserProfile | null): boolean {
  if (user?.is_pro) return true;
  return getFreeChatUsed(user) < FREE_LIMITS.CHAT_MESSAGES;
}

export function canUnlockTopic(user: UserProfile | null, topicId: string): boolean {
  if (user?.is_pro) return true;
  const unlocked = getFreeTopicsUnlocked(user);
  return unlocked.includes(topicId) || unlocked.length < FREE_LIMITS.TOPICS;
}

export function isTopicUnlocked(user: UserProfile | null, topicId: string): boolean {
  if (user?.is_pro) return true;
  return getFreeTopicsUnlocked(user).includes(topicId);
}

export async function spendChatCredit(userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    free_chat_used: increment(1),
  });
}

export async function unlockTopic(userId: string, topicId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    free_topics_unlocked: arrayUnion(topicId),
  });
}
