const isEditableTarget = target => {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable;
};

['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach(eventName => {
  document.addEventListener(eventName, event => {
    if (!isEditableTarget(event.target)) {
      event.preventDefault();
    }
  });
});
