import '../styles/globals.css';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import dynamic from 'next/dynamic';

// Dynamically import ChatBot with no SSR
const ChatBot = dynamic(() => import('../components/ChatBot'), {
  ssr: false,
  loading: () => null
});

function ChatBotWrapper() {
  const { isDark } = useTheme();
  return <ChatBot isDark={isDark} />;
}

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
      <ChatBotWrapper />
    </ThemeProvider>
  );
}