import { X } from"lucide-react";
import { useEffect, useRef, useState } from"react";

export interface DialogProps {
 isOpen: boolean;
 onClose: () => void;
 title: string;
 message?: string;
 children?: React.ReactNode;
 type?:"alert" |"confirm" |"input";
 confirmText?: string;
 cancelText?: string;
 onConfirm?: (value?: string) => void | Promise<void>;
 isLoading?: boolean;
 variant?:"default" |"danger";
 defaultValue?: string;
 placeholder?: string;
}

export function Dialog({
 isOpen,
 onClose,
 title,
 message,
 children,
 type ="alert",
 confirmText ="OK",
 cancelText ="Cancel",
 onConfirm,
 isLoading = false,
 variant ="default",
 defaultValue ="",
 placeholder ="",
}: DialogProps) {
 const [localIsLoading, setLocalIsLoading] = useState(false);
 const [inputValue, setInputValue] = useState(defaultValue);
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (isOpen) {
 setInputValue(defaultValue);
 if (type ==="input") {
 setTimeout(() => inputRef.current?.focus(), 100);
 }
 }
 }, [isOpen, defaultValue, type]);

 if (!isOpen) return null;

 const handleConfirm = async () => {
 setLocalIsLoading(true);
 try {
 if (type ==="input") {
 if (onConfirm) await onConfirm(inputValue);
 } else {
 if (onConfirm) await onConfirm();
 }
 } catch (error) {
 console.error(error);
 } finally {
 setLocalIsLoading(false);
 }

 if (type ==='alert' && !onConfirm) {
 onClose();
 }
 };

 const isBusy = isLoading || localIsLoading;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-gray-100">
 <div
 className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
 role="dialog"
 aria-modal="true"
 >
 <div className="flex items-center justify-between p-4 border-b border-gray-700">
 <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
 <button
 onClick={onClose}
 className="text-gray-400 hover:text-white"
 disabled={isBusy}
 >
 <X size={20} />
 </button>
 </div>

 <div className="p-6">
 {message && <p className="text-gray-300 mb-4">{message}</p>}
 {children}

 {type ==="input" && (
 <input
 ref={inputRef}
 type="text"
 value={inputValue}
 onChange={(e) => setInputValue(e.target.value)}
 placeholder={placeholder}
 className="w-full p-2 rounded-lg bg-gray-900 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 disabled={isBusy}
 onKeyDown={(e) => {
 if (e.key ==="Enter" && !isBusy) handleConfirm();
 if (e.key ==="Escape" && !isBusy) onClose();
 }}
 />
 )}
 </div>

 <div className="flex items-center justify-end gap-3 p-4 bg-gray-800/50 border-t border-gray-700">
 {type !=="alert" && (
 <button
 onClick={onClose}
 className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg text-sm font-medium"
 disabled={isBusy}
 >
 {cancelText}
 </button>
 )}

 <button
 onClick={handleConfirm}
 disabled={isBusy || (type ==="input" && !inputValue.trim())}
 className={`px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2
 ${variant ==="danger"
 ?"bg-red-600 hover:bg-red-700"
 :"bg-blue-600 hover:bg-blue-700"
 }
 ${isBusy || (type ==="input" && !inputValue.trim()) ?"opacity-50 cursor-not-allowed" :""}
`}
 >
 {isBusy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
 {confirmText}
 </button>
 </div>
 </div>
 </div>
 );
}
