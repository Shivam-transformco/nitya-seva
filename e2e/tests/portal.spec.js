import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { ADMIN, API_URL, WEB_URL, serverEnv } from "../env.js";

// One story, in order: a visitor pledges, an admin assigns it, a devotee follows up and records
// a payment, and the admin sees it in reports. Each step builds on the previous one.
test.describe.configure({ mode: "serial" });

const SEVAK = { name: "Radha Test", phone: "98765 43210", email: "radha@example.org", amount: 1100 };
const NOTE = "Hare Krishna, please call in the evening";
const DEVOTEE = { name: "Gopal Das", email: "gopal@example.org", password: "gopal-own-password-1" };
const ADMIN_NEW_PASSWORD = "admin-own-password-1";

let admin;
let devotee;
let devoteeTempPassword;

test.beforeAll(async ({ browser }) => {
  const open = async () => {
    const page = await (await browser.newContext({ baseURL: WEB_URL, timezoneId: "Asia/Kolkata" })).newPage();
    page.on("dialog", (d) => d.accept());
    return page;
  };
  admin = await open();
  devotee = await open();
});

test.afterAll(async () => {
  await admin?.context().close();
  await devotee?.context().close();
});

const nav = (page, name) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });

async function signIn(page, email, password) {
  await page.goto("/portal/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function choosePassword(page, current, next) {
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel(/^New password/).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Save password" }).click();
}

test("the migration carried the old submission into the new model", async ({ request }) => {
  const stats = await (await request.get(`${API_URL}/api/stats`)).json();
  expect(stats).toEqual({ ok: true, totalPledged: 501, totalSewaks: 1, target: 155000 });
});

test("a visitor offers seva on the public site", async ({ page }) => {
  await page.goto("/");
  const form = page.locator("form#seva-form");
  await form.getByLabel(/Full name/).fill(SEVAK.name);
  await form.getByLabel(/Phone/).fill(SEVAK.phone);
  await form.getByLabel(/^Email/).fill(SEVAK.email);
  await form.getByRole("button", { name: "Other" }).click();
  await form.getByLabel(/Custom amount/).fill(String(SEVAK.amount));
  await form.getByLabel(/A few words/).fill(NOTE);
  await form.getByLabel(/happy to be contacted/).check();
  await form.getByRole("button", { name: "Offer my seva" }).click();
  await expect(page.getByRole("heading", { name: /Hare Krishna, Radha/ })).toBeVisible();

  const stats = await (await page.request.get(`${API_URL}/api/stats`)).json();
  expect(stats).toEqual({ ok: true, totalPledged: 501 + SEVAK.amount, totalSewaks: 2, target: 155000 });
});

test("the portal opens with or without the trailing slash", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("a wrong password is rejected", async ({ page }) => {
  await signIn(page, ADMIN.email, "not-the-password");
  await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");
});

test("the admin must replace the temporary password, then sees the dashboard", async () => {
  await signIn(admin, ADMIN.email, ADMIN.password);
  await choosePassword(admin, ADMIN.password, ADMIN_NEW_PASSWORD);
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(admin.locator(".stat-card", { hasText: "Waiting for a devotee" }).locator("strong")).toHaveText("2");
  // The web pledge notifies admins; migrated history doesn't.
  await expect(admin.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
});

test("the admin adds a follow-up devotee", async () => {
  await nav(admin, "Staff").click();
  const form = admin.getByRole("form", { name: "Add a staff member" });
  await form.getByLabel("Name").fill(DEVOTEE.name);
  await form.getByLabel("Email").fill(DEVOTEE.email);
  await form.getByLabel("Role").selectOption("followup");
  devoteeTempPassword = await form.getByLabel(/Temporary password/).inputValue();
  await form.getByRole("button", { name: "Add devotee" }).click();

  await expect(admin.locator(".creds code")).toHaveText(devoteeTempPassword);
  await expect(admin.getByRole("row", { name: new RegExp(DEVOTEE.name) })).toContainText("Invited");
});

test("the admin opens the new pledge and assigns it", async () => {
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: new RegExp(SEVAK.name) }).click();
  await expect(admin.getByRole("heading", { name: SEVAK.name })).toBeVisible();
  await expect(admin.locator(".detail-sub")).toContainText("₹1,100");
  await expect(admin.locator(".detail-sub")).toContainText("Prachar Sahyog Seva");
  await expect(admin.locator(".sevak-message")).toContainText(NOTE);
  await expect(admin.getByRole("link", { name: /Call \+919876543210/ })).toHaveAttribute("href", "tel:+919876543210");
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await admin.getByLabel("Devotee who will follow up").selectOption({ label: DEVOTEE.name });
  await expect(admin.locator(".facts")).toContainText(DEVOTEE.name);
});

test("the devotee signs in and finds the assignment through a notification", async () => {
  await signIn(devotee, DEVOTEE.email, devoteeTempPassword);
  await choosePassword(devotee, devoteeTempPassword, DEVOTEE.password);
  await expect(devotee.getByRole("heading", { name: "My sevaks" })).toBeVisible();
  await expect(devotee.locator(".rows-count")).toHaveText("1 pledge");

  await devotee.getByRole("link", { name: "Notifications, 1 unread" }).click();
  await devotee.getByRole("button", { name: /A sevak has been assigned to you/ }).click();
  await expect(devotee.getByRole("heading", { name: SEVAK.name })).toBeVisible();
  await expect(devotee.getByRole("link", { name: "Notifications, 0 unread" })).toBeVisible();
});

test("the devotee logs follow-ups and the status follows", async () => {
  const form = devotee.getByRole("form", { name: "Log a follow-up" });
  await expect(devotee.getByRole("form", { name: "Record a payment" })).toHaveCount(0);

  await form.getByText("Call back later").click();
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(form.getByRole("alert")).toHaveText("Choose when to call back.");

  await form.getByLabel("Call back on").fill("2030-01-15T18:30");
  await form.getByLabel("Notes").fill("Busy at work this week");
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved. The pledge is now contacted.");
  await expect(devotee.locator(".detail-sub .badge")).toHaveText("Contacted");

  await form.getByText("Confirmed seva").click();
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved. The pledge is now confirmed.");
  await expect(devotee.locator(".detail-sub .badge")).toHaveText("Confirmed");
});

test("the devotee records a payment and gets a receipt number", async () => {
  const form = devotee.getByRole("form", { name: "Record a payment" });
  await expect(form.getByLabel("Amount (₹)")).toHaveValue(String(SEVAK.amount));
  await form.getByLabel(/Reference/).fill("UPI-123456");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form.getByRole("status")).toContainText(/Receipt NS-\d{4}-000001/);

  const history = devotee.locator(".timeline");
  await expect(history.locator("li")).toHaveCount(3);
  await expect(history).toContainText("UPI-123456");
  await expect(history).toContainText("Busy at work this week");
});

const lastMonth = () => {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

test("the devotee records an ECS mandate and the payments that come through it", async () => {
  const setup = devotee.getByRole("form", { name: "How they pay" });
  await setup.getByText("ECS / NACH auto-debit").click();
  await expect(setup.getByLabel("Mandate status")).toHaveValue("submitted");
  await setup.getByLabel(/^Bank/).fill("SBI");
  await setup.getByLabel(/^Reference \/ UMRN/).fill("SBIN7000123");
  await setup.getByLabel(/^Debit day/).fill("5");
  await setup.getByRole("button", { name: "Save" }).click();
  await expect(devotee.locator(".detail-sub .badge-mode")).toHaveText("ECS · Form submitted");

  await nav(devotee, "My sevaks").click();
  await devotee.getByLabel("How they pay").selectOption("pending");
  await expect(devotee.locator(".rows-count")).toHaveText("1 pledge");
  await devotee.getByRole("link", { name: new RegExp(SEVAK.name) }).click();

  const card = devotee.locator(".p-card", { hasText: "How they pay" });
  await card.getByRole("button", { name: "Change" }).click();
  await setup.getByLabel("Mandate status").selectOption("active");
  await setup.getByRole("button", { name: "Save" }).click();
  await expect(devotee.locator(".detail-sub .badge-mode")).toHaveText("ECS");
  await expect(card).toContainText("5 of each month");

  const pay = devotee.getByRole("form", { name: "Record a payment" });
  await expect(pay.getByLabel("Paid by")).toHaveValue("ecs");
  await pay.getByLabel("Amount (₹)").fill("1000");
  await pay.getByLabel("For the month of").fill(lastMonth());
  await pay.getByLabel(/Reference/).fill("ECS-STMT-0905");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByRole("status")).toContainText(/Receipt NS-\d{4}-000002/);
  await expect(devotee.locator(".timeline")).toContainText("ECS auto-debit · ECS-STMT-0905");
});

test("the devotee can't reach admin pages or other pledges", async () => {
  await expect(nav(devotee, "Reports")).toHaveCount(0);
  await devotee.goto("/portal/#/reports");
  await expect(devotee.getByRole("heading", { name: "Page not found" })).toBeVisible();

  expect((await devotee.request.get(`${API_URL}/api/reports/summary`)).status()).toBe(403);
  expect((await devotee.request.get(`${API_URL}/api/users`)).status()).toBe(403);

  const legacy = await (await admin.request.get(`${API_URL}/api/pledges?q=Legacy`)).json();
  const legacyId = legacy.data.items[0]._id;
  expect((await devotee.request.get(`${API_URL}/api/pledges/${legacyId}`)).status()).toBe(404);
  await devotee.goto(`/portal/#/pledges/${legacyId}`);
  await expect(devotee.getByRole("alert")).toHaveText("Pledge not found.");
});

test("the admin sees the money and activity in the dashboard and reports", async () => {
  await nav(admin, "Dashboard").click();
  await expect(admin.locator(".stat-card", { hasText: "Committed each month" }).locator("strong")).toHaveText("₹1,100");
  await expect(admin.locator(".stat-card", { hasText: "Collected in" }).locator("strong")).toHaveText("₹1,100");
  await expect(admin.locator(".stat-card", { hasText: "Waiting for a devotee" }).locator("strong")).toHaveText("1");

  await nav(admin, "Reports").click();
  await expect(admin.getByRole("table", { name: "Collections by month" }).getByRole("row", { name: /₹1,100/ })).toBeVisible();
  const modes = admin.getByRole("table", { name: "Pledges by payment mode" });
  await expect(modes.getByRole("row", { name: /ECS \/ NACH auto-debit/ })).toContainText("₹1,100");
  const methods = admin.getByRole("table", { name: "Collections by payment method" });
  await expect(methods.getByRole("row", { name: /ECS auto-debit/ })).toContainText("₹1,000");
  await expect(methods.getByRole("row", { name: /^UPI / })).toContainText("₹1,100");
  const activity = admin.getByRole("row", { name: new RegExp(DEVOTEE.name) });
  await expect(activity.locator("td").nth(1)).toHaveText("2");
  await expect(activity.locator("td").nth(4)).toHaveText("1");

  const [download] = await Promise.all([
    admin.waitForEvent("download"),
    admin.getByRole("link", { name: /Download all pledges/ }).click(),
  ]);
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain(SEVAK.name);
  expect(csv).toContain("Legacy Devotee");
  expect(csv).toContain(`${SEVAK.amount},Monthly,${SEVAK.amount},confirmed,website,,${DEVOTEE.name}`);
  expect(csv).toContain("501,Monthly,501,new,legacy,");
  expect(csv).toContain(",ecs,active,SBI,SBIN7000123,5");
});

const publicStats = async (page) => (await page.request.get(`${API_URL}/api/stats`)).json();

test("a fake entry is marked as not genuine and drops off the counter", async () => {
  const submitted = await admin.request.post(`${API_URL}/api/submit`, {
    data: { name: "Spam Bot", phone: "9123456789", amount: "999", consent: "yes", message: "", submittedFrom: WEB_URL },
  });
  expect(submitted.ok()).toBe(true);
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 501 + 1100 + 999, totalSewaks: 3 });

  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: /Spam Bot/ }).click();
  const form = admin.getByRole("form", { name: "Mark as not genuine" });
  await form.getByLabel("Reason").selectOption("spam");
  await form.getByLabel(/Note/).fill("Number doesn't exist");
  await form.getByRole("button", { name: "Mark as not genuine" }).click();
  await expect(admin.locator(".p-banner-flag")).toContainText("Marked as not genuine: Spam.");
  await expect(admin.locator(".p-banner-flag")).toContainText("Number doesn't exist");
  await expect(admin.getByText("payments can't be recorded")).toBeVisible();

  expect(await publicStats(admin)).toMatchObject({ totalPledged: 501 + 1100, totalSewaks: 2 });

  await nav(admin, "Pledges").click();
  await expect(admin.locator(".rows-count")).toHaveText("2 pledges");
  await admin.getByRole("tab", { name: "Not genuine" }).click();
  await expect(admin.locator(".rows-count")).toHaveText("1 pledge");
  await expect(admin.getByRole("link", { name: /Spam Bot/ })).toContainText("Spam");
});

test("an admin hides a real pledge and adjusts the counter by hand", async () => {
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: /Legacy Devotee/ }).click();
  await admin.getByLabel("Count this pledge on the website counter").uncheck();
  await expect(admin.locator(".p-banner")).toContainText("Hidden from the public counter.");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 1100, totalSewaks: 1 });

  await nav(admin, "Counter").click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹1,100");
  await expect(admin.getByTestId("displayed-sevaks")).toHaveText("1 sevak");
  await expect(admin.getByRole("link", { name: "1 pledge hidden from the counter" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "1 pledge marked as not genuine" })).toBeVisible();

  const add = admin.getByRole("form", { name: "Add an adjustment" });
  await add.getByLabel(/^Label/).fill("Offline sevaks");
  await add.getByLabel(/^Amount per month/).fill("5000");
  await add.getByLabel(/^Sevaks/).fill("3");
  await add.getByRole("button", { name: "Add adjustment" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹6,100");
  await expect(admin.getByTestId("displayed-sevaks")).toHaveText("4 sevaks");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 6100, totalSewaks: 4 });

  const row = admin.locator(".adj", { hasText: "Offline sevaks" });
  await row.getByRole("button", { name: "Pause" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹1,100");
  await row.getByRole("button", { name: "Resume" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹6,100");

  await row.getByRole("button", { name: "Edit" }).click();
  const edit = admin.getByRole("form", { name: "Edit adjustment" });
  await edit.getByLabel(/^Amount per month/).fill("-200");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByTestId("displayed-amount")).toHaveText("₹900");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 900, totalSewaks: 4 });

  expect((await devotee.request.get(`${API_URL}/api/counter`)).status()).toBe(403);
});

test("an admin changes the monthly goal and the website follows", async () => {
  await expect(admin.getByTestId("goal-progress")).toHaveText("1% of the ₹1,55,000 monthly goal");
  const goal = admin.getByRole("form", { name: "Monthly goal" });
  await goal.getByLabel(/^Goal per month/).fill("10000");
  await goal.getByRole("button", { name: "Save goal" }).click();
  await expect(goal.getByRole("status")).toHaveText("Saved.");
  await expect(admin.getByTestId("goal-progress")).toHaveText("9% of the ₹10,000 monthly goal");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 900, target: 10000 });

  const site = await admin.context().newPage();
  await site.goto("/");
  await site.locator(".tracker-section").scrollIntoViewIfNeeded();
  await expect(site.locator(".tracker-sub")).toHaveText("Raised of ₹10,000");
  await expect(site.locator(".tracker-stat-right")).toHaveText("₹9,100 to go");
  await site.close();

  const res = await devotee.request.put(`${API_URL}/api/counter/target`, { data: { target: 1 } });
  expect(res.status()).toBe(403);
});

test("a misclicked status is undone, and a mistaken follow-up deleted", async () => {
  await nav(devotee, "My sevaks").click();
  await devotee.getByRole("link", { name: new RegExp(SEVAK.name) }).click();
  const status = devotee.locator(".p-card", { has: devotee.getByRole("heading", { name: "Status" }) });

  await status.getByRole("button", { name: "Mark paused" }).click();
  await expect(devotee.locator(".detail-sub .badge").first()).toHaveText("Paused");
  await expect(status.locator(".undo-note")).toContainText(`Changed from Confirmed to Paused by ${DEVOTEE.name}`);
  await status.getByRole("button", { name: "Undo · back to confirmed" }).click();
  await expect(devotee.locator(".detail-sub .badge").first()).toHaveText("Confirmed");
  await expect(status.locator(".undo-note")).toHaveCount(0);
  await expect(status.getByText("Correct the status")).toHaveCount(0);

  const history = devotee.locator(".timeline li");
  await expect(history).toHaveCount(4);
  const form = devotee.getByRole("form", { name: "Log a follow-up" });
  await form.getByText("No answer").click();
  await form.getByLabel("Notes").fill("Logged on the wrong sevak");
  await form.getByRole("button", { name: "Save follow-up" }).click();
  await expect(history).toHaveCount(5);
  await history.filter({ hasText: "Logged on the wrong sevak" }).getByRole("button", { name: "Delete this follow-up" }).click();
  await expect(history).toHaveCount(4);
  await expect(devotee.locator(".timeline")).not.toContainText("Logged on the wrong sevak");

  // Payments were recorded, so it can't go back to a never-confirmed status, even by correction.
  const id = devotee.url().split("/").pop();
  const res = await admin.request.patch(`${API_URL}/api/pledges/${id}/status`, { data: { status: "contacted", correction: true } });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("has payments recorded");
  const asDevotee = await devotee.request.patch(`${API_URL}/api/pledges/${id}/status`, { data: { status: "new", correction: true } });
  expect(asDevotee.status()).toBe(403);
});

test("staff correct the sevak's details and amount", async () => {
  const details = devotee.locator(".p-card", { has: devotee.getByRole("heading", { name: "Details" }) });
  await details.getByRole("button", { name: "Edit" }).click();
  const form = devotee.getByRole("form", { name: "Edit details" });
  await expect(form.getByLabel("Phone")).toHaveValue("+919876543210");

  await form.getByLabel("Phone").fill("9123456789");
  await form.getByRole("button", { name: "Save details" }).click();
  await expect(form.getByRole("alert")).toContainText("already belongs to Spam Bot");

  await form.getByLabel("Phone").fill("+91 98765 43210");
  await form.getByLabel(/^Email/).fill("radha.devi@example.org");
  await form.getByLabel(/^Amount/).fill("1200");
  await form.getByLabel("Next follow-up").fill("2030-02-01T10:00");
  await form.getByRole("button", { name: "Save details" }).click();
  await expect(form.getByRole("alert")).toContainText("fixes a mistake or is a change by the sevak");
  await form.getByText(/The sevak changed it: ₹1,100 stays/).click();
  await form.getByRole("button", { name: "Save details" }).click();
  await expect(devotee.locator(".detail-sub")).toContainText("₹1,200");
  await expect(devotee.getByText("Earlier amounts (1)")).toBeVisible();
  await expect(details).toContainText("radha.devi@example.org");
  await expect(details).toContainText("1 Feb 2030");
  expect(await publicStats(admin)).toMatchObject({ totalPledged: 1000 });
});

test("an admin deletes a payment and a pledge, and restores them", async () => {
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: new RegExp(SEVAK.name) }).click();
  const history = admin.locator(".timeline li");
  await expect(history).toHaveCount(4);
  await admin.getByRole("button", { name: /Delete payment NS-\d{4}-000002/ }).click();
  await expect(history).toHaveCount(3);
  await expect(admin.locator(".timeline")).not.toContainText("ECS-STMT-0905");

  await nav(admin, "Pledges").click();
  await admin.getByRole("tab", { name: "Not genuine" }).click();
  await admin.getByRole("link", { name: /Spam Bot/ }).click();
  const id = admin.url().split("/").pop();
  expect((await devotee.request.delete(`${API_URL}/api/pledges/${id}`)).status()).toBe(403);
  const remove = admin.locator(".p-card-danger");
  await remove.getByLabel(/Reason/).fill("Cleaning up spam");
  await remove.getByRole("button", { name: "Delete pledge" }).click();
  await expect(admin.getByRole("heading", { name: "Pledges" })).toBeVisible();
  expect((await admin.request.get(`${API_URL}/api/pledges/${id}`)).status()).toBe(404);

  await admin.getByRole("link", { name: "Recently deleted" }).click();
  await expect(admin.getByRole("heading", { name: "Recently deleted" })).toBeVisible();
  const rows = admin.locator(".rows li");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: `Follow-up · ${SEVAK.name}` })).toContainText(`Deleted by ${DEVOTEE.name}`);
  const pledgeRow = rows.filter({ hasText: "Pledge · Spam Bot" });
  await expect(pledgeRow).toContainText("₹999 a month");
  await expect(pledgeRow).toContainText("“Cleaning up spam”");
  const paymentRow = rows.filter({ hasText: `Payment · ${SEVAK.name}` });
  await expect(paymentRow).toContainText("₹1,000");

  await paymentRow.getByRole("button", { name: "Restore" }).click();
  await expect(admin.getByRole("heading", { name: SEVAK.name })).toBeVisible();
  await expect(admin.locator(".timeline")).toContainText("ECS-STMT-0905");

  await admin.goto("/portal/#/deleted");
  await rows.filter({ hasText: "Pledge · Spam Bot" }).getByRole("button", { name: "Restore" }).click();
  await expect(admin.getByRole("heading", { name: "Spam Bot" })).toBeVisible();
  await expect(admin.locator(".p-banner-flag")).toContainText("Number doesn't exist");

  await admin.locator(".p-card-danger").getByRole("button", { name: "Delete pledge" }).click();
  await admin.getByRole("link", { name: "Recently deleted" }).click();
  await rows.filter({ hasText: "Pledge · Spam Bot" }).getByRole("button", { name: "Delete for good" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(`Follow-up · ${SEVAK.name}`);
  expect((await devotee.request.get(`${API_URL}/api/deleted`)).status()).toBe(403);
});

/** A signed-in API session for a new staff member, past the forced password change. */
async function staffSession(playwright, email, temporary) {
  const ctx = await playwright.request.newContext({ baseURL: API_URL });
  expect((await ctx.post("/api/auth/login", { data: { email, password: temporary } })).ok()).toBe(true);
  const changed = await ctx.post("/api/auth/password", { data: { currentPassword: temporary, newPassword: `${temporary}-own` } });
  expect(changed.ok()).toBe(true);
  return ctx;
}

test("only owners manage admins; accounts and viewers see just their part", async ({ playwright }) => {
  const add = async (name, role) => {
    const email = `${name.split(" ")[0].toLowerCase()}.${role}@example.org`;
    const temporaryPassword = `${role}-temporary-1`;
    const res = await admin.request.post(`${API_URL}/api/users`, { data: { name, email, role, temporaryPassword } });
    expect(res.status()).toBe(201);
    return staffSession(playwright, email, temporaryPassword);
  };
  const asAdmin = await add("Asha Admin", "admin");
  const asAccounts = await add("Kiran Accounts", "accounts");
  const asViewer = await add("Vani Viewer", "viewer");
  const ownerId = (await (await admin.request.get(`${API_URL}/api/auth/me`)).json()).data._id;
  const newUser = (role) => ({ name: `New ${role}`, email: `new-${role}@example.org`, role, temporaryPassword: "temporary-pass-9" });

  // An admin runs things but can't touch owners or other admins.
  expect((await asAdmin.post("/api/users", { data: newUser("owner") })).status()).toBe(403);
  expect((await asAdmin.post("/api/users", { data: newUser("admin") })).status()).toBe(403);
  expect((await asAdmin.post("/api/users", { data: newUser("followup") })).status()).toBe(201);
  expect((await asAdmin.patch(`/api/users/${ownerId}`, { data: { active: false } })).status()).toBe(403);
  expect((await asAdmin.get("/api/audit")).status()).toBe(403);
  const bin = (await (await asAdmin.get("/api/deleted")).json()).data.items;
  expect((await asAdmin.delete(`/api/deleted/${bin[0]._id}`)).status()).toBe(403);
  expect((await admin.request.patch(`${API_URL}/api/users/${ownerId}`, { data: { role: "admin" } })).status()).toBe(400);

  // Accounts see every pledge and the money, but don't work follow-ups.
  const pledges = (await (await asAccounts.get(`/api/pledges?q=${encodeURIComponent(SEVAK.name)}`)).json()).data;
  expect(pledges.total).toBe(1);
  const pledgeId = pledges.items[0]._id;
  const detail = (await (await asAccounts.get(`/api/pledges/${pledgeId}`)).json()).data;
  expect(detail.access).toEqual({ work: false, payments: true, manage: false });
  expect((await asAccounts.patch(`/api/pledges/${pledgeId}/status`, { data: { status: "paused" } })).status()).toBe(403);
  expect((await asAccounts.get("/api/reports/pledges.csv")).status()).toBe(200);
  expect((await asAccounts.get("/api/counter")).status()).toBe(403);

  // Viewers get totals, never sevaks' names or numbers.
  expect((await asViewer.get("/api/reports/summary")).status()).toBe(200);
  expect((await asViewer.get("/api/reports/pledges.csv")).status()).toBe(403);
  expect((await asViewer.get(`/api/pledges/${pledgeId}`)).status()).toBe(404);
  expect((await (await asViewer.get("/api/pledges")).json()).data.total).toBe(0);
  await Promise.all([asAdmin.dispose(), asAccounts.dispose(), asViewer.dispose()]);

  await nav(admin, "Activity").click();
  await admin.getByRole("tab", { name: "Staff" }).click();
  const newest = admin.locator(".rows li").first();
  await expect(newest).toContainText("Asha Admin · Added a staff member");
  await expect(newest).toContainText("role: followup");
  await nav(admin, "Staff").click();
  await expect(admin.getByLabel("Role for Asha Admin")).toHaveValue("admin");
});

test("a Google Form response and an earlier giver are added by hand", async () => {
  const before = await publicStats(admin);
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: "Add pledge" }).click();
  const form = admin.getByRole("form", { name: "Add a pledge" });
  await form.getByLabel("Name").fill("Form Devotee");
  await form.getByLabel("Phone").fill("90000 00001");
  await expect(form.getByLabel("Came from")).toHaveValue("google_form");
  await form.getByLabel("Count this pledge on the website counter").uncheck();
  await form.getByRole("button", { name: "Save and add another" }).click();
  await expect(admin.getByRole("status")).toContainText("Added Form Devotee.");
  await expect(form.getByLabel("Name")).toHaveValue("");

  await form.getByLabel("Name").fill("Old Sevak");
  await form.getByLabel("Phone").fill("90000 00002");
  await form.getByLabel("Came from").selectOption("pre_website");
  await expect(form.getByLabel("Status")).toHaveValue("confirmed");
  await form.getByLabel("Amount (₹)").fill("3000");
  await form.getByLabel("How often").selectOption("Quarterly");
  await form.getByLabel(/^Giving since/).fill("2024-01");
  await expect(form.getByLabel("Count this pledge on the website counter")).not.toBeChecked();
  await form.getByLabel("Count this pledge on the website counter").check();
  await form.getByRole("button", { name: "Save pledge" }).click();

  await expect(admin.getByRole("heading", { name: "Old Sevak" })).toBeVisible();
  await expect(admin.locator(".detail-sub")).toContainText("₹3,000 a quarter");
  await expect(admin.locator(".detail-sub .badge-origin")).toHaveText("Before the website");
  const details = admin.locator(".p-card", { has: admin.getByRole("heading", { name: "Details" }) });
  await expect(details).toContainText("Jan 2024");
  await expect(details).toContainText("About ₹1,000 a month in totals");
  // The quarterly gift counts as ₹1,000 a month; the undecided, hidden form response adds nothing.
  expect(await publicStats(admin)).toMatchObject({ totalPledged: before.totalPledged + 1000, totalSewaks: before.totalSewaks + 1 });

  const past = admin.locator("details", { hasText: "Enter past payments" });
  await past.locator("summary").click();
  const pastForm = admin.getByRole("form", { name: "Enter past payments" });
  await expect(pastForm.getByLabel("From", { exact: true })).toHaveValue("2024-01");
  await pastForm.getByLabel("To", { exact: true }).fill("2024-12");
  await pastForm.getByLabel(/^Reference/).fill("Old register");
  await pastForm.getByRole("button", { name: "Add past payments" }).click();
  await expect(pastForm.getByRole("status")).toHaveText("Added 4 payments.");
  await expect(admin.locator(".timeline li")).toHaveCount(4);
  await expect(admin.locator(".timeline")).toContainText("Payment ₹3,000 for Oct 2024");
  await pastForm.getByLabel("To", { exact: true }).fill("2024-12");
  await pastForm.getByRole("button", { name: "Add past payments" }).click();
  await expect(pastForm.getByRole("status")).toHaveText("Added 0 payments; skipped 4 months that already had one.");

  const status = admin.locator(".p-card", { has: admin.getByRole("heading", { name: "Status" }) });
  await status.getByLabel(/resume on/).fill("2030-03-01");
  await status.getByRole("button", { name: "Mark paused" }).click();
  await expect(admin.locator(".p-banner", { hasText: "Paused until" })).toContainText("Paused until 1 Mar 2030");
  await expect(details).toContainText("1 Mar 2030");

  await nav(admin, "Pledges").click();
  await admin.getByLabel("Came from").selectOption("google_form");
  await expect(admin.locator(".rows-count")).toHaveText("1 pledge");
  await expect(admin.getByRole("link", { name: /Form Devotee/ })).toContainText("Amount not set");
});

test("the same person entered twice is merged into one sevak", async () => {
  await admin.getByLabel("Came from").selectOption("pre_website");
  await admin.getByRole("link", { name: /Old Sevak/ }).click();
  const merge = admin.locator("details", { hasText: "Same person entered twice?" });
  await merge.locator("summary").click();
  await merge.getByLabel("Find sevak to merge").fill("Form Devotee");
  await merge.getByRole("button", { name: "Find" }).click();
  await merge.getByRole("button", { name: "Merge into Old" }).click();
  await expect(merge.getByRole("status")).toHaveText("Merged. 1 pledge moved to Old Sevak.");
  await expect(admin.locator(".facts")).toContainText("Also: +919000000001");

  const found = await (await admin.request.get(`${API_URL}/api/pledges?q=9000000001`)).json();
  expect(found.data.total).toBe(2);
  expect(found.data.items.every((p) => p.sevak.name === "Old Sevak")).toBe(true);
});

const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());
const monthsAgo = (n) => {
  const [y, m] = thisMonth().split("-").map(Number);
  const i = y * 12 + (m - 1) - n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};

test("missed months show up with their reasons, in reports and the overdue list", async () => {
  await nav(admin, "Pledges").click();
  await admin.getByRole("link", { name: "Add pledge" }).click();
  const form = admin.getByRole("form", { name: "Add a pledge" });
  await form.getByLabel("Name").fill("Late Sevak");
  await form.getByLabel("Phone").fill("90000 00003");
  await form.getByLabel("Came from").selectOption("pre_website");
  await form.getByLabel("Amount (₹)").fill("500");
  await form.getByLabel(/^Giving since/).fill(monthsAgo(3));
  await form.getByRole("button", { name: "Save pledge" }).click();
  await expect(admin.getByRole("heading", { name: "Late Sevak" })).toBeVisible();

  // Three months gone with nothing paid; this month's isn't due until the month end.
  const dues = admin.locator(".p-card", { has: admin.getByRole("heading", { name: "Payments by month" }) });
  await expect(dues).toContainText("3 gifts in a row not paid · ₹1,500 owed in the last 12 months.");
  await expect(dues).toContainText("₹500 is still to come, due by day");
  const months = dues.locator(".dues-list > li");
  await expect(months).toHaveCount(4);
  await expect(months.first()).toContainText("Still to come");
  await expect(months.nth(1)).toContainText("Missed");

  await months.nth(3).getByRole("button", { name: "Add reason" }).click();
  await months.nth(3).getByLabel("Why it didn't come").selectOption("travelling");
  await months.nth(3).getByLabel("Note (optional)").fill("Back from Vrindavan next month");
  await months.nth(3).getByLabel(/Excuse this month/).check();
  await months.nth(3).getByRole("button", { name: "Save reason" }).click();
  await expect(months.nth(3)).toContainText("Excused");
  await expect(months.nth(3)).toContainText("Travelling · Back from Vrindavan next month (excused)");
  await expect(dues).toContainText("2 gifts in a row not paid · ₹1,000 owed");
  const pledgeId = admin.url().split("/").pop();

  await nav(admin, "Pledges").click();
  await admin.getByRole("tab", { name: "Payment overdue" }).click();
  await expect(admin.getByRole("link", { name: /Late Sevak/ })).toContainText("2 payments missed");
  await expect(admin.getByRole("link", { name: /Late Sevak/ })).toContainText("₹500 due by");
  await expect(admin.getByRole("link", { name: /Form Devotee/ })).toHaveCount(0);

  await nav(admin, "Reports").click();
  await expect(admin.getByRole("heading", { name: /This month so far/ })).toBeVisible();
  await expect(admin.getByRole("table", { name: "Committed and collected by month" })).toBeVisible();
  await admin.getByRole("link", { name: "Missed payments" }).click();
  const late = admin.locator(".rows li", { hasText: "Late Sevak" });
  await expect(late).toContainText("2 in a row");
  await expect(late).toContainText("₹1,000 owed");
  await expect(late).toContainText("last paid never");

  await admin.goto(`/portal/#/reports/month/${monthsAgo(1)}`);
  const row = admin.locator(".rows li", { hasText: "Late Sevak" });
  await expect(row).toContainText("Missed");
  await row.getByRole("button", { name: "Add reason" }).click();
  await row.getByLabel("Why it didn't come").selectOption("bank_failure");
  await row.getByLabel("Note (optional)").fill("Mandate bounced");
  await row.getByRole("button", { name: "Save reason" }).click();
  await expect(row).toContainText("Bank debit failed · Mandate bounced");

  // The devotee only sees their own sevak: Radha's raised amount left this month part paid.
  const own = (await (await devotee.request.get(`${API_URL}/api/dues/overdue`)).json()).data;
  expect(own.map((r) => r.sevak.name)).toEqual([SEVAK.name]);
  expect(own[0].months).toEqual([{ month: thisMonth(), state: "partial", expected: 1200, paid: 1100 }]);
  expect((await devotee.request.put(`${API_URL}/api/pledges/${pledgeId}/dues/${monthsAgo(1)}`, { data: { reason: "forgot" } })).status()).toBe(404);
  expect((await devotee.request.get(`${API_URL}/api/statements`)).status()).toBe(403);

  // Setting a due day shows on the pledge.
  await admin.goto(`/portal/#/pledges/${pledgeId}`);
  const details = admin.locator(".p-card", { has: admin.getByRole("heading", { name: "Details" }) });
  await details.getByRole("button", { name: "Edit" }).click();
  await admin.getByRole("form", { name: "Edit details" }).getByLabel("Due on day").fill("10");
  await admin.getByRole("form", { name: "Edit details" }).getByRole("button", { name: "Save details" }).click();
  await expect(details).toContainText("by day 10");

  // Paying last month doesn't hide the month before it.
  const paid = await admin.request.post(`${API_URL}/api/pledges/${pledgeId}/payments`, {
    data: { amount: 500, month: monthsAgo(1), method: "upi" },
  });
  expect(paid.ok()).toBe(true);
  const lateRow = (await (await admin.request.get(`${API_URL}/api/dues/overdue`)).json()).data.find((r) => r.sevak.name === "Late Sevak");
  expect(lateRow.months.map((m) => m.month)).toContain(monthsAgo(2));
  await nav(admin, "Pledges").click();
  await admin.getByRole("tab", { name: "Payment overdue" }).click();
  await expect(admin.getByRole("link", { name: /Late Sevak/ }).locator(".badge-due-missed")).toBeVisible();

  // Fixing a mistyped amount applies to every month and keeps no earlier amount.
  const fixed = await admin.request.patch(`${API_URL}/api/pledges/${pledgeId}`, { data: { amount: 550, amountChange: "correction" } });
  expect(fixed.ok()).toBe(true);
  const after = (await fixed.json()).data;
  expect(after.amountHistory).toEqual([]);
  expect(after.dues.months.every((m) => m.state === "excused" || m.expected === 550)).toBe(true);

  // A real change can start in an earlier month; the months before keep the old amount.
  const raised = await admin.request.patch(`${API_URL}/api/pledges/${pledgeId}`, {
    data: { amount: 600, amountChange: "from_now", amountFrom: monthsAgo(1) },
  });
  expect(raised.ok()).toBe(true);
  const expectedIn = Object.fromEntries((await raised.json()).data.dues.months.map((m) => [m.month, m.expected]));
  expect(expectedIn[monthsAgo(1)]).toBe(600);
  expect(expectedIn[monthsAgo(2)]).toBe(550);
  // Changing again from an earlier month replaces what was recorded from then on.
  const earlier = await admin.request.patch(`${API_URL}/api/pledges/${pledgeId}`, {
    data: { amount: 700, amountChange: "from_now", amountFrom: monthsAgo(2) },
  });
  expect(earlier.ok()).toBe(true);
  const nowExpected = Object.fromEntries((await earlier.json()).data.dues.months.map((m) => [m.month, m.expected]));
  expect([nowExpected[monthsAgo(3)], nowExpected[monthsAgo(2)], nowExpected[monthsAgo(1)]]).toEqual([550, 700, 700]);

  // A pause that started last month: last month's payment still counts (₹500 of the ₹600 now), this month isn't due.
  const status = (data) => admin.request.patch(`${API_URL}/api/pledges/${pledgeId}/status`, { data });
  expect((await status({ status: "paused", from: monthsAgo(-1) })).status()).toBe(400);
  expect((await status({ status: "paused", from: monthsAgo(4) })).status()).toBe(400);
  const paused = await status({ status: "paused", from: monthsAgo(1) });
  expect(paused.ok()).toBe(true);
  const stateIn = Object.fromEntries((await paused.json()).data.dues.months.map((m) => [m.month, m.state]));
  expect(stateIn).toMatchObject({ [monthsAgo(1)]: "partial", [thisMonth()]: "paused", [monthsAgo(2)]: "missed" });
});

test("yearly statements list each sevak's payments by financial year", async () => {
  await nav(admin, "Reports").click();
  await admin.getByRole("link", { name: "Yearly statements" }).click();
  await expect(admin.getByRole("row", { name: new RegExp(SEVAK.name) })).toBeVisible();

  await admin.getByLabel("Financial year").selectOption("2024");
  const old = admin.getByRole("row", { name: /Old Sevak/ });
  // April, July and October 2024; January 2024 belongs to the year before.
  await expect(old).toContainText("₹9,000");
  await old.getByRole("link", { name: "Old Sevak" }).click();
  await expect(admin.getByRole("heading", { name: "Nitya Seva statement" })).toBeVisible();
  await expect(admin.locator(".statement")).toContainText("Financial year 2024-25");
  await expect(admin.getByRole("table", { name: "Payments" }).locator("tbody tr")).toHaveCount(4);
  await expect(admin.locator("tr.total")).toContainText("₹9,000");
  await expect(admin.getByRole("button", { name: "Print" })).toBeEnabled();
});

test("the daily job only runs with its secret", async ({ request }) => {
  expect((await request.get(`${API_URL}/api/cron/daily`)).status()).toBe(403);
  const res = await request.get(`${API_URL}/api/cron/daily`, {
    headers: { Authorization: `Bearer ${serverEnv.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
});

test("deactivating a devotee ends their session", async () => {
  await nav(admin, "Staff").click();
  const row = admin.getByRole("row", { name: new RegExp(DEVOTEE.name) });
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row).toContainText("Deactivated");

  await devotee.reload();
  await expect(devotee.getByRole("button", { name: "Sign in" })).toBeVisible();
  await signIn(devotee, DEVOTEE.email, DEVOTEE.password);
  await expect(devotee.getByRole("alert")).toHaveText("Incorrect email or password.");
});
