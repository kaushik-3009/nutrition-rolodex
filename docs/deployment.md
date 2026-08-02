# Deployment

Pantry Index is a static site. The repository is the source of truth, and GitHub Actions publishes the contents of `main` to GitHub Pages.

## First-time setup

1. Open the repository settings: <https://github.com/kaushik-3009/nutrition-rolodex/settings/pages>.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**. This creates the Pages site that the workflow deploys to.
3. Return to the **Actions** tab and run `Deploy Pantry Index to GitHub Pages` again if the first attempt failed with `Get Pages site failed`.
4. Open <https://kaushik-3009.github.io/nutrition-rolodex/>.

Future pushes to `main` will publish automatically. The workflow can also be started manually from the Actions tab.

## Verification

After a deployment, check both routes:

- `/nutrition-rolodex/`
- `/nutrition-rolodex/about.html`

The site uses relative asset paths so it works from the repository subpath used by GitHub Pages.
