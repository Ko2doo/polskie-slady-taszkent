// -------------------------------------------------------------
// useOverlay - helper for automatic overlay lifecycle management.
//
// Purpose:
// - Automatically register/unregister overlays in overlayController
// - Reduce boilerplate in components (modals, sheets, popups, etc.)
//
// Usage:
//   const { open, close } = useOverlay(() => opened = false);
//
//   function openModal() {
//     opened = true;
//     open();
//   }
//
//   function closeModal() {
//     close();
//   }
//
// Guarantees:
// - Overlay is always removed from stack when closed
// - Safe to call open() multiple times
// - Safe to call close() multiple times
// -------------------------------------------------------------

import { overlayController } from '@/services/overlayController';

export function useOverlay(onClose) {
  let overlayId = null;

  function open() {
    // Avoid double registration
    if (overlayId) return;

    overlayId = overlayController.register(() => {
      // When Android back triggers close:
      onClose?.();

      // Ensure cleanup
      if (overlayId) {
        overlayController.unregister(overlayId);
        overlayId = null;
      }
    });
  }

  function close() {
    // Close manually (UI action, backdrop click, etc.)
    onClose?.();

    if (overlayId) {
      overlayController.unregister(overlayId);
      overlayId = null;
    }
  }

  return {
    open,
    close,
  };
}
