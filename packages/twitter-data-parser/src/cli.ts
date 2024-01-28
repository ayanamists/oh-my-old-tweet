import { parsePost } from "./ArchiveParser";

export async function main() {
  // example: https://web.archive.org/web/20210218015952/https://twitter.com/junjunzisama/status/1362220205884268553
  const argUrl = process.argv[2];
  const splitted = new URL(argUrl).pathname.split("/");
  const userName = splitted[6];
  const timestamp = splitted[2];
  const id = splitted[8];
  const r = await fetch(argUrl).then((res) => res.text()).then((text) => {
    console.log(parsePost(text, {
      id,
      timestamp,
      userName,
    }))
  })
  console.log(r);
}

main()