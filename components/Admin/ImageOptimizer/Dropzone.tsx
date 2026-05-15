'use client';

import { useState, useRef, DragEvent, ChangeEvent, Dispatch, SetStateAction } from 'react';
import { formatSize } from '@/lib/imageOptimizer';

interface DropzoneProps {
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
}

export default function Dropzone({ files, setFiles }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div>
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-10 sm:p-16 text-center cursor-pointer transition-all duration-300 ease-out flex flex-col items-center justify-center gap-5
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
            : 'border-slate-600 hover:border-slate-400 hover:bg-slate-800/40'}`}
      >
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
        <div className="text-7xl drop-shadow-lg transition-transform duration-300 hover:scale-110">📦</div>
        <div>
          <p className="text-2xl font-bold text-slate-100">Перетащи картинки сюда</p>
          <p className="text-slate-400 mt-2 font-medium">или кликни, чтобы выбрать исходники</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-lg font-bold text-slate-200">
              Выбрано файлов
            </h3>
            <span className="bg-slate-700 text-slate-200 py-1 px-3 rounded-full text-sm font-bold">
              {files.length} шт.
            </span>
          </div>
          
          <div className="max-h-[280px] overflow-y-auto space-y-2.5 pr-3 custom-scrollbar">
            {files.map((file, index) => (
              <div key={index} className="flex justify-between items-center bg-slate-950/50 p-4 rounded-xl border border-slate-700/60 hover:border-slate-500/60 transition-colors group">
                <span className="truncate max-w-[50%] sm:max-w-[65%] text-slate-300 font-medium">
                  {file.name}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 text-sm font-mono">{formatSize(file.size)}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                    className="text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 transition-all opacity-100 sm:opacity-50 sm:group-hover:opacity-100"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}