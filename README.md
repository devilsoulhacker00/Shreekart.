# ShreeKart

ShreeKart is a Capacitor 7 + Supabase shopping app with a real database-backed catalog, authentication, cart, wishlist, checkout, COD orders, reviews, addresses, seller/admin tools, and Android CI.

## Included

- Supabase authentication and profile roles
- Product catalog, search, category filter, price filter and sorting
- Product detail pages and ratings/reviews
- Cart and server-side price/stock validation
- Saved addresses
- COD checkout and order tracking
- Wishlist
- Admin product/order dashboard
- Seller dashboard with seller-owned product permissions
- GitHub Actions workflow that creates the Android project and builds a debug APK
- Password reset flow

## Setup

1. Create/configure a Supabase project.
2. Run `supabase_schema.sql` in the Supabase SQL editor.
3. Put the project's publishable/anon key in `www/config.js`.
4. Install dependencies with `npm install`.
5. Build/sync Android with `npx cap add android` and `npx cap sync android`.

Never put a Supabase service-role key in `www/config.js`. Only the publishable/anon key belongs in the client app.

## Important

Online payments are intentionally not faked. The checkout currently exposes COD as the working payment method. A real Razorpay/PhonePe/Stripe integration must use server-side order creation, signature verification, and webhooks before marking an order as paid.
