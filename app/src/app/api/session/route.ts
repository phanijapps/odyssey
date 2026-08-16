import {
  authenticateChild,
  logoutSession,
  resolveSession,
} from "../../../server/identity/identity";

const EIGHT_HOURS = 8 * 60 * 60;

function cookieBase(): string {
  return `HttpOnly; SameSite=Strict; Path=/${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function GET(request: Request): Response {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session)
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  return Response.json({
    childId: session.childId,
    username: session.username,
    role: session.role,
  });
}

type SessionCredentials = { username: string; password: string };

/** Parses the exact public sign-in DTO before account lookup. */
function parseSessionCredentials(body: unknown): SessionCredentials {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid credentials");
  const candidate = body as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== 2 ||
    !Object.hasOwn(candidate, "username") ||
    !Object.hasOwn(candidate, "password") ||
    typeof candidate.username !== "string" ||
    typeof candidate.password !== "string"
  )
    throw new Error("Invalid credentials");
  return { username: candidate.username, password: candidate.password };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const credentials = parseSessionCredentials(await request.json());
    const session = await authenticateChild(credentials);
    return Response.json(
      {
        childId: session.childId,
        username: session.username,
        role: session.role,
      },
      {
        headers: {
          "Set-Cookie": `session=${session.sessionToken}; ${cookieBase()}; Max-Age=${EIGHT_HOURS}`,
        },
      },
    );
  } catch {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (token) logoutSession(token);
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `session=; ${cookieBase()}; Max-Age=0`,
    },
  });
}
