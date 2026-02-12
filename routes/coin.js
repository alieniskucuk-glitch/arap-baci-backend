router.post("/daily-bonus", auth, async (req, res) => {
  const uid = req.user.uid;
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data();

  if (!data.isPremium) {
    return res.json({ message: "Premium değil" });
  }

  const today = new Date().toISOString().split("T")[0];

  if (data.lastDailyCoin === today) {
    return res.json({ message: "Bugün alındı" });
  }

  await userRef.update({
    abCoin: admin.firestore.FieldValue.increment(8),
    lastDailyCoin: today
  });

  res.json({ success: true });
});
