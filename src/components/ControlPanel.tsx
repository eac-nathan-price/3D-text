import React from 'react';
import { Download, FileText } from 'lucide-react';
import { TextInput } from './TextInput';
import { StyleSelector } from './StyleSelector';
import { StylePreview } from './StylePreview';
import { TextStyle } from '../types/Style';

interface ControlPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  styles: TextStyle[];
  selectedStyle: TextStyle;
  onStyleChange: (style: TextStyle) => void;
  onExport: () => void;
  isExporting: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  text,
  onTextChange,
  styles,
  selectedStyle,
  onStyleChange,
  onExport,
  isExporting
}) => {
  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">3D Text Generator</h1>
            <p className="text-sm text-gray-400">Create printable text models</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <TextInput
          value={text}
          onChange={onTextChange}
          placeholder="Enter your text here..."
        />

        <StyleSelector
          styles={styles}
          selectedStyle={selectedStyle}
          onStyleChange={onStyleChange}
        />

        <StylePreview style={selectedStyle} />
      </div>

      {/* Export Button */}
      <div className="p-6 border-t border-gray-700">
        <button
          onClick={onExport}
          disabled={!text.trim() || isExporting}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 
                     bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                     text-white font-medium rounded-lg transition-colors duration-200
                     disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Exporting...' : 'Download STL'}</span>
        </button>
        <p className="mt-2 text-xs text-gray-400 text-center">
          STL format suitable for 3D printing
        </p>
      </div>
    </div>
  );
};