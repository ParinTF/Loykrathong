import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameShell } from './components/GameShell';
import './styles/festival.css';
import './styles/festival-hud.css';
import './styles/invitation.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameShell />
  </StrictMode>
);
