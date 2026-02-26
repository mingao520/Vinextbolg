export interface SearchDocument {
  id: string;
  title: string;
  url: string;
  cover?: string;
  excerpt: string;
  content: string;
  categories: string[];
  dateTime: number;
  keyPoints?: string[];
}

export interface SearchIndexedDocument extends SearchDocument {
  searchText: string;
}

export interface SearchResult extends SearchIndexedDocument {
  score: number;
}

export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function createSearchIndex(
  documents: SearchDocument[],
): SearchIndexedDocument[] {
  return documents.map((doc) => {
    const searchText = normalizeText(
      [doc.title, doc.excerpt, doc.content, ...doc.categories, ...(doc.keyPoints ?? [])].join(" "),
    );
    return {
      ...doc,
      searchText,
    };
  });
}

export function searchDocuments(
  documents: SearchIndexedDocument[],
  query: string,
  limit = 30,
): SearchResult[] {
  const normalized = normalizeText(query);
  if (!normalized) {
    return documents
      .slice()
      .sort((a, b) => b.dateTime - a.dateTime)
      .slice(0, limit)
      .map((doc) => ({
        ...doc,
        score: 0,
      }));
  }

  const terms = normalized.split(" ").filter(Boolean);

  const scored = documents
    .map((doc) => {
      let score = 0;
      if (normalizeText(doc.title).includes(normalized)) score += 6;
      if (normalizeText(doc.excerpt).includes(normalized)) score += 4;
      if (doc.searchText.includes(normalized)) score += 2;

      // keyPoints 匹配加分：离散语义块精确匹配价值高
      const keyPointsText = (doc.keyPoints ?? []).map(normalizeText);
      for (const kp of keyPointsText) {
        if (kp.includes(normalized)) score += 3;
      }

      for (const term of terms) {
        if (normalizeText(doc.title).includes(term)) score += 2;
        if (doc.searchText.includes(term)) score += 1;
        // keyPoints 单词级匹配
        for (const kp of keyPointsText) {
          if (kp.includes(term)) score += 1.5;
        }
      }

      return { ...doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.dateTime - a.dateTime)
    .slice(0, limit);

  return scored;
}
