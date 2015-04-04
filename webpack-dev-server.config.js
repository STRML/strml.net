var webpack = require("webpack");

module.exports = {
    context: __dirname,
    entry: [
      "webpack-dev-server/client?http://localhost:4003",
      "./app.js",
    ],
    output: {
      path: __dirname + "/dist",
      filename: "bundle.js",
      sourceMapFilename: "[file].map",
    },
    module: {
      loaders: [
        {test: /\.js?$/, exclude: /node_modules/, loader: 'babel-loader?stage=0'}
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
