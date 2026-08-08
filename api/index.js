export default async function handler(req, res) {
  try {
    const { tmdb_id, season, episode } = req.query;

    if (!tmdb_id) {
      return res.status(400).json({
        success: false,
        error: "tmdb_id is required"
      });
    }

    // TV request: season + episode
    const isTV = season !== undefined || episode !== undefined;

    if (isTV && (season === undefined || episode === undefined)) {
      return res.status(400).json({
        success: false,
        error: "Both season and episode are required for TV"
      });
    }

    const params = new URLSearchParams();
    params.set("tmdb_id", tmdb_id);

    if (isTV) {
      params.set("season", season);
      params.set("episode", episode);
    }

    const targetUrl =
      `https://freakyniki.elaxo.lol/?${params.toString()}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    const contentType =
      response.headers.get("content-type") || "";

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Upstream request failed",
        status: response.status
      });
    }

    let data;

    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    } else {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Small cache for API responses
    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json({
      success: true,
      type: isTV ? "tv" : "movie",
      tmdb_id,
      ...(isTV && {
        season: Number(season),
        episode: Number(episode)
      }),
      data
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}
