/**
 * VeilForms - DOM Utilities
 * Common DOM manipulation helpers
 */

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default document)
 * @returns {Element|null} Found element
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default document)
 * @returns {NodeList} Found elements
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {Element|null} Found element
 */
export function byId(id) {
  return document.getElementById(id);
}

/**
 * Create element with attributes
 * @param {string} tag - Tag name
 * @param {Object} attrs - Attributes to set
 * @param {string|Element|Element[]} children - Child content
 * @returns {Element} Created element
 */
export function createElement(tag, attrs = {}, children = null) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  if (children !== null) {
    if (typeof children === 'string') {
      el.textContent = children;
    } else if (children instanceof Element) {
      el.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
          el.appendChild(child);
        }
      });
    }
  }

  return el;
}

/**
 * Add event listener with automatic cleanup
 * @param {Element|string} element - Element or selector
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 * @returns {Function} Remove listener function
 */
export function on(element, event, handler, options = {}) {
  const el = typeof element === 'string' ? $(element) : element;
  if (!el) return () => {};

  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * Delegate event listener
 * @param {Element|string} parent - Parent element or selector
 * @param {string} selector - Child selector
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Remove listener function
 */
export function delegate(parent, selector, event, handler) {
  const el = typeof parent === 'string' ? $(parent) : parent;
  if (!el) return () => {};

  const delegatedHandler = (e) => {
    const target = e.target.closest(selector);
    if (target && el.contains(target)) {
      handler.call(target, e, target);
    }
  };

  el.addEventListener(event, delegatedHandler);
  return () => el.removeEventListener(event, delegatedHandler);
}

/**
 * Add/remove class helpers
 */
export function addClass(element, ...classes) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.classList.add(...classes);
}

export function removeClass(element, ...classes) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.classList.remove(...classes);
}

export function toggleClass(element, className, force) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.classList.toggle(className, force);
}

export function hasClass(element, className) {
  const el = typeof element === 'string' ? $(element) : element;
  return el ? el.classList.contains(className) : false;
}

/**
 * Set element HTML safely
 * @param {Element|string} element - Element or selector
 * @param {string} html - HTML to set
 */
export function setHtml(element, html) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.innerHTML = html;
}

/**
 * Set element text content
 * @param {Element|string} element - Element or selector
 * @param {string} text - Text to set
 */
export function setText(element, text) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.textContent = text;
}

/**
 * Get/set element value
 * @param {Element|string} element - Element or selector
 * @param {*} value - Value to set (omit to get)
 * @returns {*} Element value if getting
 */
export function val(element, value) {
  const el = typeof element === 'string' ? $(element) : element;
  if (!el) return undefined;

  if (value === undefined) {
    return el.value;
  }
  el.value = value;
}

/**
 * Get/set data attribute
 * @param {Element|string} element - Element or selector
 * @param {string} key - Data attribute key
 * @param {*} value - Value to set (omit to get)
 * @returns {*} Data value if getting
 */
export function data(element, key, value) {
  const el = typeof element === 'string' ? $(element) : element;
  if (!el) return undefined;

  if (value === undefined) {
    return el.dataset[key];
  }
  el.dataset[key] = value;
}

/**
 * Empty element contents
 * @param {Element|string} element - Element or selector
 */
export function empty(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.innerHTML = '';
}

/**
 * Remove element from DOM
 * @param {Element|string} element - Element or selector
 */
export function remove(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

/**
 * Append children to element
 * @param {Element|string} parent - Parent element or selector
 * @param {...Element} children - Children to append
 */
export function append(parent, ...children) {
  const el = typeof parent === 'string' ? $(parent) : parent;
  if (el) children.forEach(child => el.appendChild(child));
}

/**
 * Prepend children to element
 * @param {Element|string} parent - Parent element or selector
 * @param {...Element} children - Children to prepend
 */
export function prepend(parent, ...children) {
  const el = typeof parent === 'string' ? $(parent) : parent;
  if (el) children.reverse().forEach(child => el.insertBefore(child, el.firstChild));
}

/**
 * Check if element is visible
 * @param {Element|string} element - Element or selector
 * @returns {boolean} Whether element is visible
 */
export function isVisible(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (!el) return false;
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

/**
 * Scroll element into view
 * @param {Element|string} element - Element or selector
 * @param {Object} options - ScrollIntoView options
 */
export function scrollIntoView(element, options = { behavior: 'smooth', block: 'start' }) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.scrollIntoView(options);
}

/**
 * Focus element
 * @param {Element|string} element - Element or selector
 */
export function focus(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el && typeof el.focus === 'function') el.focus();
}

/**
 * Get form data as object
 * @param {HTMLFormElement|string} form - Form element or selector
 * @returns {Object} Form data as key-value pairs
 */
export function getFormData(form) {
  const el = typeof form === 'string' ? $(form) : form;
  if (!el) return {};

  const formData = new FormData(el);
  const data = {};
  for (const [key, value] of formData.entries()) {
    if (key in data) {
      // Handle multiple values (e.g., checkboxes)
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}

/**
 * Set form values from object
 * @param {HTMLFormElement|string} form - Form element or selector
 * @param {Object} values - Values to set
 */
export function setFormData(form, values) {
  const el = typeof form === 'string' ? $(form) : form;
  if (!el) return;

  for (const [key, value] of Object.entries(values)) {
    const input = el.elements[key];
    if (!input) continue;

    if (input.type === 'checkbox') {
      input.checked = !!value;
    } else if (input.type === 'radio') {
      const radio = el.querySelector(`input[name="${key}"][value="${value}"]`);
      if (radio) radio.checked = true;
    } else {
      input.value = value ?? '';
    }
  }
}
