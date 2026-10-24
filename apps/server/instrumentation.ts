/// Next.js calls `register` once per server instance. Only the Node runtime
/// has a database client and timers, so the edge build skips it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMoneyExpirySweep } = await import("./src/services/money-expiry");
  startMoneyExpirySweep();
}
