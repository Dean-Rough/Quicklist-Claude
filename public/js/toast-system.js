// Toast System V2 - Fixed overlapping, better styling, icon-based
class ToastManager {
  constructor() {
    this.queue = [];
    this.activeToast = null;
    this.recentToasts = new Map(); // Debounce similar messages
    this.isProcessing = false;
  }

  showToast(message, type = 'info') {
    // Debounce duplicate messages within 2 seconds
    const key = `${type}:${message}`;
    const now = Date.now();
    const recent = this.recentToasts.get(key);

    if (recent && now - recent < 2000) {
      return; // Skip duplicate toast
    }

    this.recentToasts.set(key, now);

    // Clean up old entries
    if (this.recentToasts.size > 20) {
      const oldest = Array.from(this.recentToasts.entries()).sort((a, b) => a[1] - b[1])[0];
      this.recentToasts.delete(oldest[0]);
    }

    // Add to queue
    this.queue.push({ message, type });
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { message, type } = this.queue.shift();

    // Remove existing toast if any
    if (this.activeToast) {
      await this.hideToast(this.activeToast);
    }

    // Create and show new toast
    this.activeToast = this.createToast(message, type);
    document.body.appendChild(this.activeToast);

    // Trigger animation
    requestAnimationFrame(() => {
      this.activeToast.classList.add('show');
    });

    // Auto-remove after delay
    const delay = type === 'error' ? 6000 : 4000;
    setTimeout(async () => {
      await this.hideToast(this.activeToast);
      this.activeToast = null;
      this.isProcessing = false;
      this.processQueue(); // Process next in queue
    }, delay);
  }

  async hideToast(toast) {
    if (!toast) return;

    toast.classList.remove('show');
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }

  createToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `qk-toast qk-toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const icon = this.getIcon(type);

    toast.innerHTML = `
      <div class="qk-toast-icon">${icon}</div>
      <div class="qk-toast-message">${message}</div>
    `;

    return toast;
  }

  getIcon(type) {
    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    };

    return icons[type] || icons.info;
  }

  clearAll() {
    this.queue = [];
    if (this.activeToast) {
      this.hideToast(this.activeToast);
      this.activeToast = null;
    }
  }
}

// Global toast manager
window.toastManager = new ToastManager();

// Add toast styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .qk-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    max-width: 400px;
    min-width: 280px;
    background: white;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    transform: translateX(calc(100% + 24px));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
    border-left: 4px solid currentColor;
  }

  .qk-toast.show {
    transform: translateX(0);
  }

  .qk-toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qk-toast-message {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .qk-toast-success {
    color: #15803d;
  }

  .qk-toast-error {
    color: #dc2626;
  }

  .qk-toast-warning {
    color: #d97706;
  }

  .qk-toast-info {
    color: #0f766e;
  }

  @media (max-width: 640px) {
    .qk-toast {
      left: 16px;
      right: 16px;
      bottom: 80px;
      max-width: none;
      transform: translateY(calc(100% + 80px));
    }

    .qk-toast.show {
      transform: translateY(0);
    }
  }

  /* Prevent pull-to-refresh interference */
  .qk-toast {
    overscroll-behavior: contain;
    touch-action: none;
  }
`;
document.head.appendChild(toastStyles);
