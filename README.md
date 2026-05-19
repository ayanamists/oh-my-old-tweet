# Oh My Old Tweet

A graceful, powerful and easy-to-use tool to see old (including **deleted**) tweets. 

![Github Pages](https://github.com/ayanamists/oh-my-old-tweet/actions/workflows/pages.yaml/badge.svg?event=push)
![Github Pages](https://github.com/ayanamists/oh-my-old-tweet/actions/workflows/docker.yaml/badge.svg?event=push)

## Use it in browser

1. Visit our [site](https://omot.ayayaya.org)
2. Fill the input box with username you want to query
3. Click `Start`
4. Enjoy

## Deploy on your own server

## Prerequisites:

- Docker and docker-compose

## Steps:

1. Download the [deploy.zip](https://github.com/ayanamists/oh-my-old-tweet/releases/download/v0.1.0/deploy.zip) and unzip it
2. `cd deploy && docker compose up -d`
3. Visit `http://your-server-ip:3142`

### Notice

**DO NOT** expose the port 3142 to the public network. Currently we don't have any security mechanism.

## Use cli

We provide a `cli` for experimental use. 

### Prerequisites:

1. Clone this repo
2. Run `yarn` to install dependencies
3. Run `yarn build` to build the project

### Use cli from `twitter-data-parser`

1. `cd twitter-data-parser`
2. `yarn cli <archived-url>`, e.g.
   ```
   yarn cli https://web.archive.org/web/20220306095655/https://twitter.com/_iori_n/status/523389174242488320
   ```
3. Extracted data will be printed to the console

### Use the `omot-cli` binary

Build once, then invoke `omot-cli` (or `node dist/index.js`) with one of the
subcommands.

1. `cd packages/omot-cli`
2. `yarn build` — emits `dist/index.js` with a shebang and exec bit.

#### `solve <user>` — find old usernames

For a given username, we try to find all old usernames of this user. Useful
when a user has changed their username.

```
./dist/index.js solve _iori_n
```

When the program exits, the result is printed to the console.

#### `match <regex> <seeds...>` — find posts by keyword

Recursively search for posts whose text matches a regex or any listed literal
keyword. The walk starts from the listed seed users and expands via every reply
target it sees up to `--max-depth` (default `1`, use `0` to disable expansion).
By default it inspects at most 1000 snapshot/CDX items across all users; adjust
with `--max-items`, or use `--max-items 0` for unlimited search.

```
./dist/index.js match 'launch|beta' jack ev biz --max-depth 2 --flags gi
./dist/index.js match 'launch|beta' jack --keyword 小楚 --keyword 小秦
./dist/index.js match 'launch|beta' jack --max-items 5000
```


**NOTE**: This is an experimental feature and may not work properly. This calculation may takes non-trivial time. You can run `<ctrl>+c` to stop the process, and the result will be printed to the console.

#### `graph <user>` — export a weighted reply graph

Walks the reply graph rooted at `<user>` and emits it as JSON (default) or
GraphML for Gephi / NetworkX / D3. Edges carry every interaction's date and
archive URL, so the graph can be sliced by time downstream.

```
./dist/index.js graph jack > jack.json
./dist/index.js graph jack --format graphml -o jack.graphml
./dist/index.js graph jack --max-depth 2 --max-items 5000
```

Progress is written to stderr so `> file.json` works.

#### `circle <user> [--year YYYY]` — rank the user's reply circle

Computes in/out degree (weighted by interaction count) and PageRank over the
reply graph, optionally restricted to a calendar year or arbitrary date range.
The "social drift" use case — *who was X's closest reply partner in 2010 vs.
2015* — is exactly what this is built for.

```
./dist/index.js circle jack --year 2010 --top 20
./dist/index.js circle jack --from 2010-01-01 --to 2012-12-31
./dist/index.js circle --from-file jack.json --year 2008 --json
```

Pair with `graph` to avoid recrawling: dump once, slice cheaply.

## How it works

[Internet Archive](https://archive.org/) has crawled tons of twitter status (tweets) since 2006. We'll find all tweets belonging to your target user in the Internet Archive.

## Notices

- Internet Archive may not have crawled all tweets. Especially, from 2023.06, Twitter has changed its policy and Internet Archive may not be able to actively crawl tweets.
- For most cases, Internet Archive cannot crawl video in tweets. We don't implement video feature for now. However, in some cases, Internet Archive may have crawled video in tweets. See [Twitter video recovery from Wayback](docs/twitter-video-wayback-recovery.md) for the current research notes.
- Internet Archive may not be able to save NSFW tweets.
- Currently, we don't properly handle retweets and replies (**You can contribute!**).

## To-do List

- [x] Date
- [x] Engagement info
- [ ] Profile image and content
- [x] User avatar
- [ ] Retweets
- [x] Replies
- [ ] Paging (Test with Donald Trump's data)
- [x] Self-hosing backend
- [ ] Video support
- [ ] Crawling directly from Twitter
- [ ] Load tweets from [gallery-dl](https://github.com/mikf/gallery-dl)'s output
