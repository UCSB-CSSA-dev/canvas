/** `/files/` with a space, folder, open file, or the trash. */
export function filesHref(params: { s?: string; f?: string | null; trash?: boolean; file?: string }) {
  const search = new URLSearchParams();
  if (params.s) search.set("s", params.s);
  if (params.f) search.set("f", params.f);
  if (params.trash) search.set("trash", "1");
  if (params.file) search.set("file", params.file);
  const query = search.toString();
  return query ? `/files/?${query}` : "/files/";
}

export function docHref(documentId: string) {
  return `/docs/?d=${documentId}`;
}
