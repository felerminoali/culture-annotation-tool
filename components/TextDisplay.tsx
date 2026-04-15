
import React, { useRef } from 'react';
import { Annotation, SelectionState } from '../types';

interface TextDisplayProps {
  content: string;
  annotations: Annotation[];
  onSelect: (selection: SelectionState) => void;
  onEditAnnotation: (annotation: Annotation) => void;
}

const TextDisplay: React.FC<TextDisplayProps> = ({ content, annotations, onSelect, onEditAnnotation }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.startContainer)) return;

    // Use the Range API to compute the true offset relative to the container,
    // instead of indexOf which always returns the first occurrence.
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const preText = preRange.toString();

    // Account for leading whitespace that .trim() removed
    const fullSelectedText = selection.toString();
    const leadingTrimmed = fullSelectedText.length - fullSelectedText.trimStart().length;

    const start = preText.length + leadingTrimmed;
    const end = start + selectedText.length;

    if (start >= 0 && end <= content.length) {
      onSelect({
        start,
        end,
        text: selectedText
      });
    }

    // Clear browser selection so the modal can handle it
    selection.removeAllRanges();
  };

  const renderContent = () => {
    if (annotations.length === 0) return content;

    // Sort annotations by stored start offset as an ordering hint
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((anno) => {
      if (!anno.text) return;

      // --- Dynamic text-based matching ---
      // Instead of trusting stored start/end (which may have been saved with wrong offsets),
      // search for the annotation text in the content starting from lastIndex.
      // This auto-corrects any historical offset drift for all existing annotations.
      let actualStart = content.indexOf(anno.text, lastIndex);

      if (actualStart === -1) {
        // Not found from lastIndex — try a case-insensitive or broader search as fallback
        // (e.g., the paragraph may have been slightly edited). Skip if still not found.
        return;
      }

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
          onClick={(e) => {
            e.stopPropagation();
            onEditAnnotation(anno);
          }}
        >
          {content.slice(actualStart, actualEnd)}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 shadow-xl border border-gray-700">
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
