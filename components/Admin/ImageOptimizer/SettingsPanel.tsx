'use client';

interface SettingsPanelProps {
  quality: number;
  setQuality: (value: number) => void;
}

export default function SettingsPanel({ quality, setQuality }: SettingsPanelProps) {
  return (
    <div className="mb-8 p-5 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-slate-600/50 transition-colors">
      <div className="flex justify-between items-center mb-4">
        <label className="font-semibold text-slate-300">Качество сжатия (WEBP)</label>
        <span className="text-emerald-400 font-bold bg-emerald-400/10 px-4 py-1.5 rounded-xl border border-emerald-400/20">
          {quality}%
        </span>
      </div>
      <input 
        type="range" 
        min="10" 
        max="100" 
        value={quality}
        onChange={(e) => setQuality(parseInt(e.target.value))}
        className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
      />
    </div>
  );
}