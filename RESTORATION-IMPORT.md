# Historical restoration import

Reference: [ETCETER4 commit `7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0`](https://github.com/unnamedplay-r/etceter4/commit/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0), 20 July 2017.

The verified standalone restoration is packaged as `hole-loop-2017.zip` in the ChatGPT project delivery, including `hole-loop.bundle` (Git history) and the self-contained `hole-loop/public/` website. **The complete restored site is not yet present in this GitHub repository.**

## Import

On a machine with Git and GitHub write access, extract the ZIP and run:

```bash
git clone hole-loop.bundle timed-text-navigation-loop-restored
cd timed-text-navigation-loop-restored
git remote remove origin
git remote add origin https://github.com/4444J99/timed-text-navigation-loop.git
git push origin main:refs/heads/restoration-2017
git push origin 'refs/tags/*'
```

Then compare the `restoration-2017` branch against `main` and make it the primary source of the project. The standalone entry is `public/index.html`, with `public/loophole.html` retaining the historical path. For GitHub Pages, deploy `public/` as the website root using Actions; GitHub Pages branch publishing does not support `public/` as a direct source folder.

Preserve the 2017 edition separately from future compositional expansions.
