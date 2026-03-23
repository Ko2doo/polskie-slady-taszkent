function createArticlePopupUI() {
  let id = $state(null);
  let isOpen = $state(false);

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
    },

    close() {
      isOpen = false;
    },
  };
}

export const articlePopupState = createArticlePopupUI();
