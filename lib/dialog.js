const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function focusableItems(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => !node.closest("[hidden]"));
}

export function tabDestination(items, current, shift) {
  if (!items.length) return null;
  const index = items.indexOf(current);
  if (shift) return index <= 0 ? items[items.length - 1] : items[index - 1];
  return index === -1 || index >= items.length - 1 ? items[0] : items[index + 1];
}
