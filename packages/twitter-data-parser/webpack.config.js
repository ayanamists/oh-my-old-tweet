const path = require('path');

module.exports = (env, argv) => {
  const index = `index${env.browser ? "" : ".node"}.js`;
  const config = {
    entry: './src/index.ts',
    mode: 'development',
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
      filename: index,
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'twitter-data-parser',
        type: "umd"
      },
    },
    target: env.browser ? 'web' : 'node',
  }
  return config;
};
