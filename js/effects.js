/* ============================================
   effects.js — Toast、特效、图片处理
   ============================================ */

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function triggerConfetti(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const container = document.getElementById('confettiContainer');
  const colors = ['#6366F1','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4'];

  for (let i = 0; i < 35; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 90;
    particle.style.cssText = `
      left: ${cx}px; top: ${cy}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      --dx: ${Math.cos(angle) * dist}px;
      --dy: ${Math.sin(angle) * dist - 30}px;
      --rot: ${(Math.random() - 0.5) * 720}deg;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }
}

function updateCameraButton() {
  const btn = document.getElementById('btnCamera');
  const previewBox = document.getElementById('imgPreviewBox');
  const previewImg = document.getElementById('imgPreview');
  if (pendingImage) {
    btn.classList.add('has-image');
    btn.textContent = '🖼';
    previewBox.style.display = 'flex';
    previewImg.src = pendingImage;
  } else {
    btn.classList.remove('has-image');
    btn.textContent = '📷';
    previewBox.style.display = 'none';
    previewImg.src = '';
  }
}

function handleImageSelect(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    const img = new Image();
    img.onload = function() {
      const maxW = 200;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      pendingImage = canvas.toDataURL('image/jpeg', 0.5);
      updateCameraButton();
      showToast('截图已添加 ✓');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function showImagePreview(src) {
  const overlay = document.createElement('div');
  overlay.className = 'img-preview-overlay';
  overlay.innerHTML = `<img src="${escapeHtml(src)}" alt="截图">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function clearPendingConfirm() {
  if (pendingConfirmId) {
    const prev = document.querySelector(`.todo-check[data-id="${pendingConfirmId}"]`);
    if (prev) prev.classList.remove('confirming');
    const hint = document.querySelector('.todo-confirm-hint');
    if (hint) hint.remove();
    pendingConfirmId = null;
    clearTimeout(pendingConfirmTimer);
  }
}
