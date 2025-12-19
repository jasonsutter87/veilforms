=== VeilForms - Encrypted Forms for WordPress ===
Contributors: veilforms
Tags: forms, encrypted, privacy, security, gdpr
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed encrypted, privacy-first forms with VeilForms. Client-side encryption ensures your users' data stays secure.

== Description ==

VeilForms brings privacy-first, encrypted forms to your WordPress site. With client-side encryption, your users' data is encrypted in their browser before being sent to your server, ensuring maximum security and privacy.

= Features =

* **Client-Side Encryption** - All data is encrypted in the user's browser using hybrid AES-256 + RSA encryption
* **Privacy-First** - Zero-knowledge architecture ensures only you can decrypt submissions
* **Easy Integration** - Use shortcodes or Gutenberg blocks to embed forms anywhere
* **Customizable Themes** - Light, dark, and auto themes to match your site design
* **Multi-Page Forms** - Support for complex, multi-step forms with progress tracking
* **File Uploads** - Secure, encrypted file uploads with drag-and-drop support
* **GDPR Compliant** - Built with privacy regulations in mind
* **Spam Protection** - Honeypot and reCAPTCHA integration
* **Responsive Design** - Forms look great on all devices
* **Performance Optimized** - Lightweight SDK with configurable caching

= Use Cases =

* Contact forms with sensitive information
* Job applications with resume uploads
* Medical intake forms
* Legal document submissions
* Customer feedback forms
* Support ticket systems
* Survey and questionnaire forms

= How It Works =

1. Install and activate the VeilForms plugin
2. Get your API key from [VeilForms.com](https://veilforms.com)
3. Configure your settings in WordPress Settings > VeilForms
4. Create forms in your VeilForms dashboard
5. Embed forms using shortcodes or Gutenberg blocks
6. Receive encrypted submissions securely

= Shortcode Usage =

Basic usage:
`[veilforms id="your-form-id"]`

With custom theme:
`[veilforms id="your-form-id" theme="dark"]`

Disable branding:
`[veilforms id="your-form-id" branding="false"]`

= Gutenberg Block =

Simply search for "VeilForms" in the block editor and configure your form using the block settings panel.

= Privacy & Security =

VeilForms uses industry-standard encryption:
* AES-256-GCM for data encryption
* RSA-OAEP-256 for key encryption
* All encryption happens client-side in the browser
* Your private key never leaves your VeilForms account

= Support =

For support, documentation, and feature requests, visit [VeilForms.com](https://veilforms.com).

== Installation ==

= Automatic Installation =

1. Log in to your WordPress admin panel
2. Navigate to Plugins > Add New
3. Search for "VeilForms"
4. Click "Install Now" and then "Activate"

= Manual Installation =

1. Download the plugin ZIP file
2. Log in to your WordPress admin panel
3. Navigate to Plugins > Add New > Upload Plugin
4. Choose the ZIP file and click "Install Now"
5. Activate the plugin

= Configuration =

1. Navigate to Settings > VeilForms
2. Enter your VeilForms API key
3. Configure your default settings
4. Save changes

== Frequently Asked Questions ==

= Do I need a VeilForms account? =

Yes, you need to create a free account at [VeilForms.com](https://veilforms.com) to get your API key and create forms.

= Is client-side encryption secure? =

Yes! VeilForms uses hybrid encryption (AES-256 + RSA-2048) which is the same encryption standard used by banks and military applications. All encryption happens in the user's browser before data is transmitted.

= Can I customize the form design? =

Yes! VeilForms supports custom themes (light, dark, auto) and you can add your own CSS for advanced customization.

= Does this work with page builders? =

Yes! VeilForms works with any page builder that supports shortcodes or Gutenberg blocks, including Elementor, Beaver Builder, Divi, and more.

= What happens if JavaScript is disabled? =

VeilForms requires JavaScript for client-side encryption. If JavaScript is disabled, a message will be shown to the user.

= Is VeilForms GDPR compliant? =

Yes! VeilForms is built with GDPR compliance in mind. Since data is encrypted client-side, even VeilForms cannot access your users' submissions without your private key.

= Can I export form submissions? =

Yes, you can export encrypted submissions from your VeilForms dashboard and decrypt them using your private key.

= What file types can be uploaded? =

You can configure allowed file types per form. Common types include PDFs, images, documents, and more.

= Is there a submission limit? =

Submission limits depend on your VeilForms plan. Check [VeilForms.com/pricing](https://veilforms.com/pricing) for details.

== Screenshots ==

1. VeilForms settings page
2. Gutenberg block editor interface
3. Light theme form example
4. Dark theme form example
5. Multi-page form with progress indicator
6. File upload interface
7. Mobile responsive design

== Changelog ==

= 1.0.0 =
* Initial release
* Client-side encryption with AES-256 + RSA
* Shortcode support
* Gutenberg block support
* Theme customization (light, dark, auto)
* Multi-page form support
* File upload support
* Spam protection (honeypot + reCAPTCHA)
* Performance optimization with configurable caching
* Secure API key storage with encryption
* GDPR compliance features

== Upgrade Notice ==

= 1.0.0 =
Initial release of VeilForms for WordPress. Install to start using encrypted forms on your site.

== Additional Information ==

= Links =

* [Website](https://veilforms.com)
* [Documentation](https://veilforms.com/docs)
* [Support](https://veilforms.com/support)
* [GitHub](https://github.com/veilforms/wordpress-plugin)

= Privacy Policy =

VeilForms respects your privacy. All form data is encrypted client-side before transmission. We do not have access to your users' submissions without your private decryption key. For more information, see our [Privacy Policy](https://veilforms.com/privacy).
