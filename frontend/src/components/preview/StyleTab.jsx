/**
 * StyleTab Component for Preview Page
 * 
 * Place at: frontend/src/components/preview/StyleTab.jsx
 * 
 * Handles: Font selection, font size, text colors, duet colors
 */

import { Upload, Lock } from 'lucide-react';

// Available fonts
export const FONT_OPTIONS = [
  { value: 'custom', label: 'Custom Font', family: 'CustomFont, sans-serif', isCustom: true },
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
];

// Font size options
export const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small', scale: 0.85 },
  { value: 'normal', label: 'Normal', scale: 1.0 },
  { value: 'large', label: 'Large', scale: 1.15 },
  { value: 'xlarge', label: 'X-Large', scale: 1.3 },
];

// Color Picker sub-component
const ColorPicker = ({ label, value, onChange, isDark }) => (
  <div>
    <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
      {label}
    </label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded cursor-pointer border-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 px-2 py-1 text-xs rounded ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}
      />
    </div>
  </div>
);

export default function StyleTab({ 
  isDark, 
  settings, 
  updateSettings, 
  profile,
  customFontUrl,
  onCustomFontUpload 
}) {
  const tier = profile?.subscription_tier?.toLowerCase() || 'free';
  const isStudioUser = tier === 'studio';
  
  return (
    <div className="p-4 space-y-6 max-h-[400px] overflow-y-auto">
      {/* Font Selection */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Font
        </label>
        <select
          value={settings.selectedFont}
          onChange={(e) => updateSettings({ selectedFont: e.target.value })}
          className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border`}
        >
          {FONT_OPTIONS.map(font => (
            <option key={font.value} value={font.value} disabled={font.isCustom && !isStudioUser}>
              {font.label} {font.isCustom && !isStudioUser ? '(Studio)' : ''}
            </option>
          ))}
        </select>
        
        {/* Custom Font Upload for Studio users */}
        {isStudioUser && settings.selectedFont === 'custom' && (
          <div className="mt-2">
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={onCustomFontUpload}
              className="hidden"
              id="custom-font-upload"
            />
            <label
              htmlFor="custom-font-upload"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'}`}
            >
              <Upload className="w-4 h-4" />
              {customFontUrl ? 'Change Font' : 'Upload Font'}
            </label>
            {customFontUrl && (
              <span className={`ml-2 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                ✓ Font uploaded
              </span>
            )}
          </div>
        )}
      </div>

      {/* Font Size */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Font Size
        </label>
        <div className="flex gap-2">
          {FONT_SIZE_OPTIONS.map(size => (
            <button
              key={size.value}
              onClick={() => updateSettings({ fontSize: size.value })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                settings.fontSize === size.value
                  ? 'bg-cyan-500 text-white'
                  : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Colors
        </label>
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker
            label="Text (unsung)"
            value={settings.textColor}
            onChange={(v) => updateSettings({ textColor: v })}
            isDark={isDark}
          />
          <ColorPicker
            label="Effect/Highlight"
            value={settings.sungColor}
            onChange={(v) => updateSettings({ sungColor: v })}
            isDark={isDark}
          />
          <ColorPicker
            label="Outline"
            value={settings.outlineColor}
            onChange={(v) => updateSettings({ outlineColor: v })}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Duet Mode Colors */}
      {settings.isDuetMode && (
        <div>
          <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Duet Mode Colors
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Singer 1</label>
              <input
                type="color"
                value={settings.duetColors?.singer1 || '#00FFFF'}
                onChange={(e) => updateSettings({ 
                  duetColors: { ...settings.duetColors, singer1: e.target.value } 
                })}
                className="w-full h-10 rounded cursor-pointer border-0"
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Singer 2</label>
              <input
                type="color"
                value={settings.duetColors?.singer2 || '#FF69B4'}
                onChange={(e) => updateSettings({ 
                  duetColors: { ...settings.duetColors, singer2: e.target.value } 
                })}
                className="w-full h-10 rounded cursor-pointer border-0"
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Both</label>
              <input
                type="color"
                value={settings.duetColors?.both || '#FFD700'}
                onChange={(e) => updateSettings({ 
                  duetColors: { ...settings.duetColors, both: e.target.value } 
                })}
                className="w-full h-10 rounded cursor-pointer border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
