
import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
  initializeApp
} from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";

// ---------- CONFIG: 填入你自己的 Firebase 配置 -----------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // storageBucket, messagingSenderId, appId 可选
};
// ---------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    signInAnonymously(auth).catch((e) => {
      console.error("匿名登录失败：", e);
      setLoading(false);
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { user, loading };
}

function useRealtimeCollection(path) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const col = collection(db, path);
    const unsub = onSnapshot(col, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setItems(arr);
    }, (err) => {
      console.error("监听错误:", err);
    });
    return unsub;
  }, [path]);
  return [items];
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(()=>{}, ()=>{});
}

function IconButton({children, onClick, className}) {
  return (
    <button onClick={onClick} className={"p-3 rounded-lg shadow-sm bg-white "+(className||"")}>
      {children}
    </button>
  );
}

function Modal({open, onClose, title, children}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="px-3 py-1 rounded hover:bg-gray-100">关闭</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Toast({msg, onClose}) {
  if (!msg) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div className="bg-black text-white px-4 py-2 rounded shadow">{msg} <button onClick={onClose} className="ml-2 underline">关闭</button></div>
    </div>
  );
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const [products] = useRealtimeCollection("products");
  const [people] = useRealtimeCollection("people");

  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState("");
  const [addProdOpen, setAddProdOpen] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false);

  // scanner input
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(()=>{
    if (toast) {
      const t = setTimeout(()=>setToast(""), 4000);
      return ()=>clearTimeout(t);
    }
  }, [toast]);

  async function handleScanSubmit(e) {
    e?.preventDefault();
    const code = scanInput.trim();
    if (!code) { setToast("请输入扫码内容"); return; }
    setSearching(true);
    // try match product by barcode
    const prodQuery = query(collection(db, "products"), where("barcode", "==", code));
    const prodSnap = await getDocs(prodQuery);
    if (!prodSnap.empty) {
      const doc0 = prodSnap.docs[0];
      setScanResult({ type: "product", data: { id: doc0.id, ...doc0.data() } });
      setSearching(false);
      return;
    }
    // try match person by id
    const personQuery = query(collection(db, "people"), where("personId", "==", code));
    const personSnap = await getDocs(personQuery);
    if (!personSnap.empty) {
      const doc0 = personSnap.docs[0];
      setScanResult({ type: "person", data: { id: doc0.id, ...doc0.data() } });
      setSearching(false);
      return;
    }
    setScanResult({ type: "none" });
    setSearching(false);
  }

  async function addProduct(form) {
    try {
      await addDoc(collection(db, "products"), form);
      setToast("商品添加成功");
      setAddProdOpen(false);
    } catch (e) {
      console.error(e);
      setToast("商品添加失败，请查看控制台");
    }
  }

  async function addPerson(form) {
    try {
      await addDoc(collection(db, "people"), form);
      setToast("人员添加成功");
      setAddPersonOpen(false);
    } catch (e) {
      console.error(e);
      setToast("添加人员失败");
    }
  }

  async function updateStock(productId, newQty) {
    try {
      const ref = doc(db, "products", productId);
      await updateDoc(ref, { stock: Number(newQty) });
      setToast("库存已更新");
      // refresh scan result if shown
      if (scanResult?.type === "product" && scanResult.data.id === productId) {
        setScanResult({...scanResult, data: {...scanResult.data, stock: Number(newQty)}})
      }
    } catch (e) {
      console.error(e);
      setToast("更新库存失败");
    }
  }

  const lowThreshold = 10;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-center text-sm text-gray-500">首页</div>
            <div className="text-xs text-gray-400">IPMS 仪表盘</div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded flex items-center gap-2">
                <span className="text-xs">userId: {user.uid.slice(0,8)}...</span>
                <button className="text-xs underline" onClick={()=>{copyToClipboard(user.uid); setToast("已复制 userId");}}>复制</button>
              </div>
            ) : (
              <div className="text-sm text-gray-500">{authLoading?"正在登录...":"未登录"}</div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* overview */}
        <section className="mb-4">
          <div className="rounded-xl bg-gradient-to-r from-sky-400 to-indigo-400 text-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{products.length}</div>
                <div className="text-sm">商品数</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{people.length}</div>
                <div className="text-sm">人员数</div>
              </div>
            </div>
            <div className="mt-3 text-xs opacity-90">实时更新 - {new Date().toLocaleString()}</div>
          </div>
        </section>

        {/* quick actions like screenshot */}
        <section className="mb-4">
          <div className="bg-white p-4 rounded-xl shadow">
            <div className="flex gap-3 flex-wrap">
              <button className="flex-1 min-w-[140px] p-3 rounded-lg bg-indigo-50 text-indigo-700" onClick={()=>setAddProdOpen(true)}>新建商品</button>
              <button className="flex-1 min-w-[140px] p-3 rounded-lg bg-green-50 text-green-700" onClick={()=>setAddPersonOpen(true)}>新建人员</button>
              <button className="flex-1 min-w-[140px] p-3 rounded-lg bg-yellow-50 text-yellow-700" onClick={()=>{setTab("inventory")}}>库存管理</button>
              <button className="flex-1 min-w-[140px] p-3 rounded-lg bg-sky-50 text-sky-700" onClick={()=>{setTab("people")}}>人员管理</button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="col-span-3 md:col-span-1">
                <img src="/screenshot.jpeg" alt="screenshot" className="rounded-lg shadow-sm object-cover w-full h-36"/>
              </div>
              <div className="col-span-3 md:col-span-2">
                <div className="text-sm text-gray-600">快捷入口</div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <div className="p-3 bg-white rounded-lg text-center">公海</div>
                  <div className="p-3 bg-white rounded-lg text-center">私海</div>
                  <div className="p-3 bg-white rounded-lg text-center">线索查询</div>
                  <div className="p-3 bg-white rounded-lg text-center">商品管理</div>
                  <div className="p-3 bg-white rounded-lg text-center">提交签约</div>
                  <div className="p-3 bg-white rounded-lg text-center">审批中心</div>
                  <div className="p-3 bg-white rounded-lg text-center">我的点位</div>
                  <div className="p-3 bg-white rounded-lg text-center">合同中心</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* scanner tab */}
        <section className="mb-4">
          <div className="bg-white p-4 rounded-xl shadow">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">扫码与查询</h4>
            </div>
            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <input className="flex-1 p-3 rounded-lg border" placeholder="在此输入条码或人员ID（模拟扫码）" value={scanInput} onChange={(e)=>setScanInput(e.target.value)} />
              <button className="px-4 py-3 rounded-lg bg-blue-600 text-white" type="submit">{searching?"查询中...":"查询"}</button>
            </form>

            <div className="mt-4">
              {scanResult?.type==="product" && (
                <div className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold">{scanResult.data.name}</div>
                      <div className="text-sm text-gray-500">条码：{scanResult.data.barcode}</div>
                      <div className="text-sm text-gray-500">描述：{scanResult.data.desc||'无'}</div>
                    </div>
                    <div className="text-right">
                      <div className={scanResult.data.stock < lowThreshold ? "text-red-600 font-bold text-2xl":"text-green-600 font-bold text-2xl"}>{scanResult.data.stock}</div>
                      <div className="text-xs text-gray-400">库存</div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <UpdateStockForm product={scanResult.data} onUpdate={updateStock} />
                  </div>
                </div>
              )}
              {scanResult?.type==="person" && (
                <div className="p-3 border rounded-lg bg-white">
                  <div className="text-lg font-bold">{scanResult.data.name}</div>
                  <div className="text-sm text-gray-500">人员ID：{scanResult.data.personId}</div>
                  <div className="text-sm text-gray-500">角色：{scanResult.data.role}</div>
                  <div className="text-sm text-gray-500">设备ID：{scanResult.data.deviceId||'无'}</div>
                </div>
              )}
              {scanResult?.type==="none" && (
                <div className="p-3 border rounded-lg bg-white text-gray-500">未找到匹配的商品或人员</div>
              )}
            </div>
          </div>
        </section>

        {/* inventory / people */}
        {tab==="inventory" && (
          <section className="mb-6">
            <div className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold">库存管理</h4>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 rounded bg-indigo-50 text-indigo-700" onClick={()=>setAddProdOpen(true)}>添加商品</button>
                </div>
              </div>
              <div className="grid gap-3">
                {products.map(p=>(
                  <div key={p.id} className="p-3 border rounded-lg bg-white flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-gray-500">条码：{p.barcode}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={p.stock < lowThreshold ? "text-red-600 font-bold":"text-gray-700 font-bold"}>{p.stock}</div>
                      <UpdateStockForm product={p} onUpdate={updateStock} small />
                    </div>
                  </div>
                ))}
                {products.length===0 && <div className="text-gray-500">暂无商品</div>}
              </div>
            </div>
          </section>
        )}

        {tab==="people" && (
          <section className="mb-6">
            <div className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold">人员管理</h4>
                <div>
                  <button className="px-3 py-2 rounded bg-green-50 text-green-700" onClick={()=>setAddPersonOpen(true)}>添加人员</button>
                </div>
              </div>
              <div className="grid gap-3">
                {people.map(p=>(
                  <div key={p.id} className="p-3 border rounded-lg bg-white flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-gray-500">人员ID：{p.personId}</div>
                      <div className="text-sm text-gray-400">角色：{p.role}</div>
                    </div>
                    <div className="text-sm text-gray-500">设备：{p.deviceId||'无'}</div>
                  </div>
                ))}
                {people.length===0 && <div className="text-gray-500">暂无人员</div>}
              </div>
            </div>
          </section>
        )}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-4xl mx-auto flex">
          <button className={"flex-1 p-3 "+(tab==="home"?"text-blue-600":"text-gray-600")} onClick={()=>setTab("home")}>首页</button>
          <button className={"flex-1 p-3 "+(tab==="inventory"?"text-blue-600":"text-gray-600")} onClick={()=>setTab("inventory")}>数据看板</button>
          <button className={"flex-1 p-3 "+(tab==="people"?"text-blue-600":"text-gray-600")} onClick={()=>setTab("people")}>我的</button>
        </div>
      </nav>

      <Modal open={addProdOpen} onClose={()=>setAddProdOpen(false)} title="添加商品">
        <AddProductForm onSubmit={addProduct} />
      </Modal>

      <Modal open={addPersonOpen} onClose={()=>setAddPersonOpen(false)} title="添加人员">
        <AddPersonForm onSubmit={addPerson} />
      </Modal>

      <Toast msg={toast} onClose={()=>setToast("")} />
    </div>
  );
}

function AddProductForm({onSubmit}) {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [stock, setStock] = useState(0);
  const [desc, setDesc] = useState("");
  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSubmit({name, barcode, stock: Number(stock), desc});}} className="space-y-3">
      <div>
        <label className="block text-sm">商品名称</label>
        <input className="w-full p-2 border rounded" value={name} onChange={(e)=>setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm">商品条码（唯一）</label>
        <input className="w-full p-2 border rounded" value={barcode} onChange={(e)=>setBarcode(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm">初始库存</label>
        <input type="number" className="w-full p-2 border rounded" value={stock} onChange={(e)=>setStock(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm">描述</label>
        <textarea className="w-full p-2 border rounded" value={desc} onChange={(e)=>setDesc(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
      </div>
    </form>
  );
}

function AddPersonForm({onSubmit}) {
  const [name, setName] = useState("");
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState("");
  const [deviceId, setDeviceId] = useState("");
  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSubmit({name, personId, role, deviceId});}} className="space-y-3">
      <div>
        <label className="block text-sm">姓名</label>
        <input className="w-full p-2 border rounded" value={name} onChange={(e)=>setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm">人员ID（唯一）</label>
        <input className="w-full p-2 border rounded" value={personId} onChange={(e)=>setPersonId(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm">职位/角色</label>
        <input className="w-full p-2 border rounded" value={role} onChange={(e)=>setRole(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm">分配设备ID（可选）</label>
        <input className="w-full p-2 border rounded" value={deviceId} onChange={(e)=>setDeviceId(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">保存</button>
      </div>
    </form>
  );
}

function UpdateStockForm({product, onUpdate, small}) {
  const [val, setVal] = useState(product.stock || 0);
  useEffect(()=>setVal(product.stock||0), [product.stock]);
  return (
    <form onSubmit={(e)=>{e.preventDefault(); onUpdate(product.id, Number(val));}} className={small?"flex items-center gap-2":"flex items-center gap-2"}>
      <input type="number" className="p-2 border rounded w-20" value={val} onChange={(e)=>setVal(e.target.value)} />
      <button className="px-3 py-2 rounded bg-blue-500 text-white">{small?"更新":"更新库存"}</button>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
