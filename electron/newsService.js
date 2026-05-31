const fetchNews = async (db) => {
  try {
    const res = await fetch('https://www.reddit.com/r/CrackWatch/new.json?limit=25');
    const data = await res.json();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO news 
      (reddit_id, title, url, upvotes, comments, posted_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    if (data && data.data && data.data.children) {
      data.data.children.forEach(({ data: post }) => {
        stmt.run(
          post.id,
          post.title ? post.title.slice(0, 200) : '',   // cap title length
          post.url ? post.url.slice(0, 500) : '',     // cap url length
          post.ups || 0,
          post.num_comments || 0,
          new Date(post.created_utc * 1000).toISOString(),
          new Date().toISOString()
        );
      });
    }

    // Keep only last 100 news items — delete old ones
    db.prepare(`
      DELETE FROM news 
      WHERE id NOT IN (
        SELECT id FROM news 
        ORDER BY posted_at DESC 
        LIMIT 100
      )
    `).run();
    console.log("[STRAFE] News fetched and trimmed to last 100 items.");
  } catch (error) {
    console.error("[STRAFE] Failed to fetch news:", error);
  }
};

module.exports = { fetchNews };
