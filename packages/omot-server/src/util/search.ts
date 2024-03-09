/* eslint-disable no-undef */
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';

declare global {
  // eslint-disable-next-line no-unused-vars
  var searchClient: undefined | ReturnType<typeof instantMeiliSearch>
}

const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
const searchClient = globalThis.searchClient ?? 
  instantMeiliSearch(`${protocol}//${host}/api/meilisearch/`, "MASTER_KEY").searchClient;

export default searchClient

// @ts-ignore
if (process.env.NODE_ENV !== 'production') globalThis.searchClient = searchClient
