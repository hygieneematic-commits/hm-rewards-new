import "./reward.css";
import logo from "./assets/hm-logo.png";
import {
  QrCode,
  ShieldCheck,
  Gift,
  Sparkles,
  Trophy,
  Timer,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  Package,
  Coins,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
} from "firebase/firestore";

// ── Confetti ────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 48 }, (_, i) => i);
  const colors = [
    "#2563EB",
    "#3B82F6",
    "#60A5FA",
    "#FBBF24",
    "#10B981",
    "#F472B6",
    "#A78BFA",
  ];
  return (
    <div className="confettiContainer" aria-hidden="true">
      {pieces.map((i) => (
        <div
          key={i}
          className="confettiPiece"
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${0.9 + Math.random() * 0.8}s`,
            width: `${6 + Math.random() * 6}px`,
            height: `${6 + Math.random() * 10}px`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // SCRATCH CARD
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [scratchReward, setScratchReward] = useState("");
  const [scratched, setScratched] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [scratchPercent, setScratchPercent] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // REWARD POPUPS
  const [showCountdownPopup, setShowCountdownPopup] = useState(false);
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [claimedRewardName, setClaimedRewardName] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [claimStarted, setClaimStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(86400);
  const [claimSeconds, setClaimSeconds] = useState(86400);

  // CONFIRM DIALOG (Sol 1 & 2)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // CONFIG
  const [rewards, setRewards] = useState([
    "Free Glass Cleaner",
    "Free Floor Cleaner",
    "Free Dishwash Combo",
    "Free Toilet Cleaner",
    "Flat ₹50 Cashback",
  ]);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  // LOAD CONFIG
  useEffect(() => {
    const loadConfig = async () => {
      const snap = await getDoc(doc(db, "config", "rewards"));
      if (snap.exists()) {
        const data = snap.data();
        if (data.claimHours) setClaimSeconds(data.claimHours * 3600);
        if (data.rewardOptions?.length) setRewards(data.rewardOptions);
      }
    };
    loadConfig();
  }, []);

  // AUTO HIDE MESSAGE
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timeout);
    }
  }, [message]);

  // LOAD CUSTOMER
  useEffect(() => {
    const fetchCustomer = async () => {
      if (mobile.length < 10) return;
      const normalizedMobile = normalizeMobile(mobile);
      const customerRef = doc(db, "customers", normalizedMobile);
      const customerSnap = await getDoc(customerRef);
      if (customerSnap.exists()) {
        const data = customerSnap.data();
        if (data.selectedReward) setSelectedReward(data.selectedReward);
        if (data.rewardUnlocked && !data.rewardClaimed) {
          if (data.claimStartTime) {
            const diff =
              claimSeconds -
              Math.floor((Date.now() - data.claimStartTime) / 1000);
            if (diff <= 0) {
              await updateDoc(customerRef, {
                rewardUnlocked: false,
                rewardClaimed: false,
                rewardExpired: true,
                selectedReward: "",
                claimStartTime: null,
              });
              setShowExpiredPopup(true);
            } else {
              setClaimStarted(true);
              setTimeLeft(diff);
              setShowCountdownPopup(true);
            }
          } else {
            setShowCountdownPopup(true);
          }
        }
      }
    };
    fetchCustomer();
  }, [mobile]);

  // TIMER
  useEffect(() => {
    let timer: any;
    if (claimStarted && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    }
    if (timeLeft <= 0 && claimStarted) {
      setClaimStarted(false);
      setShowCountdownPopup(false);
      setShowExpiredPopup(true);
      const normalizedMobile = normalizeMobile(mobile);
      if (normalizedMobile.length === 10) {
        updateDoc(doc(db, "customers", normalizedMobile), {
          rewardUnlocked: false,
          rewardClaimed: false,
          rewardExpired: true,
          selectedReward: "",
          claimStartTime: null,
        });
      }
    }
    return () => clearInterval(timer);
  }, [claimStarted, timeLeft]);

  // SCRATCH CARD CANVAS — premium colorful surface
  useEffect(() => {
    if (!showScratchCard) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rich blue-purple-gold gradient surface
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#1E3A8A");
    grad.addColorStop(0.35, "#2563EB");
    grad.addColorStop(0.65, "#7C3AED");
    grad.addColorStop(1, "#1D4ED8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle radial glow spots
    const glow1 = ctx.createRadialGradient(60, 40, 0, 60, 40, 90);
    glow1.addColorStop(0, "rgba(251,191,36,0.25)");
    glow1.addColorStop(1, "transparent");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow2 = ctx.createRadialGradient(
      canvas.width - 50,
      canvas.height - 30,
      0,
      canvas.width - 50,
      canvas.height - 30,
      80
    );
    glow2.addColorStop(0, "rgba(167,139,250,0.3)");
    glow2.addColorStop(1, "transparent");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Diagonal shimmer stripes
    for (let i = -2; i < 10; i++) {
      ctx.beginPath();
      const x = (canvas.width / 7) * i;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, canvas.height);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 18;
      ctx.stroke();
    }

    // Dot pattern
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let r = 0; r < canvas.height; r += 14) {
      for (let c = 0; c < canvas.width; c += 14) {
        ctx.beginPath();
        ctx.arc(c, r, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Gold star decorations
    const drawStar = (x: number, y: number, size: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(251,191,36,${alpha})`;
      ctx.font = `${size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✦", 0, 0);
      ctx.restore();
    };
    drawStar(28, 22, 14, 0.6);
    drawStar(canvas.width - 28, canvas.height - 22, 14, 0.55);
    drawStar(canvas.width - 24, 24, 10, 0.4);
    drawStar(24, canvas.height - 20, 10, 0.4);

    // Centre text with glow
    ctx.save();
    ctx.shadowColor = "rgba(251,191,36,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#FBBF24";
    ctx.font = "bold 15px 'DM Sans','Segoe UI',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "✦  Scratch to Reveal Your Reward  ✦",
      canvas.width / 2,
      canvas.height / 2 - 10
    );
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px 'DM Sans','Segoe UI',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Use finger or mouse",
      canvas.width / 2,
      canvas.height / 2 + 14
    );
  }, [showScratchCard]);

  // SCRATCH LOGIC — unchanged
  const getScratchPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const scratch = (e: any) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getScratchPos(e, canvas);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
    ctx.fill();
    checkScratchPercent(ctx, canvas);
  };

  const checkScratchPercent = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++;
    }
    const percent = (transparent / (canvas.width * canvas.height)) * 100;
    setScratchPercent(percent);
    // Trigger at 1% — reveals on first scratch gesture
    if (percent > 1 && !scratched) {
      setScratched(true);
      // Instantly wipe remaining canvas so reward shows fully
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setScratchPercent(100);
      // Hide canvas element entirely so reward layer is crystal clear
      setRevealed(true);
      // Hold on revealed reward for ~2.8s then move to countdown popup
      setTimeout(() => {
        setShowScratchCard(false);
        setRevealed(false);
        setShowCountdownPopup(true);
        setClaimStarted(true);
        setTimeLeft(claimSeconds);
      }, 2800);
    }
  };

  // VALIDATION
  const validateMobile = (num: string): boolean =>
    /^[6-9][0-9]{9}$/.test(num.trim());
  const normalizeMobile = (num: string): string => num.trim();

  // SUBMIT — unchanged
  const handleSubmit = async () => {
    if (!name || !mobile || !code) {
      setMessage("Please fill all details");
      return;
    }
    if (mobile.length !== 10 || !validateMobile(mobile)) {
      setMessage("Enter valid 10-digit mobile number starting with 6-9");
      return;
    }
    setLoading(true);
    try {
      const cleanCode = code.trim().toUpperCase();
      const codeRef = doc(db, "codes", cleanCode);
      const codeSnap = await getDoc(codeRef);

      // CHECK IF CUSTOMER IS BLOCKED before doing anything
      const normalizedMobileCheck = normalizeMobile(mobile);
      const customerCheckRef = doc(db, "customers", normalizedMobileCheck);
      const customerCheckSnap = await getDoc(customerCheckRef);
      if (customerCheckSnap.exists() && customerCheckSnap.data().blocked) {
        setMessage(
          "Your account has been temporarily restricted. Please contact support for assistance."
        );
        return;
      }
      if (!codeSnap.exists()) {
        setMessage("Invalid Product Code");
        return;
      }
      if (codeSnap.data().used) {
        setMessage("This code has already been used");
        return;
      }
      await updateDoc(codeRef, { used: true, usedAt: Date.now() });

      const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
      setScratchReward(randomReward);
      setSelectedReward(randomReward);

      const normalizedMobile = normalizeMobile(mobile);
      const customerRef = doc(db, "customers", normalizedMobile);
      const custSnap = await getDoc(customerRef);
      const prevTotal = custSnap.exists()
        ? custSnap.data().totalRewardsWon || 0
        : 0;

      await setDoc(
        customerRef,
        {
          name,
          mobile: normalizedMobile,
          rewardUnlocked: true,
          rewardClaimed: false,
          rewardExpired: false,
          selectedReward: randomReward,
          claimStartTime: Date.now(),
          lastScanDate: Date.now(),
          totalRewardsWon: prevTotal,
        },
        { merge: true }
      );

      setCode("");
      setScratched(false);
      setRevealed(false);
      setScratchPercent(0);
      setShowScratchCard(true);
    } catch (err) {
      console.log(err);
      setMessage("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // LIVE CLOCK — updates every second on the countdown screen
  const [liveTime, setLiveTime] = useState(() =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );
  useEffect(() => {
    if (!showCountdownPopup) return;
    const interval = setInterval(() => {
      setLiveTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [showCountdownPopup]);

  // CLAIM HANDLER — extracted so confirm dialog can call it
  const handleClaim = async () => {
    try {
      const normalizedMobile = normalizeMobile(mobile);
      const customerRef = doc(db, "customers", normalizedMobile);
      await addDoc(collection(db, "rewardHistory"), {
        customerName: name,
        mobile: normalizedMobile,
        reward: selectedReward,
        claimedAt: Date.now(),
        claimedAtFormatted: new Date().toLocaleString("en-IN"),
      });
      const custSnap = await getDoc(customerRef);
      const prevTotal = custSnap.exists()
        ? custSnap.data().totalRewardsWon || 0
        : 0;
      await updateDoc(customerRef, {
        rewardUnlocked: false,
        rewardClaimed: true,
        selectedReward: "",
        claimStartTime: null,
        totalRewardsWon: prevTotal + 1,
        lastRewardClaimed: selectedReward,
        lastClaimedAt: Date.now(),
      });
      setShowConfirmDialog(false);
      setShowCountdownPopup(false);
      setClaimStarted(false);
      setClaimedRewardName(selectedReward);
      setSelectedReward("");
      setTimeLeft(claimSeconds);
      setShowSuccessPopup(true);
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong");
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return {
      h: String(h).padStart(2, "0"),
      m: String(m).padStart(2, "0"),
      s: String(s).padStart(2, "0"),
    };
  };
  const t = formatTime(timeLeft);

  return (
    <>
      {/* TOAST */}
      {message && (
        <div
          className={`toastPopup ${
            message.includes("Invalid") || message.includes("wrong")
              ? "error"
              : message.includes("used")
              ? "warning"
              : ""
          }`}
        >
          <AlertCircle size={16} className="toastIcon" />
          {message}
        </div>
      )}

      <div className="app">
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="header">
          <div className="headerGlow" aria-hidden="true" />
          <div className="headerShine" aria-hidden="true" />
          <div className="logoBox">
            <div className="logoWrap">
              <img src={logo} alt="HM Logo" className="hmLogo" />
            </div>
            <div className="logoText">
              <h1>Hygiene Matic</h1>
              {/* FIX #4: Updated tagline */}
              <span className="logoSub">Apno Ki Suraksha Ke Liye</span>
            </div>
          </div>
          <div className="rewardBadge">
            <Sparkles size={14} className="badgeIcon" />
            <span>Rewards</span>
          </div>
        </header>

        {/* ── HERO — FIX #2 & #3: compact, tighter title spacing ─────────── */}
        <section className="hero">
          <div className="heroBg" aria-hidden="true" />
          <div className="heroShine" aria-hidden="true" />
          <div className="heroContent">
            <div className="offerTag">
              <Zap size={12} />
              NEW LAUNCH OFFER
            </div>
            {/* FIX #3: single h2, tighter line-height, no <br> gap */}
            <h2 className="heroHeading">
              <span className="heroTitle1">Hygiene Matic</span>
              <span className="heroTitle2">Rewards Hub</span>
            </h2>
            <p className="heroDesc">
              Buy a Hygiene Matic combo pack, enter your unique product code and
              instantly win exciting rewards!
            </p>
          </div>
        </section>

        {/* ── INPUT CARD ──────────────────────────────────────────────────── */}
        <section className="inputCard">
          <div className="inputCardHeader">
            <div className="inputCardIcon">
              <Gift size={20} />
            </div>
            <div>
              <h3>Enter Product Code</h3>
              <span>Example: DW48291 / FL19482</span>
            </div>
          </div>
          <div className="inputGroup">
            <label className="inputLabel">Your Name</label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="inputGroup">
            <label className="inputLabel">Mobile Number</label>
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                setMobile(val);
              }}
              maxLength={10}
              inputMode="numeric"
              pattern="[0-9]{10}"
            />
          </div>
          <div className="inputGroup">
            <label className="inputLabel">Unique Product Code</label>
            <input
              type="text"
              placeholder="Enter code from your pack"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button
            className="submitBtn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="loadingDots">
                <span className="spinnerRing" /> Verifying…
              </span>
            ) : (
              <>
                <Sparkles size={17} /> Verify &amp; Win Reward
              </>
            )}
          </button>
          <small className="inputNote">
            One reward valid per combo pack only.
          </small>
        </section>

        {/* ── HOW IT WORKS — FIX #5: overflow visible on stepCard ────────── */}
        <section className="howWorksSection">
          <div className="sectionLabel">
            <Star size={13} /> Simple Process
          </div>
          <h2>How It Works?</h2>
          <p className="howSub">3 simple steps to your instant reward</p>
          <div className="stepsContainer">
            {[
              {
                n: 1,
                icon: <QrCode size={34} />,
                title: "Scan QR Code",
                desc: "Scan the QR code printed on your Hygiene Matic combo pack to open this rewards page.",
              },
              {
                n: 2,
                icon: <ShieldCheck size={34} />,
                title: "Enter Unique Code",
                desc: "Enter the unique product code found inside your combo pack to verify your purchase.",
              },
              {
                n: 3,
                icon: <Gift size={34} />,
                title: "Scratch & Win",
                desc: "Scratch the digital card to instantly reveal your reward. Every purchase is a guaranteed win!",
              },
            ].map(({ n, icon, title, desc }) => (
              <div className="stepCard" key={n}>
                {/* FIX #5: badge is inside card flow, not absolute-clipped */}
                <div className="stepNumberBadge">{n}</div>
                <div className="stepIcon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── INSTANT REWARD SECTION ──────────────────────────────────────── */}
        <section className="bigRewardSection">
          <div className="bigRewardOrb bigRewardOrb1" aria-hidden="true" />
          <div className="bigRewardOrb bigRewardOrb2" aria-hidden="true" />
          <div className="bigRewardInner">
            <div className="bigRewardBadge">
              <Trophy size={12} /> GUARANTEED REWARDS
            </div>
            <h2 className="bigRewardHeading">
              Every Purchase <span className="bigRewardAccent">Wins!</span>
            </h2>
            <p className="bigRewardSub">
              Enter your unique code and scratch to instantly reveal your reward
            </p>
            <div className="rewardCardsRow">
              {[
                { icon: <Package size={15} />, label: "Free Products" },
                { icon: <Coins size={15} />, label: "Cashback" },
                { icon: <Star size={15} />, label: "Special Offers" },
              ].map(({ icon, label }) => (
                <div className="rewardPill" key={label}>
                  <span className="rewardPillIcon">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
            <div className="scratchPreviewCard">
              <div className="scratchPreviewShimmer" />
              <div className="scratchPreviewContent">
                <div className="scratchPreviewLines">
                  <div className="scratchLine long" />
                  <div className="scratchLine short" />
                </div>
                <div className="scratchTag">
                  SCRATCH
                  <br />& WIN
                </div>
              </div>
            </div>
            <p className="bigRewardFootnote">
              One guaranteed reward with every combo pack purchase
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="faqSection">
          <div className="sectionLabel dark">
            <Star size={13} /> Help Center
          </div>
          <h2>Frequently Asked Questions</h2>
          {[
            {
              id: 1,
              q: "How do I find my product code?",
              a: "Your unique product code is printed inside every Hygiene Matic combo pack.",
            },
            {
              id: 2,
              q: "Can I use the same code twice?",
              a: "No. Each product code can only be redeemed once.",
            },
            {
              id: 3,
              q: "Do I win a reward every time?",
              a: "Yes! Every valid unique code gives you a guaranteed instant reward. Scratch the card to reveal it.",
            },
            { id: 4, q: "How long do I have to claim my reward?", a: null },
          ].map(({ id, q, a }) => (
            <div
              className={`faqItem ${openFAQ === id ? "faqOpen" : ""}`}
              key={id}
            >
              <div
                className="faqQuestion"
                onClick={() => setOpenFAQ(openFAQ === id ? null : id)}
              >
                <span>{q}</span>
                {openFAQ === id ? (
                  <ChevronUp size={17} />
                ) : (
                  <ChevronDown size={17} />
                )}
              </div>
              {openFAQ === id && (
                <div className="faqAnswer">
                  {a ?? (
                    <>
                      You must claim your reward within{" "}
                      <strong>
                        {Math.floor(claimSeconds / 3600)} hour
                        {Math.floor(claimSeconds / 3600) !== 1 ? "s" : ""}
                      </strong>{" "}
                      of scratching the card from the same retailer. This is
                      configured by the reward program and may change.
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* ── FOOTER — tagline + social links ───────────────────────────── */}
        <footer className="footer">
          <div className="footerInner">
            <img src={logo} alt="HM" className="footerLogo" />
            <h2>Hygiene Matic</h2>
            <p className="footerTagline">Apno Ki Suraksha Ke Liye</p>
            <p className="footerSub">Smart Cleaning • Instant Rewards</p>

            {/* Social links */}
            <div className="footerSocial">
              <a
                href="https://hygienematic.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="footerSocialLink"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                hygienematic.in
              </a>
              <a
                href="https://www.instagram.com/hygienematic.in"
                target="_blank"
                rel="noopener noreferrer"
                className="footerSocialLink"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                @hygienematic.in
              </a>
            </div>

            <div className="footerDivider" />
            <span>© 2026 Hygiene Matic. All Rights Reserved.</span>
          </div>
        </footer>

        {/* ── SCRATCH CARD POPUP — FIX #1: premium colorful card ─────────── */}
        {showScratchCard && (
          <div className="popupOverlay">
            <div className="scratchPopup">
              {/* Premium card header */}
              <div className="scratchPopupHeader">
                <div className="scratchTrophyRing">
                  <Trophy size={22} />
                </div>
                <p className="scratchTitle">You've Won! Scratch to Reveal</p>
                <p className="scratchSubtitle">
                  Use your finger or mouse to scratch
                </p>
              </div>

              {/* Premium scratch area */}
              <div className="scratchCardOuter">
                {/* Glow pulse ring */}
                <div className="scratchGlowRing" />
                <div className="scratchWrapper">
                  {/* Reward behind layer */}
                  <div
                    className={`scratchRewardBehind ${
                      revealed ? "revealed" : ""
                    }`}
                  >
                    <div className="scratchRewardBehindBg" />
                    <div className="scratchRewardBehindContent">
                      <div className="scratchGiftCircle">
                        <Gift size={30} />
                      </div>
                      <div className="scratchRewardName">{scratchReward}</div>
                      <div className="scratchRewardLabel">YOUR REWARD</div>
                    </div>
                  </div>
                  {/* Canvas overlay */}
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={170}
                    className={`scratchCanvas ${revealed ? "revealed" : ""}`}
                    onMouseDown={() => {
                      isDrawing.current = true;
                    }}
                    onMouseMove={scratch}
                    onMouseUp={() => {
                      isDrawing.current = false;
                    }}
                    onMouseLeave={() => {
                      isDrawing.current = false;
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      isDrawing.current = true;
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      scratch(e);
                    }}
                    onTouchEnd={() => {
                      isDrawing.current = false;
                    }}
                  />
                </div>
              </div>

              {/* Progress */}
              <div className="scratchProgressWrap">
                <div className="scratchProgress">
                  <div
                    className="scratchProgressBar"
                    style={{ width: `${Math.min(scratchPercent, 100)}%` }}
                  />
                </div>
                <p className="scratchHint">
                  {revealed ? (
                    <span className="scratchRevealMsg">
                      <CheckCircle2 size={14} /> Your reward is revealed!
                    </span>
                  ) : scratched ? (
                    <span className="scratchRevealMsg">
                      <CheckCircle2 size={14} /> Reward Revealed!
                    </span>
                  ) : (
                    `${Math.round(scratchPercent)}% scratched`
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── COUNTDOWN POPUP ──────────────────────────────────────────────── */}
        {showCountdownPopup && (
          <div className="popupOverlay">
            <div className="popup countdownPopup">
              <div className="popupTopBand" />

              {/* LIVE indicator — Sol 6: cannot be faked in a screenshot */}
              <div className="liveRow">
                <span className="liveDot" />
                <span className="liveLabel">LIVE</span>
                <span className="liveClock">{liveTime}</span>
              </div>

              <div className="rewardUnlockedTag">
                <CheckCircle2 size={13} /> Reward Unlocked
              </div>
              <h2>
                <Timer size={20} className="popupTitleIcon" /> Collect Your
                Reward
              </h2>
              <h3 className="rewardNameBig">{selectedReward}</h3>

              {/* Timer */}
              <div className="timerDisplay">
                <div className="timerBlock">
                  <span className="timerDigit">{t.h}</span>
                  <span className="timerUnit">hrs</span>
                </div>
                <span className="timerColon">:</span>
                <div className="timerBlock">
                  <span className="timerDigit">{t.m}</span>
                  <span className="timerUnit">min</span>
                </div>
                <span className="timerColon">:</span>
                <div className="timerBlock">
                  <span className="timerDigit">{t.s}</span>
                  <span className="timerUnit">sec</span>
                </div>
              </div>

              {/* Steps — Sol 5: inline help */}
              <div className="claimSteps">
                <div className="claimStep">
                  <div className="claimStepNum">1</div>
                  <span>
                    Visit the <strong>same store</strong> where you bought the
                    product
                  </span>
                </div>
                <div className="claimStep">
                  <div className="claimStepNum">2</div>
                  <span>
                    Show this <strong>live screen</strong> to the shopkeeper
                  </span>
                </div>
                <div className="claimStep">
                  <div className="claimStepNum">3</div>
                  <span>
                    Press <strong>"I Received My Reward"</strong> after
                    shopkeeper confirms
                  </span>
                </div>
              </div>

              {/* Sol 1 + Sol 2: renamed button → opens confirm dialog */}
              <button
                className="claimBtn"
                onClick={() => setShowConfirmDialog(true)}
              >
                <CheckCircle2 size={17} /> I Received My Reward
              </button>

              {/* Help center — Sol 5 */}
              <div className="helpCenter">
                <p className="helpCenterTitle">
                  <AlertCircle size={13} /> Need Help?
                </p>
                <div className="helpLinks">
                  <a
                    href="https://wa.me/919999999999?text=Hi%2C+I+need+help+with+my+Hygiene+Matic+reward"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="helpLink"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp Support
                  </a>
                  <a
                    href="https://hygienematic.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="helpLink"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Visit Website
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRMATION DIALOG — Sol 1: "Are you sure?" gate ────────────── */}
        {showConfirmDialog && (
          <div className="popupOverlay" style={{ zIndex: 999999 }}>
            <div className="confirmDialog">
              <div className="confirmIconWrap">
                <AlertCircle size={28} />
              </div>
              <h3 className="confirmTitle">Confirm Receipt</h3>
              <p className="confirmMsg">
                Press <strong>"Yes, I Got It"</strong> only after the shopkeeper
                has handed you the reward.
                <br />
                <br />
                <strong>This cannot be undone.</strong>
              </p>
              <div className="confirmBtns">
                <button
                  className="confirmBtnCancel"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  <X size={15} /> Not Yet
                </button>
                <button className="confirmBtnOk" onClick={handleClaim}>
                  <CheckCircle2 size={15} /> Yes, I Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EXPIRED POPUP ────────────────────────────────────────────────── */}
        {showExpiredPopup && (
          <div className="popupOverlay">
            <div className="popup successPopup expiredPopup">
              <button
                className="popupClose"
                onClick={() => setShowExpiredPopup(false)}
              >
                <X size={15} />
              </button>
              <div className="successIconWrap expired">
                <Clock size={28} />
              </div>
              <h2 className="expiredTitle">Reward Expired</h2>
              <p className="expiredMsg">
                You missed the reward claim window. Better luck next time!
                Purchase a new combo pack to win again.
              </p>
            </div>
          </div>
        )}

        {/* ── SUCCESS POPUP ────────────────────────────────────────────────── */}
        {showSuccessPopup && (
          <div className="popupOverlay">
            <div className="popup successPopup">
              <Confetti />
              <button
                className="popupClose"
                onClick={() => setShowSuccessPopup(false)}
              >
                <X size={15} />
              </button>
              <div className="successIconWrap">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="successTitle">Reward Received!</h2>
              <h3 className="successRewardName">{claimedRewardName}</h3>
              <p className="successNote">
                Thank you for choosing Hygiene Matic. Enjoy your reward and keep
                your home clean!
              </p>
              <button
                className="closeSuccessBtn"
                onClick={() => setShowSuccessPopup(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
