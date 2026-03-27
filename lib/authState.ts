"use client";

/**
 * Shared client-side auth state.
 * "use client" guarantees a single module instance in the browser,
 * so setCurrentUserId() in SupabaseProvider is visible to all store actions.
 */

let _userId: string | null = null;

export const setCurrentUserId = (id: string | null): void => {
  _userId = id;
};

export const getCurrentUserId = (): string | null => _userId;
