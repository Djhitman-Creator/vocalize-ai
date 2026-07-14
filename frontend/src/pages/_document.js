import { Html, Head, Main, NextScript } from 'next/document';

// Custom document so we can set the theme class BEFORE React hydrates.
// This prevents a flash of the wrong theme (FOUC) for users whose saved
// preference differs from the default. Keep the script tiny and dependency-free.
const themeInitScript = `(function(){try{var t=localStorage.getItem('karatrack-theme');var dark=t?t==='dark':true;var c=document.documentElement.classList;if(dark){c.add('dark');}else{c.remove('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
