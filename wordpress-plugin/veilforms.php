<?php
/**
 * Plugin Name: VeilForms
 * Plugin URI: https://veilforms.com
 * Description: Embed encrypted, privacy-first forms with VeilForms. Client-side encryption ensures your users' data stays secure.
 * Version: 1.0.0
 * Author: VeilForms
 * Author URI: https://veilforms.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: veilforms
 * Domain Path: /languages
 * Requires at least: 5.0
 * Requires PHP: 7.4
 *
 * @package VeilForms
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'VEILFORMS_VERSION', '1.0.0' );
define( 'VEILFORMS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'VEILFORMS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'VEILFORMS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
define( 'VEILFORMS_SDK_VERSION', '1.0.0' );
define( 'VEILFORMS_DEFAULT_ENDPOINT', 'https://veilforms.com' );

/**
 * Main VeilForms Plugin Class
 */
class VeilForms_Plugin {

	/**
	 * The single instance of the class.
	 *
	 * @var VeilForms_Plugin
	 */
	protected static $instance = null;

	/**
	 * Main VeilForms Instance.
	 *
	 * Ensures only one instance of VeilForms is loaded or can be loaded.
	 *
	 * @return VeilForms_Plugin - Main instance.
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
		$this->includes();
		$this->init_hooks();
	}

	/**
	 * Include required files.
	 */
	private function includes() {
		require_once VEILFORMS_PLUGIN_DIR . 'includes/class-veilforms-admin.php';
		require_once VEILFORMS_PLUGIN_DIR . 'includes/class-veilforms-shortcode.php';
		require_once VEILFORMS_PLUGIN_DIR . 'includes/class-veilforms-gutenberg.php';
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		// Activation and deactivation hooks.
		register_activation_hook( __FILE__, array( $this, 'activate' ) );
		register_deactivation_hook( __FILE__, array( $this, 'deactivate' ) );

		// Initialize components.
		add_action( 'plugins_loaded', array( $this, 'init' ) );

		// Add settings link to plugins page.
		add_filter( 'plugin_action_links_' . VEILFORMS_PLUGIN_BASENAME, array( $this, 'add_action_links' ) );
	}

	/**
	 * Initialize plugin components.
	 */
	public function init() {
		// Load text domain for translations.
		load_plugin_textdomain( 'veilforms', false, dirname( VEILFORMS_PLUGIN_BASENAME ) . '/languages' );

		// Initialize admin.
		if ( is_admin() ) {
			VeilForms_Admin::instance();
		}

		// Initialize shortcode.
		VeilForms_Shortcode::instance();

		// Initialize Gutenberg block.
		VeilForms_Gutenberg::instance();
	}

	/**
	 * Plugin activation.
	 */
	public function activate() {
		// Set default options.
		$default_options = array(
			'api_key'         => '',
			'default_theme'   => 'light',
			'animations'      => true,
			'cache_duration'  => 86400, // 24 hours in seconds
			'endpoint'        => VEILFORMS_DEFAULT_ENDPOINT,
		);

		if ( ! get_option( 'veilforms_settings' ) ) {
			add_option( 'veilforms_settings', $default_options );
		}

		// Flush rewrite rules.
		flush_rewrite_rules();
	}

	/**
	 * Plugin deactivation.
	 */
	public function deactivate() {
		// Flush rewrite rules.
		flush_rewrite_rules();
	}

	/**
	 * Add settings link to plugin actions.
	 *
	 * @param array $links Plugin action links.
	 * @return array Modified plugin action links.
	 */
	public function add_action_links( $links ) {
		$settings_link = '<a href="' . admin_url( 'options-general.php?page=veilforms' ) . '">' . __( 'Settings', 'veilforms' ) . '</a>';
		array_unshift( $links, $settings_link );
		return $links;
	}

	/**
	 * Get plugin option.
	 *
	 * @param string $key     Option key.
	 * @param mixed  $default Default value.
	 * @return mixed Option value.
	 */
	public static function get_option( $key, $default = false ) {
		$settings = get_option( 'veilforms_settings', array() );
		return isset( $settings[ $key ] ) ? $settings[ $key ] : $default;
	}

	/**
	 * Update plugin option.
	 *
	 * @param string $key   Option key.
	 * @param mixed  $value Option value.
	 * @return bool Whether the option was updated.
	 */
	public static function update_option( $key, $value ) {
		$settings         = get_option( 'veilforms_settings', array() );
		$settings[ $key ] = $value;
		return update_option( 'veilforms_settings', $settings );
	}
}

/**
 * Returns the main instance of VeilForms.
 *
 * @return VeilForms_Plugin
 */
function veilforms() {
	return VeilForms_Plugin::instance();
}

// Initialize the plugin.
veilforms();
