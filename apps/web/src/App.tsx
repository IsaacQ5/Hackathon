import { ControllerPage } from './pages/ControllerPage';
import { HomePage } from './pages/HomePage';
import { HostPage } from './pages/HostPage';
import { usePathname } from './utils/router';

export function App() {
  const path = usePathname();

  const host = /^\/host\/([a-z]{4})\/?$/i.exec(path);
  if (host) {
    const code = host[1]!.toUpperCase();
    return <HostPage key={code} code={code} />;
  }

  const play = /^\/play\/([a-z]{4})\/?$/i.exec(path);
  if (play) {
    const code = play[1]!.toUpperCase();
    return <ControllerPage key={code} code={code} />;
  }

  return <HomePage />;
}
