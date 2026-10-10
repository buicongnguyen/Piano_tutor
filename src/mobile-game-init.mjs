import { installMobileGameSupport } from './mobile-game-support.mjs';
installMobileGameSupport({
  "menus": [
    ".title-links",
    ".pause-screen",
    ".settings-grid"
  ],
  "controls": [
    ".keyboard-controls",
    ".touch-controls"
  ]
});
