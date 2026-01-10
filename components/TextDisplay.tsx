
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

    // Logic to calculate offsets relative to the container
    const start = content.indexOf(selectedText);
    if (start !== -1) {
        onSelect({
            start,
            end: start + selectedText.length,
            text: selectedText
        });
    }
    
    // Clear browser selection so the modal can handle it
    selection.removeAllRanges();
  };

  const renderContent = () => {
    if (annotations.length === 0) return content;

    // Sort annotations by start offset
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((anno) => {
      // Add text before the highlight
      if (anno.start > lastIndex) {
        parts.push(content.slice(lastIndex, anno.start));
      }

      // Add the highlight
      parts.push(
        <span
          key={anno.id}
          className={`highlight-span group relative border-b-2 transition-all duration-200 ${
            anno.isImportant ? 'border-red-500 bg-red-50 hover:bg-red-100' : 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onEditAnnotation(anno);
          }}
        >
          {content.slice(anno.start, anno.end)}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 shadow-xl border border-gray-700">
            <i className="fa-solid fa-pen-to-square mr-1 opacity-70"></i>
            {anno.comment || "Click to edit"}
          </span>
        </span>
      );

      lastIndex = anno.end;
    });

    // Add remaining text
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
      <div className="mt-4 flex items-center text-sm text-gray-400">
        <i className="fa-solid fa-circle-info mr-2"></i>
        <span>Highlight text to annotate, or click existing highlights to edit.</span>
      </div>
    </div>
  );
};

export default TextDisplay;
