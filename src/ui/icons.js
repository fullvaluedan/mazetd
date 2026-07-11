const ICON_SHEET = 'assets/ui/icons.svg';

export function icon(name, cls = '') {
  const className = ['game-icon', cls].filter(Boolean).join(' ');
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="${ICON_SHEET}#${name}"></use></svg>`;
}

export function setIconButton(button, name, label, text = '') {
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<span class="control-face">${icon(name)}${text ? `<span class="control-label">${text}</span>` : ''}</span>`;
}
