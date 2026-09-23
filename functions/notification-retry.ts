const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export default async function notificationRetry(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  return jsonResponse(
    { code: "LEAN_SCOPE_DEFERRED", message: "Notification retry is disabled" },
    404,
  );
}
