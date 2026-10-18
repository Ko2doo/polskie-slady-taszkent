import { overlayController } from '@/store/ui/overlayController';

/**
 * Registers an overlay with the back-button overlay stack (overlayController) while it's open,
 * so Android back closes it. Safe to call open() and close() more than once; closing always
 * removes the overlay from the stack.
 * @param {() => void} onClose - called when back closes the overlay
 * @returns {{ open: () => void, close: () => void }} register / unregister the overlay
 * @example
 * const { open, close } = useOverlay(() => (opened = false));
 *
 * function openModal() {
 *   opened = true;
 *   open();
 * }
 */
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
