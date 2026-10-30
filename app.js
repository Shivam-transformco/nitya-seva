(function () {
  const cfg = window.SEVA_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const form = $("#seva-form");
  const thanks = $("#thanks");
  const errorBox = $(".form-error", form);
  const amountInput = form.elements.amount;
  const customWrap = $(".custom-amount", form);
  const customInput = form.elements.customAmount;

  const waLink = (text) =>
    `https://wa.me/${cfg.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

  function fillContactDetails() {
    const tel = `tel:${(cfg.phoneDisplay || "").replace(/\s/g, "")}`;
    $("#wa-direct").href = waLink("Hare Krishna! I would like to know more about Nitya Seva at ISKCON Jiasarai.");
    $("#phone-link").href = tel;
    $("#phone-link").textContent = cfg.phoneDisplay || "";
    $("#footer-phone").href = tel;
    $("#footer-phone").textContent = cfg.phoneDisplay || "";
    $("#footer-email").href = `mailto:${cfg.email}`;
    $("#footer-email").textContent = cfg.email || "";
    $("#footer-address").textContent = cfg.address || "";
    $("#footer-map").href = cfg.mapsUrl || "#";
  }

  function renderStats() {
    $("#stats").innerHTML = (cfg.stats || [])
      .map((s) => `<div class="stat reveal"><strong>${s.value}</strong><span>${s.label}</span></div>`)
      .join("");
  }

  function renderPurposeChecks() {
    $("#purpose-checks").innerHTML = $$(".card[data-purpose]")
      .map((card) => {
        const p = card.dataset.purpose;
        return `<label><input type="checkbox" name="purpose" value="${p}" />${p}</label>`;
      })
      .join("");
  }

  function scrollToForm() {
    $("#join").scrollIntoView({ behavior: "smooth" });
    form.classList.remove("flash");
    void form.offsetWidth;
    form.classList.add("flash");
  }

  function selectAmount(value) {
    $$(".chip", form).forEach((c) => c.classList.toggle("active", c.dataset.amount === value));
    const isCustom = value === "custom";
    customWrap.hidden = !isCustom;
    amountInput.value = isCustom ? customInput.value : value;
    if (isCustom) customInput.focus({ preventScroll: true });
  }

  function selectPurpose(purpose) {
    const box = $(`input[name="purpose"][value="${CSS.escape(purpose)}"]`, form);
    if (box) box.checked = true;
  }

  function bindInteractions() {
    $$(".chip", form).forEach((chip) =>
      chip.addEventListener("click", () => selectAmount(chip.dataset.amount))
    );
    customInput.addEventListener("input", () => (amountInput.value = customInput.value));

    $$(".tier").forEach((tier) =>
      $("button", tier).addEventListener("click", () => {
        selectAmount(tier.dataset.amount);
        scrollToForm();
      })
    );

    $$(".card[data-purpose]").forEach((card) =>
      $(".link-btn", card).addEventListener("click", () => {
        selectPurpose(card.dataset.purpose);
        scrollToForm();
      })
    );

    form.addEventListener("submit", onSubmit);
    $("#thanks-reset").addEventListener("click", () => {
      form.reset();
      selectAmount("");
      thanks.hidden = true;
      form.hidden = false;
      scrollToForm();
    });
  }

  function collect() {
    const data = new FormData(form);
    return {
      name: (data.get("name") || "").trim(),
      phone: (data.get("phone") || "").trim(),
      email: (data.get("email") || "").trim(),
      city: (data.get("city") || "").trim(),
      amount: (data.get("amount") || "").trim(),
      frequency: data.get("frequency") || "",
      purposes: data.getAll("purpose").join(", "),
      occasion: data.get("occasion") || "",
      contactTime: data.get("contactTime") || "",
      message: (data.get("message") || "").trim(),
      website: data.get("website") || "",
      consent: data.get("consent") ? "yes" : "",
    };
  }

  function validate(d) {
    $$(".invalid", form).forEach((el) => el.classList.remove("invalid"));
    const problems = [];
    if (!d.name) {
      problems.push("your name");
      form.elements.name.classList.add("invalid");
    }
    const digits = d.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      problems.push("a valid phone number");
      form.elements.phone.classList.add("invalid");
    }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      problems.push("a valid email (or leave it empty)");
      form.elements.email.classList.add("invalid");
    }
    if (!d.amount || Number(d.amount) <= 0) {
      problems.push("your offering amount");
      customInput.classList.toggle("invalid", !customWrap.hidden);
    }
    if (!d.consent) problems.push("your consent to be contacted");
    return problems;
  }

  function whatsappMessage(d) {
    return [
      "Hare Krishna! I would like to become a Nitya Sevak at ISKCON Jiasarai.",
      `Name: ${d.name}`,
      `Phone: ${d.phone}`,
      d.email && `Email: ${d.email}`,
      d.city && `City: ${d.city}`,
      `Offering: ₹${Number(d.amount).toLocaleString("en-IN")} (${d.frequency})`,
      d.purposes && `For: ${d.purposes}`,
      d.occasion && `Occasion: ${d.occasion}`,
      `Best time to call: ${d.contactTime}`,
      d.message && `Message: ${d.message}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function onSubmit(e) {
    e.preventDefault();
    errorBox.hidden = true;
    const d = collect();

    if (d.website) return showThanks(d.name);

    const problems = validate(d);
    if (problems.length) {
      errorBox.textContent = `Please add ${problems.join(", ")}.`;
      errorBox.hidden = false;
      return;
    }

    const button = $("button[type=submit]", form);
    button.disabled = true;
    button.textContent = "Sending…";

    try {
      if (cfg.formEndpoint) {
        // Apps Script web apps don't send CORS headers, so the response is opaque.
        await fetch(cfg.formEndpoint, {
          method: "POST",
          mode: "no-cors",
          body: new URLSearchParams({ ...d, submittedFrom: location.href }),
        });
      } else {
        window.open(waLink(whatsappMessage(d)), "_blank", "noopener");
      }
      showThanks(d.name);
    } catch (err) {
      errorBox.innerHTML = `Something went wrong while sending. Please <a href="${waLink(
        whatsappMessage(d)
      )}" target="_blank" rel="noopener">send your details on WhatsApp</a> instead.`;
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Offer my seva";
    }
  }

  function showThanks(name) {
    $("#thanks-name").textContent = name.split(" ")[0] || "dear devotee";
    form.hidden = true;
    thanks.hidden = false;
    thanks.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setupReveal() {
    const targets = $$(".card, .tier, .steps li, .stat, .why .container, .faq details");
    targets.forEach((el) => el.classList.add("reveal"));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 }
    );
    targets.forEach((el) => io.observe(el));
  }

  fillContactDetails();
  renderStats();
  renderPurposeChecks();
  bindInteractions();
  setupReveal();
})();
