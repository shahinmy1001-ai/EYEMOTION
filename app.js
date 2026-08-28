/**
 * ورودی اصلی برنامه EyeMotion – نسخه با import پویا و مدیریت خطا (سازگار با موبایل)
 */

import { DOM, initDom, getEl } from './core/dom.js';
import { state, updateState, setDom } from './core/state.js';
import { eventBus } from './core/event-bus.js';
import { applyTheme, loadSavedTheme, getFormattedTimestamp } from './core/utils.js';
import { setupUI, updateStatus, showToast } from './modules/ui.js';
import { startCamera, updateCameraDisplay } from './modules/camera.js';
import { initMotionWorker, startMotionDetection } from './modules/motion.js';
import { capturePhoto } from './modules/capture.js';
import {
  loadSavedSettings,
  saveSettings,
  enableAutoSave,
  resetAllMessages
} from './modules/storage.js';
import { init as i18nInit, t } from './i18n.js';
import { initSystemMonitor } from './modules/system-monitor.js';

// ===== متغیرهای Keep-Alive (با import پویا) =====
let startKeepAlive = null;
let stopKeepAlive = null;

// مقداردهی DOM
initDom();
setDom(DOM);
updateState({ dom: DOM });

// مقداردهی i18n
i18nInit();

async function loadKeepAlive() {
  try {
    const module = await import('./modules/keepalive.js');
    startKeepAlive = module.startKeepAlive;
    stopKeepAlive = module.stopKeepAlive;
    console.log('✅ Keep-Alive module loaded successfully');
    return true;
  } catch (e) {
    console.warn('⚠️ Keep-Alive module not loaded:', e.message);
    // توابع خالی برای جلوگیری از خطا
    startKeepAlive = () => console.log('⏰ Keep-Alive disabled');
    stopKeepAlive = () => {};
    return false;
  }
}

function init() {
  try {
    console.log('🚀 Initializing EyeMotion...');

    const size = DOM.analysisSizeSelect.value.split('x').map(Number);
    state.motionCanvas = document.createElement('canvas');
    state.motionCanvas.width = size[0];
    state.motionCanvas.height = size[1];
    state.motionCanvasSize = { w: size[0], h: size[1] };
    state.motionCtx = state.motionCanvas.getContext('2d');

    try {
      initMotionWorker();
    } catch (e) {
      console.warn('Web Worker init failed, using fallback:', e);
      state.isWorkerReady = false;
    }

    console.log('🔄 Setting up UI...');
    setupUI();
    console.log('✅ UI setup completed');

    console.log('📷 Starting camera...');
    startCamera();

    // ===== بارگذاری تنظیمات (که پیام‌ها را ریست می‌کند) =====
    console.log('💾 Loading saved settings...');
    loadSavedSettings();

    // ===== ریست مجدد =====
    resetAllMessages();

    loadSavedTheme();
    enableAutoSave();

    // ===== راه‌اندازی سیستم پایداری =====
    console.log('🛡️ Initializing system monitor...');
    initSystemMonitor();

    // ===== بارگذاری Keep-Alive و راه‌اندازی آن =====
    loadKeepAlive().then(() => {
      if (startKeepAlive) {
        try {
          console.log('⏰ Starting Keep-Alive...');
          startKeepAlive();
        } catch (e) {
          console.warn('⚠️ Keep-Alive start failed:', e.message);
        }
      }
    });

    // ===== نمایش پیام اولیه فقط در صورت فعال بودن =====
    updateStatus('statusWaiting', null, 'msgStatusWaiting');

    DOM.cameraPreview?.addEventListener('click', function(e) {
      if (state.isManualMode) return;
      if (!state.isCameraConnected || state.isProcessing || state.isDelayActive) return;
      if (DOM.systemStateSelect.value === 'disabled') {
        showToast(t('statusDisabled'), 'warning', 3000, 'msgRecordingToggle');
        return;
      }
      capturePhoto();
    });

    DOM.manualOverlay?.addEventListener('click', function(e) {
      if (state.isManualMode && state.isCameraConnected) {
        capturePhoto();
      }
    });
    DOM.manualOverlay?.addEventListener('dblclick', function(e) {
      if (state.isManualMode) {
        eventBus.emit('exit-manual-mode', {});
      }
    });

    setInterval(() => saveSettings(), 30000);
    window.addEventListener('beforeunload', () => {
      if (stopKeepAlive) {
        try {
          stopKeepAlive();
        } catch (e) {}
      }
      saveSettings();
    });

    // ===== ریست نهایی با تاخیر برای اطمینان =====
    setTimeout(() => {
      resetAllMessages();
      console.log('🔄 Final reset after 2000ms: all messages disabled');
    }, 2000);

    setTimeout(() => {
      showToast(t('statusWaiting'), 'info', 2000, 'msgStatusWaiting');
    }, 500);

    console.log('✅ EyeMotion initialized successfully');
  } catch (error) {
    console.error('❌ Critical initialization error:', error);
    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) {
      statusMsg.textContent = '⚠️ خطا در راه‌اندازی برنامه. لطفاً صفحه را مجدداً بارگذاری کنید.';
      statusMsg.style.color = 'var(--text-status-error)';
    }
    alert('خطا در راه‌اندازی برنامه. لطفاً صفحه را مجدداً بارگذاری کنید.\n\n' + error.message);
  }
}

// اجرای برنامه پس از بارگذاری کامل DOM
document.addEventListener('DOMContentLoaded', init);

export { state, DOM, eventBus };