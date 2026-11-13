# Publishing the game without the code

The game can be published from a **second, public repository that holds only the built game**
(the `dist/` folder: minified JavaScript, models, maps, pictures), while this repository, with
the source code, stays private.

## Development and publishing

- **Development** (`.github/workflows/deploy.yml`, "Test"): every push to `main` and every pull
  request is tested and built. **Nothing goes on the public site.** Each push to `main` goes on
  the **private test site** (below): `https://preview.<project>.pages.dev`, which only the
  people you allow can open, on a computer or a phone. The run's summary gives the address.
  (The built game is also kept for 14 days as a download: *Actions* → the run → *Artifacts* →
  `game`.)
- **Publishing** (`.github/workflows/publish.yml`, "Publish the game"): only when someone
  presses *Actions* → *Publish the game* → *Run workflow*. It tests and builds the chosen
  branch or tag again and puts it on the site. An optional note says what the version brings.

To put a version aside and be able to publish it again later (for example to go back to it),
tag it (*Releases* → *Draft a new release* → a tag such as `v1.0`), then choose that tag under
*Use workflow from* when publishing.

Until the variable `SITE_REPO` is set (step 3 below), publishing goes to this repository's
own GitHub Pages, as before.

## One-time setup (an organization owner or admin)

1. **Create the site repository.** On GitHub: *New repository*, owner
   `TagusNavyVirtualMuseum`, name for example `fragateiro-site`, **Public**, empty.

2. **Let this repository write to it.** Choose one:

   - **Deploy key (does not expire).** On a computer, run:

     ```bash
     ssh-keygen -t ed25519 -N "" -C fragateiro-site -f fragateiro-site-key
     ```

     It makes two files. In **fragateiro-site** → *Settings* → *Deploy keys* → *Add deploy key*:
     paste the contents of `fragateiro-site-key.pub`, tick **Allow write access**, save.
     In **fragateiro** → *Settings* → *Secrets and variables* → *Actions* → *New repository
     secret*: name `SITE_DEPLOY_KEY`, value the whole contents of `fragateiro-site-key` (the
     file without `.pub`). Then delete both files from the computer.

   - **Or a token (no command line, but it expires).** Your profile → *Settings* → *Developer
     settings* → *Fine-grained tokens* → *Generate new token*: resource owner
     `TagusNavyVirtualMuseum`, only the repository `fragateiro-site`, permission
     **Contents: Read and write**. In **fragateiro** → *Settings* → *Secrets and variables* →
     *Actions* → *New repository secret*: name `SITE_TOKEN`, value the token. Renew it before
     it expires.

3. **Tell the workflow where to publish.** In **fragateiro** → *Settings* → *Secrets and
   variables* → *Actions* → *Variables* tab → *New repository variable*: name `SITE_REPO`,
   value `TagusNavyVirtualMuseum/fragateiro-site`.

4. **Publish once.** In **fragateiro** → *Actions* → *Publish the game* → *Run workflow*. When
   it is green, `fragateiro-site` has a `gh-pages` branch with the built game.

5. **Turn on its web site.** In **fragateiro-site** → *Settings* → *Pages* → *Source*: *Deploy
   from a branch*, branch `gh-pages`, folder `/ (root)`, save. A minute later the game is at
   `https://tagusnavyvirtualmuseum.github.io/fragateiro-site/`.

6. **Close the old site and the code.** In **fragateiro** → *Settings* → *Pages*: unpublish
   the site. Then *Settings* → *General* → *Danger Zone* → *Change repository visibility* →
   **Private**.

### Keeping the old address

To keep `https://tagusnavyvirtualmuseum.github.io/fragateiro/`, swap the names: first rename
this repository (for example to `fragateiro-code`, *Settings* → *General*), then create the
public site repository with the name `fragateiro` in step 1, and use
`TagusNavyVirtualMuseum/fragateiro` as `SITE_REPO` in step 3. Old links to the game keep
working; clones of the code follow the rename automatically.

## The private test site (Cloudflare Pages and Cloudflare Access, free)

Done once, by you:

1. **A Cloudflare account.** Sign up at <https://dash.cloudflare.com/sign-up> (free).
2. **Its account ID.** In the dashboard, *Workers & Pages*: the *Account ID* is on the right
   (or in the address: `dash.cloudflare.com/<account id>/…`). In **fragateiro** → *Settings* →
   *Secrets and variables* → *Actions* → *New repository secret*: name
   `CLOUDFLARE_ACCOUNT_ID`, value the ID.
3. **A token for GitHub.** Cloudflare → your profile → *API Tokens* → *Create Token* → *Create
   Custom Token*: permission *Account* → *Cloudflare Pages* → *Edit*, for your account; create
   it. In **fragateiro**, a new repository secret: name `CLOUDFLARE_API_TOKEN`, value the token.
4. **A name for the test site.** In **fragateiro** → *Settings* → *Secrets and variables* →
   *Actions* → *Variables* → *New repository variable*: name `CLOUDFLARE_PROJECT`, value for
   example `fragateiro-test` (lower case, digits and hyphens; if the name is taken on
   pages.dev, Cloudflare adds a few letters, and the run's summary shows the real address).
5. **First test version.** *Actions* → *Test* → *Run workflow*. When it is green, the project
   exists on Cloudflare (*Workers & Pages*) with a preview at
   `https://preview.fragateiro-test.pages.dev`.
6. **Lock it.** In Cloudflare, *Workers & Pages* → the project → *Settings* → *General* →
   *Access policy* → **Enable access policy**. This puts Cloudflare Access in front of every
   preview (the first time, Cloudflare asks for a *team name* and a plan for *Zero Trust*:
   choose **Free**; it may ask for a card even for the free plan). Then *Zero Trust* →
   *Access* → *Applications* → the application for the project → *Policies* → edit the policy:
   *Include* → *Emails* → your address (and those of anyone else who should test, up to 50
   people on the free plan); save.
7. **Check.** Open `https://preview.fragateiro-test.pages.dev` in a private window: it should
   ask for an email address and send a code to it; an address not on the list gets nothing.

The project's main address (`https://fragateiro-test.pages.dev`) is never used (its production
branch is a name no push uses), so the only addresses are the protected previews. Each push
also gets its own address (`https://<code>.fragateiro-test.pages.dev`), equally protected, to
compare versions.

## Who can do what

| access | can |
|---|---|
| **write** on this (private) repository | see and change the code, push to `main` (tested, built and put on the test site, not published), download the built versions, and press *Publish the game* |
| an email on the Cloudflare Access list | play the test site (nothing else: no code, no GitHub) |
| **read** on this repository | see the code and the built versions; cannot push or publish |
| **write** on the site repository | change the public site directly, bypassing the tests: give it to nobody (the deploy key or token does the publishing) |
| nothing | play the game on the public site, and see the site repository's built files |

So collaborators normally get access to **this repository only**. To let only some of them
publish, set the variable `PUBLISHERS` (*Settings* → *Secrets and variables* → *Actions* →
*Variables*) to their GitHub user names, separated by spaces: anyone else's *Publish the game*
run stops before building. (Someone with write access could still change the workflow itself,
so give write access to people you trust; GitHub's paid plans add approval rules for this.)

## What visitors can still see

A browser game runs on the visitor's computer, so everything it uses is downloaded: the
minified code, the 3D models, the maps and the texts. The site repository holds exactly those
files and nothing more (no TypeScript, scripts, tests or documents; its history is only the
published versions). Keeping the
code private stops casual copying of the source, not someone determined to take the models.

The credits the data's licences require (OpenStreetMap, Copernicus) and the model authors stay
on the landing page and in the game.
