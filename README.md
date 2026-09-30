# ShreeKart

ShreeKart Android-ready shopping app using Capacitor and the existing Supabase backend.

## Build APK

Push this repository to GitHub. The workflow in `.github/workflows/android-apk.yml` builds a debug APK with GitHub Actions. Open the Actions run and download the `ShreeKart-debug-apk` artifact.

## Backend

The web app uses the Supabase project configured in `www/config.js` with a publishable client key. Never add a Supabase service-role or other secret key to this repository.

Online payment gateway is not implemented; the current order flow supports the backend's configured methods.
