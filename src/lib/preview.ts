/** True on Netlify deploy previews / branch deploys (e.g. deploy-preview-3--ldstend.netlify.app). */
export function isPreviewHost(host: string): boolean {
  return host.includes('--') && host.endsWith('.netlify.app');
}
