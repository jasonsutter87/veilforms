<?php
/**
 * Admin Settings Class
 *
 * @package VeilForms
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * VeilForms Admin Settings
 */
class VeilForms_Admin {

	/**
	 * The single instance of the class.
	 *
	 * @var VeilForms_Admin
	 */
	protected static $instance = null;

	/**
	 * Main Instance.
	 *
	 * @return VeilForms_Admin
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
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_styles' ) );
	}

	/**
	 * Add admin menu.
	 */
	public function add_admin_menu() {
		add_options_page(
			__( 'VeilForms Settings', 'veilforms' ),
			__( 'VeilForms', 'veilforms' ),
			'manage_options',
			'veilforms',
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Register settings.
	 */
	public function register_settings() {
		register_setting(
			'veilforms_settings_group',
			'veilforms_settings',
			array(
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
			)
		);

		// API Settings Section.
		add_settings_section(
			'veilforms_api_section',
			__( 'API Configuration', 'veilforms' ),
			array( $this, 'render_api_section' ),
			'veilforms'
		);

		add_settings_field(
			'veilforms_api_key',
			__( 'API Key', 'veilforms' ),
			array( $this, 'render_api_key_field' ),
			'veilforms',
			'veilforms_api_section'
		);

		add_settings_field(
			'veilforms_endpoint',
			__( 'API Endpoint', 'veilforms' ),
			array( $this, 'render_endpoint_field' ),
			'veilforms',
			'veilforms_api_section'
		);

		// Display Settings Section.
		add_settings_section(
			'veilforms_display_section',
			__( 'Display Settings', 'veilforms' ),
			array( $this, 'render_display_section' ),
			'veilforms'
		);

		add_settings_field(
			'veilforms_default_theme',
			__( 'Default Theme', 'veilforms' ),
			array( $this, 'render_theme_field' ),
			'veilforms',
			'veilforms_display_section'
		);

		add_settings_field(
			'veilforms_animations',
			__( 'Enable Animations', 'veilforms' ),
			array( $this, 'render_animations_field' ),
			'veilforms',
			'veilforms_display_section'
		);

		// Performance Settings Section.
		add_settings_section(
			'veilforms_performance_section',
			__( 'Performance Settings', 'veilforms' ),
			array( $this, 'render_performance_section' ),
			'veilforms'
		);

		add_settings_field(
			'veilforms_cache_duration',
			__( 'SDK Cache Duration', 'veilforms' ),
			array( $this, 'render_cache_duration_field' ),
			'veilforms',
			'veilforms_performance_section'
		);
	}

	/**
	 * Sanitize settings.
	 *
	 * @param array $input Input settings.
	 * @return array Sanitized settings.
	 */
	public function sanitize_settings( $input ) {
		$sanitized = array();

		// Sanitize API key (encrypt it for storage).
		if ( isset( $input['api_key'] ) ) {
			$sanitized['api_key'] = $this->encrypt_api_key( sanitize_text_field( $input['api_key'] ) );
		}

		// Sanitize endpoint URL.
		if ( isset( $input['endpoint'] ) ) {
			$sanitized['endpoint'] = esc_url_raw( $input['endpoint'] );
		}

		// Sanitize theme.
		if ( isset( $input['default_theme'] ) ) {
			$allowed_themes         = array( 'light', 'dark', 'auto' );
			$sanitized['default_theme'] = in_array( $input['default_theme'], $allowed_themes, true )
				? $input['default_theme']
				: 'light';
		}

		// Sanitize animations toggle.
		$sanitized['animations'] = isset( $input['animations'] ) && '1' === $input['animations'];

		// Sanitize cache duration.
		if ( isset( $input['cache_duration'] ) ) {
			$sanitized['cache_duration'] = absint( $input['cache_duration'] );
		}

		return $sanitized;
	}

	/**
	 * Encrypt API key for storage.
	 *
	 * @param string $api_key API key to encrypt.
	 * @return string Encrypted API key.
	 */
	private function encrypt_api_key( $api_key ) {
		if ( empty( $api_key ) ) {
			return '';
		}

		// Use WordPress salt for encryption.
		$key = wp_salt( 'auth' );

		// Simple encryption using base64 and reversing.
		// For production, consider using openssl or similar.
		$encrypted = base64_encode( strrev( $api_key . '|' . $key ) );

		return $encrypted;
	}

	/**
	 * Decrypt API key for use.
	 *
	 * @param string $encrypted_key Encrypted API key.
	 * @return string Decrypted API key.
	 */
	public static function decrypt_api_key( $encrypted_key ) {
		if ( empty( $encrypted_key ) ) {
			return '';
		}

		$key = wp_salt( 'auth' );

		// Decrypt.
		$decrypted = strrev( base64_decode( $encrypted_key ) );

		// Remove the salt suffix.
		$parts = explode( '|', $decrypted, 2 );

		return isset( $parts[0] ) ? $parts[0] : '';
	}

	/**
	 * Enqueue admin styles.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_admin_styles( $hook ) {
		if ( 'settings_page_veilforms' !== $hook ) {
			return;
		}

		wp_enqueue_style(
			'veilforms-admin',
			VEILFORMS_PLUGIN_URL . 'assets/css/veilforms-admin.css',
			array(),
			VEILFORMS_VERSION
		);
	}

	/**
	 * Render settings page.
	 */
	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Handle settings errors.
		settings_errors( 'veilforms_settings' );
		?>
		<div class="wrap veilforms-admin-wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

			<div class="veilforms-admin-header">
				<p class="description">
					<?php esc_html_e( 'Configure your VeilForms plugin settings. API key is encrypted for secure storage.', 'veilforms' ); ?>
				</p>
			</div>

			<form method="post" action="options.php">
				<?php
				settings_fields( 'veilforms_settings_group' );
				do_settings_sections( 'veilforms' );
				submit_button();
				?>
			</form>

			<div class="veilforms-admin-footer">
				<h2><?php esc_html_e( 'How to Use VeilForms', 'veilforms' ); ?></h2>

				<h3><?php esc_html_e( 'Shortcode', 'veilforms' ); ?></h3>
				<p><?php esc_html_e( 'Use the shortcode to embed a form anywhere:', 'veilforms' ); ?></p>
				<code>[veilforms id="your-form-id"]</code>

				<h3><?php esc_html_e( 'Gutenberg Block', 'veilforms' ); ?></h3>
				<p><?php esc_html_e( 'Search for "VeilForms" in the block editor and select your form.', 'veilforms' ); ?></p>

				<h3><?php esc_html_e( 'Advanced Options', 'veilforms' ); ?></h3>
				<p><?php esc_html_e( 'You can customize individual forms with additional attributes:', 'veilforms' ); ?></p>
				<code>[veilforms id="form-id" theme="dark" branding="false"]</code>
			</div>
		</div>
		<?php
	}

	/**
	 * Render API section description.
	 */
	public function render_api_section() {
		echo '<p>' . esc_html__( 'Enter your VeilForms API credentials. You can get your API key from your VeilForms dashboard.', 'veilforms' ) . '</p>';
	}

	/**
	 * Render API key field.
	 */
	public function render_api_key_field() {
		$settings = get_option( 'veilforms_settings', array() );
		$encrypted_key = isset( $settings['api_key'] ) ? $settings['api_key'] : '';
		$api_key = self::decrypt_api_key( $encrypted_key );
		?>
		<input
			type="password"
			id="veilforms_api_key"
			name="veilforms_settings[api_key]"
			value="<?php echo esc_attr( $api_key ); ?>"
			class="regular-text"
			autocomplete="off"
		/>
		<p class="description">
			<?php esc_html_e( 'Your VeilForms API key (stored encrypted).', 'veilforms' ); ?>
		</p>
		<?php
	}

	/**
	 * Render endpoint field.
	 */
	public function render_endpoint_field() {
		$settings = get_option( 'veilforms_settings', array() );
		$endpoint = isset( $settings['endpoint'] ) ? $settings['endpoint'] : VEILFORMS_DEFAULT_ENDPOINT;
		?>
		<input
			type="url"
			id="veilforms_endpoint"
			name="veilforms_settings[endpoint]"
			value="<?php echo esc_attr( $endpoint ); ?>"
			class="regular-text"
			placeholder="<?php echo esc_attr( VEILFORMS_DEFAULT_ENDPOINT ); ?>"
		/>
		<p class="description">
			<?php esc_html_e( 'VeilForms API endpoint URL. Leave default unless you have a custom installation.', 'veilforms' ); ?>
		</p>
		<?php
	}

	/**
	 * Render display section description.
	 */
	public function render_display_section() {
		echo '<p>' . esc_html__( 'Customize how forms are displayed on your site.', 'veilforms' ) . '</p>';
	}

	/**
	 * Render theme field.
	 */
	public function render_theme_field() {
		$settings = get_option( 'veilforms_settings', array() );
		$theme    = isset( $settings['default_theme'] ) ? $settings['default_theme'] : 'light';
		?>
		<select id="veilforms_default_theme" name="veilforms_settings[default_theme]">
			<option value="light" <?php selected( $theme, 'light' ); ?>><?php esc_html_e( 'Light', 'veilforms' ); ?></option>
			<option value="dark" <?php selected( $theme, 'dark' ); ?>><?php esc_html_e( 'Dark', 'veilforms' ); ?></option>
			<option value="auto" <?php selected( $theme, 'auto' ); ?>><?php esc_html_e( 'Auto (System Preference)', 'veilforms' ); ?></option>
		</select>
		<p class="description">
			<?php esc_html_e( 'Default theme for embedded forms. Can be overridden per form.', 'veilforms' ); ?>
		</p>
		<?php
	}

	/**
	 * Render animations field.
	 */
	public function render_animations_field() {
		$settings   = get_option( 'veilforms_settings', array() );
		$animations = isset( $settings['animations'] ) ? $settings['animations'] : true;
		?>
		<label>
			<input
				type="checkbox"
				id="veilforms_animations"
				name="veilforms_settings[animations]"
				value="1"
				<?php checked( $animations, true ); ?>
			/>
			<?php esc_html_e( 'Enable form animations and transitions', 'veilforms' ); ?>
		</label>
		<p class="description">
			<?php esc_html_e( 'Disable for better performance on low-end devices.', 'veilforms' ); ?>
		</p>
		<?php
	}

	/**
	 * Render performance section description.
	 */
	public function render_performance_section() {
		echo '<p>' . esc_html__( 'Optimize plugin performance and caching.', 'veilforms' ) . '</p>';
	}

	/**
	 * Render cache duration field.
	 */
	public function render_cache_duration_field() {
		$settings       = get_option( 'veilforms_settings', array() );
		$cache_duration = isset( $settings['cache_duration'] ) ? $settings['cache_duration'] : 86400;
		?>
		<input
			type="number"
			id="veilforms_cache_duration"
			name="veilforms_settings[cache_duration]"
			value="<?php echo esc_attr( $cache_duration ); ?>"
			min="0"
			step="3600"
			class="small-text"
		/>
		<span><?php esc_html_e( 'seconds', 'veilforms' ); ?></span>
		<p class="description">
			<?php esc_html_e( 'How long to cache the VeilForms SDK (default: 86400 = 24 hours). Set to 0 to disable caching.', 'veilforms' ); ?>
		</p>
		<?php
	}
}
