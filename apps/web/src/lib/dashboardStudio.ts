import 'server-only';
import { cache } from 'react';
import { getStudioBySlug } from '@focoman/db';

// Only used by server-rendered layout/page after their access guard.
// React cache is per render request, never a persistent authorization cache.
export const getDashboardStudio = cache((studioSlug: string) => getStudioBySlug(studioSlug));
