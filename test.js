const getPodcastFeed = require(".");

getPodcastFeed("https://feed.plaguetownpod.com/rss")
  .then(JSON.stringify)
  .then(console.log);
