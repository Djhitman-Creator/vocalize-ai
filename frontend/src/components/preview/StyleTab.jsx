/**
 * StyleTab Component for Preview Page
 * 
 * Place at: frontend/src/components/preview/StyleTab.jsx
 * 
 * Handles: Font selection, font size, text colors, duet colors
 * 
 * V11 Updates:
 * - Custom Font moved to top of dropdown
 * - Added many more Google Fonts
 * - Font dropdown shows each font in its own typeface
 * - Custom dropdown component for font preview styling
 */

import { useState, useRef, useEffect } from 'react';
import { Upload, Lock, ChevronDown, Check } from 'lucide-react';

// Available fonts - Custom Font at top, then alphabetical Google Fonts
export const FONT_OPTIONS = [
  // Custom Font (Studio tier only) - AT THE TOP
  { value: 'custom', label: 'Custom Font', family: 'CustomFont, sans-serif', isCustom: true },
  
  // Separator for visual clarity (optional - handled in render)
  
  // Google Fonts - Alphabetical order
  { value: 'abril-fatface', label: 'Abril Fatface', family: '"Abril Fatface", serif' },
  { value: 'alegreya', label: 'Alegreya', family: '"Alegreya", serif' },
  { value: 'anton', label: 'Anton', family: '"Anton", sans-serif' },
  { value: 'archivo-black', label: 'Archivo Black', family: '"Archivo Black", sans-serif' },
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'bangers', label: 'Bangers', family: '"Bangers", cursive' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'bitter', label: 'Bitter', family: '"Bitter", serif' },
  { value: 'black-ops-one', label: 'Black Ops One', family: '"Black Ops One", cursive' },
  { value: 'cabin', label: 'Cabin', family: '"Cabin", sans-serif' },
  { value: 'cinzel', label: 'Cinzel', family: '"Cinzel", serif' },
  { value: 'comfortaa', label: 'Comfortaa', family: '"Comfortaa", cursive' },
  { value: 'concert-one', label: 'Concert One', family: '"Concert One", cursive' },
  { value: 'dancing-script', label: 'Dancing Script', family: '"Dancing Script", cursive' },
  { value: 'dosis', label: 'Dosis', family: '"Dosis", sans-serif' },
  { value: 'exo-2', label: 'Exo 2', family: '"Exo 2", sans-serif' },
  { value: 'fjalla-one', label: 'Fjalla One', family: '"Fjalla One", sans-serif' },
  { value: 'fredoka-one', label: 'Fredoka One', family: '"Fredoka One", cursive' },
  { value: 'graduate', label: 'Graduate', family: '"Graduate", serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
  { value: 'inter', label: 'Inter', family: '"Inter", sans-serif' },
  { value: 'josefin-sans', label: 'Josefin Sans', family: '"Josefin Sans", sans-serif' },
  { value: 'kanit', label: 'Kanit', family: '"Kanit", sans-serif' },
  { value: 'lato', label: 'Lato', family: '"Lato", sans-serif' },
  { value: 'lexend', label: 'Lexend', family: '"Lexend", sans-serif' },
  { value: 'libre-baskerville', label: 'Libre Baskerville', family: '"Libre Baskerville", serif' },
  { value: 'lobster', label: 'Lobster', family: '"Lobster", cursive' },
  { value: 'merriweather', label: 'Merriweather', family: '"Merriweather", serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'nunito', label: 'Nunito', family: '"Nunito", sans-serif' },
  { value: 'open-sans', label: 'Open Sans', family: '"Open Sans", sans-serif' },
  { value: 'orbitron', label: 'Orbitron', family: '"Orbitron", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'pacifico', label: 'Pacifico', family: '"Pacifico", cursive' },
  { value: 'permanent-marker', label: 'Permanent Marker', family: '"Permanent Marker", cursive' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'press-start', label: 'Press Start 2P', family: '"Press Start 2P", cursive' },
  { value: 'quicksand', label: 'Quicksand', family: '"Quicksand", sans-serif' },
  { value: 'rajdhani', label: 'Rajdhani', family: '"Rajdhani", sans-serif' },
  { value: 'raleway', label: 'Raleway', family: '"Raleway", sans-serif' },
  { value: 'righteous', label: 'Righteous', family: '"Righteous", cursive' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'roboto-condensed', label: 'Roboto Condensed', family: '"Roboto Condensed", sans-serif' },
  { value: 'roboto-mono', label: 'Roboto Mono', family: '"Roboto Mono", monospace' },
  { value: 'roboto-slab', label: 'Roboto Slab', family: '"Roboto Slab", serif' },
  { value: 'rubik', label: 'Rubik', family: '"Rubik", sans-serif' },
  { value: 'russo-one', label: 'Russo One', family: '"Russo One", sans-serif' },
  { value: 'satisfy', label: 'Satisfy', family: '"Satisfy", cursive' },
  { value: 'shadows-into-light', label: 'Shadows Into Light', family: '"Shadows Into Light", cursive' },
  { value: 'source-sans-pro', label: 'Source Sans Pro', family: '"Source Sans Pro", sans-serif' },
  { value: 'special-elite', label: 'Special Elite', family: '"Special Elite", cursive' },
  { value: 'teko', label: 'Teko', family: '"Teko", sans-serif' },
  { value: 'titillium-web', label: 'Titillium Web', family: '"Titillium Web", sans-serif' },
  { value: 'ubuntu', label: 'Ubuntu', family: '"Ubuntu", sans-serif' },
  { value: 'vollkorn', label: 'Vollkorn', family: '"Vollkorn", serif' },
  { value: 'work-sans', label: 'Work Sans', family: '"Work Sans", sans-serif' },
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

// Custom Font Dropdown Component - Shows each font in its own typeface
const FontDropdown = ({ value, onChange, isDark, isStudioUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Get current selected font
  const selectedFont = FONT_OPTIONS.find(f => f.value === value) || FONT_OPTIONS[1]; // Default to first non-custom
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (fontValue) => {
    // Don't allow selecting custom font if not Studio user
    const font = FONT_OPTIONS.find(f => f.value === fontValue);
    if (font?.isCustom && !isStudioUser) return;
    
    onChange(fontValue);
    setIsOpen(false);
  };
  
  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected Value Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center justify-between ${
          isDark 
            ? 'bg-white/10 border-white/10 text-white hover:bg-white/15' 
            : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
        } border transition-colors`}
      >
        <span style={{ fontFamily: selectedFont.family }}>
          {selectedFont.label}
          {selectedFont.isCustom && !isStudioUser && ' (Studio)'}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute z-50 w-full mt-1 rounded-lg shadow-xl max-h-64 overflow-y-auto ${
            isDark 
              ? 'bg-gray-800 border border-white/10' 
              : 'bg-white border border-gray-200'
          }`}
        >
          {FONT_OPTIONS.map((font, index) => {
            const isDisabled = font.isCustom && !isStudioUser;
            const isSelected = font.value === value;
            
            return (
              <div key={font.value}>
                {/* Add separator after Custom Font */}
                {index === 1 && (
                  <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'} my-1`} />
                )}
                
                <button
                  type="button"
                  onClick={() => handleSelect(font.value)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                    isDisabled
                      ? isDark 
                        ? 'text-gray-500 cursor-not-allowed' 
                        : 'text-gray-400 cursor-not-allowed'
                      : isSelected
                        ? isDark
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-cyan-50 text-cyan-700'
                        : isDark
                          ? 'text-white hover:bg-white/10'
                          : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  style={{ fontFamily: font.isCustom ? 'inherit' : font.family }}
                >
                  <span className="flex items-center gap-2">
                    {font.label}
                    {font.isCustom && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                      }`}>
                        Studio
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
        
        {/* Custom Font Dropdown with Preview */}
        <FontDropdown
          value={settings.selectedFont}
          onChange={(fontValue) => updateSettings({ selectedFont: fontValue })}
          isDark={isDark}
          isStudioUser={isStudioUser}
        />
        
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