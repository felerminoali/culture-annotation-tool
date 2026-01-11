
import React, { useState, useEffect } from 'react';
import { DecisionStatus, ImageAnnotation, ShapeType, Language } from '../types';
import { t } from '../services/i18n';

interface ImageAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ImageAnnotation, 'id' | 'x' | 'y' | 'width' | 'height' | 'timestamp'>) => void;
  existingAnnotation?: ImageAnnotation | null;
  language: Language;
  projectGuideline?: string;
}

const ImageAnnotationModal: React.FC<ImageAnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingAnnotation,
  language,
  projectGuideline
}) => {
  const [description, setDescription] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [isPresent, setIsPresent] = useState<DecisionStatus>('yes');
  const [presentJustification, setPresentJustification] = useState('');
  const [isRelevant, setIsRelevant] = useState<DecisionStatus>('yes');
  const [relevantJustification, setRelevantJustification] = useState('');
  const [shapeType, setShapeType] = useState<ShapeType>('rect');

  useEffect(() => {
    if (isOpen) {
      if (existingAnnotation) {
        setDescription(existingAnnotation.description || '');
        setIsPresent(existingAnnotation.isPresent);
        setPresentJustification(existingAnnotation.presentJustification || '');
        setIsRelevant(existingAnnotation.isRelevant);
        setRelevantJustification(existingAnnotation.relevantJustification || '');
        setShapeType(existingAnnotation.shapeType || 'rect');
      } else {
        setDescription('');
        setIsPresent('yes');
        setPresentJustification('');
        setIsRelevant('yes');
        setRelevantJustification('');
      }
    }
  }, [isOpen, existingAnnotation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-bold text-lg flex items-center">
            <i className="fa-solid fa-draw-polygon mr-2"></i>
            {t('shape_annotation', language)}
          </h3>
          <button onClick={onClose} className="text-indigo-100 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Description Section */}
          <section className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('description_label', language)}</label>
            <input
              type="text"
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-inner"
              placeholder={t('object_placeholder', language)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </section>

          {projectGuideline && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all mb-4">
              <button
                onClick={() => setShowGuidelines(!showGuidelines)}
                className="w-full px-5 py-2.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                type="button"
              >
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-book-open text-indigo-500 text-[10px]"></i>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('view_guidelines', language)}</span>
                </div>
                <i className={`fa-solid fa-chevron-${showGuidelines ? 'up' : 'down'} text-[10px] text-slate-400 transition-transform`}></i>
              </button>
              {showGuidelines && (
                <div className="p-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="guideline-html-content text-xs text-slate-600 leading-relaxed max-w-none" dangerouslySetInnerHTML={{ __html: projectGuideline }} />
                  <style>{`
                    .guideline-html-content h1 { font-size: 1rem; font-weight: 800; margin-bottom: 0.4rem; }
                    .guideline-html-content h2 { font-size: 0.9rem; font-weight: 700; margin-bottom: 0.3rem; margin-top: 0.8rem; }
                    .guideline-html-content h3 { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem; margin-top: 0.6rem; }
                    .guideline-html-content p { margin-bottom: 0.5rem; }
                    .guideline-html-content ul, .guideline-html-content ol { margin-bottom: 0.5rem; padding-left: 1rem; }
                    .guideline-html-content li { margin-bottom: 0.15rem; }
                  `}</style>
                </div>
              )}
            </div>
          )}

          {/* Shape Type Toggle */}
          <section className="space-y-3 pt-4 border-t border-gray-100">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('shape_style', language)}</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setShapeType('rect')}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center transition-all ${shapeType === 'rect'
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
              >
                <i className="fa-regular fa-square mr-2"></i> {t('rectangle', language)}
              </button>
              <button
                onClick={() => setShapeType('circle')}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center transition-all ${shapeType === 'circle'
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
              >
                <i className="fa-regular fa-circle mr-2"></i> {t('circle', language)}
              </button>
            </div>
          </section>

          {/* Presence Section */}
          <section className="space-y-3 pt-4 border-t border-gray-100">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('is_present', language)}</label>
            <div className="flex space-x-2">
              {(['yes', 'no', 'na'] as DecisionStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setIsPresent(status)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold capitalize transition-all ${isPresent === status
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
            {isPresent === 'no' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-semibold text-red-500 mb-1">{t('absence_justification', language)}</label>
                <textarea
                  className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-red-50"
                  rows={2}
                  value={presentJustification}
                  onChange={(e) => setPresentJustification(e.target.value)}
                  placeholder={t('missing_placeholder', language)}
                />
              </div>
            )}
          </section>

          {/* Relevance Section */}
          <section className="space-y-3 pt-4 border-t border-gray-100">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('relevance_context', language)}</label>
            <div className="flex space-x-2">
              {(['yes', 'no', 'na'] as DecisionStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setIsRelevant(status)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold capitalize transition-all ${isRelevant === status
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
            {isRelevant === 'no' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-semibold text-red-500 mb-1">{t('irrelevance_justification', language)}</label>
                <textarea
                  className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-red-50"
                  rows={2}
                  value={relevantJustification}
                  onChange={(e) => setRelevantJustification(e.target.value)}
                  placeholder={t('not_relevant_placeholder', language)}
                />
              </div>
            )}
          </section>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            {t('cancel', language)}
          </button>
          <button
            onClick={() => onSave({ description, isPresent, presentJustification, isRelevant, relevantJustification, shapeType })}
            disabled={!description || (isPresent === 'no' && !presentJustification) || (isRelevant === 'no' && !relevantJustification)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('save_annotation', language)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageAnnotationModal;
