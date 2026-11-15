(() => {
  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.style.cssText = [
    'position:fixed', 'z-index:10000', 'top:0', 'left:0', 'right:0',
    'padding:8px 14px', 'text-align:center', 'font:13px Segoe UI, sans-serif',
    'background:#8a3c14', 'color:#fff', 'display:none',
  ].join(';');
  banner.textContent = 'Offline: local data remains available, but NASA map tiles and live feeds require an Internet connection.';

  function update() {
    banner.style.display = navigator.onLine ? 'none' : 'block';
    document.body.style.paddingTop = navigator.onLine ? '' : '34px';
  }

  function install() {
    document.body.appendChild(banner);
    update();
  }

  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
})();
