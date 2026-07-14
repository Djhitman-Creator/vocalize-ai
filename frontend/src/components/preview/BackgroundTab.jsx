/**
 * BackgroundTab Component for Preview Page
 * 
 * Place at: frontend/src/components/preview/BackgroundTab.jsx
 * 
 * Handles: Background type selection, colors, gradients, images, video presets
 */

import { useState } from 'react';
import { Palette, Sparkles, Image, Video, X, Check, Upload, Lock } from 'lucide-react';

// Video background categories
export const VIDEO_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'nature', label: 'Nature' },
  { id: 'space', label: 'Space' },
  { id: '80s', label: '80s/Retro' },
  { id: 'western', label: 'Western' },
];

// Preset video backgrounds
export const PRESET_VIDEO_BACKGROUNDS = [
  // Abstract
  { id: 'abstract-smokecurling', name: 'Smoke Curling', filename: 'bg-abstract-smokecurling.mp4', category: 'abstract' },
  { id: 'abstract-gradientpinklavenderblue', name: 'Pink Lavender Blue', filename: 'bg-abstract-gradientpinklavenderblue.mp4', category: 'abstract' },
  { id: 'abstract-flowinggradient', name: 'Flowing Gradient', filename: 'bg-abstract-flowinggradient.mp4', category: 'abstract' },
  { id: 'abstract-iridescencesoapbubble', name: 'Soap Bubble', filename: 'bg-abstract-iridescencesoapbubble.mp4', category: 'abstract' },
  { id: 'abstract-fiberoptics', name: 'Fiber Optics', filename: 'bg-abstract-fiberoptics.mp4', category: 'abstract' },
  { id: 'abstract-geometricshapes', name: 'Geometric Shapes', filename: 'bg-abstract-geometricshapes.mp4', category: 'abstract' },
  { id: 'abstract-inkinwater', name: 'Ink in Water', filename: 'bg-abstract-inkinwater.mp4', category: 'abstract' },
  { id: 'abstract-liquidchrome', name: 'Liquid Chrome', filename: 'bg-abstract-liquidchrome.mp4', category: 'abstract' },
  { id: 'abstract-liquidglass', name: 'Liquid Glass', filename: 'bg-abstract-liquidglass.mp4', category: 'abstract' },
  { id: 'abstract-neonlightwaves', name: 'Neon Light Waves', filename: 'bg-abstract-neonlightwaves.mp4', category: 'abstract' },
  { id: 'abstract-neonrings', name: 'Neon Rings', filename: 'bg-abstract-neonrings.mp4', category: 'abstract' },
  { id: 'abstract-neontriangletunnel', name: 'Neon Triangle Tunnel', filename: 'bg-abstract-neontriangletunnel.mp4', category: 'abstract' },
  { id: 'abstract-prismlight', name: 'Prism Light', filename: 'bg-abstract-prismlight.mp4', category: 'abstract' },
  { id: 'abstract-smoketwist', name: 'Smoke Twist', filename: 'bg-abstract-smoketwist.mp4', category: 'abstract' },
  // Elegant
  { id: 'elegant-bokehlights', name: 'Bokeh Lights', filename: 'bg-elegant-bokehlights.mp4', category: 'elegant' },
  { id: 'elegant-goldendust', name: 'Golden Dust', filename: 'bg-elegant-goldendust.mp4', category: 'elegant' },
  { id: 'elegant-orbs', name: 'Floating Orbs', filename: 'bg-elegant-orbs.mp4', category: 'elegant' },
  { id: 'elegant-redsilkflowing', name: 'Red Silk Flowing', filename: 'bg-elegant-redsilkflowing.mp4', category: 'elegant' },
  // Nature
  { id: 'nature-nightsnow', name: 'Night Snow', filename: 'bg-nature-nightsnow.mp4', category: 'nature' },
  { id: 'nature-watercolorclouds', name: 'Watercolor Clouds', filename: 'bg-nature-watercolorclouds.mp4', category: 'nature' },
  { id: 'nature-pool', name: 'Pool Water', filename: 'bg-nature-pool.mp4', category: 'nature' },
  { id: 'nature-oceandepths', name: 'Ocean Depths', filename: 'bg-nature-oceandepths.mp4', category: 'nature' },
  { id: 'nature-aurora1', name: 'Northern Lights', filename: 'bg-nature-aurora1.mp4', category: 'nature' },
  { id: 'nature-cherryblossum', name: 'Cherry Blossom', filename: 'bg-nature-cherryblossum.mp4', category: 'nature' },
  { id: 'nature-fireflies', name: 'Fireflies', filename: 'bg-nature-fireflies.mp4', category: 'nature' },
  { id: 'nature-jellyfish', name: 'Jellyfish', filename: 'bg-nature-jellyfish.mp4', category: 'nature' },
  { id: 'nature-lightning', name: 'Lightning', filename: 'bg-nature-lightning.mp4', category: 'nature' },
  { id: 'nature-rainonwater', name: 'Rain on Water', filename: 'bg-nature-rainonwater.mp4', category: 'nature' },
  // Space
  { id: 'space-milkyway', name: 'Milky Way', filename: 'bg-space-milkyway.mp4', category: 'space' },
  { id: 'space-nebula1', name: 'Nebula 1', filename: 'bg-space-nebula1.mp4', category: 'space' },
  { id: 'space-nebula2', name: 'Nebula 2', filename: 'bg-space-nebula2.mp4', category: 'space' },
  { id: 'space-nebulaclouds1', name: 'Nebula Clouds', filename: 'bg-space-nebulaclouds1.mp4', category: 'space' },
  { id: 'space-saturn', name: 'Saturn', filename: 'bg-space-saturn.mp4', category: 'space' },
  { id: 'space-asteroidfield', name: 'Asteroid Field', filename: 'bg-space-asteroidfield.mp4', category: 'space' },
  { id: 'space-blackhole', name: 'Black Hole', filename: 'bg-space-blackhole.mp4', category: 'space' },
  { id: 'space-starfield', name: 'Star Field', filename: 'bg-space-starfield.mp4', category: 'space' },
  // 80s/Retro
  { id: '80s-gridpurple', name: 'Grid Purple', filename: 'bg-80s-gridpurple.mp4', category: '80s' },
  { id: '80s-neonpalms', name: 'Neon Palms', filename: 'bg-80s-neonpalms.mp4', category: '80s' },
  { id: '80s-retrowave', name: 'Retrowave', filename: 'bg-80s-retrowave.mp4', category: '80s' },
  { id: '80s-synthsun', name: 'Synth Sun', filename: 'bg-80s-synthsun.mp4', category: '80s' },
  // Western
  { id: 'western-desert', name: 'Desert', filename: 'bg-western-desert.mp4', category: 'western' },
  { id: 'western-sunset', name: 'Sunset', filename: 'bg-western-sunset.mp4', category: 'western' },
];

const PRESET_BASE_URL = process.env.NEXT_PUBLIC_PRESET_VIDEOS_URL || 'https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/presets';

export default function BackgroundTab({ 
  isDark, 
  settings, 
  updateSettings, 
  profile,
  onImageUpload,
  onVideoUpload 
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  // V15/V16 universal-credit model: video backgrounds and custom uploads are
  // available to everyone, not gated by tier.
  const isStudioUser = true;
  const isPaidUser = true;
  
  const filteredPresets = selectedCategory === 'all' 
    ? PRESET_VIDEO_BACKGROUNDS 
    : PRESET_VIDEO_BACKGROUNDS.filter(p => p.category === selectedCategory);

  const backgroundTypes = [
    { value: 'color', label: 'Color', icon: Palette },
    { value: 'gradient', label: 'Gradient', icon: Sparkles },
    { value: 'image', label: 'Image', icon: Image },
    { value: 'video', label: 'Video', icon: Video, requiresPaid: true },
  ];

  return (
    <div className="p-4 space-y-6 max-h-[400px] overflow-y-auto">
      {/* Background Type */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Background Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {backgroundTypes.map(type => (
            <button
              key={type.value}
              onClick={() => updateSettings({ bgType: type.value })}
              disabled={type.requiresPaid && !isPaidUser}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                settings.bgType === type.value
                  ? 'bg-cyan-500 text-white'
                  : type.requiresPaid && !isPaidUser
                    ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <type.icon className="w-4 h-4" />
              <span>{type.label}</span>
              {type.requiresPaid && !isPaidUser && <Lock className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Color Settings */}
      {settings.bgType === 'color' && (
        <div>
          <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Background Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.bgColor1}
              onChange={(e) => updateSettings({ bgColor1: e.target.value })}
              className="w-16 h-16 rounded-lg cursor-pointer border-0"
            />
            <input
              type="text"
              value={settings.bgColor1}
              onChange={(e) => updateSettings({ bgColor1: e.target.value })}
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}
            />
          </div>
        </div>
      )}

      {/* Gradient Settings */}
      {settings.bgType === 'gradient' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Color 1</label>
              <input
                type="color"
                value={settings.bgColor1}
                onChange={(e) => updateSettings({ bgColor1: e.target.value })}
                className="w-full h-12 rounded cursor-pointer border-0"
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Color 2</label>
              <input
                type="color"
                value={settings.bgColor2}
                onChange={(e) => updateSettings({ bgColor2: e.target.value })}
                className="w-full h-12 rounded cursor-pointer border-0"
              />
            </div>
          </div>
          
          <div>
            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Direction</label>
            <select
              value={settings.gradientDirection}
              onChange={(e) => updateSettings({ gradientDirection: e.target.value })}
              className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border`}
            >
              <option value="to bottom">↓ Top to Bottom</option>
              <option value="to top">↑ Bottom to Top</option>
              <option value="to right">→ Left to Right</option>
              <option value="to left">← Right to Left</option>
              <option value="to bottom right">↘ Diagonal</option>
              <option value="to bottom left">↙ Diagonal</option>
            </select>
          </div>

          {/* Gradient Preview */}
          <div 
            className="h-16 rounded-lg border"
            style={{ 
              background: `linear-gradient(${settings.gradientDirection}, ${settings.bgColor1}, ${settings.bgColor2})`,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
            }}
          />
        </div>
      )}

      {/* Image Upload */}
      {settings.bgType === 'image' && (
        <div>
          <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Background Image
          </label>
          {settings.bgImagePreview ? (
            <div className="relative">
              <img 
                src={settings.bgImagePreview} 
                alt="Background" 
                className="w-full h-32 object-cover rounded-lg" 
              />
              <button
                onClick={() => updateSettings({ bgImage: null, bgImagePreview: null })}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDark ? 'border-white/20 hover:border-white/40 hover:bg-white/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>
              <Image className="w-8 h-8 text-gray-400 mb-2" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Click to upload image</span>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>JPG, PNG up to 5MB</span>
              <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
            </label>
          )}
        </div>
      )}

      {/* Video Presets */}
      {settings.bgType === 'video' && isPaidUser && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {VIDEO_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-white'
                    : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredPresets.map(preset => (
              <button
                key={preset.id}
                onClick={() => updateSettings({ 
                  bgVideoPreset: preset, 
                  bgVideoPresetFilename: preset.filename 
                })}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                  settings.bgVideoPreset?.id === preset.id
                    ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                    : 'border-transparent hover:border-white/30'
                }`}
              >
                <img
                  src={`${PRESET_BASE_URL}/${preset.filename.replace('.mp4', '.jpg')}`}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { 
                    e.target.style.display = 'none';
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                  <p className="text-[10px] text-white truncate">{preset.name}</p>
                </div>
                {settings.bgVideoPreset?.id === preset.id && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom Video Upload (Studio only) */}
          {isStudioUser && (
            <div>
              <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Or Upload Custom Video
              </label>
              <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDark ? 'border-white/20 hover:border-white/40 hover:bg-white/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>
                <Upload className="w-4 h-4 text-gray-400" />
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Upload Video (MP4, max 50MB)</span>
                <input type="file" accept="video/mp4" onChange={onVideoUpload} className="hidden" />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Upgrade prompt for free users trying to use video */}
      {settings.bgType === 'video' && !isPaidUser && (
        <div className={`p-4 rounded-lg text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <Lock className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
          <p className={`text-sm font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
            Video backgrounds require a paid subscription
          </p>
          <a 
            href="/pricing" 
            className="inline-block mt-2 px-4 py-2 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600 transition-colors"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  );
}
