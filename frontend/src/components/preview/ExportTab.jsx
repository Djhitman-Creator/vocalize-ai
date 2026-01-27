/**
 * ExportTab Component for Preview Page
 * 
 * Place at: frontend/src/components/preview/ExportTab.jsx
 * 
 * Handles: Audio track selection, video quality, watermark, render button
 */

import { Upload, Lock, Music, Mic, MicOff } from 'lucide-react';

export default function ExportTab({ 
  isDark, 
  settings, 
  updateSettings, 
  profile,
  onWatermarkUpload,
  onRender,
  saving 
}) {
  const tier = profile?.subscription_tier?.toLowerCase() || 'free';
  const isStudioUser = tier === 'studio';
  const isPro = tier === 'pro' || tier === 'studio';
  
  const audioTracks = [
    { 
      value: 'remove_vocals', 
      label: 'Remove All Vocals', 
      desc: 'Karaoke mode - sing along!',
      icon: MicOff
    },
    { 
      value: 'guide_vocals', 
      label: 'Guide Vocals', 
      desc: 'Soft vocals to help you stay on track',
      icon: Mic
    },
    { 
      value: 'keep_vocals', 
      label: 'Keep Original Vocals', 
      desc: 'Lyric video style - full original audio',
      icon: Music
    },
  ];

  const qualityOptions = [
    { value: '480p', label: '480p', desc: 'SD - Fast render', available: true },
    { value: '720p', label: '720p', desc: 'HD - Recommended', available: true },
    { value: '1080p', label: '1080p', desc: 'Full HD', available: isPro },
    { value: '4k', label: '4K', desc: 'Ultra HD', available: isStudioUser },
  ];

  return (
    <div className="p-4 space-y-6 max-h-[400px] overflow-y-auto">
      {/* Audio Track Selection */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Audio Track
        </label>
        <div className="space-y-2">
          {audioTracks.map(track => (
            <button
              key={track.value}
              onClick={() => updateSettings({ processingType: track.value })}
              className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                settings.processingType === track.value
                  ? 'bg-cyan-500/20 border-2 border-cyan-500'
                  : isDark 
                    ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' 
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                settings.processingType === track.value
                  ? 'bg-cyan-500 text-white'
                  : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-500'
              }`}>
                <track.icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {track.label}
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {track.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Video Quality */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Video Quality
        </label>
        <div className="grid grid-cols-2 gap-2">
          {qualityOptions.map(quality => (
            <button
              key={quality.value}
              onClick={() => quality.available && updateSettings({ videoQuality: quality.value })}
              disabled={!quality.available}
              className={`p-3 rounded-lg text-left transition-all ${
                settings.videoQuality === quality.value
                  ? 'bg-cyan-500 text-white'
                  : !quality.available
                    ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : isDark 
                      ? 'bg-white/10 text-gray-300 hover:bg-white/20' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-base">{quality.label}</span>
                {!quality.available && <Lock className="w-3 h-3" />}
              </div>
              <div className={`text-xs ${settings.videoQuality === quality.value ? 'text-white/80' : 'opacity-70'}`}>
                {quality.desc}
                {!quality.available && (
                  <span className="ml-1">
                    ({quality.value === '1080p' ? 'Pro+' : 'Studio'})
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Watermark (Studio only) */}
      {isStudioUser && (
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Custom Watermark
          </label>
          {settings.watermarkPreview ? (
            <div className="flex items-center gap-4">
              <img 
                src={settings.watermarkPreview} 
                alt="Watermark" 
                className="h-12 object-contain rounded border border-white/10" 
              />
              <div className="flex-1">
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Your logo will appear in the corner of the video
                </p>
                <button
                  onClick={() => updateSettings({ customWatermark: null, watermarkPreview: null })}
                  className="text-red-400 hover:text-red-300 text-xs mt-1"
                >
                  Remove watermark
                </button>
              </div>
            </div>
          ) : (
            <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDark ? 'border-white/20 hover:border-white/40 hover:bg-white/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>
              <Upload className="w-4 h-4 text-gray-400" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload Logo (PNG with transparency)
              </span>
              <input 
                type="file" 
                accept="image/png" 
                onChange={onWatermarkUpload} 
                className="hidden" 
              />
            </label>
          )}
        </div>
      )}

      {/* Credits Info */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Render Cost
          </span>
          <span className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
            1 credit
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Your Balance
          </span>
          <span className={`font-bold text-lg ${
            (profile?.credits || 0) > 0 ? 'text-cyan-400' : 'text-red-400'
          }`}>
            {profile?.credits || 0} credits
          </span>
        </div>
        
        {(profile?.credits || 0) === 0 && (
          <div className={`mt-3 p-2 rounded text-center text-sm ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
            You need credits to render. <a href="/pricing" className="underline">Get more credits</a>
          </div>
        )}
      </div>

      {/* Render Info */}
      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <p>• Rendering typically takes 2-5 minutes depending on video length</p>
        <p>• You'll be notified when your video is ready</p>
        <p>• Videos are available for download from your dashboard</p>
      </div>
    </div>
  );
}
