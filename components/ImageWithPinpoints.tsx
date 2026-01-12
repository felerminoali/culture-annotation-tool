
import React, { useState, useRef } from 'react';
import { ImageAnnotation, ShapeType } from '../types';

interface ImageWithPinpointsProps {
  imageUrl: string;
  annotations: ImageAnnotation[];
  onAddPin: (x: number, y: number, width: number, height: number, shapeType: ShapeType) => void;
  onEditPin: (anno: ImageAnnotation) => void;
}

const ImageWithPinpoints: React.FC<ImageWithPinpointsProps> = ({ imageUrl, annotations, onAddPin, onEditPin }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rect');
  const containerRef = useRef<HTMLDivElement>(null);

  const getCoordinates = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only draw if not clicking an existing annotation
    if ((e.target as HTMLElement).closest('.annotation-shape')) return;

    setIsDrawing(true);
    const pos = getCoordinates(e);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setCurrentPos(getCoordinates(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const endPos = getCoordinates(e);

    // Calculate dimensions
    const width = Math.abs(endPos.x - startPos.x);
    const height = Math.abs(endPos.y - startPos.y);

    // If just a click (too small), default to a standard size
    if (width < 1 && height < 1) {
      onAddPin(startPos.x - 2.5, startPos.y - 2.5, 5, 5, activeShapeType);
    } else {
      const x = Math.min(startPos.x, endPos.x);
      const y = Math.min(startPos.y, endPos.y);
      onAddPin(x, y, width, height, activeShapeType);
    }
  };

  // Preview dimensions
  const previewX = Math.min(startPos.x, currentPos.x);
  const previewY = Math.min(startPos.y, currentPos.y);
  const previewW = Math.abs(currentPos.x - startPos.x);
  const previewH = Math.abs(currentPos.y - startPos.y);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveShapeType('rect')}
            className={`p-2 rounded-lg transition-all ${activeShapeType === 'rect' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Rectangle Tool"
          >
            <i className="fa-solid fa-square"></i>
          </button>
          <button
            onClick={() => setActiveShapeType('circle')}
            className={`p-2 rounded-lg transition-all ${activeShapeType === 'circle' ? 'bg-red-600 text-white' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Circle Tool"
          >
            <i className="fa-solid fa-circle"></i>
          </button>
        </div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
          {activeShapeType === 'rect' ? 'Click & Drag Rect' : 'Click & Drag Circle'}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative group overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt="Context Reference"
          className="w-full h-auto block pointer-events-none"
          onDragStart={(e) => e.preventDefault()}
        />

        {/* Drawing Preview */}
        {isDrawing && (
          <div
            className={`absolute border-2 border-dashed pointer-events-none ${activeShapeType === 'circle'
              ? 'border-red-500 bg-red-500 bg-opacity-20 rounded-full'
              : 'border-indigo-500 bg-indigo-500 bg-opacity-20'
              }`}
            style={{
              left: `${previewX}%`,
              top: `${previewY}%`,
              width: `${previewW}%`,
              height: `${previewH}%`
            }}
          />
        )}

        {/* Existing Annotations */}
        {annotations.map((anno) => {
          const isCircle = anno.shapeType === 'circle';
          const isIssue = anno.subtype === 'issue' || anno.isPresent === 'no' || anno.isRelevant === 'no' || anno.isSupported === 'no';

          // Issues are red, Culture markers are indigo.
          const colorClasses = isCircle || isIssue
            ? 'border-red-500 bg-red-500 bg-opacity-20'
            : 'border-indigo-600 bg-indigo-600 bg-opacity-20';

          return (
            <div
              key={anno.id}
              className={`annotation-shape absolute border-2 transition-all hover:scale-[1.02] cursor-pointer z-10 ${colorClasses} ${isCircle ? 'rounded-full' : 'rounded-sm'}`}
              style={{
                left: `${anno.x}%`,
                top: `${anno.y}%`,
                width: `${anno.width}%`,
                height: `${anno.height}%`
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEditPin(anno);
              }}
            >
              <div className={`absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full text-white text-[8px] shadow-sm ${isCircle || isIssue ? 'bg-red-500' : 'bg-indigo-600'
                }`}>
                <i className={`fa-solid ${isCircle ? 'fa-circle' : 'fa-square'}`}></i>
              </div>
            </div>
          );
        })}

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="bg-black bg-opacity-60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-md font-bold uppercase tracking-widest">
            Drag to draw
          </span>
        </div>
      </div>
    </div>
  );
};

export default ImageWithPinpoints;
