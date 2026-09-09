import type { UserProfile } from '../context/AuthContext';

export interface SalespersonEntity {
  uid: string;
  uids: Set<string>;
  displayName: string;
  email?: string;
  role?: string;
  status?: string;
}

/**
 * Returns a formatted display name for a salesperson/user.
 * Appends "(Inactive)" if the user account has been soft-deleted/deactivated.
 */
export const getSalespersonLabel = (users: UserProfile[], uidOrName?: string | null): string => {
  if (!uidOrName) return 'Unassigned';
  const found = users.find(
    (u) =>
      u.uid === uidOrName ||
      u.displayName === uidOrName ||
      (u.email && u.email.toLowerCase() === uidOrName.toLowerCase())
  );

  if (found) {
    return found.status === 'deactivated' ? `${found.displayName} (Inactive)` : found.displayName;
  }

  return uidOrName;
};

/**
 * Returns deduplicated active team members grouped by normalized display name/email.
 */
export const getDeduplicatedSalespeople = (users: UserProfile[]): SalespersonEntity[] => {
  const map = new Map<string, SalespersonEntity>();

  users.forEach((u) => {
    if (u.status === 'deactivated') return;

    const rawName = (u.displayName || u.email || 'Unknown').trim();
    const isAdminVariant = rawName.toLowerCase() === 'admin user' || rawName.toLowerCase() === 'admin';
    const normKey = isAdminVariant ? 'admin' : rawName.toLowerCase();
    const displayName = isAdminVariant ? 'Admin' : rawName;

    if (map.has(normKey)) {
      const existing = map.get(normKey)!;
      existing.uids.add(u.uid);
      if (existing.uid.endsWith('-uid') && !u.uid.endsWith('-uid')) {
        existing.uid = u.uid;
      }
    } else {
      map.set(normKey, {
        uid: u.uid,
        uids: new Set([u.uid]),
        displayName,
        email: u.email,
        role: u.role,
        status: u.status,
      });
    }
  });

  return Array.from(map.values());
};

/**
 * Returns only active, non-deactivated team members eligible for new assignments.
 */
export const getActiveSalespeople = (users: UserProfile[]): UserProfile[] => {
  const deduplicated = getDeduplicatedSalespeople(users);
  return deduplicated.map((d) => {
    const original = users.find((u) => u.uid === d.uid);
    if (original) return original;
    return {
      uid: d.uid,
      displayName: d.displayName,
      email: d.email || '',
      role: (d.role as 'admin' | 'salesperson') || 'salesperson',
      status: 'active',
    };
  });
};
