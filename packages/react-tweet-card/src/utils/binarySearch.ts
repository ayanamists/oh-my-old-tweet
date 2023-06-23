/* eslint-disable no-unused-vars */

function binarySearch(initial: number, check: (arg: number) => boolean) {
  const initialCheck = check(initial);
  let delta = initialCheck ? -1 : 1;
  let value = initial;
  let previousValue = initial;
  while (initialCheck === check(value)) {
    previousValue = value;
    value += delta;
    delta *= 2;
  }
  let [low, high] = [previousValue, value].sort((a, b) => a - b);
  let mid = low;
  while (low + 1 < high) {
    mid = Math.floor((low + high) / 2);
    if (check(mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return low;
}

export default binarySearch;
