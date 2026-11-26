export class NextResponse extends Response {
  static json(body: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }
  cookies = {
    set: (name: string, value: string, o: { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string; maxAge?: number } = {}) => {
      const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? "/"}`, `Max-Age=${o.maxAge ?? 0}`];
      if (o.httpOnly) parts.push("HttpOnly");
      if (o.secure) parts.push("Secure");
      if (o.sameSite) parts.push(`SameSite=${o.sameSite}`);
      this.headers.append("Set-Cookie", parts.join("; "));
    },
  };
}
