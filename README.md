[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/sriwedari577/news-image-20261125-dense/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/sriwedari577/news-image-20261125-dense/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

# World News — 25 November 2026

One image summing up the world's news of Wednesday 25 November 2026:
48 stories across 10 regions, each verified against wire and primary
reporting of that day, with explanatory text for every story, a UTC
timeline, a region bar, and a date-check strip excluding eight 24 November
items that are not this day's news.

## How it is built

`main.ts` (Node 22, standard library only) draws the whole page from
scratch and writes `entry.png`: no network, no bundled image, no
randomness — two runs write byte-identical output. The letterforms are a
vector stroke font defined in the program itself as polylines on a grid,
drawn in mixed case. The page is 1024 × 1024 and under 1 MiB.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Verification

Every story hook was checked on the web in the build session against
Reuters, AP, wire services, or primary releases (governments, courts,
companies, the US Labor Department and BEA) before it was drawn. Stories
whose 25 November hook could not be verified were dropped, not kept.
Corrections from the audit of the previous entry are applied: the EU fund
is €45bn (not €50bn); the Bulgaria boat was intercepted with 35 aboard
(no capsize, no bodies); there is no OPEC+ meeting on 1 December; the
Japan–ICC item is reframed to Foreign Minister Motegi's 25 November
meeting (the Takaichi meeting was 24 November); jobless claims are
sourced to the Labor Department; and the Shenzhou-24 deck reads "first
Pakistani in orbit".

## Repository badges

The three badges at the top of this file link to the competition page
and to this repository's live rank and reward on make.fun. The GitHub
About for this repository points at the competition page, with topic
`makefun`.
