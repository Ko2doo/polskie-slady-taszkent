import { describe, it, expect } from 'vitest';
import { createPopupHTML, escapeHtml } from '@/services/mapPopupHtml';

// Parse the popup the way the map does (it becomes innerHTML of the popup element)
function render(options) {
  const container = document.createElement('div');
  container.innerHTML = createPopupHTML(options);
  return container;
}

const HOSTILE = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe('escapeHtml', () => {
  it('escapes tags and ampersands', () => {
    expect(escapeHtml('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });

  it('escapes double and single quotes', () => {
    expect(escapeHtml(`" onclick='alert(1)'`)).toBe('&quot; onclick=&#39;alert(1)&#39;');
  });

  it('escapes an ampersand once, not the entities it produces', () => {
    expect(escapeHtml('"&"')).toBe('&quot;&amp;&quot;');
  });

  it('empty and missing text becomes an empty string', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('createPopupHTML', () => {
  it('renders the title, the button with the id and its text', () => {
    const popup = render({ title: 'Kościół', id: 'l01', preview: '', popupLinkFn: () => 'Czytaj' });

    expect(popup.querySelector('p').textContent.trim()).toBe('Kościół');
    expect(popup.querySelector('button').dataset.articleId).toBe('l01');
    expect(popup.querySelector('button').textContent.trim()).toBe('Czytaj');
    expect(popup.querySelector('img')).toBeNull();
  });

  it('renders a lazy preview image when there is one', () => {
    const popup = render({ title: 'T', id: 'l01', preview: '/previews/l01.webp', popupLinkFn: () => 'x' });
    const image = popup.querySelector('img');

    expect(image.getAttribute('src')).toBe('/previews/l01.webp');
    expect(image.getAttribute('alt')).toBe('T');
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to a default button text without an i18n function', () => {
    expect(render({ title: 'T', id: 'l01' }).querySelector('button').textContent.trim()).toBe('Read more');
  });

  // Custom marker titles are typed by the user: nothing in them may become markup
  it('a hostile title stays text', () => {
    const popup = render({ title: HOSTILE, id: 'id', preview: 'p.jpg', popupLinkFn: () => 'x' });

    expect(popup.querySelector('script')).toBeNull();
    expect(popup.querySelectorAll('img')).toHaveLength(1);
    expect(popup.querySelector('p').textContent.trim()).toBe(HOSTILE);
  });

  it('an ordinary title with quotes shows unchanged, as text and as alt', () => {
    const title = `O'rda "Polonia" & co`;
    const popup = render({ title, id: 'l01', preview: 'p.jpg' });

    expect(popup.querySelector('p.map-popup-title').textContent.trim()).toBe(title);
    expect(popup.querySelector('img').getAttribute('alt')).toBe(title);
    expect(popup.querySelector('button').dataset.articleId).toBe('l01');
  });

  it('a quote cannot break out of an attribute', () => {
    const title = '" onmouseover="alert(1)';
    const popup = render({ title, id: '" onclick="alert(1)', preview: 'p.jpg' });

    expect(popup.querySelector('[onclick]')).toBeNull();
    expect(popup.querySelector('[onmouseover]')).toBeNull();
    expect(popup.querySelector('img').getAttribute('alt')).toBe(title);
  });
});
