(function (blocks, element, blockEditor, components, i18n) {
	'use strict';

	var el = element.createElement;
	var registerBlockType = blocks.registerBlockType;
	var InspectorControls = blockEditor.InspectorControls;
	var PanelBody = components.PanelBody;
	var TextControl = components.TextControl;
	var SelectControl = components.SelectControl;
	var ToggleControl = components.ToggleControl;
	var Placeholder = components.Placeholder;
	var __ = i18n.__;

	// Get settings from localized script.
	var settings = window.veilformsSettings || {};

	/**
	 * Register VeilForms Block
	 */
	registerBlockType('veilforms/form', {
		title: __('VeilForms', 'veilforms'),
		description: __('Embed an encrypted VeilForms form', 'veilforms'),
		icon: 'lock',
		category: 'embed',
		keywords: [
			__('form', 'veilforms'),
			__('veilforms', 'veilforms'),
			__('encrypted', 'veilforms'),
		],
		attributes: {
			formId: {
				type: 'string',
				default: '',
			},
			theme: {
				type: 'string',
				default: settings.defaultTheme || 'light',
			},
			branding: {
				type: 'boolean',
				default: true,
			},
			mode: {
				type: 'string',
				default: 'inline',
			},
		},

		/**
		 * Block editor interface
		 */
		edit: function (props) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;

			function onChangeFormId(newFormId) {
				setAttributes({ formId: newFormId });
			}

			function onChangeTheme(newTheme) {
				setAttributes({ theme: newTheme });
			}

			function onChangeBranding(newBranding) {
				setAttributes({ branding: newBranding });
			}

			function onChangeMode(newMode) {
				setAttributes({ mode: newMode });
			}

			// Block settings in the sidebar.
			var inspectorControls = el(
				InspectorControls,
				{},
				el(
					PanelBody,
					{
						title: __('Form Settings', 'veilforms'),
						initialOpen: true,
					},
					el(TextControl, {
						label: __('Form ID', 'veilforms'),
						value: attributes.formId,
						onChange: onChangeFormId,
						help: __('Enter your VeilForms form ID', 'veilforms'),
					}),
					el(SelectControl, {
						label: __('Theme', 'veilforms'),
						value: attributes.theme,
						options: [
							{ label: __('Light', 'veilforms'), value: 'light' },
							{ label: __('Dark', 'veilforms'), value: 'dark' },
							{ label: __('Auto', 'veilforms'), value: 'auto' },
						],
						onChange: onChangeTheme,
					}),
					el(SelectControl, {
						label: __('Display Mode', 'veilforms'),
						value: attributes.mode,
						options: [
							{ label: __('Inline', 'veilforms'), value: 'inline' },
							{ label: __('Popup', 'veilforms'), value: 'popup' },
							{ label: __('Full Page', 'veilforms'), value: 'fullpage' },
						],
						onChange: onChangeMode,
					}),
					el(ToggleControl, {
						label: __('Show VeilForms Branding', 'veilforms'),
						checked: attributes.branding,
						onChange: onChangeBranding,
					})
				)
			);

			// Block preview in the editor.
			var blockPreview;

			if (!attributes.formId) {
				// Show placeholder when form ID is not set.
				blockPreview = el(
					Placeholder,
					{
						icon: 'lock',
						label: __('VeilForms', 'veilforms'),
						instructions: __(
							'Enter a form ID in the block settings to embed a VeilForms form.',
							'veilforms'
						),
					},
					el(TextControl, {
						placeholder: __('Form ID', 'veilforms'),
						value: attributes.formId,
						onChange: onChangeFormId,
					})
				);
			} else {
				// Show preview when form ID is set.
				blockPreview = el(
					'div',
					{
						className: 'veilforms-block-preview',
						style: {
							padding: '2rem',
							background: '#f5f5f5',
							border: '2px dashed #ccc',
							borderRadius: '8px',
							textAlign: 'center',
						},
					},
					el(
						'div',
						{
							style: {
								fontSize: '3rem',
								marginBottom: '1rem',
							},
						},
						'🔒'
					),
					el(
						'h3',
						{
							style: {
								margin: '0 0 0.5rem 0',
								color: '#333',
							},
						},
						__('VeilForms Encrypted Form', 'veilforms')
					),
					el(
						'p',
						{
							style: {
								margin: '0 0 1rem 0',
								color: '#666',
							},
						},
						__('Form ID:', 'veilforms') + ' ' + attributes.formId
					),
					el(
						'div',
						{
							style: {
								fontSize: '0.875rem',
								color: '#999',
							},
						},
						el(
							'div',
							{},
							__('Theme:', 'veilforms') + ' ' + attributes.theme
						),
						el(
							'div',
							{},
							__('Mode:', 'veilforms') + ' ' + attributes.mode
						),
						el(
							'div',
							{},
							__('Branding:', 'veilforms') +
								' ' +
								(attributes.branding ? __('Yes', 'veilforms') : __('No', 'veilforms'))
						)
					),
					el(
						'p',
						{
							style: {
								marginTop: '1rem',
								fontSize: '0.875rem',
								color: '#666',
							},
						},
						__('Form will be rendered on the frontend', 'veilforms')
					)
				);
			}

			return el(
				'div',
				{ className: props.className },
				inspectorControls,
				blockPreview
			);
		},

		/**
		 * Save block (we use server-side rendering)
		 */
		save: function () {
			// Return null to use server-side rendering.
			return null;
		},
	});
})(
	window.wp.blocks,
	window.wp.element,
	window.wp.blockEditor,
	window.wp.components,
	window.wp.i18n
);
