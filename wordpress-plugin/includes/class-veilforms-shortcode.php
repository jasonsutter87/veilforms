<?php
/**
 * Shortcode Handler Class
 *
 * @package VeilForms
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * VeilForms Shortcode Handler
 */
class VeilForms_Shortcode {

	/**
	 * The single instance of the class.
	 *
	 * @var VeilForms_Shortcode
	 */
	protected static $instance = null;

	/**
	 * Form counter for unique IDs.
	 *
	 * @var int
	 */
	private static $form_counter = 0;

	/**
	 * Main Instance.
	 *
	 * @return VeilForms_Shortcode
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
		add_shortcode( 'veilforms', array( $this, 'render_shortcode' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Enqueue SDK script.
	 */
	public function enqueue_scripts() {
		// Only enqueue if shortcode is present on the page.
		global $post;
		if ( ! is_a( $post, 'WP_Post' ) || ! has_shortcode( $post->post_content, 'veilforms' ) ) {
			return;
		}

		$this->enqueue_sdk();
	}

	/**
	 * Enqueue VeilForms SDK.
	 */
	public static function enqueue_sdk() {
		$endpoint       = VeilForms_Plugin::get_option( 'endpoint', VEILFORMS_DEFAULT_ENDPOINT );
		$cache_duration = VeilForms_Plugin::get_option( 'cache_duration', 86400 );

		// Build SDK URL with cache busting if needed.
		$sdk_url = trailingslashit( $endpoint ) . 'sdk/veilforms-' . VEILFORMS_SDK_VERSION . '.min.js';

		// Use cache duration as version if caching is enabled.
		$version = $cache_duration > 0 ? floor( time() / $cache_duration ) : time();

		wp_enqueue_script(
			'veilforms-sdk',
			$sdk_url,
			array(),
			$version,
			true
		);
	}

	/**
	 * Render shortcode.
	 *
	 * @param array  $atts    Shortcode attributes.
	 * @param string $content Shortcode content.
	 * @return string Rendered shortcode HTML.
	 */
	public function render_shortcode( $atts, $content = null ) {
		// Parse attributes.
		$atts = shortcode_atts(
			array(
				'id'        => '',
				'theme'     => VeilForms_Plugin::get_option( 'default_theme', 'light' ),
				'branding'  => 'true',
				'mode'      => 'inline',
				'onsubmit'  => '',
				'onerror'   => '',
			),
			$atts,
			'veilforms'
		);

		// Validate form ID.
		if ( empty( $atts['id'] ) ) {
			return $this->render_error( __( 'VeilForms: Form ID is required.', 'veilforms' ) );
		}

		// Sanitize attributes.
		$form_id  = sanitize_text_field( $atts['id'] );
		$theme    = sanitize_text_field( $atts['theme'] );
		$branding = filter_var( $atts['branding'], FILTER_VALIDATE_BOOLEAN );
		$mode     = sanitize_text_field( $atts['mode'] );

		// Validate mode.
		$allowed_modes = array( 'inline', 'popup', 'fullpage' );
		if ( ! in_array( $mode, $allowed_modes, true ) ) {
			$mode = 'inline';
		}

		// Generate unique container ID.
		self::$form_counter++;
		$container_id = 'veilforms-container-' . self::$form_counter;

		// Get endpoint.
		$endpoint = VeilForms_Plugin::get_option( 'endpoint', VEILFORMS_DEFAULT_ENDPOINT );

		// Get animations setting.
		$animations = VeilForms_Plugin::get_option( 'animations', true );

		// Enqueue SDK if not already enqueued.
		if ( ! wp_script_is( 'veilforms-sdk', 'enqueued' ) ) {
			self::enqueue_sdk();
		}

		// Build JavaScript configuration.
		$config = array(
			'formId'   => $form_id,
			'endpoint' => $endpoint,
			'mode'     => $mode,
			'branding' => $branding,
		);

		// Add optional callbacks if provided.
		if ( ! empty( $atts['onsubmit'] ) ) {
			$config['onSubmit'] = '%%' . sanitize_text_field( $atts['onsubmit'] ) . '%%';
		}

		if ( ! empty( $atts['onerror'] ) ) {
			$config['onError'] = '%%' . sanitize_text_field( $atts['onerror'] ) . '%%';
		}

		// Build custom styles if needed.
		$custom_styles = $this->get_custom_styles( $theme, $animations );
		if ( $custom_styles ) {
			$config['customStyles'] = $custom_styles;
		}

		// Convert config to JSON (handle callbacks specially).
		$config_json = wp_json_encode( $config );

		// Replace callback placeholders with actual function names.
		$config_json = preg_replace( '/"%%(.+?)%%"/', '$1', $config_json );

		// Build initialization script.
		$init_script = sprintf(
			'(function() {
				if (typeof VeilForms === "undefined") {
					console.error("VeilForms SDK not loaded");
					return;
				}
				var form = new VeilForms(%s);
				form.init("%s");
			})();',
			$config_json,
			esc_js( $container_id )
		);

		// Build HTML output.
		ob_start();
		?>
		<div id="<?php echo esc_attr( $container_id ); ?>" class="veilforms-wrapper" data-form-id="<?php echo esc_attr( $form_id ); ?>">
			<div class="veilforms-loading">
				<p><?php esc_html_e( 'Loading form...', 'veilforms' ); ?></p>
			</div>
		</div>
		<script type="text/javascript">
			<?php echo $init_script; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
		</script>
		<?php
		return ob_get_clean();
	}

	/**
	 * Get custom styles based on theme and settings.
	 *
	 * @param string $theme      Theme name.
	 * @param bool   $animations Whether animations are enabled.
	 * @return string Custom CSS styles or empty string.
	 */
	private function get_custom_styles( $theme, $animations ) {
		$styles = array();

		// Add theme-specific styles.
		if ( 'dark' === $theme ) {
			$styles[] = '.veilforms-form { background: #1a1a1a; color: #ffffff; }';
			$styles[] = '.veilforms-input, .veilforms-textarea, .veilforms-select { background: #2a2a2a; color: #ffffff; border-color: #444; }';
			$styles[] = '.veilforms-label { color: #e0e0e0; }';
		}

		// Disable animations if needed.
		if ( ! $animations ) {
			$styles[] = '.veilforms-form * { transition: none !important; animation: none !important; }';
		}

		return ! empty( $styles ) ? implode( ' ', $styles ) : '';
	}

	/**
	 * Render error message.
	 *
	 * @param string $message Error message.
	 * @return string Error HTML.
	 */
	private function render_error( $message ) {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '';
		}

		return sprintf(
			'<div class="veilforms-error" style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">%s</div>',
			esc_html( $message )
		);
	}
}
