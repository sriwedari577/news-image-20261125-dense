[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/sriwedari577/news-image-20261125-dense/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/sriwedari577/news-image-20261125-dense/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

# One day in the news — Wednesday 25 November 2026

A single 1024×1024 broadsheet image of the day's news: 38 stories, every one of
which happened or was first reported on 25 November 2026, drawn entirely in
code. Three lead stories, twelve illustrated cards, and an "Also on" list carry
the day, with a numbers strip, a UTC timeline, a schematic dot-grid world map,
and a DATE CHECK box listing the big 24 November stories that were deliberately
left out.

## How it is made

`main.ts` is the whole program — Node.js standard library only, no network, no
dependencies. It contains:

- a hand-rolled PNG encoder (filter 0, zlib deflate),
- a vector stroke font designed for this page: every glyph is a polyline,
  mixed case with proportional widths and a heavy display weight, so headlines
  stay readable when the image is shrunk to 300px,
- fifteen layered scenes drawn from primitives (gradient skies, ground bands,
  and three to five identifiable objects each),
- a schematic dot-grid map with fifteen numbered pins, one per lead story.

The output is deterministic: repeated runs produce a byte-identical PNG.

## Run it

```sh
node main.ts
```

Requires a Node.js version with type stripping (Node 22.6+; built with Node 24).
The PNG is written to `$MAKEFUN_OUTPUT_DIR`, or to `./out/entry.png` when that
variable is unset.

## Reading the page

Every story carries a status — Confirmed, Reported, Claim, or Official — and a
named source, with the legend beside the map. Hook badges on the lead and
illustrated cards carry the day's sharpest verified figure for that story.
Times in the timeline are UTC and come from primary reporting only.

## License

MIT — see `LICENSE`.
