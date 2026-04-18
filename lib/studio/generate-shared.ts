export const MAX_VARIATIONS = 3;

export type QdrantSource = {
  id?: string;
  score?: number | null;
  snippet?: string;
  storagePath?: string;
  sectionKind?: string;
  kbDomain?: string;
  documentType?: string;
};

export type TavilySource = {
  title?: string;
  url?: string;
  snippet?: string;
};
