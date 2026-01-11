import { ThemeProvider, useTheme } from '../context/ThemeContext';
import ChatBot from '../components/ChatBot';
import '../styles/globals.css';

// Wrapper component to access theme
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