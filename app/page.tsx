"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@supabase/supabase-js";
type Product={id:string;name:string;category?:string;price:number;stock:number;image_url?:string|null;rating_avg?:number|null};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sb=url&&key?createClient(url,key):null;
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]),[q,setQ]=useState(""),[cat,setCat]=useState("All"),[cart,setCart]=useState<Record<string,number>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{if(!sb){setError("Supabase environment variables are missing.");setLoading(false);return}sb.from("products").select("*").eq("active",true).order("created_at",{ascending:false}).then(({data,error})=>{if(error)setError(error.message);else setProducts(data||[]);setLoading(false)})},[]);
 const cats=useMemo(()=>["All",...Array.from(new Set(products.map(p=>p.category).filter(Boolean) as string[]))],[products]);
 const list=products.filter(p=>(cat==="All"||p.category===cat)&&p.name.toLowerCase().includes(q.toLowerCase()));
 const total=Object.entries(cart).reduce((s,[id,n])=>s+(products.find(p=>p.id===id)?.price||0)*n,0);
 function add(p:Product){setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}))}
 return <main>
 <header><div className="brand">Shree<span>Kart</span></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products, brands and more"/><div className="cart">🛒 {Object.values(cart).reduce((a,b)=>a+b,0)}</div></header>
 <section className="hero"><div><p className="eyebrow">SHREEKART</p><h1>Shop More, Live Better.</h1><p>Real products, real orders, one simple shopping experience.</p></div><div className="heroIcon">🛍️</div></section>
 <section className="cats">{cats.map(c=><button className={cat===c?"selected":""} onClick={()=>setCat(c)} key={c}>{c}</button>)}</section>
 {loading?<div className="state">Loading products…</div>:error?<div className="state error">{error}<small>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel.</small></div>:<section className="grid">{list.map(p=><article className="card" key={p.id}><div className="photo">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🛍️</span>}</div><div className="body"><small>{p.category||"Product"} {p.rating_avg?"· ⭐ "+Number(p.rating_avg).toFixed(1):""}</small><h3>{p.name}</h3><strong>₹{Number(p.price).toLocaleString("en-IN")}</strong><p>{p.stock>0?p.stock+" in stock":"Out of stock"}</p><button disabled={!p.stock} onClick={()=>add(p)}>Add to Cart</button></div></article>)}</section>}
 <footer><b>Cart total: ₹{total.toLocaleString("en-IN")}</b><span>Catalog connected to Supabase.</span></footer>
 </main>
}