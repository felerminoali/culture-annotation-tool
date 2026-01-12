
import React, { useState, useEffect } from 'react';
import { SelectionState, Annotation, DecisionStatus, Language } from '../types';
import { t } from '../services/i18n';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    comment: string,
    isImportant: boolean,
    isRelevant: DecisionStatus,
    relevantJustification: string,
    isSupported: DecisionStatus,
    supportedJustification: string,
    cultureProxy: string
  ) => void;
  selection: SelectionState | null;
  editingAnnotation?: Annotation | null;
  language: Language;
  projectGuideline?: string;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selection,
  editingAnnotation,
  language,
  projectGuideline
}) => {
  const [comment, setComment] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isRelevant, setIsRelevant] = useState<DecisionStatus>('na');
  const [relevantJustification, setRelevantJustification] = useState('');
  const [isSupported, setIsSupported] = useState<DecisionStatus>('na');
  const [supportedJustification, setSupportedJustification] = useState('');
  const [cultureProxy, setCultureProxy] = useState('');
  const [customCultureProxy, setCustomCultureProxy] = useState('');

  const proxyOptions = [
    'language_proxy', 'ethnicity_group', 'region_geography', 'religion_faith',
    'socio_economic', 'age_gender_roles', 'occupation_identity',
    'food_dietary', 'physical_activity', 'kinship_structure',
    'community_practices', 'social_etiquette', 'values_beliefs',
    'health_attitude', 'other'
  ];

  useEffect(() => {
    if (isOpen) {
      if (editingAnnotation) {
        setComment(editingAnnotation.comment);
        setIsImportant(editingAnnotation.isImportant);
        setIsRelevant(editingAnnotation.isRelevant || 'na');
        setRelevantJustification(editingAnnotation.relevantJustification || '');
        setIsSupported(editingAnnotation.isSupported || 'na');
        setSupportedJustification(editingAnnotation.supportedJustification || '');
        const proxy = editingAnnotation.cultureProxy || '';
        if (proxyOptions.includes(proxy) && proxy !== 'other') {
          setCultureProxy(proxy);
          setCustomCultureProxy('');
        } else if (proxy !== '') {
          setCultureProxy('other');
          setCustomCultureProxy(proxy);
        } else {
          setCultureProxy('');
          setCustomCultureProxy('');
        }
      } else {
        setComment('');
        setIsImportant(false);
        setIsRelevant('na');
        setRelevantJustification('');
        setIsSupported('na');
        setSupportedJustification('');
        setCultureProxy('');
        setCustomCultureProxy('');
      }
    }
  }, [isOpen, editingAnnotation]);

  if (!isOpen || (!selection && !editingAnnotation)) return null;

  const displaySelection = editingAnnotation ? editingAnnotation.text : selection?.text;

  const renderDecisionGroup = (
    label: string,
    value: DecisionStatus,
    onChange: (val: DecisionStatus) => void,
    justificationValue: string,
    onJustificationChange: (val: string) => void
  ) => (
    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
      <label className="block text-xs font-black uppercase text-slate-400 tracking-widest">{label}</label>
      <div className="flex space-x-2">
        {(['yes', 'no', 'na'] as DecisionStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => onChange(status)}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${value === status
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
          >
            {status}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('justification', language)}</label>
        <textarea
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-20 text-xs font-medium"
          placeholder={t('reasoning_placeholder', language)}
          value={justificationValue}
          onChange={(e) => onJustificationChange(e.target.value)}
        />
      </div>
    </div>
  );

  const handleSave = () => {
    const finalProxy = cultureProxy === 'other' ? customCultureProxy : cultureProxy;
    onSave(comment, isImportant, isRelevant, relevantJustification, isSupported, supportedJustification, finalProxy);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
        <div className={`px-8 py-6 flex justify-between items-center ${editingAnnotation ? 'bg-indigo-600' : 'bg-slate-900'}`}>
          <div>
            <p className="text-white/60 text-[10px] uppercase font-black tracking-[0.2em] mt-0.5">{t('culture_marker', language)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
              <i className="fa-solid fa-quote-left mr-2 text-indigo-500"></i> {t('selected_evidence', language)}
            </label>
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-slate-700 italic text-xs leading-relaxed font-medium">
              "{displaySelection}"
            </div>
          </div>

          {projectGuideline && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all">
              <button
                onClick={() => setShowGuidelines(!showGuidelines)}
                className="w-full px-5 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                type="button"
              >
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-book-open text-indigo-500 text-[10px]"></i>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('view_guidelines', language)}</span>
                </div>
                <i className={`fa-solid fa-chevron-${showGuidelines ? 'up' : 'down'} text-[10px] text-slate-400 transition-transform`}></i>
              </button>
              {showGuidelines && (
                <div className="p-5 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="guideline-html-content text-xs text-slate-600 leading-relaxed prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: projectGuideline }} />
                  <style>{`
                    .guideline-html-content h1 { font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem; }
                    .guideline-html-content h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; margin-top: 1rem; }
                    .guideline-html-content h3 { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.3rem; margin-top: 0.8rem; }
                    .guideline-html-content p { margin-bottom: 0.75rem; }
                    .guideline-html-content ul, .guideline-html-content ol { margin-bottom: 0.75rem; padding-left: 1.25rem; }
                    .guideline-html-content li { margin-bottom: 0.2rem; }
                    .guideline-html-content strong { font-weight: 700; color: #1e293b; }
                  `}</style>
                </div>
              )}
            </div>
          )}

          {/* 1. Culture Proxy */}
          <div className="space-y-4">
            <div>
              <label htmlFor="cultureProxy" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                <i className="fa-solid fa-users-rectangle mr-2 text-indigo-500"></i> {t('culture_proxy', language)}
              </label>
              <select
                id="cultureProxy"
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-xs font-bold bg-slate-50 shadow-inner appearance-none cursor-pointer"
                value={cultureProxy}
                onChange={(e) => setCultureProxy(e.target.value)}
              >
                <option value="" disabled>{t('select_proxy', language)}</option>
                {proxyOptions.map(opt => (
                  <option key={opt} value={opt}>{t(opt as any, language)}</option>
                ))}
              </select>
            </div>

            {cultureProxy === 'other' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label htmlFor="customCultureProxy" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center ml-1">
                  {t('other_category_label', language)}
                </label>
                <input
                  id="customCultureProxy"
                  type="text"
                  autoFocus
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-xs font-bold bg-white shadow-sm"
                  placeholder={t('other', language)}
                  value={customCultureProxy}
                  onChange={(e) => setCustomCultureProxy(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 2. Supported Section */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
              <i className="fa-solid fa-circle-check mr-2 text-emerald-500"></i> {t('is_supported', language)}
            </label>
            <div className="flex space-x-2">
              {(['yes', 'no'] as DecisionStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setIsSupported(status)}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${isSupported === status
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
            {isSupported !== 'na' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('justification', language)}</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-20 text-xs font-medium bg-slate-50"
                  placeholder={t('reasoning_placeholder', language)}
                  value={supportedJustification}
                  onChange={(e) => setSupportedJustification(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* 3. Relevant Section */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
              <i className="fa-solid fa-bullseye mr-2 text-indigo-500"></i> {t('is_relevant', language)}
            </label>
            <div className="flex space-x-2">
              {(['yes', 'no'] as DecisionStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setIsRelevant(status)}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${isRelevant === status
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
            {isRelevant !== 'na' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('justification', language)}</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-20 text-xs font-medium bg-slate-50"
                  placeholder={t('reasoning_placeholder', language)}
                  value={relevantJustification}
                  onChange={(e) => setRelevantJustification(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* 4. Comment Section */}
          <div className="pt-4 border-t border-slate-100">
            <label htmlFor="comment" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
              <i className="fa-solid fa-pen-nib mr-2 text-indigo-500"></i> {t('comment_label', language)}
            </label>
            <textarea
              id="comment"
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-28 text-xs font-bold bg-slate-50 shadow-inner"
              placeholder={t('observations_placeholder', language)}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="pt-4">
            <button
              onClick={() => setIsImportant(!isImportant)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isImportant
                ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center">
                <i className={`fa-solid fa-triangle-exclamation mr-3 ${isImportant ? 'text-amber-500' : 'text-slate-300'}`}></i>
                <span className="text-[10px] font-black uppercase tracking-widest">{t('important_escalation', language)}</span>
              </div>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${isImportant ? 'bg-amber-500' : 'bg-slate-200'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${isImportant ? 'right-0.5' : 'left-0.5'}`}></div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-6 flex justify-end space-x-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            {t('discard', language)}
          </button>
          <button
            onClick={handleSave}
            className={`px-10 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 border-b-4 ${editingAnnotation ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-900' : 'bg-slate-900 hover:bg-slate-800 border-slate-700'}`}
          >
            {editingAnnotation ? t('push_updates', language) : t('submit', language)}
          </button>
        </div>
      </div >
    </div >
  );
};

export default AnnotationModal;
