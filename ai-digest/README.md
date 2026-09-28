# ai-digest

A daily digest of RSS articles. Each person's unread articles are pulled from
FreshRSS, digested by `codex`, committed to a private data repository, and
published as a static website with a one-screen dashboard (news, weather,
clocks, calendar, markets) and a timeline of earlier days.

The image holds the tool and the website only. Configuration, prompts,
secrets and data are all mounted at run time. The design, data formats and
reasons are in [DESIGN.md](DESIGN.md).

```
d0u9/ai-digest:<version>              linux/amd64, linux/arm64, on Docker Hub
ghcr.io/d0u9/ai-digest:<version>      the same, from GitHub Actions
```

## Commands

```
ai-digest pull --user U       fetch U's articles from FreshRSS into the spool
ai-digest digest --user U     have codex digest U's articles; fetch the day's weather
ai-digest archive             commit the spool to the data repository and push
ai-digest index [--all]       generate the website's data from the data repository
ai-digest publish-web         copy the pages into the web root
ai-digest import --from DIR   convert the first version's digests
ai-digest --version
```

A daily run is `pull` and `digest` for each person, then `archive` and
`index` once. After installing or upgrading, run `publish-web` and
`index --all`.

## Mounts

| Path | Contents | Used by |
|---|---|---|
| `/config/config.json` | Configuration, below | all |
| `/config/prompts/shared.md` | Preferences shared by everyone; required | digest |
| `/config/prompts/<user>.md` | One person's preferences; optional | digest |
| `/spool` | Files between `pull`, `digest` and `archive`; writable | pull, digest, archive |
| `/data` | Clone of the data repository; writable | archive, index |
| `/web` | Web root served by any static server; writable | index, publish-web |
| `/codex` | codex login (`auth.json`); writable | digest |
| `/secrets/freshrss/<user>` | That person's FreshRSS API password | pull |
| `/secrets/deploy_key` | Deploy key with write access to the data repository, mode 0600 | archive |

Secrets are files, never arguments or environment variables. `auth.json` and
the deploy key never go into an image or a repository.

## Configuration

`/config/config.json`; every key except `users` is optional, and an unknown
key is an error:

```json
{
  "version": 1,
  "timezone": "Europe/Berlin",
  "freshrss": {"url": "https://rss.example.com/api/greader.php", "timeout": 30},
  "codex": {"model": null, "reasoning_effort": null, "timeout": 900},
  "pull": {"since": "24h", "max_window": "7d", "max_chars": 4000, "unread_only": true},
  "users": {
    "alice": {"sections": ["World", "Tech"], "skip_feeds": ["example.net"]},
    "bob": {"clocks": [{"name": "Here", "timezone": "Europe/Berlin"}]}
  },
  "weather": [{"name": "Springfield", "latitude": 48.1, "longitude": 11.6}],
  "links": [
    {"title": "Rates", "items": [{"name": "AAA/BBB", "url": "https://example.com/rates/aaa-bbb"}]}
  ],
  "clocks": [{"name": "Here", "timezone": "Europe/Berlin"}, {"name": "East", "timezone": "Asia/Tokyo"}],
  "holidays": [{"name": "Example", "country": "AU", "region": "AU-NSW"}],
  "markets": {
    "rates": [{"base": "EUR", "quote": "USD"}],
    "quotes": [{"name": "Example Index", "symbol": "^XYZ"}]
  },
  "data": {"branch": "main"}
}
```

- `weather`: the first place is "here", shown in detail on the dashboard.
- `links`: groups of `http`/`https` links shown on the dashboard.
- `clocks`: clocks, one IANA time zone each, shown with hands or digits.
- `holidays`: ISO 3166 country codes, optionally with a subdivision.
- `markets`: exchange rates by ISO 4217 code, quotes by Yahoo Finance
  symbol. `digest` saves them each day with a month's history.
- A person may have their own `weather`, `links`, `clocks`, `holidays` or
  `markets` under their name in `users`, in the same form: their dashboard
  shows those, and the shared ones for the rest. `digest` fetches the
  weather and markets once for everyone's places, rates and quotes, again on
  the same day when one is added.

Environment variables override single settings: `AI_DIGEST_SINCE`,
`AI_DIGEST_MODEL`, `AI_DIGEST_REASONING_EFFORT`, `AI_DIGEST_TIMEOUT`. The
mount paths can be moved with `AI_DIGEST_CONFIG`, `AI_DIGEST_SPOOL`,
`AI_DIGEST_DATA`, `AI_DIGEST_WEB` and `AI_DIGEST_SECRETS`.

The website's browser fetches the live weather and air quality from
Open-Meteo, current exchange rates from Frankfurter, public holidays from
Nager.Date, and China's holidays with its make-up working days from
holiday-cn. Quotes are shown as `digest` saved them: Yahoo Finance does not
let a browser on another site read them.

## Example

```sh
docker run --rm \
  -v "$PWD/config:/config:ro" \
  -v "$PWD/spool:/spool" -v "$PWD/data:/data" -v "$PWD/web:/web" \
  -v "$PWD/codex:/codex" -v "$PWD/secrets:/secrets:ro" \
  d0u9/ai-digest:0.1.1 pull --user alice
```

## Development

Node 24. From this directory:

```sh
npm ci
npm test                 # the tool's tests
npm run check            # type checks
npm run build            # dist/ai-digest.mjs and web/dist
npm run fixtures -w web  # made-up data for the website
npm run dev -w web       # the website against that data
```

## Building

```sh
./buildx.sh 0.1.1
```

builds both architectures and pushes them to Docker Hub as
`d0u9/ai-digest:0.1.1` and `:latest`, after `docker login`. On an amd64 host
the arm64 half runs under QEMU. Pushing a tag `ai-digest/v0.1.1` builds the
same image in GitHub Actions and pushes it to ghcr.io.
