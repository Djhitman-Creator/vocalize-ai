/**
 * TabBar Component for Preview Page
 * 
 * Place at: frontend/src/components/preview/TabBar.jsx
 */

import { Clock, Type, Image, Grid3X3, Download } from 'lucide-react';

export const TABS = [
  { id: 'timing', label: 'Timing', icon: Clock, mobileIcon: '🎵' },
  { id: 'style', label: 'Style', icon: Type, mobileIcon: '🎨' },
  { id: 'background', label: 'Background', icon: Image, mobileIcon: '🖼️' },
  { id: 'layout', label: 'Layout', icon: Grid3X3, mobileIcon: '📐' },
  { id: 'export', label: 'Export', icon: Download, mobileIcon: '📤' },
];

export default function TabBar({ activeTab, setActiveTab, isDark }) {
  return (
    <div className={`flex border-b overflow-x-auto scrollbar-hide ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap
            ${activeTab === tab.id 
              ? `border-b-2 border-cyan-500 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}` 
              : isDark 
                ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <tab.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{tab.label}</span>
          {/* Mobile: show emoji only */}
          <span className="sm:hidden text-base">{tab.mobileIcon}</span>
        </button>
      ))}
    </div>
  );
}
