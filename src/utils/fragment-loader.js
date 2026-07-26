const fragmentCache = new Map();

export async function loadFragment(fragmentUrl) {
  const url = fragmentUrl instanceof URL ? fragmentUrl.href : fragmentUrl;

  if (!fragmentCache.has(url)) {
    const fragmentPromise = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load fragment: ${url}`);
      }

      return response.text();
    });

    fragmentCache.set(url, fragmentPromise);
  }

  return fragmentCache.get(url);
}