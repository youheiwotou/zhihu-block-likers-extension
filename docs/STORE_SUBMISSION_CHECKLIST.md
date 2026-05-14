# Store Submission Checklist

## Product

- Extension name is "知乎黑名单同步".
- The listing clearly states that the extension only reads public GitHub Raw files.
- The listing clearly states that Zhihu page access only happens after a user starts blacklist export.
- The listing clearly states that blocking actions only run after explicit confirmation and from the runner page.

## Privacy

- Privacy policy mentions `chrome.storage.local` local caching.
- Privacy policy mentions GitHub Raw as the only third-party network service.
- Privacy policy mentions active-tab Zhihu page export and local export result caching.
- Privacy policy mentions batch blocking, local runner logs, and explicit confirmation.
- Privacy policy explains that public repository content is publicly readable.

## Permissions

- `activeTab` is justified by user-initiated export from the current Zhihu tab.
- `scripting` is justified by temporary export and profile-blocking script injection.
- `tabs` is justified by creating and reusing a Zhihu work tab for batch blocking.
- `storage` is justified by local configuration and cache storage.
- `https://raw.githubusercontent.com/*` is justified by public GitHub file sync.
- `https://www.zhihu.com/*` is justified by export and user-confirmed blocking automation.
- No automatic content script remains.

## QA

- Load the unpacked extension in Chrome and Edge.
- Sync a valid public repo with `index.json`.
- Confirm that text lists and JSON lists both parse.
- Confirm search and copy current list work.
- Confirm clear cache removes local list data but keeps form configuration.
- On a real Zhihu blacklist page, confirm export collects all pages and copy export result works.
- In dry-run mode, confirm runner detects the profile "屏蔽用户" button without clicking it.
- In real mode with a one-user limit, confirm runner clicks "屏蔽用户" and the modal "确定" button.
