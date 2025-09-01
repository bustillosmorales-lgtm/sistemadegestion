// pages/_app.js
import '../styles/globals.css';
import { UserProvider } from '../components/UserContext';
import UserSelector from '../components/UserSelector';

function MyApp({ Component, pageProps }) {
  return (
    <UserProvider>
      <UserSelector />
      <Component {...pageProps} />
    </UserProvider>
  );
}

export default MyApp;
