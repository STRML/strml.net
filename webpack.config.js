'use strict';
var path = require('path');

// Builds bundle usable inside <script>.
module.exports = {
  context: __dirname,
  mode: 'production',
  entry: {
    'app': './app.js',
    'ai': './ai.js'
  },
  output: {
    path: path.join(__dirname, "/dist"),
    filename: "[name].js",
    libraryTarget: "umd",
    library: "app",
  },
  devtool: 'source-map',
  // The .css and .html files are shown to the visitor as text, so webpack
  // must not parse or minify them.
  experiments: {
    css: false,
    html: false,
  },
  module: {
    rules: [
      {
        resourceQuery: /raw/,
        type: 'asset/source',
      },
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          cacheDirectory: true,
        }
      }
    ]
  },
  devServer: {
    static: { directory: __dirname },
    devMiddleware: { publicPath: '/dist' },
    compress: true,
    port: 4003,
  },
  optimization: {
    minimize: true
  },
};
