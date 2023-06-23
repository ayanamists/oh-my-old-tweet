import useMedia from './useMedia';

function usePrefersDarkMode() {
  return useMedia<boolean>(['(prefers-color-scheme: dark)'], [true], false);
}

export default usePrefersDarkMode;
