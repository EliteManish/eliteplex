const UPSTREAM = "https://freakyniki.elaxo.lol/";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only GET
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      tmdb_id,
      season,
      episode
    } = req.query;

    // -----------------------------
    // Validate TMDB ID
    // -----------------------------
    if (!tmdb_id) {
      return res.status(400).json({
        success: false,
        error: "tmdb_id is required",
        example: "/api?tmdb_id=46260"
      });
    }

    if (!/^\d+$/.test(String(tmdb_id))) {
      return res.status(400).json({
        success: false,
        error: "tmdb_id must be a number"
      });
    }

    // -----------------------------
    // Detect Movie / TV
    // -----------------------------
    const isTV =
      season !== undefined ||
      episode !== undefined;

    // -----------------------------
    // Validate TV parameters
    // -----------------------------
    if (isTV) {
      if (
        season === undefined ||
        episode === undefined
      ) {
        return res.status(400).json({
          success: false,
          error: "Both season and episode are required"
        });
      }

      if (
        !/^\d+$/.test(String(season)) ||
        !/^\d+$/.test(String(episode))
      ) {
        return res.status(400).json({
          success: false,
          error: "season and episode must be numbers"
        });
      }
    }

    // -----------------------------
    // Build upstream URL
    // -----------------------------
    const params = new URLSearchParams();

    params.set("tmdb_id", String(tmdb_id));

    if (isTV) {
      params.set("season", String(season));
      params.set("episode", String(episode));
    }

    const upstreamUrl =
      `${UPSTREAM}?${params.toString()}`;

    // -----------------------------
    // Timeout
    // -----------------------------
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    let upstreamResponse;

    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    // -----------------------------
    // Read response
    // -----------------------------
    const contentType =
      upstreamResponse.headers.get(
        "content-type"
      ) || "";

    const text =
      await upstreamResponse.text();

    // -----------------------------
    // Upstream error
    // -----------------------------
    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        success: false,
        error: "Upstream request failed",
        status: upstreamResponse.status,
        type: isTV ? "tv" : "movie",
        tmdb_id: Number(tmdb_id),
        ...(isTV
          ? {
              season: Number(season),
              episode: Number(episode)
            }
          : {}),
        upstream: upstreamUrl,
        content_type: contentType,
        response: text.slice(0, 1000)
      });
    }

    // -----------------------------
    // Parse JSON
    // -----------------------------
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Upstream returned invalid JSON",
        content_type: contentType,
        response: text.slice(0, 1000)
      });
    }

    // -----------------------------
    // Cache
    // -----------------------------
    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    // -----------------------------
    // Final response
    // -----------------------------
    return res.status(200).json({
      success: true,
      type: isTV ? "tv" : "movie",
      tmdb_id: Number(tmdb_id),

      ...(isTV
        ? {
            season: Number(season),
            episode: Number(episode)
          }
        : {}),

      data
    });

  } catch (error) {
    console.error(error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "Upstream request timed out"
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
}
