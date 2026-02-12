
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
  const [customCultureProxy, setCustomCultureProxy] = useState('');
  const [rating, setRating] = useState(0);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const proxyOptions = [

    // 'language_local_expression',
    'food_dietary_practices',
    'place_physical_environment',
    'healthcare_community_practices',
    'socio_economic_context',
    'family_household_structure',
    'occupation_daily_routine',
    'health_values_beliefs',
    'clothing_fashion',

    // Social & Relational Dimensions
    'social_roles_hierarchy',
    'community_social_networks',
    'gender_norms_expectations',
    'life_stage_transitions',

    // Time, Rhythm & Everyday Organization
    'temporal_orientation',
    'seasonality_environmental_cycles',
    'daily_rhythms_meal_patterns',

    // Knowledge, Belief & Meaning Systems
    'religious_spiritual_practices',
    'traditional_indigenous_knowledge',
    'health_illness_explanatory_models',
    'values_moral_frameworks',

    // Material & Technological Context
    'technology_media_use',
    'transport_mobility',
    'household_resources_tools',

    // Communication, Affect & Expression
    'communication_style',
    'emotional_expression_norms',
    'storytelling_narrative_forms',

    // Norms, Constraints & Absences
    'social_norms_taboo',
    'institutional_trust_relations',
    'silence_implicit_knowledge',

    // Fallback
    'other'
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
        setComment(existingAnnotation.comment || '');
        setRating(existingAnnotation.rating || 0);

        // Handle custom proxy
        if (existingAnnotation.cultureProxy && !proxyOptions.includes(existingAnnotation.cultureProxy)) {
          setCultureProxy('other');
          setCustomCultureProxy(existingAnnotation.cultureProxy);
        } else {
          setCultureProxy(existingAnnotation.cultureProxy || '');
          setCustomCultureProxy('');
        }
      } else {
        setDescription('');
        setIsRelevant('na');
        setRelevantJustification('');
        setIsSupported('na');
        setSupportedJustification('');
        setCultureProxy('');
        setCustomCultureProxy('');
        setComment('');
        setRating(0);
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
              {cultureProxy === 'other' && (
                <div className="animate-in slide-in-from-top-2 duration-200 mt-2">
                  <label className="block text-xs font-bold text-indigo-600 mb-1">{t('other_category_label', language)}</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border-2 border-indigo-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-indigo-700 bg-indigo-50/50"
                    placeholder="Enter custom category..."
                    value={customCultureProxy}
                    onChange={(e) => setCustomCultureProxy(e.target.value)}
                  />
                </div>
              )}
            </section>


            <section className="space-y-3 pt-4 border-t border-gray-100">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('is_supported', language)}</label>
              <div className="flex space-x-2">
                {(['yes', 'no'] as DecisionStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setIsSupported(status)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold capitalize transition-all ${isSupported === status
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    {t(status as any, language)}
                  </button>
                ))}
              </div>
            </section>

            {/* Supported Section - COMMENTED OUT
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
            */}

            {/* Relevance Section - COMMENTED OUT
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
                    {t(status as any, language)}
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
            */}

            {/* Rating Section */}
            <section className="space-y-3 pt-4 border-t border-gray-100">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                <i className="fa-solid fa-star mr-2 text-amber-500"></i> {t('rating_label', language)}
              </label>
              <div className="flex space-x-4 justify-center py-2">
                {[1, 2, 3].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <i className={`fa-star text-3xl transition-all ${rating >= star ? 'fa-solid text-amber-400' : 'fa-regular text-slate-200 hover:text-amber-200'}`}></i>
                  </button>
                ))}
              </div>
            </section>

            {/* Comment Section - COMMENTED OUT
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
            */}
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
              cultureProxy: cultureProxy === 'other' ? customCultureProxy : cultureProxy, // Use custom proxy if "other" selected
              comment,
              rating
            })}
            disabled={!cultureProxy || (cultureProxy === 'other' && !customCultureProxy) || rating === 0 || isSupported === 'na'}
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
