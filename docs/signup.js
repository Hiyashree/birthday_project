document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;

  // Capture form data
  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    birthday: form.birthday.value
  };

  try {
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      alert("🎉 Signup successful! Redirecting to login...");
      window.location.href = "login.html";
    } else {
      alert(result.message || "Signup failed. Please try again.");
    }

  } catch (error) {
    alert("❌ Error connecting to server. Please try again later.");
    console.error("Signup error:", error);
  }
});
