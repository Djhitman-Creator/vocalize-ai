import '../styles/globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { appWithTranslation } from 'next-i18next';

function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default appWithTranslation(App);