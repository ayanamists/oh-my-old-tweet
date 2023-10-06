const path = require('path');

module.exports = (env, argv) => {
  const config = {
    entry: './src/index.ts',
    mode: 'production',
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      filename: `index.${env.browser ? "browser" : "node"}.js`,
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'umd',
      library: 'twitter-data-parser',
      umdNamedDefine: true,
    },
    target: env.browser ? 'web' : 'node',
  }
  return config;
};
