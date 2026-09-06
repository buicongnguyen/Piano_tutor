// Keep the picker request synchronous so it retains the button's user activation.
export function openScorePicker(input: HTMLInputElement) {
  // Selecting the same file again must still dispatch change.
  input.value = "";
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      /* Older embedded browsers use click. */
    }
  }
  input.click();
}
