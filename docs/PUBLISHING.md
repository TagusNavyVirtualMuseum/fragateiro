# Publishing the game without the code

The game can be published from a **second, public repository that holds only the built game**
(the `dist/` folder: minified JavaScript, models, maps, pictures), while this repository, with
the source code, stays private. Every push to `main` builds and tests the game here and pushes
the result to the site repository, which GitHub Pages serves for free.

The workflow is already in place (`.github/workflows/deploy.yml`). Until the variable
`SITE_REPO` is set (step 3), the game keeps being published from this repository as before.

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

4. **Publish once.** In **fragateiro** → *Actions* → *Test and deploy* → *Run workflow*. When it
   is green, `fragateiro-site` has a `gh-pages` branch with the built game.

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

## What visitors can still see

A browser game runs on the visitor's computer, so everything it uses is downloaded: the
minified code, the 3D models, the maps and the texts. The site repository holds exactly those
files and nothing more (no TypeScript, scripts, tests, documents or history). Keeping the
code private stops casual copying of the source, not someone determined to take the models.

The credits the data's licences require (OpenStreetMap, Copernicus) and the model authors stay
on the landing page and in the game.
