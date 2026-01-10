
import React from 'react';
import { Language } from '../types';
import { t } from '../services/i18n';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle?: string;
  taskProfile?: string;
  language: Language;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, taskTitle, taskProfile, language }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-12 right-12 z-[6000] w-full max-w-sm animate-in slide-in-from-right-10 fade-in duration-500">
      <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.4)] border border-white/20 overflow-hidden relative">
        <div className="h-24 bg-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:20px_20px]"></div>
          <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 bg-black/10 hover:bg-black/20 text-white rounded-full flex items-center justify-center transition-all z-20"><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="px-8 pb-8 -mt-8 relative">
          <div className="p-1 bg-white inline-block rounded-[1.5rem] shadow-2xl mb-4 ring-4 ring-white">
            <div className="w-16 h-16 bg-slate-50 rounded-[1.3rem] flex items-center justify-center text-indigo-500 text-2xl">
              <i className="fa-solid fa-circle-info"></i>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">{t('profile_info', language)}</p>
              <h3 className="text-xl font-black italic tracking-tight text-slate-900 leading-tight mb-2">{taskTitle || 'Untitled Task'}</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                {taskProfile || 'No specific profile information available for this task.'}
              </p>
            </div>

            <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest border-b-4 border-slate-700 active:scale-95 transition-all">{t('close', language)}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
