function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(([a-f\d]{2})*)$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function isRGB(color: string) {
  return !!(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/.exec(color));
}

const rgba2hex = (rgba: string) => `#${rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)?.slice(1).map((n, i) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n)).toString(16).padStart(2, '0').replace('NaN', '')).join('')}`;

export const getRGB = (color: string) => hexToRgb(isRGB(color) ? rgba2hex(color) : color);

export const rgba = (rgb: { r: number, g: number, b: number}, a: number) => {
  const { r, g, b } = rgb;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
