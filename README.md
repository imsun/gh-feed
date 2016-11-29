gh-feed
=======

Generate RSS feed from GitHub Issues.

[Check out this site](https://gh-feed.herokuapp.com)

## Why

Some engineers take GitHub Issues as blogs. It's easy to use, supporting Markdown, Git, code highlight, comments, notifications, and lots of fancy features. But there isn't a feed address for it. So I write this project.

## Usage

1. Open project's issues page on GitHub.
1. Paste its URL to the input field on gh-feed's index page, or just replace `github.com` with `gh-feed.herokuapp.com`
1. Get your feed address.

To customize your feed, you can add filters on issues page.

## To Run

### 1. Set Your GitHub Token (optional)

By default gh-feed uses GitHub API, but rate of requests is [limited by GitHub](https://developer.github.com/v3/#rate-limiting).

> For requests using Basic Authentication or OAuth, you can make up to 5,000 requests per hour. For unauthenticated requests, the rate limit allows you to make up to 60 requests per hour. Unauthenticated requests are associated with your IP address, and not the user making requests.

For higher rate, you need to create `config.js` as follows:

```
module.exports = {
    token: 'Your GitHub token'
}
```

You can use [personal access token](https://github.com/settings/tokens) or [register an application](https://github.com/settings/developers) and [generate a token](https://developer.github.com/v3/oauth_authorizations/#create-a-new-authorization) for it.

Once you runs out your requests, gh-feed will **load the full issues page** to generate feed, which costs much more than using GitHub API.

### 2. Run It

```
npm install && npm start
```

## License

MIT