type DeletePreparedPortalAssetOptions = {
  finalize: () => Promise<unknown>;
  prepare: () => Promise<string>;
  removeStorage: (path: string) => Promise<unknown>;
};

/**
 * Keeps the database tombstone when object deletion fails so a later request
 * can retry the same path without reopening the document-reference race.
 */
export async function deletePreparedPortalAsset({
  finalize,
  prepare,
  removeStorage,
}: DeletePreparedPortalAssetOptions) {
  const path = await prepare();
  await removeStorage(path);
  await finalize();
}
