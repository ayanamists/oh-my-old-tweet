function isValid(windowWidth: number, windowHeight: number, width: number, height: number) {
  return (windowWidth >= width) && windowHeight >= height;
}

export default function fullFillImage(width: number, height:number) {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const ratio = width / height;

  const height1 = windowHeight;
  const width1 = Math.floor(height1 * ratio);

  const width2 = windowWidth;
  const height2 = Math.floor(width2 / ratio);

  if (isValid(windowWidth, windowHeight, width1, height1)) {
    return [width1, height1];
  }
  return [width2, height2];
}
