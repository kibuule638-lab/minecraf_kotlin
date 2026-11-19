/**
 * @file ResourcePackModal.tsx
 * Interactive Minecraft Java Resource Pack Loader UI with drag-and-drop zone,
 * file picker, live texture atlas status, pack thumbnail preview, and procedural fallback reset.
 */

import React, { useState } from 'react';
import { TextureManager, ResourcePackInfo } from '../core/textures';
import { AudioManager } from '../core/audio';

interface ResourcePackModalProps {
  onClose: () => void;
}

export const ResourcePackModal: React.FC<ResourcePackModalProps> = ({ onClose }) => {
  const tm = TextureManager.getInstance();
  const [packInfo, setPackInfo] = useState<ResourcePackInfo>(tm.currentPackInfo);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const processZipFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setErrorMsg('Please select a valid .zip resource pack file.');
      return;
    }

    setIsLoading(true);
    setStatusMsg(`Reading ${file.name}... Extracting block & item textures...`);
    setErrorMsg('');

    try {
      const info = await tm.loadResourcePack(file);
      setPackInfo(info);
      setStatusMsg(`Successfully loaded ${info.textureCount} textures at ${info.resolution}x${info.resolution} resolution!`);
      AudioManager.getInstance().playItemPop();
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse resource pack zip.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processZipFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processZipFile(e.target.files[0]);
    }
  };

  const handleResetToProcedural = () => {
    tm.resetToProcedural();
    setPackInfo(tm.currentPackInfo);
    setStatusMsg('Reset to built-in procedural 16x16 pixel-art vanilla textures.');
    AudioManager.getInstance().playClick();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-[#242424] border-4 border-[#4a4a4a] rounded-lg p-5 max-w-xl w-full flex flex-col gap-4 text-white shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/20 pb-3">
          <div>
            <h2 className="text-base font-bold text-amber-300 uppercase tracking-wide">
              Resource Pack Loader
            </h2>
            <p className="text-xs text-white/60">
              Compatible with Minecraft Java .zip packs (e.g. New Default+, Faithful, vanilla)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs bg-red-600/80 hover:bg-red-500 px-3 py-1 rounded font-bold transition-colors"
          >
            Done (Close)
          </button>
        </div>

        {/* Current Active Pack Card */}
        <div className="flex items-center gap-4 bg-[#1a1a1a] p-3 rounded border border-white/10">
          {packInfo.iconDataUrl ? (
            <img
              src={packInfo.iconDataUrl}
              alt="pack icon"
              className="w-16 h-16 rounded border border-white/20 object-cover [image-rendering:pixelated]"
            />
          ) : (
            <div className="w-16 h-16 bg-neutral-800 rounded border border-white/20 flex items-center justify-center text-2xl font-bold text-amber-400">
              MC
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-emerald-400 truncate">{packInfo.name}</h3>
            <p className="text-xs text-white/70 line-clamp-2 my-1">{packInfo.description}</p>
            <div className="text-[11px] text-white/50 flex gap-4">
              <span>Textures: <strong className="text-white">{packInfo.textureCount}</strong></span>
              <span>Resolution: <strong className="text-white">{packInfo.resolution}x{packInfo.resolution}</strong></span>
            </div>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('resource-pack-input')?.click()}
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
            dragOver
              ? 'border-amber-400 bg-amber-400/10 scale-[1.01]'
              : 'border-white/30 hover:border-white/60 bg-[#1c1c1c]'
          }`}
        >
          <input
            id="resource-pack-input"
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileChange}
          />

          <span className="text-3xl">📦</span>
          <p className="text-sm font-bold text-center">
            Drop Minecraft Java Resource Pack (.zip) here
          </p>
          <p className="text-xs text-white/50 text-center">
            or click to browse your computer
          </p>
        </div>

        {/* Status / Loading / Error Messages */}
        {isLoading && (
          <div className="text-xs text-amber-400 font-bold bg-amber-950/40 p-2 rounded border border-amber-500/30 text-center animate-pulse">
            {statusMsg}
          </div>
        )}
        {statusMsg && !isLoading && (
          <div className="text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-500/30 text-center">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="text-xs text-red-400 bg-red-950/40 p-2 rounded border border-red-500/30 text-center">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <button
            onClick={handleResetToProcedural}
            className="text-xs bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 rounded font-bold transition-colors"
          >
            Reset to Procedural Vanilla
          </button>

          <button
            onClick={onClose}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded font-bold transition-colors"
          >
            Apply & Return to Game
          </button>
        </div>
      </div>
    </div>
  );
};
