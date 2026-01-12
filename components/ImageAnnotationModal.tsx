
import React, { useState, useEffect } from 'react';
import { DecisionStatus, ImageAnnotation, ShapeType, Language } from '../types';
import { t } from '../services/i18n';

interface ImageAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ImageAnnotation>) => void;
  existingAnnotation?: ImageAnnotation | null;
  language: Language;
}

const ImageAnnotationModal: React.FC<ImageAnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingAnnotation,
  language
}) => {
  const [description, setDescription] = useState('');
  const [isRelevant, setIsRelevant] = useState<DecisionStatus>('na');
  const [relevantJustification, setRelevantJustification] = useState('');
  const [isSupported, setIsSupported] = useState<DecisionStatus>('na');
  const [supportedJustification, setSupportedJustification] = useState('');
  const [shapeType, setShapeType] = useState<ShapeType>('rect');
  const [cultureProxy, setCultureProxy] = useState('');
  const [comment, setComment] = useState('');

  const proxyOptions = [
    'language_proxy', 'ethnicity_group', 'region_geography', 'religion_faith',
    'socio_economic', 'age_gender_roles', 'occupation_identity',
    'food_dietary', 'physical_activity', 'kinship_structure',
    'community_practices', 'social_etiquette', 'values_beliefs',
    'health_attitude', 'other'
  ];

  useEffect(() => {
    if (isOpen) {
      if (existingAnnotation) {
        setDescription(existingAnnotation.description || '');
        setIsRelevant(existingAnnotation.isRelevant || 'na');
        setRelevantJustification(existingAnnotation.relevantJustification || '');
        setIsSupported(existingAnnotation.isSupported || 'na');
        setSupportedJustification(existingAnnotation.supportedJustification || '');
        setShapeType(existingAnnotation.shapeType || 'rect');
        setCultureProxy(existingAnnotation.cultureProxy || '');
        setComment(existingAnnotation.comment || '');
      } else {
        setDescription('');
        setIsRelevant('na');
        setRelevantJustification('');
        setIsSupported('na');
        setSupportedJustification('');
        setCultureProxy('');
        setComment('');
      }
    }
  }, [isOpen, existingAnnotation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center transition-colors">
          <h3 className="text-white font-bold text-lg flex items-center">
            <i className="fa-solid fa-draw-polygon mr-2"></i>
            {t('image_culture_marker', language)}
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-6">
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

            <section className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('culture_proxy', language)}</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-inner"
                value={cultureProxy}
                onChange={(e) => setCultureProxy(e.target.value)}
              >
                <option value="">{t('select_proxy', language)}</option>
                {proxyOptions.map(opt => (
                  <option key={opt} value={opt}>{t(opt as any, language)}</option>
                ))}
              </select>
            </section>

            {/* Supported Section */}
            <section className="space-y-3 pt-4 border-t border-gray-100">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('is_supported', language)}</label>
              <div className="flex space-x-2">
                {(['yes', 'no', 'na'] as DecisionStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setIsSupported(status)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold capitalize transition-all ${isSupported === status
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              {isSupported !== 'na' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t('justification', language)}</label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"
                    rows={2}
                    value={supportedJustification}
                    onChange={(e) => setSupportedJustification(e.target.value)}
                    placeholder={t('reasoning_placeholder', language)}
                  />
                </div>
              )}
            </section>

            {/* Relevance Section */}
            <section className="space-y-3 pt-4 border-t border-gray-100">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('is_relevant', language)}</label>
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
              {isRelevant !== 'na' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t('justification', language)}</label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"
                    rows={2}
                    value={relevantJustification}
                    onChange={(e) => setRelevantJustification(e.target.value)}
                    placeholder={t('reasoning_placeholder', language)}
                  />
                </div>
              )}
            </section>

            {/* Comment Section */}
            <section className="space-y-2 pt-4 border-t border-gray-100">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('comment_label', language)}</label>
              <textarea
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-inner"
                rows={3}
                placeholder={t('observations_placeholder', language)}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </section>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            {t('cancel', language)}
          </button>
          <button
            onClick={() => onSave({
              description,
              isRelevant,
              relevantJustification,
              isSupported,
              supportedJustification,
              shapeType,
              cultureProxy,
              comment
            })}
            disabled={!description || (isSupported !== 'na' && !supportedJustification) || (isRelevant !== 'na' && !relevantJustification)}
            className="px-6 py-2 border-b-4 bg-indigo-600 hover:bg-indigo-700 border-indigo-900 font-bold text-white rounded-lg text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('save_annotation', language)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageAnnotationModal;
