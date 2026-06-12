import DOMPurify from 'dompurify';

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: false
};

function sanitizeHref(value) {
  const href = String(value || '').trim();
  if (!href) return '#';
  const safe = /^(https?:|mailto:|tel:|#)/i.test(href);
  return safe ? href : '#';
}

export function sanitizeHelpHtml(rawHtml = '') {
  if (!rawHtml) return '';
  if (typeof window === 'undefined') return String(rawHtml);

  // Run DOMPurify first for battle-tested XSS sanitization
  const clean = DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG);

  // Post-process: enforce safe hrefs and noopener on all links
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${clean}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  root.querySelectorAll('a').forEach((a) => {
    a.setAttribute('href', sanitizeHref(a.getAttribute('href')));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer nofollow');
  });

  return root.innerHTML
    .replace(/<p>(\s|&nbsp;)*<\/p>/gi, '<p><br></p>')
    .trim();
}

export function getPlainTextFromHtml(html = '') {
  if (!html) return '';
  if (typeof window === 'undefined') return String(html).replace(/<[^>]*>/g, ' ');
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function toMarkdownFromNode(node) {
  if (!node) return '';

  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const childText = Array.from(node.childNodes).map(toMarkdownFromNode).join('');

  switch (tag) {
    case 'h1':
      return `# ${childText}\n\n`;
    case 'h2':
      return `## ${childText}\n\n`;
    case 'h3':
      return `### ${childText}\n\n`;
    case 'strong':
    case 'b':
      return `**${childText}**`;
    case 'em':
    case 'i':
      return `*${childText}*`;
    case 'u':
      return `<u>${childText}</u>`;
    case 's':
    case 'strike':
      return `~~${childText}~~`;
    case 'code':
      return `\`${childText}\``;
    case 'pre':
      return `\n\n\`\`\`\n${childText}\n\`\`\`\n\n`;
    case 'li': {
      const parentTag = node.parentElement?.tagName?.toLowerCase();
      if (parentTag === 'ol') {
        const index = Array.from(node.parentElement.children).indexOf(node) + 1;
        return `${index}. ${childText}\n`;
      }
      return `- ${childText}\n`;
    }
    case 'ul':
    case 'ol':
      return `${childText}\n`;
    case 'a':
      return `[${childText}](${sanitizeHref(node.getAttribute('href'))})`;
    case 'p':
      return `${childText}\n\n`;
    case 'blockquote':
      return `> ${childText}\n\n`;
    case 'br':
      return '\n';
    default:
      return childText;
  }
}

export function htmlToMarkdown(html = '') {
  if (!html) return '';
  if (typeof window === 'undefined') return String(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  return Array.from(root.childNodes)
    .map(toMarkdownFromNode)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function exportHelpContent(documentState, format = 'json') {
  const rawHtml = String(documentState?.html || '');
  const sanitizedHtml = sanitizeHelpHtml(rawHtml);
  const plainText =
    String(documentState?.plainText || '').trim() || getPlainTextFromHtml(sanitizedHtml);

  if (format === 'html') return sanitizedHtml;
  if (format === 'markdown') return htmlToMarkdown(sanitizedHtml);

  return {
    type: 'hdmarket_help_doc',
    version: 1,
    html: sanitizedHtml,
    plainText,
    blocks: documentState?.blocks || []
  };
}
