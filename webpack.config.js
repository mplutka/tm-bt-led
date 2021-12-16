const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const PACKAGE = require('./package.json');
const version = PACKAGE.version;
const outputDir = "./TmBTLed-" + version;
const generalConfig = {
  watchOptions: {
    aggregateTimeout: 600,
    ignored: /node_modules/,
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
      cleanOnceBeforeBuildPatterns: [path.resolve(__dirname, outputDir)],
    }),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    }),
    new CopyPlugin({
      patterns: [
        { from: "./*", to: "../", context: './static/',}
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: "node-loader",
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.mjs'],
  },
};

const nodeConfig = {
  entry: {
    launcher: './src/launcher.mjs', 
    test: './src/test.mjs',
    setup: './src/setup.mjs'
  },
  target: 'node',
  externals: [nodeExternals({
    // this WILL include `jquery` and `webpack/hot/dev-server` in the bundle, as well as `lodash/*`
    // allowlist: ['bindings', "process-list"]
  })],
  output: {
    path: path.resolve(__dirname, outputDir + '/lib'),
    filename: '[name].js',
    libraryTarget: 'umd',
    libraryExport: 'default',
  },
};

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    generalConfig.devtool = 'cheap-module-source-map';
  } else if (argv.mode === 'production') {
  } else {
    throw new Error('Specify env');
  }

  Object.assign(nodeConfig, generalConfig);

  return [nodeConfig];
};