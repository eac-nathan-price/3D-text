import React from 'react';
import { TextStyle } from '../types/Style';

interface StylePreviewProps {
  style: TextStyle;
}

export const StylePreview: React.FC<StylePreviewProps> = ({ style }) => {
  return (
    <div className="space-y-3 p-4 bg-gray-800 rounded-lg">
      <h3 className="text-sm font-medium text-gray-300">Style Details</h3>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-400">Shape:</span>
          <span className="ml-2 text-white capitalize">{style.backgroundShape}</span>
        </div>
        <div>
          <span className="text-gray-400">Alignment:</span>
          <span className="ml-2 text-white capitalize">{style.textAlign}</span>
        </div>
        <div>
          <span className="text-gray-400">Size:</span>
          <span className="ml-2 text-white">
            {style.boundingBox.width}×{style.boundingBox.height}mm
          </span>
        </div>
        <div>
          <span className="text-gray-400">Depth:</span>
          <span className="ml-2 text-white">{style.textHeight}mm</span>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <div className="flex items-center space-x-2">
          <div 
            className="w-4 h-4 rounded border border-gray-600"
            style={{ backgroundColor: style.textColor }}
          />
          <span className="text-xs text-gray-400">Text</span>
        </div>
        <div className="flex items-center space-x-2">
          <div 
            className="w-4 h-4 rounded border border-gray-600"
            style={{ backgroundColor: style.backgroundColor }}
          />
          <span className="text-xs text-gray-400">Background</span>
        </div>
      </div>
    </div>
  );
};