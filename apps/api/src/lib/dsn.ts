/** Build a project DSN: https://<publicKey>@<api-host>[/base]/project/<projectId> (ADR 11). */
export function buildDsn(publicApiUrl: string, publicKey: string, projectId: string): string {
  const url = new URL(publicApiUrl)
  url.username = publicKey
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/project/${projectId}`
  url.search = ""
  url.hash = ""
  return url.toString()
}
