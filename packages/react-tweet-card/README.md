# react-tweet-card

[![NPM](https://img.shields.io/npm/v/react-tweet-card.svg)](https://www.npmjs.com/package/react-tweet-card)

A Tweet Card component you can use easily in your React projects. It doesn't rely on the Twitter API but instead lets you feed in all information about the tweet you're displaying. This way you can create cards for fictional tweets or tweets that have been deleted.

[:bird: Demo and documentation](https://zorapeteri.github.io/react-tweet-card)

<img width="500" src="https://user-images.githubusercontent.com/52820291/220779168-86941d24-8b52-4fce-9a21-dc4789475e9b.png">

<img width="500" src="https://user-images.githubusercontent.com/52820291/220778178-f7b34709-8fac-4fef-a058-e10cb57adfc4.png">


---

## Installation

```bash
npm i react-tweet-card
# or
yarn add react-tweet-card
```

## Features

- [X] Responsive component
- [X] Component scales to fit inside any container
- [X] Light, dim and dark themes
- [X] Dark mode preference support
- [X] Gradient and blurred container styles
- [X] styled-components and emotion support
- [X] TypeScript support
- [X] Support for images in tweet
- [X] Support for verified and protected Twitter accounts
- [X] Support for @mentions in tweet
- [X] Support for links in tweet
- [X] Support for hashtags in tweet
- [X] Display number of replies, retweets and likes

## Server-side rendering

`react-tweet-card` can only be rendered on the client side as it loads its CSS directly into the DOM.
To make it work with SSR, try importing the package dynamically.

## Design credits

Component layout is based on [Tweety by Ashwin G](https://www.figma.com/community/file/1028255898372668126)
