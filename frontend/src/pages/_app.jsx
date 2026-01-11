import '../styles/globals.css';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import dynamic from 'next/dynamic';

// Dynamically import ChatBot with no SSR to prevent hydration issues
const ChatBot = dynamic(() => import('../components/ChatBot'), {
  ssr: false,
  loading: () => null
});

// Wrapper component to safely access theme context
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