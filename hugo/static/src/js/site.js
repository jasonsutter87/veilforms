// VeilForms Site JavaScript

// Mobile Menu Toggle
function toggleMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.classList.toggle('active');
    navLinks.classList.toggle('active');
  }
}

// Docs Mobile Navigation Toggle
function toggleDocsNav() {
  const nav = document.getElementById('docs-nav');
  const btn = document.querySelector('.docs-mobile-toggle');

  if (nav && btn) {
    nav.classList.toggle('active');
    btn.classList.toggle('active');
  }
}

// Close mobile menu when clicking on a link
document.addEventListener('DOMContentLoaded', function() {
  const navLinks = document.querySelectorAll('.nav-links a');

  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      const toggle = document.querySelector('.menu-toggle');
      const nav = document.querySelector('.nav-links');

      if (toggle && nav && window.innerWidth <= 768) {
        toggle.classList.remove('active');
        nav.classList.remove('active');
      }
    });
  });
});
