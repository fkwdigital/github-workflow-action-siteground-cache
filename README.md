# SiteGround Cache Manager

A GitHub Action to purge SiteGround caches (dynamic NGINX cache and Memcached object cache) directly from your CI/CD workflows.

Supports two operation modes:

- **`ssh` (default)** — Shared hosting. Connects via SSH and runs WP-CLI commands provided by the SG Optimizer plugin (which is preinstalled on every SiteGround WordPress site). This is the recommended approach for the vast majority of users.
- **`api`** — Agency-tier Site Tools API. Calls the SiteGround Site Tools REST API. Requires agency/reseller credentials.

## Features

- **Purge all caches** (default) — clears both dynamic and memcached
- **Purge dynamic cache only** — clears the SG Optimizer/NGINX page cache
- **Purge memcached only** — flushes the WP object cache
- **Passphrase-protected SSH keys** — supported (SiteGround keys created in Site Tools always have a passphrase)
- **`KNOWN_HOSTS` support** — strict host key verification when provided

## Quickstart

### SSH mode (shared hosting — most common)

```yaml
- name: Purge SiteGround Cache
  uses: fkwdigital/github-workflow-action-siteground-cache@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    SSH_PASSPHRASE: ${{ secrets.SSH_PASSPHRASE }}
    KNOWN_HOSTS: ${{ secrets.KNOWN_HOSTS }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    REMOTE_PATH: '/home/customer/www/example.com/public_html'
```

### API mode (agency-tier)

```yaml
- name: Purge SiteGround Cache (API)
  uses: fkwdigital/github-workflow-action-siteground-cache@v1
  with:
    MODE: 'api'
    SITEGROUND_API_TOKEN: ${{ secrets.SITEGROUND_API_TOKEN }}
    SITEGROUND_SITE_ID: ${{ secrets.SITEGROUND_SITE_ID }}
```

## Inputs

### Common

| Input        | Description                                               | Required | Default |
| ------------ | --------------------------------------------------------- | -------- | ------- |
| `MODE`       | Operation mode: `ssh` (default) or `api`                  | No       | `ssh`   |
| `CACHE_TYPE` | What to purge: `all` (default), `dynamic`, or `memcached` | No       | `all`   |

### SSH mode (`MODE=ssh`)

| Input             | Description                                                                                             | Required | Default |
| ----------------- | ------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `SSH_PRIVATE_KEY` | Private key contents                                                                                    | Yes      | -       |
| `REMOTE_HOST`     | SSH host (SiteGround server hostname or IP)                                                             | Yes      | -       |
| `REMOTE_USER`     | SSH username                                                                                            | Yes      | -       |
| `REMOTE_PATH`     | Absolute path to the WP install (e.g. `/home/customer/www/example.com/public_html`)                     | Yes      | -       |
| `SSH_PASSPHRASE`  | Passphrase for the private key. SiteGround keys created in Site Tools always have one.                  | No       | -       |
| `KNOWN_HOSTS`     | Output of `ssh-keyscan -H -p 18765 <host>`. Strongly recommended — omitting disables host verification. | No       | -       |
| `REMOTE_PORT`     | SSH port (SiteGround's default is 18765, not 22)                                                        | No       | `18765` |

### API mode (`MODE=api`)

| Input                  | Description                                                          | Required | Default                          |
| ---------------------- | -------------------------------------------------------------------- | -------- | -------------------------------- |
| `SITEGROUND_API_TOKEN` | OAuth bearer token for the Site Tools API (agency/reseller required) | Yes      | -                                |
| `SITEGROUND_SITE_ID`   | Site ID from Site Tools                                              | Yes      | -                                |
| `SITEGROUND_API_BASE`  | API base URL (override only if SiteGround changes endpoints)         | No       | `https://api.siteground.com/v00` |

## How it works

### SSH mode

1. Writes `SSH_PRIVATE_KEY` to `~/.ssh/siteground_cache_key` (mode `0600`).
2. If `SSH_PASSPHRASE` is provided, strips it in-place using `ssh-keygen -p` so `ssh -i` can use the key without an interactive prompt.
3. If `KNOWN_HOSTS` is provided, appends it to `~/.ssh/known_hosts` and uses `StrictHostKeyChecking=yes`.
4. Connects via SSH and runs the appropriate WP-CLI command(s) on the remote host.
5. Deletes the temporary key file on exit.

The remote commands are:

| `CACHE_TYPE` | Remote command                                                            |
| ------------ | ------------------------------------------------------------------------- |
| `all`        | `wp sg purge --path=<REMOTE_PATH> && wp cache flush --path=<REMOTE_PATH>` |
| `dynamic`    | `wp sg purge --path=<REMOTE_PATH>`                                        |
| `memcached`  | `wp cache flush --path=<REMOTE_PATH>`                                     |

`wp sg purge` is provided by the **SG Optimizer** plugin (preinstalled on all SiteGround WordPress sites). `wp cache flush` is a built-in WP-CLI command that flushes the persistent object cache (which uses Memcached on SiteGround when the SG Optimizer plugin's "Memcached" toggle is enabled).

### API mode

POSTs to `SITEGROUND_API_BASE/sites/<SITE_ID>/<resource>/flush` with a Bearer token, where `<resource>` is `dynamic-cache`, `memcached`, or both depending on `CACHE_TYPE`. This mode is intended for agency/reseller customers who already have a Site Tools API token.

## SiteGround setup

### Generate the SSH key (Site Tools)

1. Site Tools → **Devs** → **SSH Keys Manager**
2. Click **Create**
3. Set the **passphrase** (SiteGround requires one — there is no opt-out)
4. Download the private key
5. Upload the **private key** to GitHub Secrets as `SSH_PRIVATE_KEY` and the **passphrase** as `SSH_PASSPHRASE`

The matching public key is automatically authorized on the server.

### Get host details

- **`REMOTE_HOST`**: Site Tools → **Devs** → **SSH Keys Manager** → look at the example connection string. Or use your domain.
- **`REMOTE_USER`**: same place — typically of the form `u123-abc456`.
- **`REMOTE_PATH`**: Site Tools → **Site** → **File Manager**. The WP install path is usually `/home/customer/www/<domain>/public_html`.

### Get `KNOWN_HOSTS` (recommended)

Run locally once and paste the output into a GitHub secret:

```bash
ssh-keyscan -H -p 18765 your-siteground-host.com
```

Without `KNOWN_HOSTS`, the action falls back to `StrictHostKeyChecking=no`, which is vulnerable to MITM attacks.

## Common workflows

### Deploy then purge

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via rsync
        uses: fkwdigital/github-workflow-action-ubuntu-rsync@v1
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_PASSPHRASE: ${{ secrets.SSH_PASSPHRASE }}
          KNOWN_HOSTS: ${{ secrets.KNOWN_HOSTS }}
          REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          REMOTE_USER: ${{ secrets.REMOTE_USER }}
          REMOTE_PORT: 18765
          REMOTE_PATH: '/home/customer/www/example.com/public_html'
          SOURCE: './public/'

      - name: Purge SiteGround Cache
        uses: fkwdigital/github-workflow-action-siteground-cache@v1
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_PASSPHRASE: ${{ secrets.SSH_PASSPHRASE }}
          KNOWN_HOSTS: ${{ secrets.KNOWN_HOSTS }}
          REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          REMOTE_USER: ${{ secrets.REMOTE_USER }}
          REMOTE_PATH: '/home/customer/www/example.com/public_html'
```

### Purge dynamic cache only

```yaml
- name: Purge SiteGround Dynamic Cache
  uses: fkwdigital/github-workflow-action-siteground-cache@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    SSH_PASSPHRASE: ${{ secrets.SSH_PASSPHRASE }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    REMOTE_PATH: '/home/customer/www/example.com/public_html'
    CACHE_TYPE: 'dynamic'
```

### Manual purge (workflow_dispatch)

```yaml
name: Purge SiteGround Cache
on:
  workflow_dispatch:
    inputs:
      cache_type:
        type: choice
        options: [all, dynamic, memcached]
        default: all

jobs:
  purge:
    runs-on: ubuntu-latest
    steps:
      - uses: fkwdigital/github-workflow-action-siteground-cache@v1
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_PASSPHRASE: ${{ secrets.SSH_PASSPHRASE }}
          KNOWN_HOSTS: ${{ secrets.KNOWN_HOSTS }}
          REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          REMOTE_USER: ${{ secrets.REMOTE_USER }}
          REMOTE_PATH: '/home/customer/www/example.com/public_html'
          CACHE_TYPE: ${{ github.event.inputs.cache_type }}
```

## Troubleshooting

### Permission denied (publickey)

- Make sure the key was created in SiteGround Site Tools and matches the user/host you're connecting as.
- If the key has a passphrase, you must pass `SSH_PASSPHRASE`.
- SiteGround's default SSH port is **18765**, not 22.

### `wp: command not found`

WP-CLI is preinstalled on every SiteGround managed WordPress site. If you're getting this on a non-WP application or a self-managed environment, install WP-CLI on the remote first.

### `Error: This is not a WordPress installation`

`REMOTE_PATH` is wrong. It must be the directory containing `wp-config.php`. On SiteGround that's typically `/home/customer/www/<domain>/public_html`.

### `wp sg: not a registered subcommand`

The SG Optimizer plugin isn't installed/active on that WordPress site. Install **SG Optimizer** (it's free in the WP plugin directory) or use `CACHE_TYPE: memcached` to skip the SG-specific purge.

### API mode returns 404

The Site Tools API endpoint structure may differ depending on your agency tier. Override `SITEGROUND_API_BASE` if needed, or fall back to SSH mode.

## License

MIT

## Support

- **Action issues**: Open an issue on this repository
- **SiteGround SSH/SG Optimizer docs**: <https://www.siteground.com/kb/>
