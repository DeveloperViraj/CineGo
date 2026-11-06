// Purpose: One place to read Clerk users and derive roles.
// Every Clerk lookup is an HTTPS round trip (~150-400ms). The old code did
// 2-3 of them on EVERY signed-in request. Here we cache each user for a short
// time and de-duplicate concurrent lookups, so a page that fires several API
// calls at once only pays for one lookup.

import { clerkClient } from "@clerk/express";

const TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { at, promise }

const parseList = (value) =>
  (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const primaryEmailOf = (u) =>
  u?.emailAddresses
    ?.find((e) => e.id === u.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase() || "";

export async function getClerkUser(userId, { fresh = false } = {}) {
  if (!userId) return null;
  const hit = cache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = clerkClient.users.getUser(userId).catch((err) => {
    cache.delete(userId);
    throw err;
  });
  cache.set(userId, { at: Date.now(), promise });

  // Keep the cache from growing without bound on long-running servers
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  return promise;
}

export function forgetClerkUser(userId) {
  cache.delete(userId);
}

export const isOwnerEmail = (email) =>
  !!email && parseList(process.env.OWNER_EMAIL).includes(email);

export const isConfiguredAdminEmail = (email) =>
  !!email && parseList(process.env.ADMIN_EMAILS).includes(email);

// Resolve the roles of a Clerk user.
// - admin: privateMetadata.role === "admin", or listed in ADMIN_EMAILS / OWNER_EMAIL
// - demo:  sandboxed admin unlocked with the demo passcode (must never touch real data)
export function rolesOf(user) {
  const email = primaryEmailOf(user);
  const meta = user?.privateMetadata || {};
  const owner = isOwnerEmail(email);
  const configuredAdmin = owner || isConfiguredAdminEmail(email);
  const admin = meta.role === "admin" || configuredAdmin;
  // Owner / ADMIN_EMAILS accounts are always real admins, even if they once used the demo code
  const demo = meta.demo === true && !configuredAdmin;
  return { email, owner, admin, demo, realAdmin: admin && !demo };
}

// Persist role=admin for ADMIN_EMAILS users (replaces the old per-request
// "auto-promote" middleware, which called Clerk twice on every request).
export async function ensureAdminRoleSaved(user) {
  const { admin } = rolesOf(user);
  if (admin && user?.privateMetadata?.role !== "admin") {
    try {
      await clerkClient.users.updateUser(user.id, {
        privateMetadata: { ...user.privateMetadata, role: "admin" },
      });
      forgetClerkUser(user.id);
    } catch (err) {
      console.error("ensureAdminRoleSaved:", err.message);
    }
  }
}
