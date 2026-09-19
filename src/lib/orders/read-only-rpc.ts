type RpcResult = { error?: unknown };

function isSocketHangUp(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "message" in error
      && String(error.message).toLowerCase() === "socket hang up",
  );
}

/** Retry one safe read after the observed transient Development transport reset. */
export async function readOnlyRpcWithSocketRetry<T extends RpcResult>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  try {
    const first = await operation();
    if (!isSocketHangUp(first.error)) return first;
  } catch (error) {
    if (!isSocketHangUp(error)) throw error;
  }
  return operation();
}
