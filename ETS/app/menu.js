const selection = document.getElementById('arenaSelection');
const start = document.getElementById('startGame');
const dialog = document.getElementById('howToDialog');

function showArenas() {
  selection.hidden = false;
  document.body.classList.add('arena-open');
  requestAnimationFrame(() => selection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

start.addEventListener('click', showArenas);
document.getElementById('showHowTo').addEventListener('click', () => dialog.showModal());
document.getElementById('closeHowTo').addEventListener('click', () => dialog.close());
document.getElementById('closeHowToBottom').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

if (new URLSearchParams(location.search).has('select')) {
  selection.hidden = false;
  document.body.classList.add('arena-open', 'selection-only');
}
