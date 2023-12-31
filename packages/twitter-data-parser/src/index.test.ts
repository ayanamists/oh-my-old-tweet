import { parsePost } from "./ArchiveParser";

test("2021-02-18-junjunzisama", async () => {
  const text = await fetch('https://web.archive.org/web/20210218015952/https://twitter.com/junjunzisama/status/1362220205884268553')
    .then((res) => res.text());
  const post = parsePost(text, {
    id: "1362220205884268553",
    timestamp: "20210218015952",
    userName: "junjunzisama"
  });
  expect(post?.user.userName).toBe("junjunzisama");
  expect(post?.user.id).toBe("1362217773762555911");
  expect(post?.images.length).toBe(2);
  expect(post?.replyInfo).toBeUndefined();
});

test("2021-02-26-junjunzisama-reply",async () => {
  const text  = await fetch('https://web.archive.org/web/20210226004628/https://twitter.com/junjunzisama/status/1365100820811890688')
    .then((res) => res.text());
  const post = parsePost(text, {
    id: "1365100820811890688",
    timestamp: "20210226004628",
    userName: "junjunzisama"
  });
  expect(post?.user.userName).toBe("junjunzisama");
  expect(post?.replyInfo?.targetPostId).toBe("1364386132889202689");
  expect(post?.replyInfo?.targetUser.userName).toBe("renalxu");
  expect(post?.replyInfo?.targetUser.id).toBe("1070522624545976321");
  expect(post?.images.length).toBe(0);
});
