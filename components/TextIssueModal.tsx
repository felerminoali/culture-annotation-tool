
import React, { useState, useEffect } from 'react';
import { SelectionState, Annotation, Language } from '../types';
import { t } from '../services/i18n';

interface TextIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        category: string,
        description: string
    ) => void;
    selection: SelectionState | null;
    editingAnnotation?: Annotation | null;
    language: Language;
}

const categories = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];

const TextIssueModal: React.FC<TextIssueModalProps> = ({
    isOpen,
    onClose,
    onSave,
    selection,
    editingAnnotation,
    language
}) => {
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (editingAnnotation) {
                const cat = editingAnnotation.issueCategory || '';
                if (categories.includes(cat) && cat !== 't7') {
                    setCategory(cat);
                    setCustomCategory('');
                } else {
                    setCategory('t7');
                    setCustomCategory(cat);
                }
                setDescription(editingAnnotation.issueDescription || '');
            } else {
                setCategory('');
                setCustomCategory('');
                setDescription('');
            }
        }
    }, [isOpen, editingAnnotation]);

    if (!isOpen || (!selection && !editingAnnotation)) return null;

    const displaySelection = editingAnnotation ? editingAnnotation.text : selection?.text;

    const isFormValid = (category !== '' && (category !== 't7' || customCategory.trim() !== '')) && description.trim() !== '';

    const handleSave = () => {
        const finalCategory = category === 't7' ? customCategory : category;
        onSave(finalCategory, description);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
                <div className={`px-8 py-6 flex justify-between items-center ${editingAnnotation ? 'bg-red-600' : 'bg-slate-900'}`}>
                    <div>
                        <p className="text-white/60 text-[10px] uppercase font-black tracking-[0.2em] mt-0.5">{t('text_issue_annotation', language)}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                            <i className="fa-solid fa-quote-left mr-2 text-red-500"></i> {t('selected_evidence', language)}
                        </label>
                        <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-slate-700 italic text-xs leading-relaxed font-medium">
                            "{displaySelection}"
                        </div>
                    </div>

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
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{t(cat as any, language)}</option>
                                ))}
                            </select>
                        </div>

                        {category === 't7' && (
                            <div className="animate-in slide-in-from-top-2 duration-200">
                                <label htmlFor="customCategory" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center ml-1">
                                    {t('other_category_label', language)}
                                </label>
                                <input
                                    id="customCategory"
                                    type="text"
                                    autoFocus
                                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all text-xs font-bold bg-white shadow-sm"
                                    placeholder={t('t7', language)}
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                />
                            </div>
                        )}
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
                        className={`px-10 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 border-b-4 ${!isFormValid ? 'bg-slate-300 border-slate-400 cursor-not-allowed' : (editingAnnotation ? 'bg-red-600 hover:bg-red-700 border-red-900' : 'bg-slate-900 hover:bg-slate-800 border-slate-700')}`}
                    >
                        {editingAnnotation ? t('push_updates', language) : t('submit', language)}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TextIssueModal;
