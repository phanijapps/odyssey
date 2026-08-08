import {
  authenticateChild,
  logoutSession,
} from "../../../server/identity/identity";

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
      { childId: session.childId },
      {
        headers: {
          "Set-Cookie": `session=${session.sessionToken}; HttpOnly; SameSite=Strict; Path=/`,
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
      "Set-Cookie": "session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/",
    },
  });
}
