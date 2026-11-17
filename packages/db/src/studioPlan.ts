// File: packages/db/src/studioPlan.ts
import { getFirestoreServerInstance } from './index';
import { StudioPlan, Studio } from '@focoman/types';

/**
 * Reads the studio plan document from Firestore.
 * Path: studios/{studioId} with field planInfo.
 */
export async function getStudioPlan(studioId: string): Promise<StudioPlan | null> {
  const firestore = getFirestoreServerInstance();
  const docRef = firestore.collection('studios').doc(studioId.toLowerCase());
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() as Studio;
  return data?.planInfo ?? null;
}

/**
 * Upserts the studio plan information.
 */
export async function upsertStudioPlan(studioId: string, plan: Partial<StudioPlan>): Promise<void> {
  const firestore = getFirestoreServerInstance();
  const docRef = firestore.collection('studios').doc(studioId.toLowerCase());
  await docRef.set({ planInfo: plan, updatedAt: new Date().toISOString() }, { merge: true });
}
