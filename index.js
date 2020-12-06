const R = require("ramda");
const fetch = require("node-fetch");
const urlLib = require("url");
const { formatISO } = require("date-fns/fp");
const { parseString } = require("xml2js");
const { promisify } = require("util");

const keb = (x) =>
  x
    .trim()
    .replace(/[^ \-a-zA-Z0-9]/g, "")
    .replace(/([a-z])([A-Z])/g, (_, x, y) => x + "-" + y)
    .toLowerCase()
    .replace(/[\-\s]+/g, "-");

const rename = (from, to) =>
  R.pipe(
    R.over(R.lens(R.path(from), R.assocPath(to)), R.identity),
    R.dissocPath(from)
  );

const getFirstFromArray = R.nth(0);

const isoifyPubDate = R.over(
  R.lensProp("pubDate"),
  R.pipe((x) => new Date(x), formatISO)
);

const shapeEpisode = R.pipe(
  rename(["itunes:duration"], ["duration"]),
  rename(["itunes:image"], ["image"]),
  R.pick([
    "itunes:summary",
    "enclosure",
    "description",
    "duration",
    "image",
    "link",
    "pubDate",
    "title",
  ]),
  R.filter(Boolean),
  R.map(getFirstFromArray),
  R.when(R.prop("enclosure"), rename(["enclosure", "$"], ["media"])),
  rename(["image", "$", "href"], ["artwork"]),
  rename(["itunes:summary"], ["summary"]),
  R.over(R.lensProp("summary"), R.defaultTo("")),
  R.dissoc("image"),
  R.dissoc("enclosure"),
  isoifyPubDate,
  R.over(R.lens(R.prop("title"), R.assoc("slug")), keb)
);

const shapeFeed = R.pipe(
  R.path(["rss", "channel", 0]),
  R.pick([
    "description",
    "docs",
    "image",
    "item",
    "link",
    "pubDate",
    "title",
    "itunes:subtitle",
  ]),
  rename(["item"], ["episodes"]),
  rename(["itunes:subtitle"], ["subtitle"]),
  R.filter(Boolean),
  R.over(R.lensProp("episodes"), R.defaultTo([])),
  R.evolve({
    description: getFirstFromArray,
    docs: getFirstFromArray,
    image: getFirstFromArray,
    link: getFirstFromArray,
    pubDate: getFirstFromArray,
    subtitle: getFirstFromArray,
    title: getFirstFromArray,
    episodes: R.pipe(R.map(shapeEpisode), R.sortBy(R.prop("pubDate")), (x) =>
      x.map((y, i) => ({ ...y, i }))
    ),
  }),
  R.over(R.lensProp("image"), R.map(getFirstFromArray)),
  isoifyPubDate,
  rename(["link"], ["homepage"])
);

module.exports = async function getFeed(url) {
  const feed = await fetch(url)
    .then((x) => x.text())
    .then(promisify(parseString))
    .then(shapeFeed)
    .then(R.assoc("rssFeed", url));

  return feed;
};
