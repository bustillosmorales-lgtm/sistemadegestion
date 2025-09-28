// pages/_app.js
import '../styles/globals.css';
import { UserProvider, useUser } from '../components/UserContext';
import UserSelector from '../components/UserSelector';
import SecurityWrapperSimple from '../components/SecurityWrapperSimple';

function MyApp({ Component, pageProps }) {
  return (
    <SecurityWrapperSimple>
      <UserProvider>
        <ConditionalUserSelector />
        <Component {...pageProps} />
      </UserProvider>
    </SecurityWrapperSimple>
  );
}

function ConditionalUserSelector() {
  const { user } = useUser();

  // Solo mostrar UserSelector si el usuario es admin
  if (user && user.role === 'admin') {
    return <UserSelector />;
  }

  return null;
}

export default MyApp;
