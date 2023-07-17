export function mayRemoveAtSym(str: string | undefined) {
  if (str?.charAt(0) === '@') {
    return str.substring(1, str.length);
  } else {
    return str;
  }
}