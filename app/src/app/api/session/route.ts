import {
  authenticateChild,
  logoutSession,
  resolveSession,
} from "../../../server/identity/identity";

const COOKIE_BASE = "HttpOnly; SameSite=Strict; Path=/";
const EIGHT_HOURS = 8 * 60 * 60;

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

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const session = await authenticateChild({
      username: body.username ?? "",
      password: body.password ?? "",
    });
    return Response.json(
      {
        childId: session.childId,
        username: session.username,
        role: session.role,
      },
      {
        headers: {
          "Set-Cookie": `session=${session.sessionToken}; ${COOKIE_BASE}; Max-Age=${EIGHT_HOURS}`,
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
      "Set-Cookie": `session=; ${COOKIE_BASE}; Max-Age=0`,
    },
  });
}
