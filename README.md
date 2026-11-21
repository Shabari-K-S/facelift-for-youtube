# Facelift for YouTube

Facelift is a Firefox and Zen Browser extension that gives YouTube a compact video grid, a narrower column for search results, and a charcoal palette in dark mode. It keeps YouTube's native player, including theater and fullscreen modes.

## What you can hide

- **Shorts and Playables:** Hide their cards, shelves, and navigation entries without hiding regular gaming videos.
- **Membership promotions:** Remove the “Get more from memberships” shelf from Home.
- **Sidebar channels:** Keep the Subscriptions link without the list of channels or its “Show more” row. This does not unsubscribe you from any channel.
- **Buttons:** Hide Voice search, Thanks, Download, and Join individually. Search, Subscribe, Share, and Save stay available.

The layout and filters are on by default. Use the toolbar popup to change them independently; open YouTube tabs update without a reload.

## Privacy

Facelift runs only on `www.youtube.com` and `m.youtube.com`. Its only API permission is `storage`, used to save preferences on your device. The extension makes no external network requests and does not collect viewing history or telemetry.

## Try it from source

Use Firefox 140+ or a Zen release based on Firefox 140+. From a checkout of this repository, build the extension with Node.js 22.18+ and npm:

```sh
npm ci
npm run build
```

1. Open `about:debugging#/runtime/this-firefox` in Firefox or Zen.
2. Choose **Load Temporary Add-on** and select `dist/manifest.json`, which the build just created.
3. Open YouTube or reload an existing YouTube tab once.

This installation lasts until the browser restarts. For a permanent installation, use a Mozilla-signed XPI, not the unsigned development build.

Licensed under the [MIT License](LICENSE).
