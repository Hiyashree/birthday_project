document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;

  // Get email and password from form
  const data = {
    email: form.email.value.trim(),
    password: form.password.value
  };

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      localStorage.setItem("user", JSON.stringify(result.user));
      alert("🎉 Login successful!");
      window.location.href = "dashboard.html";
    } else {
      alert(result.message || "Login failed. Please check your credentials.");
    }
  } catch (error) {
    alert("❌ Error connecting to server. Please try again later.");
    console.error("Login error:", error);
  }
});
