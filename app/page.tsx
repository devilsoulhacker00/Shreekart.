"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Product = { id:string; name:string; description?:string|null; category?:string|null; price:number; stock:number; image_url?:string|null; active?:boolean };

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sb=url&&key?createClient(url,key):null;

async function isAdmin(){
  if(!sb)return false;
  const {data:rpcData,error:rpcError}=await sb.rpc("is_admin");
  if(!rpcError&&rpcData===true)return true;
  const {data:userData}=await sb.auth.getUser();
  if(!userData.user)return false;
  const {data:profile}=await sb.from("profiles").select("role").eq("id",userData.user.id).maybeSingle();
  return profile?.role==="admin";
}

export default function Home(){
  const [products,setProducts]=useState<Product[]>([]);
  const [view,setView]=useState<"shop"|"account"|"cart"|"admin">("shop");
  const [user,setUser]=useState<any>(null),[admin,setAdmin]=useState(false);
  const [msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  const [email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [phone,setPhone]=useState(""),[otp,setOtp]=useState(""),[otpSent,setOtpSent]=useState(false);
  const [loginMode,setLoginMode]=useState<"phone"|"email">("phone");
  const [cart,setCart]=useState<Record<string,number>>({});
  const [editingId,setEditingId]=useState<string|null>(null);
  const [form,setForm]=useState({name:"",category:"",price:"",stock:"",image_url:"",description:""});

  async function refresh(){
    if(!sb)return;
    const {data,error}=await sb.from("products").select("*").order("created_at",{ascending:false});
    if(error)setMsg(error.message); else setProducts((data||[]) as Product[]);
  }

  useEffect(()=>{
    if(!sb){setMsg("Supabase environment variables are missing.");return;}
    refresh();
    sb.auth.getUser().then(async({data})=>{setUser(data.user);if(data.user)setAdmin(await isAdmin());});
    const {data:listener}=sb.auth.onAuthStateChange(async(_event,session)=>{
      const u=session?.user??null;setUser(u);setAdmin(u?await isAdmin():false);
    });
    return()=>listener.subscription.unsubscribe();
  },[]);

  async function emailAuth(mode:"login"|"signup"){
    if(!sb)return;setBusy(true);setMsg("");
    const r=mode==="login"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});
    setBusy(false);
    if(r.error)setMsg(r.error.message);
    else{setUser(r.data.user);setAdmin(r.data.user?await isAdmin():false);setMsg(mode==="signup"?"Account created. Check email if confirmation is enabled.":"Signed in.");}
  }

  async function sendOtp(){
    if(!sb)return;
    const clean=phone.trim().replace(/\s+/g,"");
    if(!clean||clean.length<10){setMsg("Enter a valid mobile number, e.g. +9198xxxxxxxx");return;}
    const full=clean.startsWith("+")?clean:"+91"+clean;
    setBusy(true);setMsg("");
    const {error}=await sb.auth.signInWithOtp({phone:full});setBusy(false);
    if(error)setMsg(error.message+" — Enable Phone provider and SMS in Supabase.");
    else{setPhone(full);setOtpSent(true);setMsg("OTP sent! Check your SMS.");}
  }

  async function verifyOtp(){
    if(!sb||!otp)return;setBusy(true);setMsg("");
    const {data,error}=await sb.auth.verifyOtp({phone,token:otp,type:"sms"});setBusy(false);
    if(error)setMsg(error.message);
    else{setUser(data.user);setAdmin(data.user?await isAdmin():false);setOtpSent(false);setOtp("");setMsg("Logged in successfully with mobile!");}
  }

  async function saveProduct(){
    if(!sb||!admin||!form.name||!form.price){setMsg("Product name and price are required.");return;}
    setBusy(true);
    const payload={name:form.name,category:form.category||"General",price:Number(form.price),stock:Number(form.stock||0),image_url:form.image_url||null,description:form.description||null,...(editingId?{}:{active:true})};
    const r=editingId?await sb.from("products").update(payload).eq("id",editingId):await sb.from("products").insert(payload);
    setBusy(false);
    if(r.error)setMsg(r.error.message);else{setMsg(editingId?"Product updated successfully.":"Product added successfully.");resetForm();await refresh();}
  }

  function editProduct(p:Product){
    setEditingId(p.id);setForm({name:p.name,category:p.category||"",price:String(p.price),stock:String(p.stock),image_url:p.image_url||"",description:p.description||""});setView("admin");setMsg("");
  }
  function resetForm(){setEditingId(null);setForm({name:"",category:"",price:"",stock:"",image_url:"",description:""});}

  async function deleteProduct(id:string){
    if(!sb||!admin||!confirm("Remove this product from the shop? Existing orders will be preserved."))return;
    setBusy(true);const r=await sb.from("products").update({is_active:false}).eq("id",id);setBusy(false);
    if(r.error)setMsg(r.error.message);else{setMsg("Product removed from shop.");if(editingId===id)resetForm();await refresh();}
  }

  async function toggleProduct(p:Product){
    if(!sb||!admin)return;
    const r=await sb.from("products").update({active:p.active===false}).eq("id",p.id);
    if(r.error)setMsg(r.error.message);else await refresh();
  }

  function addToCart(p:Product){
    if(p.stock<1)return;
    setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}));setMsg(p.name+" added to cart.");
  }

  const items=Object.entries(cart).map(([id,qty])=>({p:products.find(x=>x.id===id),qty})).filter(x=>x.p) as {p:Product,qty:number}[];
  const total=items.reduce((s,x)=>s+x.p.price*x.qty,0);

  return <main>
    <header>
      <div className="brand" onClick={()=>setView("shop")}>Shree<span>Kart</span></div>
      <button className="navbtn" onClick={()=>setView("shop")}>Shop</button>
      <button className="navbtn" onClick={()=>setView("cart")}>🛒 Cart ({items.length})</button>
      <button className="navbtn" onClick={()=>setView("account")}>👤 {user?"Account":"Login"}</button>
      {admin&&<button className="navbtn" onClick={()=>setView("admin")}>⚙️ Admin</button>}
    </header>

    {msg&&<div className="toast">{msg}</div>}

    {view==="shop"&&<section className="panel">
      <h1>Shop More, Live Better.</h1><p>ShreeKart product catalog.</p>
      <div className="grid">{products.filter(p=>p.active!==false).map(p=><article className="card" key={p.id}>
        <div className="photo">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🛍️</span>}</div>
        <div className="body"><small>{p.category||"General"}</small><h3>{p.name}</h3><strong>₹{Number(p.price).toLocaleString("en-IN")}</strong><p>{p.stock>0?p.stock+" in stock":"Out of stock"}</p><button disabled={!p.stock} onClick={()=>addToCart(p)}>Add to Cart</button></div>
      </article>)}</div>
    </section>}

    {view==="cart"&&<section className="panel"><h2>Your Cart</h2>{!items.length?<p>Your cart is empty.</p>:<>{items.map(x=><div className="row" key={x.p.id}><b>{x.p.name}</b><span>₹{x.p.price}</span><span>Qty: {x.qty}</span></div>)}<h2>Total: ₹{total.toLocaleString("en-IN")}</h2></>}</section>}

    {view==="account"&&<section className="panel">{user?<><h2>My Account</h2><p>Signed in as <b>{user.phone||user.email}</b></p>{admin&&<button className="primary" onClick={()=>setView("admin")}>⚙️ Open Admin Panel</button>}<button onClick={async()=>{await sb?.auth.signOut();setUser(null);setAdmin(false);setView("shop");}}>Sign out</button></>:<>
      <h2>Login / Create Account</h2>
      <div className="actions"><button className={loginMode==="phone"?"primary":""} onClick={()=>{setLoginMode("phone");setMsg("");}}>📱 Mobile OTP</button><button className={loginMode==="email"?"primary":""} onClick={()=>{setLoginMode("email");setMsg("");}}>✉️ Email</button></div>
      {loginMode==="phone"?(!otpSent?<><input className="field" type="tel" placeholder="Mobile number e.g. +9198xxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/><button className="primary" disabled={busy} onClick={sendOtp}>Send OTP</button></>:<><p className="notice">OTP sent to {phone}</p><input className="field" inputMode="numeric" placeholder="Enter 6-digit OTP" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={8}/><div className="actions"><button className="primary" disabled={busy} onClick={verifyOtp}>Verify & Login</button><button onClick={()=>{setOtpSent(false);setOtp("");}}>Change Number</button></div></>):<><input className="field" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input className="field" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><div className="actions"><button className="primary" disabled={busy} onClick={()=>emailAuth("login")}>Login</button><button onClick={()=>emailAuth("signup")}>Create account</button></div></>}
    </>}</section>}

    {view==="admin"&&admin&&<section className="admin">
      <div className="adminHead"><div><p className="eyebrow">SHREEKART ADMIN</p><h2>Store Management</h2></div><button onClick={()=>setView("shop")}>← Store</button></div>
      <div className="adminGrid">
        <div className="panel"><h3>{editingId?"Edit Product":"Add Product"}</h3>
          <input className="field" placeholder="Product name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="field" placeholder="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
          <input className="field" type="number" placeholder="Price" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
          <input className="field" type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/>
          <input className="field" placeholder="Image URL" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})}/>
          <textarea className="field" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          <div className="actions"><button className="primary" disabled={busy} onClick={saveProduct}>{editingId?"Update Product":"Add Product"}</button>{editingId&&<button onClick={resetForm}>Cancel Edit</button>}</div>
        </div>
        <div className="panel"><h3>Inventory</h3>{products.map(p=><div className="adminRow" key={p.id}>
          <div><b>{p.name}</b><small>{p.category||"General"} · ₹{Number(p.price).toLocaleString("en-IN")} · {p.active===false?"Hidden":"Live"}</small></div>
          <div className="actions"><button onClick={()=>editProduct(p)}>Edit</button><button onClick={()=>toggleProduct(p)}>{p.active===false?"Enable":"Hide"}</button><button onClick={()=>deleteProduct(p.id)}>Delete</button></div>
        </div>)}</div>
      </div>
    </section>}

    <footer><b>Cart total: ₹{total.toLocaleString("en-IN")}</b><span>ShreeKart · Supabase powered</span></footer>
  </main>;
}
