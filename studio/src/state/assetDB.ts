/** Uploaded media (photos/videos as data URLs) routinely exceeds the ~5MB
 *  localStorage quota. Assets therefore live in IndexedDB (same db/store names
 *  as the original studio, so existing saves carry over); the small snapshot
 *  stays in localStorage. */

function assetDB(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('shader-studio-assets', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('assets');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('assets', mode);
      fn(tx.objectStore('assets'));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

export function saveAssetsDB(customAssets: Record<string, string>): Promise<void> {
  return assetDB('readwrite', (st) => {
    st.clear();
    for (const [k, v] of Object.entries(customAssets)) st.put(v, k);
  }).catch(() => {});
}

export function loadAssetsDB(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  return assetDB('readonly', (st) => {
    const cur = st.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        out[String(c.key)] = c.value as string;
        c.continue();
      }
    };
  }).then(
    () => out,
    () => out,
  );
}

export function clearAssetsDB(): Promise<void> {
  return assetDB('readwrite', (st) => st.clear()).catch(() => {});
}
