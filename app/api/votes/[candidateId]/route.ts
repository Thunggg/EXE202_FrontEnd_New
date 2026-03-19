export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await ctx.params;
  const upstreamBase = process.env.VOTES_API_BASE_URL ?? "http://localhost:8080/api/votes";
  const upstream = `${upstreamBase}/${encodeURIComponent(candidateId)}`;

  const res = await fetch(upstream, { cache: "no-store" });
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

