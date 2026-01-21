
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
    <div className="fixed top-12 right-12 z-[6000] w-full max-w-sm animate-in slide-in-from-right-10 fade-in duration-500">
      <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.4)] border border-white/20 overflow-hidden relative max-h-[90vh] flex flex-col">
        <div className="h-24 bg-indigo-600 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:20px_20px]"></div>
          <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 bg-black/10 hover:bg-black/20 text-white rounded-full flex items-center justify-center transition-all z-20"><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="px-8 pb-8 -mt-8 relative flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-1 bg-white inline-block rounded-[1.5rem] shadow-2xl mb-4 ring-4 ring-white flex-shrink-0">
            <div className="w-16 h-16 bg-slate-50 rounded-[1.3rem] flex items-center justify-center text-indigo-500 text-2xl">
              <i className="fa-solid fa-book-open"></i>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">{t('quality_standard', language)}</p>
              <h3 className="text-xl font-black italic tracking-tight text-slate-900 leading-tight mb-2">{t('annotation_guidelines', language)}</h3>

              <div className="mt-4">
                {projectGuideline ? (
                  <div className="guideline-html-content text-xs font-medium text-slate-500 leading-relaxed prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: projectGuideline }} />
                ) : (
                  <div className="space-y-6">
                    <section className="space-y-2">
                      <h4 className="flex items-center text-indigo-600 font-black text-[10px] uppercase tracking-wider">
                        <span className="w-5 h-5 bg-indigo-100 rounded flex items-center justify-center mr-2 text-[8px]">01</span>
                        {t('text_highlighting', language)}
                      </h4>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-bold text-slate-700 mb-1">{t('precise_selection', language)}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{t('precise_selection_desc', language)}</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-bold text-slate-700 mb-1">{t('contextual_notes', language)}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{t('contextual_notes_desc', language)}</p>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h4 className="flex items-center text-indigo-600 font-black text-[10px] uppercase tracking-wider">
                        <span className="w-5 h-5 bg-indigo-100 rounded flex items-center justify-center mr-2 text-[8px]">02</span>
                        {t('visual_pinpoints', language)}
                      </h4>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-bold text-slate-700 mb-1">{t('is_present_label', language)}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{t('is_present_desc', language)}</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-bold text-slate-700 mb-1">{t('relevance_check', language)}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{t('relevance_check_desc', language)}</p>
                      </div>
                    </section>

                    <div className="p-3 rounded-2xl bg-indigo-600 text-white flex items-start">
                      <i className="fa-solid fa-lightbulb mt-1 mr-3 text-indigo-200 text-xs"></i>
                      <div>
                        <p className="text-xs font-bold">{t('pro_tip', language)}</p>
                        <p className="text-[10px] opacity-90 leading-relaxed">{t('pro_tip_desc', language)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
          </div>
        </div>

        <div className="flex-shrink-0 bg-slate-50 px-8 py-6 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest border-b-4 border-slate-700 active:scale-95 transition-all">{t('i_understand', language)}</button>
        </div>
      </div>
    </div>
  );
};

export default GuidelinesModal;