export type RevisionedPortalSaveResult =
  | { kind: "conflict" }
  | { kind: "saved"; revision: number };

export class PortalDocumentConflictError extends Error {
  constructor() {
    super("portal_document_conflict");
    this.name = "PortalDocumentConflictError";
  }
}

export async function persistPortalDocumentAtLatestRevision<T>({
  acknowledge,
  document,
  getExpectedRevision,
  persist,
  reconcileConflict,
}: {
  acknowledge: (revision: number) => void;
  document: T;
  getExpectedRevision: () => number | null;
  persist: (
    document: T,
    expectedRevision: number | null,
  ) => Promise<RevisionedPortalSaveResult>;
  reconcileConflict: () => void;
}) {
  const result = await persist(document, getExpectedRevision());
  if (result.kind === "conflict") {
    reconcileConflict();
    throw new PortalDocumentConflictError();
  }
  acknowledge(result.revision);
  return result;
}
