import { timingSafeEqual } from "node:crypto";

function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export function verifyIngestToken(request: Request) {
  const expectedToken = process.env.TELEMETRY_INGEST_TOKEN;

  if (!expectedToken) {
    return {
      ok: true,
      mode: "open" as const,
    };
  }

  const providedToken = extractBearerToken(request);

  if (!providedToken) {
    return {
      ok: false,
      status: 401,
      message: "Missing bearer token for telemetry ingest.",
    };
  }

  const expectedBuffer = Buffer.from(expectedToken, "utf8");
  const providedBuffer = Buffer.from(providedToken, "utf8");

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return {
      ok: false,
      status: 401,
      message: "Invalid telemetry ingest token.",
    };
  }

  return {
    ok: true,
    mode: "protected" as const,
  };
}
