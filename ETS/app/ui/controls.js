const controlIcons = {
  btnToggleAnim: 'pause', btnToggleCam: 'camera', btnLaneLeft: 'arrow-left',
  btnLaneRight: 'arrow-right', btnWireframe: 'cube', btnSpeed: 'gauge-high',
  btnFloodRestoration: 'droplet', btnSpawnMonster: 'robot', btnTestWin: 'trophy'
};

if (new URLSearchParams(location.search).has('menuCapture')) {
  document.documentElement.classList.add('menu-capture');
}
if (new URLSearchParams(location.search).has('debug')) {
  document.documentElement.classList.add('debug-controls');
}

for (const [id, icon] of Object.entries(controlIcons)) {
  const button = document.getElementById(id);
  if (!button) continue;
  const restoreIcon = () => {
    if (button.querySelector('.ui-icon')) return;
    // Some arena scripts replace the whole button label after an action.
    button.textContent = button.textContent.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
    const symbol = document.createElement('i');
    symbol.className = `ui-icon fa-solid fa-${icon}`;
    symbol.setAttribute('aria-hidden', 'true');
    button.prepend(symbol);
  };
  restoreIcon();
  new MutationObserver(restoreIcon).observe(button, { childList: true });
}
