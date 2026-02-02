// ReadinessChecklist Component - Karatrack Studio
//
// A collapsible checklist panel for the preview/edit page.
// Shows completion status of all karaoke video settings.
//
// Features:
// - Auto-detects when settings have been changed from defaults
// - Manual tick/untick capability
// - Red (incomplete) / Green (complete) color coding
// - Each item links to the relevant tab/section
// - Highlight animation when an item is clicked
// - Responsive: works on desktop and mobile

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Circle, ChevronDown, ChevronUp,
  ClipboardCheck, ArrowRight
} from 'lucide-react';

// ============================================================
// CHECKLIST ITEM DEFINITIONS
// Each item maps to a setting and a target tab
// ============================================================
const CHECKLIST_ITEMS = [
  {
    id: 'song-name',
    label: 'Song Name',
    tab: null, // header area, not a tab
    description: 'Set the song title and artist name',
    // Check: trackInfo has non-default values
    check: ({ trackInfo }) => {
      return !!(trackInfo?.songTitle && trackInfo.songTitle.trim() !== '' && trackInfo.songTitle !== 'Untitled');
    },
  },
  {
    id: 'word-alignment',
    label: 'Word Alignment & Rhyme Sync',
    tab: 'timing',
    description: 'Review word-level timing in the timeline',
    // Check: words exist and have been loaded
    check: ({ words }) => {
      return words && words.length > 0;
    },
  },
  {
    id: 'lines-fit',
    label: 'Lines Fit',
    tab: 'timing',
    description: 'Check that all lines fit within the display width',
    // Check: no lines exceed character limits (simplified - just checks words exist)
    check: ({ lyricsLines }) => {
      return lyricsLines && lyricsLines.length > 0;
    },
  },
  {
    id: 'word-timing',
    label: 'Word Timing Adjustment',
    tab: 'timing',
    description: 'Fine-tune individual word start/end times',
    // Manual check - user decides when timing is good
    check: () => false,
    manualOnly: true,
  },
  {
    id: 'font-selection',
    label: 'Font Selection',
    tab: 'style',
    description: 'Choose a font for your lyrics',
    // Check: font has been changed from default
    check: ({ styleSettings }) => {
      return styleSettings?.selectedFont && styleSettings.selectedFont !== 'arial';
    },
  },
  {
    id: 'text-colors',
    label: 'Text Colors',
    tab: 'style',
    description: 'Set text, sung highlight, and outline colors',
    // Check: any color changed from default
    check: ({ styleSettings }) => {
      if (!styleSettings) return false;
      return (
        styleSettings.textColor !== '#ffffff' ||
        styleSettings.sungColor !== '#00d4ff' ||
        styleSettings.outlineColor !== '#000000'
      );
    },
  },
  {
    id: 'show-logo',
    label: 'Show Logo',
    tab: 'style',
    description: 'Upload and position your logo watermark',
    // Check: logo has been uploaded
    check: ({ brandingSettings }) => {
      return !!brandingSettings?.logoUrl;
    },
  },
  {
    id: 'start-image',
    label: 'Start Image',
    tab: 'style',
    description: 'Upload a thumbnail/intro image',
    // Check: start image has been uploaded
    check: ({ brandingSettings }) => {
      return !!brandingSettings?.startImageUrl;
    },
  },
  {
    id: 'outro-message',
    label: 'Outro Message',
    tab: 'style',
    description: 'Set an ending message for your video',
    // Check: outro text has been set
    check: ({ brandingSettings }) => {
      return !!(brandingSettings?.outroText && brandingSettings.outroText.trim() !== '');
    },
  },
  {
    id: 'background',
    label: 'Background Color/Image/Video',
    tab: 'background',
    description: 'Choose your video background',
    // Check: background changed from default gradient
    check: ({ bgSettings }) => {
      if (!bgSettings) return false;
      return (
        bgSettings.bgType !== 'gradient' ||
        bgSettings.bgColor1 !== '#1a1a2e' ||
        bgSettings.bgColor2 !== '#16213e' ||
        bgSettings.bgImageUrl ||
        bgSettings.bgVideoPresetFilename ||
        bgSettings.bgCustomVideoUrl
      );
    },
  },
  {
    id: 'display-mode',
    label: 'Display Mode',
    tab: 'layout',
    description: 'Choose scroll, page, or overwrite mode',
    // Check: display mode has been explicitly reviewed (changed from default or manual)
    check: ({ layoutSettings }) => {
      return layoutSettings?.displayMode && layoutSettings.displayMode !== 'scroll';
    },
  },
  {
    id: 'lines-on-screen',
    label: 'Lines on Screen',
    tab: 'layout',
    description: 'Set how many lyric lines appear at once',
    // Check: lines per page/scroll changed from default
    check: ({ layoutSettings }) => {
      if (!layoutSettings) return false;
      return (
        layoutSettings.linesPerPage !== 4 ||
        layoutSettings.linesPerScroll !== 4 ||
        layoutSettings.linesPerOverwrite !== 4
      );
    },
  },
  {
    id: 'clean-dirty',
    label: 'Clean/Dirty Lyrics',
    tab: 'layout',
    description: 'Toggle profanity filter for clean version',
    // Check: clean version toggle has been changed (on = checked)
    check: ({ layoutSettings }) => {
      return !!layoutSettings?.cleanVersion;
    },
  },
  {
    id: 'timing-animations',
    label: 'Timing Animations',
    tab: 'layout',
    description: 'Configure sweep bars and progress indicators',
    // Check: any animation setting changed
    check: ({ layoutSettings }) => {
      if (!layoutSettings) return false;
      return (
        layoutSettings.emphasizeCurrentLine ||
        !layoutSettings.showProgressBar ||
        !layoutSettings.showLeadInBars
      );
    },
  },
  {
    id: 'export-quality',
    label: 'Export Quality',
    tab: 'export',
    description: 'Set video resolution and audio track',
    // Check: quality changed from default 720p
    check: ({ exportSettings }) => {
      if (!exportSettings) return false;
      return (
        exportSettings.videoQuality !== '720p' ||
        exportSettings.audioTrack !== 'instrumental'
      );
    },
  },
];

// ============================================================
// READINESS CHECKLIST COMPONENT
// ============================================================
export default function ReadinessChecklist({
  isDark,
  trackInfo,
  words,
  styleSettings,
  bgSettings,
  layoutSettings,
  exportSettings,
  brandingSettings,
  lyricsLines,
  setActiveTab,
  checklistHighlight,
  setChecklistHighlight,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Manual overrides: { [itemId]: true/false }
  const [manualChecks, setManualChecks] = useState({});

  // Build the context object for check functions
  const checkContext = {
    trackInfo,
    words,
    styleSettings,
    bgSettings,
    layoutSettings,
    exportSettings,
    brandingSettings,
    lyricsLines,
  };

  // Determine checked state for each item
  const getItemChecked = useCallback((item) => {
    // If user manually set it, use that
    if (manualChecks[item.id] !== undefined) {
      return manualChecks[item.id];
    }
    // Otherwise use auto-detection
    try {
      return item.check(checkContext);
    } catch {
      return false;
    }
  }, [manualChecks, checkContext]);

  // Count completed items
  const completedCount = CHECKLIST_ITEMS.filter(item => getItemChecked(item)).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Toggle manual check
  const toggleItemCheck = (itemId, e) => {
    e.stopPropagation();
    setManualChecks(prev => {
      const current = prev[itemId];
      const autoChecked = CHECKLIST_ITEMS.find(i => i.id === itemId)?.check(checkContext);
      
      if (current === undefined) {
        // First manual toggle: set to opposite of auto
        return { ...prev, [itemId]: !autoChecked };
      } else {
        // Already manually set: toggle
        return { ...prev, [itemId]: !current };
      }
    });
  };

  // Navigate to the relevant tab and highlight
  const handleItemClick = (item) => {
    if (item.tab) {
      setActiveTab(item.tab);
      setChecklistHighlight(item.id);
      
      // Scroll to the tab content area after a brief delay
      setTimeout(() => {
        const tabContent = document.getElementById(`checklist-target-${item.tab}`);
        if (tabContent) {
          tabContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      // Clear highlight after animation
      setTimeout(() => {
        setChecklistHighlight(null);
      }, 2000);
    } else if (item.id === 'song-name') {
      // Song name is in the header - scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setChecklistHighlight(item.id);
      setTimeout(() => setChecklistHighlight(null), 2000);
    }
  };

  // Clear highlight on unmount
  useEffect(() => {
    return () => setChecklistHighlight?.(null);
  }, []);

  const isAllComplete = completedCount === totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className={`rounded-2xl overflow-hidden mb-4 transition-all ${
        isDark
          ? 'bg-white/5 border border-white/10'
          : 'bg-white border border-gray-200'
      }`}
    >
      {/* Collapsed Header Bar - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
          isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${
            isAllComplete
              ? 'bg-green-500/20'
              : 'bg-amber-500/20'
          }`}>
            <ClipboardCheck className={`w-4 h-4 ${
              isAllComplete ? 'text-green-400' : 'text-amber-400'
            }`} />
          </div>
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Readiness Checklist
          </span>
          
          {/* Progress badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isAllComplete
              ? 'bg-green-500/20 text-green-400'
              : completedCount > totalCount / 2
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
          }`}>
            {completedCount}/{totalCount}
          </span>

          {/* Mini progress bar (visible when collapsed) */}
          {!isExpanded && (
            <div className={`hidden sm:flex items-center gap-2 ml-2`}>
              <div className={`w-24 h-1.5 rounded-full overflow-hidden ${
                isDark ? 'bg-white/10' : 'bg-gray-200'
              }`}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    background: isAllComplete
                      ? '#22C55E'
                      : progressPercent > 50
                        ? '#F59E0B'
                        : '#EF4444',
                  }}
                />
              </div>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {progressPercent}%
              </span>
            </div>
          )}
        </div>

        {isExpanded ? (
          <ChevronUp className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        )}
      </button>

      {/* Expanded Checklist */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* Progress bar (full width) */}
            <div className={`mx-4 mb-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full h-2 overflow-hidden`}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  background: isAllComplete
                    ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                    : progressPercent > 50
                      ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                      : 'linear-gradient(90deg, #EF4444, #DC2626)',
                }}
              />
            </div>

            {/* Checklist Items */}
            <div className={`px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5`}>
              {CHECKLIST_ITEMS.map((item) => {
                const isChecked = getItemChecked(item);
                const isHighlighted = checklistHighlight === item.id;

                return (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      isHighlighted
                        ? isDark
                          ? 'bg-cyan-500/20 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,212,228,0.2)]'
                          : 'bg-cyan-50 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,180,200,0.15)]'
                        : isChecked
                          ? isDark
                            ? 'bg-green-500/5 hover:bg-green-500/10'
                            : 'bg-green-50/50 hover:bg-green-50'
                          : isDark
                            ? 'bg-red-500/5 hover:bg-red-500/10'
                            : 'bg-red-50/50 hover:bg-red-50'
                    }`}
                    onClick={() => handleItemClick(item)}
                    title={item.description}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => toggleItemCheck(item.id, e)}
                      className="flex-shrink-0 transition-transform hover:scale-110"
                    >
                      {isChecked ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className={`w-5 h-5 ${
                          isDark ? 'text-red-400/60' : 'text-red-400/70'
                        }`} />
                      )}
                    </button>

                    {/* Label */}
                    <span className={`text-sm flex-1 min-w-0 truncate transition-colors ${
                      isChecked
                        ? isDark
                          ? 'text-green-400'
                          : 'text-green-700'
                        : isDark
                          ? 'text-red-400'
                          : 'text-red-600'
                    }`}>
                      {item.label}
                    </span>

                    {/* Arrow indicator (shows on hover) */}
                    {item.tab && (
                      <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 ${
                        isChecked
                          ? 'text-green-500/50'
                          : isDark
                            ? 'text-red-400/50'
                            : 'text-red-400/60'
                      }`} />
                    )}

                    {/* Highlight pulse animation */}
                    {isHighlighted && (
                      <motion.div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: [0.5, 0, 0.5, 0] }}
                        transition={{ duration: 2, ease: 'easeInOut' }}
                        style={{
                          border: `2px solid ${isDark ? 'rgba(0,212,228,0.5)' : 'rgba(0,180,200,0.4)'}`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className={`px-4 pb-3`}>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                Click any item to jump to that setting. Click the circle to manually mark complete.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
