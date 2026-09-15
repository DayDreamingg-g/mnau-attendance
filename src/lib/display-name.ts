/** Human-facing labels only; never use the result as an identity or source key. */
export function displayName(name:string){
  return name.trim().replace(/(^|[\s·(])(?:demo|демо|beta|бета)(?=$|[\s·)])/giu,'$1TEST');
}
