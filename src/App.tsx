import "./reward.css";

import logo from "./assets/hm-logo.png";

import { QrCode, ShieldCheck, Gift } from "lucide-react";

import { useEffect, useState } from "react";

import { db } from "./firebase";

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

export default function App() {
  const [name, setName] = useState("");

  const [mobile, setMobile] = useState("");

  const [code, setCode] = useState("");

  const [stamps, setStamps] = useState(0);

  const [message, setMessage] = useState("");

  const [rewardUnlocked, setRewardUnlocked] = useState(false);

  const [showRewardPopup, setShowRewardPopup] = useState(false);

  const [claimStarted, setClaimStarted] = useState(false);

  const [timeLeft, setTimeLeft] = useState(86400);

  const [selectedReward, setSelectedReward] = useState("");

  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const [stampsRequired, setStampsRequired] = useState(4);
  const [claimSeconds, setClaimSeconds] = useState(86400);
  const [rewards, setRewards] = useState([
    "Free Glass Cleaner",
    "Free Floor Cleaner",
    "Free Dishwash Combo",
    "Free Toilet Cleaner",
    "Flat ₹50 Cashback",
  ]);

  // LOAD CONFIG FROM FIREBASE
  useEffect(() => {
    const loadConfig = async () => {
      const snap = await getDoc(doc(db, "config", "rewards"));
      if (snap.exists()) {
        const data = snap.data();
        if (data.stampsRequired) setStampsRequired(data.stampsRequired);
        if (data.claimHours) setClaimSeconds(data.claimHours * 3600);
        if (data.rewardOptions?.length) setRewards(data.rewardOptions);
      }
    };
    loadConfig();
  }, []);

  // AUTO HIDE MESSAGE

  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => {
        setMessage("");
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [message]);

  // LOAD CUSTOMER

  useEffect(() => {
    const fetchCustomer = async () => {
      if (mobile.length < 10) return;

      const customerRef = doc(db, "customers", mobile);

      const customerSnap = await getDoc(customerRef);

      if (customerSnap.exists()) {
        const data = customerSnap.data();

        setStamps(data.stamps || 0);

        if (data.rewardUnlocked) {
          setRewardUnlocked(true);

          if (!data.rewardClaimed) {
            setShowRewardPopup(true);
          }
        }

        if (data.selectedReward) {
          setSelectedReward(data.selectedReward);
        }

        if (data.claimStartTime) {
          const diff =
            claimSeconds -
            Math.floor((Date.now() - data.claimStartTime) / 1000);

          if (diff > 0) {
            setClaimStarted(true);

            setTimeLeft(diff);
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
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    if (timeLeft <= 0) {
      setRewardUnlocked(false);

      setShowRewardPopup(false);

      setClaimStarted(false);

      setMessage("⌛ Reward claim expired");
    }

    return () => clearInterval(timer);
  }, [claimStarted, timeLeft]);

  // SUBMIT

  const handleSubmit = async () => {
    if (!name || !mobile || !code) {
      setMessage("Please fill all details");

      return;
    }

    try {
      const cleanCode = code.trim().toUpperCase();

      // CHECK CODE

      const codeRef = doc(db, "codes", cleanCode);

      const codeSnap = await getDoc(codeRef);

      // INVALID CODE

      if (!codeSnap.exists()) {
        setMessage("❌ Invalid Product Code");

        return;
      }

      const codeData = codeSnap.data();

      // ALREADY USED

      if (codeData.used) {
        setMessage("⚠️ This code already used");

        return;
      }

      // MARK USED

      await updateDoc(codeRef, {
        used: true,
      });

      // CUSTOMER

      const customerRef = doc(db, "customers", mobile);

      const customerSnap = await getDoc(customerRef);

      let currentStamps = 0;

      if (customerSnap.exists()) {
        currentStamps = customerSnap.data().stamps || 0;
      }

      // ONLY 1 STAMP

      const updatedStamps = Math.min(currentStamps + 1, stampsRequired);

      // UNLOCK

      const unlocked = updatedStamps >= stampsRequired;

      let randomReward = "";

      if (unlocked) {
        randomReward = rewards[Math.floor(Math.random() * rewards.length)];
      }

      // SAVE CUSTOMER

      await setDoc(
        customerRef,
        {
          name,
          mobile,

          stamps: updatedStamps,

          rewardUnlocked: unlocked,

          rewardClaimed: false,

          selectedReward: randomReward,

          claimStartTime: unlocked ? Date.now() : null,

          lastScanDate: Date.now(),
        },
        { merge: true }
      );

      // UI UPDATE

      setStamps(updatedStamps);

      if (unlocked) {
        setRewardUnlocked(true);

        setShowRewardPopup(true);

        setSelectedReward(randomReward);

        setClaimStarted(true);

        setTimeLeft(claimSeconds);

        setMessage("🎉 Reward Unlocked!");
      } else {
        setMessage("✅ Stamp collected successfully!");
      }

      // CLEAR CODE

      setCode("");
    } catch (err) {
      console.log(err);

      setMessage("Something went wrong");
    }
  };
  return (
    <>
      {/* TOAST */}

      {message && (
        <div
          className={`toastPopup ${
            message.includes("Invalid")
              ? "error"
              : message.includes("used")
              ? "warning"
              : ""
          }`}
        >
          {message}
        </div>
      )}

      <div className="app"></div>

      <div className="app">
        {/* HEADER */}

        <header className="header">
          <div className="logoBox">
            <img src={logo} alt="HM Logo" className="hmLogo" />

            <h1>Hygiene Matic</h1>
          </div>

          <div className="rewardCount">
            🎁 {stamps}/{stampsRequired}
          </div>
        </header>

        {/* HERO */}

        <section className="hero">
          <div className="offerTag">🎉 NEW LAUNCH OFFER</div>

          <h2>
            <span className="heroTitle1">Hygiene Matic</span>
            <br />
            <span className="heroTitle2">Rewards Hub</span>
          </h2>

          <p>
            Scan your combo pack, enter your unique product code and collect
            reward stamps on every purchase. Buy {stampsRequired}, get 1 free!
          </p>
        </section>

        {/* INPUT */}

        <section className="inputCard">
          <h3>Enter Product Code</h3>

          <span>Example: DW48291 / FL19482</span>

          <input
            type="text"
            placeholder="Enter Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="tel"
            placeholder="Enter Mobile Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />

          <input
            type="text"
            placeholder="Enter Unique Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button onClick={handleSubmit}>Verify & Collect Reward</button>

          <small>One reward scan valid per combo pack only.</small>
        </section>

        {/* REWARD */}

        <section className="rewardBox">
          <h2>BUY {stampsRequired}</h2>

          <h3>GET 1 FREE</h3>

          <div className="stamps">
            {[...Array(stampsRequired)]
              .map((_, i) => i + 1)
              .map((item) => (
                <div
                  key={item}
                  className={`stamp ${stamps >= item ? "activeStamp" : ""}`}
                >
                  {stamps >= item ? "⭐" : item}
                </div>
              ))}
          </div>

          <div className="unlockBox">
            <div className="gift">🎁</div>

            <h4>
              {rewardUnlocked
                ? "Reward Unlocked 🎉"
                : `${stampsRequired - stamps} more to unlock`}
            </h4>

            <p>
              {rewardUnlocked
                ? "Claim your reward now!"
                : "Keep scanning to earn rewards!"}
            </p>
          </div>
        </section>
        {/* HOW IT WORKS */}

        <section className="howWorksSection">
          <h2>How It Works?</h2>

          <p className="howSub">Simple 3-step reward process</p>

          <div className="stepsContainer">
            {/* STEP 1 */}

            <div className="stepCard">
              <div className="stepNumber">1</div>

              <div className="stepIcon">
                <QrCode size={48} color="#0891b2" />
              </div>

              <h3>Scan QR Code</h3>

              <p>
                Scan the QR code printed on your Hygiene Matic combo pack to
                open this rewards page.
              </p>
            </div>

            {/* STEP 2 */}

            <div className="stepCard">
              <div className="stepNumber">2</div>

              <div className="stepIcon">
                <ShieldCheck size={48} color="#0891b2" />
              </div>

              <h3>Enter Unique Code</h3>

              <p>
                Enter the unique product code found inside your combo pack to
                verify your purchase.
              </p>
            </div>

            {/* STEP 3 */}

            <div className="stepCard">
              <div className="stepNumber">3</div>

              <div className="stepIcon">
                <Gift size={48} color="#0891b2" />
              </div>

              <h3>Collect Rewards</h3>

              <p>
                Get reward stamps and unlock exciting offers after every
                purchase. Collect {stampsRequired} stamps to get 1 free reward.
              </p>
            </div>
          </div>
        </section>

        {/* BIG REWARD SECTION */}

        <section className="bigRewardSection">
          <h2>Collect 4, Get 1 Free</h2>

          <p>Every 4 stamps earns you a free Hygiene Matic reward product</p>

          <div className="rewardCard">
            <div className="rewardGift">🎁</div>

            <h3>Free Product Reward</h3>

            <p>Free Hygiene Matic Product + Cashback + Special Offers</p>

            <span>
              Collect {stampsRequired - stamps}
              more stamps to unlock
            </span>
          </div>
        </section>

        {/* FAQ */}

        <section className="faqSection">
          <h2>Frequently Asked Questions</h2>

          {/* FAQ 1 */}

          <div className="faqItem">
            <div
              className="faqQuestion"
              onClick={() => setOpenFAQ(openFAQ === 1 ? null : 1)}
            >
              <span>How do I find my product code?</span>

              <span>{openFAQ === 1 ? "⌃" : "⌄"}</span>
            </div>

            {openFAQ === 1 && (
              <div className="faqAnswer">
                Your unique product code is printed inside every Hygiene Matic
                combo pack.
              </div>
            )}
          </div>

          {/* FAQ 2 */}

          <div className="faqItem">
            <div
              className="faqQuestion"
              onClick={() => setOpenFAQ(openFAQ === 2 ? null : 2)}
            >
              <span>Can I use the same code twice?</span>

              <span>{openFAQ === 2 ? "⌃" : "⌄"}</span>
            </div>

            {openFAQ === 2 && (
              <div className="faqAnswer">
                No. Each product code can only be redeemed once.
              </div>
            )}
          </div>

          {/* FAQ 3 */}

          <div className="faqItem">
            <div
              className="faqQuestion"
              onClick={() => setOpenFAQ(openFAQ === 3 ? null : 3)}
            >
              <span>What happens after I collect 4 stamps?</span>

              <span>{openFAQ === 3 ? "⌃" : "⌄"}</span>
            </div>

            {openFAQ === 3 && (
              <div className="faqAnswer">
                You unlock a free Hygiene Matic reward product + cashback +
                offers.
              </div>
            )}
          </div>

          {/* FAQ 4 */}

          <div className="faqItem">
            <div
              className="faqQuestion"
              onClick={() => setOpenFAQ(openFAQ === 4 ? null : 4)}
            >
              <span>Do my stamps expire?</span>

              <span>{openFAQ === 4 ? "⌃" : "⌄"}</span>
            </div>

            {openFAQ === 4 && (
              <div className="faqAnswer">
                Reward claim expires within 24 hours after unlocking.
              </div>
            )}
          </div>
        </section>

        {/* FOOTER */}

        <footer className="footer">
          <img src={logo} alt="HM" className="footerLogo" />

          <h2>Hygiene Matic</h2>

          <p>Smart Cleaning • Smart Rewards</p>

          <span>©️ 2026 Hygiene Matic. All Rights Reserved.</span>
        </footer>

        {/* POPUP */}

        {showRewardPopup && (
          <div className="popupOverlay">
            <div className="popup">
              <h2>🎉 Reward Unlocked</h2>

              <h3>{selectedReward}</h3>

              <p>
                Claim within 24 hours from the same retailer where you purchased
                Hygiene Matic products.
              </p>

              <div className="timer">
                ⏰ {Math.floor(timeLeft / 3600)}h :
                {Math.floor((timeLeft % 3600) / 60)}m :{timeLeft % 60}s
              </div>

              <button
                onClick={async () => {
                  try {
                    const customerRef = doc(db, "customers", mobile);

                    await updateDoc(customerRef, {
                      stamps: 0,

                      rewardUnlocked: false,

                      rewardClaimed: true,

                      selectedReward: "",

                      claimStartTime: null,
                    });

                    setRewardUnlocked(false);

                    setShowRewardPopup(false);

                    setClaimStarted(false);

                    setSelectedReward("");

                    setStamps(0);

                    setTimeLeft(claimSeconds);

                    setMessage("✅ Reward Claimed Successfully");
                  } catch (error) {
                    console.log(error);

                    setMessage("Something went wrong");
                  }
                }}
              >
                Claim Reward
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
