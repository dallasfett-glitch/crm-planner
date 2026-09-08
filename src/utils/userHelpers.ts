import type { UserProfile } from '../context/AuthContext';

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
 * Returns only active, non-deactivated team members eligible for new assignments.
 */
export const getActiveSalespeople = (users: UserProfile[]): UserProfile[] => {
  return users.filter((u) => u.status !== 'deactivated');
};
