"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@supabase/supabase-js";
type Product={id:string;name:string;category?:string;price:number;stock:number;image_url?:string|null;rating_avg?:number|null};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sb=url&&key?createClient(url,key):null;
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]),[q,setQ]=useState(""),[cat,setCat]=useState("All"),[cart,setCart]=useState<Record<string,number>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[view,setView]=useState<"shop"|"cart"|"account">("shop"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[user,setUser]=useState<any>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{if(!sb){setError("Supabase environment variables are missing.");setLoading(false);return} sb.auth.getUser().then(({data})=>setUser(data.user));sb.from("products").select("*").eq("active",true).order("created_at",{ascending:false}).then(({data,error})=>{if(error)setError(error.message);else setProducts(data||[]);setLoading(false)})},[]);
 const cats=useMemo(()=>["All",...Array.from(new Set(products.map(p=>p.category).filter(Boolean) as string[]))],[products]);
 const list=products.filter(p=>(cat==="All"||p.category===cat)&&p.name.toLowerCase().includes(q.toLowerCase()));
 const total=Object.entries(cart).reduce((s,[id,n])=>s+(products.find(p=>p.id===id)?.price||0)*n,0); const items=Object.entries(cart).map(([id,qty])=>({p:products.find(p=>p.id===id)!,qty})).filter(x=>x.p); const count=Object.values(cart).reduce((a,b)=>a+b,0);
 function add(p:Product){setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}))} function change(id:string,n:number){setCart(c=>{const x={...c};if(n<=0)delete x[id];else x[id]=n;return x})} async function auth(mode:"login"|"signup"){if(!sb)return;setBusy(true);setMsg("");const r=mode==="login"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});setBusy(false);if(r.error)setMsg(r.error.message);else{setUser(r.data.user);setMsg(mode==="signup"?"Account created. Check email if confirmation is enabled.":"Signed in.");}} async function checkout(){if(!sb||!user){setView("account");setMsg("Please sign in before checkout.");return}setBusy(true);const rows=items.map(x=>({product_id:x.p.id,quantity:x.qty,price:x.p.price}));const {error}=await sb.rpc("place_order",{p_items:rows,p_address:{name:"Customer",line1:"Address required"},p_payment_method:"cod"});setBusy(false);if(error)setMsg(error.message);else{setCart({});setView("account");setMsg("Order placed successfully.");}}
 return <main>
 <header><div className="brand" onClick={()=>setView("shop")}>Shree<span>Kart</span></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products, brands and more"/><button className="navbtn" onClick={()=>setView("account")}>👤 {user?"Account":"Login"}</button><button className="navbtn" onClick={()=>setView("cart")}>🛒 {count}</button></header>
 <section className="hero"><div><p className="eyebrow">SHREEKART</p><h1>Shop More, Live Better.</h1><p>Real products, real orders, one simple shopping experience.</p></div><div className="heroIcon">🛍️</div></section>
 <section className="cats">{cats.map(c=><button className={cat===c?"selected":""} onClick={()=>setCat(c)} key={c}>{c}</button>)}</section>
 {view==="shop" && <>{loading?<div className="state">Loading products…</div>:error?<div className="state error">{error}<small>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel.</small></div>:<section className="grid">{list.map(p=><article className="card" key={p.id}><div className="photo">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🛍️</span>}</div><div className="body"><small>{p.category||"Product"} {p.rating_avg?"· ⭐ "+Number(p.rating_avg).toFixed(1):""}</small><h3>{p.name}</h3><strong>₹{Number(p.price).toLocaleString("en-IN")}</strong><p>{p.stock>0?p.stock+" in stock":"Out of stock"}</p><button disabled={!p.stock} onClick={()=>add(p)}>Add to Cart</button></div></article>)}</section>}
 <footer><b>Cart total: ₹{total.toLocaleString("en-IN")}</b><span>Catalog connected to Supabase.</span></footer>
 </main>
}