/**
 * LayoutTab Component for Preview Page
 * 
 * Place at: frontend/src/components/preview/LayoutTab.jsx
 * 
 * Handles: Display mode, aspect ratio, lines per screen, timers
 */

import { Monitor, Square, Smartphone } from 'lucide-react';

export default function LayoutTab({ isDark, settings, updateSettings }) {
  const displayModes = [
    { 
      value: 'scroll', 
      label: 'Scroll (Teleprompter)', 
      desc: 'Lines scroll up as song progresses. 3 lines visible: previous, current, next.'
    },
    { 
      value: 'page', 
      label: 'Page', 
      desc: '4 lines per page (configurable). Page flips when all lines complete.'
    },
    { 
      value: 'overwrite', 
      label: 'Overwrite', 
      desc: 'Single line display. Each new line replaces the previous one.'
    },
  ];

  const aspectRatios = [
    { value: '16:9', label: 'Widescreen', icon: Monitor, desc: '16:9 - YouTube, TV' },
    { value: '4:3', label: 'Standard', icon: Square, desc: '4:3 - Classic' },
    { value: '9:16', label: 'Portrait', icon: Smartphone, desc: '9:16 - TikTok, Reels' },
  ];

  return (
    <div className="p-4 space-y-6 max-h-[400px] overflow-y-auto">
      {/* Display Mode */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Display Mode
        </label>
        <div className="space-y-2">
          {displayModes.map(mode => (
            <button
              key={mode.value}
              onClick={() => updateSettings({ displayMode: mode.value })}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                settings.displayMode === mode.value
                  ? 'bg-cyan-500/20 border-2 border-cyan-500'
                  : isDark 
                    ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' 
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {mode.label}
              </div>
              <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {mode.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lines Per Page (only for Page mode) */}
      {settings.displayMode === 'page' && (
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Lines Per Page
          </label>
          <select
            value={settings.linesPerPage || 4}
            onChange={(e) => updateSettings({ linesPerPage: parseInt(e.target.value) })}
            className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border`}
          >
            {[2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n} lines per page</option>
            ))}
          </select>
        </div>
      )}

      {/* Aspect Ratio */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Aspect Ratio
        </label>
        <div className="grid grid-cols-3 gap-2">
          {aspectRatios.map(ratio => (
            <button
              key={ratio.value}
              onClick={() => updateSettings({ aspectRatio: ratio.value })}
              className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${
                settings.aspectRatio === ratio.value
                  ? 'bg-cyan-500 text-white'
                  : isDark 
                    ? 'bg-white/10 text-gray-300 hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ratio.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{ratio.label}</span>
              <span className="text-[10px] opacity-70">{ratio.value}</span>
            </button>
          ))}
        </div>
        <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Portrait mode (9:16) is ideal for TikTok, Instagram Reels, and YouTube Shorts.
        </p>
      </div>

      {/* Timers & Lead-ins */}
      <div>
        <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Timers & Lead-ins
        </label>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showProgressBar !== false}
              onChange={(e) => updateSettings({ showProgressBar: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
            />
            <div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Show progress bar on instrumental breaks
              </span>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Displays a progress bar during long instrumental sections (5+ seconds)
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showCountdown !== false}
              onChange={(e) => updateSettings({ showCountdown: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
            />
            <div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Show countdown before lyrics
              </span>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Animated countdown dots before the first lyrics appear
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showLeadInBars !== false}
              onChange={(e) => updateSettings({ showLeadInBars: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
            />
            <div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Show lead-in sweep bars
              </span>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Animated bar that sweeps in before each line (1-2 seconds before lyrics)
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
