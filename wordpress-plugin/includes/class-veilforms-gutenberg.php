<?php
/**
 * Gutenberg Block Handler Class
 *
 * @package VeilForms
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * VeilForms Gutenberg Block Handler
 */
class VeilForms_Gutenberg {

	/**
	 * The single instance of the class.
	 *
	 * @var VeilForms_Gutenberg
	 */
	protected static $instance = null;

	/**
	 * Main Instance.
	 *
	 * @return VeilForms_Gutenberg
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_block' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_block_editor_assets' ) );
	}

	/**
	 * Register Gutenberg block.
	 */
	public function register_block() {
		// Check if Gutenberg is available.
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}

		register_block_type(
			'veilforms/form',
			array(
				'editor_script'   => 'veilforms-block',
				'render_callback' => array( $this, 'render_block' ),
				'attributes'      => array(
					'formId'   => array(
						'type'    => 'string',
						'default' => '',
					),
					'theme'    => array(
						'type'    => 'string',
						'default' => VeilForms_Plugin::get_option( 'default_theme', 'light' ),
					),
					'branding' => array(
						'type'    => 'boolean',
						'default' => true,
					),
					'mode'     => array(
						'type'    => 'string',
						'default' => 'inline',
					),
				),
			)
		);
	}

	/**
	 * Enqueue block editor assets.
	 */
	public function enqueue_block_editor_assets() {
		wp_enqueue_script(
			'veilforms-block',
			VEILFORMS_PLUGIN_URL . 'assets/js/veilforms-block.js',
			array( 'wp-blocks', 'wp-element', 'wp-editor', 'wp-components', 'wp-i18n' ),
			VEILFORMS_VERSION,
			true
		);

		// Pass plugin settings to block editor.
		wp_localize_script(
			'veilforms-block',
			'veilformsSettings',
			array(
				'defaultTheme' => VeilForms_Plugin::get_option( 'default_theme', 'light' ),
				'endpoint'     => VeilForms_Plugin::get_option( 'endpoint', VEILFORMS_DEFAULT_ENDPOINT ),
			)
		);
	}

	/**
	 * Render block on frontend.
	 *
	 * @param array $attributes Block attributes.
	 * @return string Rendered block HTML.
	 */
	public function render_block( $attributes ) {
		// Get attributes with defaults.
		$form_id  = isset( $attributes['formId'] ) ? sanitize_text_field( $attributes['formId'] ) : '';
		$theme    = isset( $attributes['theme'] ) ? sanitize_text_field( $attributes['theme'] ) : 'light';
		$branding = isset( $attributes['branding'] ) ? (bool) $attributes['branding'] : true;
		$mode     = isset( $attributes['mode'] ) ? sanitize_text_field( $attributes['mode'] ) : 'inline';

		// Validate form ID.
		if ( empty( $form_id ) ) {
			if ( current_user_can( 'edit_posts' ) ) {
				return '<div class="veilforms-error" style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">' .
					esc_html__( 'VeilForms: Please select a form ID in the block settings.', 'veilforms' ) .
					'</div>';
			}
			return '';
		}

		// Build shortcode attributes.
		$shortcode_atts = array(
			'id'       => $form_id,
			'theme'    => $theme,
			'branding' => $branding ? 'true' : 'false',
			'mode'     => $mode,
		);

		// Convert attributes to shortcode format.
		$shortcode_params = array();
		foreach ( $shortcode_atts as $key => $value ) {
			$shortcode_params[] = sprintf( '%s="%s"', $key, esc_attr( $value ) );
		}

		// Use the shortcode handler to render.
		$shortcode = '[veilforms ' . implode( ' ', $shortcode_params ) . ']';
		return do_shortcode( $shortcode );
	}
}
