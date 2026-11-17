import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/start';
import { createRouter } from './router';

const router = createRouter();

export default function Client() {
  return <StartClient router={router} />;
}

hydrateRoot(document, <StartClient router={router} />);
