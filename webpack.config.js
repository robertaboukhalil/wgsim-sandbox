const CopyPlugin = require("copy-webpack-plugin")
const path = require("path")

module.exports = {
  context: path.resolve(__dirname, "."),
  devtool: "nosources-source-map",
  entry: "./index.js",
  target: "webworker",
  plugins: [
    new CopyPlugin([
      { from: "./wgsim/wgsim.wasm", to: "./worker/module.wasm" },
    ]),
  ],
  module: {
    rules: [
      // Emscripten JS files define a global. With `exports-loader` we can
      // load these files correctly (provided the global’s name is the same
      // as the file name).
      {
        test: /emscripten\.js$/,
        loader: "exports-loader",
      },
    ],
  },
  optimization: {
    minimize: false
  },
}
