
import React from 'react';
import { Language } from '../types';
import { t } from '../services/i18n';

interface GuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  projectGuideline?: string;
}

const GuidelinesModal: React.FC<GuidelinesModalProps> = ({ isOpen, onClose, language, projectGuideline }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all zoom-in duration-200">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900">{t('annotation_guidelines', language)}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('quality_standard', language)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {projectGuideline ? (
            <div className="guideline-html-content text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: projectGuideline }} />
          ) : (
            <>
              <section className="space-y-4">
                <h4 className="flex items-center text-indigo-600 font-black text-sm uppercase tracking-wider">
                  <span className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center mr-2 text-[10px]">01</span>
                  {t('text_highlighting', language)}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 mb-1">{t('precise_selection', language)}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('precise_selection_desc', language)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 mb-1">{t('contextual_notes', language)}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('contextual_notes_desc', language)}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="flex items-center text-indigo-600 font-black text-sm uppercase tracking-wider">
                  <span className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center mr-2 text-[10px]">02</span>
                  {t('visual_pinpoints', language)}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 mb-1">{t('is_present_label', language)}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('is_present_desc', language)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 mb-1">{t('relevance_check', language)}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('relevance_check_desc', language)}</p>
                  </div>
                </div>
              </section>

              <div className="p-4 rounded-2xl bg-indigo-600 text-white flex items-start">
                <i className="fa-solid fa-lightbulb mt-1 mr-3 text-indigo-200"></i>
                <div>
                  <p className="text-sm font-bold">{t('pro_tip', language)}</p>
                  <p className="text-xs opacity-90 leading-relaxed">{t('pro_tip_desc', language)}</p>
                </div>
              </div>
            </>
          )}
        </div>
        <style>{`
          .guideline-html-content h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem; }
          .guideline-html-content h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; margin-top: 1.5rem; }
          .guideline-html-content h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1.25rem; }
          .guideline-html-content p { margin-bottom: 1rem; font-size: 0.875rem; }
          .guideline-html-content ul, .guideline-html-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
          .guideline-html-content li { margin-bottom: 0.25rem; font-size: 0.875rem; }
          .guideline-html-content strong { font-weight: 700; }
        `}</style>

        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg"
          >
            {t('i_understand', language)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuidelinesModal;
