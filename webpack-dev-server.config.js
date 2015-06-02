var path = require('path');

module.exports = {
    context: __dirname,
    entry: [
      "webpack-dev-server/client?http://localhost:4003",
      "./app.js"
    ],
    output: {
      path: path.join(__dirname, "/dist"),
      filename: "bundle.js",
      sourceMapFilename: "[file].map"
    },
    module: {
      loaders: [
        {
          test: /\.js?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          query: {
            stage: 1,
            optional: ["runtime"]
          }
        }
      ]
    },
    plugins: [
    ],
    debug: true,
    devtool: 'eval',
    resolve: {
      extensions: ["", ".webpack.js", ".web.js", ".js", ".jsx"]
    }
};
