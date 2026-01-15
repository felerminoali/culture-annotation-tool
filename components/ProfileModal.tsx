
import React from 'react';
import { Language } from '../types';
import { t } from '../services/i18n';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle?: string;
  taskProfile?: string; // Now expects HTML string
  language: Language;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, taskTitle, taskProfile, language }) => {
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
              <i className="fa-solid fa-circle-info"></i>
            </div>
          </div>

          <div className="space-y-4 flex-1"> {/* This div will hold the actual scrollable text content */}
            <div>
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">{t('profile_info', language)}</p>
              <h3 className="text-xl font-black italic tracking-tight text-slate-900 leading-tight mb-2">{taskTitle || 'Untitled Task'}</h3>
              <div
                className="task-profile-html-content text-xs font-medium text-slate-500 leading-relaxed prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: taskProfile || '<p>No specific profile information available for this task.</p>' }}
              />
              <style>{`
                .task-profile-html-content h1 { font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem; }
                .task-profile-html-content h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; margin-top: 1rem; }
                .task-profile-html-content h3 { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.3rem; margin-top: 0.8rem; }
                .task-profile-html-content p { margin-bottom: 0.75rem; }
                .task-profile-html-content ul, .task-profile-html-content ol { margin-bottom: 0.75rem; padding-left: 1.25rem; }
                .task-profile-html-content li { margin-bottom: 0.2rem; }
                .task-profile-html-content strong { font-weight: 700; color: #1e293b; }
              `}</style>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-slate-50 px-8 py-6 border-t border-slate-100"> {/* Fixed footer */}
          <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest border-b-4 border-slate-700 active:scale-95 transition-all">{t('close', language)}</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
    