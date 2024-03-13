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

### Use cli to find old usernames

For a given username, we try to find all old usernames of this user. This is useful when a user has changed his/her username. 

1. `cd omot-cli`
2. `yarn build`
3. `yarn start -s <username>`, e.g.
   ```
   yarn start -s _iori_n
   ```
4. When program exits, the result will be printed to the console  


**NOTE**: This is an experimental feature and may not work properly. This calculation may takes non-trivial time. You can run `<ctrl>+c` to stop the process, and the result will be printed to the console.

## How it works

[Internet Archive](https://archive.org/) has crawled tons of twitter status (tweets) since 2006. We'll find all tweets belonging to your target user in the Internet Archive.

## Notices

- Internet Archive may not have crawled all tweets. Especially, from 2023.06, Twitter has changed its policy and Internet Archive may not be able to actively crawl tweets.
- For most cases, Internet Archive cannot crawl video in tweets. We don't implement video feature for now. However, in some cases, Internet Archive may have crawled video in tweets. We plan to implement this feature in the future.
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
