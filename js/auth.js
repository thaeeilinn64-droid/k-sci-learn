(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const auth = firebaseAuth;
  function showError(form, message) {
    const el = $(".form-error", form);
    el.textContent = message;
    el.hidden = false;
  }
  function clearError(form) { $(".form-error", form).hidden = true; }
  function friendlyError(error) {
    switch (error?.code) {
      case "auth/email-already-in-use": return "ဤအီးမေးလ်ဖြင့် အကောင့်ဖွင့်ထားပြီးဖြစ်ပါသည်";
      case "auth/invalid-email": return "အီးမေးလ်ပုံစံ မှားယွင်းနေပါသည်";
      case "auth/weak-password": return "လျှို့ဝှက်နံပါတ်ကို ပိုမိုခိုင်မာအောင် ဖြည့်ပါ";
      case "auth/invalid-credential": return "အီးမေးလ် သို့မဟုတ် လျှို့ဝှက်နံပါတ် မှားယွင်းနေပါသည်";
      case "auth/too-many-requests": return "ကြိုးစားမှုများနေပါသည်။ ခဏစောင့်ပြီး ပြန်ကြိုးစားပါ";
      case "auth/network-request-failed": return "Internet ချိတ်ဆက်မှုကို စစ်ဆေးပါ";
      case "auth/unauthorized-domain": return "Website domain ကို Firebase Authorized domains ထဲ ထည့်ပါ";
      default: return error?.message || "အကောင့်လုပ်ဆောင်မှု မအောင်မြင်ပါ";
    }
  }
  function localProfile(user, username) {
    let users;
    try { users = JSON.parse(localStorage.getItem("users")) || []; } catch { users = []; }
    let profile = users.find(u => u.firebaseUid === user.uid);
    if (!profile) {
      profile = { id: user.uid, firebaseUid: user.uid, username: username || user.displayName || user.email.split("@")[0], email: user.email, created_at: new Date().toISOString(), videoProgress: {}, favorites: [], quizScores: {}, completed: [] };
      users.push(profile);
      localStorage.setItem("users", JSON.stringify(users));
    }
    const { password: ignored, ...safeProfile } = profile;
    return { ...safeProfile, id: user.uid, firebaseUid: user.uid, email: user.email, username: user.displayName || profile.username, isAdmin: isAdminEmail(user.email), videoProgress: profile.videoProgress || {}, favorites: profile.favorites || [], quizScores: profile.quizScores || {}, completed: profile.completed || [] };
  }
  auth.onAuthStateChanged(async user => {
    if (!user) return;
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        localStorage.setItem("currentUser", JSON.stringify(localProfile(auth.currentUser)));
        location.replace("./index.html");
      }
    } catch (e) { console.warn("Authentication status check:", e); }
  });
  document.querySelectorAll(".tabbtn").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".tabbtn").forEach(b => b.classList.toggle("active", b === button));
    $("#loginForm").hidden = button.dataset.tab !== "login";
    $("#registerForm").hidden = button.dataset.tab !== "register";
    document.querySelectorAll(".form-error").forEach(e => e.hidden = true);
  }));
  document.querySelectorAll(".pwtoggle").forEach(button => button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    input.type = input.type === "password" ? "text" : "password";
    button.classList.toggle("on", input.type === "text");
  }));
  const loginForm = $("#loginForm");
  loginForm.addEventListener("submit", async event => {
    event.preventDefault(); clearError(loginForm);
    const email = loginForm.identifier.value.trim().toLowerCase();
    const password = loginForm.password.value;
    if (!EMAIL_RX.test(email) || !password) return showError(loginForm, "မှန်ကန်သော အီးမေးလ်နှင့် လျှို့ဝှက်နံပါတ် ဖြည့်ပါ");
    const button = loginForm.querySelector('[type="submit"]'); button.disabled = true;
    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      await credential.user.reload();
      if (!credential.user.emailVerified) {
        await auth.signOut();
        localStorage.removeItem("currentUser");
        return showError(loginForm, "အီးမေးလ်ကို Verify မလုပ်ရသေးပါ။ Inbox/Spam ထဲက အတည်ပြုလင့်ခ်ကို နှိပ်ပြီးမှ Login ဝင်ပါ။");
      }
      const profile = localProfile(auth.currentUser);
      localStorage.setItem("currentUser", JSON.stringify(profile));
      location.replace("./index.html");
    } catch (error) { showError(loginForm, friendlyError(error)); }
    finally { button.disabled = false; }
  });
  const registerForm = $("#registerForm");
  registerForm.addEventListener("submit", async event => {
    event.preventDefault(); clearError(registerForm);
    const username = registerForm.username.value.trim();
    const email = registerForm.email.value.trim().toLowerCase();
    const password = registerForm.password.value;
    if (username.length < 2 || !EMAIL_RX.test(email)) return showError(registerForm, "အမည်နှင့် မှန်ကန်သော အီးမေးလ် ဖြည့်ပါ");
    if (!Object.values(PW_RULES).every(rule => rule(password))) return showError(registerForm, "လျှို့ဝှက်နံပါတ်သည် အောက်ပါအချက်အားလုံး ပြည့်စုံရပါမည်");
    const button = registerForm.querySelector('[type="submit"]'); button.disabled = true;
    try {
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      await credential.user.updateProfile({ displayName: username });
      try {
        await credential.user.sendEmailVerification();
      } catch (sendError) {
        await auth.signOut();
        showError(registerForm, "Account ဖန်တီးပြီးသော်လည်း Verification email ပို့မရပါ။ " + friendlyError(sendError));
        return;
      }
      await auth.signOut();
      localStorage.removeItem("currentUser");
      showError(registerForm, "Verification email ပို့ပြီးပါပြီ။ Inbox/Spam ကို စစ်ပြီး Link ကိုနှိပ်ပါ။ ပြီးမှ Login Tab မှ ဝင်ပါ။");
    } catch (error) { showError(registerForm, friendlyError(error)); }
    finally { button.disabled = false; }
  });
  const pwInput = $("#r-pw");
  const updateChecklist = () => document.querySelectorAll("#pwChecklist li").forEach(li => li.classList.toggle("ok", PW_RULES[li.dataset.rule](pwInput.value)));
  pwInput.addEventListener("input", updateChecklist); updateChecklist();
  if (window.lucide) lucide.createIcons();
})();
