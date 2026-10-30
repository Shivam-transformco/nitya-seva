import { useEffect, useRef, useState } from "react";
import config from "../config";
import { formatINR, tiers } from "../content";
import { lotusSrc } from "../lib/assets";
import { submitSeva, whatsappLink, whatsappMessage } from "../lib/submit";
import Reveal from "./Reveal";

const EMPTY_FIELDS = {
  name: "",
  phone: "",
  email: "",
  customAmount: "",
  message: "",
  website: "",
  consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(d, isCustom) {
  const problems = [];
  const invalid = {};
  if (!d.name) {
    problems.push("your name");
    invalid.name = true;
  }
  const digits = d.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    problems.push("a valid phone number");
    invalid.phone = true;
  }
  if (d.email && !EMAIL_RE.test(d.email)) {
    problems.push("a valid email (or leave it empty)");
    invalid.email = true;
  }
  if (!d.amount || Number(d.amount) <= 0) {
    problems.push("your offering amount");
    invalid.customAmount = isCustom;
  }
  if (!d.consent) problems.push("your consent to be contacted");
  return { problems, invalid };
}

function SevaForm({ formRef, amountChoice, onAmountChoice, onSubmitted }) {
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [invalid, setInvalid] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const customRef = useRef(null);

  const isCustom = amountChoice === "custom";
  const amount = isCustom ? fields.customAmount : amountChoice;

  const set = (name) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFields((f) => ({ ...f, [name]: value }));
  };

  const chooseChip = (value) => {
    onAmountChoice(value);
    if (value === "custom") requestAnimationFrame(() => customRef.current?.focus({ preventScroll: true }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const d = {
      name: fields.name.trim(),
      phone: fields.phone.trim(),
      email: fields.email.trim(),
      amount: String(amount || "").trim(),
      frequency: "Monthly",
      message: fields.message.trim(),
      website: fields.website,
      consent: fields.consent ? "yes" : "",
    };

    if (d.website) return onSubmitted(d.name);

    const result = validate(d, isCustom);
    setInvalid(result.invalid);
    if (result.problems.length) {
      setError({ text: `Please add ${result.problems.join(", ")}.` });
      return;
    }

    setSending(true);
    try {
      await submitSeva(d);
      setFields(EMPTY_FIELDS);
      onSubmitted(d.name);
    } catch {
      setError({ fallback: whatsappLink(whatsappMessage(d)) });
    } finally {
      setSending(false);
    }
  }

  const cls = (name) => (invalid[name] ? "invalid" : undefined);

  return (
    <form className="form" id="seva-form" ref={formRef} noValidate onSubmit={handleSubmit}>
      <div className="form-row">
        <label>Full name<span className="req">*</span>
          <input name="name" type="text" autoComplete="name" required placeholder="Your name"
            className={cls("name")} value={fields.name} onChange={set("name")} />
        </label>
      </div>
      <div className="form-row two">
        <label>Phone / WhatsApp<span className="req">*</span>
          <input name="phone" type="tel" autoComplete="tel" required placeholder="10-digit mobile" inputMode="tel"
            className={cls("phone")} value={fields.phone} onChange={set("phone")} />
        </label>
        <label>Email <span className="opt">(optional)</span>
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com"
            className={cls("email")} value={fields.email} onChange={set("email")} />
        </label>
      </div>
      <fieldset className="form-row">
        <legend>Monthly offering<span className="req">*</span></legend>
        <div className="chips">
          {tiers.map((t) => (
            <button key={t.amount} type="button" className={`chip${amountChoice === t.amount ? " active" : ""}`}
              onClick={() => chooseChip(t.amount)}>
              {formatINR(t.amount)}
            </button>
          ))}
          <button type="button" className={`chip${isCustom ? " active" : ""}`} onClick={() => chooseChip("custom")}>
            Other
          </button>
        </div>
        <label className="custom-amount" hidden={!isCustom}>
          <span className="sr-only">Custom amount</span>
          <span className="rupee">₹</span>
          <input ref={customRef} name="customAmount" type="number" min="1" step="1" placeholder="Enter amount"
            inputMode="numeric" className={cls("customAmount")} value={fields.customAmount}
            onChange={set("customAmount")} />
        </label>
      </fieldset>

      <div className="form-row">
        <label>A few words for us <span className="opt">(optional)</span>
          <textarea name="message" rows="3"
            placeholder="Share anything: a prayer, a question, or what drew you to Krishna"
            value={fields.message} onChange={set("message")} />
        </label>
      </div>

      <input className="hp" type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true"
        value={fields.website} onChange={set("website")} />

      <label className="consent">
        <input type="checkbox" name="consent" required checked={fields.consent} onChange={set("consent")} />
        <span>I'm happy to be contacted by ISKCON Jiasarai about my seva.</span>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error.text ?? (
            <>
              Something went wrong while sending. Please{" "}
              <a href={error.fallback} target="_blank" rel="noopener">send your details on WhatsApp</a> instead.
            </>
          )}
        </p>
      )}
      <button className="btn btn-block" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Offer my seva"}
      </button>
    </form>
  );
}

function Thanks({ name, onReset }) {
  const ref = useRef(null);
  useEffect(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), []);
  return (
    <div className="thanks" ref={ref}>
      <img src={lotusSrc} alt="" width="64" height="64" />
      <h2>Hare Krishna, {name.split(" ")[0] || "dear devotee"}!</h2>
      <p>Thank you for stepping forward to serve. A devotee from ISKCON Jiasarai will reach out to you soon.</p>
      <p className="small">May Śrī Śrī Rādhā-Krishna bless you and your family.</p>
      <button className="btn btn-ghost" type="button" onClick={onReset}>Submit another</button>
    </div>
  );
}

export default function Join({ formRef, amountChoice, onAmountChoice, onReset }) {
  const [submittedName, setSubmittedName] = useState(null);
  const tel = `tel:${config.phoneDisplay.replace(/\s/g, "")}`;

  return (
    <section className="join" id="join">
      <div className="container">
        <Reveal className="join-panel">
          <div className="join-aside">
            <img className="join-lotus" src={lotusSrc} alt="" aria-hidden="true" />
            <p className="eyebrow">Become a Nitya Sevak</p>
            <h2>Tell us how you'd like to serve</h2>
            <p>
              Share your details and the offering you have in mind. A devotee from ISKCON Jiasarai will personally
              reach out to you, answer your questions and help you set up your seva.
            </p>
            <ul className="assurances">
              <li>No payment is taken on this website</li>
              <li>A devotee will contact you within 2 days</li>
              <li>Receipt for every offering</li>
              <li>Change or pause your seva anytime</li>
            </ul>
            <div className="contact-card">
              <p>Prefer to talk right away?</p>
              <a className="btn btn-wa btn-small" target="_blank" rel="noopener"
                href={whatsappLink("Hare Krishna! I would like to know more about Nitya Seva at ISKCON Jiasarai.")}>
                Message us on WhatsApp
              </a>
              <p className="contact-call">or call <a href={tel}>{config.phoneDisplay}</a></p>
            </div>
          </div>

          {submittedName === null ? (
            <SevaForm
              formRef={formRef}
              amountChoice={amountChoice}
              onAmountChoice={onAmountChoice}
              onSubmitted={setSubmittedName}
            />
          ) : (
            <Thanks
              name={submittedName}
              onReset={() => {
                setSubmittedName(null);
                onReset();
              }}
            />
          )}
        </Reveal>
      </div>
    </section>
  );
}
