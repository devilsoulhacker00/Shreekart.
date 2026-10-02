"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Product = {
  id: string;
  name: string;
  category?: string;
  category_id?: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
  description?: string | null;
  rating_avg?: number | null;
  is_active?: boolean;
};

type Order = {
  id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total: number;
  shipping_address: any;
  created_at: string;
};

type Address = {
  id: string;
  label: string;
  full_address: string;
  city?: string;
  state?: string;
  pincode?: string;
  is_default?: boolean;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sb = url && key ? createClient(url, key) : null;

async function getMyRole() {
  if (!sb) return null;
  const { data, error } = await sb.rpc("get_my_role");
  if (error) return null;
  return data as string | null;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [view, setView] = useState<"shop" | "cart" | "account" | "orders" | "addresses" | "wishlist" | "admin">("shop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [user, setUser] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [address, setAddress] = useState({ label: "Home", full_address: "", city: "", state: "", pincode: "" });

  // Phone OTP states
  const [loginMode, setLoginMode] = useState<"email" | "phone">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!sb) {
      setError("Supabase environment variables are missing.");
      setLoading(false);
      return;
    }
    sb.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadPrivate(data.user.id);
        setIsAdmin((await getMyRole()) === "admin");
      }
    });
    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        loadPrivate(nextUser.id);
        setIsAdmin((await getMyRole()) === "admin");
      } else {
        setIsAdmin(false);
        setOrders([]);
        setAddresses([]);
        setWishlist([]);
      }
    });
    sb.from("products")
      .select("*,categories(name)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else
          setProducts(
            (data || []).map((p: any) => ({
              ...p,
              category: p.categories?.name || p.category || "General",
            }))
          );
        setLoading(false);
      });
    return () => authListener.subscription.unsubscribe();
  }, []);

  async function loadPrivate(uid: string) {
    if (!sb) return;
    const [o, a, w] = await Promise.all([
      sb.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      sb.from("addresses").select("*").eq("user_id", uid).order("is_default", { ascending: false }),
      sb.from("wishlists").select("product_id").eq("user_id", uid),
    ]);
    if (!o.error) setOrders(o.data || []);
    if (!a.error) setAddresses(a.data || []);
    if (!w.error) setWishlist((w.data || []).map((x: any) => x.product_id));
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || "General"));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if ((p as any).is_active === false) return false;
      const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const matchC = cat === "All" || p.category === cat;
      return matchQ && matchC;
    });
  }, [products, q, cat]);

  const total = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find((x) => x.id === id);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [cart, products]);

  function addToCart(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }

  async function toggleWish(id: string) {
    if (!sb || !user) {
      setView("account");
      setMsg("Please sign in to use wishlist.");
      return;
    }
    if (wishlist.includes(id)) {
      await sb.from("wishlists").delete().eq("user_id", user.id).eq("product_id", id);
      setWishlist((t) => t.filter((x) => x !== id));
    } else {
      await sb.from("wishlists").insert({ user_id: user.id, product_id: id });
      setWishlist((t) => [...t, id]);
    }
  }

  // Email Auth
  async function auth(mode: "login" | "signup") {
    if (!sb) return;
    setBusy(true);
    setMsg("");
    const r =
      mode === "login"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else {
      setUser(r.data.user);
      if (r.data.user) {
        await loadPrivate(r.data.user.id);
        setIsAdmin((await getMyRole()) === "admin");
      }
      setMsg(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in.");
    }
  }

  // Phone OTP Auth
  async function sendOtp() {
    if (!sb) return;
    const cleaned = phone.replace(/\s+/g, "");
    if (!cleaned || cleaned.length < 10) {
      setMsg("Please enter a valid mobile number (e.g. +9198xxxxxxxx)");
      return;
    }
    const fullPhone = cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
    setBusy(true);
    setMsg("");
    const { error } = await sb.auth.signInWithOtp({ phone: fullPhone });
    setBusy(false);
    if (error) {
      setMsg(error.message + " — Enable Phone provider + SMS in Supabase Dashboard first.");
    } else {
      setOtpSent(true);
      setPhone(fullPhone);
      setMsg("OTP sent! Check your SMS.");
    }
  }

  async function verifyOtp() {
    if (!sb || !otp) return;
    setBusy(true);
    setMsg("");
    const { data, error } = await sb.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setUser(data.user);
      if (data.user) {
        await loadPrivate(data.user.id);
        setIsAdmin((await getMyRole()) === "admin");
      }
      setMsg("Logged in successfully with mobile!");
      setOtpSent(false);
      setOtp("");
    }
  }

  async function saveAddress() {
    if (!sb || !user) return;
    if (!address.full_address) {
      setMsg("Full address is required.");
      return;
    }
    setBusy(true);
    const r = await sb.from("addresses").insert({
      ...address,
      user_id: user.id,
      is_default: addresses.length === 0,
    });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else {
      setMsg("Address saved.");
      setAddress({ label: "Home", full_address: "", city: "", state: "", pincode: "" });
      loadPrivate(user.id);
    }
  }

  async function placeOrder() {
    if (!sb || !user) {
      setView("account");
      setMsg("Please login first.");
      return;
    }
    const items = Object.entries(cart).map(([id, qty]) => ({ product_id: id, quantity: qty }));
    if (!items.length) {
      setMsg("Cart is empty.");
      return;
    }
    const defaultAddr = addresses.find((a) => a.is_default) || addresses[0];
    if (!defaultAddr) {
      setView("addresses");
      setMsg("Please add a delivery address first.");
      return;
    }
    setBusy(true);
    const { error } = await sb.rpc("place_order", {
      p_items: items,
      p_delivery_address: defaultAddr,
      p_payment_method: "cod",
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setCart({});
      await loadPrivate(user.id);
      setView("orders");
      setMsg("Order placed successfully (COD).");
    }
  }

  function refreshProducts() {
    sb?.from("products")
      .select("*,categories(name)")
      .order("created_at", { ascending: false })
      .then(({ data }) =>
        setProducts(
          (data || []).map((p: any) => ({
            ...p,
            category: p.categories?.name || p.category || "General",
          }))
        )
      );
  }

  if (view === "admin" && isAdmin) {
    return (
      <Admin
        products={products}
        onDone={() => {
          setView("shop");
          refreshProducts();
        }}
      />
    );
  }

  return (
    <main>
      <header>
        <div className="brand" onClick={() => setView("shop")}>
          Shree<span>Kart</span>
        </div>
        <input
          placeholder="Search products, brands and more"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="navbtn" onClick={() => setView("orders")}>
          📦 Orders
        </button>
        <button className="navbtn" onClick={() => setView("wishlist")}>
          ♡ {wishlist.length}
        </button>
        <button className="navbtn" onClick={() => setView("account")}>
          👤 {user ? "Account" : "Login"}
        </button>
        <button className="navbtn" onClick={() => setView("cart")}>
          🛒 {Object.keys(cart).length}
        </button>
        {isAdmin && (
          <button className="navbtn" onClick={() => setView("admin")}>
            ⚙️ Admin
          </button>
        )}
      </header>

      {msg && <p className="toast">{msg}</p>}
      {error && (
        <div className="error state">
          <b>Error</b>
          <small>{error}</small>
        </div>
      )}

      {view === "shop" && (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">SHREEKART</p>
              <h1>Shop More, Live Better.</h1>
              <p>Fresh catalog, secure accounts, orders and COD checkout.</p>
            </div>
            <div className="heroIcon">🛍️</div>
          </section>
          <section className="cats">
            {categories.map((c) => (
              <button key={c} className={cat === c ? "selected" : ""} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </section>
          {loading ? (
            <div className="state">Loading products…</div>
          ) : (
            <div className="grid">
              {filtered.map((p) => (
                <div className="card" key={p.id}>
                  <div className="photo">
                    {p.image_url ? <img src={p.image_url} alt={p.name} /> : "🛍️"}
                    <button className="heart" onClick={() => toggleWish(p.id)}>
                      {wishlist.includes(p.id) ? "❤️" : "🤍"}
                    </button>
                  </div>
                  <div className="body">
                    <small>{p.category}</small>
                    <h3>{p.name}</h3>
                    <strong>₹{Number(p.price).toLocaleString("en-IN")}</strong>
                    <p>Stock: {p.stock}</p>
                    <button disabled={p.stock <= 0} onClick={() => addToCart(p.id)}>
                      {p.stock <= 0 ? "Out of stock" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === "cart" && (
        <section className="panel">
          <h2>Your Cart</h2>
          {!Object.keys(cart).length ? (
            <p>Cart is empty.</p>
          ) : (
            Object.entries(cart).map(([id, qty]) => {
              const p = products.find((x) => x.id === id);
              if (!p) return null;
              return (
                <div className="row" key={id}>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      ₹{p.price} × {qty}
                    </small>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) - 1) }))
                      }
                    >
                      -
                    </button>
                    <span style={{ margin: "0 8px" }}>{qty}</span>
                    <button onClick={() => addToCart(id)}>+</button>
                  </div>
                  <button
                    onClick={() =>
                      setCart((c) => {
                        const n = { ...c };
                        delete n[id];
                        return n;
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              );
            })
          )}
          <div className="actions">
            <b>Total: ₹{total.toLocaleString("en-IN")}</b>
            <button className="primary" disabled={busy || !Object.keys(cart).length} onClick={placeOrder}>
              Place Order (COD)
            </button>
          </div>
        </section>
      )}

      {view === "account" && (
        <section className="panel">
          {user ? (
            <>
              <h2>My Account</h2>
              <p>
                Signed in as <b>{user.phone || user.email}</b>
              </p>
              <div className="actions">
                <button onClick={() => setView("orders")}>📦 My Orders</button>
                <button onClick={() => setView("addresses")}>📍 Addresses</button>
                <button onClick={() => setView("wishlist")}>♡ Wishlist</button>
                {isAdmin && <button onClick={() => setView("admin")}>⚙️ Admin Panel</button>}
                <button
                  onClick={async () => {
                    await sb?.auth.signOut();
                    setUser(null);
                    setOrders([]);
                    setAddresses([]);
                    setWishlist([]);
                    setIsAdmin(false);
                    setView("shop");
                    setMsg("Signed out.");
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Login / Create Account</h2>

              <div className="actions" style={{ marginBottom: 12 }}>
                <button
                  className={loginMode === "phone" ? "primary" : ""}
                  onClick={() => {
                    setLoginMode("phone");
                    setMsg("");
                    setOtpSent(false);
                  }}
                >
                  📱 Mobile OTP
                </button>
                <button
                  className={loginMode === "email" ? "primary" : ""}
                  onClick={() => {
                    setLoginMode("email");
                    setMsg("");
                  }}
                >
                  ✉️ Email
                </button>
              </div>

              {loginMode === "phone" ? (
                <>
                  {!otpSent ? (
                    <>
                      <input
                        className="field"
                        type="tel"
                        placeholder="Mobile number (+91xxxxxxxxxx)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <div className="actions">
                        <button className="primary" disabled={busy} onClick={sendOtp}>
                          Send OTP
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="notice">OTP sent to {phone}</p>
                      <input
                        className="field"
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength={8}
                      />
                      <div className="actions">
                        <button className="primary" disabled={busy} onClick={verifyOtp}>
                          Verify & Login
                        </button>
                        <button
                          onClick={() => {
                            setOtpSent(false);
                            setOtp("");
                            setMsg("");
                          }}
                        >
                          Change Number
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <input
                    className="field"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    className="field"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="actions">
                    <button className="primary" disabled={busy} onClick={() => auth("login")}>
                      Login
                    </button>
                    <button onClick={() => auth("signup")}>Create account</button>
                  </div>
                </>
              )}
            </>
          )}
          {msg && <p className="notice">{msg}</p>}
        </section>
      )}

      {view === "orders" && (
        <section className="panel">
          <h2>My Orders</h2>
          {!user ? (
            <p>Please login to see orders.</p>
          ) : !orders.length ? (
            <p>No orders yet.</p>
          ) : (
            orders.map((o) => (
              <div className="order" key={o.id}>
                <div>
                  <b>#{o.id.slice(0, 8)}</b>
                  <span>{new Date(o.created_at).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  Status: <b>{o.status}</b> · Payment: {o.payment_method?.toUpperCase()}
                </div>
                <div>Total: ₹{Number(o.total).toLocaleString("en-IN")}</div>
              </div>
            ))
          )}
        </section>
      )}

      {view === "addresses" && (
        <section className="panel">
          <h2>Saved Addresses</h2>
          {addresses.map((a) => (
            <div className="row" key={a.id}>
              <div>
                <b>{a.label}</b>
                <small>
                  {a.full_address}, {a.city} {a.pincode}
                </small>
              </div>
              {a.is_default && <strong>Default</strong>}
            </div>
          ))}
          <h3>Add New Address</h3>
          <input
            className="field"
            placeholder="Label (Home/Work)"
            value={address.label}
            onChange={(e) => setAddress({ ...address, label: e.target.value })}
          />
          <textarea
            className="field"
            placeholder="Full address"
            value={address.full_address}
            onChange={(e) => setAddress({ ...address, full_address: e.target.value })}
          />
          <div className="two">
            <input
              className="field"
              placeholder="City"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
            <input
              className="field"
              placeholder="Pincode"
              value={address.pincode}
              onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
            />
          </div>
          <button className="primary" disabled={busy} onClick={saveAddress}>
            Save Address
          </button>
        </section>
      )}

      {view === "wishlist" && (
        <section className="panel">
          <h2>Wishlist</h2>
          <div className="wishlist">
            {wishlist.length === 0 ? (
              <p>No items in wishlist.</p>
            ) : (
              wishlist.map((id) => {
                const p = products.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <div className="wish" key={id}>
                    <div>
                      <b>{p.name}</b>
                      <small>₹{p.price}</small>
                    </div>
                    <button onClick={() => addToCart(id)}>Add to Cart</button>
                    <button onClick={() => toggleWish(id)}>Remove</button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      <footer>
        <b>Cart total: ₹{total.toLocaleString("en-IN")}</b>
        <span>ShreeKart · Supabase powered</span>
      </footer>
    </main>
  );
}

/* ===================== ADMIN PANEL ===================== */
function Admin({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const [tab, setTab] = useState<"products" | "orders" | "users">("products");
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    stock: "",
    image_url: "",
    description: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const [o, u] = await Promise.all([
        sb.from("orders").select("*").order("created_at", { ascending: false }),
        sb.from("profiles").select("*").order("created_at", { ascending: false }),
      ]);
      if (!o.error) setOrders(o.data || []);
      if (!u.error) setUsers(u.data || []);
    })();
  }, []);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      category: p.category || "",
      price: String(p.price ?? ""),
      stock: String(p.stock ?? 0),
      image_url: p.image_url || "",
      description: (p as any).description || "",
    });
    setNote("Editing product…");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: "", category: "", price: "", stock: "", image_url: "", description: "" });
    setNote("");
  }

  async function saveProduct() {
    if (!sb || !form.name || !form.price) {
      setNote("Name and price are required.");
      return;
    }
    setBusy(true);
    let category_id: any = null;

    if (form.category) {
      const found = await sb.from("categories").select("id").eq("name", form.category).maybeSingle();
      if (found.data) {
        category_id = found.data.id;
      } else {
        const created = await sb.from("categories").insert({ name: form.category }).select("id").single();
        if (created.error) {
          setBusy(false);
          setNote(created.error.message);
          return;
        }
        category_id = created.data.id;
      }
    }

    const payload: any = {
      name: form.name,
      category_id,
      price: Number(form.price),
      stock: Number(form.stock || 0),
      image_url: form.image_url || null,
      description: form.description || null,
    };

    let r;
    if (editingId) {
      r = await sb.from("products").update(payload).eq("id", editingId);
    } else {
      payload.is_active = true;
      r = await sb.from("products").insert(payload);
    }

    setBusy(false);
    if (r.error) {
      setNote(r.error.message);
    } else {
      setNote(editingId ? "Product updated successfully." : "Product added successfully.");
      cancelEdit();
      onDone();
    }
  }

  async function deleteProduct(id: string, name: string) {
    if (!sb) return;
    if (!confirm(`Delete product "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const r = await sb.from("products").delete().eq("id", id);
    setBusy(false);
    if (r.error) setNote(r.error.message);
    else {
      setNote("Product deleted.");
      if (editingId === id) cancelEdit();
      onDone();
    }
  }

  async function updateStock(id: string, stock: number) {
    if (!sb) return;
    const r = await sb.from("products").update({ stock }).eq("id", id);
    setNote(r.error ? r.error.message : "Stock updated.");
    if (!r.error) onDone();
  }

  async function toggleProduct(p: Product) {
    if (!sb) return;
    const r = await sb.from("products").update({ is_active: !(p as any).is_active }).eq("id", p.id);
    setNote(r.error ? r.error.message : "Product updated.");
    if (!r.error) onDone();
  }

  async function updateOrder(id: string, status: string) {
    if (!sb) return;
    const r = await sb.from("orders").update({ status }).eq("id", id);
    setNote(r.error ? r.error.message : "Order status updated.");
    if (!r.error) setOrders((x) => x.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  return (
    <section className="admin">
      <div className="adminHead">
        <div>
          <p className="eyebrow">SHREEKART ADMIN</p>
          <h2>Store Management</h2>
        </div>
        <button onClick={onDone}>← Store</button>
      </div>

      <div className="adminTabs">
        <button className={tab === "products" ? "selected" : ""} onClick={() => setTab("products")}>
          Products
        </button>
        <button className={tab === "orders" ? "selected" : ""} onClick={() => setTab("orders")}>
          Orders ({orders.length})
        </button>
        <button className={tab === "users" ? "selected" : ""} onClick={() => setTab("users")}>
          Customers ({users.length})
        </button>
      </div>

      {note && <p className="notice">{note}</p>}

      {tab === "products" && (
        <div className="adminGrid">
          <div className="panel">
            <h3>{editingId ? "Edit Product" : "Add Product"}</h3>
            <input
              className="field"
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="field"
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <input
              className="field"
              type="number"
              placeholder="Price"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              className="field"
              type="number"
              placeholder="Stock"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
            <input
              className="field"
              placeholder="Image URL"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
            <textarea
              className="field"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="actions">
              <button className="primary" disabled={busy} onClick={saveProduct}>
                {editingId ? "Update Product" : "Add Product"}
              </button>
              {editingId && <button onClick={cancelEdit}>Cancel Edit</button>}
            </div>
          </div>

          <div className="panel">
            <h3>Inventory</h3>
            {products.map((p) => (
              <div className="adminRow" key={p.id}>
                <div>
                  <b>{p.name}</b>
                  <small>
                    {p.category} · ₹{Number(p.price).toLocaleString("en-IN")} ·{" "}
                    {(p as any).is_active === false ? "Hidden" : "Live"}
                  </small>
                </div>
                <input
                  type="number"
                  min="0"
                  value={p.stock}
                  onChange={(e) => updateStock(p.id, Number(e.target.value))}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => startEdit(p)}>Edit</button>
                  <button onClick={() => toggleProduct(p)}>
                    {(p as any).is_active === false ? "Enable" : "Hide"}
                  </button>
                  <button style={{ color: "#b42318" }} onClick={() => deleteProduct(p.id, p.name)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="panel">
          <h3>All Orders</h3>
          {!orders.length ? (
            <p>No orders.</p>
          ) : (
            orders.map((o) => (
              <div className="adminRow" key={o.id}>
                <div>
                  <b>#{o.id.slice(0, 8)}</b>
                  <small>
                    {new Date(o.created_at).toLocaleString("en-IN")} · ₹
                    {Number(o.total).toLocaleString("en-IN")}
                  </small>
                </div>
                <select value={o.status} onChange={(e) => updateOrder(o.id, e.target.value)}>
                  <option>placed</option>
                  <option>confirmed</option>
                  <option>packed</option>
                  <option>shipped</option>
                  <option>delivered</option>
                  <option>cancelled</option>
                </select>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="panel">
          <h3>Customers</h3>
          {users.map((u) => (
            <div className="adminRow" key={u.id}>
              <div>
                <b>{u.full_name || "Customer"}</b>
                <small>{u.phone || u.id}</small>
              </div>
              <strong>{u.role}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
