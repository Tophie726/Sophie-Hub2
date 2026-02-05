import { useMemo } from 'react'
import MiniSearch from 'minisearch'

// Base fields required for search indexing
interface SearchablePartner {
  id: string
  brand_name: string
  partner_code?: string | null
  client_name?: string | null
  client_email?: string | null
  pod_leader_name?: string | null
  brand_manager_name?: string | null
}

interface UsePartnerSearchOptions<T extends SearchablePartner> {
  partners: T[]
  searchQuery: string
  /** Minimum characters before search activates (default: 1) */
  minChars?: number
  /** Fuzzy matching threshold 0-1 (default: 0.2) */
  fuzzy?: number
}

interface SearchResult<T> {
  /** Filtered partners matching the search */
  results: T[]
  /** Whether search is active (query meets minChars) */
  isSearching: boolean
  /** Search suggestions for autocomplete */
  suggestions: string[]
}

/**
 * Client-side fuzzy search for partners using MiniSearch
 * Provides instant search results as user types
 */
export function usePartnerSearch<T extends SearchablePartner>({
  partners,
  searchQuery,
  minChars = 1,
  fuzzy = 0.2,
}: UsePartnerSearchOptions<T>): SearchResult<T> {
  // Create and index the MiniSearch instance
  const searchIndex = useMemo(() => {
    const index = new MiniSearch<T>({
      fields: ['brand_name', 'partner_code', 'client_name', 'client_email', 'pod_leader_name', 'brand_manager_name'],
      storeFields: ['id', 'brand_name'],
      searchOptions: {
        boost: { brand_name: 3, partner_code: 2, client_name: 1.5 },
        fuzzy,
        prefix: true,
      },
    })

    // Index all partners
    index.addAll(partners)

    return index
  }, [partners, fuzzy])

  // Perform search
  const searchResults = useMemo((): SearchResult<T> => {
    const query = searchQuery.trim()

    if (query.length < minChars) {
      return {
        results: partners,
        isSearching: false,
        suggestions: [],
      }
    }

    // Perform fuzzy search
    const results = searchIndex.search(query, {
      fuzzy,
      prefix: true,
      combineWith: 'OR',
    })

    // Map results back to full partner objects, preserving search score order
    const resultIds = new Set(results.map(r => r.id))
    const matchedPartners = partners.filter(p => resultIds.has(p.id))

    // Sort by search score
    const scoreMap = new Map(results.map(r => [r.id, r.score]))
    matchedPartners.sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0))

    // Get autocomplete suggestions
    const suggestions = searchIndex.autoSuggest(query, {
      fuzzy: fuzzy / 2,
      prefix: true,
    }).slice(0, 5).map(s => s.suggestion)

    return {
      results: matchedPartners,
      isSearching: true,
      suggestions,
    }
  }, [searchIndex, searchQuery, minChars, fuzzy, partners])

  return searchResults
}

/**
 * Highlight matching text in search results
 */
export function highlightMatch(text: string, query: string): { text: string; highlight: boolean }[] {
  if (!query.trim() || !text) {
    return [{ text, highlight: false }]
  }

  const parts: { text: string; highlight: boolean }[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()

  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index !== -1) {
    // Add non-matching part before
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlight: false })
    }
    // Add matching part
    parts.push({ text: text.slice(index, index + lowerQuery.length), highlight: true })
    lastIndex = index + lowerQuery.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false })
  }

  return parts.length > 0 ? parts : [{ text, highlight: false }]
}
