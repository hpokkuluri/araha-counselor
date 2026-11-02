/**
 * Licensing seam for a future Arahasoft account.
 * Version 1 is free and offline: every local profile is entitled.
 * A later sign-in service can replace getEntitlement() without rewriting
 * the counselor, essays, or study tools. Do not add network calls here.
 */
export async function getEntitlement(account) {
  return {
    ok: true,
    tier: "local",
    source: "device",
    accountId: account?.id || null,
  };
}
