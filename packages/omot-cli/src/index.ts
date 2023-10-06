import { Post, getCdxItemUrl, getCdxItemId, parsePost, User, parseCdxItem, getArchiveUrl } from "twitter-data-parser";

import { setGlobalDispatcher, Agent, Pool } from "undici";

setGlobalDispatcher(
  new Agent({ factory: (origin) => new Pool(origin, { connections: 32 }) })
);

import fetchBuilder from "fetch-retry";
import { exit } from "process";

const fetch = fetchBuilder(global.fetch);

function getCdxList(user: string) {
  const req = `twitter.com/${user}/`
  const url = `http://web.archive.org/cdx/search/cdx?url=${req}&matchType=prefix&output=json`;
  console.log(`Fetching cdx: ${url}`)
  return fetch(url)
    .then(res => res.json())
    .then(j => j as string[][]);
}

function getOnePage(cdxItem: string[]): Promise<Post | undefined> {
  const timeStamp = cdxItem[1];
  const origUrl = getCdxItemUrl(cdxItem);
  const urlSplit = origUrl.split('/');
  const statusIdx = urlSplit.indexOf("status");
  if (statusIdx !== -1) {
    const user = urlSplit[statusIdx - 1];
    const id = getCdxItemId(cdxItem);
    const pageUrl = `http://web.archive.org/web/${timeStamp}/${origUrl}`;
    return fetch(pageUrl,)
      .then((res => res.text()))
      .then((res) => {
        const r = parsePost(res, {
          id: id,
          timestamp: timeStamp,
          userName: user
        });
        return r;
      })
      .catch(err => {
        console.log(`url failed: ${pageUrl}, err: ${err}`)
        return undefined;
      })
  } else {
    return Promise.resolve(undefined);
  }
}

type PostVisitor = (p: Post) => void;

function visitPost(user: string, v: string[], f: PostVisitor) {
  const info = parseCdxItem(v);
  if (info.mimetype !== 'text/html') {
    return;
  }
  return getOnePage(v)
    .then((post) => {
      if (post != null) {
        f(post);
      }
    })
    .catch((err) => {
      const url = getArchiveUrl({ ...info, userName: user });
      console.log(`url failed: ${url}, err: ${err}`)
    })
}

const userNames = new Set<string>();

function logResult() {
  process.stdout.write(`\nAll founded user names:\n`);
  process.stdout.write(`[${Array.from(userNames).join(', ')}]`);
}

async function solve(user: string) {
  const userSet = new Set<string>();
  const users: User[] = [];
  const items = await getCdxList(user);
  console.log(`Fetch ${items.length} tweets belong to ${user}`);
  const cdxInfos = items.map(parseCdxItem)
    .filter(i => !isNaN(i.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (cdxInfos.length === 0) {
    return;
  }
  const earliest = cdxInfos[0].date;
  console.log(`Earliest archive time: ${earliest}`)
  const idRef: {
    id?: string
  } = {
    id: undefined
  };

  await Promise.all(items.map((v) => {
    return visitPost(user, v, (post) => {
      if (post.user.id != null) {
        idRef.id = post.user.id;
      }
      if (post.replyInfo != null) {
        const u1 = post.replyInfo.targetUser;
        if (u1.id != null && !userSet.has(u1.id)) {
          userSet.add(u1.id);
          users.push(u1);
        }
        console.log(`REPLY ${user} => ${u1.userName}`);
      }
    })
  }));

  if (idRef.id == null) {
    return;
  }

  const id = idRef.id;

  console.log(`Find ${users.length} relative users`);
  console.log(`User id for ${user}: ${id}`);
  console.log(`Perform computing ...`);

  userNames.add(user);
  const targets = users.filter(u => u.userName !== user);
  let searchMap = new Map<User, string[][]>();
  for (const u of targets) {
    if (u.userName != null) {
      const userName = u.userName;
      const cdx = await getCdxList(userName);
      const toSearch = cdx.filter(v => {
        const dt = parseCdxItem(v).date.getTime();
        return !isNaN(dt) && dt - earliest.getTime() < 0;
      });
      searchMap.set(u, toSearch);
    }
  }

  const searchIter = [...searchMap.entries()]
    .sort((a, b) => a[1].length - b[1].length);

  for (const [u, toSearch] of searchIter) {
    if (toSearch.length == 0) {
      continue;
    }
    const userName = u.userName as string;
    console.log(`Searching ${toSearch.length} tweets of ${userName}`)
    await Promise.all(toSearch.map((v, i) => {
      return visitPost(userName, v, (p) => {
        if ((i + 1) % 100 === 0 || i + 1 === toSearch.length) {
          console.log(`Processing ${i + 1}/${toSearch.length} of ${userName}`);
        }
        if (p.replyInfo != null) {
          const thisId = p.replyInfo.targetUser.id;
          const thisUserName = p.replyInfo.targetUser.userName;
          if (thisId === id && thisUserName != null) {
            if (!userNames.has(thisUserName)) {
              console.log(`FOUND ${thisUserName}, url: ${p.archiveUrl}`);
              userNames.add(thisUserName);
            }
          }
        }
      });
    }));
  }
  console.log(`all founded userNames for ${id}:`);
  console.log(userNames);
}

process.on('SIGINT', () => {
  logResult();
  exit(-1);
});

const { Command } = require('commander');
const program = new Command();
program
  .description('cli from omot, developing')
  .argument('user', 'username to process')
  .option('-s, --solve', 'find all possible usernames belonging to the user')
  .action((user:string, options: any) => {
    const s = options.solve;
    if (s) {
      solve(user);
    }
  });

program.parse();