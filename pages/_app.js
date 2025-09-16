// pages/_app.js
import '../styles/globals.css';
import { UserProvider, useUser } from '../components/UserContext';
import UserSelector from '../components/UserSelector';

function MyApp({ Component, pageProps }) {
  return (
    <UserProvider>
      <ConditionalUserSelector />
      <Component {...pageProps} />
    </UserProvider>
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
