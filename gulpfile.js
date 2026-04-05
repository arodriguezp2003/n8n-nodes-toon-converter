const { src, dest } = require('gulp');

function buildIcons() {
	// Icons must live next to the compiled .node.js files
	// because n8n resolves file: paths relative to the node file's directory
	return src('nodes/**/*.{svg,png}').pipe(dest('dist/nodes/'));
}

exports['build:icons'] = buildIcons;
