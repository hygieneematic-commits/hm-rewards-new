import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  writeBatch,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import "./admin.css";

type Tab = "analytics" | "codes" | "rewards" | "customers" | "history";
type CodeFilter = "all" | "used" | "unused" | "printed" | "unprinted";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<any[]>([]);
  const [rewardHistory, setRewardHistory] = useState<any[]>([]);
  const [codeFilter, setCodeFilter] = useState<CodeFilter>("all");
  const [codeSearch, setCodeSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);
  const [historyRewardFilter, setHistoryRewardFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("all");
  const [codeCount, setCodeCount] = useState(10);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");
  const [now, setNow] = useState(Date.now());

  // REWARD CONFIG
  const [claimHours, setClaimHours] = useState(24);
  const [rewardOptions, setRewardOptions] = useState<string[]>([]);
  const [newReward, setNewReward] = useState("");
  const [editingReward, setEditingReward] = useState<number | null>(null);
  const [editRewardVal, setEditRewardVal] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

  // CONFIRM DIALOG state (for Reset Timer + Block)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  // HISTORY MODAL
  const [historyModal, setHistoryModal] = useState<{
    open: boolean;
    customer: any | null;
  }>({ open: false, customer: null });

  // MULTI-SELECT — Codes table
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  // MULTI-SELECT — Customers table
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const showToast = (msg: string, type = "success") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => void
  ) => {
    setConfirmDialog({ open: true, title, message, onConfirm });
  };
  const closeConfirm = () =>
    setConfirmDialog({
      open: false,
      title: "",
      message: "",
      onConfirm: () => {},
    });

  // ── MULTI-SELECT HELPERS ─────────────────────────────────────────────────────

  const toggleSelectCode = (id: string) =>
    setSelectedCodes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAllCodes = (filtered: any[]) => {
    if (selectedCodes.length === filtered.length && filtered.length > 0) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(filtered.map((c) => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) =>
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAllCustomers = (filtered: any[]) => {
    if (selectedCustomers.length === filtered.length && filtered.length > 0) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filtered.map((c) => c.id));
    }
  };

  // ── BULK ACTIONS ─────────────────────────────────────────────────────────────

  const deleteSelectedCodes = async () => {
    try {
      const batchSize = 500;
      for (let i = 0; i < selectedCodes.length; i += batchSize) {
        const b = writeBatch(db);
        selectedCodes
          .slice(i, i + batchSize)
          .forEach((id) => b.delete(doc(db, "codes", id)));
        await b.commit();
      }
      showToast(`${selectedCodes.length} codes deleted`);
      setSelectedCodes([]);
    } catch {
      showToast("Bulk delete failed", "error");
    }
  };

  const deleteSelectedCustomers = async () => {
    try {
      const batchSize = 500;
      for (let i = 0; i < selectedCustomers.length; i += batchSize) {
        const b = writeBatch(db);
        selectedCustomers
          .slice(i, i + batchSize)
          .forEach((id) => b.delete(doc(db, "customers", id)));
        await b.commit();
      }
      showToast(`${selectedCustomers.length} customers deleted`);
      setSelectedCustomers([]);
    } catch {
      showToast("Bulk delete failed", "error");
    }
  };

  const blockSelectedCustomers = async () => {
    try {
      const b = writeBatch(db);
      selectedCustomers.forEach((id) =>
        b.update(doc(db, "customers", id), { blocked: true })
      );
      await b.commit();
      showToast(`${selectedCustomers.length} customers blocked`);
      setSelectedCustomers([]);
    } catch {
      showToast("Bulk block failed", "error");
    }
  };

  const unblockSelectedCustomers = async () => {
    try {
      const b = writeBatch(db);
      selectedCustomers.forEach((id) =>
        b.update(doc(db, "customers", id), { blocked: false })
      );
      await b.commit();
      showToast(`${selectedCustomers.length} customers unblocked`);
      setSelectedCustomers([]);
    } catch {
      showToast("Bulk unblock failed", "error");
    }
  };

  // LIVE CLOCK
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // REAL-TIME CUSTOMERS
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, "customers"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setCustomers(list);
    });
    return () => unsub();
  }, [isLoggedIn]);

  // REAL-TIME CODES
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

  // REAL-TIME REWARD HISTORY
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, "rewardHistory"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.claimedAt || 0) - (a.claimedAt || 0));
      setRewardHistory(list);
    });
    return () => unsub();
  }, [isLoggedIn]);

  // LOAD REWARD CONFIG
  useEffect(() => {
    if (!isLoggedIn) return;
    const loadConfig = async () => {
      const snap = await getDoc(doc(db, "config", "rewards"));
      if (snap.exists()) {
        const data = snap.data();
        setClaimHours(data.claimHours || 24);
        setRewardOptions(data.rewardOptions || []);
      } else {
        const defaults = {
          claimHours: 24,
          rewardOptions: [
            "Free Glass Cleaner",
            "Free Floor Cleaner",
            "Free Dishwash Combo",
            "Free Toilet Cleaner",
            "Flat ₹50 Cashback",
          ],
        };
        await setDoc(doc(db, "config", "rewards"), defaults);
        setClaimHours(defaults.claimHours);
        setRewardOptions(defaults.rewardOptions);
      }
    };
    loadConfig();
  }, [isLoggedIn]);

  // FILTER CODES
  useEffect(() => {
    let filtered = [...codes];
    if (codeFilter === "used") filtered = filtered.filter((c) => c.used);
    if (codeFilter === "unused") filtered = filtered.filter((c) => !c.used);
    if (codeFilter === "printed") filtered = filtered.filter((c) => c.printed);
    if (codeFilter === "unprinted")
      filtered = filtered.filter((c) => !c.printed);
    if (codeSearch)
      filtered = filtered.filter((c) =>
        c.code?.toLowerCase().includes(codeSearch.toLowerCase())
      );
    setFilteredCodes(filtered);
  }, [codes, codeFilter, codeSearch]);

  // FILTER CUSTOMERS
  useEffect(() => {
    const filtered = customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.mobile?.includes(customerSearch)
    );
    setFilteredCustomers(filtered);
  }, [customerSearch, customers]);

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  // Countdown timer display
  const getCountdown = (claimStartTime: number) => {
    const claimSeconds = claimHours * 3600;
    const elapsed = Math.floor((now - claimStartTime) / 1000);
    const left = claimSeconds - elapsed;
    if (left <= 0) return { text: "EXPIRED", expired: true, warning: false };
    const h = Math.floor(left / 3600);
    const m = Math.floor((left % 3600) / 60);
    const s = left % 60;
    return { text: `${h}h ${m}m ${s}s`, expired: false, warning: left < 3600 };
  };

  // Total wins from rewardHistory records (source of truth)
  const getCustomerWins = (mobile: string) =>
    rewardHistory.filter((h) => h.mobile === mobile).length;

  // ── ACTIONS ─────────────────────────────────────────────────────────────────

  // OPTION B — secure code generation: PREFIX + 5 digits + hyphen + 3 alphanumeric
  const generateCodes = async () => {
    try {
      const prefixes = ["HM", "DW", "FL", "PC"];
      // No O, 0, 1, I to avoid visual confusion when printed
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const batch = writeBatch(db);
      for (let i = 0; i < codeCount; i++) {
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const num = Math.floor(10000 + Math.random() * 90000);
        const suffix = Array.from(
          { length: 3 },
          () => chars[Math.floor(Math.random() * chars.length)]
        ).join("");
        const code = `${prefix}${num}-${suffix}`;
        batch.set(doc(db, "codes", code), {
          code,
          used: false,
          printed: false,
          createdAt: Date.now(),
        });
      }
      await batch.commit();
      showToast(`${codeCount} codes generated successfully`);
    } catch {
      showToast("Failed to generate codes", "error");
    }
  };

  const togglePrinted = async (code: string, current: boolean) => {
    await updateDoc(doc(db, "codes", code), { printed: !current });
  };

  const deleteCode = async (code: string) => {
    if (!window.confirm(`Delete code ${code}?`)) return;
    await deleteDoc(doc(db, "codes", code));
    showToast("Code deleted");
  };

  // RESET TIMER — clears only timer/reward state, keeps history intact
  const resetTimer = async (mobile: string, name: string) => {
    try {
      await updateDoc(doc(db, "customers", mobile), {
        rewardUnlocked: false,
        rewardClaimed: false,
        rewardExpired: false,
        selectedReward: "",
        claimStartTime: null,
      });
      // Optional admin activity log
      await addDoc(collection(db, "adminLogs"), {
        action: "RESET_TIMER",
        customerMobile: mobile,
        customerName: name,
        performedAt: Date.now(),
        performedAtFormatted: new Date().toLocaleString("en-IN"),
      });
      showToast(`Timer reset for ${name}`);
    } catch {
      showToast("Reset failed", "error");
    }
  };

  // BLOCK CUSTOMER
  const blockCustomer = async (mobile: string, name: string) => {
    try {
      await updateDoc(doc(db, "customers", mobile), { blocked: true });
      await addDoc(collection(db, "adminLogs"), {
        action: "BLOCK_CUSTOMER",
        customerMobile: mobile,
        customerName: name,
        performedAt: Date.now(),
        performedAtFormatted: new Date().toLocaleString("en-IN"),
      });
      showToast(`${name} has been blocked`);
    } catch {
      showToast("Block failed", "error");
    }
  };

  // UNBLOCK CUSTOMER
  const unblockCustomer = async (mobile: string, name: string) => {
    try {
      await updateDoc(doc(db, "customers", mobile), { blocked: false });
      await addDoc(collection(db, "adminLogs"), {
        action: "UNBLOCK_CUSTOMER",
        customerMobile: mobile,
        customerName: name,
        performedAt: Date.now(),
        performedAtFormatted: new Date().toLocaleString("en-IN"),
      });
      showToast(`${name} has been unblocked`);
    } catch {
      showToast("Unblock failed", "error");
    }
  };

  const deleteCustomer = async (mobile: string) => {
    if (!window.confirm("Delete this customer permanently?")) return;
    await deleteDoc(doc(db, "customers", mobile));
    showToast("Customer deleted");
  };

  // EXPORT CSV — updated: no stamps, uses history-based win count
  const exportCSV = () => {
    const headers = ["Name", "Mobile", "Total Wins", "Last Reward", "Blocked"];
    const rows = customers.map((c) => [
      c.name,
      c.mobile,
      getCustomerWins(c.mobile),
      c.lastRewardClaimed || "-",
      c.blocked ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "HM_Customers.csv";
    a.click();
  };

  const exportCodesCSV = () => {
    const summary = [
      ["SUMMARY", "", "", ""],
      ["Total Codes", codes.length, "", ""],
      ["Used Codes", codes.filter((c) => c.used).length, "", ""],
      ["Unused Codes", codes.filter((c) => !c.used).length, "", ""],
      ["Printed Codes", codes.filter((c) => c.printed).length, "", ""],
      ["", "", "", ""],
    ];
    const headers = ["Code", "Status", "Printed", "Generated Date"];
    const rows = codes.map((c) => [
      c.code,
      c.used ? "Used" : "Unused",
      c.printed ? "Printed" : "Not Printed",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "-",
    ]);
    const csv = [...summary, headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `HM_Codes_${today}.csv`;
    a.click();
  };

  // ARCHIVE & CLEAN USED CODES
  const [cleanDays, setCleanDays] = useState(90);
  const [cleaning, setCleaning] = useState(false);

  const archiveAndClean = async () => {
    const cutoff = Date.now() - cleanDays * 24 * 60 * 60 * 1000;
    const toDelete = codes.filter(
      (c) => c.used && c.createdAt && c.createdAt < cutoff
    );
    if (toDelete.length === 0) {
      showToast(`No used codes older than ${cleanDays} days found`, "error");
      return;
    }
    const confirmed = window.confirm(
      `This will:\n1. Download a CSV backup of ${toDelete.length} used codes\n2. Permanently delete them from Firebase\n\nProceed?`
    );
    if (!confirmed) return;

    const summary = [
      ["ARCHIVE BACKUP", "", "", ""],
      [`Deleted on`, new Date().toLocaleDateString("en-IN"), "", ""],
      [`Codes older than ${cleanDays} days`, toDelete.length, "", ""],
      ["", "", "", ""],
    ];
    const headers = ["Code", "Status", "Printed", "Generated Date"];
    const rows = toDelete.map((c) => [
      c.code,
      "Used",
      c.printed ? "Printed" : "Not Printed",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "-",
    ]);
    const csv = [...summary, headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `HM_ArchivedCodes_${today}.csv`;
    a.click();

    setCleaning(true);
    try {
      const batchSize = 500;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + batchSize).forEach((c) => {
          batch.delete(doc(db, "codes", c.code));
        });
        await batch.commit();
      }
      showToast(`${toDelete.length} used codes archived & deleted`);
    } catch {
      showToast("Delete failed — CSV backup was downloaded", "error");
    }
    setCleaning(false);
  };

  const exportHistoryCSV = () => {
    const headers = ["Customer Name", "Mobile", "Reward", "Claimed At"];
    const rows = rewardHistory.map((h) => [
      h.customerName,
      h.mobile,
      h.reward,
      h.claimedAtFormatted || "-",
    ]);
    const csv = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "HM_RewardHistory.csv";
    a.click();
  };

  const deleteHistoryRecords = async () => {
    if (selectedHistory.length === 0) return;
    if (!window.confirm(`Delete ${selectedHistory.length} selected record(s)?`))
      return;
    try {
      const batch = writeBatch(db);
      selectedHistory.forEach((id) =>
        batch.delete(doc(db, "rewardHistory", id))
      );
      await batch.commit();
      setSelectedHistory([]);
      showToast(`${selectedHistory.length} records deleted`);
    } catch {
      showToast("Delete failed", "error");
    }
  };

  const toggleSelectHistory = (id: string) =>
    setSelectedHistory((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAll = () => {
    if (selectedHistory.length === filteredHistory.length) {
      setSelectedHistory([]);
    } else {
      setSelectedHistory(filteredHistory.map((h) => h.id));
    }
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await setDoc(doc(db, "config", "rewards"), { claimHours, rewardOptions });
      showToast("Configuration saved");
    } catch {
      showToast("Save failed", "error");
    }
    setConfigSaving(false);
  };

  const addReward = () => {
    if (!newReward.trim()) return;
    setRewardOptions([...rewardOptions, newReward.trim()]);
    setNewReward("");
  };

  const deleteReward = (i: number) =>
    setRewardOptions(rewardOptions.filter((_, idx) => idx !== i));

  const saveEditReward = (i: number) => {
    const updated = [...rewardOptions];
    updated[i] = editRewardVal;
    setRewardOptions(updated);
    setEditingReward(null);
  };

  // ── COMPUTED VALUES ──────────────────────────────────────────────────────────
  const totalRewards = rewardHistory.length;
  const activeTimers = customers.filter(
    (c) => c.rewardUnlocked && !c.rewardClaimed
  );
  const blockedCount = customers.filter((c) => c.blocked).length;
  const totalCodes = codes.length;
  const usedCodes = codes.filter((c) => c.used).length;
  const unusedCodes = codes.filter((c) => !c.used).length;
  const printedCodes = codes.filter((c) => c.printed).length;

  const filteredHistory = rewardHistory.filter((h) => {
    const matchSearch =
      !historySearch ||
      h.customerName?.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.mobile?.includes(historySearch) ||
      h.reward?.toLowerCase().includes(historySearch.toLowerCase());
    const matchReward =
      historyRewardFilter === "all" ||
      h.reward?.toLowerCase().includes(historyRewardFilter.toLowerCase());
    const nowTs = Date.now();
    const claimedAt = h.claimedAt || 0;
    const matchDate =
      historyDateFilter === "all"
        ? true
        : historyDateFilter === "today"
        ? new Date(claimedAt).toDateString() === new Date().toDateString()
        : historyDateFilter === "week"
        ? nowTs - claimedAt < 7 * 86400000
        : historyDateFilter === "month"
        ? nowTs - claimedAt < 30 * 86400000
        : true;
    return matchSearch && matchReward && matchDate;
  });

  const handleLogin = () => {
    if (password === process.env.REACT_APP_ADMIN_PASSWORD) {
      setIsLoggedIn(true);
    } else {
      showToast("Wrong Password", "error");
    }
  };

  // ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="loginPage">
        {toast && <div className={`adminToast ${toastType}`}>{toast}</div>}
        <div className="loginBox">
          <h1>Hygiene Matic Admin</h1>
          <p>Rewards Hub — Control Panel</p>
          <div className="passwordWrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button
              className="eyeBtn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          <button onClick={handleLogin}>Login</button>
        </div>
      </div>
    );
  }

  // ── MAIN PANEL ───────────────────────────────────────────────────────────────
  return (
    <div className="adminPage">
      {toast && <div className={`adminToast ${toastType}`}>{toast}</div>}

      {/* CONFIRM DIALOG */}
      {confirmDialog.open && (
        <div className="adminOverlay">
          <div className="adminConfirmBox">
            <h3 className="adminConfirmTitle">{confirmDialog.title}</h3>
            <p className="adminConfirmMsg">{confirmDialog.message}</p>
            <div className="adminConfirmBtns">
              <button className="adminConfirmCancel" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                className="adminConfirmOk"
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModal.open && historyModal.customer && (
        <div className="adminOverlay">
          <div className="adminHistoryModal">
            <div className="adminHistoryModalHeader">
              <div>
                <h3>{historyModal.customer.name}</h3>
                <span>{historyModal.customer.mobile}</span>
              </div>
              <button
                className="adminModalClose"
                onClick={() => setHistoryModal({ open: false, customer: null })}
              >
                ✕
              </button>
            </div>
            <div className="adminHistoryModalBody">
              {rewardHistory.filter(
                (h) => h.mobile === historyModal.customer.mobile
              ).length === 0 ? (
                <p className="adminHistoryEmpty">
                  No reward history for this customer.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Reward</th>
                      <th>Claimed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewardHistory
                      .filter((h) => h.mobile === historyModal.customer.mobile)
                      .map((h, i) => (
                        <tr key={h.id}>
                          <td>{i + 1}</td>
                          <td>{h.reward}</td>
                          <td>{h.claimedAtFormatted || "-"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="adminHeader">
        <div className="adminHeaderText">
          <h1>Hygiene Matic Admin</h1>
          <p>Rewards Hub — Control Panel</p>
        </div>
        <div className="adminHeaderBadge">Live Dashboard</div>
      </div>

      {/* TABS */}
      <div className="adminTabs">
        {(
          ["analytics", "codes", "rewards", "customers", "history"] as Tab[]
        ).map((tab) => (
          <button
            key={tab}
            className={`tabBtn ${activeTab === tab ? "activeTab" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "analytics"
              ? "Analytics"
              : tab === "codes"
              ? "Codes"
              : tab === "rewards"
              ? "Rewards Config"
              : tab === "customers"
              ? "Customers"
              : "History"}
            {tab === "history" && rewardHistory.length > 0 && (
              <span className="tabBadge">{rewardHistory.length}</span>
            )}
            {tab === "customers" && activeTimers.length > 0 && (
              <span className="tabBadge timerBadge">{activeTimers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ANALYTICS ─────────────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div>
          <div className="analyticsGrid">
            <div className="analyticsCard">
              <h2>{customers.length}</h2>
              <p>Total Customers</p>
            </div>
            <div className="analyticsCard">
              <h2>{totalRewards}</h2>
              <p>Rewards Claimed</p>
            </div>
            <div className="analyticsCard highlight">
              <h2>{activeTimers.length}</h2>
              <p>Active Timers</p>
            </div>
            <div className="analyticsCard">
              <h2>{totalCodes}</h2>
              <p>Total Codes</p>
            </div>
            <div className="analyticsCard">
              <h2>{unusedCodes}</h2>
              <p>Unused Codes</p>
            </div>
            <div className="analyticsCard">
              <h2>{blockedCount}</h2>
              <p>Blocked Users</p>
            </div>
          </div>

          {activeTimers.length > 0 && (
            <div className="activeTimersBox">
              <h3>Live Reward Timers</h3>
              {activeTimers.map((c) => {
                const countdown = getCountdown(c.claimStartTime);
                return (
                  <div
                    key={c.id}
                    className={`timerRow ${
                      countdown.warning ? "timerWarning" : ""
                    } ${countdown.expired ? "timerExpired" : ""}`}
                  >
                    <div className="timerCustomer">
                      <strong>{c.name}</strong>
                      <span>{c.mobile}</span>
                    </div>
                    <div className="timerReward">
                      {c.selectedReward || "Reward Pending"}
                    </div>
                    <div
                      className={`timerCountdown ${
                        countdown.warning ? "warningText" : ""
                      }`}
                    >
                      {countdown.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button className="exportBtn" onClick={exportCSV}>
            Download Customers CSV
          </button>
        </div>
      )}

      {/* ── CODES ─────────────────────────────────────────────────────────────── */}
      {activeTab === "codes" && (
        <div>
          <div className="generatorBox">
            <h3>Generate Reward Codes</h3>
            <p className="generatorNote">
              New format:{" "}
              <code>PREFIX + 5 digits + hyphen + 3 alphanumeric</code>
              &nbsp;(e.g. <strong>HM82341-K7X</strong>) — ~1.6 billion
              combinations
            </p>
            <input
              type="number"
              value={codeCount}
              min={1}
              max={500}
              onChange={(e) => setCodeCount(Number(e.target.value))}
            />
            <button className="generateBtn" onClick={generateCodes}>
              Generate {codeCount} Codes
            </button>
          </div>

          <div className="archiveBox">
            <h4>Archive & Clean Used Codes</h4>
            <p>
              Download a CSV backup of old used codes, then permanently delete
              them from Firebase to keep the database lean.
            </p>
            <div className="archiveControls">
              <select
                className="daysSelect"
                value={cleanDays}
                onChange={(e) => setCleanDays(Number(e.target.value))}
              >
                <option value={30}>Older than 30 days</option>
                <option value={60}>Older than 60 days</option>
                <option value={90}>Older than 90 days</option>
                <option value={180}>Older than 180 days</option>
              </select>
              <button
                className="archiveBtn"
                onClick={archiveAndClean}
                disabled={cleaning}
              >
                {cleaning ? "Archiving..." : "Archive & Delete"}
              </button>
            </div>
          </div>

          <div className="filterBar">
            {(
              ["all", "unused", "used", "printed", "unprinted"] as CodeFilter[]
            ).map((f) => (
              <button
                key={f}
                className={`filterBtn ${
                  codeFilter === f ? "activeFilter" : ""
                }`}
                onClick={() => setCodeFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "all"
                  ? ` (${totalCodes})`
                  : f === "used"
                  ? ` (${usedCodes})`
                  : f === "unused"
                  ? ` (${unusedCodes})`
                  : f === "printed"
                  ? ` (${printedCodes})`
                  : ` (${totalCodes - printedCodes})`}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search codes..."
            className="searchInput"
            value={codeSearch}
            onChange={(e) => setCodeSearch(e.target.value)}
          />

          <button className="exportBtn" onClick={exportCodesCSV}>
            Download Codes CSV
          </button>

          {/* BULK ACTIONS BAR — Codes */}
          {selectedCodes.length > 0 && (
            <div className="bulkActionsBar">
              <span className="bulkCount">{selectedCodes.length} selected</span>
              <div className="bulkBtns">
                <button
                  className="bulkDeleteBtn"
                  onClick={() =>
                    openConfirm(
                      "Delete Selected Codes",
                      `Permanently delete ${selectedCodes.length} selected code(s)? This cannot be undone.`,
                      deleteSelectedCodes
                    )
                  }
                >
                  Delete Selected
                </button>
                <button
                  className="bulkClearBtn"
                  onClick={() => setSelectedCodes([])}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="tableWrapper" style={{ marginTop: "14px" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      className="printCheckbox"
                      checked={
                        selectedCodes.length === filteredCodes.length &&
                        filteredCodes.length > 0
                      }
                      onChange={() => toggleSelectAllCodes(filteredCodes)}
                    />
                  </th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Printed</th>
                  <th>Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        color: "#94a3b8",
                      }}
                    >
                      No codes found
                    </td>
                  </tr>
                ) : (
                  filteredCodes.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        selectedCodes.includes(c.id) ? "selectedRow" : ""
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="printCheckbox"
                          checked={selectedCodes.includes(c.id)}
                          onChange={() => toggleSelectCode(c.id)}
                        />
                      </td>
                      <td>
                        <code
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: "13px",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {c.code}
                        </code>
                      </td>
                      <td>
                        <span
                          className={`statusBadge ${
                            c.used ? "usedBadge" : "unusedBadge"
                          }`}
                        >
                          {c.used ? "Used" : "Unused"}
                        </span>
                      </td>
                      <td>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="printCheckbox"
                            checked={!!c.printed}
                            onChange={() => togglePrinted(c.id, c.printed)}
                          />
                          <span className="printLabel">
                            {c.printed ? "Printed" : "Not printed"}
                          </span>
                        </label>
                      </td>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "12.5px",
                        }}
                      >
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>
                        <button
                          className="deleteBtn"
                          onClick={() => deleteCode(c.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REWARDS CONFIG ────────────────────────────────────────────────────── */}
      {activeTab === "rewards" && (
        <div className="rewardConfigBox">
          <h2>Rewards Configuration</h2>

          <div className="configRow">
            <label>Claim Window (hours)</label>
            <div className="configControl">
              <button
                className="adjBtn"
                onClick={() => setClaimHours(Math.max(1, claimHours - 1))}
              >
                −
              </button>
              <span className="configVal">{claimHours}h</span>
              <button
                className="adjBtn"
                onClick={() => setClaimHours(claimHours + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="rewardOptionsBox">
            <h3>Reward Options</h3>
            {rewardOptions.map((r, i) => (
              <div className="rewardOptionRow" key={i}>
                {editingReward === i ? (
                  <>
                    <input
                      className="editRewardInput"
                      value={editRewardVal}
                      onChange={(e) => setEditRewardVal(e.target.value)}
                    />
                    <button
                      className="saveRewardBtn"
                      onClick={() => saveEditReward(i)}
                    >
                      Save
                    </button>
                    <button
                      className="cancelBtn"
                      onClick={() => setEditingReward(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rewardOptionText">{r}</span>
                    <button
                      className="editRewardBtn"
                      onClick={() => {
                        setEditingReward(i);
                        setEditRewardVal(r);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="deleteBtn"
                      onClick={() => deleteReward(i)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
            <div className="addRewardRow">
              <input
                className="addRewardInput"
                placeholder="Add new reward option..."
                value={newReward}
                onChange={(e) => setNewReward(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addReward()}
              />
              <button className="addRewardBtn" onClick={addReward}>
                Add
              </button>
            </div>
          </div>

          <button
            className="saveConfigBtn"
            onClick={saveConfig}
            disabled={configSaving}
          >
            {configSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      )}

      {/* ── CUSTOMERS ─────────────────────────────────────────────────────────── */}
      {activeTab === "customers" && (
        <div>
          {activeTimers.length > 0 && (
            <div className="activeTimersBox">
              <h3>Customers with Active Reward Timers</h3>
              {activeTimers.map((c) => {
                const countdown = getCountdown(c.claimStartTime);
                return (
                  <div
                    key={c.id}
                    className={`timerRow ${
                      countdown.warning ? "timerWarning" : ""
                    }`}
                  >
                    <div className="timerCustomer">
                      <strong>{c.name}</strong>
                      <span>{c.mobile}</span>
                    </div>
                    <div className="timerReward">
                      {c.selectedReward || "Pending"}
                    </div>
                    <div
                      className={`timerCountdown ${
                        countdown.warning ? "warningText" : ""
                      }`}
                    >
                      {countdown.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <input
            type="text"
            placeholder="Search by name or mobile..."
            className="searchInput"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />

          {customers.length === 0 ? (
            <p className="loadingText">No customers yet</p>
          ) : (
            <div>
              {/* BULK ACTIONS BAR — Customers */}
              {selectedCustomers.length > 0 && (
                <div className="bulkActionsBar">
                  <span className="bulkCount">
                    {selectedCustomers.length} selected
                  </span>
                  <div className="bulkBtns">
                    <button
                      className="bulkBlockBtn"
                      onClick={() =>
                        openConfirm(
                          "Block Selected",
                          `Block ${selectedCustomers.length} customer(s)? They won't be able to access the rewards platform.`,
                          blockSelectedCustomers
                        )
                      }
                    >
                      Block Selected
                    </button>
                    <button
                      className="bulkUnblockBtn"
                      onClick={() =>
                        openConfirm(
                          "Unblock Selected",
                          `Unblock ${selectedCustomers.length} customer(s)?`,
                          unblockSelectedCustomers
                        )
                      }
                    >
                      Unblock Selected
                    </button>
                    <button
                      className="bulkDeleteBtn"
                      onClick={() =>
                        openConfirm(
                          "Delete Selected Customers",
                          `Permanently delete ${selectedCustomers.length} customer record(s)? Their reward history will remain in the History tab.`,
                          deleteSelectedCustomers
                        )
                      }
                    >
                      Delete Selected
                    </button>
                    <button
                      className="bulkClearBtn"
                      onClick={() => setSelectedCustomers([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="tableWrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          className="printCheckbox"
                          checked={
                            selectedCustomers.length ===
                              filteredCustomers.length &&
                            filteredCustomers.length > 0
                          }
                          onChange={() =>
                            toggleSelectAllCustomers(filteredCustomers)
                          }
                        />
                      </th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Total Wins</th>
                      <th>Last Reward</th>
                      <th>Timer</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => {
                      const countdown =
                        c.rewardUnlocked && c.claimStartTime
                          ? getCountdown(c.claimStartTime)
                          : null;
                      const wins = getCustomerWins(c.mobile);
                      return (
                        <tr
                          key={c.id}
                          className={
                            c.blocked
                              ? "blockedRow"
                              : selectedCustomers.includes(c.id)
                              ? "selectedRow"
                              : ""
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              className="printCheckbox"
                              checked={selectedCustomers.includes(c.id)}
                              onChange={() => toggleSelectCustomer(c.id)}
                            />
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "7px",
                              }}
                            >
                              {c.name}
                              {c.blocked && (
                                <span className="blockedBadge">Blocked</span>
                              )}
                            </div>
                          </td>
                          <td
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: "13px",
                            }}
                          >
                            {c.mobile}
                          </td>
                          <td>
                            <span className="totalWonBadge">{wins}</span>
                          </td>
                          <td
                            style={{
                              fontSize: "12.5px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {c.lastRewardClaimed || "—"}
                          </td>
                          <td>
                            {countdown && (
                              <span
                                className={`timerCell ${
                                  countdown.warning ? "warningText" : ""
                                } ${countdown.expired ? "expiredText" : ""}`}
                              >
                                {countdown.text}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="btnGroup">
                              <button
                                className="viewBtn"
                                onClick={() =>
                                  setHistoryModal({ open: true, customer: c })
                                }
                              >
                                History
                              </button>
                              <button
                                className="resetBtn"
                                onClick={() =>
                                  openConfirm(
                                    "Reset Timer",
                                    `Reset timer for ${c.name} (${c.mobile})? Clears current reward state. History is not affected.`,
                                    () => resetTimer(c.mobile, c.name)
                                  )
                                }
                              >
                                Reset Timer
                              </button>
                              {c.blocked ? (
                                <button
                                  className="unblockBtn"
                                  onClick={() =>
                                    openConfirm(
                                      "Unblock Customer",
                                      `Allow ${c.name} (${c.mobile}) to access the rewards platform again?`,
                                      () => unblockCustomer(c.mobile, c.name)
                                    )
                                  }
                                >
                                  Unblock
                                </button>
                              ) : (
                                <button
                                  className="blockBtn"
                                  onClick={() =>
                                    openConfirm(
                                      "Block Customer",
                                      `Block ${c.name} (${c.mobile})? They cannot access rewards until unblocked.`,
                                      () => blockCustomer(c.mobile, c.name)
                                    )
                                  }
                                >
                                  Block
                                </button>
                              )}
                              <button
                                className="deleteBtn"
                                onClick={() => deleteCustomer(c.mobile)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY ───────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div>
          <div className="historyHeader">
            <h2>Complete Reward History</h2>
            <p>All rewards claimed by customers — permanently stored</p>
          </div>

          <div className="customerSummaryBox">
            <h3>Top Customers by Rewards Won</h3>
            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Total Won</th>
                    <th>Last Reward</th>
                    <th>Last Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {[...customers]
                    .filter((c) => getCustomerWins(c.mobile) > 0)
                    .sort(
                      (a, b) =>
                        getCustomerWins(b.mobile) - getCustomerWins(a.mobile)
                    )
                    .map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: "13px",
                          }}
                        >
                          {c.mobile}
                        </td>
                        <td>
                          <span className="totalWonBadge">
                            {getCustomerWins(c.mobile)}
                          </span>
                        </td>
                        <td>{c.lastRewardClaimed || "—"}</td>
                        <td
                          style={{
                            fontSize: "12.5px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {c.lastClaimedAt
                            ? new Date(c.lastClaimedAt).toLocaleString("en-IN")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="historyLogBox">
            <h3>All Claim Events</h3>
            <div className="historyFilters">
              <input
                type="text"
                placeholder="Search name, mobile or reward..."
                className="searchInput"
                style={{ marginBottom: 0 }}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <select
                className="daysSelect"
                value={historyRewardFilter}
                onChange={(e) => setHistoryRewardFilter(e.target.value)}
              >
                <option value="all">All Rewards</option>
                {rewardOptions.map((r, i) => (
                  <option key={i} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                className="daysSelect"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
            <div className="historyActions">
              <span className="historyCount">
                {filteredHistory.length} records
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="exportBtn"
                  style={{ marginBottom: 0 }}
                  onClick={exportHistoryCSV}
                >
                  Export CSV
                </button>
                {selectedHistory.length > 0 && (
                  <button
                    className="deleteBtn"
                    style={{ padding: "9px 18px", fontSize: "13.5px" }}
                    onClick={deleteHistoryRecords}
                  >
                    Delete Selected ({selectedHistory.length})
                  </button>
                )}
              </div>
            </div>
            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        className="printCheckbox"
                        checked={
                          selectedHistory.length === filteredHistory.length &&
                          filteredHistory.length > 0
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Reward Claimed</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          padding: "30px",
                          color: "#94a3b8",
                        }}
                      >
                        No records found
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => (
                      <tr
                        key={h.id}
                        className={
                          selectedHistory.includes(h.id) ? "selectedRow" : ""
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="printCheckbox"
                            checked={selectedHistory.includes(h.id)}
                            onChange={() => toggleSelectHistory(h.id)}
                          />
                        </td>
                        <td>
                          <strong>{h.customerName}</strong>
                        </td>
                        <td
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: "13px",
                          }}
                        >
                          {h.mobile}
                        </td>
                        <td>
                          <span className="rewardClaimedBadge">{h.reward}</span>
                        </td>
                        <td
                          style={{
                            fontSize: "12.5px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {h.claimedAtFormatted || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
