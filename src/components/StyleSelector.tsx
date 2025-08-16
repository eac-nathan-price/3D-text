import React from 'react';
import { ChevronDown } from 'lucide-react';
import { TextStyle } from '../types/Style';

interface StyleSelectorProps {
  styles: TextStyle[];
  selectedStyle: TextStyle;
  onStyleChange: (style: TextStyle) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ 
  styles, 
  selectedStyle, 
  onStyleChange 
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Text Style
      </label>
      <div className="relative">
        <select
          value={selectedStyle.id}
          onChange={(e) => {
            const style = styles.find(s => s.id === e.target.value);
            if (style) onStyleChange(style);
          }}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg 
                     text-white focus:outline-none focus:ring-2 focus:ring-blue-500 
                     focus:border-transparent appearance-none cursor-pointer"
        >
          {styles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 
                                w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
};