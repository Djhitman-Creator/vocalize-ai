'use client';

import { useRouter } from 'next/router';
import { useTheme } from '../context/ThemeContext';

// Only list languages that have translation files in public/locales and are
// enabled in next-i18next.config.js. Add more here once their JSON files exist.
const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export default function LanguageSwitcher({ compact = false }) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { pathname, asPath, query, locale } = router;

  const changeLanguage = (newLocale) => {
    router.push({ pathname, query }, asPath, { locale: newLocale });
  };

  const currentLang = languages.find(l => l.code === locale) || languages[0];

  if (compact) {
    return (
      <select
        value={locale}
        onChange={(e) => changeLanguage(e.target.value)}
        className={`px-2 py-1 rounded-lg text-sm cursor-pointer border-0 outline-none ${
          isDark 
            ? 'bg-white/10 text-white hover:bg-white/20' 
            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        } transition-colors`}
        aria-label="Select language"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-gray-800 text-white">
            {lang.flag} {lang.code.toUpperCase()}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      value={locale}
      onChange={(e) => changeLanguage(e.target.value)}
      className={`px-3 py-2 rounded-lg text-sm cursor-pointer border-0 outline-none ${
        isDark 
          ? 'bg-white/10 text-white hover:bg-white/20' 
          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
      } transition-colors`}
      aria-label="Select language"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code} className="bg-gray-800 text-white">
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}

