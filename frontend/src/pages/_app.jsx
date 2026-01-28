import '../styles/globals.css';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamically import ChatBot with no SSR
const ChatBot = dynamic(() => import('../components/ChatBot'), {
  ssr: false,
  loading: () => null
});

function ChatBotWrapper() {
  const { isDark } = useTheme();
  return <ChatBot isDark={isDark} />;
}

// Google Fonts URL - all fonts used in StyleTab
// This loads all fonts in one request for better performance
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=' + [
  'Abril+Fatface',
  'Alegreya:wght@400;700',
  'Anton',
  'Archivo+Black',
  'Bangers',
  'Bebas+Neue',
  'Bitter:wght@400;700',
  'Black+Ops+One',
  'Cabin:wght@400;700',
  'Cinzel:wght@400;700',
  'Comfortaa:wght@400;700',
  'Concert+One',
  'Dancing+Script:wght@400;700',
  'Dosis:wght@400;700',
  'Exo+2:wght@400;700',
  'Fjalla+One',
  'Fredoka+One',
  'Graduate',
  'Inter:wght@400;700',
  'Josefin+Sans:wght@400;700',
  'Kanit:wght@400;700',
  'Lato:wght@400;700',
  'Lexend:wght@400;700',
  'Libre+Baskerville:wght@400;700',
  'Lobster',
  'Merriweather:wght@400;700',
  'Montserrat:wght@400;700',
  'Nunito:wght@400;700',
  'Open+Sans:wght@400;700',
  'Orbitron:wght@400;700',
  'Oswald:wght@400;700',
  'Pacifico',
  'Permanent+Marker',
  'Playfair+Display:wght@400;700',
  'Poppins:wght@400;700',
  'Press+Start+2P',
  'Quicksand:wght@400;700',
  'Rajdhani:wght@400;700',
  'Raleway:wght@400;700',
  'Righteous',
  'Roboto:wght@400;700',
  'Roboto+Condensed:wght@400;700',
  'Roboto+Mono:wght@400;700',
  'Roboto+Slab:wght@400;700',
  'Rubik:wght@400;700',
  'Russo+One',
  'Satisfy',
  'Shadows+Into+Light',
  'Source+Sans+Pro:wght@400;700',
  'Special+Elite',
  'Teko:wght@400;700',
  'Titillium+Web:wght@400;700',
  'Ubuntu:wght@400;700',
  'Vollkorn:wght@400;700',
  'Work+Sans:wght@400;700'
].join('&family=') + '&display=swap';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      {/* Load Google Fonts */}
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_URL} rel="stylesheet" />
      </Head>
      <Component {...pageProps} />
      <ChatBotWrapper />
    </ThemeProvider>
  );
}