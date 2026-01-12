import React, { useState, useEffect } from 'react';
import { ImageAnnotation, Language } from '../types';
import { t } from '../services/i18n';

interface ImageIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { issueCategory: string; issueDescription: string }) => void;
    existingAnnotation?: ImageAnnotation | null;
    language: Language;
}

const issueCategories = [
    'missing_unviewable',
    'low_visual_quality',
    'content_mismatch',
    'cultural_inauthenticity',
    'safety_medical_misleading',
    'sensitive_offensive',
    'other'
];

const ImageIssueModal: React.FC<ImageIssueModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingAnnotation,
    language
}) => {
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (existingAnnotation) {
                setCategory(existingAnnotation.issueCategory || '');
                setDescription(existingAnnotation.issueDescription || '');
            } else {
                setCategory('');
                setDescription('');
            }
        }
    }, [isOpen, existingAnnotation]);

    if (!isOpen) return null;

    const isFormValid = category !== '' && description.trim() !== '';

    const handleSave = () => {
        onSave({
            issueCategory: category,
            issueDescription: description
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
                <div className={`px-8 py-6 flex justify-between items-center ${existingAnnotation ? 'bg-red-600' : 'bg-slate-900'}`}>
                    <div>
                        <p className="text-white/60 text-[10px] uppercase font-black tracking-[0.2em] mt-0.5">{t('image_issue', language)}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="category" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                <i className="fa-solid fa-list-ul mr-2 text-red-500"></i> {t('issue_category', language)}
                            </label>
                            <select
                                id="category"
                                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all text-xs font-bold bg-slate-50 shadow-inner appearance-none cursor-pointer"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="" disabled>{t('select_category', language)}</option>
                                {issueCategories.map(cat => (
                                    <option key={cat} value={cat}>{t(cat as any, language)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                            <i className="fa-solid fa-pen-nib mr-2 text-red-500"></i> {t('issue_description', language)}
                        </label>
                        <textarea
                            id="description"
                            className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all h-32 text-xs font-bold bg-slate-50 shadow-inner"
                            placeholder={t('issue_description_placeholder', language)}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
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
                        disabled={!isFormValid}
                        className={`px-10 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 border-b-4 ${!isFormValid ? 'bg-slate-300 border-slate-400 cursor-not-allowed' : (existingAnnotation ? 'bg-red-600 hover:bg-red-700 border-red-900' : 'bg-slate-900 hover:bg-slate-800 border-slate-700')}`}
                    >
                        {existingAnnotation ? t('push_updates', language) : t('submit', language)}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageIssueModal;
