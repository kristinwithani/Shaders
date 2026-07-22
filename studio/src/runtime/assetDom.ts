import pixelbgDefault from '../assets/pixelbg.txt?raw';
import { EFFECTS, SHADER_IDS } from '../shaders/registry';

/** The asset-DOM bridge.
 *
 *  Engines read their background media with
 *  `document.getElementById('asset-<x>bg').textContent` — assets do NOT flow
 *  through the config object. That contract is preserved (refactoring it away
 *  would break standalone export and "edit the real source"), so the React app
 *  mirrors asset data-URLs into real hidden <script type="text/plain"> nodes
 *  before any engine instantiates. */

const DEFAULTS: Record<string, string> = {
  'asset-pixelbg': pixelbgDefault,
};

let registry: HTMLElement | null = null;

export function ensureAssetNodes(): void {
  if (registry) return;
  registry = document.createElement('div');
  registry.id = 'asset-registry';
  registry.hidden = true;
  document.body.appendChild(registry);
  for (const id of SHADER_IDS) {
    for (const aid of EFFECTS[id].assets || []) {
      if (document.getElementById(aid)) continue;
      const node = document.createElement('script');
      node.id = aid;
      node.setAttribute('type', 'text/plain');
      node.textContent = DEFAULTS[aid] || '';
      registry.appendChild(node);
    }
  }
}

export function setAsset(aid: string, dataUrl: string): void {
  ensureAssetNodes();
  const node = document.getElementById(aid);
  if (node) node.textContent = dataUrl;
}

export function getAsset(aid: string): string {
  const node = document.getElementById(aid);
  return node ? (node.textContent || '').trim() : '';
}
