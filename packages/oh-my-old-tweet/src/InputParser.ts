import { mayRemoveAtSym } from "./Utils";

export function parseUserName(input: string) {
  const trimInput = input.trim();
  if (trimInput.startsWith("https")) {
    const url = new URL(trimInput);
    const path = url.pathname;
    const first = path.split('/')[1];
    return first;
  } else {
    const userName = mayRemoveAtSym(trimInput);
    return userName;
  }
}