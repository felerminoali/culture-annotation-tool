
import React, { useRef } from 'react';
import { Annotation, SelectionState } from '../types';

interface TextDisplayProps {
  content: string;
  annotations: Annotation[];
  paragraphOffset: number;
  onSelect: (selection: SelectionState) => void;
  onEditAnnotation: (annotation: Annotation) => void;
}

const TextDisplay: React.FC<TextDisplayProps> = ({ content, annotations, paragraphOffset, onSelect, onEditAnnotation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether the mouse drag started inside our container.
  // This is more reliable than checking range.startContainer on mouseup,
  // because startContainer can be a deep text node inside a highlight span.
  const dragStartedInside = useRef(false);

  const handleMouseDown = () => {
    dragStartedInside.current = true;
  };

  const handleMouseUp = () => {
    if (!dragStartedInside.current) return;
    dragStartedInside.current = false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    // Use commonAncestorContainer so selections that span highlight <span>
    // elements (whose text nodes are children, not the container itself) are
    // still correctly attributed to our container.
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    // Compute true offset by traversing DOM and skipping tooltip elements
    const computeOffset = (root: Node, targetNode: Node, targetOffset: number): number => {
      let currentOffset = 0;
      let targetFound = false;

      const traverse = (node: Node) => {
        if (targetFound) return;
        
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList?.contains('annotation-tooltip')) {
          return; // Skip tooltips
        }

        if (node === targetNode) {
          currentOffset += targetOffset;
          targetFound = true;
          return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          currentOffset += node.textContent?.length || 0;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            traverse(node.childNodes[i]);
            if (targetFound) return;
          }
        }
      };

      traverse(root);
      return currentOffset;
    };

    const preTextLength = computeOffset(container, range.startContainer, range.startOffset);

    // Account for leading whitespace that .trim() removed
    const fullSelectedText = selection.toString();
    const leadingTrimmed = fullSelectedText.length - fullSelectedText.trimStart().length;

    const start = preTextLength + leadingTrimmed;
    const end = start + selectedText.length;

    // Clear browser selection before opening modal to avoid stale range state
    selection.removeAllRanges();

    // Removed the `end <= content.length` guard: the Range API offset is
    // reliable; the old guard caused false negatives at paragraph boundaries.
    if (start >= 0 && end > start) {
      onSelect({ start, end, text: selectedText });
    }
  };

  const renderContent = () => {
    if (annotations.length === 0) return content;

    // App.tsx guarantees that the annotations passed here belong to this paragraph.
    // We sort them by stored start offset to process left-to-right.
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((anno) => {
      if (!anno.text) return;

      // --- Proximity-based matching ---
      // Collect ALL occurrences of anno.text in the full content, then pick the one
      // whose position is closest to the stored DB offset (anno.start).
      // This avoids false matches (e.g., "tea" inside "team") because the stored
      // offset acts as a gravity signal pointing to the intended occurrence,
      // even when offsets have drifted slightly due to past edits.
      const candidates: number[] = [];
      let searchIdx = 0;
      while (searchIdx < content.length) {
        const found = content.indexOf(anno.text, searchIdx);
        if (found === -1) break;
        candidates.push(found);
        searchIdx = found + 1; // step by 1 to catch all (including overlapping) occurrences
      }

      if (candidates.length === 0) return;

      // Only consider positions that haven't already been rendered
      const validCandidates = candidates.filter(pos => pos >= lastIndex);
      if (validCandidates.length === 0) return;

      // Pick the valid candidate whose start is closest to the stored offset.
      // anno.start is a global offset; subtract paragraphOffset to compare in
      // local paragraph coordinates (where candidates are 0-based).
      const localAnnoStart = anno.start - paragraphOffset;
      const actualStart = validCandidates.reduce((best, pos) =>
        Math.abs(pos - localAnnoStart) < Math.abs(best - localAnnoStart) ? pos : best
      );

      const actualEnd = actualStart + anno.text.length;

      // Add unhighlighted text before this annotation
      if (actualStart > lastIndex) {
        parts.push(content.slice(lastIndex, actualStart));
      }

      // Add the highlighted span
      const isIssue = anno.subtype === 'issue' || anno.isSupported === 'no';
      parts.push(
        <span
          key={anno.id}
          className={`highlight-span group relative border-b-2 transition-all duration-200 ${isIssue
            ? 'border-red-500 bg-red-50 hover:bg-red-100'
            : anno.isImportant ? 'border-amber-500 bg-amber-50 hover:bg-amber-100' : 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100'
            }`}
          onClick={() => {
            // Only open the edit modal if the user clicked (no text selected).
            // If they dragged to select text, handleMouseUp on the container will fire instead.
            const sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) return;
            onEditAnnotation(anno);
          }}
        >
          {content.slice(actualStart, actualEnd)}
          <span className="annotation-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 shadow-xl border border-gray-700">
            <i className={`fa-solid ${isIssue ? 'fa-circle-exclamation' : 'fa-pen-to-square'} mr-1 opacity-70`}></i>
            {isIssue ? `${anno.issueCategory}: ${anno.issueDescription}` : (anno.comment || "Click to edit")}
          </span>
        </span>
      );

      lastIndex = actualEnd;
    });

    // Add any remaining unhighlighted text at the end
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="prose prose-blue max-w-none text-gray-800 leading-relaxed text-lg whitespace-pre-wrap select-text p-8 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px]"
      >
        {renderContent()}
      </div>
      {/* <div className="mt-4 flex items-center text-sm text-gray-400">
        <i className="fa-solid fa-circle-info mr-2"></i>
        <span>Highlight text to annotate, or click existing highlights to edit.</span>
      </div> */}
    </div>
  );
};

export default TextDisplay;
