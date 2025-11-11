import type {
  ReplaceItemBase,
  ReplaceTableData,
  ReplaceTextData,
  RevertTableData,
} from "../../types/presentationService.ts";
// Visible markers for debugging
// const ZW0 = "[E]";
// const ZW1 = "[S]";
// const ZWSEP = "__";
// const WORD_JOINER = "_";

const ZW0 = "\u200B"; // represents bit 0
const ZW1 = "\u200C"; // represents bit 1
const ZWSEP = "\u200D"; // separator between 8-bit chunks (bytes)
const WORD_JOINER = "\u2060"; // outer sentinel to bound a marker

// Readable marker prefixes for START/END
const MARKER_PREFIX_START = WORD_JOINER + ZW1 + ZWSEP;
const MARKER_PREFIX_END = WORD_JOINER + ZW0 + ZWSEP;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Encode arbitrary string id to a zero-width payload using ZW0/ZW1 with ZWSEP byte separators */
export function encodeIdToZeroWidth(id: string): string {
  const bytes = textEncoder.encode(id); // UTF-8
  const bitsChunks = Array.from(bytes, (b) =>
    b.toString(2).padStart(8, "0").replace(/0/g, ZW0).replace(/1/g, ZW1)
  );
  return bitsChunks.join(ZWSEP);
}

/** Decode zero-width payload back to string id */
export function decodeIdFromZeroWidth(payload: string): string {
  const parts = payload.split(ZWSEP);
  const bytes: number[] = [];

  for (let index = 0; index < parts.length; index++) {
    const chunk = parts[index];
    if (chunk.length === 0) {
      continue;
    }
    const bits = chunk.replace(new RegExp(ZW0, "g"), "0").replace(new RegExp(ZW1, "g"), "1");
    bytes.push(parseInt(bits, 2));
  }

  return textDecoder.decode(new Uint8Array(bytes));
}

/** Build START and END markers with minimal distinction via a one-char FLAG (ZW1 = START, ZW0 = END) */

/** Build START and END markers with minimal distinction via a one-char FLAG (ZW1 = START, ZW0 = END) */
export function buildStartMarker(id: number): string {
  const encoded = encodeIdToZeroWidth(String(id));
  return MARKER_PREFIX_START + encoded + WORD_JOINER;
  // return MARKER_PREFIX_START + id + WORD_JOINER; // Visible markers for debugging _[S]__id_
}

export function buildEndMarker(id: number): string {
  const encoded = encodeIdToZeroWidth(String(id));
  return MARKER_PREFIX_END + encoded + WORD_JOINER;
  // return MARKER_PREFIX_END + id + WORD_JOINER; // Visible markers for debugging _[E]__id_
}

/** Generic regex to match any marker built by the scheme above */
export function getGenericMarkerRegExp(): RegExp {
  // \u2060 (WORD_JOINER) + [\u200B\u200C] (FLAG) + \u200D (ZWSEP) + payload of ([\u200B\u200C]+ separated by \u200D) + \u2060
  // Using a conservative pattern to avoid backtracking issues.
  return /\u2060[\u200B\u200C]\u200D[\u200B\u200C]+(?:\u200D[\u200B\u200C]+)*\u2060/g;
}

/* For Visible markers and debugging */
// export function getGenericMarkerRegExp(): RegExp {
//   return /_(?:\[E]|\[S])__\d+_/g;
// }

/** Check if the text already contains both START and END markers for a specific id */
export function hasMarkersForId(rawText: string, id: number): boolean {
  const startMarker = buildStartMarker(id);
  const endMarker = buildEndMarker(id);
  return rawText.includes(startMarker) && rawText.includes(endMarker);
}

/** Produce a "clean" text (without markers) and an index map from clean index -> raw index */
export function clearMarkersAndBuildIndexMap(rawText: string): {
  cleanText: string;
  cleanToRawIndex: number[];
} {
  const markerRegex = getGenericMarkerRegExp();
  const cleanChars: string[] = [];
  const cleanToRawIndex: number[] = [];

  for (let rawIndex = 0; rawIndex < rawText.length; ) {
    markerRegex.lastIndex = rawIndex;
    const match = markerRegex.exec(rawText);
    if (match !== null && match.index === rawIndex) {
      const skip = match[0].length;
      rawIndex = rawIndex + skip;
      continue;
    }
    cleanToRawIndex.push(rawIndex);
    cleanChars.push(rawText[rawIndex]);
    rawIndex = rawIndex + 1;
  }

  return { cleanText: cleanChars.join(""), cleanToRawIndex };
}

export function findOccurrenceStartIndex(
  cleanText: string,
  searchText: string,
  occurrenceIndex?: number | null
): number {
  if (!searchText || searchText.length === 0) {
    return -1;
  }

  if (occurrenceIndex != null && Number.isInteger(occurrenceIndex) && occurrenceIndex >= 0) {
    let fromIndex = 0;

    for (let foundCount = 0; foundCount <= occurrenceIndex; foundCount++) {
      const index = caseInsensitiveIndexOf(cleanText, searchText, fromIndex);

      if (index < 0) {
        return -1;
      }

      if (foundCount === occurrenceIndex) {
        return index;
      }

      fromIndex = index + searchText.length;
    }

    return -1;
  }

  return caseInsensitiveIndexOf(cleanText, searchText);
}

export function caseInsensitiveIndexOf(
  source: string,
  searchString: string,
  fromIndex: number = 0
): number {
  const lowerHaystack = source.toLowerCase();
  const lowerNeedle = searchString.toLowerCase();
  return lowerHaystack.indexOf(lowerNeedle, fromIndex);
}

export function buildTargets(
  item: ReplaceItemBase<ReplaceTextData | ReplaceTableData | RevertTableData>
) {
  if (!item || !item.data || !item.data.initialText) {
    throw new Error(
      `[buildTargets] Missing initialText for current item | id=${item ? item.id : "unknown"}, shapeId=${item ? item.shapeId : "unknown"}, occurrenceIndex=${item && item.data ? (item.data.occurrenceIndex ?? "first") : "unknown"}`
    );
  }

  const targets: Array<{
    id: number;
    shapeId: string;
    initialText: string;
    occurrenceIndex?: number | null;
  }> = [
    {
      id: item.id,
      shapeId: item.shapeId,
      initialText: item.data.initialText,
      occurrenceIndex: item.data.occurrenceIndex ?? null,
    },
  ];

  if (item.data.hasSiblings && Array.isArray(item.data.siblings)) {
    for (const sibling of item.data.siblings) {
      if (!sibling || !sibling.initialText) {
        throw new Error(
          `[buildTargets] Missing initialText for a sibling | parentId=${item.id}, shapeId=${item.shapeId}, siblingId=${sibling ? sibling.id : "unknown"}, occurrenceIndex=${sibling ? (sibling.occurrenceIndex ?? "first") : "unknown"}`
        );
      }
      targets.push({
        id: sibling.id,
        shapeId: item.shapeId,
        initialText: sibling.initialText,
        occurrenceIndex: sibling.occurrenceIndex ?? null,
      });
    }
  }

  return targets;
}
