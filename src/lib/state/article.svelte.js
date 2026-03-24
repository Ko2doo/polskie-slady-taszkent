import { useOverlay } from '@/services/useOverlay';

function createArticlePopupUI() {
  let id = $state(null);
  let isOpen = $state(false);

  // Overlay logic integration
  const { open: registerOverlay, close: unregisterOverlay } = useOverlay(() => {
    isOpen = false;
  });

  return {
    get id() {
      return id;
    },
    get isOpen() {
      return isOpen;
    },

    open(newId) {
      id = newId;
      isOpen = true;

      registerOverlay();
    },

    close() {
      isOpen = false;

      unregisterOverlay();
    },
  };
}

export const articlePopupState = createArticlePopupUI();
