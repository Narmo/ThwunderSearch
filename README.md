# ThwunderSearch

<img src="icons/thwundersearch.svg" width="64" height="64" alt="ThwunderSearch icon">

A small Thunderbird **157.x–158.x** extension that restyles **global search** results
as compact mail-style rows with a reading pane, without replacing the search
engine or its filters. Author: **Nikita Denin**.

- Click anywhere on a result to preview it on the right, without opening a tab.
- Sender, subject, date, recipients, excerpt, stars, tags and attachment names.
- Recipient names fall back to email addresses; absent recipients leave no empty label.
- Narrow result columns use stacked rows; narrow windows put the preview below.
- Bold unread messages, visible stars, keyboard focus and theme-aware colors.
- Independently scrolling filters, results and message content.
- Existing filters, timeline toggle, sorting, “Show more” and “Open as List” remain.
- A custom SVG icon in `icons/thwundersearch.svg`.
- No dependencies, background page, telemetry or stored settings.

Use **Up/Down** to move through results and **Enter/Space** to preview a focused
result. Double-click or Shift-click opens Thunderbird's original conversation
tab; Cmd/Ctrl-click opens it in the background. Filtering or sorting clears the
preview when its selected row is replaced, rather than leaving stale content.

The preview embeds Thunderbird's native message viewer, including its headers,
attachments and remote-content protections. Reading follows your existing
mark-as-read settings; uncached messages may be fetched from your mail server.

This is not the native mail-list widget: it does not add multi-selection,
column sorting or a draggable divider. Folder Quick Filter and the separate
“Search Messages” dialog are unchanged.

## Install

1. In Thunderbird, open **Tools → Add-ons and Themes → Extensions**.
2. Open the gear menu and choose **Install Add-on From File…**.
3. Select `dist/thwundersearch-1.1.1.xpi` and confirm the permission prompt.
4. Run a global search. Already-open search tabs are restyled too.

Disable or remove the extension to restore the original appearance immediately.
Accounts and preferences are unchanged. Messages can be marked read by the
native viewer according to your existing settings; disabling does not undo that.

## Why the broad permission prompt?

Thunderbird does not offer an ordinary extension API to restyle this internal
page. An **Experiment API** styles and enhances only
`chrome://messenger/content/glodaFacetView.xhtml`, embeds `about:message` and
removes its UI, event listeners and stylesheet on disable/removal.
Thunderbird consequently grants full application access. The extension reads
search-result metadata and passes message URIs to Thunderbird's native viewer;
it does not parse message HTML, collect mail or send it to an external service.
Only install a build whose source you trust.

Compatibility is deliberately capped at 158.x because the page's internal
markup is not a stable extension API. Recheck it before increasing the cap.
Third-party extensions that also restyle global search may conflict.

## Verification

Development checks use an isolated **Thunderbird 157.0.1 on macOS** profile
with local sample messages, never your accounts. The first release was checked
for light/dark colors, narrow windows, RTL layout, focus and stylesheet cleanup.
The reading-pane update is checked against the real native message viewer and
indexed search results, including recipient fallback and disable/removal.

Thunderbird 158.0 support was checked by comparing its internal files with
157.0.1: the global search page, its styles and scripts are unchanged, and the
message viewer only moved header actions to commands the preview already routes.

Not tested with a live IMAP account, encrypted mail or on Windows/Linux.

## License

Code and documentation are dedicated to the public domain under the
[Unlicense](LICENSE). The icon, `icons/thwundersearch.svg`, is separately
dedicated under [CC0 1.0 Universal](icons/LICENSE).

## Build

From this directory, with the standard `zip` command:

```sh
scripts/build.sh            # -> dist/thwundersearch-<version>.xpi
```

The XPI contains the five runtime files and both license notices; no build
tools or npm install are needed.

## Releases

Pushing a `v*` tag runs [the release workflow](.github/workflows/release.yml):
it checks the tag matches `manifest.json`, builds the XPI on GitHub, and
publishes a Release named after the tag with the XPI attached and generated
release notes. No extra secrets are needed; this project has no automated test
suite.

Bump `manifest.json` and commit it before tagging, for example:

```sh
git tag -a v1.2.0 -m "ThwunderSearch 1.2.0"
git push origin HEAD v1.2.0
```

The tagged commit must include the workflow for automatic releases. To release
an existing tag manually, use **Actions → Release → Run workflow**, select the
default branch, and enter the tag. The manual run builds that tag, not the latest
branch. This does not publish to addons.thunderbird.net.
