import { useEffect, useState } from "react";
import {
  collection, deleteDoc, doc, onSnapshot,
  updateDoc, setDoc, getDoc, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import "./admin.css";

type Tab = "analytics" | "codes" | "rewards" | "customers";
type CodeFilter = "all" | "used" | "unused" | "printed" | "unprinted";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<any[]>([]);
  const [codeFilter, setCodeFilter] = useState<CodeFilter>("all");
  const [codeSearch, setCodeSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [codeCount, setCodeCount] = useState(10);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");

  const [stampsRequired, setStampsRequired] = useState(4);
  const [claimHours, setClaimHours] = useState(24);
  const [rewardOptions, setRewardOptions] = useState<string[]>([]);
  const [newReward, setNewReward] = useState("");
  const [editingReward, setEditingReward] = useState<number | null>(null);
  const [editRewardVal, setEditRewardVal] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

  const showToast = (msg: string, type = "success") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, "customers"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setCustomers(list);
      setFilteredCustomers(list);
    });
    return () => unsub();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, "codes"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCodes(list);
    });
    return () => unsub();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const loadConfig = async () => {
      const configSnap = await getDoc(doc(db, "config", "rewards"));
      if (configSnap.exists()) {
        const data = configSnap.data();
        setStampsRequired(data.stampsRequired || 4);
        setClaimHours(data.claimHours || 24);
        setRewardOptions(data.rewardOptions || []);
      } else {
        const defaults = {
          stampsRequired: 4,
          claimHours: 24,
          rewardOptions: ["Free Glass Cleaner", "Free Floor Cleaner", "Free Dishwash Combo", "Free Toilet Cleaner", "Flat ₹50 Cashback"]
        };
        await setDoc(doc(db, "config", "rewards"), defaults);
        setStampsRequired(defaults.stampsRequired);
        setClaimHours(defaults.claimHours);
        setRewardOptions(defaults.rewardOptions);
      }
    };
    loadConfig();
  }, [isLoggedIn]);

  useEffect(() => {
    let filtered = [...codes];
    if (codeFilter === "used") filtered = filtered.filter(c => c.used);
    if (codeFilter === "unused") filtered = filtered.filter(c => !c.used);
    if (codeFilter === "printed") filtered = filtered.filter(c => c.printed);
    if (codeFilter === "unprinted") filtered = filtered.filter(c => !c.printed);
    if (codeSearch) filtered = filtered.filter(c => c.code?.toLowerCase().includes(codeSearch.toLowerCase()));
    setFilteredCodes(filtered);
  }, [codes, codeFilter, codeSearch]);

  useEffect(() => {
    const filtered = customers.filter(c =>
      c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.mobile?.includes(customerSearch)
    );
    setFilteredCustomers(filtered);
  }, [customerSearch, customers]);

  const generateCodes = async () => {
    try {
      const prefixes = ["HM", "DW", "FL", "PC"];
      const batch = writeBatch(db);
      const generated: string[] = [];
      for (let i = 0; i < codeCount; i++) {
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const num = Math.floor(10000 + Math.random() * 90000);
        const code = `${prefix}${num}`;
        batch.set(doc(db, "codes", code), { code, used: false, printed: false, createdAt: Date.now() });
        generated.push(code);
      }
      await batch.commit();
      showToast(`🎉 ${codeCount} codes generated!`);
    } catch {
      showToast("❌ Failed to generate codes", "error");
    }
  };

  const togglePrinted = async (code: string, current: boolean) => {
    await updateDoc(doc(db, "codes", code), { printed: !current });
  };

  const deleteCode = async (code: string) => {
    if (!window.confirm(`Delete code ${code}?`)) return;
    await deleteDoc(doc(db, "codes", code));
    showToast("✅ Code deleted");
  };

  const resetReward = async (mobile: string) => {
    try {
      await updateDoc(doc(db, "customers", mobile), {
        stamps: 0, rewardUnlocked: false, rewardClaimed: false,
        selectedReward: "", claimStartTime: null,
      });
      showToast("✅ Reward reset");
    } catch { showToast("❌ Reset failed", "error"); }
  };

  const adjustStamps = async (mobile: string, current: number, delta: number) => {
    const newVal = Math.max(0, Math.min(stampsRequired, current + delta));
    const unlocked = newVal >= stampsRequired;
    await updateDoc(doc(db, "customers", mobile), {
      stamps: newVal,
      rewardUnlocked: unlocked,
      claimStartTime: unlocked ? Date.now() : null,
    });
    showToast(`✅ Stamps updated to ${newVal}`);
  };

  const deleteCustomer = async (mobile: string) => {
    if (!window.confirm("Delete this customer?")) return;
    await deleteDoc(doc(db, "customers", mobile));
    showToast("✅ Customer deleted");
  };

  const exportCSV = () => {
    const headers = ["Name", "Mobile", "Stamps", "Reward", "Status"];
    const rows = customers.map(c => [
      c.name, c.mobile, c.stamps, c.selectedReward || "-",
      c.rewardClaimed ? "Claimed" : c.rewardUnlocked ? "Unlocked" : "Collecting"
    ]);
    const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "HM_Customers.csv";
    a.click();
  };

  const exportCodesCSV = () => {
    const headers = ["Code", "Status", "Printed", "Generated Date", "Used Date"];
    const rows = codes.map(c => [
      c.code,
      c.used ? "Used" : "Unused",
      c.printed ? "Printed" : "Not Printed",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "-",
      c.usedAt ? new Date(c.usedAt).toLocaleDateString("en-IN") : "-",
    ]);

    const summary = [
      ["SUMMARY", "", "", "", ""],
      ["Total Codes", codes.length, "", "", ""],
      ["Used Codes", codes.filter(c => c.used).length, "", "", ""],
      ["Unused Codes", codes.filter(c => !c.used).length, "", "", ""],
      ["Printed Codes", codes.filter(c => c.printed).length, "", "", ""],
      ["Unprinted Codes", codes.filter(c => !c.printed).length, "", "", ""],
      ["", "", "", "", ""],
      ["--- CODE DETAILS ---", "", "", "", ""],
    ];

    const csv = [...summary, headers, ...rows].map(e => e.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const today = new Date().toISOString().slice(0, 10);
    a.download = `HM_Codes_${today}.csv`;
    a.click();
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await setDoc(doc(db, "config", "rewards"), {
        stampsRequired, claimHours, rewardOptions
      });
      showToast("✅ Reward config saved!");
    } catch { showToast("❌ Save failed", "error"); }
    setConfigSaving(false);
  };

  const addReward = () => {
    if (!newReward.trim()) return;
    setRewardOptions([...rewardOptions, newReward.trim()]);
    setNewReward("");
  };

  const deleteReward = (i: number) => {
    setRewardOptions(rewardOptions.filter((_, idx) => idx !== i));
  };

  const saveEditReward = (i: number) => {
    const updated = [...rewardOptions];
    updated[i] = editRewardVal;
    setRewardOptions(updated);
    setEditingReward(null);
  };

  const totalRewards = customers.filter(c => c.rewardClaimed).length;
  const totalCodes = codes.length;
  const usedCodes = codes.filter(c => c.used).length;
  const unusedCodes = codes.filter(c => !c.used).length;
  const printedCodes = codes.filter(c => c.printed).length;

  const handleLogin = () => {
    if (password === process.env.REACT_APP_ADMIN_PASSWORD) {
      setIsLoggedIn(true);
    } else {
      showToast("❌ Wrong Password", "error");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="loginPage">
        {toast && <div className={`adminToast ${toastType}`}>{toast}</div>}
        <div className="loginBox">
          <h1>HM Admin Login</h1>
          <div className="passwordWrapper">
            <input type={showPassword ? "text" : "password"} placeholder="Enter Admin Password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            <button className="eyeBtn" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          <button onClick={handleLogin}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="adminPage">
      {toast && <div className={`adminToast ${toastType}`}>{toast}</div>}

      <div className="adminHeader">
        <h1>HM Admin Dashboard</h1>
        <p>Manage rewards, customers & analytics</p>
      </div>

      <div className="adminTabs">
        {(["analytics", "codes", "rewards", "customers"] as Tab[]).map(tab => (
          <button key={tab} className={`tabBtn ${activeTab === tab ? "activeTab" : ""}`}
            onClick={() => setActiveTab(tab)}>
            {tab === "analytics" ? "📊 Analytics" :
             tab === "codes" ? "🎟️ Codes" :
             tab === "rewards" ? "🎁 Rewards" : "👥 Customers"}
          </button>
        ))}
      </div>

      {activeTab === "analytics" && (
        <div>
          <div className="analyticsGrid">
            <div className="analyticsCard"><h2>{customers.length}</h2><p>Total Customers</p></div>
            <div className="analyticsCard"><h2>{totalRewards}</h2><p>Rewards Claimed</p></div>
            <div className="analyticsCard"><h2>{totalCodes}</h2><p>Total Codes</p></div>
            <div className="analyticsCard"><h2>{unusedCodes}</h2><p>Unused Codes</p></div>
            <div className="analyticsCard"><h2>{usedCodes}</h2><p>Used Codes</p></div>
            <div className="analyticsCard"><h2>{printedCodes}</h2><p>Printed Codes</p></div>
          </div>
          <button className="exportBtn" onClick={exportCSV}>⬇️ Download Customers CSV</button>
        </div>
      )}

      {activeTab === "codes" && (
        <div>
          <div className="generatorBox">
            <h3>Generate Reward Codes</h3>
            <input type="number" value={codeCount}
              onChange={(e) => setCodeCount(Number(e.target.value))} />
            <button className="generateBtn" onClick={generateCodes}>Generate Codes</button>
          </div>

          <div className="filterBar">
            {(["all", "unused", "used", "printed", "unprinted"] as CodeFilter[]).map(f => (
              <button key={f} className={`filterBtn ${codeFilter === f ? "activeFilter" : ""}`}
                onClick={() => setCodeFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "all" ? ` (${totalCodes})` :
                 f === "used" ? ` (${usedCodes})` :
                 f === "unused" ? ` (${unusedCodes})` :
                 f === "printed" ? ` (${printedCodes})` :
                 ` (${totalCodes - printedCodes})`}
              </button>
            ))}
          </div>

          <button className="exportBtn" onClick={exportCodesCSV}>⬇️ Download Codes Excel/CSV</button>

          <input type="text" placeholder="Search code..." className="searchInput"
            value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} />

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Printed</th>
                  <th>Generated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.code}</strong></td>
                    <td>
                      <span className={`statusBadge ${c.used ? "usedBadge" : "unusedBadge"}`}>
                        {c.used ? "🔴 Used" : "🟢 Unused"}
                      </span>
                    </td>
                    <td>
                      <input type="checkbox" checked={c.printed || false}
                        onChange={() => togglePrinted(c.code, c.printed || false)}
                        className="printCheckbox" />
                      <span className="printLabel">{c.printed ? " Printed" : " Not Printed"}</span>
                    </td>
                    <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                    <td>
                      {!c.used && (
                        <button className="deleteBtn" onClick={() => deleteCode(c.code)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "rewards" && (
        <div className="rewardConfigBox">
          <h2>⚙️ Reward Configuration</h2>

          <div className="configRow">
            <label>Stamps Required for Reward</label>
            <div className="configControl">
              <button className="adjBtn" onClick={() => setStampsRequired(Math.max(1, stampsRequired - 1))}>−</button>
              <span className="configVal">{stampsRequired}</span>
              <button className="adjBtn" onClick={() => setStampsRequired(stampsRequired + 1)}>+</button>
            </div>
          </div>

          <div className="configRow">
            <label>Reward Claim Window (Hours)</label>
            <div className="configControl">
              <button className="adjBtn" onClick={() => setClaimHours(Math.max(1, claimHours - 1))}>−</button>
              <span className="configVal">{claimHours}h</span>
              <button className="adjBtn" onClick={() => setClaimHours(claimHours + 1)}>+</button>
            </div>
          </div>

          <div className="rewardOptionsBox">
            <h3>Reward Options</h3>
            {rewardOptions.map((r, i) => (
              <div key={i} className="rewardOptionRow">
                {editingReward === i ? (
                  <>
                    <input className="editRewardInput" value={editRewardVal}
                      onChange={(e) => setEditRewardVal(e.target.value)} />
                    <button className="saveRewardBtn" onClick={() => saveEditReward(i)}>Save</button>
                    <button className="cancelBtn" onClick={() => setEditingReward(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="rewardOptionText">🎁 {r}</span>
                    <button className="editRewardBtn" onClick={() => { setEditingReward(i); setEditRewardVal(r); }}>Edit</button>
                    <button className="deleteBtn" onClick={() => deleteReward(i)}>Delete</button>
                  </>
                )}
              </div>
            ))}
            <div className="addRewardRow">
              <input className="addRewardInput" placeholder="Add new reward option..."
                value={newReward} onChange={(e) => setNewReward(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addReward()} />
              <button className="addRewardBtn" onClick={addReward}>+ Add</button>
            </div>
          </div>

          <button className="saveConfigBtn" onClick={saveConfig} disabled={configSaving}>
            {configSaving ? "Saving..." : "💾 Save Configuration"}
          </button>
        </div>
      )}

      {activeTab === "customers" && (
        <div>
          <input type="text" placeholder="Search by name or mobile"
            className="searchInput" value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)} />

          {customers.length === 0 ? (
            <h2 className="loadingText">No customers yet</h2>
          ) : (
            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Mobile</th><th>Stamps</th>
                    <th>Adjust</th><th>Reward</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.mobile}</td>
                      <td>{c.stamps}/{stampsRequired}</td>
                      <td>
                        <div className="btnGroup">
                          <button className="adjStampBtn" onClick={() => adjustStamps(c.mobile, c.stamps, -1)}>−</button>
                          <button className="adjStampBtn" onClick={() => adjustStamps(c.mobile, c.stamps, 1)}>+</button>
                        </div>
                      </td>
                      <td>{c.selectedReward || "-"}</td>
                      <td>
                        <span className={`statusBadge ${c.rewardClaimed ? "usedBadge" : c.rewardUnlocked ? "unlockedBadge" : "unusedBadge"}`}>
                          {c.rewardClaimed ? "Claimed" : c.rewardUnlocked ? "Unlocked" : "Collecting"}
                        </span>
                      </td>
                      <td>
                        <div className="btnGroup">
                          <button className="resetBtn" onClick={() => resetReward(c.mobile)}>Reset</button>
                          <button className="deleteBtn" onClick={() => deleteCustomer(c.mobile)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
